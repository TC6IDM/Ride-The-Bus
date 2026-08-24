/**
 * Which chip colour a bet level is drawn as.
 *
 * The bet menu picks its levels out of the same five denominations the table
 * is laid with. The list it colours is NOT ours: it comes from the RGS as
 * `authenticate/config` betAmountOptions, and per Stake's Bet Levels rule the
 * frontend must use whatever it is sent - any count, any jumps, any currency.
 * So the mapping cannot be a table of amounts to colours.
 *
 * It is BY RANK. Sort the levels, spread them over the five chips, and the
 * reading a player gets - paler chip, smaller bet - holds for a list of three
 * or a list of thirty, in yen or in dollars. A level also keeps its colour for
 * as long as the list does, so the menu does not reshuffle between sessions.
 *
 * Lives here rather than in Game.svelte so it can be tested against the lists
 * a real operator might actually send; `node --test` cannot mount a component.
 */

/**
 * Low to high.
 *
 * NOT the American casino order (white, red, green, black, blue), which
 * encodes denominations most players have never had to learn. This runs pale
 * to dark, so the value reads off the weight of the colour.
 */
export const CHIP_COLOURS = ['white', 'blue', 'green', 'red', 'black'] as const;

export type ChipColour = (typeof CHIP_COLOURS)[number];

/**
 * The chip for the level at `index` in a sorted list of `count` levels.
 *
 * Bands are even across the list, so ten levels give two per colour and seven
 * give an uneven but monotonic spread. A single-level list has no rank to
 * express and takes the middle chip rather than declaring itself the smallest
 * bet available.
 */
export function chipColour(index: number, count: number): ChipColour {
  if (count < 2) return CHIP_COLOURS[2]!;
  const clamped = Math.min(Math.max(index, 0), count - 1);
  // The epsilon keeps a level that lands exactly on a band edge in the lower
  // band rather than letting float error decide it.
  const band = Math.floor((clamped / (count - 1)) * (CHIP_COLOURS.length - 1) + 1e-9);
  return CHIP_COLOURS[Math.min(band, CHIP_COLOURS.length - 1)]!;
}

/**
 * A formatted currency string split into what a CHIP can show.
 *
 * A real chip is denominated in a number; the currency belongs to the table.
 * That is not styling here, it is the only way the control fits: Intl renders
 * NOK in an English locale as "NOK 12,500.00" - thirteen characters - and
 * there is no font size at which that reads inside a 60px disc. An earlier
 * build put those strings in a fixed 4-column grid and the fourth column ran
 * off the panel with a horizontal scrollbar under it, so the highest levels
 * were not reachable at all. Stake's checklist says the main frame must not
 * scroll and that min and max levels must both be selectable; that layout
 * failed both.
 *
 * So the code goes on its own line above the number, and the number loses a
 * fraction that is all zeros: "NOK 12,500.00" becomes "NOK" over "12,500".
 * Nothing is hidden - the bet display, the entry field and the chip's own
 * aria-label all still carry the full formatted amount.
 *
 * Splits the FORMATTED string rather than re-implementing Intl, so every
 * currency rule the SDK already encodes - the suffixed social currencies, yen
 * having no subunit, the widened sub-cent cases - is inherited rather than
 * duplicated.
 */
/**
 * Roughly how many ems wide a chip label prints, so the disc can size its own
 * type instead of every chip sharing one constant.
 *
 * WHY THIS IS NEEDED AT ALL. The value used to be a flat multiple of --ui-bar,
 * sized for a worst case that never arrived. Measured in the running game, the
 * LONGEST label filled 67% of the face and the shortest filled 24%, and the
 * figure came out at 9.6px on desktop and 3.4px at Popout S - smaller, at every
 * one of the seven target sizes, than the "Quick Bets" caption above it. The
 * most important number in the menu was the smallest type on the panel.
 *
 * WHY IT IS A WEIGHTED TABLE AND NOT A CHARACTER COUNT. Poppins ships no `tnum`
 * feature, so the `font-variant-numeric: tabular-nums` on the value is a no-op
 * and the figures are PROPORTIONAL: measured at weight 800, "1" is 0.387em
 * against "0" at 0.657em and "4" at 0.691em. Counting characters would size
 * "$1,111" and "$4,444" identically and overflow one of them by 40%.
 *
 * The constants are the measured widths rounded UP - digits 0.70 against a
 * measured 0.606-0.691, caps 0.80 against 0.62-0.79 - so the estimate runs 5-9%
 * heavy on every real label and the fit errs toward a slightly smaller figure
 * rather than one that spills off the face. Understating the space available is
 * the safe direction; a chip you cannot read the value on is not a chip.
 *
 * Approximate on purpose. It does not need to be right to the pixel, it needs
 * to be right to within the margin the face already leaves.
 */
const EM_NARROW: Record<string, number> = {
  // The one digit that is nowhere near the others, plus the separators.
  '1': 0.42,
  ',': 0.32,
  '.': 0.32,
  "'": 0.32,
  // Spaces are appreciably narrower than the separators (0.181 measured against
  // 0.314), and a grouped label like "1 234,50" carries both. Lumping them
  // together put that one 12% heavy; split, it is 9.5%.
  ' ': 0.22,
  '\u00a0': 0.22,
  '\u202f': 0.22,
  '\u2009': 0.22,
};

const EM_DIGIT = 0.7;
const EM_CAP = 0.8;
/** Currency symbols, lowercase codes like "kr", and anything unmeasured. */
const EM_OTHER = 0.72;

export function labelEms(text: string): number {
  let ems = 0;
  for (const ch of text) {
    const narrow = EM_NARROW[ch];
    if (narrow !== undefined) ems += narrow;
    else if (ch >= '0' && ch <= '9') ems += EM_DIGIT;
    else if (ch >= 'A' && ch <= 'Z') ems += EM_CAP;
    else ems += EM_OTHER;
  }
  // Never zero: the CSS divides by this, and a 0 would make font-size infinite.
  return Math.max(Math.round(ems * 100) / 100, 0.5);
}

export function splitChipLabel(formatted: string): { currency: string; amount: string } {
  // The numeric run: a digit, then anything a locale uses inside a number -
  // ASCII, thin and no-break spaces as group separators, comma, full stop.
  const match = /[0-9][0-9\u00A0\u202F\u2009 .,]*/.exec(formatted);
  if (!match) return { currency: '', amount: formatted.trim() };

  const amount = match[0].trim();
  const currency = (formatted.slice(0, match.index) + formatted.slice(match.index + match[0].length))
    .replace(/\s+/g, ' ')
    .trim();

  return { currency, amount: dropZeroFraction(amount) };
}

/**
 * "12,500.00" -> "12,500", but "0.20" stays and "1,000" stays "1,000".
 *
 * The hard part is telling a decimal separator from a grouping one, because
 * they are the same two characters and which is which depends on the locale.
 * Getting it wrong is not cosmetic: an early version read the comma in the yen
 * "1,000" as a decimal point, saw three zeros after it, and rendered a
 * thousand-yen chip as "1".
 *
 * Two rules settle every real case:
 *   - If both "." and "," appear, the LAST one is the decimal separator.
 *   - If only one kind appears, it is a decimal separator only when the run
 *     after it is not exactly three digits. Grouping is always in threes, so a
 *     trailing group of three is a thousand, not a fraction.
 *
 * That leaves the three-decimal currencies (KWD, JOD, BHD, OMR, TND) merely
 * uncompacted rather than wrong: "1.000" keeps its zeros. Safe direction.
 */
function dropZeroFraction(amount: string): string {
  const lastDot = amount.lastIndexOf('.');
  const lastComma = amount.lastIndexOf(',');
  if (lastDot < 0 && lastComma < 0) return amount;

  const at = Math.max(lastDot, lastComma);
  const fraction = amount.slice(at + 1);
  if (!/^\d+$/.test(fraction)) return amount;

  const bothPresent = lastDot >= 0 && lastComma >= 0;
  if (!bothPresent && fraction.length === 3) return amount; // a grouped thousand

  if (!/^0+$/.test(fraction)) return amount;

  const whole = amount.slice(0, at);
  // "0.00" must not become "0" - that is a different bet, and sub-unit levels
  // are real (the NOK list starts at 0.10).
  if (/^[0\s.,\u00A0\u202F\u2009]*$/.test(whole)) return amount;
  return whole;
}
