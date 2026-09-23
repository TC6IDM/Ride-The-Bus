"""
The shared deal must be the deal every mode would have dealt for itself.

run_spin reads a four-guess round's cards from gamestate.DealCache instead of
reseeding and shuffling, because all 192 four-guess modes deal identical cards
for the same simulation index. That is only acceptable if the cache's cards
are EXACTLY the cards a cold run_spin would deal - and only safe if a cache
that is wrong, stale, truncated or from another interpreter is refused rather
than used. These tests hold it to both.

    .venv/Scripts/python.exe -m pytest games/ride_the_bus/tests -q
"""

import json
import os
import random
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
SDK = os.path.abspath(os.path.join(GAME, os.pardir, os.pardir))
for path in (SDK, GAME):
    if path not in sys.path:
        sys.path.insert(0, path)

import gamestate as g  # noqa: E402

COUNT = 20_000


def _build(tmp_path, count=COUNT, workers=1):
    path = os.path.join(str(tmp_path), g.DEAL_FILE)
    return path, g.build_deal_cache(path, count, workers=workers)


def _cold_deal(sim, stages=4):
    """What run_spin deals with no cache: reseed on the index, shuffle."""
    random.seed(sim + 1)
    deck = list(g.standard_deck())
    random.shuffle(deck)  # the stdlib's own shuffle, not ours
    return deck[:stages]


def test_every_cached_deal_is_the_cold_deal(tmp_path):
    _path, cache = _build(tmp_path)
    for sim in range(COUNT):
        assert cache.drawn(sim, 4) == _cold_deal(sim), f"sim {sim}"


def test_a_parallel_build_writes_the_same_bytes(tmp_path):
    serial_dir = tmp_path / "serial"
    parallel_dir = tmp_path / "parallel"
    serial_dir.mkdir()
    parallel_dir.mkdir()
    serial_path, _ = _build(serial_dir, workers=1)
    parallel_path, _ = _build(parallel_dir, workers=4)
    with open(serial_path, "rb") as a, open(parallel_path, "rb") as b:
        assert a.read() == b.read()


def test_simulation_zero_is_the_published_book(tmp_path):
    # Read out of books_*.jsonl.zst for id 0 in every four-guess mode of the
    # 2026-09-22 build, independently of this code.
    _path, cache = _build(tmp_path, count=1)
    assert cache.drawn(0, 4) == [("J", "♠"), ("10", "♥"), ("Q", "♣"), ("10", "♦")]


def test_a_good_cache_loads(tmp_path):
    path, _ = _build(tmp_path)
    loaded = g.load_deal_cache(path, need=COUNT)
    assert loaded is not None
    assert loaded.drawn(1234, 4) == _cold_deal(1234)


def _rewrite(path, header_edit=None, data_edit=None):
    with open(path, "rb") as fh:
        magic = fh.read(len(g._DEAL_MAGIC))
        (length,) = struct.unpack("<I", fh.read(4))
        header = json.loads(fh.read(length))
        data = fh.read()
    if header_edit:
        header_edit(header)
    if data_edit:
        data = data_edit(data)
    blob = json.dumps(header).encode("utf-8")
    with open(path, "wb") as fh:
        fh.write(magic + struct.pack("<I", len(blob)) + blob + data)


def test_the_loader_refuses_what_it_cannot_trust(tmp_path):
    cases = {
        "too few deals for this build": dict(),
        "another interpreter": dict(header_edit=lambda h: h.update(python="3.13.0 (elsewhere)")),
        "a different deck order": dict(header_edit=lambda h: h["deck"].reverse()),
        "a different seeding rule": dict(header_edit=lambda h: h.update(rule="something else")),
        "one flipped card": dict(data_edit=lambda d: d[:100] + bytes([(d[100] + 1) % 52]) + d[101:]),
        "truncated": dict(data_edit=lambda d: d[:-4]),
        # Right checksum for WRONG cards: only the spot re-deal can catch it.
        "wrong cards, honest checksum": dict(
            data_edit=lambda d: bytes((b + 1) % 52 for b in d),
        ),
    }
    for label, edits in cases.items():
        case_dir = tmp_path / label.replace(" ", "_").replace(",", "")
        case_dir.mkdir()
        path, _ = _build(case_dir)
        if label == "too few deals for this build":
            assert g.load_deal_cache(path, need=COUNT + 1) is None, label
            continue
        _rewrite(path, **edits)
        if label == "wrong cards, honest checksum":
            import hashlib

            _rewrite(
                path,
                header_edit=lambda h: h.update(sha256=hashlib.sha256(_data(path)).hexdigest()),
            )
        assert g.load_deal_cache(path) is None, label
    assert g.load_deal_cache(str(tmp_path / "missing.bin")) is None


def _data(path):
    with open(path, "rb") as fh:
        fh.read(len(g._DEAL_MAGIC))
        (length,) = struct.unpack("<I", fh.read(4))
        fh.read(length)
        return fh.read()


def test_loading_leaves_the_rng_alone(tmp_path):
    path, _ = _build(tmp_path)
    random.seed(7)
    before = random.getstate()
    g.load_deal_cache(path)
    assert random.getstate() == before
