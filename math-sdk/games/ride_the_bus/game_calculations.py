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


# ---------------------------------------------------------------------------
# Mode families
#
# Every family plays the same four guesses against the same deck; what differs
# is what a MISS keeps, and that alone reshapes the whole payout curve. Because
# reweight_luts.py pins every mode to the same RTP afterwards, a family that
# forgives more cannot also pay more - the two are the same dial viewed from
# opposite ends.
#
#   base     the shipping game. A first-card miss loses the round outright,
#            later misses keep 30%.
#   sc       Second Chance. Card 1 still busts the round outright, but from
#            card 2 on the first miss keeps half and PLAYS ON; a second miss
#            ends it on the usual terms.
#
#            Card 1 is deliberately NOT forgiven, and the reason is mechanical
#            rather than aesthetic. Forgiving it too left barely any round
#            paying zero, which pushed the mode's win-conditional mean (1.81x)
#            BELOW its 1.92x reweight target - and reweight_luts.py can only
#            move RTP by re-weighting losses, so with almost none to work with
#            it refuses outright rather than emit a non-compliant table.
#            Keeping the first card lethal preserves the ~50% zero rate the
#            reweighter needs, and it leaves the opening card its tension.
#   hs       High Stakes. Misses keep 20% instead of 30%, so wins are worth
#            more - the ceiling is above base's, at the same roughly-one-in-two
#            chance of a round paying nothing.
#
# The retention numbers are not free choices. Stake measures CVaR and Expected
# Tail Liability as the worst value across all modes, and a failed class shrinks
# the game's bet-level template. High Stakes at 0.20 gives CVaR 648 against a
# 700 limit; at 0.15 it is 730 and over. That is why it is 0.20.
#
# EVERY FAMILY COSTS 1.0x, AND THAT IS A CONSTRAINT, NOT A DEFAULT
#
# Second Chance and High Stakes were 2.0x. Both had to come down, because
# etl40b - the expected payout from wins of at least 40x the cost - is summed as
# an ABSOLUTE figure against a fixed 0.9 limit and is NOT divided by cost (see
# utils/analysis/distribution_functions.py). A 2x mode must average 1.92x to
# return 96%, so it pays twice as much for the same shape and its etl40b doubles
# automatically:
#
#     design                       cost 1   cost 2
#     Classic     retention 0.3     0.560    1.120  over
#     High Stakes retention 0.2     0.678    1.356  over
#     Second Chance forgive 0.5     0.325    0.650
#
# Even Classic's own shape fails at 2x. Only a LOW-volatility mode survives the
# doubling, which is the opposite of what High Stakes is for - and raising
# retention to compensate would need the tail under ~47% of RTP when Classic is
# already at 58%. So the cost is what had to change.
#
# At 1.0x the three modes are a volatility ladder at one price: survive a miss,
# play it straight, or make every miss hurt for a higher ceiling. Base is still
# 1.0x and nothing is cheaper, which is what Stake requires.
# ---------------------------------------------------------------------------

BASE_RETENTION = (0.0, 0.3, 0.3, 0.3)

MODE_FAMILIES = {
    "base": {
        "prefix": "",
        "cost": 1.0,
        "retention": BASE_RETENTION,
        # None = no forgiveness; the first miss ends the round.
        "forgive": None,
        "forgive_from": 0,
        # Declared ceiling for this family, published as its maxWin and used as
        # the per-mode wincap (run_sims.py sets config.wincap from it before
        # each mode). It must sit ABOVE what the family can actually reach:
        # events.py clips payouts at min(win, wincap), so a cap on the true
        # ceiling would both clip and trip the wincap-triggered event path.
        # Classic reaches 1354.2x, so 1400 never binds.
        "wincap": 1400,
    },
    "sc": {
        "prefix": "sc_",
        "cost": 1.0,
        "retention": BASE_RETENTION,
        "forgive": 0.5,
        # Card 1 (stage 0) is never forgiven - see the note above.
        "forgive_from": 1,
        # Reaches 585.2x.
        "wincap": 700,
    },
    "hs": {
        "prefix": "hs_",
        "cost": 1.0,
        "retention": (0.0, 0.2, 0.2, 0.2),
        "forgive": None,
        "forgive_from": 0,
        # Reaches 1910.2x - still above Classic's 1354.2x, because a miss keeps
        # less here and so every correct guess is priced higher. The shared 1400
        # cap CLIPPED this family, which the frontend's book-parity test caught
        # as "client 3820.5 vs book 1400" back when it cost 2x. 2000 clears the
        # real ceiling, and is 250x under Stake's 500,000x payout limit.
        "wincap": 2000,
    },
}

# Longest prefix first, so "sc_" is tested before the empty base prefix.
_PREFIXES = sorted(
    ((cfg["prefix"], key) for key, cfg in MODE_FAMILIES.items()),
    key=lambda pair: -len(pair[0]),
)


def family_of(mode: str) -> str:
    """Family key for a published mode name."""
    for prefix, key in _PREFIXES:
        if prefix and mode.startswith(prefix):
            return key
    return "base"


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


def mode_name(
    color: str, higher_lower: str, inside_outside: str, suit: str, family: str = "base"
) -> str:
    """
    Bet mode name: one full pre-selected 4-stage choice combination, prefixed
    with its family.

    The base family carries NO prefix, deliberately. Its 64 names are already
    published and every replay event ID recorded against them stays valid.
    """
    prefix = MODE_FAMILIES[family]["prefix"]
    return f"{prefix}{color}_{higher_lower}_{inside_outside}_{suit}"


def parse_mode_name(name: str) -> tuple:
    """Inverse of mode_name(): -> (family, color, higher_lower, inside_outside, suit)."""
    family = family_of(name)
    body = name[len(MODE_FAMILIES[family]["prefix"]) :]
    color, higher_lower, inside_outside, suit = body.split("_")
    return family, color, higher_lower, inside_outside, suit


def all_published_modes():
    """Every (family, combo) pair the game publishes - 3 families x 64 = 192."""
    for family in MODE_FAMILIES:
        for combo in all_mode_combinations():
            yield family, combo


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
    (all 192 modes within 0.5%) are delivered afterwards by reweight_luts.py,
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

    def partial_multiplier(
        self, probability: float, stage_index: int, retention: float = None
    ) -> float:
        """
        Win-multiplier for stage `stage_index` at true win-probability
        `probability`. Derived from requiring
            p*m + (1-p)*retention == decay
        for every possible p, i.e. m = (decay - (1-p)*retention) / p.
        0 if the guess is impossible this round (probability <= 0) - the
        "correct" branch can never fire then, so this multiplier is never
        actually applied; the round just busts at this stage and banks the
        retention fraction like any other miss (gamestate.run_spin).

        `retention` is passed in rather than read from STAGE_RETENTION because
        it now varies two ways: by mode family, and within a Second Chance round
        by whether the forgiveness is still in hand. It is the retention this
        stage's miss would actually bank, and the martingale only holds if the
        two agree - pay a stage as though a miss kept 0.3 while the miss really
        keeps 0.5 and the mode's RTP drifts off target.
        Defaults to the base table so existing callers are unaffected.
        """
        if probability <= 0:
            return 0.0
        if retention is None:
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

    def color_payouts(self, remaining: list, retention: float = None) -> dict:
        total = len(remaining)
        red = sum(1 for _, suit in remaining if suit in RED_SUITS)
        black = total - red
        return {
            "red": self.partial_multiplier(red / total, 0, retention),
            "black": self.partial_multiplier(black / total, 0, retention),
        }

    def higher_lower_payouts(self, remaining: list, ref_value: int, retention: float = None) -> dict:
        total = len(remaining)
        higher = sum(1 for rank, _ in remaining if rank_value(rank) > ref_value)
        lower = sum(1 for rank, _ in remaining if rank_value(rank) < ref_value)
        equal = total - higher - lower
        return {
            "higher": self.partial_multiplier(higher / total, 1, retention),
            "lower": self.partial_multiplier(lower / total, 1, retention),
            "equal": self.partial_multiplier(equal / total, 1, retention),
        }

    def inside_outside_payouts(self, remaining: list, val_a: int, val_b: int, retention: float = None) -> dict:
        total = len(remaining)
        min_val, max_val = min(val_a, val_b), max(val_a, val_b)
        inside = sum(1 for rank, _ in remaining if min_val < rank_value(rank) < max_val)
        outside = sum(
            1 for rank, _ in remaining if rank_value(rank) < min_val or rank_value(rank) > max_val
        )
        equal = total - inside - outside
        return {
            "inside": self.partial_multiplier(inside / total, 2, retention),
            "outside": self.partial_multiplier(outside / total, 2, retention),
            "equal": self.partial_multiplier(equal / total, 2, retention),
        }

    def suit_payouts(self, remaining: list, retention: float = None) -> dict:
        total = len(remaining)
        counts = {suit: 0 for suit in SUITS}
        for _, suit in remaining:
            counts[suit] += 1
        return {
            "heart": self.partial_multiplier(counts["♥"] / total, 3, retention),
            "diamond": self.partial_multiplier(counts["♦"] / total, 3, retention),
            "club": self.partial_multiplier(counts["♣"] / total, 3, retention),
            "spade": self.partial_multiplier(counts["♠"] / total, 3, retention),
        }
