/**
 * Bringing a raw bet onto the grid the RGS will accept.
 *
 * Per the RGS spec ("Bet Levels") the published betLevels are only
 * suggestions - free-form amounts are allowed - but two rules are hard:
 *
 *   1. minBet <= bet <= maxBet
 *   2. bet divisible by stepBet
 *
 * Extracted from Game.svelte as a pure function so the grid arithmetic can be
 * unit-tested; an off-by-one-micro-unit bet is exactly what ERR_VAL catches,
 * and that is not something to find out in production.
 */

/** Raw RGS micro-units (6dp: 1_000_000 = 1.00). 0 means "not supplied". */
export type BetLimits = {
  minBet: number;
  maxBet: number;
  stepBet: number;
};

export const NO_LIMITS: BetLimits = { minBet: 0, maxBet: 0, stepBet: 0 };

/** True when the RGS supplied nothing to constrain against. */
export function limitsAreUnknown(limits: BetLimits | null | undefined): boolean {
  return !limits || (!limits.minBet && !limits.maxBet && !limits.stepBet);
}

/**
 * Snap `value` (in display units, e.g. dollars) onto the operator's grid.
 *
 * All arithmetic runs in integer micro-units, because doing it in decimal
 * drifts - 0.1 * 3 !== 0.3 in binary floating point - and the RGS compares
 * exactly.
 *
 * Snaps DOWN, so a player is never staked more than they asked for. Where
 * snapping down would drop under minBet it steps up to the first valid grid
 * point instead, since betting less than the minimum is not an option either.
 */
export function snapBetToGrid(
  value: number,
  limits: BetLimits | null | undefined,
  amountMultiplier: number,
): number {
  if (limitsAreUnknown(limits)) {
    // Nothing authoritative to snap to - just tidy to the cent.
    return Math.round(value * 100) / 100;
  }
  const { minBet, maxBet, stepBet } = limits as BetLimits;

  let micro = Math.round(value * amountMultiplier);
  if (maxBet > 0) micro = Math.min(micro, maxBet);
  if (minBet > 0) micro = Math.max(micro, minBet);

  if (stepBet > 0) {
    micro = Math.floor(micro / stepBet) * stepBet;
    if (minBet > 0 && micro < minBet) micro = Math.ceil(minBet / stepBet) * stepBet;
    if (maxBet > 0 && micro > maxBet) micro = Math.floor(maxBet / stepBet) * stepBet;
  }

  if (micro < 0) micro = 0;
  return micro / amountMultiplier;
}

/**
 * Whether `value` sits inside [minBet, maxBet]. Divisibility is deliberately
 * NOT part of this: an off-grid figure typed into the input is correctable by
 * snapBetToGrid at play time, so it should not disable the spin button.
 */
export function betWithinRange(
  value: number,
  limits: BetLimits | null | undefined,
  amountMultiplier: number,
): boolean {
  if (!limits || (!limits.minBet && !limits.maxBet)) return true;
  const micro = Math.round(value * amountMultiplier);
  if (limits.minBet > 0 && micro < limits.minBet) return false;
  if (limits.maxBet > 0 && micro > limits.maxBet) return false;
  return true;
}
