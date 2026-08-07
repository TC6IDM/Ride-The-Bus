/**
 * How big a win has to be before the game stops to celebrate it.
 *
 * The thresholds are not invented - they were read off the published lookup
 * tables (math-sdk .../library/publish_files/lookUpTable_*.csv), weighting each
 * mode equally because all 64 cost 1x and a player picks exactly one per round.
 * The resulting frequencies are:
 *
 *     Big    >=   10x     1 in 70
 *     Huge   >=   40x     1 in 305
 *     Mega   >=  120x     1 in 3,093
 *     Epic   >=  300x     1 in 15,561
 *     Max    = 1354.2x    1 in 36,384
 *
 * Epic sits at 300x rather than the rounder 400x deliberately: nothing in this
 * game pays between 400x and 1000x, so a tier at 400x would fire 1 in 100,000 -
 * RARER than the Max Win above it, which makes the ladder read backwards.
 *
 * Tiering is on PAYOUT SIZE, not on surviving all four cards. Busting on card 3
 * or 4 still keeps 30% of the multiplier built so far and reaches 129x, which
 * pays more than a typical full-game win (no-equal modes average 17.3x). A
 * celebration keyed on "all four correct" would fire on 3x wins while passing
 * over the biggest partials in silence.
 */

/** The game's true ceiling, proven by exhaustive enumeration - see math-sdk
 * games/ride_the_bus/game_config.py. The published `max_win` of 1400 is a
 * declared bound that never binds, so it is NOT the right number to celebrate. */
export const MAX_WIN_MULTIPLIER = 1354.2;

/**
 * The smallest possible full-game win, from exhaustive enumeration of all
 * 6,497,400 ordered four-card draws against the payout model in payout.ts.
 *
 * Sits BELOW the entry tier, which is why winTierFor takes a `fullGameWin`
 * flag: "every full game win is big enough to celebrate on size alone" is a
 * tempting assumption and a false one. Exported so the test can assert the
 * relationship rather than restating the number.
 */
export const MIN_FULL_GAME_WIN_MULTIPLIER = 6.6;

export type WinTierId = 'big' | 'huge' | 'mega' | 'epic' | 'max';

export type WinTier = {
  id: WinTierId;
  /** Inclusive lower bound, as a multiple of the bet. */
  minMultiplier: number;
  /**
   * English text, which is also the i18n key - see i18n/messagesMap/en.ts.
   *
   * Typed as the literal union rather than `string` so `t(tier.label)` compiles:
   * t() is keyed on the English map, and a widened `string` is not assignable to
   * it. Spelled out here rather than imported from i18n, because that import
   * would reach state-shared and put this module out of reach of `node --test`.
   */
  label: 'Big Win' | 'Huge Win' | 'Mega Win' | 'Epic Win' | 'Max Win';
  /** Roughly how often this tier or better lands, for the comment above. */
  oneIn: number;
};

/** Ordered LOW to HIGH. winTierFor scans backwards, so order is load-bearing. */
export const WIN_TIERS: readonly WinTier[] = [
  { id: 'big', minMultiplier: 10, label: 'Big Win', oneIn: 70 },
  { id: 'huge', minMultiplier: 40, label: 'Huge Win', oneIn: 305 },
  { id: 'mega', minMultiplier: 120, label: 'Mega Win', oneIn: 3093 },
  { id: 'epic', minMultiplier: 300, label: 'Epic Win', oneIn: 15561 },
  { id: 'max', minMultiplier: MAX_WIN_MULTIPLIER, label: 'Max Win', oneIn: 36384 },
] as const;

/**
 * Floating-point slack on the Max Win comparison.
 *
 * The multiplier reaching the client is `wonAmount / initialBet`, i.e. a
 * division of two numbers that have each already been rounded for display, so
 * a true max win can arrive as 1354.1999999999998. Without the epsilon that
 * shows "Epic Win" on the rarest outcome in the game.
 */
const EPSILON = 1e-6;

/**
 * The tier a win earns, or null when it is too small to celebrate.
 *
 * `fullGameWin` (all four guesses correct) floors the result at the bottom tier
 * rather than changing the ladder: landing all four is the thing this game is
 * about, and letting one through with no acknowledgement would be a strange
 * silence at exactly the moment the player succeeded.
 *
 * That floor is load-bearing, not belt-and-braces. Enumerating all 6,497,400
 * ordered four-card draws puts the SMALLEST possible full-game win at 6.6x -
 * ranks A,2,3 then any ace, guessing higher/outside, where every stage was a
 * heavy favourite and so paid almost nothing. Without the floor, the least
 * likely-looking full win in the game would pass in silence.
 *
 * A win can still be celebrated on size alone without being a full game win: a
 * bust on card 4 keeps 30% of the built multiplier and reaches 129x.
 */
export function winTierFor(multiplier: number, fullGameWin = false): WinTier | null {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
  for (let i = WIN_TIERS.length - 1; i >= 0; i--) {
    if (multiplier >= WIN_TIERS[i]!.minMultiplier - EPSILON) return WIN_TIERS[i]!;
  }
  return fullGameWin ? WIN_TIERS[0]! : null;
}

/**
 * How long the amount spends climbing THROUGH one tier's band, in milliseconds.
 *
 * The count-up is segmented, one segment per tier the win passes through - see
 * countUpSegments. Each band gets its own duration rather than the total being
 * divided up, because the bands are wildly uneven in width (10x-40x against
 * 300x-1354.2x) and dividing by span would make the early ones vanish.
 *
 * Later bands run slightly longer, so a climb that keeps going feels like it is
 * pushing into rarer territory rather than ticking off equal chunks. Turbo is
 * applied by the caller, which owns that state.
 */
export function segmentDurationMs(tier: WinTier): number {
  switch (tier.id) {
    case 'big':
      return 1800;
    case 'huge':
      return 2000;
    case 'mega':
      return 2300;
    case 'epic':
      return 2600;
    case 'max':
      return 3000;
  }
}

/** One leg of the segmented count-up. */
export type CountUpSegment = {
  /** The tier whose name and colours are shown while this leg runs. */
  tier: WinTier;
  /** Multiplier this leg starts from. */
  fromMultiplier: number;
  /** Multiplier this leg climbs to. */
  toMultiplier: number;
  /** How long this leg should take, before turbo. */
  durationMs: number;
  /**
   * True when the leg has nowhere to climb, which happens only on a Max Win:
   * the top tier's floor IS the game ceiling, so by the time "Max Win" appears
   * the number has already arrived. The leg is kept rather than dropped so the
   * title still gets its moment - it just holds instead of counting.
   */
  isHold: boolean;
};

/** A degenerate leg still pauses long enough for the promotion to register. */
const HOLD_MS = 900;

/**
 * How long the number rests on a band's ceiling before the next leg starts.
 *
 * Without this the count crosses each threshold and immediately resets to the
 * next floor, so the one figure the player is actually being shown - the top of
 * the tier they just cleared - is on screen for a single frame. The pause is
 * what makes the ladder legible rather than a blur.
 *
 * It runs out on its own; a tap only skips the remainder.
 */
export const CEILING_PAUSE_MS = 1000;

/**
 * Break a win into the legs its count-up climbs through.
 *
 * Every celebration starts at zero on "Big Win" and climbs to the top of that
 * band; then restarts at the next tier's floor and climbs through that one, and
 * so on until the leg that ends on the amount actually won. So the player reads
 * the title rising rather than being handed the answer and waiting for the
 * digits to catch up.
 *
 * The bands are the tier thresholds themselves, so leg i runs
 * WIN_TIERS[i].min -> WIN_TIERS[i+1].min, except:
 *   - the first leg starts at 0, not at 10x, so the number always begins at zero
 *   - the last leg ends on the real payout, wherever inside its band that falls
 *
 * A win below the entry tier (a full-game win as small as 6.6x) yields exactly
 * one leg, 0 -> the amount, labelled "Big Win".
 */
export function countUpSegments(finalMultiplier: number, earned: WinTier): CountUpSegment[] {
  const earnedIndex = WIN_TIERS.findIndex((tier) => tier.id === earned.id);
  if (earnedIndex < 0) return [];

  const segments: CountUpSegment[] = [];
  for (let i = 0; i <= earnedIndex; i++) {
    const tier = WIN_TIERS[i]!;
    const isLast = i === earnedIndex;
    const fromMultiplier = i === 0 ? 0 : tier.minMultiplier;
    const toMultiplier = isLast ? finalMultiplier : WIN_TIERS[i + 1]!.minMultiplier;
    const isHold = toMultiplier <= fromMultiplier;

    segments.push({
      tier,
      fromMultiplier,
      toMultiplier: isHold ? fromMultiplier : toMultiplier,
      durationMs: isHold ? HOLD_MS : segmentDurationMs(tier),
      isHold,
    });
  }
  return segments;
}

/**
 * How long the takeover holds on screen during an auto run before leaving by
 * itself, in milliseconds.
 *
 * Scaled by tier rather than flat. A single fixed hold has to be short enough
 * not to drag on the common tier, which then flashes the rare ones past too
 * fast to read - and the rare ones are the whole reason a player leaves autoplay
 * running. The figure is already final here (autoplay skips the count-up
 * entirely), so this is purely reading time.
 */
export function autoHoldMs(tier: WinTier): number {
  switch (tier.id) {
    case 'big':
      return 1600;
    case 'huge':
      return 1900;
    case 'mega':
      return 2300;
    case 'epic':
      return 2800;
    case 'max':
      return 3500;
  }
}
