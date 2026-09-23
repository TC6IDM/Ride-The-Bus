"""Main file for generating results for Ride The Bus."""

import json
import os
import shutil
import subprocess
import sys
import time

from gamestate import DEAL_FILE, GameState, build_deal_cache, load_deal_cache
from direct_books import write_all_books
from game_config import GameConfig
from game_calculations import MODE_FAMILIES, all_published_modes, family_of, mode_name, ordered_families
from reweight_luts import reweight_all
from src.state.run_sims import create_books
from src.write_data.write_configs import (
    generate_configs,
    make_be_config,
    make_fe_config,
    make_index_config,
    make_temp_math_config,
)
from utils.rgs_verification import execute_all_tests

try:
    import build_monitor
except Exception:  # pragma: no cover - the monitor is an ornament on a 40
    build_monitor = None  # minute job and must never be able to stop one


def _monitor_wanted() -> bool:
    """Should this invocation put a live view of itself in a browser?"""
    return (
        build_monitor is not None
        and not build_monitor.monitoring()
        and os.environ.get("RTB_BUILD_MONITOR") != "0"
    )


def _emit(event: str, **data) -> None:
    """Tell the monitor something only this file knows. No-op without one."""
    if build_monitor is not None:
        build_monitor.emit(event, **data)


if __name__ == "__main__":

    # A LIVE VIEW OF THIS BUILD, at http://127.0.0.1:8765.
    #
    # This run is ~44M simulations over 193 modes and prints a wall of text for
    # forty minutes. build_monitor.py runs THIS FILE again as a child process,
    # reads its output, and serves it as 193 boxes with four progress bars and
    # an ETA; every line still reaches the terminal unchanged. The re-exec is
    # what makes the simulation workers visible - they are separate processes
    # (run_sims.py) and their "Thread 3 finished with 0.961 RTP" lines only
    # exist on the real stdout, not in any wrapper this process could install.
    #
    # RTB_BUILD_MONITOR=0 skips it entirely, as does a missing or broken
    # build_monitor.py: the build below is unchanged either way.
    if _monitor_wanted():
        raise SystemExit(
            build_monitor.run_with_monitor([sys.executable, os.path.abspath(__file__)] + sys.argv[1:])
        )

    # This build is ~44M simulations across the 193 bet modes - 64 choice
    # combinations in each of three families, plus Three of a Kind - so it
    # runs in parallel.
    # src/state/run_sims.py spawns real multiprocessing.Process
    # workers (not GIL-bound threads), each taking a disjoint slice of the
    # global simulation index.
    #
    # Results are UNCHANGED by this: gamestate.run_spin seeds the RNG with
    # reset_seed(sim) -> random.seed(sim + 1), so every simulation's outcome is
    # a function of its global index alone, never of which worker ran it. More
    # workers only makes the same books arrive sooner.
    #
    # Keep this a power of two. sims_per_thread is computed with int()
    # truncation, so a count that doesn't divide evenly silently drops
    # simulations - 12 workers, for instance, would lose 512 of them. 8 divides
    # all three per-mode counts (100k / 200k / 800k) exactly and leaves a couple
    # of cores free on a 12-CPU machine. Set to 1 if you need to profile
    # (run_sims.py rejects profiling with threads > 1).
    num_threads = 8
    batching_size = 50000
    compression = True
    profiling = False

    # One entry per bet mode (one per full 4-stage choice combination - see
    # game_config.py). Combos with more "equal" picks have a much lower true
    # win probability (e.g. ~1-in-3600 for two equals), so a flat sim count
    # per mode either wastes time on the common combos or - worse - isn't
    # enough to land more than a handful of wins for the rare ones, making
    # their reported RTP unreliably noisy rather than actually representative.
    # Scale sims up by how many "equal" choices the combo requires.
    #
    # The floor is 100k, not the 80k this used to run. Stake's math approval
    # asks for 100,000 to 1,000,000 simulations per bet mode, and the 32 combos
    # with no "equal" pick sat under that at 80k - fine for accuracy, since
    # those are the common combos and their RTP was never noisy, but it is a
    # stated threshold and cheap to clear.
    #
    # The same counts apply to every family. Second Chance wins more often, so
    # its rare combos are actually LESS noisy than Classic's at the same count -
    # over-provisioning there is cheap insurance, and keeping one table means a
    # family cannot be added with a count nobody checked. Three of a Kind is
    # two equals and so gets 800k, which at a physical 1 in 35 is ~23k sweeps;
    # its single outcome makes the RTP exact regardless.
    MIN_SIMS_PER_MODE = 100_000
    SIMS_BY_EQUAL_COUNT = {0: int(1e5), 1: int(2e5), 2: int(8e5)}

    def _sim_count(combo):
        equal_count = sum(1 for choice in combo[1:3] if choice == "equal")
        return SIMS_BY_EQUAL_COUNT[equal_count]

    # EVERY published mode, not every choice combination. all_mode_combinations()
    # yields the 64 combinations; each is published once per family, so keying
    # off it simulated only the 64 base modes and left generate_configs to fail
    # on the first sc_ mode with no lookup table to copy.
    num_sim_args = {
        mode_name(*combo, family=family): _sim_count(combo)
        for family, combo in all_published_modes()
    }

    # A ONE-MODE BUILD, for testing a change to the simulator without paying 34
    # minutes for it. RTB_ONLY_MODES=red_higher_inside_heart[,another] simulates
    # only those modes and stops after create_books - there is nothing to
    # publish, reweight or verify from a partial set.
    #
    # It writes into library_test/ unless MATH_LIBRARY_DIR says otherwise,
    # because a partial build inside library/ is indistinguishable from a real
    # one and the real one is 34 minutes and ~3.3 GB. The books it produces are
    # comparable byte for byte with the real build's: a mode's simulations
    # depend only on their own global indices.
    only_modes = [name.strip() for name in os.environ.get("RTB_ONLY_MODES", "").split(",") if name.strip()]
    if only_modes:
        os.environ.setdefault("MATH_LIBRARY_DIR", "library_test")
        unknown = [name for name in only_modes if name not in num_sim_args]
        if unknown:
            raise SystemExit(f"RTB_ONLY_MODES: no such published mode(s): {', '.join(unknown)}")
        num_sim_args = {name: num_sim_args[name] for name in only_modes}
        print(f"\nRTB_ONLY_MODES: {len(only_modes)} mode(s) into {os.environ['MATH_LIBRARY_DIR']}/\n")

    # How many processes write the books. Every logical CPU, not num_threads:
    # num_threads is how create_books SPLITS a mode and has to divide every sim
    # count, but direct_books hands out whole modes, so nothing constrains it -
    # and on this 6-core, 12-thread machine the SMT threads are worth having:
    # 12 workers wrote all 193 modes in 65.5s against 83.4s with 8 and 94.1s
    # with 6. RTB_BOOK_WORKERS overrides it; the SDK path keeps num_threads.
    use_direct = os.environ.get("RTB_DIRECT_BOOKS") != "0" and not profiling
    book_workers = int(os.environ.get("RTB_BOOK_WORKERS") or os.cpu_count() or num_threads)

    # Assert the floor rather than trust the table above. Two ways this could
    # silently regress: someone edits SIMS_BY_EQUAL_COUNT, or num_threads is
    # changed to a value that does not divide a count exactly - run_sims.py
    # computes sims_per_thread with int() truncation, so an uneven split drops
    # simulations and a mode could land under the threshold without anything
    # failing. Checking the effective post-truncation total catches both.
    for _mode, _count in num_sim_args.items():
        _effective = (_count // num_threads) * num_threads
        assert _effective >= MIN_SIMS_PER_MODE, (
            f"{_mode}: {_effective} simulations after splitting across "
            f"{num_threads} workers, below the {MIN_SIMS_PER_MODE} approval floor"
        )

    print(f"Simulating {len(num_sim_args)} bet modes, "
          f"{sum(num_sim_args.values()):,} simulations total:")
    # family_of, not a hand-written prefix tuple: the last version of this
    # print listed ("sc_", "hs_") and would have counted a fourth family's
    # modes as Classic's.
    for _family in ordered_families():
        _mine = {m: c for m, c in num_sim_args.items() if family_of(m) == _family}
        print(f"  {_family:5} {len(_mine):3} modes, {sum(_mine.values()):>11,} simulations")

    # The monitor's mode table. Sent rather than parsed out of the prints
    # above: this is the one place that knows a mode's family, cost and
    # simulation count before the build starts, which is what lets the page
    # draw all 193 boxes at rest and weight its progress bar by simulations
    # instead of by mode count.
    _emit(
        "plan",
        threads=book_workers if use_direct else num_threads,
        modes=[
            {
                "name": mode,
                "family": family_of(mode),
                "sims": count,
                "cost": MODE_FAMILIES[family_of(mode)]["cost"],
            }
            for mode, count in num_sim_args.items()
        ],
        families=[{"key": key, "label": key} for key in ordered_families()],
    )

    run_conditions = {"run_sims": True}

    config = GameConfig()
    gamestate = GameState(config)

    # DEAL ONCE, SCORE 192 TIMES. Every four-guess mode reseeds on the
    # simulation index and shuffles the same 52-card deck, so simulation N
    # deals identical cards in all 192 of them - and reseeding plus shuffling
    # was a fifth of every simulation. The first four cards of every shuffle
    # the build needs are dealt here, once, and each mode reads its cards from
    # the result (gamestate.DealCache). A cache from an earlier build is reused
    # only if load_deal_cache trusts it: same deck, same interpreter, its own
    # checksum, and 64 simulations re-dealt from scratch to match. Books are
    # byte-identical either way; without a cache each mode deals for itself.
    deal_path = os.path.join(gamestate.output_files.library_path, DEAL_FILE)
    deals_needed = max(
        (count for mode, count in num_sim_args.items() if family_of(mode) != "tr"), default=0
    )
    if deals_needed:
        if load_deal_cache(deal_path, need=deals_needed) is not None:
            print(f"\nDeal cache: reusing {deals_needed:,} deals from {DEAL_FILE}")
        else:
            _deals_started = time.time()
            print(f"\nDealing {deals_needed:,} shuffles once for the four-guess modes...")
            build_deal_cache(deal_path, deals_needed, workers=num_threads)
            print(f"Deal cache written in {time.time() - _deals_started:.1f}s")

    # SCORE EVERY MODE STRAIGHT OFF THE DEAL (direct_books.py) instead of
    # simulating each one through the SDK. All 192 four-guess modes deal the
    # same cards for a given simulation, and what a round pays is a pure
    # function of those cards and the mode's rules (GameState.score_round, the
    # one function both paths call) - so each mode is scored against the shared
    # deal and its books, tables and sidecars are written in one pass, with no
    # temp files and no decompress-and-recompress merge. What cannot be shared
    # is the output: every mode's book carries its own choices and payouts, so
    # all 44M lines are still written. The files are byte-identical to
    # create_books' - checked in full, all 193 modes and every file, against the
    # 2026-09-22 build - and the time went from 33 minutes to about 1.5.
    #
    # RTB_DIRECT_BOOKS=0 goes back to create_books, which is also what runs
    # when profiling (a single-threaded SDK build is what snakeviz can show).
    if run_conditions["run_sims"] and use_direct:
        _emit("stage", id="simulate", at="start")
        print(f"\nScoring {len(num_sim_args)} modes against the deal across {book_workers} workers...")
        _total_modes = len(num_sim_args)

        def _mode_started(job, slot):
            _emit("mode_start", mode=job["mode"], slot=slot, sims=job["sims"])

        def _mode_done(done, total, result):
            print(
                f"  [{done:>3}/{total}] {result['mode']:<34} {result['sims']:>7,} rounds   "
                f"raw RTP {result['rtp']:.3f}   {result['seconds']:5.1f}s",
                flush=True,
            )
            # The line the monitor has always read to mark a mode's books done.
            print(f"Wrote verification file: {result['verification']}", flush=True)
            _emit(
                "mode_done",
                mode=result["mode"],
                slot=result["slot"],
                sims=result["sims"],
                rtp=result["rtp"],
                seconds=result["seconds"],
            )

        _books_seconds = write_all_books(
            gamestate,
            num_sim_args,
            num_threads,
            batching_size,
            on_mode=_mode_done,
            on_start=_mode_started,
            workers=book_workers,
        )
        # create_books removes its temp folder; this never fills it, but the
        # library should look the same afterwards either way.
        shutil.rmtree(gamestate.output_files.temp_path, ignore_errors=True)
        _minutes, _secs = divmod(_books_seconds, 60)
        print(f"\nFinished creating books in {int(_minutes)}m {_secs:.1f}s.\n")
        _emit("stage", id="simulate", at="end")
    elif run_conditions["run_sims"]:
        _emit("stage", id="simulate", at="start")
        create_books(
            gamestate,
            config,
            num_sim_args,
            batching_size,
            num_threads,
            compression,
            profiling,
        )
        _emit("stage", id="simulate", at="end")

    if only_modes:
        # Everything below this line works on the whole published set: the
        # configs list every mode, the reweighter reads every segmented table,
        # the verifier asserts every book exists. A subset build stops here.
        print(f"\nSimulated {', '.join(only_modes)} into {os.environ['MATH_LIBRARY_DIR']}/.")
        print("Stopping before publish: a partial set has nothing to publish, reweight or verify.")
        raise SystemExit(0)

    _emit("stage", id="publish", at="start", note="reweighting the lookup tables")

    # Record the family rules this build was made with, beside the stats. The
    # client's mathBuild.testlib.ts reads this to tell a build that predates
    # a RULES change (stale - the parity tests skip and say so) from a build
    # whose numbers disagree with the client's arithmetic (drift - they fail,
    # as they must). Without it the two are indistinguishable: a retention
    # change keeps the mode list identical, so the 40 minutes between editing
    # MODE_FAMILIES and finishing this build used to be a red parity gate.
    here = os.path.dirname(os.path.abspath(__file__))
    rules_path = os.path.join(here, "library", "build_rules.json")
    with open(rules_path, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "rtp": config.rtp,
                "families": {
                    key: {
                        "cost": cfg["cost"],
                        "retention": list(cfg["retention"]),
                        "forgive": cfg["forgive"],
                        "forgive_from": cfg["forgive_from"],
                        "target_rtp": cfg.get("target_rtp"),
                    }
                    for key, cfg in MODE_FAMILIES.items()
                },
            },
            fh,
            indent=2,
        )
    print(f"\nWrote {rules_path}")

    # Reweight every mode's published _0 lookup table onto the exact common
    # RTP (config.rtp) - the step that makes the Cross-Mode RTP Consistency
    # check pass. create_books only writes a raw weight-1 _0 file when one is
    # absent (write_data.py), so this is what makes every _0 this build's own,
    # properly weighted table - and why the configuration files, which hash
    # those tables, are written after it rather than before.
    print(f"\nReweighting all modes to {config.rtp:.4f} RTP across {num_threads} workers...")
    print("Each mode's published _0 table is rewritten from its segmented table:")
    here = os.path.dirname(os.path.abspath(__file__))
    _reweight_started = time.time()
    _reweight_total = len(num_sim_args)

    def _reweight_progress(index, result):
        """One line per table, and the monitor's per-mode event."""
        rtp = result["realized_rtp"] / result["cost"]
        print(
            f"  [{index:>3}/{_reweight_total}] {result['mode']:<34} "
            f"RTP {rtp * 100:8.4f}%   1 in {result['hit_rate_1_in']:6.2f}   "
            f"loss weight {result['loss_weight']:>12,}   "
            f"{result['rows']:>7,} rows   {result['seconds']:5.1f}s",
            flush=True,
        )
        _emit(
            "reweight",
            mode=result["mode"],
            index=index,
            rtp=rtp,
            hitRate=result["hit_rate_1_in"],
        )

    stats = reweight_all(here, config.rtp, on_mode=_reweight_progress, workers=num_threads)
    print(f"Reweighted {len(stats)} tables in {time.time() - _reweight_started:.1f}s")
    realized = [s["realized_rtp"] / s["cost"] for s in stats]
    print(
        f"Reweighted {len(stats)} modes to {config.rtp:.4f}: "
        f"realized RTP {min(realized)*100:.4f}%-{max(realized)*100:.4f}% "
        f"(spread {(max(realized)-min(realized))*100:.4f}%)"
    )
    # The configuration files come AFTER the reweight, because config.json
    # records each published table's SHA-256, standard deviation and length -
    # and the reweight is what writes those tables. In the other order the
    # hashes were of the PREVIOUS build's tables: identical whenever the rules
    # had not changed, and wrong for exactly one build after any change (the
    # first 0.15 build filed High Stakes' 0.16 tables). config.json is not one
    # of the files uploaded to Stake, which is how that went unnoticed.
    #
    # generate_configs() is four calls in a trench coat and prints nothing, so
    # a build spent minutes here looking hung. Calling the four directly is the
    # same work in the same order (write_configs.py:generate_configs), with a
    # line each; the wrapper stays as the fallback so a reshuffle in the SDK
    # cannot break the build over console output. make_be_config's per-mode
    # work - hashing and a full pass over every table, 31.8s serially - runs
    # across the workers, and its output is byte-identical either way.
    print("\nWriting configuration files...")
    _configs_started = time.time()
    try:
        for _label, _step in (
            ("frontend config", lambda: make_fe_config(gamestate=gamestate, json_padding=True, assign_properties=True)),
            ("backend config", lambda: make_be_config(gamestate, workers=num_threads)),
            ("math config", lambda: make_temp_math_config(gamestate)),
            ("index manifest", lambda: make_index_config(gamestate)),
        ):
            _step_started = time.time()
            print(f"  {_label}...", flush=True)
            _step()
            print(f"  {_label} written in {time.time() - _step_started:.1f}s", flush=True)
    except (ImportError, AttributeError, TypeError) as exc:
        print(f"  ! writing them step by step failed ({exc}); falling back to generate_configs()")
        generate_configs(gamestate)
    print(f"Configuration files written in {time.time() - _configs_started:.1f}s")

    _emit(
        "stage",
        id="publish",
        at="end",
        note=f"{len(stats)} modes on {config.rtp:.4f} RTP",
    )

    # Verify the published files and write library/stats_summary.json - the RTP /
    # variance / ETL figures the approval dashboard reads. This used to be a
    # separate `python utils/rgs_verification.py -g ride_the_bus` step that was
    # very easy to forget, which left stats_summary.json describing the PREVIOUS
    # build. Runs last, and specifically after reweight_all, because it reads the
    # published _0 lookup tables that the reweighter rewrites.
    #
    # rgs_verification resolves its output as the RELATIVE path
    # "games/<id>/library/stats_summary.json", so it only writes anything when
    # the working directory is the math-sdk root. Pin that here so the stats are
    # produced no matter where run.py was invoked from.
    print("\nVerifying published files and writing stats_summary.json...")
    _emit("stage", id="verify", at="start", note="books against tables, then the statistics")
    sdk_root = os.path.abspath(os.path.join(here, os.pardir, os.pardir))
    previous_cwd = os.getcwd()
    os.chdir(sdk_root)
    _verify_started = time.time()
    try:
        # Each mode's books, table and sidecar are its own files and the work is
        # a SHA-256 over the whole compressed book plus a pass over an 800k-row
        # table - CPU, with nothing shared. Same assertions, same output, same
        # stats_summary.json; only the wall clock changes.
        execute_all_tests(config, workers=num_threads)
    finally:
        os.chdir(previous_cwd)
    print(f"Verified in {time.time() - _verify_started:.1f}s")
    _emit("stage", id="verify", at="end", note="stats_summary.json written")

    # Regenerate the replay event ID table that approval asks for - normal win,
    # big win, win cap and loss, per bet mode. Those IDs are simulation numbers
    # drawn from the lookup tables this build just wrote, so they are invalidated
    # by every rebuild. Doing it here rather than leaving it as a step to
    # remember is the same reasoning as folding rgs_verification in above: a
    # stale table is worse than no table, because it looks correct.
    #
    # Best-effort. The math build is the product; a missing Node or a failure in
    # the generator must not fail a run that has already produced valid files.
    #
    # mode-ceilings.js is here for the same reason and reads the same build. It
    # writes the per-mode win ceilings the client SHOWS A PLAYER - the most the
    # four guesses they picked can actually pay - and those are sampled maxima
    # from this simulation set, so a rebuild moves them. A stale ceilings table
    # would leave the game quoting a figure the RGS can no longer reach, which
    # is the exact mistake the table was added to fix.
    repo_root = os.path.abspath(os.path.join(sdk_root, os.pardir))
    generated = [
        ("scripts/replay-events.js", "REPLAY_EVENTS.md"),
        ("scripts/mode-ceilings.js", "src/game/math/modeCeilings.ts"),
    ]
    _emit("stage", id="scan", at="start", note="replay event IDs and win ceilings")
    for script, product in generated:
        generator = os.path.join(repo_root, *script.split("/"))
        if not os.path.isfile(generator):
            print(f"\n! generator not found at {generator}")
            print(f"! {product} will be stale - regenerate it before submitting")
            _emit("generator", at="end", product=product, result="generator missing")
            continue
        print(f"\nRegenerating {product}...")
        _emit("generator", at="start", product=product)
        try:
            subprocess.run(
                ["node", generator],
                cwd=repo_root,
                check=True,
                shell=(os.name == "nt"),
                # One knob for the whole build: replay-events.js scans the
                # books on worker threads, and num_threads is what this run
                # already decided the machine can take.
                env={**os.environ, "REPLAY_SCAN_WORKERS": str(num_threads)},
            )
            _emit("generator", at="end", product=product, result="written")
        except (OSError, subprocess.CalledProcessError) as exc:
            print(f"  ! could not regenerate {product}: {exc}")
            print(f"  ! run `node {script}` by hand before submitting")
            _emit("generator", at="end", product=product, result=f"FAILED: {exc}")
    _emit("stage", id="scan", at="end")
    _emit("done")
