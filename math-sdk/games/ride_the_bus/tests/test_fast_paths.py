"""
The simulator's fast paths must deal and pay EXACTLY what the slow ones do.

gamestate.run_spin prices a stage with `_price_choice` - arithmetic on the
family's full-deck histogram - and shuffles with `fast_shuffle`, an unrolled
copy of CPython's Fisher-Yates. Both exist only for speed (a quarter of a
simulation each), and both are only acceptable if they change NOTHING about a
published book. These tests hold them to the implementations they replaced,
which are kept for exactly this purpose:

  * `_stage_payouts(...)[choice]` - the full payout table, built by scanning
    the cards still to come;
  * `random.shuffle`.

Equality is `==` on floats, deliberately. "Close" would be a different book.

Run from the math-sdk root:

    .venv/Scripts/python.exe -m pytest games/ride_the_bus/tests -q
"""

import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
SDK = os.path.abspath(os.path.join(GAME, os.pardir, os.pardir))
for path in (SDK, GAME):
    if path not in sys.path:
        sys.path.insert(0, path)

from game_calculations import (  # noqa: E402
    FREE_CHOICE,
    MODE_FAMILIES,
    all_mode_combinations,
    build_deck,
    ordered_families,
)
from game_config import GameConfig  # noqa: E402
from gamestate import (  # noqa: E402
    FAST_SHUFFLE_OK,
    DeckCounts,
    GameState,
    fast_shuffle,
    shuffle_plan,
)

_STATE = None


def _gamestate():
    global _STATE
    if _STATE is None:
        _STATE = GameState(GameConfig())
    return _STATE


def test_fast_shuffle_is_on():
    # If this fails the build still produces the right books - it falls back
    # to random.shuffle - but it has quietly lost a quarter of its speed.
    assert FAST_SHUFFLE_OK


def test_fast_shuffle_deals_what_random_shuffle_deals():
    for family in ordered_families():
        cards = build_deck(family)
        plan = shuffle_plan(len(cards))
        for seed in range(1, 3001):
            random.seed(seed)
            expected = list(cards)
            random.shuffle(expected)
            random.seed(seed)
            got = list(cards)
            fast_shuffle(got, plan)
            assert got == expected, f"{family}: seed {seed} dealt differently"


def test_fast_shuffle_leaves_the_rng_where_random_shuffle_does():
    # Nothing after the shuffle draws today, but if something ever does it must
    # see the same stream.
    cards = build_deck("base")
    random.seed(99)
    random.shuffle(list(cards))
    after_stdlib = random.random()
    random.seed(99)
    fast_shuffle(list(cards), shuffle_plan(len(cards)))
    assert random.random() == after_stdlib


def _choices_at(family, stage_index):
    """Every choice a published mode of this family can make at this stage."""
    return sorted({combo[stage_index] for combo in all_mode_combinations(family) if len(combo) > stage_index})


def test_price_choice_matches_the_full_table_everywhere():
    gamestate = _gamestate()
    checked = 0
    for family in ordered_families():
        config = MODE_FAMILIES[family]
        counts = DeckCounts(build_deck(family))
        decay = gamestate.target_rtp_decay(family)
        stages = len(next(iter(all_mode_combinations(family))))
        # Every retention a stage can be priced against: the family's table,
        # and the forgiveness value where the family has one.
        retentions = set(config["retention"])
        if config["forgive"] is not None:
            retentions.add(config["forgive"])
        for seed in range(1, 1501):
            random.seed(seed)
            deck = list(counts.cards)
            random.shuffle(deck)
            drawn = deck[:stages]
            drawn_ranks = [build_rank(rank) for rank, _suit in drawn]
            for stage_index in range(stages):
                for retention in retentions:
                    table = gamestate._stage_payouts(stage_index, deck, drawn_ranks, retention, decay)
                    for choice in _choices_at(family, stage_index):
                        if choice == FREE_CHOICE:
                            continue
                        fast = gamestate._price_choice(
                            stage_index, choice, drawn, drawn_ranks, counts, retention, decay
                        )
                        assert fast == table[choice], (
                            f"{family} seed {seed} stage {stage_index} {choice} "
                            f"retention {retention}: fast {fast!r} vs table {table[choice]!r}"
                        )
                        checked += 1
    # Not a vacuous pass: every family, every stage, every choice, many deals.
    assert checked > 100_000, checked


def build_rank(rank):
    from game_calculations import rank_value

    return rank_value(rank)


def test_deck_counts_agree_with_a_scan():
    for family in ordered_families():
        cards = build_deck(family)
        counts = DeckCounts(cards)
        assert counts.total == len(cards)
        for v in range(14):
            assert counts.le[v] == sum(1 for rank, _ in cards if build_rank(rank) <= v)
