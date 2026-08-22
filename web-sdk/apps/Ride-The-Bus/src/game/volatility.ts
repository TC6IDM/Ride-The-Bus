/**
 * How wild a mode is, as a rating out of five.
 *
 * Every one of the 192 published modes returns the same 96.00%, so RTP tells a
 * player nothing about which one to buy. What actually separates them is
 * SPREAD, and until now the picker never said so - it stated a ceiling and left
 * the player to infer the rest.
 *
 * WHERE THE ORDERING COMES FROM
 *
 * math-sdk games/ride_the_bus/library/stats_summary.json carries `std` - the
 * standard deviation of the payout, in bet multiples - for all 192 published
 * modes, and it reproduces exactly from the published lookup tables. Taken per
 * family it says:
 *
 *              min     median   max
 *   sc        2.345    3.946   11.146
 *   base      3.311    6.249   23.631
 *   hs        4.076    8.068   32.938
 *
 * and, far more strongly than the medians suggest, sc < base < hs holds for
 * every one of the 64 guess combinations INDIVIDUALLY, with no exceptions. That
 * is what makes a single ordering of the three families honest: it is not an
 * average that happens to come out that way, it is true of every bet a player
 * can actually place. volatility.test.ts pins it against the published figures.
 *
 * WHY 1 / 3 / 5 AND NOT 1 / 2 / 3
 *
 * The ruler has five stops because the guess combination moves volatility far
 * more than the family does - Classic alone spans 3.31 to 23.63, a 7x range,
 * against the 2x that separates the family medians. Sitting the three families
 * at 1, 3 and 5 leaves the even stops free for the per-guess rating to fill in
 * later without renumbering anything a player has already learned.
 *
 * NOT IN FAMILY_RULES ON PURPOSE. That record mirrors MODE_FAMILIES in
 * game_calculations.py field for field, and this is a presentation figure the
 * math has no counterpart for. Adding it there would put a UI decision in the
 * one structure whose whole job is to not drift from the Python.
 */
import {
  MODE_FAMILIES,
  type HigherLowerChoice,
  type InsideOutsideChoice,
  type ModeFamily,
} from './modes.ts';

/**
 * Stops drawn on the meter. EVERY meter in the game draws this many.
 *
 * Seven, not five, because the guesses push the rating past where the family
 * alone leaves it - High Stakes starts at 5 and two Equal picks take it to 7.
 * The mode picker still only ever lights 1, 3 or 5 of these; it draws all seven
 * so that the picker and the bet display are the SAME ruler. Two lightning
 * meters counting to different maxima would be the "two units on one screen"
 * mistake, which this game has already shipped three times.
 */
export const VOLATILITY_BOLTS = 7;

/**
 * The last stop a family can reach on its own. Above this, the bolts burn a
 * different colour - the rating has left the range the three modes span and is
 * being driven by the guesses.
 */
export const FAMILY_BOLT_CEILING = 5;

/**
 * Lit bolts per family before the guesses are counted - see the note above.
 *
 * Spread 1 / 3 / 5 rather than bunched at 1-2-3 so the even stops stay free for
 * the Equal picks to fill in, and so a five-stop showing never reads as "nothing
 * is ever very volatile" on a mode that can pay 1910x.
 */
export const FAMILY_BOLTS: Record<ModeFamily, number> = {
  sc: 1,
  base: 3,
  hs: 5,
};

/**
 * How many of the four guesses were Equal picks: 0, 1 or 2.
 *
 * Only stages 2 and 3 offer Equal. Stage 1 is a colour and stage 4 a suit, and
 * neither has an Equal to pick, so two is the ceiling. Nulls count as not-Equal,
 * which is what lets this be called straight from a half-made selection.
 */
export function equalGuessCount(
  higherLower: HigherLowerChoice | null,
  insideOutside: InsideOutsideChoice | null,
): number {
  return (higherLower === 'equal' ? 1 : 0) + (insideOutside === 'equal' ? 1 : 0);
}

/**
 * Lit bolts for an actual bet: the family's own rating, plus one per Equal pick.
 *
 * ONE PER EQUAL IS NOT A GUESS - it is what the published figures do.
 * Grouping all 192 modes by how many Equal picks they carry gives three bands
 * that do not overlap AT ALL, in any family:
 *
 *            0 Equal          1 Equal          2 Equal
 *   sc      2.345- 3.220     3.946- 4.262    10.739-11.146
 *   base    3.311- 5.218     6.249- 7.172    22.868-23.631
 *   hs      4.076- 7.035     8.068- 9.600    32.128-32.938
 *
 * Every 0-Equal mode is calmer than every 1-Equal mode, and every 1-Equal mode
 * calmer than every 2-Equal mode - not on average, individually. So counting
 * Equal picks is an exact ranking, and volatility.test.ts re-derives those bands
 * from stats_summary.json rather than trusting this comment.
 *
 * WHAT IT DELIBERATELY DROPS. Inside is genuinely more volatile than Outside
 * within the 0-Equal band (Classic: 4.34-5.22 against 3.31-3.51), and this rule
 * rates them the same. That is a real simplification, not an oversight: Equal is
 * the dominant term by a wide margin, and splitting the band would need an
 * eighth stop for a difference a player cannot feel.
 */
export function boltsFor(
  family: ModeFamily,
  higherLower: HigherLowerChoice | null,
  insideOutside: InsideOutsideChoice | null,
): number {
  const bolts = FAMILY_BOLTS[family] + equalGuessCount(higherLower, insideOutside);
  // Cannot actually trip today - 5 + 2 is exactly the ruler - but the clamp is
  // what stops a future family rating from drawing bolts off the end of it.
  return Math.min(bolts, VOLATILITY_BOLTS);
}

/**
 * Rank of a family on the volatility ordering, 1 being the calmest.
 *
 * Derived from FAMILY_BOLTS rather than written out a second time, so the two
 * cannot disagree about which mode is wildest.
 */
export function volatilityRank(family: ModeFamily): number {
  const ascending = MODE_FAMILIES.slice().sort((a, b) => FAMILY_BOLTS[a] - FAMILY_BOLTS[b]);
  return ascending.indexOf(family) + 1;
}

/**
 * The colour a family's bolts burn at: green, yellow, red as they get wilder.
 *
 * Returned as a custom-property reference rather than a hex literal so the
 * palette lives in CSS with every other colour in the game, and so it crosses
 * the component boundary into BoltMeter - a custom property inherits through
 * the DOM, where a scoped selector written in the parent's stylesheet would
 * never match a child component's elements. See the note atop ChoiceIcon.svelte
 * for the version of that trap this game has already been bitten by.
 */
export function volatilityColorVar(family: ModeFamily): string {
  return `var(--vol-${family})`;
}

/**
 * The rgb-triplet token matching volatilityColorVar, for call sites that need
 * an alpha - a border wash, a glow.
 *
 * Deliberately the same family suffix rather than a second lookup table: the
 * two are asserted to agree in volatility.test.ts, so a family renamed here
 * cannot leave the rgba() half pointing at a token that no longer exists.
 */
export function volatilityColorRgbVar(family: ModeFamily): string {
  return `var(--vol-${family}-rgb)`;
}
