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
 * WHY IT IS A WEIGHTED TABLE AND NOT A CHARACTER COUNT. A separator is a third
 * of a digit and a "W" is half as wide again as an "O"; a count would size
 * "$1,000" and "NOK" alike. The digits themselves ARE uniform now: the body
 * face is Overpass, which ships `tnum`, and the value carries
 * `font-variant-numeric: tabular-nums` - so every digit prints at the same
 * 0.616em at weight 800 (fontTools, off the shipped file, 2026-10-05; it was
 * 0.648 under Geist). Under Poppins that declaration was inert and "1"
 * measured 0.387em against "4" at 0.691em, which is why an earlier version of
 * this table carried a narrow "1".
 *
 * The constants are the measured widths rounded UP - digits 0.62 against
 * 0.616, caps 0.74 against a common range of 0.30-0.73 - so the estimate runs
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
  // Separators, and the apostrophe some locales group with (Overpass 800:
  // 0.257, 0.249, 0.256).
  ',': 0.26,
  '.': 0.26,
  "'": 0.26,
  // Spaces: 0.255 measured, the no-break space the same. The narrow no-break
  // space is not in the face (nor was it in Geist) and falls back to the OS
  // font; 0.26 covers both.
  ' ': 0.26,
  '\u00a0': 0.26,
  '\u202f': 0.26,
  '\u2009': 0.26,
  // The two capitals wider than the cap figure below (0.811, 0.851).
  M: 0.82,
  W: 0.86,
  // The commonest symbols, measured (0.609, 0.640, 0.606, 0.621), so a dollar
  // or euro chip is not sized for the widest sign in the set.
  $: 0.62,
  '\u20ac': 0.65,
  '\u00a3': 0.62,
  '\u00a5': 0.63,
};

/** Every digit, under `tnum`: 0.616 measured (Overpass 800), rounded up. */
const EM_DIGIT = 0.62;
const EM_CAP = 0.74;
/** Other currency symbols (up to 0.742, the sheqel), lowercase codes like "kr", and anything unmeasured. */
const EM_OTHER = 0.75;

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

