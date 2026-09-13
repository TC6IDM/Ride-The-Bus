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
 * WHY IT IS A WEIGHTED TABLE AND NOT A CHARACTER COUNT. A separator is half a
 * digit and a "W" is half as wide again as an "O"; a count would size "$1,000"
 * and "NOK" alike. The digits themselves ARE uniform: the body face is Barlow,
 * which ships `tnum`, and the value carries `font-variant-numeric:
 * tabular-nums` - so every digit prints at the same 0.551em at weight 800
 * (fontTools, off the shipped file). Under Poppins that declaration was inert
 * and "1" measured 0.387em against "4" at 0.691em, which is why an earlier
 * version of this table carried a narrow "1".
 *
 * The constants are the measured widths rounded UP - digits 0.56 against
 * 0.551, caps 0.70 against a common range of 0.56-0.69 - so the estimate runs
 * a few percent heavy on every real label and the fit errs toward a slightly
 * smaller figure rather than one that spills off the face. Understating the
 * space available is the safe direction; a chip you cannot read the value on
 * is not a chip. "M" and "W" run past the cap figure and are named on their
 * own, because a code that starts with either ("MXN", "MWK") would otherwise
 * be sized for a string narrower than the one printed.
 *
 * Approximate on purpose. It does not need to be right to the pixel, it needs
 * to be right to within the margin the face already leaves.
 */
const EM_CHAR: Record<string, number> = {
  // Separators, and the apostrophe some locales group with.
  ',': 0.27,
  '.': 0.27,
  "'": 0.19,
  // Spaces are narrower than the separators (0.200 measured against 0.265),
  // and a grouped label like "1 234,50" carries both.
  ' ': 0.21,
  '\u00a0': 0.21,
  '\u202f': 0.21,
  '\u2009': 0.21,
  // The two capitals wider than the cap figure below.
  M: 0.72,
  W: 0.91,
};

/** Every digit, under `tnum`: 0.551 measured, rounded up. */
const EM_DIGIT = 0.56;
const EM_CAP = 0.7;
/** Currency symbols (the yen sign is the widest at 0.685), lowercase codes
    like "kr", and anything unmeasured. */
const EM_OTHER = 0.7;

export function labelEms(text: string): number {
  let total = 0;
  for (const ch of text) {
    const known = EM_CHAR[ch];
    if (known !== undefined) total += known;
    else if (ch >= '0' && ch <= '9') total += EM_DIGIT;
    else if (ch >= 'A' && ch <= 'Z') total += EM_CAP;
    else total += EM_OTHER;
  }
  // Never zero: the CSS divides by this, and a 0 would make font-size infinite.
  return Math.max(Math.round(total * 100) / 100, 0.5);
}

