/**
 * How big a win has to be before the game stops to celebrate it.
 *
 * EVERY BAND IS PER FAMILY, because a tier is a statement about RARITY and the
 * guess families spread their payouts differently. Sharing one set of
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
 * The bands were SOLVED by exhaustive enumeration of the payout model - every
 * ordered four-card draw against all 64 combinations, reweighted the way
 * reweight_luts.py reweights the published tables. The rarities printed beside
 * them are MEASURED, off the published lookup tables of the build that ships:
 * each family's 64 tables, averaged with equal weight because every mode costs
 * the same and a player picks exactly one per round. That is the same
 * distribution the RGS pays from, and it reproduces the frequencies this
 * ladder was originally documented with (Classic 70 / 305 / 3,093 / 15,561) to
 * the digit, which is what makes the other two families' numbers trustworthy.
 *
 *                    Big        Huge        Mega         Epic          Max
 *   Classic        10x  1:70   40x 1:305  120x 1:3092  300x 1:15561  1354.2x 1:36384
 *   Second Chance  11x  1:70   28x 1:290   60x 1:3063  130x 1:15469   585.2x 1:36542
 *   High Stakes    12x  1:68   55x 1:295  145x 1:2818  500x 1:15444  2237.3x 1:36248
 *
 * High Stakes' row was re-solved when its retention went from 20% to 16% (from
 * 12 / 50 / 130 / 440, max 1910.2x) and re-measured when it went to 15% on
 * 2026-09-22. The four bands did not move that second time: on the 0.15
 * distribution 12 / 55 / 145 / 500 are still the round thresholds closest to
 * the target rarities (at Big, 13x is exactly as close - 1 in 72 against 1 in
 * 68 - and the shipped 12x is kept). Only the frequencies and the ceiling
 * changed, which is why this table moved and the one below it did not.
 *
 * Each family's Epic sits below a gap in its own distribution, for the reason
 * Classic's sits at 300x rather than a rounder 400x: nothing pays between 381.9x
 * and 1260x there, so a threshold inside the gap would be RARER than the Max Win
 * above it and the ladder would read backwards. The gaps are at 381.9x->1260x
 * (Classic), 172.2x->549.1x (Second Chance) and 618.7x->2072.4x (High Stakes).
 *
 * THREE OF A KIND HAS ONE RUNG, AND IT IS MAX. Its only win IS its ceiling -
 * 4,583.3x the base bet, about 1 in 19 - so a five-band ladder would invent four
 * thresholds nothing ever lands between. winTiersFor returns a single Max tier
 * sitting on the ceiling: the win is the most the mode can pay, so it is called
 * that, even though it is not rare the way the other families' Max is. The
 * rarity semantics of the label are a property of the ladder families;
 * winTierFor already handles a one-tier list (equality on the last tier, and
 * the full-game floor lands on tiers[0], which is the same tier).
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
 * 585.2x and High Stakes reaches 2237.3x - use winTiersFor to get a family's
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
/** The families that climb a ladder - every family whose guesses are its own. */
type LadderFamily = Exclude<ModeFamily, 'tr'>;

const FAMILY_BANDS: Record<LadderFamily, readonly [number, number, number, number]> = {
  base: [10, 40, 120, 300],
  sc: [11, 28, 60, 130],
  hs: [12, 55, 145, 500],
};

/** Measured frequency of each band or better, including Max - read off the
 *  published lookup tables of the shipping build, 64 per family at equal
 *  weight. For the rules screen and the test plan; nothing branches on these. */
const FAMILY_ONE_IN: Record<LadderFamily, readonly [number, number, number, number, number]> = {
  base: [70, 305, 3092, 15561, 36384],
  sc: [70, 290, 3063, 15469, 36542],
  hs: [68, 295, 2818, 15444, 36248],
};

/**
 * How often a one-rung family's single win lands - its RECORDED frequency,
 * after the reweighter. Three of a Kind is 18.333 x cost at 96% RTP: 1 in 19.
 */
const SINGLE_RUNG_ONE_IN: Record<Exclude<ModeFamily, LadderFamily>, number> = {
  tr: 19,
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
  if (FAMILY_RULES[family].fixedChoices) {
    // One rung, sitting on the ceiling, and it is Max - see the header.
    return [
      {
        id: 'max' as const,
        minMultiplier: FAMILY_RULES[family].maxWin,
        label: 'Max Win' as const,
        oneIn: SINGLE_RUNG_ONE_IN[family as Exclude<ModeFamily, LadderFamily>],
      },
    ];
  }
  const bands = FAMILY_BANDS[family as LadderFamily];
  const oneIn = FAMILY_ONE_IN[family as LadderFamily];
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

  // The Max band is matched on EQUALITY, not on ">= its floor" like every band
  // below it. "Max Win" is a claim about hitting the ceiling exactly, and the
  // ceiling is a single reachable multiplier (1354.2 / 585.2 / 2237.3) rather
  // than the bottom of an open-ended range - so a payout ABOVE it is not a max
  // win, it is a number this ladder cannot explain, and announcing the rarest
  // screen in the game over it would be a lie about what the player just did.
  //
  // Nothing in the published books can reach past a family's ceiling (payout.
  // test.ts replays all 76,800), so on a correct build this is unobservable.
  // It exists for the builds that are not correct: the published `max_win`
  // bound is 1400 against a true Classic ceiling of 1354.2, and the last thing
  // that read this ladder with the wrong family attached turned a 1400x High
  // Stakes win into a Classic "MAX WIN". Such a payout now falls to Epic, which
  // understates it - the safe direction to be wrong in.
  const max = tiers[tiers.length - 1]!;
  if (Math.abs(multiplier - max.minMultiplier) <= EPSILON) return max;

  for (let i = tiers.length - 2; i >= 0; i--) {
    if (multiplier >= tiers[i]!.minMultiplier - EPSILON) return tiers[i]!;
  }
  return fullGameWin ? tiers[0]! : null;
}

/**
 * How long the last card is held before it turns, in milliseconds at normal
 * speed. Scales with the tier it would land; turbo and a slam shrink it like
 * every other reveal pause (revealWait).
 */
export const LAST_CARD_HOLD_MS: Readonly<Record<WinTierId, number>> = {
  big: 450,
  huge: 650,
  mega: 850,
  epic: 1050,
  max: 1400,
};

/**
 * The hold before the last card, or 0.
 *
 * A lot riding on one card is the moment this game is about, and it used to
 * turn on the same 650ms beat as every other card - a 1-in-190,000 Max Win
 * resolved in 2.7 seconds flat. The card now waits, longer the more it would
 * pay: nothing below the entry tier, longest for Max.
 *
 * Decided ONLY from what is riding on it - the multiplier the round pays if
 * the card lands, which is known before it turns. Never from whether it does:
 * a hold that fired on winners alone would announce the result before the card
 * did, which is the near-miss theatre regulators object to. There is no
 * `correct` among the inputs, and winTiers.test.ts holds a winner and a loser
 * with the same stake to the same hold.
 *
 * `fullGameWin` floors it at the entry tier exactly as winTierFor floors the
 * takeover: if the card lands, the round is a clean sweep and will celebrate.
 */
export function lastCardHoldMs(
  landingMultiplier: number,
  fullGameWin: boolean,
  tiers: readonly WinTier[] = WIN_TIERS,
): number {
  const tier = lastCardTier(landingMultiplier, fullGameWin, tiers);
  return tier ? LAST_CARD_HOLD_MS[tier] : 0;
}

/**
 * The tier the held last card could land, or null - the one figure the hold's
 * length (lastCardHoldMs), its sound (the voices and the strike scale with it,
 * sound.ts HOLD_SHAPE) and its tunnel (lastCardTunnels) are all read from.
 * Like them, from the stake alone and never from whether the card lands.
 */
export function lastCardTier(
  landingMultiplier: number,
  fullGameWin: boolean,
  tiers: readonly WinTier[] = WIN_TIERS,
): WinTierId | null {
  return winTierFor(landingMultiplier, fullGameWin, tiers)?.id ?? null;
}

/**
 * Whether this round's last card may be held at all: only when the round
 * carries an Equal pick. Three of a Kind always does - its two Equals are the
 * mode - so its card 3 always may.
 *
 * WHY. Every clean run to the last card used to be held, because the full-win
 * floor lifts any of them onto the ladder. On the easy picks (colour, Higher,
 * Outside, a suit) that was about one round in seven, and three held cards in
 * four then missed their suit - the crowd, the strike and the tunnel as often
 * as a card flip, which is how a big moment stops being one. Equal is this
 * game's long shot, and a last card with an Equal behind it is the stake the
 * hold exists for. Measured against the dealt frequencies (deck odds times each
 * mode's reweight): one Equal on Classic or High Stakes is held about 1 in 33
 * rounds, two Equals about 1 in 835, no Equal never; Second Chance, whose Equal
 * miss is usually forgiven and plays on with a big stake, about 1 in 11-15;
 * Three of a Kind 1 in 3.7. The owner's call, 2026-09-25.
 *
 * Read off the book's own choices for the round - what was bet, never what
 * landed - so, like lastCardHoldMs, it cannot say anything about the result.
 */
export function lastCardHolds(choices: readonly string[]): boolean {
  return choices.includes('equal');
}

/** The part of a held card's wait spent AT the top, at most - and at most this
 *  share of the wait, so a short hold (a Big win's 1.1s, or turbo) is still
 *  mostly climb. */
export const HOLD_TOP_MS = 400;
export const HOLD_TOP_SHARE = 0.35;

/**
 * How much of a held card's wait is the climb, in milliseconds.
 *
 * `waitMs` is the whole wait as it will actually run - the hold plus the
 * ordinary beat before a turn, turbo-scaled. The card and its hum rise
 * together, in a straight line, for this long; then both sit at the top for
 * the rest; then the card slams down. ONE number for both, so the card cannot
 * finish rising before the sound does or the other way round. The shape is
 * the owner's, by ear: up in a straight line, stay at the top, slam down.
 */
export function holdClimbMs(waitMs: number): number {
  return waitMs - Math.min(HOLD_TOP_MS, waitMs * HOLD_TOP_SHARE);
}

/** The tiers from the bottom up - the order every ladder is written in. */
const TIER_ORDER: readonly WinTierId[] = ['big', 'huge', 'mega', 'epic', 'max'];

/**
 * The lowest tier a held last card must be able to land before the room
 * closes in on it (tunnel vision). Below it - a Big win - the card still
 * rises and its hum still climbs and strikes, but the room stays lit: the
 * tunnel is kept for the bigger stakes so it stays an event. The owner's call.
 */
export const TUNNEL_FROM: WinTierId = 'huge';

/**
 * Whether the held last card gets tunnel vision: the tier it would land is
 * TUNNEL_FROM or above. Like lastCardHoldMs, decided from the stake alone and
 * never from whether the card lands - there is no `correct` among the inputs.
 * Three of a Kind's one-rung ladder is Max, so its held card always tunnels.
 */
export function lastCardTunnels(
  landingMultiplier: number,
  fullGameWin: boolean,
  tiers: readonly WinTier[] = WIN_TIERS,
): boolean {
  const tier = winTierFor(landingMultiplier, fullGameWin, tiers);
  return tier !== null && TIER_ORDER.indexOf(tier.id) >= TIER_ORDER.indexOf(TUNNEL_FROM);
}

/**
 * Whether a settled round is a win in the sense a player means it: the payout
 * covers what the round cost.
 *
 * Every guess family keeps a share of the built multiplier on a miss (30% on
 * Classic, 15% on High Stakes, half on a forgiven Second Chance card), so most
 * paying rounds pay LESS than they cost - 40-50% of all Classic rounds and up
 * to 64% on High Stakes, against 3-14% that pay the bet or more
 * (stats_summary.json, 2026-09-22 build). Those rounds used to get the green
 * amount and the win sting like any other payout: a loss presented as a win.
 * This is the line between the two. At or above the cost the round won; below
 * it the round returned part of the stake, and the board says so without
 * celebrating.
 *
 * Both arguments are multiples of the BET, the convention every payout figure
 * in the game uses - so Three of a Kind's cost is 250 and its only win 4583.3.
 * Break-even counts as a win: the player lost nothing.
 */
export function isNetWin(multiplier: number, costMultiplier: number): boolean {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return false;
  return multiplier >= costMultiplier - EPSILON;
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
