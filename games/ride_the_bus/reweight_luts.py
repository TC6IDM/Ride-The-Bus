"""Reweight each mode's published lookup table to an exact common RTP.

Why this exists
---------------
Stake's "Cross-Mode RTP Consistency" check requires every bet mode's RTP to
sit within +/-0.5% of every other mode's. The martingale payout formula (see
game_calculations.partial_multiplier) already drives each mode's TRUE expected
RTP to the same target, but the lookup table records each mode's *sampled*
RTP - and the high-variance modes (multiple "equal" picks, with rare ~1000x+
jackpots) have sampled RTP that stays noisy even after millions of sims. No
practical sim count makes them converge within 0.5% of the low-variance modes.

The fix is the same one Stake's own optimization step performs: reweight the
outcome table so the *recorded* RTP equals an exact common target, instead of
leaving it at the raw one-row-per-sim frequencies. We keep every simulated
book (so the on-screen card variety is untouched) and only scale two weight
tiers:

  * every winning outcome (payout > 0) gets weight K
  * every losing outcome (payout == 0) gets weight w0

chosen so that

  RTP = K*sum(win_payouts) / (K*num_wins + w0*num_losses) == TARGET_RTP

Losses here are exactly the stage-1 (colour) misses, which bust to 0 because
STAGE_RETENTION[0] == 0 - roughly half of all rounds, so there is always
plenty of zero-weight to tune with. w0 comes out relative to K: a mode whose
raw RTP is ABOVE target gets w0 > K (up-weight losses to pull RTP down, e.g.
the "equal" jackpot modes), and a mode BELOW target gets w0 < K (down-weight
losses to lift RTP up, e.g. the structurally-low "inside" modes). w0 stays
positive for every mode because TARGET_RTP (~0.94) is well under each mode's
win-conditional mean (~2x), so no mode ever needs losses removed entirely -
we never have to fabricate wins.

This replaces the pipeline's default behaviour of copying the raw weight-1
lookup straight into the published _0 file (src/write_data/write_data.py:251,
which only fires when the _0 file is absent - the reason a stale _0 lingered
before). Run automatically at the end of run.py.
"""

import csv
import os

from game_calculations import all_mode_combinations, mode_name

# Integer scale for the winning-outcome weight. Large enough that rounding the
# losing weight to an integer perturbs RTP by well under 0.001x.
WEIGHT_SCALE = 1_000_000


def _segmented_path(game_dir: str, mode: str) -> str:
    return os.path.join(game_dir, "library", "lookup_tables", f"lookUpTableSegmented_{mode}.csv")


def _publish_path(game_dir: str, mode: str) -> str:
    return os.path.join(game_dir, "library", "publish_files", f"lookUpTable_{mode}_0.csv")


def reweight_mode(game_dir: str, mode: str, target_rtp: float) -> dict:
    """Rewrite one mode's published _0 lookup table to hit target_rtp exactly."""
    seg = _segmented_path(game_dir, mode)
    rows = []  # (sim_id, payout_float)
    win_payout_sum = 0.0
    num_wins = 0
    num_losses = 0
    with open(seg, newline="", encoding="UTF-8") as f:
        for sim_id, _criteria, payout, *_rest in csv.reader(f):
            payout = float(payout)
            rows.append((sim_id, payout))
            if payout > 0:
                win_payout_sum += payout
                num_wins += 1
            else:
                num_losses += 1

    if num_losses == 0:
        raise ValueError(
            f"{mode}: no zero-payout outcomes to reweight with - cannot pin RTP "
            f"(this should be impossible; stage-1 colour misses always bust to 0)."
        )

    # K*win_sum / (K*num_wins + w0*num_losses) == target  ->  solve w0
    loss_weight = (WEIGHT_SCALE * win_payout_sum / target_rtp - WEIGHT_SCALE * num_wins) / num_losses
    loss_weight = round(loss_weight)
    if loss_weight < 1:
        # target >= win-conditional mean: can't reach by adding losses. Not
        # expected for this game (target ~0.94 << mean win ~2x), but fail loud
        # rather than silently emit a non-compliant table.
        raise ValueError(
            f"{mode}: target_rtp={target_rtp} at/above win-conditional mean "
            f"({win_payout_sum / num_wins:.3f}x); reweight cannot lower to target."
        )

    pub = _publish_path(game_dir, mode)
    with open(pub, "w", newline="", encoding="UTF-8") as f:
        writer = csv.writer(f, lineterminator="\n")
        for sim_id, payout in rows:
            weight = WEIGHT_SCALE if payout > 0 else loss_weight
            # payout stored as integer hundredths (x100), a multiple of 10
            # since payouts are already floored to 0.1x by quantize_multiplier.
            writer.writerow([sim_id, weight, int(round(payout * 100))])

    total_weight = WEIGHT_SCALE * num_wins + loss_weight * num_losses
    realized = WEIGHT_SCALE * win_payout_sum / total_weight
    return {
        "mode": mode,
        "realized_rtp": realized,
        "num_wins": num_wins,
        "num_losses": num_losses,
        "loss_weight": loss_weight,
        "hit_rate_1_in": total_weight / (WEIGHT_SCALE * num_wins),
    }


def reweight_all(game_dir: str, target_rtp: float) -> list:
    """Reweight every bet mode's published lookup table to the common target."""
    results = []
    for combo in all_mode_combinations():
        results.append(reweight_mode(game_dir, mode_name(*combo), target_rtp))
    return results


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    from game_config import GameConfig

    cfg = GameConfig()
    out = reweight_all(here, cfg.rtp)
    rtps = [r["realized_rtp"] for r in out]
    print(f"Reweighted {len(out)} modes to target {cfg.rtp:.4f}")
    print(f"  realized RTP min={min(rtps)*100:.4f}%  max={max(rtps)*100:.4f}%  spread={(max(rtps)-min(rtps))*100:.4f}%")
