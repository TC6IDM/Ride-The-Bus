/**
 * How a multiplier is printed, everywhere: one decimal, grouped the way the
 * player's locale groups money, then "×".
 *
 * WHY ONE DECIMAL. Every multiplier the game can produce is floored to 0.1
 * (quantizeMultiplier in math/payout.ts; the published books agree), so a
 * second place is always 0. Printing it anyway was three formats for one
 * number: 17.2× in the round details and the mode picker, 17.20× on the board
 * and the takeover, and 1354.20× - ungrouped - beside $1,354.20. The ".20"
 * claims a precision the game does not have.
 *
 * WHY ROUND, NOT FLOOR. The value is quantized before it gets here; what is
 * left to handle is float noise (17.199999999). Flooring that would print a
 * tenth less than the round paid.
 *
 * WHY THE SAME PATH AS MONEY. numberToCurrencyString formats through
 * stateI18n's Lingui instance, so the balance and the multiplier beside it
 * group and point alike in every locale. A caller passes that formatter in;
 * this module imports nothing, so node tests can reach it.
 */
export const MULTIPLIER_DIGITS = { minimumFractionDigits: 1, maximumFractionDigits: 1 } as const;

type NumberFormatter = (value: number, format: Intl.NumberFormatOptions) => string;

export function multiplierString(value: number, format?: NumberFormatter): string {
  const safe = Number.isFinite(value) ? value : 0;
  let figure: string;
  try {
    figure = format ? format(safe, MULTIPLIER_DIGITS) : new Intl.NumberFormat('en-US', MULTIPLIER_DIGITS).format(safe);
  } catch {
    // Same belt as numberToCurrencyString: a formatter that throws on a bad
    // locale must never empty the board. The figure stays right; only the
    // grouping falls back.
    figure = new Intl.NumberFormat(undefined, MULTIPLIER_DIGITS).format(safe);
  }
  return `${figure}×`;
}
