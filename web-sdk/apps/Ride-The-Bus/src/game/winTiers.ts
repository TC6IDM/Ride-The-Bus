/**
 * How big a win has to be before the game stops to celebrate it.
 *
 * EVERY BAND IS PER FAMILY, because a tier is a statement about RARITY and the
 * three families spread their payouts differently. Sharing one set of
 * thresholds made the same word mean different things: at a flat 300x, "Epic"
 * was 1 in 16,198 on Classic but 1 in 26,768 on Second Chance - nearly as rare
 * as that mode's Max Win, so the top of its ladder was squashed into a single
 * step - and only 1 in 12,238 on High Stakes, which pays a busted round less and
 * so climbs higher. Second Chance could not reach 300x often enough for Epic to
 * mean anything, and High Stakes reached it too easily.
 *
 * So each family's bands are solved to land on the SAME rarities, which are
 * Classic's originals: roughly 1 in 70, 1 in 305, 1 in 3,093 and 1 in 15,561,
 * with Max Win being exactly that family's ceiling (~1 in 36,400 in all three).
 *
 * The figures come from exhaustive enumeration of the payout model - every
 * ordered four-card draw against all 64 combinations, reweighted the way
 * reweight_luts.py reweights the published tables, and averaged over the
 * combinations with equal weight because every mode costs the same and a player
 * picks exactly one per round. That reproduces the Classic frequencies this
 * ladder originally shipped with (70 / 304 / 3,083 / 16,198 measured against
 * 70 / 305 / 3,093 / 15,561 documented), which is what makes the other two
 * families' numbers trustworthy.
 *
 *                    Big        Huge        Mega         Epic          Max
 *   Classic        10x  1:70   40x 1:304  120x 1:3083  300x 1:16198  1354.2x 1:36380
 *   Second Chance  11x  1:70   28x 1:290   60x 1:3048  130x 1:15730   585.2x 1:36435
 *   High Stakes    12x  1:72   50x 1:297  130x 1:3437  440x 1:16107  1910.2x 1:36335
 *
 * Each family's Epic sits below a gap in its own distribution, for the reason
 * Classic's sits at 300x rather than a rounder 400x: nothing pays between 381.9x
 * and 1260x there, so a threshold inside the gap would be RARER than the Max Win
 * above it and the ladder would read backwards. The gaps are at 381.9x->1260x
 * (Classic), 172.2x->549.1x (Second Chance) and 531.3x->1771.8x (High Stakes).
 *
 * Tiering is on PAYOUT SIZE, not on surviving all four cards. Busting on card 3
 * or 4 still keeps a share of the multiplier built so far and reaches 129x,
 * which pays more than a typical full-game win (no-equal modes average 17.3x). A
 * celebration keyed on "all four correct" would fire on 3x wins while passing
 * over the biggest partials in silence. The one place that flag still matters is
 * per family - see celebrateEveryFullWin in modes.ts.
 */
import { FAMILY_RULES, type ModeFamily } from './modes.ts';

/** CLASSIC's true ceiling, proven by exhaustive enumeration - see math-sdk
 * games/ride_the_bus/game_config.py. The published `max_win` of 1400 is a
 * declared bound that never binds, so it is NOT the right number to celebrate.
 *
 * This is the BASE family's ceiling, not the game's. Second Chance stops at
 * 585.2x and High Stakes reaches 1910.2x - use winTiersFor to get a family's
 * own ladder. Kept as the default so callers with no family behave as before. */
export const MAX_WIN_MULTIPLIER = FAMILY_RULES.base.maxWin;

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

/**
 * Each family's four lower bands, as measured multipliers.
 *
 * The Max band is not here: its floor IS the family's ceiling, which already
 * lives in FAMILY_RULES.maxWin, and restating it would be a second copy of a
 * number the tests pin to the payout maths.
 */
const FAMILY_BANDS: Record<ModeFamily, readonly [number, number, number, number]> = {
  base: [10, 40, 120, 300],
  sc: [11, 28, 60, 130],
  hs: [12, 50, 130, 440],
};

/** Measured frequency of each band or better, including Max. For the rules
 *  screen and the test plan - nothing branches on these. */
const FAMILY_ONE_IN: Record<ModeFamily, readonly [number, number, number, number, number]> = {
  base: [70, 304, 3083, 16198, 36380],
  sc: [70, 290, 3048, 15730, 36435],
  hs: [72, 297, 3437, 16107, 36335],
};

const TIER_META = [
  { id: 'big', label: 'Big Win' },
  { id: 'huge', label: 'Huge Win' },
  { id: 'mega', label: 'Mega Win' },
  { id: 'epic', label: 'Epic Win' },
] as const;

/**
 * One family's ladder, ordered LOW to HIGH.
 *
 * winTierFor scans backwards, so the order is load-bearing - and so is the
 * invariant that each band sits above the one below it. winTiers.test.ts
 * asserts both, per family, because a ladder that is merely plausible is not
 * enough: an out-of-order band silently makes a tier unreachable.
 */
export function winTiersFor(family: ModeFamily): readonly WinTier[] {
  const bands = FAMILY_BANDS[family];
  const oneIn = FAMILY_ONE_IN[family];
  return [
    ...TIER_META.map((meta, i) => ({
      id: meta.id,
      minMultiplier: bands[i]!,
      label: meta.label,
      oneIn: oneIn[i]!,
    })),
    {
      id: 'max' as const,
      minMultiplier: FAMILY_RULES[family].maxWin,
      label: 'Max Win' as const,
      oneIn: oneIn[4]!,
    },
  ];
}

/** The Classic ladder, and the default for callers that name no family. */
export const WIN_TIERS: readonly WinTier[] = winTiersFor('base');

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
export function winTierFor(
  multiplier: number,
  fullGameWin = false,
  tiers: readonly WinTier[] = WIN_TIERS,
): WinTier | null {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return null;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (multiplier >= tiers[i]!.minMultiplier - EPSILON) return tiers[i]!;
  }
  return fullGameWin ? tiers[0]! : null;
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
  /** How long this leg spends climbing. Zero for a hold - there is nothing to
   * animate, so it lands the moment it is reached. */
  durationMs: number;
  /**
   * True when the leg has nowhere to climb. Happens on a Max Win, where the top
   * tier's floor IS the game ceiling so the previous leg already carried the
   * number there, and on any win landing exactly on a threshold (40.0x earning
   * Huge, say). The leg is kept rather than dropped so the title still gets its
   * moment - it just arrives instead of counting.
   *
   * A hold is always the LAST leg, so reaching one means the celebration is
   * finished: the prompt switches to "tap to continue" straight away rather than
   * offering to skip a count that does not exist.
   */
  isHold: boolean;
};

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
export function countUpSegments(
  finalMultiplier: number,
  earned: WinTier,
  tiers: readonly WinTier[] = WIN_TIERS,
): CountUpSegment[] {
  const earnedIndex = tiers.findIndex((tier) => tier.id === earned.id);
  if (earnedIndex < 0) return [];

  const segments: CountUpSegment[] = [];
  for (let i = 0; i <= earnedIndex; i++) {
    const tier = tiers[i]!;
    const isLast = i === earnedIndex;
    const fromMultiplier = i === 0 ? 0 : tier.minMultiplier;
    const toMultiplier = isLast ? finalMultiplier : tiers[i + 1]!.minMultiplier;
    const isHold = toMultiplier <= fromMultiplier;

    segments.push({
      tier,
      fromMultiplier,
      toMultiplier: isHold ? fromMultiplier : toMultiplier,
      durationMs: isHold ? 0 : segmentDurationMs(tier),
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
