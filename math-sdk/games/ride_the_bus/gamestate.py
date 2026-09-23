"""Handles the state and output for a single simulation round of Ride The Bus."""

import hashlib
import json
import os
import random
import struct
import sys
from concurrent.futures import ProcessPoolExecutor

from game_override import GameStateOverride
from game_calculations import (
    _RANK_VALUES,
    FREE_CHOICE,
    MODE_FAMILIES,
    RED_SUITS,
    SUITS,
    build_deck,
    parse_mode_name,
    rank_value,
)
from src.events.events import *

# ---------------------------------------------------------------------------
# THE FAST PATH, AND WHY IT PRODUCES THE SAME BYTES
#
# 44 million simulations make every microsecond in run_spin worth about 44
# seconds of build. A profile of one mode put a quarter of a simulation in the
# 52-card shuffle and most of the rest in pricing: every stage scanned the
# 49-52 cards still to come to count outcomes, priced EVERY choice (twelve
# partial_multiplier calls a round) and used one of them. None of that changes
# what comes out, so none of it has to be done the slow way:
#
#   * The counts are arithmetic. "Cards still to come" is the family's full
#     deck minus the cards already turned, so a count of ranks above card 1,
#     between cards 1 and 2, or of a suit, is a lookup in the full deck's
#     histogram corrected for at most three turned cards. Same integers as the
#     scan, so the same probability, so the same float out of
#     partial_multiplier - it is still the one that prices the stage.
#   * Only the chosen choice is priced; it was the only one ever read.
#   * The shuffle is CPython's own algorithm (random.Random.shuffle over
#     _randbelow_with_getrandbits), unrolled against a precomputed table of
#     bit lengths, so it makes exactly the same getrandbits calls and leaves
#     exactly the same permutation. FAST_SHUFFLE_OK below checks that against
#     the real random.shuffle when this module loads, and falls back to it if
#     the interpreter ever disagrees - an upgrade that changed the stdlib
#     algorithm would otherwise change every book silently.
#
#   * The deal is shared. run_spin seeds on the global simulation index, so
#     simulation 5 deals the same four cards in all 192 four-guess modes -
#     and seeding (random.seed rebuilds a 624-word Mersenne Twister state,
#     ~5us) plus the shuffle was a fifth of a simulation once everything
#     else above had been cut. DealCache holds the first four cards of all
#     800,000 shuffles, dealt ONCE per build by exactly the code below, and
#     run_spin reads its cards from it instead of reseeding and reshuffling.
#     Three of a Kind has its own deck and one mode, so it deals as before.
#
# The slow implementations are still here (_stage_payouts and the
# *_payouts tables in game_calculations.py) as the reference, and
# tests/test_fast_paths.py holds the fast ones to them: every stage, every
# choice, every family, over thousands of deals. The published books were
# compared byte for byte as well.
# ---------------------------------------------------------------------------

_REVEAL = EventConstants.REVEAL.value
# (running_multiplier, busted, forgiveness_spent) before a round's first card.
ROUND_START = (1.0, False, False)
_SUIT_NAME = {"♥": "heart", "♦": "diamond", "♣": "club", "♠": "spade"}
_SUIT_SYMBOL = {name: symbol for symbol, name in _SUIT_NAME.items()}
_getrandbits = random.getrandbits  # the module instance random.seed reseeds


def shuffle_plan(size: int) -> tuple:
    """(i, i + 1, bit length) for every step of CPython's Fisher-Yates."""
    return tuple((i, i + 1, (i + 1).bit_length()) for i in range(size - 1, 0, -1))


def fast_shuffle(deck: list, plan: tuple) -> None:
    """random.shuffle(deck), draw for draw - see the note above."""
    getrandbits = _getrandbits
    for i, n, k in plan:
        j = getrandbits(k)
        while j >= n:
            j = getrandbits(k)
        deck[i], deck[j] = deck[j], deck[i]


def _fast_shuffle_matches_stdlib() -> bool:
    """Does fast_shuffle deal what random.shuffle deals, on this interpreter?"""
    state = random.getstate()
    try:
        for size in (52, 12):
            plan = shuffle_plan(size)
            for seed in range(1, 401):
                random.seed(seed)
                expected = list(range(size))
                random.shuffle(expected)
                random.seed(seed)
                got = list(range(size))
                fast_shuffle(got, plan)
                if got != expected:
                    return False
        return True
    finally:
        random.setstate(state)


FAST_SHUFFLE_OK = _fast_shuffle_matches_stdlib()
if not FAST_SHUFFLE_OK:  # pragma: no cover - only on an interpreter that changed shuffle
    print(
        "! gamestate: this Python's random.shuffle no longer matches the unrolled copy; "
        "using random.shuffle. Books are unaffected, the build is just slower."
    )


# ---------------------------------------------------------------------------
# The shared deal
# ---------------------------------------------------------------------------
DEAL_WIDTH = 4  # the most cards any 52-card family turns
DEAL_FILE = "deals_standard52.bin"
_DEAL_MAGIC = b"RTBDEAL1"
_DEAL_RULE = "random.seed(sim + 1); shuffle(build_deck(family)); first 4 cards"


def standard_deck() -> tuple:
    """The deck every four-guess family deals from."""
    return tuple(build_deck("base"))


def deal_sims(deck: tuple, start: int, stop: int) -> bytes:
    """
    The first DEAL_WIDTH cards of simulations [start, stop), as indices into
    `deck`, dealt EXACTLY as run_spin deals them without a cache: reseed on
    the simulation index, shuffle a fresh copy of the deck. This function is
    the definition of the cache's contents, and run_spin's fallback path is
    the same two calls.
    """
    index = {card: i for i, card in enumerate(deck)}
    plan = shuffle_plan(len(deck))
    out = bytearray(DEAL_WIDTH * (stop - start))
    offset = 0
    for sim in range(start, stop):
        random.seed(sim + 1)
        cards = list(deck)
        if FAST_SHUFFLE_OK:
            fast_shuffle(cards, plan)
        else:  # pragma: no cover
            random.shuffle(cards)
        for card in cards[:DEAL_WIDTH]:
            out[offset] = index[card]
            offset += 1
    return bytes(out)


def _deal_chunk(args):
    """Pool entry point for build_deal_cache."""
    deck, start, stop = args
    return start, deal_sims(deck, start, stop)


class DealCache:
    """
    The first four cards of every simulation's shuffled 52-card deck.

    Read by run_spin; built by run.py before create_books (build_deal_cache)
    and kept in the library between builds, because it depends on nothing
    but the deck and the seeding rule. It is only ever USED after
    load_deal_cache has checked it against both - see there.
    """

    __slots__ = ("deck", "data", "count")

    def __init__(self, deck: tuple, data: bytes, count: int):
        self.deck = deck
        self.data = data
        self.count = count

    def drawn(self, sim: int, stages: int) -> list:
        i = sim * DEAL_WIDTH
        deck = self.deck
        return [deck[b] for b in self.data[i : i + stages]]


def _deal_header(deck: tuple, count: int, data: bytes) -> dict:
    return {
        "rule": _DEAL_RULE,
        "deck": [f"{rank}{suit}" for rank, suit in deck],
        "count": count,
        "width": DEAL_WIDTH,
        # The shuffle is CPython's, and a different interpreter may shuffle
        # differently - so a cache is only trusted by the build that made it.
        "python": sys.version,
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def build_deal_cache(path: str, count: int, workers: int = 1) -> DealCache:
    """Deal `count` simulations once and write them to `path`."""
    deck = standard_deck()
    chunk = max(1, -(-count // max(1, workers * 4)))
    jobs = [(deck, start, min(start + chunk, count)) for start in range(0, count, chunk)]
    parts = {}
    if workers > 1 and len(jobs) > 1:
        with ProcessPoolExecutor(max_workers=workers) as pool:
            for start, data in pool.map(_deal_chunk, jobs):
                parts[start] = data
    else:
        for job in jobs:
            start, data = _deal_chunk(job)
            parts[start] = data
    data = b"".join(parts[start] for start in sorted(parts))
    header = json.dumps(_deal_header(deck, count, data)).encode("utf-8")
    tmp = path + ".tmp"
    with open(tmp, "wb") as fh:
        fh.write(_DEAL_MAGIC)
        fh.write(struct.pack("<I", len(header)))
        fh.write(header)
        fh.write(data)
    os.replace(tmp, path)  # never leave a half-written cache under the real name
    return DealCache(deck, data, count)


def load_deal_cache(path: str, need: int = 0):
    """
    The cache at `path`, or None if there is none or it cannot be trusted.

    Trusted means ALL of: the right magic and rule; the same deck, card for
    card, in the same order; the same interpreter that built it; the data
    matching its own SHA-256; at least `need` simulations; and 64 simulations
    spread across it re-dealt from scratch and matching. None costs speed,
    never correctness - run_spin then deals every round itself.
    """
    try:
        with open(path, "rb") as fh:
            if fh.read(len(_DEAL_MAGIC)) != _DEAL_MAGIC:
                return None
            (length,) = struct.unpack("<I", fh.read(4))
            header = json.loads(fh.read(length).decode("utf-8"))
            data = fh.read()
    except (OSError, ValueError, struct.error):
        return None
    deck = standard_deck()
    count = header.get("count", 0)
    if (
        header.get("rule") != _DEAL_RULE
        or header.get("width") != DEAL_WIDTH
        or header.get("deck") != [f"{rank}{suit}" for rank, suit in deck]
        or header.get("python") != sys.version
        or count < need
        or len(data) != DEAL_WIDTH * count
        or hashlib.sha256(data).hexdigest() != header.get("sha256")
    ):
        return None
    state = random.getstate()
    try:
        for k in range(64):
            sim = (k * (count - 1)) // 63 if count > 1 else 0
            if deal_sims(deck, sim, sim + 1) != data[sim * DEAL_WIDTH : (sim + 1) * DEAL_WIDTH]:
                return None
    finally:
        random.setstate(state)
    return DealCache(deck, data, count)


_DEAL_CACHES = {}


def deal_cache_for(library_path: str):
    """This process's copy of the library's deal cache, loaded once."""
    path = os.path.join(library_path, DEAL_FILE)
    if path not in _DEAL_CACHES:
        _DEAL_CACHES[path] = load_deal_cache(path)
    return _DEAL_CACHES[path]


class DeckCounts:
    """Everything the pricing needs to know about one family's FULL deck."""

    __slots__ = ("cards", "total", "red", "le", "suit", "plan")

    def __init__(self, cards):
        self.cards = tuple(cards)
        self.total = len(self.cards)
        self.red = sum(1 for _rank, suit in self.cards if suit in RED_SUITS)
        values = [_RANK_VALUES[rank] for rank, _suit in self.cards]
        # le[v] = cards with value <= v, for v = 0..13 (values are 1..13).
        self.le = [sum(1 for value in values if value <= v) for v in range(14)]
        self.suit = {symbol: sum(1 for _rank, suit in self.cards if suit == symbol) for symbol in SUITS}
        self.plan = shuffle_plan(self.total)


class SpinPlan:
    """What run_spin used to re-derive from the mode name on every simulation."""

    __slots__ = (
        "family", "choices", "stages", "retention", "forgive", "forgive_from", "cost", "decay", "deck", "deals"
    )

    def __init__(self, gamestate, betmode: str):
        family, *choices = parse_mode_name(betmode)
        config = MODE_FAMILIES[family]
        self.family = family
        self.choices = tuple(choices)
        self.stages = len(choices)
        self.retention = config["retention"]
        self.forgive = config["forgive"]
        self.forgive_from = config["forgive_from"]
        self.cost = config["cost"]
        self.decay = gamestate.target_rtp_decay(family)
        self.deck = DeckCounts(build_deck(family))
        # Only a family on the standard deck can read the shared deal.
        self.deals = None
        if self.deck.cards == standard_deck() and self.stages <= DEAL_WIDTH:
            self.deals = deal_cache_for(gamestate.output_files.library_path)


class GameState(GameStateOverride):
    """Handle all game-logic and event updates for a given simulation number."""

    def run_spin(self, sim, simulation_seed=None):
        plan = self._spin_plan()
        deals = plan.deals
        if deals is not None and sim < deals.count:
            # What reset_seed does, minus the reseed: this simulation's cards
            # are already in the deal cache, and nothing after the shuffle
            # draws a random number.
            self.sim = sim
            self.repeat_count = 0
        else:
            deals = None
            self.reset_seed(sim)
        self.repeat = True
        passes = 0
        while self.repeat:
            passes += 1
            if deals is not None and passes > 1:  # pragma: no cover - run_spin never repeats
                # A repeat would reshuffle from the RNG's running state, which
                # the cached path never set up. Fail loudly rather than deal
                # something a cold build would not.
                raise RuntimeError("run_spin repeated a round while reading the deal cache")
            self.reset_book()

            stages = plan.stages
            if deals is not None:
                drawn = deals.drawn(sim, stages)
            else:
                deck = list(plan.deck.cards)
                if FAST_SHUFFLE_OK:
                    fast_shuffle(deck, plan.deck.plan)
                else:  # pragma: no cover
                    random.shuffle(deck)
                drawn = deck[:stages]

            reveals, win_amount = self.score_round(plan, drawn)
            for stage_index, rank, suit, choice, correct, payout in reveals:
                # Appended directly rather than through Book.add_event, which
                # deep-copies. This dict is built on this line and never held
                # anywhere else, so there is nothing for a copy to protect -
                # and four copies a round were the biggest single cost left in
                # a simulation. The key order is the book's field order.
                self.book.events.append(
                    {
                        "index": len(self.book.events),
                        "type": _REVEAL,
                        "stage": stage_index + 1,
                        "card": {"rank": rank, "suit": suit},
                        "choice": choice,
                        "correct": correct,
                        "payout": payout,
                    }
                )
            self.win_manager.update_spinwin(win_amount)
            self.win_manager.update_gametype_wins(self.gametype)

            self.evaluate_finalwin()

        self.imprint_wins()

    def score_round(self, plan: SpinPlan, drawn: list):
        """
        What one deal is worth to one bet mode - THE place this game's rules
        are applied to cards.

        Returns (reveals, win_amount): one (stage_index, rank, suit, choice,
        correct, payout) per card turned, and the round's payout as a multiple
        of the base bet. Pure: it reads the plan and the cards and nothing
        else, and it touches no state.

        Both ways of building a book call this - run_spin, inside the SDK's
        per-round machinery, and direct_books.py, which scores every mode
        straight off the shared deal - so the pricing, the forgiveness and
        the bust rule exist exactly once. Anything that changes what a round
        pays changes it here, for both.
        """
        # The bet mode name IS the player's full pre-selected 4-stage choice
        # combination (see game_calculations.mode_name) - chosen before this
        # round was ever played, so the outcome below is a single,
        # independent, stateless resolution against a choice that's already
        # fixed, not something discovered mid-round. One entry per stage: four
        # on the four-guess families, three on Three of a Kind. The stage count
        # IS the combination's length.
        stages = plan.stages

        # What a miss keeps, and whether the first one is forgiven, is the only
        # thing that separates the three families - see MODE_FAMILIES - and
        # score_stage reads both off the plan.
        drawn_ranks = [_RANK_VALUES[rank] for rank, _ in drawn]

        # Partial credit: a miss doesn't zero the round - it keeps
        # STAGE_RETENTION[stage] of whatever was already banked (see
        # game_calculations.GameCalculations for the full derivation). Reveals
        # still stop at the first miss (busted), matching the UI's bust
        # animation, but the stages that never get played would each have
        # contributed an expected `decay` factor to the running multiplier -
        # skipping them silently would under-credit the round relative to what
        # the martingale formula assumes, so their expected contribution is
        # applied analytically instead of simulated (decay**remaining_stages).
        # This is only valid because decay is a FIXED constant, not derived
        # from this round's own probabilities - substituting it for stages
        # that weren't actually drawn preserves the exact same expectation.
        state = ROUND_START
        reveals = []
        for stage_index in range(stages):
            reveal, state = self.score_stage(plan, drawn, drawn_ranks, stage_index, state)
            reveals.append(reveal)
        return reveals, self.settle_round(plan, state)

    def score_stage(self, plan: SpinPlan, drawn: list, drawn_ranks: list, stage_index: int, state: tuple):
        """
        One card of a round: (reveal, next state), where state is
        (running_multiplier, busted, forgiveness_spent) - ROUND_START before
        the first card.

        A stage depends on the cards turned up to and including this one and
        on nothing else, which is what lets direct_books remember the early
        stages of a round by its first cards and only work out the last one.
        score_round runs the stages in order, so the arithmetic - and every
        float it produces - is exactly what one loop over the cards did.
        """
        running_multiplier, busted, forgiveness_spent = state
        rank, suit = drawn[stage_index]
        choice = plan.choices[stage_index]
        forgive = plan.forgive
        decay = plan.decay

        # The retention a miss at THIS stage would actually bank. While a
        # Second Chance round still holds its forgiveness that is the
        # forgiveness value, not the bust table - and the stage has to be
        # PRICED against the same number, or the martingale breaks and the
        # mode's RTP drifts off target.
        forgiveness_available = forgive is not None and not forgiveness_spent and stage_index >= plan.forgive_from
        if forgiveness_available:
            stage_retention = forgive
        else:
            stage_retention = plan.retention[stage_index]

        if choice == FREE_CHOICE:
            # No guess: the card is shown and the stage pays decay (p = 1 in
            # the martingale), which is exactly 1.0 on the only family that
            # uses it.
            payout = self.partial_multiplier(1.0, stage_index, stage_retention, decay)
        else:
            payout = self._price_choice(stage_index, choice, drawn, drawn_ranks, plan.deck, stage_retention, decay)
        correct = not busted and self._is_correct_guess(stage_index, choice, rank, suit, drawn_ranks)
        if not busted and correct:
            running_multiplier *= payout
        elif not busted:
            if forgiveness_available:
                # Forgiven: bank the fraction and PLAY ON. No decay term here -
                # that exists to stand in for stages a bust skips, and this
                # round is going to play them for real.
                running_multiplier *= forgive
                forgiveness_spent = True
            else:
                running_multiplier *= stage_retention
                running_multiplier *= decay ** (plan.stages - 1 - stage_index)
                busted = True
        return (stage_index, rank, suit, choice, correct, payout), (running_multiplier, busted, forgiveness_spent)

    def settle_round(self, plan: SpinPlan, state: tuple) -> float:
        """
        What a finished round pays, as a multiple of the base bet.

        Quantize the FINAL compounded multiplier only (once) - see
        game_calculations.quantize_multiplier. No special-casing for a total
        loss needed: a stage-1 miss multiplies by STAGE_RETENTION[0] == 0.0,
        which already zeroes it out.

        Scaled by the mode's cost FIRST. payoutMultiplier is expressed against
        the base bet, so a 2x-cost mode has to pay twice as much to return the
        same RTP - and reweight_luts.py cannot supply that itself: it only
        adjusts loss weight, and refuses outright once the target rises above
        a mode's win-conditional mean (~1.49x). Without this a 2x mode would
        silently settle at half the RTP.
        """
        return self.quantize_multiplier(state[0] * plan.cost)

    def run_freespin(self):
        pass

    def _spin_plan(self) -> SpinPlan:
        """The current bet mode's SpinPlan, built once per mode per process.

        Keyed on the betmode AND the pricing target, because target_rtp_decay
        reads config.target_rtp and nothing stops a caller changing it.
        """
        cache = self.__dict__.setdefault("_spin_plans", {})
        key = (self.betmode, self.config.target_rtp)
        plan = cache.get(key)
        if plan is None:
            plan = cache[key] = SpinPlan(self, self.betmode)
        return plan

    def _price_choice(self, stage_index, choice, drawn, drawn_ranks, counts, retention, decay) -> float:
        """
        What `choice` pays at this stage - the same number
        `_stage_payouts(...)[choice]` returns, without building the table.

        The cards still to come are the family's full deck minus the
        `stage_index` cards already turned, so every count below is the full
        deck's histogram (DeckCounts) corrected for those turned cards. The
        turned cards never fall in the counted range at stages 1 and 2 - card 1
        IS the reference, and cards 1-2 ARE the bounds - so only the suit count
        needs the correction spelled out.
        """
        total = counts.total - stage_index
        if stage_index == 0:
            count = counts.red if choice == "red" else total - counts.red
        elif stage_index == 1:
            ref = drawn_ranks[0]
            higher = counts.total - counts.le[ref]
            lower = counts.le[ref - 1]
            if choice == "higher":
                count = higher
            elif choice == "lower":
                count = lower
            else:
                count = total - higher - lower
        elif stage_index == 2:
            a = drawn_ranks[0]
            b = drawn_ranks[1]
            low, high = (a, b) if a <= b else (b, a)
            inside = counts.le[high - 1] - counts.le[low] if low < high else 0
            outside = counts.le[low - 1] + (counts.total - counts.le[high])
            if choice == "inside":
                count = inside
            elif choice == "outside":
                count = outside
            else:
                count = total - inside - outside
        else:
            symbol = _SUIT_SYMBOL[choice]
            count = counts.suit[symbol]
            for _rank, suit in drawn[:stage_index]:
                if suit == symbol:
                    count -= 1
        return self.partial_multiplier(count / total, stage_index, retention, decay)

    def _stage_payouts(self, stage_index, deck, drawn_ranks, retention, decay=None) -> dict:
        """
        The payout table for one stage, priced against `retention`.

        Computed per stage rather than all four upfront, because with
        forgiveness in play the retention a stage is priced against depends on
        whether an earlier stage has already missed - which is not known until
        the loop reaches it.

        The slices are the deck STILL TO COME including the card being turned:
        stage 0 prices against all 52, stage 1 against the 51 left after card 1,
        and so on.
        """
        if stage_index == 0:
            return self.color_payouts(deck[0:], retention, decay)
        if stage_index == 1:
            return self.higher_lower_payouts(deck[1:], drawn_ranks[0], retention, decay)
        if stage_index == 2:
            return self.inside_outside_payouts(
                deck[2:], drawn_ranks[0], drawn_ranks[1], retention, decay
            )
        return self.suit_payouts(deck[3:], retention, decay)

    @staticmethod
    def _is_correct_guess(stage_index, guess, rank, suit, drawn_ranks) -> bool:
        # A free card is never wrong - there was nothing to get wrong.
        if guess == FREE_CHOICE:
            return True
        value = _RANK_VALUES[rank]
        if stage_index == 0:
            color = "red" if suit in ("♥", "♦") else "black"
            return guess == color
        if stage_index == 1:
            ref = drawn_ranks[0]
            if value == ref:
                return guess == "equal"
            return guess == ("higher" if value > ref else "lower")
        if stage_index == 2:
            min_val, max_val = min(drawn_ranks[0], drawn_ranks[1]), max(drawn_ranks[0], drawn_ranks[1])
            if value == min_val or value == max_val:
                return guess == "equal"
            return guess == ("inside" if min_val < value < max_val else "outside")
        return guess == _SUIT_NAME[suit]
