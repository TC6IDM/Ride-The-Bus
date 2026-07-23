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
        # The rarest combos (multiple "equal" picks) naturally compound to
        # ~3000-3400x on a win (verified empirically) - a low wincap was
        # silently capping ~85% of their value away, crushing their RTP
        # far below target regardless of house_edge. 5000 gives headroom
        # above the observed max with margin for suit-count variance.
        self.wincap = 5000
        self.win_type = "other"
        # Common RTP every bet mode is reweighted to land on exactly (see
        # reweight_luts.py). This is the single published/declared RTP for
        # the game. 0.94 sits centrally inside Stake's 90%-96.70% band, with
        # margin on both sides for the tiny integer-weight rounding in the
        # reweighter. Because every mode is pinned to this same value, the
        # Cross-Mode RTP Consistency check (all modes within +/-0.5%) passes
        # with a spread of ~0%.
        self.rtp = 0.94
        self.construct_paths()

        # Not a reel game - no board/reels involved.
        self.num_reels = 0
        self.num_rows = [0] * self.num_reels
        self.paytable = {}
        self.include_padding = False
        self.special_symbols = {"wild": [], "scatter": [], "multiplier": []}

        self.freespin_triggers = {self.basegame_type: {}, self.freegame_type: {}}
        self.anticipation_triggers = {self.basegame_type: 0, self.freegame_type: 0}

        # Target used by game_calculations.partial_multiplier's martingale
        # formula: decay = target_rtp ** 0.25, chosen so E[final win] ==
        # target_rtp for EVERY bet mode regardless of its own per-stage
        # probabilities (see that function's docstring). Kept slightly ABOVE
        # the published rtp (0.94) so every mode's raw sampled RTP lands a
        # touch high, leaving the reweighter (reweight_luts.py) headroom to
        # pull each mode DOWN onto the exact common line by adding losing
        # weight - the one direction that's always available. The dead-zone
        # push in gamestate.run_spin is what lets even "inside" modes clear
        # this, so they reweight cleanly into band like every other mode.
        self.target_rtp = 0.99

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
