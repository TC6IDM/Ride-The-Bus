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

# A stage with no guess at all. The card is dealt and shown, it is always
# "correct", and it pays exactly decay - p = 1 in the martingale - so with a
# pricing target of 1.0 the running multiplier is untouched. Only the
# fixed-combo family uses it; see MODE_FAMILIES["tr"].
FREE_CHOICE = "any"

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
#   hs       High Stakes. Misses keep 16% instead of 30%, so wins are worth
#            more - the ceiling is above base's, at the same roughly-one-in-two
#            chance of a round paying nothing.
#   tr       Three of a Kind. A different game on the same table: a 12-card
#            deck (the Ace, King and Queen of each suit), THREE cards, no
#            guesses at all - card 1 is dealt, cards 2 and 3 must MATCH ITS
#            RANK - and nothing back on any miss. One mode, at cost 250x,
#            paying 4,583.3x the base bet. See THE ALL-OR-NOTHING BOUND below
#            for why it is this shape and no other.
#
# The retention numbers are not free choices. Stake measures CVaR and Expected
# Tail Liability as the worst value across all modes, and a failed class shrinks
# the game's bet-level template. The two enumerations this repo has run
# disagree about the step below 0.16: the exhaustive model said 682 at 0.16
# where the build then MEASURED 624.6 (the model runs hot on the tail), and
# put 0.15 at 722; the README's enumeration (which ran cold - 551 at 0.20
# against a measured 568.8) put 0.15 at CVaR 618 / ETL 0.764. Extrapolating
# the measured builds (CVaR ~0.29x the family ceiling at both 0.20 and 0.16)
# lands 0.15 near 650-660 / 0.77 - and that is the estimate that held: the
# 2026-09-22 build MEASURES CVaR 639.0, etl40b 0.769 and std 38.401, inside
# 700 / 0.8 / 50 on roughly half the margin 0.16 had. ETL is the binding one
# at 4% of headroom, so read etl40b first in stats_summary.json after any
# change here; a rebuild that pushes it past 0.8 goes back to 0.16 (wincap
# 2200, ceiling 2169.2x). 0.10 fails on ETL whatever cap is put on it. Note that at 0.15 a card-2 bust shows 0.2x (1.995 x 0.15 x 0.995 =
# 0.298, floored) where 0.16 still showed 0.3x.
#
# THE FOUR-GUESS FAMILIES COST 1.0x, AND THAT IS A CONSTRAINT, NOT A DEFAULT
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
#
# THE ALL-OR-NOTHING BOUND (why Three of a Kind is what it is)
#
# "Nothing on a miss, more for the full ride" was asked for and cannot exist on
# the four-guess ride, for two reasons that are not a matter of tuning:
#
#   1. pay x chance = RTP. Only the sweep pays, so its recorded frequency must
#      clear Stake's "better than 1 in 20" hit-rate line, which caps a binary
#      payout at 19.2x the cost. The BEST four-guess combination (higher/lower
#      + outside) sweeps 1 in 26.8; colour->equal->equal->suit sweeps 1 in
#      3,500 and fails hit rate, std (57 > 50), CVaR (960 > 700) and ETL at
#      once. A shorter deck makes it WORSE: fewer ranks means more ties, and
#      ties eat the higher/lower probability, while the suit stage (x1/4) is
#      untouched by any rank change.
#   2. etl40b: a single outcome at or above 40x cost puts 100% of the RTP in
#      the tail against an 80% limit. So a zero-on-miss mode is capped under
#      40x cost before the hit-rate line even applies, and a big trips payout
#      (600x+) is only reachable with a consolation on the pair - a different
#      product, declined.
#
# What escapes both is a cost multiple: the ride pays under 40x its cost, so
# its etl40b is 0 at any cost, and the cost turns a small multiple into a large
# base-bet figure. But the SAME reading that frees it caps it, because Stake's
# tail rules are written in base-bet multiples and never scale with cost:
#
#   P(>= 5,000x base)  <= 1%     P(>= 10,000x) <= 0.5%    P(>= 25,000x) <= 0.2%
#   CVaR absolute <= 20,000x base   etl10k (RTP share above 10,000x) <= 0.6
#
# A binary win at or above 10,000x base would have to land rarer than 1 in
# 200, i.e. pay >= 192x its cost - which etl40b forbids (a single outcome at
# or above 40x cost is 100% of the RTP). One step down, a win at or above
# 5,000x needs 1 in 100, i.e. >= 96x cost: same wall. So a binary mode's win
# MUST STAY UNDER 5,000x THE BASE BET (10,000x at 3-star), and the first
# build of this family - A K Q J, cost 1000x, 25,000x - failed every tail row
# at once. No consolation rescues that figure either: the tail rows count how
# OFTEN a >= 10,000x win lands, not how much RTP it carries.
#
# Under 5,000x with the win under 40x cost puts the cost at a few hundred, and
# the deck sets the multiple. A K Q, one of each, three cards: card 2 matches
# 3 of 11, card 3 matches 2 of 10 - fair odds 1 x 11/3 x 5 = 18.333x at a
# physical 1 in 18.3, recorded 1 in 19.1 once reweighted to 96%. Cost 250x
# lands that on 4,583.3x the base bet, with every hard row clear: P(>= 5,000x)
# 0, etl40b 0, etl10k 0, CVaR 4,583 absolute / 18.3 per stake, and a hit rate
# INSIDE the soft 1-in-20 line. Fair pricing throughout: the published table
# deals what the deck deals.
#
# WHY 250x AND NOT MORE. The win must stay under 5,000x base, and at fair odds
# the win is 18.333 x cost, so cost < 272.7: at 273x the mode's only win
# crosses 5,000x and P(>= 5,000x) jumps from 0 to the whole hit rate (5.2%
# against a 1% limit) - a cliff, not a slope. 250 is the last round figure
# under it. The cost also sizes the bet ladder, which is the other reason it
# stays there: bet cost is capped at $50,000 per round on the 2-star template
# and exposure at $5,000,000, so 250x leaves the base bet at $200 and the win
# at $916,660 (272x would take the base bet to $183 for a 1% bigger prize). At
# 1000x the same caps pushed the whole game's base bet to $50.
#
# Decks considered and declined: A K Q J (16 cards) fair 35x / 1 in 36.5 -
# only fits under 5,000x by pricing it down to 24x, dealing trips 45% more
# often than the deck and sitting past 1 in 20; A K Q J x 2 (32 cards) 22.1x /
# 1 in 23 - "two of each" is harder to explain and also past the line.
#
# Precedent: Graffiti Ways (Colorful Play) ships a 1000x-cost mode paying
# 25,000x base. Its paytable is a wide slot distribution with token line hits
# of 0.1x-16x BASE on a 1000x round, so its 25,000x is a rare corner of a
# spread, not a 1-in-26 binary - which is how it clears the tail rows this
# mode cannot. This mode stays PURELY binary; 94.8% of its rounds pay nothing,
# which is past the "90,000 of 100,000" example in Stake's guidelines even
# though the hit rate itself clears 1 in 20. If review objects, the first fix
# is a token pair payout (retention ~2e-3 on the card-3 miss returns 1x base on
# a pair: hit rate 1 in 5, RTP cost ~0.06%, trips unchanged).
# ---------------------------------------------------------------------------

BASE_RETENTION = (0.0, 0.3, 0.3, 0.3)

# Three of a Kind's deck and combo. Only ranks in RANKS order, so rank_value is
# untouched (it is never asked for here anyway - "equal" is the only rank test).
# THREE stages: a combination's length is its stage count, and run_spin deals
# that many cards. The four-guess families are the only ones with a suit stage.
TRIPS_DECK = {"ranks": ["Q", "K", "A"], "copies": 1}
TRIPS_COMBO = (FREE_CHOICE, "equal", "equal")

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
        "retention": (0.0, 0.15, 0.15, 0.15),
        "forgive": None,
        "forgive_from": 0,
        # Reaches 2237.3x - still above Classic's 1354.2x, because a miss keeps
        # less here and so every correct guess is priced higher. The shared 1400
        # cap CLIPPED this family, which the frontend's book-parity test caught
        # as "client 3820.5 vs book 1400" back when it cost 2x. 2300 clears the
        # real ceiling (it was 2200 over 2169.2x at 0.16, and 2000 over 1910.2x
        # at 0.20) - it must sit ABOVE the ceiling, see the note on base.
        "wincap": 2300,
    },
    "tr": {
        "prefix": "tr_",
        # The only family not at 1.0x - see THE ALL-OR-NOTHING BOUND above.
        "cost": 250.0,
        "retention": (0.0, 0.0, 0.0),
        "forgive": None,
        "forgive_from": 0,
        # Reaches 4,583.3x the base bet (18.333x the cost, floored to 0.1x).
        # Under the 5,000x tail line; 4700 never binds.
        "wincap": 4700,
        # The three fields below default for the other families: config
        # target_rtp, the full 52-card deck, and the 64 combinations.
        # A pricing target of 1.0 (decay = 1) so the free card pays exactly
        # 1.00x rather than 0.9975 - which the client's 0.1x floor would
        # display as 0.9x on a card that was never a guess.
        "target_rtp": 1.0,
        "deck": TRIPS_DECK,
        "combos": [TRIPS_COMBO],
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


def all_mode_combinations(family: str = "base"):
    """
    Every (color, higher_lower, inside_outside, suit) choice combination that
    can actually be won. Excludes higher_lower="equal" + inside_outside="inside":
    if stage 2 ties the reference card's rank exactly, the two reference
    values for stage 3 are identical, so there's no rank strictly "between"
    them - "inside" is mathematically impossible, not just rare. A bet mode
    with a 100% loss rate has zero variance, which Stake's RGS rejects
    outright ("failed to obtain distribution statistics from lookup table").

    A family that publishes a fixed list ("combos") yields that list instead -
    Three of a Kind is one combination, not 64.
    """
    fixed = MODE_FAMILIES[family].get("combos")
    if fixed is not None:
        yield from fixed
        return
    for color in COLOR_CHOICES:
        for higher_lower in HIGHER_LOWER_CHOICES:
            for inside_outside in INSIDE_OUTSIDE_CHOICES:
                if higher_lower == "equal" and inside_outside == "inside":
                    continue
                for suit in SUIT_CHOICES:
                    yield (color, higher_lower, inside_outside, suit)


def mode_name(*choices: str, family: str = "base") -> str:
    """
    Bet mode name: one full pre-selected choice combination - four stages on
    the four-guess families, three on Three of a Kind - prefixed with its
    family.

    The base family carries NO prefix, deliberately. Its 64 names are already
    published and every replay event ID recorded against them stays valid.
    """
    prefix = MODE_FAMILIES[family]["prefix"]
    return prefix + "_".join(choices)


def parse_mode_name(name: str) -> tuple:
    """
    Inverse of mode_name(): -> (family, choice, choice, ...) - the family and
    then ONE ENTRY PER STAGE, so a caller that wants the stage count reads the
    length. Four-guess modes come back as (family, color, higher_lower,
    inside_outside, suit); Three of a Kind as (family, any, equal, equal).
    """
    family = family_of(name)
    body = name[len(MODE_FAMILIES[family]["prefix"]) :]
    return (family, *body.split("_"))


# The order the build works through the families - and so the order of every
# list it writes: the simulation, the reweight, the verification, the book
# scan, publish_files/index.json and stats_summary.json, and the mode boxes in
# build_monitor.py's page.
#
# Volatility order, calmest first, which is how the families are listed
# everywhere they are read: Second Chance keeps half of a first miss, Classic
# keeps 30%, High Stakes 15%, and Three of a Kind is its own game. It is a
# READING ORDER ONLY - no family's cost, retention or payout depends on where
# it sits here, and a simulation's outcome is a function of its global index
# (reset_seed(sim)), never of when its mode was run.
FAMILY_BUILD_ORDER = ("sc", "base", "hs", "tr")


def ordered_families() -> list:
    """MODE_FAMILIES' keys in FAMILY_BUILD_ORDER, all of them, checked.

    A family added to MODE_FAMILIES and forgotten here would simply stop being
    published - 193 modes would quietly become 129 - so this refuses rather
    than dropping it.
    """
    missing = [family for family in MODE_FAMILIES if family not in FAMILY_BUILD_ORDER]
    if missing:
        raise RuntimeError(
            f"FAMILY_BUILD_ORDER does not list {missing}. Every family in MODE_FAMILIES "
            "must appear in it, or its modes are never published."
        )
    return [family for family in FAMILY_BUILD_ORDER if family in MODE_FAMILIES]


def all_published_modes():
    """Every (family, combo) pair the game publishes - 3 x 64 + 1 = 193."""
    for family in ordered_families():
        for combo in all_mode_combinations(family):
            yield family, combo


# Ace-low rank values, built once from RANKS.
#
# This is the hottest line in the whole build. rank_value() is called for every
# remaining card at two of the four stages - about 240 times per simulation,
# 10.5 BILLION times across a 44M-simulation build - and it used to be
# RANKS.index(rank) + 1, a linear scan of a 13-element list. A profile of one
# mode put it and the list.index under it at 25% of the entire simulation pass.
# The map holds exactly the same values; nothing about an outcome changes.
_RANK_VALUES = {rank: index + 1 for index, rank in enumerate(RANKS)}


def rank_value(rank: str) -> int:
    """Ace-low rank value, matching the frontend's rankValue map."""
    return _RANK_VALUES[rank]


def build_deck(family: str = "base") -> list:
    """
    Return the family's unshuffled deck as (rank, suit) tuples: the standard 52
    unless the family declares its own ("deck": ranks + copies). Ranks keep
    RANKS order so rank_value never changes meaning.
    """
    spec = MODE_FAMILIES[family].get("deck")
    if spec is None:
        return [(rank, suit) for suit in SUITS for rank in RANKS]
    ranks = [rank for rank in RANKS if rank in spec["ranks"]]
    return [(rank, suit) for _ in range(spec["copies"]) for suit in SUITS for rank in ranks]


def family_target_rtp(family: str, default: float) -> float:
    """The pricing target decay**4 is solved from - the config value unless the family overrides it."""
    return MODE_FAMILIES[family].get("target_rtp", default)




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
    (all 193 modes within 0.5%) are delivered afterwards by reweight_luts.py,
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

    def target_rtp_decay(self, family: str = "base") -> float:
        """
        Per-stage decay constant: decay**4 == the family's pricing target
        (config.target_rtp unless overridden). Solved as a fourth root even on
        the three-stage family, whose target is exactly 1.0 - so decay is 1
        there and the exponent is moot.
        """
        return family_target_rtp(family, self.config.target_rtp) ** 0.25

    def partial_multiplier(
        self, probability: float, stage_index: int, retention: float = None, decay: float = None
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

        `decay` likewise: the config-derived constant unless the caller prices
        a family with its own target (Three of a Kind prices at exactly 1.0).
        """
        if probability <= 0:
            return 0.0
        if retention is None:
            retention = self.STAGE_RETENTION[stage_index]
        if decay is None:
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

    def color_payouts(self, remaining: list, retention: float = None, decay: float = None) -> dict:
        total = len(remaining)
        red = sum(1 for _, suit in remaining if suit in RED_SUITS)
        black = total - red
        return {
            "red": self.partial_multiplier(red / total, 0, retention, decay),
            "black": self.partial_multiplier(black / total, 0, retention, decay),
        }

    def higher_lower_payouts(self, remaining: list, ref_value: int, retention: float = None, decay: float = None) -> dict:
        # ONE pass, and one rank lookup per card. This used to be two sum()
        # generators over the same ~50 cards, each calling rank_value on every
        # one of them; the counts are identical, there is just half as much of
        # it. Same for inside_outside_payouts below, which managed three passes
        # and looked a card's rank up twice in one of them.
        total = len(remaining)
        higher = 0
        lower = 0
        for rank, _suit in remaining:
            value = _RANK_VALUES[rank]
            if value > ref_value:
                higher += 1
            elif value < ref_value:
                lower += 1
        equal = total - higher - lower
        return {
            "higher": self.partial_multiplier(higher / total, 1, retention, decay),
            "lower": self.partial_multiplier(lower / total, 1, retention, decay),
            "equal": self.partial_multiplier(equal / total, 1, retention, decay),
        }

    def inside_outside_payouts(self, remaining: list, val_a: int, val_b: int, retention: float = None, decay: float = None) -> dict:
        total = len(remaining)
        min_val, max_val = min(val_a, val_b), max(val_a, val_b)
        inside = 0
        outside = 0
        for rank, _suit in remaining:
            value = _RANK_VALUES[rank]
            if min_val < value < max_val:
                inside += 1
            elif value < min_val or value > max_val:
                outside += 1
        equal = total - inside - outside
        return {
            "inside": self.partial_multiplier(inside / total, 2, retention, decay),
            "outside": self.partial_multiplier(outside / total, 2, retention, decay),
            "equal": self.partial_multiplier(equal / total, 2, retention, decay),
        }

    def suit_payouts(self, remaining: list, retention: float = None, decay: float = None) -> dict:
        total = len(remaining)
        counts = {suit: 0 for suit in SUITS}
        for _, suit in remaining:
            counts[suit] += 1
        return {
            "heart": self.partial_multiplier(counts["♥"] / total, 3, retention, decay),
            "diamond": self.partial_multiplier(counts["♦"] / total, 3, retention, decay),
            "club": self.partial_multiplier(counts["♣"] / total, 3, retention, decay),
            "spade": self.partial_multiplier(counts["♠"] / total, 3, retention, decay),
        }
