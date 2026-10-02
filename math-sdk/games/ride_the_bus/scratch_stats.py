"""
A scratch build's figures, beside the exact model's.

An RTB_ONLY_MODES build (run.py, into library_test/) stops before publish: it
writes the books and the raw lookup tables and nothing else, because a partial
set has nothing to verify against. That leaves the one question a scratch
build is FOR - does the new shape come out of the real simulator the way the
model said? - unanswerable without the rest of the pipeline. This is the rest,
for just those modes, inside the scratch folder: reweight_luts' own reweight
(ticket tier included), then Stake's figures read off the reweighted table
with the SDK's definitions, and the model's exact figures alongside.

It never touches library/.

    .venv/Scripts/python.exe games/ride_the_bus/scratch_stats.py [library_test]
"""

from __future__ import annotations

import csv
import glob
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SDK = os.path.abspath(os.path.join(HERE, os.pardir, os.pardir))
for _path in (SDK, HERE):
    if _path not in sys.path:
        sys.path.insert(0, _path)

import model_families  # noqa: E402
from game_calculations import MODE_FAMILIES, family_of  # noqa: E402
from reweight_luts import reweight_all  # noqa: E402


def table_figures(path: str, cost: float) -> dict:
    """std, etl40b, CVaR, max and hit rates off one published _0 table."""
    rows = []
    with open(path, newline="", encoding="UTF-8") as fh:
        for _sim, weight, payout in csv.reader(fh):
            rows.append((int(payout) / 100, int(weight)))
    total = sum(w for _x, w in rows)
    dist = {}
    for x, w in rows:
        dist[x] = dist.get(x, 0) + w / total
    mean = sum(p * x for x, p in dist.items())
    ordered = sorted(dist.items())
    cumulative, tail_start = 0.0, ordered[0][0]
    for x, p in ordered:
        cumulative += p
        if cumulative >= 0.999:
            tail_start = x
            break
    tail = [(x, p) for x, p in ordered if x >= tail_start]
    ceiling = ordered[-1][0]
    return {
        "rtp": mean / cost,
        "std": math.sqrt(sum(p * (x - mean) ** 2 for x, p in dist.items())),
        "etl40b": sum(p * x for x, p in dist.items() if x >= 40 * cost),
        "cvar": sum(p * x for x, p in tail) / sum(p for _x, p in tail),
        "max": ceiling,
        "max_1_in": 1 / dist[ceiling],
        "non_zero_1_in": 1 / (1 - dist.get(0.0, 0.0)),
    }


def main(library: str = "library_test") -> None:
    from game_config import GameConfig

    folder = os.path.join(HERE, library)
    pattern = os.path.join(folder, "lookup_tables", "lookUpTableSegmented_*.csv")
    modes = sorted(os.path.basename(p)[len("lookUpTableSegmented_") : -len(".csv")] for p in glob.glob(pattern))
    if not modes:
        raise SystemExit(f"no scratch build in {folder} - run RTB_ONLY_MODES=<mode>[,...] first")
    print(f"Reweighting {len(modes)} scratch mode(s) in {library}/ ...")
    results = {r["mode"]: r for r in reweight_all(HERE, GameConfig().rtp, library=library, modes=set(modes))}
    for mode in modes:
        cost = MODE_FAMILIES[family_of(mode)]["cost"]
        built = table_figures(os.path.join(folder, "publish_files", f"lookUpTable_{mode}_0.csv"), cost)
        exact = model_families.figures(mode)
        print(f"\n{mode}   RTP {built['rtp'] * 100:.4f}%")
        for field, fmt in (("std", ".3f"), ("etl40b", ".4f"), ("cvar", ".1f"), ("max", ".1f"), ("non_zero_1_in", ".3f")):
            b, e = built[field], exact[field]
            delta = f"{(b / e - 1) * 100:+.1f}%" if e else ""
            print(f"  {field:14} built {b:>10{fmt}}   exact {e:>10{fmt}}   {delta}")
        print(f"  {'max hit':14} built 1 in {built['max_1_in']:,.0f}   exact 1 in {exact['max_1_in']:,.0f}")
        shares = results[mode].get("ticket_shares")
        if shares:
            laid = ", ".join(f"{value}x {share * 100:.3f}%" for value, share in shares.items())
            print(f"  {'ticket shares':14} {laid}   (stack: 50 / 25 / 15 / 10)")
            print(f"  {'ticket':14} built 1 in {results[mode]['ticket_1_in']:,.1f}   exact 1 in {exact['sweep_1_in']:,.1f}")
        print(f"  {'smallest chip':14} exact {exact['min_chip']:.4f} (a right guess never shows under 1x)")


if __name__ == "__main__":
    main(*(sys.argv[1:2] or []))
