"""Main file for generating results for Ride The Bus."""

import os

from gamestate import GameState
from game_config import GameConfig
from game_calculations import all_mode_combinations, mode_name
from reweight_luts import reweight_all
from src.state.run_sims import create_books
from src.write_data.write_configs import generate_configs
from utils.rgs_verification import execute_all_tests

if __name__ == "__main__":

    # This build is ~13.8M simulations across the 64 bet modes, so it runs in
    # parallel. src/state/run_sims.py spawns real multiprocessing.Process
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
    # all three per-mode counts (80k / 200k / 800k) exactly and leaves a couple
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
    # stated threshold and cheap to clear. It costs 640k extra simulations,
    # about 4.6% on top of the previous 13.76M total.
    MIN_SIMS_PER_MODE = 100_000
    SIMS_BY_EQUAL_COUNT = {0: int(1e5), 1: int(2e5), 2: int(8e5)}

    def _sim_count(combo):
        equal_count = sum(1 for choice in combo[1:3] if choice == "equal")
        return SIMS_BY_EQUAL_COUNT[equal_count]

    num_sim_args = {mode_name(*combo): _sim_count(combo) for combo in all_mode_combinations()}

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
    realized = [s["realized_rtp"] for s in stats]
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
