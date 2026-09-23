"""
direct_books must write exactly what the SDK's create_books writes.

The build no longer simulates each mode through the SDK: direct_books scores
every mode straight off the shared deal and writes its files in one pass. That
is only acceptable while the two agree byte for byte, so this builds the same
modes both ways and compares every file:

  * the REFERENCE is create_books with no deal cache at all - every round
    reseeded and shuffled by run_spin itself, the way every build worked
    before any of this;
  * the CANDIDATE is direct_books reading gamestate.DealCache.

One mode per family, including Second Chance's forgiveness and Three of a
Kind's own deck and three-card rounds, a few thousand rounds each - enough
for every stage, bust and forgiveness shape to appear.

    .venv/Scripts/python.exe -m pytest games/ride_the_bus/tests -q
"""

import filecmp
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
SDK = os.path.abspath(os.path.join(GAME, os.pardir, os.pardir))
for path in (SDK, GAME):
    if path not in sys.path:
        sys.path.insert(0, path)

MODES = {
    "red_higher_inside_heart": 3000,  # Classic
    "sc_red_equal_equal_heart": 3000,  # Second Chance, forgiveness, two equals
    "hs_black_lower_outside_spade": 3000,  # High Stakes
    "tr_any_equal_equal": 3000,  # Three of a Kind: its own deck, three cards
}

PER_MODE = [
    ("publish_files", "books_{}.jsonl.zst"),
    ("publish_files", "lookUpTable_{}_0.csv"),
    ("lookup_tables", "lookUpTable_{}.csv"),
    ("lookup_tables", "lookUpTableSegmented_{}.csv"),
    ("forces", "force_record_{}.json"),
    ("configs", "books_{}.verification.json"),
    ("configs", "event_config_{}.json"),
]


def _library(tmp_path, name):
    """Point the SDK at a fresh library folder, and hand back a GameState in it."""
    root = str(tmp_path / name)
    os.environ["MATH_LIBRARY_DIR"] = root  # absolute: os.path.join keeps it as is
    from game_config import GameConfig
    import gamestate as g

    return root, g.GameState(GameConfig())


def test_direct_books_writes_what_create_books_writes(tmp_path):
    previous = os.environ.get("MATH_LIBRARY_DIR")
    try:
        from src.state.run_sims import create_books
        import direct_books
        import gamestate as g

        reference_root, reference = _library(tmp_path, "reference")
        create_books(reference, reference.config, dict(MODES), 50_000, 1, True, False)

        direct_root, direct = _library(tmp_path, "direct")
        g.build_deal_cache(os.path.join(direct_root, g.DEAL_FILE), max(MODES.values()))
        direct_books.write_all_books(direct, dict(MODES), 1, 50_000, workers=1)

        compared = []
        for mode in MODES:
            for folder, pattern in PER_MODE:
                rel = os.path.join(folder, pattern.format(mode))
                a = os.path.join(reference_root, rel)
                b = os.path.join(direct_root, rel)
                assert os.path.exists(a), f"reference did not write {rel}"
                assert os.path.exists(b), f"direct_books did not write {rel}"
                assert filecmp.cmp(a, b, shallow=False), f"{rel} differs"
                compared.append(rel)
        rel = os.path.join("forces", "force.json")
        assert filecmp.cmp(os.path.join(reference_root, rel), os.path.join(direct_root, rel), shallow=False)
        assert len(compared) == len(MODES) * len(PER_MODE)
    finally:
        if previous is None:
            os.environ.pop("MATH_LIBRARY_DIR", None)
        else:
            os.environ["MATH_LIBRARY_DIR"] = previous


def test_score_round_is_what_run_spin_records():
    """
    run_spin and direct_books share score_round; this pins that run_spin's
    events are score_round's reveals, field for field, so the two cannot
    quietly start disagreeing about what a round was.
    """
    import random

    from game_config import GameConfig
    import gamestate as g
    from src.wins.win_manager import WinManager

    gs = g.GameState(GameConfig())
    for mode in MODES:
        gs.betmode = mode
        for bm in gs.config.bet_modes:
            if bm.get_name() == mode:
                gs.config.wincap = bm.get_wincap()
        gs.win_manager = WinManager(gs.config.basegame_type, gs.config.freegame_type, gs.config.wincap)
        gs.library, gs.recorded_events, gs._payout_ints = {}, {}, []
        plan = gs._spin_plan()
        for sim in range(500):
            gs.criteria = "basegame"
            gs.run_spin(sim, sim)
            random.seed(sim + 1)
            deck = list(plan.deck.cards)
            random.shuffle(deck)
            reveals, win = gs.score_round(plan, deck[: plan.stages])
            events = gs.library[sim + 1]["events"]
            assert [
                (e["index"], e["card"]["rank"], e["card"]["suit"], e["choice"], e["correct"], e["payout"])
                for e in events[:-1]
            ] == [tuple(r) for r in reveals], f"{mode} round {sim}"
            assert events[-1]["amount"] == int(round(min(win, gs.config.wincap) * 100, 0))
