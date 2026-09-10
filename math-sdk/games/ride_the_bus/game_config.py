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

from game_calculations import MODE_FAMILIES, all_published_modes, mode_name


class GameConfig(Config):
    """Ride The Bus configuration."""

    def __init__(self):
        super().__init__()
        self.game_id = "ride_the_bus"
        self.provider_number = 0
        self.working_name = "Ride The Bus"
        # Fallback declared max win. The REAL cap is per family - see
        # MODE_FAMILIES["<family>"]["wincap"], which each BetMode below takes as
        # its max_win, and which run_sims.py loads into config.wincap before
        # simulating that mode.
        #
        # Per family because the families reach different ceilings. Classic tops
        # out at 1354.2x and Second Chance at 585.2x, but High Stakes reaches
        # 1910.2x - a miss there keeps less, so every correct guess is priced
        # higher. A single 1400 cap silently CLIPPED High Stakes' biggest wins,
        # which the frontend's book-parity test caught as "client 3820.5 vs book
        # 1400": the client computed the real figure while the book carried the
        # clipped one. (3820.5 is that same ceiling back when High Stakes cost
        # 2x, which doubled every payout; see MODE_FAMILIES on why the cost had
        # to come down to 1.0x. The figures here are the CURRENT, 1.0x ones.)
        #
        # Each family's cap sits just ABOVE what it can reach, so it never
        # binds. That matters twice over: payouts go through
        # min(running_bet_win, wincap) in src/events/events.py, and a cap ON the
        # true ceiling would also trip the wincap-triggered event path for the
        # max-win round.
        #
        # The ceilings are EXHAUSTIVE, not sampled - enumerating all 6,497,400
        # ordered 4-card draws against partial_multiplier() reaches exactly
        # those figures. NB: they follow from target_rtp and each family's
        # retention. If either changes, re-derive before trusting them.
        self.wincap = 1400
        self.win_type = "other"
        # Common RTP every bet mode is reweighted to land on exactly (see
        # reweight_luts.py). This is the single published/declared RTP for the
        # game. Because every mode is pinned to this same value, the Cross-Mode
        # RTP Consistency check (all modes within +/-0.5%) passes with a spread
        # of ~0%.
        #
        # 0.96 sits inside Stake's 90%-96.70% band while leaving ~0.7 points of
        # headroom below the ceiling - worth keeping, because the reweighter
        # rounds its loss weight to an integer, and a target sitting exactly on
        # 96.70% could round a mode just over the limit and fail the check.
        #
        # The maths allows far more than the band does: the reweighter's real
        # limit is each mode's win-conditional mean payout (where the loss weight
        # would fall below 1 and it raises rather than emit a bad table), and the
        # lowest of those across the 192 modes is 1.457x, i.e. ~146% RTP (High
        # Stakes, whose thinner retention makes its wins rarer but larger). At 0.96
        # the smallest loss weight is still ~554,400, so there is no risk of that
        # guard tripping.
        #
        # Mirrored in web-sdk/apps/Ride-The-Bus/src/game/config.ts - update both.
        self.rtp = 0.96
        self.construct_paths()

        # Not a reel game - no board/reels involved.
        self.num_reels = 0
        self.num_rows = [0] * self.num_reels
        self.paytable = {}
        self.include_padding = False
        self.special_symbols = {"wild": [], "scatter": [], "multiplier": []}

        self.freespin_triggers = {self.basegame_type: {}, self.freegame_type: {}}
        self.anticipation_triggers = {self.basegame_type: 0, self.freegame_type: 0}

        # Target for game_calculations.partial_multiplier's martingale
        # formula: decay = target_rtp ** 0.25. This clusters every mode's raw
        # RTP near target_rtp (see that function's docstring) so the modes
        # start close together instead of spread 12%-100%+. It is only
        # approximate - "inside" modes in particular run low, because a
        # rank-adjacent reference pair makes the inside guess impossible and
        # that stage pays 0. The exact common RTP is set afterwards by
        # reweight_luts.py, which reweights each mode's lookup table onto
        # self.rtp regardless of whether its raw RTP started above or below.
        # Keeping this a hair below 1.0 keeps every mode's raw RTP modest so
        # the reweight is a small adjustment rather than a large distortion.
        self.target_rtp = 0.99

        # Stake Engine requires every bet to be a single, independent,
        # stateless outcome (no continuation, no early cashout - see Key
        # Restrictions in Stake's approval docs). The player picks all 4
        # guesses before pressing Play, so one bet mode = one full 4-stage
        # choice combination (2 * 3 * 3 * 4 = 72 modes), each resolved fully
        # in a single atomic play() call.
        # Three families x 64 combinations = 192 published modes. The base
        # family keeps its unprefixed names, so every replay event ID already
        # recorded against it stays valid.
        self.bet_modes = [
            BetMode(
                name=mode_name(*combo, family=family),
                cost=MODE_FAMILIES[family]["cost"],
                rtp=self.rtp,
                max_win=MODE_FAMILIES[family]["wincap"],
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
            for family, combo in all_published_modes()
        ]
