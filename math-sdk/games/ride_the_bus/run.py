"""Main file for generating results for Ride The Bus."""

import os
import subprocess

from gamestate import GameState
from game_config import GameConfig
from game_calculations import MODE_FAMILIES, all_published_modes, mode_name
from reweight_luts import reweight_all
from src.state.run_sims import create_books
from src.write_data.write_configs import generate_configs
from utils.rgs_verification import execute_all_tests

if __name__ == "__main__":

    # This build is ~43M simulations across the 192 bet modes - 64 choice
    # combinations in each of three families - so it runs in parallel.
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
    # family cannot be added with a count nobody checked.
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
    for _family in MODE_FAMILIES:
        _mine = {m: c for m, c in num_sim_args.items()
                 if (m.startswith(MODE_FAMILIES[_family]["prefix"])
                     if MODE_FAMILIES[_family]["prefix"]
                     else not m.startswith(("sc_", "hs_")))}
        print(f"  {_family:5} {len(_mine):3} modes, {sum(_mine.values()):>11,} simulations")

    run_conditions = {"run_sims": True}

    config = GameConfig()
    gamestate = GameState(config)

    if run_conditions["run_sims"]:
        create_books(
            gamestate,
            config,
            num_sim_args,
            batching_size,
            num_threads,
            compression,
            profiling,
        )
    generate_configs(gamestate)

    # Reweight every mode's published _0 lookup table onto the exact common
    # RTP (config.rtp) - the step that makes the Cross-Mode RTP Consistency
    # check pass. Must run AFTER generate_configs: the pipeline only writes a
    # raw weight-1 _0 file when one is absent (write_data.py:251), so this
    # overwrites it with the properly reweighted table.
    print(f"\nReweighting all modes to {config.rtp:.4f} RTP...")
    here = os.path.dirname(os.path.abspath(__file__))
    stats = reweight_all(here, config.rtp)
    realized = [s["realized_rtp"] / s["cost"] for s in stats]
    print(
        f"Reweighted {len(stats)} modes to {config.rtp:.4f}: "
        f"realized RTP {min(realized)*100:.4f}%-{max(realized)*100:.4f}% "
        f"(spread {(max(realized)-min(realized))*100:.4f}%)"
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
    sdk_root = os.path.abspath(os.path.join(here, os.pardir, os.pardir))
    previous_cwd = os.getcwd()
    os.chdir(sdk_root)
    try:
        execute_all_tests(config)
    finally:
        os.chdir(previous_cwd)

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
    for script, product in generated:
        generator = os.path.join(repo_root, *script.split("/"))
        if not os.path.isfile(generator):
            print(f"\n! generator not found at {generator}")
            print(f"! {product} will be stale - regenerate it before submitting")
            continue
        print(f"\nRegenerating {product}...")
        try:
            subprocess.run(
                ["node", generator],
                cwd=repo_root,
                check=True,
                shell=(os.name == "nt"),
            )
        except (OSError, subprocess.CalledProcessError) as exc:
            print(f"  ! could not regenerate {product}: {exc}")
            print(f"  ! run `node {script}` by hand before submitting")
