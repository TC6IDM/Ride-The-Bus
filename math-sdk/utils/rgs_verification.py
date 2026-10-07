"""
Verify lookup-tale and book result format
Output statistics tested via RGS
"""

import json
import os
import warnings
import argparse
import importlib
from concurrent.futures import ProcessPoolExecutor, as_completed
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from itertools import combinations
from io import TextIOWrapper
import numpy as np
import zstandard as zst
import hashlib
import pickle
from utils.analysis.distribution_functions import (
    make_win_distribution,
    get_distribution_moments,
    get_distribution_average,
    non_zero_hitrate,
    prob_less_than_bet,
    get_prob_no_win,
    get_maxwin_hitrate,
    get_distribution_median,
    min_dist_difference,
    calculate_rtp,
    get_etl_cvar_p5k_10k_vales,
)
from src.write_data.write_data import get_sha_256


class WinStatistics:
    """Statistics tested upon RGS upload"""

    def __init__(
        self,
        win_distribution=None,
        num_events=None,
        weight_range=None,
        min_win=None,
        max_win=None,
        min_diff=None,
        unique_wins=None,
        average_wins=None,
        rtp=None,
        std=None,
        var=None,
        m2m=None,
        hr_max=None,
        non_zero_hr=None,
        prob_nil=None,
        prob_less_bet=None,
        num_non_zero_payouts=None,
        skew=None,
        excess_kurtosis=None,
        prob5k=None,
        prob10k=None,
        etl40b=None,
        etl10k=None,
        cvar=None,
    ):
        self.win_distribution = win_distribution
        self.num_events = num_events
        self.weight_range = weight_range
        self.min_win = min_win
        self.max_win = max_win
        self.min_diff = min_diff
        self.unique_wins = unique_wins
        self.average_win = average_wins
        self.rtp = rtp
        self.std = std
        self.var = var
        self.m2m = m2m
        self.hr_max = hr_max
        self.non_zero_hr = non_zero_hr
        self.prob_nil = prob_nil
        self.num_non_zero_payouts = num_non_zero_payouts
        self.prob_less_bet = prob_less_bet
        self.skew = skew
        self.excess_kurtosis = excess_kurtosis
        self.prob5k = prob5k
        self.prob10k = prob10k
        self.etl40b = etl40b
        self.etl10k = etl10k
        self.cvar = cvar

    def to_dict(self):
        map_object = {}
        for item in self.__dict__.keys():
            if item is not None:
                if isinstance(getattr(self, item), float):
                    map_object[item] = round(getattr(self, item), 3)
                else:
                    map_object[item] = getattr(self, item)
        return map_object


def verify_lookup_format(filename: str) -> list:
    "Duplicate RGS verification before upload."
    integer_payouts = []
    running_weight_total = 0
    min_win, max_win = None, None
    win_distribution = make_win_distribution(filename)

    with open(filename, "r", encoding="UTF-8") as f:
        for line in f:
            _, weight, payout = line.strip().split(",")
            weight = float(weight)
            payout = float(payout)

            # Payout checks
            assert payout.is_integer() and payout >= 0, "Payout mult be uint64 format:"
            if payout > 0:
                assert payout >= 10, "Minimum non-zero payout is 10 (RGS accepts 'cents' increments)."
            assert payout % 10 == 0, "Payout values must be in increments of 10."
            integer_payouts.append(int(payout))

            if (min_win is None) or (payout < min_win):
                min_win = payout
            if (max_win is None) or (payout > max_win):
                max_win = payout
            # Weight checks
            assert weight.is_integer() and weight >= 0, "Weight must be uint64 format."
            running_weight_total += weight

    assert running_weight_total <= np.iinfo(np.uint64).max, "Sum of weights must be <= MAX(uint64)"

    return win_distribution, integer_payouts, running_weight_total, min_win, max_win


# payout mult value match to lut + length match
def verify_books_and_payout_mults(books_filename: str) -> list:
    """Ensure the values written to the books match those in the lookup table exactly."""
    assert str(books_filename).endswith(".jsonl.zstd") or str(books_filename).endswith(
        "jsonl.zst"
    ), "Verification is only run for compressed book files of format .jsonl.zst."

    book_payout_ints = []
    total_num_events = 0
    with open(books_filename, "rb") as f:
        decompressor = zst.ZstdDecompressor()
        with decompressor.stream_reader(f) as reader:
            txt_stream = TextIOWrapper(reader, encoding="UTF-8")
            for line in txt_stream:
                line = line.strip()
                if not line:
                    continue

                try:
                    blob = json.loads(line)
                except json.JSONDecodeError:
                    raise RuntimeError("Invalid JSON format.")

                for key in ["payoutMultiplier", "id", "events"]:
                    if key not in blob:
                        raise RuntimeError(f"Missing required key: {key}")

                total_num_events += len(blob["events"])
                book_payout_ints.append(blob["payoutMultiplier"])

    return book_payout_ints, total_num_events


def compare_payout_values(book_int_payouts, lut_int_payouts) -> None:
    """Ensure payout multiplier values match between books and lookup tables."""
    book_ints = pickle.dumps(book_int_payouts)
    lut_ints = pickle.dumps(lut_int_payouts)
    assert hashlib.md5(book_ints).hexdigest() == hashlib.md5(lut_ints).hexdigest(), "Mismatch in payout array."


def get_num_non_zero_payouts(book_int_payouts) -> None:
    """Count non-zero payouts"""
    return len([p for p in book_int_payouts if p > 0])


def verify_mode_volatility(name: str, MathStats: object, bet_cost: float = 1.0) -> dict:
    """Check math betlevel volatility limits. Returns dict of violated attributes.

    Every limit in the table below is read PER STAKE except `cvar`, which
    `conditional_value_at_risk` returns in raw base-bet multiples - it is the
    one statistic in this file that is never divided by the bet cost. On a 1x
    mode the two readings are the same number and the difference never shows;
    on a mode that costs 250x they differ by a factor of 250, and a limit
    written for a 1x mode fires on a mode nowhere near it.

    Ride The Bus's `tr_any_equal_equal` is that mode: it costs 250x and pays
    4583.3x the BASE bet, which is 18.3x its own stake. It was reported here as
    "VIOLATED: cvar VALUE:4583.3 --- LIMIT: 800" on every build while Stake's
    own console passed the same file, because the RGS reads BOTH rows - the
    per-stake figure against this limit, and the raw one against an absolute
    ceiling (20,000 at 2 star, 50,000 at 3 star) that bounds operator
    liability so a high-cost mode cannot hide a large tail behind its stake.
    Both are checked now, each against the limit written for it; the warning
    was the verifier's, not the mode's, and silencing it by tuning the mode
    would have been the wrong repair (see THE ALL-OR-NOTHING BOUND in
    games/ride_the_bus/game_calculations.py).
    """
    mode_limits = {"prob5k": 1e-2, "prob10k": 0.5e-2, "etl40b": 0.9, "etl10k": 0.8, "cvar": 800, "rtp": 0.967}
    # Figures the RGS also reads un-normalised, with the ceiling for that read.
    absolute_limits = {"cvar": 50000}
    cost = bet_cost if bet_cost else 1.0
    violated_attributes = {}
    reported_limits = {}

    for key, limit in mode_limits.items():
        val = getattr(MathStats, key, None)
        if val is None:
            continue
        if key in absolute_limits:
            if val > absolute_limits[key]:
                violated_attributes[key], reported_limits[key] = val, absolute_limits[key]
            elif val / cost > limit:
                violated_attributes[key], reported_limits[key] = val / cost, limit
        elif val > limit:
            violated_attributes[key], reported_limits[key] = val, limit

    if violated_attributes:
        warnings.warn(f"\nMode [{name}] fails 3-star volatility limits:\n")
        for key, val in violated_attributes.items():
            print(f"\tVIOLATED: {key}  VALUE:{round(val, 4)} --- LIMIT: {reported_limits[key]}")
        print("\n\n")
    return violated_attributes


def get_lut_statistics(
    name, win_distribution, bet_cost, unique_payouts, weight_range, min_win, max_win, num_events
) -> object:
    """Run RGS statistic tests for upload verification."""

    var, std, skew, kurtosis = get_distribution_moments(win_distribution, bet_cost)
    p5k, p10k, etl10k, etl40, cvarp01 = get_etl_cvar_p5k_10k_vales(
        win_distribution, bet_cost, sum(list(win_distribution.values()))
    )
    MathStats = WinStatistics(
        win_distribution=win_distribution,
        num_events=num_events,
        weight_range=weight_range,
        min_win=min_win,
        max_win=max_win,
        min_diff=min_dist_difference(win_distribution),
        unique_wins=unique_payouts,
        average_wins=float(get_distribution_average(win_distribution)),
        rtp=calculate_rtp(win_distribution, bet_cost, weight_range),
        std=std,
        var=var,
        hr_max=get_maxwin_hitrate(win_distribution, weight_range),
        non_zero_hr=non_zero_hitrate(win_distribution, weight_range),
        prob_nil=get_prob_no_win(win_distribution, weight_range),
        prob_less_bet=prob_less_than_bet(win_distribution, bet_cost, weight_range),
        num_non_zero_payouts=get_num_non_zero_payouts(unique_payouts),
        skew=skew,
        excess_kurtosis=kurtosis,
        prob5k=p5k,
        prob10k=p10k,
        etl40b=etl40,
        etl10k=etl10k,
        cvar=cvarp01,
    )
    median = get_distribution_median(win_distribution, weight_range)

    if median > 0:
        m2m = MathStats.average_win / median
        MathStats.m2m = m2m
    else:
        MathStats.m2m = 0

    verify_mode_volatility(name, MathStats, bet_cost)
    return MathStats


def verify_one_mode(job: dict) -> object:
    """
    Verify ONE published mode and return its statistics.

    Split out of execute_all_tests so it can run in a process pool: a mode's
    books, lookup table and sidecar are its own files, and the expensive parts
    - a SHA-256 over the whole compressed book and a pass over an 800k-row
    table - are pure CPU with nothing shared. The work and the assertions are
    unchanged; only where they run is.
    """
    name, cost = job["name"], job["cost"]
    book_file = os.path.join(job["publish_path"], f"books_{name}.jsonl.zst")
    lut_file = os.path.join(job["publish_path"], f"lookUpTable_{name}_0.csv")

    if not (os.path.exists(book_file)) or not (os.path.exists(lut_file)):
        raise RuntimeError(f"Books/Lookup file does not exist for {name}.")

    win_dist, lut_payouts, weights_range, min_win, max_win = verify_lookup_format(lut_file)
    # Fast path: use verification.json sidecar if available
    verification_file = os.path.join(os.path.join(job["library_path"], "configs"), f"books_{name}.verification.json")
    if os.path.exists(verification_file):
        print(f"[FAST PATH] Using verification sidecar for {name}")
        with open(verification_file, "r", encoding="UTF-8") as vf:
            verification = json.load(vf)

        actual_hash = get_sha_256(book_file)
        assert actual_hash == verification["file_hash"], f"Book file SHA-256 mismatch for {name}! File may be corrupted."

        lut_payout_hash = hashlib.md5(pickle.dumps(lut_payouts)).hexdigest()
        assert (
            lut_payout_hash == verification["payout_hash"]
        ), f"Payout hash mismatch for {name}! Book payouts != LUT payouts."

        assert verification["num_entries"] == len(
            lut_payouts
        ), f"Entry count mismatch for {name}: sidecar={verification['num_entries']} vs LUT={len(lut_payouts)}"

        num_events = 0
        print(f"[FAST PATH] {name}: SHA-256 OK, payout hash OK, entries={verification['num_entries']}")
    else:
        print(f"[FALLBACK] No verification sidecar for {name}, reading books...")
        book_payouts, num_events = verify_books_and_payout_mults(book_file)
        compare_payout_values(book_payouts, lut_payouts)

    StatsObject = get_lut_statistics(name, win_dist, cost, lut_payouts, weights_range, min_win, max_win, num_events)
    setattr(StatsObject, "name", name)
    return StatsObject


def _verify_one_mode_captured(job: dict):
    """
    verify_one_mode with its output collected rather than printed.

    Workers share one stdout, and two processes printing a line each at the
    same moment interleave them. The parent prints what comes back, whole, so
    a "[FAST PATH] ..." line still arrives as a line - which the build monitor
    depends on to fill in each mode's box. Warnings go through the same buffer
    IN ORDER, because "Mode [x] fails" and the "VIOLATED:" line under it are
    read as a pair.
    """
    buffer = StringIO()

    def _show(message, category, filename, lineno, file=None, line=None):
        print(f"{os.path.basename(filename)}:{lineno}: {category.__name__}: {message}")

    previous = warnings.showwarning
    warnings.showwarning = _show
    try:
        with redirect_stdout(buffer), redirect_stderr(buffer):
            stats = verify_one_mode(job)
    finally:
        warnings.showwarning = previous
    return job["name"], stats, buffer.getvalue()


def execute_all_tests(config, excluded_modes=[], workers: int = 1):
    """Run all tests for a given game.

    `workers` > 1 verifies the modes across that many processes. The order of
    the statistics written at the end is the mode order either way, so the
    stats_summary.json a parallel run produces is byte-identical to a serial
    one's.
    """
    jobs = [
        {
            "name": bet_mode.get_name(),
            "cost": bet_mode.get_cost(),
            "publish_path": config.publish_path,
            "library_path": config.library_path,
        }
        for bet_mode in config.bet_modes
        if bet_mode.get_name() not in excluded_modes
    ]
    order = {job["name"]: index for index, job in enumerate(jobs)}
    mode_stats = []
    mode_rtps = []

    if workers and workers > 1 and len(jobs) > 1:
        print(f"Verifying {len(jobs)} modes across {workers} workers...")
        with ProcessPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_verify_one_mode_captured, job) for job in jobs]
            for done, future in enumerate(as_completed(futures), start=1):
                _name, StatsObject, output = future.result()
                if output:
                    print(output, end="", flush=True)
                mode_rtps.append(StatsObject.rtp)
                mode_stats.append(StatsObject)
                if done % 25 == 0 or done == len(jobs):
                    print(f"  verified {done}/{len(jobs)} modes", flush=True)
        mode_stats.sort(key=lambda stats: order[stats.name])
    else:
        for job in jobs:
            StatsObject = verify_one_mode(job)
            mode_rtps.append(StatsObject.rtp)
            mode_stats.append(StatsObject)

    if len(mode_rtps) > 1:
        max_rtp_diff = max(abs(a - b) for a, b in combinations(mode_rtps, 2))
        if max_rtp_diff > 0.05:
            warnings.warn(f"\n\nMode RTP difference exceedes allowed difference for approvals: {max_rtp_diff}\n")

    fname = f"games/{config.game_id}/library/stats_summary.json"
    write_all_stats(mode_stats, fname)


def write_all_stats(StatsList: object, filename: str) -> None:
    """Write all stats to JSON file."""
    all_stats = {}
    for Stats in StatsList:
        all_stats[Stats.name] = Stats.to_dict()
        # Don't print unique wins/distribution for brevity.
        del all_stats[Stats.name]["win_distribution"]
        del all_stats[Stats.name]["unique_wins"]

    with open(filename, "w", encoding="UTF-8") as f:
        f.write(json.dumps(all_stats, indent=4))


def load_game_config(game_id: str):
    """Load game config class"""
    module_path = f"games.{game_id}.game_config"
    module = importlib.import_module(module_path)
    config = getattr(module, "GameConfig")

    return config()


def main():
    """parse commandline arguments"""
    parser = argparse.ArgumentParser()
    parser.add_argument("-g", dest="games", nargs="+")
    arguments = parser.parse_args()
    for game_id in arguments.games:
        game_config = load_game_config(game_id)
        execute_all_tests(game_config)


if __name__ == "__main__":

    main()
