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
 * Snap onto the step grid WITHOUT clamping into range.
 *
 * Used when the bet field loses focus, so the player sees the amount they will
 * actually be staked before committing to it. Range is deliberately left
 * alone: clamping 0.50 up to a 1.00 minimum would silently stake them MORE
 * than they typed. An out-of-range amount stays visible and betWithinRange
 * refuses it, which the spin tooltip then explains.
 */
export function snapToStep(
  value: number,
  limits: BetLimits | null | undefined,
  amountMultiplier: number,
): number {
  const step = limits?.stepBet || 0;
  if (step <= 0 || !Number.isFinite(value) || value <= 0) return value;
  const micro = Math.floor(Math.round(value * amountMultiplier) / step) * step;
  return micro / amountMultiplier;
}

/**
 * How many decimal places the operator's step needs. A 0.10 step wants 2, but
 * a sub-cent step would be destroyed by blindly formatting to 2 - money here
 * carries six decimal places, so that is a real possibility.
 *
 * `currencyPlaces` is the floor, and it is the CURRENCY's own precision rather
 * than a hardcoded 2: JPY, IDR, KRW, VND and CLP have no subunit, so a bet
 * field showing "1000.00 yen" is offering the player decimals that do not
 * exist. It defaults to 2 so existing callers and every two-decimal currency
 * behave exactly as before.
 */
export function betDecimals(
  limits: BetLimits | null | undefined,
  amountMultiplier: number,
  currencyPlaces: number = 2,
): number {
  const step = limits?.stepBet || 0;
  if (step <= 0) return currencyPlaces;
  const decimal = step / amountMultiplier;
  const text = decimal.toString();
  const dot = text.indexOf('.');
  return Math.max(currencyPlaces, dot === -1 ? 0 : text.length - dot - 1);
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
