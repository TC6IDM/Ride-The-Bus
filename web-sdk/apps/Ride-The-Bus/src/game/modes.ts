/**
 * Which four-stage choice combinations are actually playable.
 *
 * Every bet in this game is one bet mode encoding the player's whole set of
 * guesses - see math-sdk games/ride_the_bus/game_calculations.py:mode_name - so
 * the client can only offer combinations the math actually published. There are
 * 64, not the 72 the four choice lists multiply out to.
 *
 * THE MISSING EIGHT
 *
 * Stage 2 "equal" means card 2 ties card 1's rank. Stage 3 "inside" means card 3
 * lands strictly between the two reference ranks. If those ranks are identical
 * there is nothing strictly between them, so equal-then-inside cannot be won -
 * not rarely, but never. The math excludes it deliberately: a mode that loses
 * 100% of the time has zero variance, and Stake's RGS rejects the upload
 * outright with "failed to obtain distribution statistics from lookup table".
 *
 * That leaves 2 colours x (3 x 3 - 1) x 4 suits = 64.
 *
 * The client has to enforce the same rule. It previously did not: the four
 * choice buttons were independent, so a player could select equal then inside,
 * the Start button stayed enabled, and the mode string built by concatenation
 * came out as e.g. "black_equal_inside_heart" - a mode that does not exist.
 * Locally that is invisible, because without a sessionID and rgs_url the game
 * deals from roundContract and never sends a mode at all; against a real RGS the
 * bet is simply rejected.
 */

export const COLOR_CHOICES = ['red', 'black'] as const;
export const HIGHER_LOWER_CHOICES = ['higher', 'lower', 'equal'] as const;
export const INSIDE_OUTSIDE_CHOICES = ['inside', 'outside', 'equal'] as const;
export const SUIT_CHOICES = ['heart', 'diamond', 'club', 'spade'] as const;

export type ColorChoice = (typeof COLOR_CHOICES)[number];
export type HigherLowerChoice = (typeof HIGHER_LOWER_CHOICES)[number];
export type InsideOutsideChoice = (typeof INSIDE_OUTSIDE_CHOICES)[number];
export type SuitChoice = (typeof SUIT_CHOICES)[number];

/**
 * False only for the one impossible pairing. Takes nulls so it can be called
 * straight from partially-made selections in the UI: an unmade choice cannot
 * conflict with anything yet, so it is treated as playable.
 */
export function isCombinationPlayable(
  higherLower: HigherLowerChoice | null,
  insideOutside: InsideOutsideChoice | null,
): boolean {
  return !(higherLower === 'equal' && insideOutside === 'inside');
}

/* ---- Mode families --------------------------------------------------------
 *
 * The same four guesses can be bought three ways. What differs is only what a
 * MISS keeps, and because the math reweights every mode onto the same RTP, a
 * family that forgives more cannot also pay more - the two are one dial seen
 * from opposite ends.
 *
 * Must stay in step with math-sdk game_calculations.py:MODE_FAMILIES. The
 * retention and forgiveness numbers below are what the stage multipliers are
 * priced against; if they drift from the Python the game shows a player one
 * number while the RGS credits another. payoutTable.test.ts pins them.
 */
export const MODE_FAMILIES = ['base', 'sc', 'hs'] as const;
export type ModeFamily = (typeof MODE_FAMILIES)[number];

export type FamilyRules = {
  /** Prepended to the mode name. Empty for base, whose names are published. */
  prefix: string;
  /** Cost multiplier. The base mode is 1.0 and must stay the cheapest. */
  cost: number;
  /** Fraction of the running multiplier kept on a miss, per stage. */
  retention: readonly [number, number, number, number];
  /** Fraction kept by a FORGIVEN miss, or null when the family forgives none. */
  forgive: number | null;
  /** First stage forgiveness can apply to. Card 1 is never forgiven. */
  forgiveFrom: number;
  /** English label, which is also the i18n key. */
  label: 'Classic' | 'Second Chance' | 'High Stakes';
  /**
   * The most this family can pay, as a multiple of the BET.
   *
   * Stake's convention throughout: payoutMultiplier is expressed against the
   * base bet, never against the cost. Mixing the two is what produced a game
   * claiming 3820.5x in one place and 1910.2x in another for the same mode -
   * both were arithmetically right, and one of them had to go.
   *
   * Data rather than prose so the figure lives in one place, needs no
   * translation, and cannot drift: payout.test.ts asserts it equals what the
   * payout maths actually reaches.
   */
  maxWin: number;
};

const BASE_RETENTION = [0, 0.3, 0.3, 0.3] as const;

export const FAMILY_RULES: Record<ModeFamily, FamilyRules> = {
  base: {
    prefix: '',
    cost: 1,
    retention: BASE_RETENTION,
    forgive: null,
    forgiveFrom: 0,
    label: 'Classic',
    maxWin: 1354.2,
  },
  sc: {
    prefix: 'sc_',
    cost: 2,
    retention: BASE_RETENTION,
    forgive: 0.5,
    // Card 1 still ends the round. Forgiving it too left almost no round paying
    // zero, which pushed the mode's win-conditional mean below its reweight
    // target and made the table unbuildable - see the Python for the full note.
    forgiveFrom: 1,
    label: 'Second Chance',
    maxWin: 1170.4,
  },
  hs: {
    prefix: 'hs_',
    cost: 2,
    retention: [0, 0.2, 0.2, 0.2],
    forgive: null,
    forgiveFrom: 0,
    label: 'High Stakes',
    maxWin: 3820.5,
  },
};

/**
 * One line per family, for the mode picker and the rules screen.
 *
 * English text doubles as the i18n key, and the literal union is what lets
 * `t()` accept it - the same reason winTiers.ts types its labels that way.
 * The numbers are the measured ceilings, so they cannot drift into marketing.
 */
export const FAMILY_BLURB: Record<ModeFamily, string> & {
  base: 'A wrong first card ends the round. Later misses keep 30% of what you had built.';
  sc: 'Card 1 still ends the round. After that your first wrong guess is forgiven and play continues.';
  hs: 'Misses keep only 20%, so every correct guess is worth more.';
} = {
  base: 'A wrong first card ends the round. Later misses keep 30% of what you had built.',
  sc: 'Card 1 still ends the round. After that your first wrong guess is forgiven and play continues.',
  hs: 'Misses keep only 20%, so every correct guess is worth more.',
};

/** Longest prefix first, so "sc_" is tested before base's empty one. */
const PREFIXED_FAMILIES = MODE_FAMILIES.slice()
  .sort((a, b) => FAMILY_RULES[b].prefix.length - FAMILY_RULES[a].prefix.length)
  .filter((family) => FAMILY_RULES[family].prefix.length > 0);

/** The family a published mode name belongs to. */
export function familyOf(mode: string): ModeFamily {
  for (const family of PREFIXED_FAMILIES) {
    if (mode.startsWith(FAMILY_RULES[family].prefix)) return family;
  }
  return 'base';
}

/** Bet mode name. Must match math-sdk game_calculations.py:mode_name exactly. */
export function modeName(
  color: ColorChoice,
  higherLower: HigherLowerChoice,
  insideOutside: InsideOutsideChoice,
  suit: SuitChoice,
  family: ModeFamily = 'base',
): string {
  return `${FAMILY_RULES[family].prefix}${color}_${higherLower}_${insideOutside}_${suit}`;
}

/**
 * Every playable mode name, across all families. Mirrors all_published_modes()
 * on the math side - 3 x 64 = 192.
 */
export function allPlayableModes(): string[] {
  const names: string[] = [];
  for (const family of MODE_FAMILIES) {
    for (const color of COLOR_CHOICES) {
      for (const higherLower of HIGHER_LOWER_CHOICES) {
        for (const insideOutside of INSIDE_OUTSIDE_CHOICES) {
          if (!isCombinationPlayable(higherLower, insideOutside)) continue;
          for (const suit of SUIT_CHOICES) {
            names.push(modeName(color, higherLower, insideOutside, suit, family));
          }
        }
      }
    }
  }
  return names;
}
