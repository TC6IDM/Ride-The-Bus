import os
import sys
import threading
import time
import math
import random
import hashlib
from concurrent.futures import ProcessPoolExecutor
from multiprocessing import Process, Manager
import cProfile
from warnings import warn
import shutil
import asyncio
from typing import Dict

from src.write_data.write_data import output_lookup_and_force_files


def format_elapsed(seconds: float) -> str:
    """
    Human-readable duration: "38m 12s 480ms" rather than "2292.4801034927368".

    A raw float of seconds is fine for a ten-second run and useless for a
    forty-minute one - nobody divides 2292.48 by 60 in their head to find out
    whether a build is getting slower. Leading zero units are dropped so a short
    run stays short, and milliseconds are always shown because that is the part
    a raw float was actually good at.
    """
    total_ms = int(round(seconds * 1000))
    hours, rem = divmod(total_ms, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, millis = divmod(rem, 1000)

    parts = []
    if hours:
        parts.append(f"{hours}h")
    if hours or minutes:
        parts.append(f"{minutes}m")
    if hours or minutes or secs:
        parts.append(f"{secs}s")
    parts.append(f"{millis}ms")
    return " ".join(parts)


# One gamestate per pool worker, for the life of the build.
_WORKER_GAMESTATE = None


def _init_worker(gamestate: object) -> None:
    """Pool worker setup: unpickle the gamestate once, not once per batch."""
    global _WORKER_GAMESTATE
    _WORKER_GAMESTATE = gamestate


def _simulate_slice(job: dict) -> list:
    """
    One worker's slice of one batch, in a process that already exists.

    The same work as the `Process(target=gamestate.run_sims)` path below, with
    the same global simulation indices - so the same books, byte for byte -
    and three differences that exist only to stop paying for the process:

      * the gamestate came from the pool initializer rather than a fresh
        pickle, so `config.wincap` (which create_books sets per mode on the
        parent) is applied here. run_sims sets everything else it reads.
      * `sim_to_criteria` and `simulation_seeds` are rebuilt from a
        description. Both are indexed by GLOBAL simulation index, so every
        worker used to be handed all 800,000 entries of each.
      * the betmode configs come back as a return value instead of through a
        Manager list, which is one more process per batch that is not needed.
    """
    gamestate = _WORKER_GAMESTATE
    gamestate.config.wincap = job["wincap"]

    criteria = job.get("sim_to_criteria")
    if criteria is None:
        criteria = [job["criteria_value"]] * job["criteria_length"]
    seeds = job.get("simulation_seeds")
    if seeds is None:
        seeds = range(job["seeds_length"])

    produced = []
    gamestate.run_sims(
        produced,
        job["betmode"],
        criteria,
        job["total_threads"],
        job["total_repeats"],
        job["num_sims"],
        job["thread_index"],
        job["repeat_count"],
        job["compress"],
        job["write_event_list"],
        seeds,
    )
    return produced


def create_books(
    gamestate: object,
    config: object,
    num_sim_args: dict,
    batch_size: int,
    threads: int,
    compress: bool,
    profiling: bool,
):
    """Main run-function for simulating game outcomes and outputting all files."""
    for key, ns in num_sim_args.items():
        if all([ns > 0, ns > batch_size * batch_size]):
            assert (
                ns % (threads * batch_size) == 0
            ), "mode-sims/(batch * threads) must be divisible with no remainder"
        num_sim_args[key] = int(ns)

    if not compress and sum(num_sim_args.values()) > 1e4:
        warn("Generating large number of uncompressed books!")

    if profiling and threads > 1:
        raise RuntimeError("Multithread profiling not supported, threads must = 1 with profiling enabled")

    startTime = time.time()
    print("\nCreating books...")

    # ONE pool for the whole build. Spawning `threads` fresh interpreters (plus
    # a Manager) for every batch of every mode was measured at over a third of
    # the simulation pass on the 193-mode Ride The Bus build - ~1,960 process
    # starts, each re-importing the SDK and unpickling a GameState carrying 193
    # BetModes. The workers are started once now and fed.
    pool = None
    if threads > 1 and not profiling and os.environ.get("MATH_WORKER_POOL") != "0":
        pool = ProcessPoolExecutor(max_workers=threads, initializer=_init_worker, initargs=(gamestate,))
    try:
        _create_books_modes(gamestate, config, num_sim_args, batch_size, threads, compress, profiling, pool)
    finally:
        if pool is not None:
            pool.shutdown()
    shutil.rmtree(gamestate.output_files.temp_path)
    print(f"\nFinished creating books in {format_elapsed(time.time() - startTime)}.\n")


class _LineAtomicStdout:
    """
    sys.stdout for while a second thread is printing.

    print(a, b, c) is SEVEN write() calls - each argument, each separator, the
    newline - so two threads printing at once interleave mid-line. With the
    output writer running beside the main loop that produced lines like
    "Creating books for  ride_the_busride_the_bus  inin  sc_black_...sc_red_...":
    the books were unaffected, but the transcript is the build's log and what
    games/ride_the_bus/build_monitor.py parses, and it lost track of modes.

    Each thread's partial line is held separately and only complete lines are
    written, one write per line, under a lock. Nothing is reordered within a
    thread, and a line always arrives whole.
    """

    def __init__(self, target):
        self._target = target
        self._lock = threading.Lock()
        self._local = threading.local()

    def write(self, text):
        pending = getattr(self._local, "pending", "") + text
        if "\n" in pending:
            complete, _, pending = pending.rpartition("\n")
            with self._lock:
                self._target.write(complete + "\n")
                self._target.flush()
        self._local.pending = pending
        return len(text)

    def flush(self):
        pending = getattr(self._local, "pending", "")
        with self._lock:
            if pending:
                self._target.write(pending)
            self._target.flush()
        self._local.pending = ""

    def __getattr__(self, name):
        return getattr(self._target, name)


class _OutputWriter:
    """
    One mode's output_lookup_and_force_files, on a background thread.

    Merging a mode's temp files - decompressing and recompressing its books,
    concatenating its tables, the SHA-256 for the sidecar - happens in the
    parent after the workers finish, and with a persistent pool that left all
    of them idle for it: about 0.8s a mode, ~160s a build, a third of the
    simulation pass once the simulations themselves got fast. It is nearly all
    zstd, hashing and file I/O, which release the GIL, so a thread overlaps it
    with the NEXT mode's simulation for real.

    Only one runs at a time (the loop joins the previous writer before
    starting the next), so outputs are written in mode order exactly as
    before and force.json - which every mode reads and rewrites - is never
    touched by two at once. The writer reads nothing of the parent's
    gamestate that the next mode changes (see output_lookup_and_force_files'
    note on force.json). An exception is re-raised on join, so a failed merge
    still fails the build.
    """

    def __init__(self, *args, **kwargs):
        self.error = None
        self.thread = threading.Thread(target=self._run, args=args, kwargs=kwargs, daemon=True)
        self.thread.start()

    def _run(self, *args, **kwargs):
        try:
            output_lookup_and_force_files(*args, **kwargs)
        except BaseException as exc:  # re-raised in the caller by join()
            self.error = exc

    def join(self):
        self.thread.join()
        if self.error is not None:
            raise self.error


def _create_books_modes(gamestate, config, num_sim_args, batch_size, threads, compress, profiling, pool):
    """The per-mode loop, lifted out so create_books can own the worker pool."""
    # With a pool, mode N's output is merged on a thread while mode N+1
    # simulates. Without one (threads == 1, profiling, MATH_WORKER_POOL=0) it
    # stays inline, exactly as it always was.
    overlap = pool is not None and os.environ.get("MATH_OVERLAP_OUTPUT") != "0"
    writer_box = [None]  # the one _OutputWriter in flight, if any
    real_stdout = sys.stdout
    if overlap:
        sys.stdout = _LineAtomicStdout(real_stdout)
    try:
        try:
            _run_modes(gamestate, config, num_sim_args, batch_size, threads, compress, profiling, pool, overlap, writer_box)
        except BaseException:
            # Let the last merge finish before unwinding, but keep THIS error:
            # a writer failing on the way out must not replace the real cause.
            if writer_box[0] is not None:
                writer_box[0].thread.join()
            raise
        if writer_box[0] is not None:
            writer_box[0].join()
    finally:
        if sys.stdout is not real_stdout:
            sys.stdout.flush()
            sys.stdout = real_stdout


def _run_modes(gamestate, config, num_sim_args, batch_size, threads, compress, profiling, pool, overlap, writer_box):
    for betmode_name in num_sim_args:
        sim_counter = 0
        for bm in config.bet_modes:
            if bm.get_name() == betmode_name:
                for d in bm.get_distributions():
                    if d.get_fixed_amt() is not None:
                        sim_counter += d.get_fixed_amt()
                # mode-level wincap override
                gamestate.config.wincap = bm.get_wincap()

        set_sim_amount = False
        if sim_counter > 0:
            set_sim_amount = True

        if num_sim_args[betmode_name] > 0:
            gamestate.betmode = betmode_name
            nsims = max(num_sim_args[betmode_name], sim_counter)
            run_multi_process_sims(
                threads,
                batch_size,
                config.game_id,
                betmode_name,
                gamestate,
                num_sims=nsims,
                compress=compress,
                write_event_list=config.write_event_list,
                profiling=profiling,
                set_sim_amount=set_sim_amount,
                pool=pool,
            )

            output_args = (threads, batch_size, config.game_id, betmode_name, gamestate)
            output_kwargs = {"num_sims": nsims, "compress": compress}
            if overlap:
                # The previous mode's merge has had this mode's whole
                # simulation to finish; wait for it, then hand this one off.
                if writer_box[0] is not None:
                    writer_box[0].join()
                writer_box[0] = _OutputWriter(*output_args, **output_kwargs)
            else:
                output_lookup_and_force_files(*output_args, **output_kwargs)


def get_sim_splits(gamestate: object, num_sims: int, betmode_name: str) -> Dict[str, int]:
    """Ensure assignment of criteria to all simulations numbers."""
    betmode_distributions = gamestate.get_betmode(betmode_name).get_distributions()
    num_sims_criteria = {d._criteria: max(int(num_sims * d._quota), 1) for d in betmode_distributions}
    total_sims = sum(num_sims_criteria.values())
    reduce_sims = total_sims > num_sims
    listedCriteria = [d._criteria for d in betmode_distributions]
    criteria_weights = [d._quota for d in betmode_distributions]
    random.seed(0)
    while sum(num_sims_criteria.values()) != num_sims:
        c = random.choices(listedCriteria, criteria_weights)[0]
        if reduce_sims and num_sims_criteria[c] > 1:
            num_sims_criteria[c] -= 1
        elif not reduce_sims:
            num_sims_criteria[c] += 1

    return num_sims_criteria


def assign_sim_criteria(num_sims_criteria: Dict[str, int], sims: int) -> Dict[int, str]:
    """Assign criteria randomly to simulations based on quota defined in config."""
    sim_allocation = [criteria for criteria, count in num_sims_criteria.items() for _ in range(count)]
    random.shuffle(sim_allocation)
    return {i: sim_allocation[i] for i in range(min(sims, len(sim_allocation)))}


def string_to_int(s: str) -> int:
    "Convert criteria name to large integer value"
    h = hashlib.sha256(s.encode()).hexdigest()
    return int(h[:12], 16)


async def profile_and_visualize(
    game_id,
    gamestate,
    all_betmode_configs,
    betmode,
    sim_allocation,
    threads,
    num_repeats,
    sims_per_thread,
    repeat,
    compress,
    write_event_list,
    simulation_seeds,
):
    """Create flame-graph, automatically opens output on localhost."""
    output_string = f"games/{game_id}/simulationProfile_{betmode}.prof"
    cProfile.runctx(
        "gamestate.run_sims(all_betmode_configs, betmode, sim_allocation, threads, num_repeats, sims_per_thread, 0, repeat, compress, write_event_list, simulation_seeds)",
        globals(),
        locals(),
        output_string,
    )
    await asyncio.create_subprocess_exec("snakeviz", output_string)


def run_multi_process_sims(
    threads: int,
    batching_size: int,
    game_id: str,
    betmode: str,
    gamestate: object,
    num_sims: int = 1000000,
    compress: bool = True,
    write_event_list: bool = False,
    profiling: bool = False,
    set_sim_amount=False,
    pool=None,
):
    """Setup multiprocessing manager for running all game-mode simulations."""
    print("\nCreating books for", game_id, "in", betmode)
    num_repeats = max(int(round(num_sims / threads / batching_size, 0)), 1)
    sims_per_thread = int(num_sims / threads / num_repeats)
    if not set_sim_amount:
        num_sims_criteria = get_sim_splits(gamestate, num_sims, betmode)
        sim_criteria = assign_sim_criteria(num_sims_criteria, num_sims)
        simulation_seeds = [i for i in range(len(sim_criteria))]
        criteria_assignment = list(sim_criteria.values())
        # 0, 1, 2, ... by construction - a range() is the same thing to
        # run_sims, which only ever indexes it.
        seeds_sequential = True
    else:
        seeds_sequential = False
        for bm in gamestate.config.bet_modes:
            if bm.get_name() == betmode:
                dists = bm.get_distributions()
                criteria_assignment, simulation_seeds = [], []
                total_quota = 0.0
                # populate fixed amount first
                for d in dists:
                    dist_criteria = d.get_criteria()
                    if d.get_fixed_amt() is not None:
                        criteria_assignment.extend([str(dist_criteria) for _ in range(d.get_fixed_amt())])
                    else:
                        total_quota += d.get_quota()
                # populate remaining with quota
                if len(criteria_assignment) < num_sims:
                    quota_assignment = []
                    quota_probs = []
                    for d in dists:
                        dist_criteria = d.get_criteria()
                        if d.get_quota() is not None:
                            quota_assignment.append(dist_criteria)
                            quota_probs.append(d.get_quota())
                            ncriteria = math.floor(
                                max(1, (d.get_quota() / total_quota) * (num_sims - len(criteria_assignment)))
                            )
                            counter = 0
                            while (len(criteria_assignment) < num_sims) and (counter < ncriteria):
                                criteria_assignment.append(dist_criteria)
                                counter += 1
                    while len(criteria_assignment) < num_sims:
                        criteria_assignment.append(random.choices(quota_assignment, quota_probs, k=1)[0])

                    random.shuffle(criteria_assignment)
                break

        unique_criteria = set(criteria_assignment)
        criteria_offset = {}
        criteria_counter = {}
        for c in unique_criteria:
            criteria_offset[c] = string_to_int(c)
            criteria_counter[c] = 0
        simulation_seeds = []
        for c in criteria_assignment:
            offset_val = criteria_offset[c] + criteria_counter[c]
            criteria_counter[c] += 1
            simulation_seeds.append(offset_val)

    # Is every simulation on the same distribution? Every Ride The Bus mode is
    # (one "basegame" quota of 1.0), which makes criteria_assignment a single
    # value repeated up to 800,000 times. Asked once per mode, not per batch.
    constant_criteria = None
    if pool is not None and criteria_assignment and len(set(criteria_assignment)) == 1:
        constant_criteria = criteria_assignment[0]

    for repeat in range(num_repeats):
        print("Batch", repeat + 1, "of", num_repeats)
        processes = []
        if pool is not None:
            # A plain list: the pool's tasks RETURN their betmode configs, so
            # there is nothing to share between processes and no reason to
            # start a Manager - one more process per batch.
            manager = None
            all_betmode_configs = []
        else:
            manager = Manager()
            all_betmode_configs = manager.list()
        if profiling:
            asyncio.run(
                profile_and_visualize(
                    game_id=game_id,
                    gamestate=gamestate,
                    all_betmode_configs=all_betmode_configs,
                    betmode=betmode,
                    sim_allocation=criteria_assignment,
                    threads=threads,
                    num_repeats=num_repeats,
                    sims_per_thread=sims_per_thread,
                    repeat=repeat,
                    compress=compress,
                    write_event_list=write_event_list,
                    simulation_seeds=simulation_seeds,
                )
            )
        elif pool is not None:
            # The same slices, handed to workers that already exist. The lines
            # printed here are deliberately the ones this has always printed:
            # they are the build's log, and games/ride_the_bus/build_monitor.py
            # parses them into its worker strip.
            wincap = gamestate.get_betmode(betmode).get_wincap()
            futures = []
            for thread in range(threads):
                job = {
                    "betmode": betmode,
                    "wincap": wincap,
                    "total_threads": threads,
                    "total_repeats": num_repeats,
                    "num_sims": sims_per_thread,
                    "thread_index": thread,
                    "repeat_count": repeat,
                    "compress": compress,
                    "write_event_list": write_event_list,
                }
                if constant_criteria is None:
                    job["sim_to_criteria"] = criteria_assignment
                else:
                    job["criteria_value"] = constant_criteria
                    job["criteria_length"] = len(criteria_assignment)
                if seeds_sequential:
                    job["seeds_length"] = len(simulation_seeds)
                else:
                    job["simulation_seeds"] = simulation_seeds
                futures.append(pool.submit(_simulate_slice, job))
                print("Started thread", thread)
            print("All threads are online.")
            for future in futures:
                all_betmode_configs.extend(future.result())
            print("Finished joining threads.")
            gamestate.combine(all_betmode_configs, betmode)
            gamestate.get_betmode(betmode).lock_force_keys()
        elif threads == 1:
            gamestate.run_sims(
                betmode_copy_list=all_betmode_configs,
                betmode=betmode,
                sim_to_criteria=criteria_assignment,
                total_threads=threads,
                total_repeats=num_repeats,
                num_sims=sims_per_thread,
                thread_index=0,
                repeat_count=repeat,
                compress=compress,
                write_event_list=write_event_list,
                simulation_seeds=simulation_seeds,
            )
        else:
            for thread in range(threads):
                process = Process(
                    target=gamestate.run_sims,
                    args=(
                        all_betmode_configs,
                        betmode,
                        criteria_assignment,
                        threads,
                        num_repeats,
                        sims_per_thread,
                        thread,
                        repeat,
                        compress,
                        write_event_list,
                        simulation_seeds,
                    ),
                )
                print("Started thread", thread)
                process.start()
                processes += [process]
            print("All threads are online.")
            for process in processes:
                process.join()
            print("Finished joining threads.")
            gamestate.combine(all_betmode_configs, betmode)
            gamestate.get_betmode(betmode).lock_force_keys()
            manager.shutdown()
