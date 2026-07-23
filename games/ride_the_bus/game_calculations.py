"""Card-odds helper functions for Ride The Bus."""

import math

from src.executables.executables import Executables

RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
SUITS = ["♥", "♦", "♣", "♠"]
RED_SUITS = ("♥", "♦")
BLACK_SUITS = ("♠", "♣")

# Stake Engine requires each bet to be a single, independent, stateless
# outcome - no continuation, no early cashout (see Key Restrictions in
# Stake's approval docs). So the player picks all 4 guesses up front, and
# the whole round is ONE bet mode encoding that exact combination - the book
# resolves the full outcome deterministically against those fixed choices.
COLOR_CHOICES = ["red", "black"]
HIGHER_LOWER_CHOICES = ["higher", "lower", "equal"]
INSIDE_OUTSIDE_CHOICES = ["inside", "outside", "equal"]
SUIT_CHOICES = ["heart", "diamond", "club", "spade"]

SUIT_NAME_TO_SYMBOL = {"heart": "♥", "diamond": "♦", "club": "♣", "spade": "♠"}


def all_mode_combinations():
    """
    Every (color, higher_lower, inside_outside, suit) choice combination that
    can actually be won. Excludes higher_lower="equal" + inside_outside="inside":
    if stage 2 ties the reference card's rank exactly, the two reference
    values for stage 3 are identical, so there's no rank strictly "between"
    them - "inside" is mathematically impossible, not just rare. A bet mode
    with a 100% loss rate has zero variance, which Stake's RGS rejects
    outright ("failed to obtain distribution statistics from lookup table").
    """
    for color in COLOR_CHOICES:
        for higher_lower in HIGHER_LOWER_CHOICES:
            for inside_outside in INSIDE_OUTSIDE_CHOICES:
                if higher_lower == "equal" and inside_outside == "inside":
                    continue
                for suit in SUIT_CHOICES:
                    yield (color, higher_lower, inside_outside, suit)


def mode_name(color: str, higher_lower: str, inside_outside: str, suit: str) -> str:
    """Bet mode name encoding one full pre-selected 4-stage choice combination."""
    return f"{color}_{higher_lower}_{inside_outside}_{suit}"


def parse_mode_name(name: str) -> tuple:
    """Inverse of mode_name(): '<color>_<higher_lower>_<inside_outside>_<suit>' -> tuple."""
    color, higher_lower, inside_outside, suit = name.split("_")
    return color, higher_lower, inside_outside, suit


def rank_value(rank: str) -> int:
    """Ace-low rank value, matching the frontend's rankValue map."""
    return RANKS.index(rank) + 1


def build_deck() -> list:
    """Return an unshuffled standard 52-card deck as (rank, suit) tuples."""
    return [(rank, suit) for suit in SUITS for rank in RANKS]


class GameCalculations(Executables):
    """
    Partial-credit-odds table calculations, shared with the frontend's local
    formulas.

    A bust no longer zeroes the round - it keeps STAGE_RETENTION[stage] of
    whatever was already banked (see gamestate.run_spin). Paying literal
    per-stage FAIR odds on top of that turned out to massively overpay (a
    correct stage-1 guess alone contributes ~1x in expectation even when
    every later stage is guaranteed to fail, and that compounds - measured
    RTP hit 230%-360% across modes when tried). It also can't be uniform
    across modes, since the overpay scales with each mode's own stage-2/3
    probabilities, which vary a lot (equal/inside picks are rare).

    Instead, partial_multiplier is solved so that, for ANY probability p,
    the expected multiplicative change to the running multiplier is a fixed
    constant `decay` - a martingale property. This pulls every mode's RAW
    RTP toward roughly decay**4 == config.target_rtp regardless of its own
    per-stage odds, so the modes start out clustered instead of spread from
    12% to 100%+ as a literal-fair-odds design does. It is only approximate
    (a bust applies decay**remaining analytically for the unplayed stages,
    and an impossible guess - p<=0, chiefly "inside" on rank-adjacent
    references - pays 0 and so escapes the martingale, dragging those modes
    low). The EXACT common RTP and Stake's Cross-Mode RTP Consistency check
    (all 64 modes within 0.5%) are delivered afterwards by reweight_luts.py,
    which reweights each mode's lookup table onto config.rtp precisely; the
    martingale's job is just to get close enough that that reweight stays a
    gentle nudge rather than a distortion.
    """

    # Fraction of the banked multiplier kept on a miss, per stage (color,
    # higher/lower, inside/outside, suit). Stage 0 keeps 0 - failing the
    # very first guess is still a full loss, matching the classic "you can
    # bust immediately" feel; stage-1 probability is always exactly 0.5
    # (first card, full untouched deck) so this branch is already identical
    # across every mode, costing nothing on cross-mode consistency.
    STAGE_RETENTION = (0.0, 0.3, 0.3, 0.3)

    def target_rtp_decay(self) -> float:
        """Per-stage decay constant such that decay**4 == config.target_rtp."""
        return self.config.target_rtp**0.25

    def partial_multiplier(self, probability: float, stage_index: int) -> float:
        """
        Win-multiplier for stage `stage_index` at true win-probability
        `probability`. Derived from requiring
            p*m + (1-p)*retention == decay
        for every possible p, i.e. m = (decay - (1-p)*retention) / p.
        0 if the guess is impossible this round (probability <= 0) - the
        "correct" branch can never fire then, so this multiplier is never
        actually applied; the round just busts at this stage and banks the
        retention fraction like any other miss (gamestate.run_spin).
        """
        if probability <= 0:
            return 0.0
        retention = self.STAGE_RETENTION[stage_index]
        decay = self.target_rtp_decay()
        return (decay - (1 - probability) * retention) / probability

    def quantize_multiplier(self, raw: float) -> float:
        """
        Floor a final multiplier DOWN to the nearest 0.1x - Stake's RGS only
        accepts non-zero payout multipliers in 0.1x increments
        (payoutMultiplier, stored as integer cents x100, must be a multiple
        of 10). Must floor (never round up/nearest): e.g. a fair 50/50
        single-stage payout is 1.96x - rounding to nearest would give 2.0x,
        wiping out the house edge entirely. Floor keeps the edge intact.
        """
        if raw <= 0:
            return 0.0
        quantized = math.floor(raw * 10) / 10
        return quantized if quantized > 0 else 0.1

    def color_payouts(self, remaining: list) -> dict:
        total = len(remaining)
        red = sum(1 for _, suit in remaining if suit in RED_SUITS)
        black = total - red
        return {
            "red": self.partial_multiplier(red / total, 0),
            "black": self.partial_multiplier(black / total, 0),
        }

    def higher_lower_payouts(self, remaining: list, ref_value: int) -> dict:
        total = len(remaining)
        higher = sum(1 for rank, _ in remaining if rank_value(rank) > ref_value)
        lower = sum(1 for rank, _ in remaining if rank_value(rank) < ref_value)
        equal = total - higher - lower
        return {
            "higher": self.partial_multiplier(higher / total, 1),
            "lower": self.partial_multiplier(lower / total, 1),
            "equal": self.partial_multiplier(equal / total, 1),
        }

    def inside_outside_payouts(self, remaining: list, val_a: int, val_b: int) -> dict:
        total = len(remaining)
        min_val, max_val = min(val_a, val_b), max(val_a, val_b)
        inside = sum(1 for rank, _ in remaining if min_val < rank_value(rank) < max_val)
        outside = sum(
            1 for rank, _ in remaining if rank_value(rank) < min_val or rank_value(rank) > max_val
        )
        equal = total - inside - outside
        return {
            "inside": self.partial_multiplier(inside / total, 2),
            "outside": self.partial_multiplier(outside / total, 2),
            "equal": self.partial_multiplier(equal / total, 2),
        }

    def suit_payouts(self, remaining: list) -> dict:
        total = len(remaining)
        counts = {suit: 0 for suit in SUITS}
        for _, suit in remaining:
            counts[suit] += 1
        return {
            "heart": self.partial_multiplier(counts["♥"] / total, 3),
            "diamond": self.partial_multiplier(counts["♦"] / total, 3),
            "club": self.partial_multiplier(counts["♣"] / total, 3),
            "spade": self.partial_multiplier(counts["♠"] / total, 3),
        }
