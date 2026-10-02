"""
Exact figures for every published mode, from the game's own rules - no sampling.

WHY THIS EXISTS. A family's shape is decided before anyone spends forty minutes
on a build, and the figures that decide it - std, etl40b, CVaR, the ceiling, the
smallest chip a right guess can show - were twice worked out by an enumerator
that was never saved. Last Stop's first design was modelled that way, parked,
and when it came back the only record of how its figures were reached was the
figures. This is that enumerator, kept, and pinned by tests/test_model.py to the
build it has to agree with.

HOW. Every ordered deal of the cards that matter goes through
GameState.score_stage and settle_round - the SAME functions the build prices
and settles with - so this models the rules, not a copy of them:

  * a round stops the moment it busts: nothing after a bust changes its pay;
  * the LAST card is not dealt one by one. Its price depends only on the cards
    before it, so it splits into two branches, right and wrong, each weighted
    by how many of the cards left land it;
  * a Last Stop clean sweep then splits once per ticket value, at the stack's
    exact odds (the reweight makes the published tables say the same).

What comes out is each mode's exact payout distribution. reweighted() applies
what reweight_luts.py does to a published table - wins scaled by one factor,
losses by another, RTP exactly config.rtp - and figures() reads Stake's numbers
off the result with the SDK's own definitions (utils/analysis/
distribution_functions.py): std, etl40b (the sum of p*x over x >= 40x cost),
CVaR (the mean payout from the 99.9th percentile up), P(>= 5,000x).

A sampled build differs from these by sampling alone. Its family worst cases
land within a few percent (High Stakes: etl40b 0.764 exact against 0.769
built, std 38.2 against 38.4, CVaR 618 against 639 - the build runs hot on the
tail, as it always has), and no published maximum can exceed the exact one.

Run from math-sdk/:

    .venv/Scripts/python.exe games/ride_the_bus/model_families.py [family ...] [--ladder] [--check]

  --ladder  draft win-tier bands solved to Classic's rarities (winTiers.ts)
  --check   compare with library/stats_summary.json, where the build has the mode
"""

from __future__ import annotations

import json
import math
import os
import sys
from bisect import bisect_left
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
SDK = os.path.abspath(os.path.join(HERE, os.pardir, os.pardir))
for _path in (SDK, HERE):
    if _path not in sys.path:
        sys.path.insert(0, _path)

from game_calculations import (  # noqa: E402
    _RANK_VALUES,
    MODE_FAMILIES,
    all_mode_combinations,
    mode_name,
    ordered_families,
)

# Classic's rarities, which every ladder family's bands are solved to land on
# (winTiers.ts). One in N, for Big / Huge / Mega / Epic.
TARGET_ONE_IN = (70, 305, 3093, 15561)

_STATE = None


def _gamestate():
    """This process's GameState, built once."""
    global _STATE
    if _STATE is None:
        from game_config import GameConfig
        import gamestate as g

        _STATE = g.GameState(GameConfig())
    return _STATE


def exact_distribution(mode: str) -> dict:
    """
    {"dist": {payout: probability}, "sweep": P(clean sweep),
     "min_chip": the smallest multiplier any RIGHT guess shows}
    before reweighting, for one mode.
    """
    gs = _gamestate()
    gs.betmode = mode
    plan = gs._spin_plan()
    deck = plan.deck.cards
    ranks = [_RANK_VALUES[rank] for rank, _suit in deck]
    n = len(deck)
    stages = plan.stages
    last = stages - 1
    score_stage = gs.score_stage
    settle = gs.settle_round
    is_correct = gs._is_correct_guess
    choices = plan.choices
    tickets = []
    if plan.ticket is not None:
        counts = {}
        for value in plan.ticket:
            counts[value] = counts.get(value, 0) + 1
        tickets = [(value, count / len(plan.ticket)) for value, count in counts.items()]

    dist = defaultdict(float)
    out = {"sweep": 0.0, "min_chip": math.inf}
    drawn = [None] * stages
    drawn_ranks = [0] * stages
    used = [False] * n

    def finish(state, prob):
        _running, busted, spent = state
        if tickets and not busted and not spent:
            out["sweep"] += prob
            for value, share in tickets:
                dist[settle(plan, state, value)] += prob * share
        else:
            dist[settle(plan, state)] += prob

    def walk(k, state, prob):
        left = n - k
        if k == last:
            # Price first, card second: split what is left into right and wrong.
            right = wrong = None
            n_right = 0
            for i in range(n):
                if used[i]:
                    continue
                rank, suit = deck[i]
                if is_correct(k, choices[k], rank, suit, drawn_ranks[:k] + [ranks[i]]):
                    n_right += 1
                    right = i if right is None else right
                elif wrong is None:
                    wrong = i
            for rep, count in ((right, n_right), (wrong, left - n_right)):
                if rep is None or count == 0:
                    continue
                drawn[k] = deck[rep]
                drawn_ranks[k] = ranks[rep]
                reveal, after = score_stage(plan, drawn, drawn_ranks, k, state)
                if reveal[4]:
                    # A ticket family's last card shows the ticket it drew, and
                    # the smallest ticket is its smallest chip.
                    chip = min(plan.ticket) if k == plan.ticket_stage else reveal[5]
                    out["min_chip"] = min(out["min_chip"], chip)
                finish(after, prob * count / left)
            return
        share = prob / left
        for i in range(n):
            if used[i]:
                continue
            drawn[k] = deck[i]
            drawn_ranks[k] = ranks[i]
            reveal, after = score_stage(plan, drawn, drawn_ranks, k, state)
            if reveal[4]:
                out["min_chip"] = min(out["min_chip"], reveal[5])
            if after[1]:
                # Busted: nothing after this card changes what the round pays.
                dist[settle(plan, after)] += share
                continue
            used[i] = True
            walk(k + 1, after, share)
            used[i] = False

    import gamestate as g

    walk(0, g.ROUND_START, 1.0)
    return {"dist": dict(dist), "sweep": out["sweep"], "min_chip": out["min_chip"]}


def reweighted(model: dict, rtp: float, cost: float) -> tuple:
    """(distribution, win scale) after reweight_luts.py's two-tier reweight."""
    dist = model["dist"]
    win_mass = sum(p for x, p in dist.items() if x > 0)
    win_value = sum(p * x for x, p in dist.items() if x > 0)
    losses = dist.get(0.0, 0.0)
    a = rtp * cost / win_value
    b = (1 - a * win_mass) / losses
    if b <= 0:
        raise ValueError("the reweight would need negative loss weight")
    return {x: (p * a if x > 0 else p * b) for x, p in dist.items() if p > 0}, a


def figures(mode: str) -> dict:
    """Stake's figures for one mode, exactly, plus the model's own extras."""
    from game_config import GameConfig

    family = mode_family(mode)
    cost = MODE_FAMILIES[family]["cost"]
    model = exact_distribution(mode)
    dist, scale = reweighted(model, GameConfig().rtp, cost)
    mean = sum(p * x for x, p in dist.items())
    std = math.sqrt(sum(p * (x - mean) ** 2 for x, p in dist.items()))
    etl40b = sum(p * x for x, p in dist.items() if x >= 40 * cost)
    ordered = sorted(dist.items())
    cumulative, tail_start = 0.0, ordered[0][0]
    for x, p in ordered:
        cumulative += p
        if cumulative >= 0.999:
            tail_start = x
            break
    tail = [(x, p) for x, p in ordered if x >= tail_start]
    cvar = sum(p * x for x, p in tail) / sum(p for _x, p in tail)
    ceiling = ordered[-1][0]
    return {
        "mode": mode,
        "family": family,
        "std": std,
        "etl40b": etl40b,
        "cvar": cvar,
        "max": ceiling,
        "max_1_in": 1 / dist[ceiling],
        "non_zero_1_in": 1 / (1 - dist.get(0.0, 0.0)),
        "p5k": sum(p for x, p in dist.items() if x >= 5000),
        "sweep_1_in": 1 / (model["sweep"] * scale) if model["sweep"] else None,
        "min_chip": model["min_chip"],
        "dist": dist,
    }


def mode_family(mode: str) -> str:
    from game_calculations import family_of

    return family_of(mode)


def family_modes(family: str) -> list:
    return [mode_name(*combo, family=family) for combo in all_mode_combinations(family)]


def model_family(family: str, workers: int = None) -> list:
    """figures() for every mode of a family, across a process pool."""
    modes = family_modes(family)
    workers = workers or os.cpu_count() or 1
    if workers > 1 and len(modes) > 1:
        with ProcessPoolExecutor(max_workers=workers) as pool:
            return list(pool.map(figures, modes))
    return [figures(mode) for mode in modes]


def family_summary(rows: list) -> dict:
    stds = sorted(row["std"] for row in rows)
    worst_etl = max(rows, key=lambda row: row["etl40b"])
    worst_cvar = max(rows, key=lambda row: row["cvar"])
    top = max(rows, key=lambda row: row["max"])
    sweeps = [row["sweep_1_in"] for row in rows if row["sweep_1_in"]]
    return {
        "std_min": stds[0],
        "std_median": stds[len(stds) // 2] if len(stds) % 2 else (stds[len(stds) // 2 - 1] + stds[len(stds) // 2]) / 2,
        "std_max": stds[-1],
        "etl40b": worst_etl["etl40b"],
        "etl40b_mode": worst_etl["mode"],
        "cvar": worst_cvar["cvar"],
        "cvar_mode": worst_cvar["mode"],
        "max": top["max"],
        "max_mode": top["mode"],
        "max_1_in": top["max_1_in"],
        "non_zero_1_in": max(row["non_zero_1_in"] for row in rows),
        "p5k": max(row["p5k"] for row in rows),
        "sweep_1_in": (min(sweeps), max(sweeps)) if sweeps else None,
        "min_chip": min(row["min_chip"] for row in rows),
    }


def ladder(rows: list) -> dict:
    """
    Draft win-tier bands: the whole-number threshold whose family-averaged
    rarity (every mode at equal weight, as winTiers.ts measures) lands closest
    to each of Classic's, plus how rare the family's Max is.
    """
    pooled = defaultdict(float)
    for row in rows:
        for x, p in row["dist"].items():
            pooled[x] += p / len(rows)
    values = sorted(pooled)
    tail = [0.0] * (len(values) + 1)
    for i in range(len(values) - 1, -1, -1):
        tail[i] = tail[i + 1] + pooled[values[i]]

    def one_in(threshold):
        mass = tail[bisect_left(values, threshold)]
        return 1 / mass if mass > 0 else math.inf

    ceiling = values[-1]
    bands = []
    floor = 1
    for target in TARGET_ONE_IN:
        best = None
        for threshold in range(floor, int(ceiling)):
            rarity = one_in(threshold)
            miss = abs(math.log(rarity / target))
            if best is None or miss < best[0]:
                best = (miss, threshold, rarity)
            if rarity > target * 4:
                break
        bands.append((best[1], best[2]))
        floor = best[1] + 1
    return {"bands": bands, "max": (ceiling, 1 / pooled[ceiling])}


def published_check(rows: list, stats_path: str) -> list:
    """(mode, field, exact, built) for every mode the build has, where built is known."""
    if not os.path.exists(stats_path):
        return []
    with open(stats_path, encoding="utf-8") as fh:
        stats = json.load(fh)
    out = []
    for row in rows:
        built = stats.get(row["mode"])
        if built is None:
            continue
        out.append((row["mode"], "std", row["std"], built["std"]))
        out.append((row["mode"], "etl40b", row["etl40b"], built["etl40b"]))
        out.append((row["mode"], "cvar", row["cvar"], built["cvar"]))
        out.append((row["mode"], "max", row["max"], built["max_win"] / 100))
    return out


def _print_family(family: str, rows: list, show_ladder: bool, check: bool) -> None:
    s = family_summary(rows)
    line = (
        f"{family:5} std {s['std_min']:.1f} / {s['std_median']:.1f} / {s['std_max']:.1f}  "
        f"etl40b {s['etl40b']:.3f} ({s['etl40b_mode']})  CVaR {s['cvar']:.1f} ({s['cvar_mode']})  "
        f"max {s['max']:.1f}x ({s['max_mode']}, 1 in {s['max_1_in']:,.0f})  "
        f"non-zero 1 in {s['non_zero_1_in']:.2f}  P(>=5,000x) {s['p5k']:.2g}  "
        f"smallest right chip {s['min_chip']:.4f}"
    )
    if s["sweep_1_in"]:
        line += f"  ticket 1 in {s['sweep_1_in'][0]:,.1f}-{s['sweep_1_in'][1]:,.0f}"
    print(line)
    if show_ladder and not MODE_FAMILIES[family].get("combos"):
        drawn = ladder(rows)
        bands = "  ".join(f"{x}x 1:{r:,.0f}" for x, r in drawn["bands"])
        print(f"      ladder draft: {bands}  Max {drawn['max'][0]}x 1:{drawn['max'][1]:,.0f}")
    if check:
        cmp = published_check(rows, os.path.join(HERE, "library", "stats_summary.json"))
        if not cmp:
            print("      (no published figures for this family)")
            return
        for field in ("std", "etl40b", "cvar"):
            ratios = [exact / built - 1 for _m, f, exact, built in cmp if f == field and built > 0.05]
            worst_exact = max(exact for _m, f, exact, _b in cmp if f == field)
            worst_built = max(built for _m, f, _e, built in cmp if f == field)
            print(
                f"      {field:6} per mode, exact vs built: {min(ratios) * 100:+.1f}% .. {max(ratios) * 100:+.1f}%"
                f"   family worst: exact {worst_exact:.3f}, built {worst_built:.3f}"
            )
        over = [m for m, f, exact, built in cmp if f == "max" and built > exact + 1e-9]
        same = sum(1 for _m, f, exact, built in cmp if f == "max" and abs(built - exact) < 1e-9)
        print(f"      max: {same}/64 built at the exact ceiling, {len(over)} above it (must be 0)")


def main(argv: list) -> None:
    show_ladder = "--ladder" in argv
    check = "--check" in argv
    wanted = [arg for arg in argv if not arg.startswith("--")] or [
        family for family in ordered_families() if not MODE_FAMILIES[family].get("combos")
    ]
    for family in wanted:
        _print_family(family, model_family(family), show_ladder, check)


if __name__ == "__main__":
    main(sys.argv[1:])
