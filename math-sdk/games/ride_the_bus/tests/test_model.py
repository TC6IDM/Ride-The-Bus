"""
model_families.py - the exact model - has to agree with the build it predicts,
and Last Stop has to stay the family the owner approved.

Three things are pinned here:

  * THE MODEL IS RIGHT. Against the published build (when there is one), no
    mode's maximum may exceed its exact ceiling - a sampled table cannot pay
    more than the rules allow - and each family's worst std, etl40b and CVaR
    must land within a few percent of what was built. The build runs a little
    hot (the worst of 64 sampled modes is biased upward), so the band is
    lopsided on purpose.
  * NO RIGHT GUESS LOSES THE PLAYER MONEY. Every multiplier a correct pick can
    show is at least 1x, on every family. This is the owner's rule
    (2026-09-27): Last Stop's first design spread its ticket's price over all
    four cards and showed x0.76 on a right Higher on an Ace. A retune that
    brings that back fails here rather than on a player's screen.
  * LAST STOP IS CLASSIC UNTIL THE SUIT, and the approved shape after it
    (2026-09-30): cards 1-3 score exactly as Classic's, a right suit pays the
    ticket and nothing else, a wrong one keeps Classic's 30%. Its second design
    priced card 1 at 1.28x against Classic's 1.99x to pay for the ticket, and
    read as a mode that cut the player's profit and handed it back.
  * AND IT IS INSIDE THE 2-STAR LIMITS, between Classic and High Stakes by std
    on every one of the 64 combinations - which is what lets it sit on the
    fourth bolt.

    .venv/Scripts/python.exe -m pytest games/ride_the_bus/tests -q
"""

import json
import os
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
SDK = os.path.abspath(os.path.join(GAME, os.pardir, os.pardir))
for path in (SDK, GAME):
    if path not in sys.path:
        sys.path.insert(0, path)

import model_families as model  # noqa: E402
from game_calculations import mode_name  # noqa: E402

FOUR_GUESS = ("sc", "base", "ls", "hs")
STATS = os.path.join(GAME, "library", "stats_summary.json")
RULES = os.path.join(GAME, "library", "build_rules.json")


@pytest.fixture(scope="module")
def rows():
    return {family: model.model_family(family) for family in FOUR_GUESS}


def _built_under_current_rules(family: str) -> bool:
    """Is the build on disk this family's, under the rules the model uses?"""
    if not (os.path.exists(STATS) and os.path.exists(RULES)):
        return False
    with open(RULES, encoding="utf-8") as fh:
        built = json.load(fh)["families"].get(family)
    if built is None:
        return False
    cfg = model.MODE_FAMILIES[family]
    ticket = [list(pair) for pair in cfg["ticket"]] if cfg.get("ticket") else None
    return (
        built["cost"] == cfg["cost"]
        and built["retention"] == list(cfg["retention"])
        and built["forgive"] == cfg["forgive"]
        and built["forgive_from"] == cfg["forgive_from"]
        and built.get("ticket") == ticket
        # Written only by builds of Last Stop's rejected second design.
        and not built.get("flat_bust")
        and built.get("card1_decay") is None
    )


@pytest.mark.parametrize("family", FOUR_GUESS)
def test_the_model_agrees_with_the_published_build(rows, family):
    if not _built_under_current_rules(family):
        pytest.skip(f"no build of {family} under the current rules to compare with")
    checks = model.published_check(rows[family], STATS)
    assert len(checks) == 4 * 64, "the build is missing some of this family's modes"
    over = [(m, exact, built) for m, f, exact, built in checks if f == "max" and built > exact + 1e-9]
    assert not over, f"a published maximum above its exact ceiling: {over[:3]}"
    for field in ("std", "etl40b", "cvar"):
        exact = max(e for _m, f, e, _b in checks if f == field)
        built = max(b for _m, f, _e, b in checks if f == field)
        assert 0.94 * built <= exact <= 1.02 * built, f"{family} worst {field}: exact {exact:.3f}, built {built:.3f}"


@pytest.mark.parametrize("family", FOUR_GUESS)
def test_no_right_guess_shows_less_than_one(rows, family):
    worst = min(rows[family], key=lambda row: row["min_chip"])
    assert worst["min_chip"] >= 1.0, (
        f"{worst['mode']}: a correct pick multiplies the running total by {worst['min_chip']:.4f}"
    )


def test_three_of_a_kinds_free_card_is_exactly_one():
    # Its only "right guess" before the Equals is the free card, which must
    # read 1.00x - not 0.9975, which the display floor would print as 0.9x.
    assert model.figures("tr_any_equal_equal")["min_chip"] == 1.0


def test_last_stop_is_classic_until_the_suit():
    # Deal the same cards to a Classic mode and its Last Stop twin: the first
    # three cards must score identically - same price, same running total, same
    # bust - and the suit card must pay nothing of its own on a right guess and
    # keep Classic's 30% on a wrong one.
    import random

    import gamestate as g

    gs = model._gamestate()
    for combo in (("red", "higher", "outside", "heart"), ("black", "equal", "outside", "spade"),
                  ("red", "lower", "inside", "club")):
        plans = {}
        for family in ("base", "ls"):
            gs.betmode = mode_name(*combo, family=family)
            plans[family] = gs._spin_plan()
        rng = random.Random(7)
        seen = {"right": 0, "wrong": 0}
        for _ in range(4000):
            deck = list(plans["base"].deck.cards)
            rng.shuffle(deck)
            drawn = deck[:4]
            ranks = [model._RANK_VALUES[rank] for rank, _suit in drawn]
            state = {family: g.ROUND_START for family in plans}
            for k in range(4):
                out = {family: gs.score_stage(plans[family], drawn, ranks, k, state[family]) for family in plans}
                if k < 3:
                    assert out["ls"] == out["base"], (combo, drawn, k)
                elif not state["ls"][1]:
                    (reveal, after), running = out["ls"], state["ls"][0]
                    if reveal[4]:
                        seen["right"] += 1
                        assert reveal[5] == 1.0 and after[0] == running and not after[1]
                    else:
                        seen["wrong"] += 1
                        assert after[0] == running * 0.3 and after[1]
                        assert after == out["base"][1], "a wrong suit keeps what Classic's does"
                state = {family: out[family][1] for family in plans}
        assert seen["right"] and seen["wrong"], (combo, seen)


def test_last_stop_is_the_approved_shape(rows):
    s = model.family_summary(rows["ls"])
    assert s["std_min"] == pytest.approx(4.52, abs=0.05)
    assert s["std_max"] == pytest.approx(31.0, abs=0.05)
    assert s["etl40b"] == pytest.approx(0.585, abs=0.001)
    assert s["cvar"] == pytest.approx(475.5, abs=0.1)
    # Classic's best run to card 3 (430.19x) times the 10x ticket.
    assert s["max"] == 4301.9
    assert s["sweep_1_in"][0] == pytest.approx(29.0, abs=0.1)
    assert s["sweep_1_in"][1] == pytest.approx(3539, abs=1)
    # Classic's own smallest right chip (Outside on a pair); the suit card's
    # smallest is the 2x ticket.
    assert s["min_chip"] == pytest.approx(1.0266, abs=1e-4)


def test_last_stop_clears_the_2_star_limits(rows):
    s = model.family_summary(rows["ls"])
    assert 0.6 <= s["std_min"] and s["std_max"] <= 50
    assert s["etl40b"] < 0.8
    assert s["cvar"] < 700
    assert s["non_zero_1_in"] < 20
    assert s["p5k"] == 0
    assert s["max"] < model.MODE_FAMILIES["ls"]["wincap"], "the declared wincap would clip the ceiling"


def test_last_stop_sits_between_classic_and_high_stakes_on_every_combination(rows):
    std = {family: {row["mode"].removeprefix(model.MODE_FAMILIES[family]["prefix"]): row["std"] for row in rows[family]}
           for family in ("base", "ls", "hs")}
    out_of_order = [combo for combo in std["base"] if not std["base"][combo] < std["ls"][combo] < std["hs"][combo]]
    assert not out_of_order, f"not between Classic and High Stakes: {out_of_order[:4]}"
