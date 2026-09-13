/**
 * Fitting a string to a box, in the game's own typeface.
 *
 * Two surfaces need this and they are otherwise unrelated: a bet chip, whose
 * figure has to fill a disc, and the win takeover's amount, which has to fit
 * across a phone. Both were sized by a constant picked for a worst case that
 * never arrived, and both were measured and found wanting - the chip printed
 * at 9.6px on desktop, and the amount ran off both edges of a 375px screen on
 * a high-denomination currency.
 *
 * Lives on its own rather than in betChips.ts because the win screen has no
 * business importing a module named for the bet menu.
 */

/**
 * Roughly how many ems wide a string prints, so its box can size its own type
 * instead of every instance sharing one constant.
 *
 * WHY THIS IS NEEDED AT ALL. The bet chip's value used to be a flat multiple
 * of --ui-bar,
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
  return ems(text, (ch) => EM_NARROW[ch] ?? EM_DIGIT);
}

/**
 * The width of one digit's box in Figure.svelte, in ems.
 *
 * Poppins' "0" at weight 800 is 0.657em; the box is a hair over it. This
 * constant and the `--digit-w` default in components/board/Figure.svelte MUST
 * agree - typeFit.test.ts reads the component and checks - because the win
 * takeover solves its font-size from evenDigitEms() and then renders the same
 * string through Figure. If the two disagree the headline is sized for a
 * string of one width and printed at another.
 */
export const EVEN_DIGIT_EM = 0.66;

/**
 * labelEms() for a string that Figure.svelte will render: every digit takes
 * exactly the box width, whatever the digit, and everything else keeps the
 * proportional estimate above. Only the "1" (0.42 in the table) differs from
 * the plain estimate by more than the rounding; that is the whole point, since
 * the "1" is the digit that made a figure's width move under the player.
 */
export function evenDigitEms(text: string): number {
  return ems(text, () => EVEN_DIGIT_EM);
}

/** The shared walk; only what a DIGIT costs differs between the two. */
function ems(text: string, digitEms: (ch: string) => number): number {
  let total = 0;
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') total += digitEms(ch);
    else {
      const narrow = EM_NARROW[ch];
      if (narrow !== undefined) total += narrow;
      else if (ch >= 'A' && ch <= 'Z') total += EM_CAP;
      else total += EM_OTHER;
    }
  }
  // Never zero: the CSS divides by this, and a 0 would make font-size infinite.
  return Math.max(Math.round(total * 100) / 100, 0.5);
}
