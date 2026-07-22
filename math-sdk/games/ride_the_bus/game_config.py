"""Game configuration for Ride The Bus (4-stage card guessing game)."""

import os
import sys

# Some entry points (e.g. utils/rgs_verification.py's load_game_config)
# import this file as games.ride_the_bus.game_config without first adding
# this directory to sys.path, which run.py normally does implicitly -
# ensure the sibling game_calculations module is always importable.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.config.config import Config
from src.config.distributions import Distribution
from src.config.config import BetMode

from game_calculations import all_mode_combinations, mode_name


class GameConfig(Config):
    """Ride The Bus configuration."""

    def __init__(self):
        super().__init__()
        self.game_id = "ride_the_bus"
        self.provider_number = 0
        self.working_name = "Ride The Bus"
        self.wincap = 500
        self.win_type = "other"
        self.rtp = 0.98
        self.construct_paths()

        # Not a reel game - no board/reels involved.
        self.num_reels = 0
        self.num_rows = [0] * self.num_reels
        self.paytable = {}
        self.include_padding = False
        self.special_symbols = {"wild": [], "scatter": [], "multiplier": []}

        self.freespin_triggers = {self.basegame_type: {}, self.freegame_type: {}}
        self.anticipation_triggers = {self.basegame_type: 0, self.freegame_type: 0}

        self.house_edge = 0.02

        # Stake Engine requires every bet to be a single, independent,
        # stateless outcome (no continuation, no early cashout - see Key
        # Restrictions in Stake's approval docs). The player picks all 4
        # guesses before pressing Play, so one bet mode = one full 4-stage
        # choice combination (2 * 3 * 3 * 4 = 72 modes), each resolved fully
        # in a single atomic play() call.
        self.bet_modes = [
            BetMode(
                name=mode_name(*combo),
                cost=1.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=False,
                distributions=[
                    Distribution(
                        criteria="basegame",
                        quota=1.0,
                        conditions={
                            "reel_weights": {},
                            "force_wincap": False,
                            "force_freegame": False,
                        },
                    ),
                ],
            )
            for combo in all_mode_combinations()
        ]
