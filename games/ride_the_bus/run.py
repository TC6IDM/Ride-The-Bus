"""Main file for generating results for Ride The Bus."""

from gamestate import GameState
from game_config import GameConfig
from game_calculations import all_mode_combinations, mode_name
from src.state.run_sims import create_books
from src.write_data.write_configs import generate_configs

if __name__ == "__main__":

    num_threads = 1
    batching_size = 50000
    compression = True
    profiling = False

    # One entry per bet mode (one per full 4-stage choice combination - see
    # game_config.py). The rarest combos (multiple "equal" picks) have a true
    # win probability well under 0.1%, so need a large sample to reliably
    # land at least a few wins (avoids a zero-variance crash in stats calc).
    num_sim_args = {mode_name(*combo): int(5e4) for combo in all_mode_combinations()}

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
