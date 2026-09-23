"""
Every bet mode's books, written straight from the shared deal.

WHY THIS EXISTS. The SDK builds a book one round at a time: reseed, shuffle,
play the round through a Book object and a win manager, check the totals with
asserts, JSON-encode it, write it to a per-worker temp file - and then merge
each mode's temp files by decompressing and recompressing them. For Ride The
Bus nearly all of that is the same work 193 times over: all 192 four-guess
modes deal the SAME cards for a given simulation index (run_spin seeds on it),
and what a round pays is a pure function of those cards and the mode's rules
(gamestate.score_round).

So this scores each mode directly against the deal and writes its files in one
pass. What it CANNOT skip is the output itself: the RGS needs a separate book
per mode, and every line carries that mode's choices, its correct/incorrect
flags and its payouts, which must agree with that mode's lookup table. 44
million lines still get written - just without the machinery around them:

  * the cards come from gamestate.DealCache (four-guess modes) or are dealt
    once for the mode by gamestate.deal_sims (Three of a Kind's own deck);
  * a round is priced and settled by gamestate.GameState.score_round - the
    SAME function run_spin calls, so the rules exist exactly once;
  * the JSON for a reveal, and for everything that follows the reveals, is
    rendered once per distinct value by the same encoder write_json uses, and
    reused - a mode has a few thousand distinct reveals across 800,000 rounds;
  * the book is compressed in one stream as it is written. zstd's output does
    not depend on how the input is chunked (checked against a published book
    at four chunk sizes), so one stream over the whole book is byte for byte
    what the SDK's decompress-and-recompress merge produced.

THE OUTPUT IS BYTE-IDENTICAL to create_books', file for file: the compressed
book, both lookup tables, the published _0 table when absent, the force record,
the verification sidecar, the per-mode event config, and force.json. That is
checked on every build for the first rounds of every mode and for every new
value it renders (see _Mode.check), and was checked in full - all 193 modes,
every file - against the 2026-09-22 build. games/ride_the_bus/tests holds it
there. RTB_DIRECT_BOOKS=0 in run.py goes back to create_books.
"""

from __future__ import annotations

import hashlib
import json
import os
import pickle
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

import zstandard as zstd

import gamestate as gs_module
from src.wins.win_manager import WinManager
from src.write_data.write_data import encode_book, get_sha_256

# How many rounds are assembled before a chunk is handed to the compressor and
# the table files. Bounds memory; has no effect on the bytes written.
CHUNK = 50_000
# Every line is rebuilt the slow way - a full book dict through the encoder -
# and compared, for this many rounds at the start of each mode.
CHECK_FIRST = 2_000

_STATES = {}  # this process's GameState per library folder, built once each


def _gamestate():
    """A GameState for the library this process is writing into.

    Keyed on the folder because the paths are fixed when a GameState is built,
    and a test writes into several libraries from one process."""
    from src.config.paths import library_dirname

    key = library_dirname()
    state = _STATES.get(key)
    if state is None:
        from game_config import GameConfig

        state = _STATES[key] = gs_module.GameState(GameConfig())
    return state


def _num_repeats(sims: int, threads: int, batch_size: int) -> int:
    """run_sims.py's own batching rule."""
    return max(int(round(sims / threads / batch_size, 0)), 1)


class _Mode:
    """One mode's rendering caches, and the self-check that keeps them honest."""

    def __init__(self, gamestate, mode: str, criteria: str):
        self.gs = gamestate
        self.mode = mode
        self.criteria = criteria
        self.plan = gamestate._spin_plan()
        self.reveal_json = {}
        self.tails = {}
        self.criteria_json = encode_book(criteria)

    def reveal(self, reveal: tuple) -> str:
        """The JSON of one reveal event, rendered once per distinct reveal."""
        text = self.reveal_json.get(reveal)
        if text is None:
            text = self.reveal_json[reveal] = encode_book(_reveal_event(*reveal))
        return text

    def tail(self, win: float):
        """
        Everything a round's line needs that depends only on what it paid.

        Settled by the SDK's own code - reset_book, the win manager,
        evaluate_finalwin, Book.to_json - so payoutMultiplier, the finalWin
        event and the two win totals are exactly what run_spin would record.
        """
        cached = self.tails.get(win)
        if cached is not None:
            return cached
        gs = self.gs
        gs.sim = 0
        gs.criteria = self.criteria
        gs.reset_book()
        gs.win_manager.update_spinwin(win)
        gs.win_manager.update_gametype_wins(gs.gametype)
        gs.evaluate_finalwin()
        book = gs.book.to_json()
        final = dict(book["events"][-1])
        final["index"] = self.plan.stages  # after the reveals, in a real book
        payout_int = book["payoutMultiplier"]
        base, free = book["baseGameWins"], book["freeGameWins"]
        cached = self.tails[win] = (
            payout_int,
            ', "payoutMultiplier": ' + str(payout_int) + ', "events": [',
            ", "
            + encode_book(final)
            + '], "criteria": '
            + self.criteria_json
            + ', "baseGameWins": '
            + encode_book(base)
            + ', "freeGameWins": '
            + encode_book(free)
            + "}",
            ",1," + str(payout_int) + "\n",
            "," + str(self.criteria) + "," + str(round(base, 2)) + "," + str(round(free, 2)) + "\n",
            final,
            base,
            free,
        )
        return cached

    def check(self, sim: int, reveals: list, win: float, line: str) -> None:
        """Rebuild this round's line the slow way and insist they agree."""
        payout_int, _head, _suffix, _lut, _seg, final, base, free = self.tail(win)
        book = {
            "id": sim,
            "payoutMultiplier": payout_int,
            "events": [_reveal_event(*r) for r in reveals] + [final],
            "criteria": self.criteria,
            "baseGameWins": base,
            "freeGameWins": free,
        }
        expected = encode_book(book)
        if line != expected:
            raise AssertionError(
                f"direct_books: {self.mode} round {sim} renders differently from its book dict:\n"
                f"  direct: {line[:200]}\n  book:   {expected[:200]}"
            )


def _reveal_event(stage_index, rank, suit, choice, correct, payout) -> dict:
    """run_spin's reveal event, field for field."""
    return {
        "index": stage_index,
        "type": gs_module._REVEAL,
        "stage": stage_index + 1,
        "card": {"rank": rank, "suit": suit},
        "choice": choice,
        "correct": correct,
        "payout": payout,
    }


def write_mode(job: dict) -> dict:
    """
    Score one mode against the deal and write every file create_books would.

    Runs in a pool worker. Returns what the parent reports, and the RTP the
    rounds produced before any reweighting (the figure the SDK's workers print
    as "Thread N finished with X RTP").
    """
    started = time.perf_counter()
    gs = _gamestate()
    mode, sims = job["mode"], job["sims"]
    gs.betmode = mode
    wincap = None
    for bm in gs.config.bet_modes:
        if bm.get_name() == mode:
            wincap = bm.get_wincap()
    gs.config.wincap = wincap  # what create_books sets before a mode, and what the tail reads
    # run_sims gives every slice a fresh win manager for the mode; the tails are
    # settled through it, so this mode gets one too.
    gs.win_manager = WinManager(gs.config.basegame_type, gs.config.freegame_type, wincap)

    m = _Mode(gs, mode, job["criteria"])
    plan = m.plan
    stages = plan.stages
    width = gs_module.DEAL_WIDTH
    deck = plan.deck.cards
    if plan.deals is not None and sims <= plan.deals.count:
        data = plan.deals.data
    else:
        # Three of a Kind's own deck, or no trusted cache: deal for this mode
        # alone, exactly as run_spin's cold path would.
        data = gs_module.deal_sims(deck, 0, sims)

    of = gs.output_files
    book_path = of.get_final_book_name(mode, True)
    lut_path = of.get_final_lookup_name(mode)
    seg_path = of.get_final_segmented_name(mode)
    score_round = gs.score_round
    score_stage = gs.score_stage
    settle_round = gs.settle_round
    rank_values = gs_module._RANK_VALUES
    round_start = gs_module.ROUND_START
    last = stages - 1
    reveal = m.reveal
    tail = m.tail
    # THE STAGE MEMO. A stage's result depends only on the cards turned up to
    # and including it (score_stage), and there are far fewer of those than
    # rounds: 52 first cards, 2,652 first pairs, 132,600 first triples against
    # up to 800,000 rounds. So every stage but the last is remembered by the
    # cards so far - its reveal, the state it leaves, and the reveal's JSON -
    # and only the last card of a round is worked out fresh. Keyed on a slice
    # of the deal's bytes, which is cheap to hash. Per mode: the plan differs.
    memo = {}
    payout_ints = []
    total_win = 0.0

    # The per-mode event config: one example of each event type, taken where
    # the SDK's last worker to finish always took it - the first round of the
    # mode's final slice (see the module note in run.py / CLAUDE.md).
    repeats = _num_repeats(sims, job["threads"], job["batch_size"])
    sample_sim = sims - sims // job["threads"] // repeats

    with open(book_path, "wb") as book_file, open(lut_path, "w", encoding="UTF-8") as lut, open(
        seg_path, "w", encoding="UTF-8"
    ) as seg:
        with zstd.ZstdCompressor().stream_writer(book_file, closefd=False) as writer:
            for chunk_start in range(0, sims, CHUNK):
                chunk_stop = min(chunk_start + CHUNK, sims)
                lines = []
                lut_rows = []
                seg_rows = []
                for sim in range(chunk_start, chunk_stop):
                    i = sim * width
                    cards = data[i : i + stages]
                    drawn = [deck[b] for b in cards]
                    drawn_ranks = [rank_values[rank] for rank, _suit in drawn]
                    state = round_start
                    reveals = []
                    texts = []
                    for k in range(last):
                        key = cards[: k + 1]
                        hit = memo.get(key)
                        if hit is None:
                            stage_reveal, stage_state = score_stage(plan, drawn, drawn_ranks, k, state)
                            hit = memo[key] = (stage_reveal, stage_state, reveal(stage_reveal))
                        reveals.append(hit[0])
                        state = hit[1]
                        texts.append(hit[2])
                    stage_reveal, state = score_stage(plan, drawn, drawn_ranks, last, state)
                    reveals.append(stage_reveal)
                    texts.append(reveal(stage_reveal))
                    win = settle_round(plan, state)
                    payout_int, head, suffix, lut_tail, seg_tail = tail(win)[:5]
                    sid = str(sim)
                    line = '{"id": ' + sid + head + ", ".join(texts) + suffix
                    if sim < CHECK_FIRST:
                        # The memo against the plain path, then the rendering
                        # against the book dict - both on every build.
                        if (reveals, win) != tuple(score_round(plan, drawn)):
                            raise AssertionError(f"direct_books: {mode} round {sim}: stage memo disagrees")
                        m.check(sim, reveals, win, line)
                    if sim == sample_sim:
                        event_config = _event_config(reveals, tail(win)[5])
                    lines.append(line)
                    lut_rows.append(sid + lut_tail)
                    seg_rows.append(sid + seg_tail)
                    payout_ints.append(payout_int)
                    total_win += win
                writer.write(("\n".join(lines) + "\n").encode("UTF-8"))
                lut.write("".join(lut_rows))
                seg.write("".join(seg_rows))

    # Every new tail value was settled by the SDK's code; now make sure each
    # one also RENDERS as the book dict would, not just the first rounds'.
    for win in list(m.tails):
        m.check(-1, [], win, '{"id": -1' + m.tails[win][1] + m.tails[win][2][2:])

    optimized = of.get_optimized_lookup_name(mode)
    if not os.path.exists(optimized):
        # create_books writes the raw weight-1 table as _0 when there is none;
        # reweight_luts then rewrites it either way.
        with open(lut_path, "rb") as src, open(optimized, "wb") as dst:
            dst.write(src.read())

    force_record = os.path.join(of.force_path, f"force_record_{mode}.json")
    with open(force_record, "w", encoding="UTF-8") as fh:
        fh.write(json.dumps([], indent=4))  # this game records no force keys

    with open(os.path.join(of.config_path, f"event_config_{mode}.json"), "w", encoding="UTF-8") as fh:
        fh.write(json.dumps(event_config, indent=4))

    verification = {
        "payout_hash": hashlib.md5(pickle.dumps(payout_ints)).hexdigest(),
        "file_hash": get_sha_256(book_path),
        "num_entries": len(payout_ints),
    }
    verification_path = os.path.join(of.config_path, f"books_{mode}.verification.json")
    with open(verification_path, "w", encoding="UTF-8") as fh:
        json.dump(verification, fh, indent=2)

    return {
        "mode": mode,
        "sims": sims,
        "rtp": total_win / (sims * plan.cost),
        "seconds": time.perf_counter() - started,
        "verification": verification_path,
        "distinct_reveals": len(m.reveal_json),
        "distinct_payouts": len(m.tails),
        "pid": os.getpid(),
    }


def _event_config(reveals: list, final: dict) -> dict:
    """write_library_events' output for one round: one example per event type."""
    items = {}
    for event in [_reveal_event(*r) for r in reveals] + [final]:
        if event["type"] not in items:
            items[event["type"]] = {k: v for k, v in event.items() if k != "index"}
    return items


def write_all_books(
    gamestate, num_sim_args: dict, threads: int, batch_size: int, on_mode=None, workers=None, on_start=None
) -> float:
    """
    Every mode's files, across `workers` processes (default `threads`). Returns
    the wall time.

    `threads` and `batch_size` are run.py's settings for create_books, and are
    used for ONE thing: the event config samples the first round of the slice
    create_books' last worker would have had, so it depends on how create_books
    WOULD have split the mode - not on how many processes this uses.

    Largest modes first, so the pool is not left waiting on one 800,000-round
    mode at the end. Results arrive in whatever order the workers finish, and
    each mode's files are its own - except force.json, which every mode adds a
    key to, and whose key order is the order they were added. That is written
    once at the end, in build order, exactly as a serial build would leave it.
    """
    started = time.perf_counter()
    criteria = "basegame"
    jobs = [
        {"mode": mode, "sims": sims, "criteria": criteria, "threads": threads, "batch_size": batch_size}
        for mode, sims in num_sim_args.items()
        if sims > 0
    ]
    order = sorted(jobs, key=lambda job: -job["sims"])
    done = 0
    workers = threads if workers is None else workers
    if workers > 1 and len(jobs) > 1:
        with ProcessPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(write_mode, job): job for job in order}
            # The pool hands jobs out in submission order, one per free
            # worker, so which mode starts when is known without asking: the
            # first `workers` now, then the next each time one finishes. That
            # is what drives the monitor's worker strip. `slot` is a worker
            # position 0..workers-1, reused as modes finish.
            free = list(range(min(workers, len(order))))
            slots = {}
            handed_out = 0
            for job in order[: len(free)]:
                slots[job["mode"]] = free.pop(0)
                handed_out += 1
                if on_start is not None:
                    on_start(job, slots[job["mode"]])
            for future in as_completed(futures):
                result = future.result()
                done += 1
                slot = slots.pop(result["mode"])
                result["slot"] = slot
                if on_mode is not None:
                    on_mode(done, len(jobs), result)
                if handed_out < len(order):
                    job = order[handed_out]
                    handed_out += 1
                    slots[job["mode"]] = slot
                    if on_start is not None:
                        on_start(job, slot)
    else:
        for job in order:
            if on_start is not None:
                on_start(job, 0)
            result = write_mode(job)
            result["slot"] = 0
            done += 1
            if on_mode is not None:
                on_mode(done, len(jobs), result)

    force_path = os.path.join(gamestate.output_files.force_path, "force.json")
    try:
        with open(force_path, "r", encoding="UTF-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        data = {}
    for job in jobs:
        data[job["mode"]] = {}  # get_force_options({}) - this game records no force keys
    with open(force_path, "w", encoding="UTF-8") as fh:
        fh.write(json.dumps(data, indent=4))
    return time.perf_counter() - started
