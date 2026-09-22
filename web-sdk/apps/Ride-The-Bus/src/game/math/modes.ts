/**
 * Which choice combinations are actually playable - the 64 four-stage ones on
 * the guess families, and Three of a Kind's single three-stage one.
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

import { MODE_CEILINGS } from './modeCeilings.ts';
import type { Card } from '../round/roundContract.ts';

export const COLOR_CHOICES = ['red', 'black'] as const;
export const HIGHER_LOWER_CHOICES = ['higher', 'lower', 'equal'] as const;
export const INSIDE_OUTSIDE_CHOICES = ['inside', 'outside', 'equal'] as const;
export const SUIT_CHOICES = ['heart', 'diamond', 'club', 'spade'] as const;

/**
 * A stage with no guess at all: the card is dealt and shown, it is always
 * "correct", and it pays exactly 1.00x. Only a family with `fixedChoices` uses
 * it, and only at the stages that family says. Mirrors FREE_CHOICE in
 * game_calculations.py.
 */
export const FREE_CHOICE = 'any';

export type ColorChoice = (typeof COLOR_CHOICES)[number];
export type HigherLowerChoice = (typeof HIGHER_LOWER_CHOICES)[number];
export type InsideOutsideChoice = (typeof INSIDE_OUTSIDE_CHOICES)[number];
export type SuitChoice = (typeof SUIT_CHOICES)[number];
/** One token of a mode slug - a guess, or the free card. */
export type StageChoice =
  | ColorChoice
  | HigherLowerChoice
  | InsideOutsideChoice
  | SuitChoice
  | typeof FREE_CHOICE;
/**
 * One token per stage. Four on the four-guess families, three on Three of a
 * Kind - the tuple's length IS the family's stage count, on both sides of the
 * wire (gamestate.py deals `len(choices)` cards).
 */
export type ChoiceTuple =
  | readonly [StageChoice, StageChoice, StageChoice, StageChoice]
  | readonly [StageChoice, StageChoice, StageChoice];

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
 * The same four guesses can be bought three ways, and a fourth family plays a
 * different game on the same table. Among the three, what differs is only what
 * a MISS keeps, and because the math reweights every mode onto the same RTP, a
 * family that forgives more cannot also pay more - the two are one dial seen
 * from opposite ends.
 *
 * Must stay in step with math-sdk game_calculations.py:MODE_FAMILIES. The
 * retention and forgiveness numbers below are what the stage multipliers are
 * priced against; if they drift from the Python the game shows a player one
 * number while the RGS credits another. payoutTable.test.ts pins them.
 */
export const MODE_FAMILIES = ['base', 'sc', 'hs', 'tr'] as const;
export type ModeFamily = (typeof MODE_FAMILIES)[number];

/** A family's deck: the standard 52 unless it names its own ranks and copies. */
export type DeckSpec = {
  /** Ranks in the deck, in roundContract's `ranks` order. */
  ranks: readonly Card['rank'][];
  /** How many of each card. */
  copies: number;
};

export type FamilyRules = {
  /** Prepended to the mode name. Empty for base, whose names are published. */
  prefix: string;
  /**
   * Cost multiplier. The base mode is 1.0 and must stay the cheapest.
   *
   * The three four-guess families are 1.0, and that is forced rather than
   * chosen: etl40b is an absolute sum against a fixed limit and is not divided
   * by cost, so a 2x mode's figure doubles for the same shape and only a
   * low-volatility family survives it. Three of a Kind can be 250x precisely
   * because it escapes that sum - its payout never reaches 40x its cost - and
   * it is no MORE than that because Stake's tail rules are written in base-bet
   * multiples and cap a binary win under 5,000x. See THE ALL-OR-NOTHING BOUND
   * in game_calculations.py. The multiplied-bet readout in the control bar,
   * quiet while every cost was 1.0, is live again.
   */
  cost: number;
  /** Fraction of the running multiplier kept on a miss, per stage - one entry per stage the family deals. */
  retention: readonly number[];
  /** Fraction kept by a FORGIVEN miss, or null when the family forgives none. */
  forgive: number | null;
  /** First stage forgiveness can apply to. Card 1 is never forgiven. */
  forgiveFrom: number;
  /**
   * The pricing target decay**4 is solved from - payout.ts:TARGET_RTP unless
   * the family overrides it. Three of a Kind prices at exactly 1.0 so its
   * free card pays 1.00x rather than 0.9975, which the 0.1x display floor
   * would show as 0.9x on a card that was never a guess.
   */
  targetRtp: number;
  /** The deck this family deals from. Null is the standard 52. */
  deck: DeckSpec | null;
  /**
   * The slug tokens, for a family that has no guesses at all. Null on the
   * families where the player picks. When set, the board is a preset built
   * from these and `guesses` in betState is ignored - not cleared, so a
   * player's picks survive a round trip through the family. Its length is
   * the family's stage count: Three of a Kind deals three cards, not four.
   */
  fixedChoices: ChoiceTuple | null;
  /** English label, which is also the i18n key. */
  label: 'Classic' | 'Second Chance' | 'High Stakes' | 'Three of a Kind';
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
  /**
   * Does landing all four cards celebrate on its own, however small it pays?
   *
   * winTierFor takes a `fullGameWin` flag that floors a complete round at the
   * bottom tier, so the game's defining moment is never met with silence - the
   * smallest possible full win is 6.6x, under the 10x entry threshold.
   *
   * TRUE EVERYWHERE, INCLUDING SECOND CHANCE - but the caller only passes it for
   * a CLEAN SWEEP. See cleanSweep() below.
   *
   * It was false for Second Chance, and that was too blunt. The reasoning was
   * sound as far as it went: forgiveness means a round survives its first wrong
   * guess, so "reached card 4" stops being the rare event the floor was written
   * for and the takeover fired on most rounds, which is an interruption rather
   * than a celebration. But suppressing it for the whole family also swallowed
   * the case the floor exists for - four correct guesses, no forgiveness spent,
   * the same 1-in-70 event that takes the screen over in Classic - and a player
   * who nailed all four in Second Chance got nothing for it.
   *
   * The distinction the old flag could not draw is between "finished the round"
   * and "did not get it wrong". Forgiveness is what makes those two different,
   * and it is tracked per round, not per family - so the rule belongs at the
   * call site.
   */
  celebrateEveryFullWin: boolean;
};

const BASE_RETENTION = [0, 0.3, 0.3, 0.3] as const;

/** The four-guess families' pricing target - payout.ts owns the constant. */
const FOUR_GUESS_TARGET_RTP = 0.99;

/**
 * Three of a Kind's deck: the Ace, King and Queen of each suit, one of each.
 * Twelve cards. Card 2 matches card 1's rank 3 times in 11, card 3 matches 2
 * in 10 - fair odds 1 x 11/3 x 5 = 18.333x, a physical 1 in 18.3. Mirrors
 * TRIPS_DECK in game_calculations.py, whose comment carries the derivation.
 */
export const TRIPS_DECK: DeckSpec = { ranks: ['Q', 'K', 'A'], copies: 1 };
/** Its one combination: card 1 dealt, cards 2 and 3 must match. Three stages. */
export const TRIPS_COMBO: ChoiceTuple = [FREE_CHOICE, 'equal', 'equal'];

export const FAMILY_RULES: Record<ModeFamily, FamilyRules> = {
  base: {
    prefix: '',
    cost: 1,
    retention: BASE_RETENTION,
    forgive: null,
    forgiveFrom: 0,
    targetRtp: FOUR_GUESS_TARGET_RTP,
    deck: null,
    fixedChoices: null,
    label: 'Classic',
    maxWin: 1354.2,
    celebrateEveryFullWin: true,
  },
  sc: {
    prefix: 'sc_',
    cost: 1,
    retention: BASE_RETENTION,
    forgive: 0.5,
    // Card 1 still ends the round. Forgiving it too left almost no round paying
    // zero, which pushed the mode's win-conditional mean below its reweight
    // target and made the table unbuildable - see the Python for the full note.
    forgiveFrom: 1,
    targetRtp: FOUR_GUESS_TARGET_RTP,
    deck: null,
    fixedChoices: null,
    label: 'Second Chance',
    maxWin: 585.2,
    celebrateEveryFullWin: true,
  },
  hs: {
    prefix: 'hs_',
    cost: 1,
    // 0.16, down from 0.20: the last step that clears Stake's CVaR limit
    // (~692 measured against 700; 0.15 is 722). A card-2 bust still shows 0.3x
    // - 1.995 x 0.16 x 0.995 floors to it - so only card-3/4 busts pay less.
    retention: [0, 0.16, 0.16, 0.16],
    forgive: null,
    forgiveFrom: 0,
    targetRtp: FOUR_GUESS_TARGET_RTP,
    deck: null,
    fixedChoices: null,
    label: 'High Stakes',
    maxWin: 2169.2,
    celebrateEveryFullWin: true,
  },
  /**
   * The all-or-nothing mode, and the only family that is not the four-guess
   * ride: three cards, nothing back on any miss, one outcome, 4,583.3x the base
   * bet at cost 250x (18.333x what was paid, fair odds on its deck). Everything
   * unusual about it - the deck, the free card, the cost, why the win must sit
   * under 5,000x - is argued in THE ALL-OR-NOTHING BOUND in
   * game_calculations.py; this record only mirrors it.
   */
  tr: {
    prefix: 'tr_',
    cost: 250,
    // Three stages, so three entries. Indexed by stage everywhere it is read.
    retention: [0, 0, 0],
    forgive: null,
    forgiveFrom: 0,
    targetRtp: 1,
    deck: TRIPS_DECK,
    fixedChoices: TRIPS_COMBO,
    label: 'Three of a Kind',
    maxWin: 4583.3,
    celebrateEveryFullWin: true,
  },
};

/** How many cards a family deals - the length of its combination. */
export function stageCount(rules: Pick<FamilyRules, 'fixedChoices'>): number {
  return rules.fixedChoices ? rules.fixedChoices.length : 4;
}

/**
 * One line per family, for the mode picker and the rules screen.
 *
 * English text doubles as the i18n key, and the literal union is what lets
 * `t()` accept it - the same reason winTiers.ts types its labels that way.
 * The numbers are the measured ceilings, so they cannot drift into marketing.
 */
export const FAMILY_BLURB: Record<ModeFamily, string> & {
  base: 'A wrong first card ends the round. Later misses keep 30% of what you had built.';
  sc: 'A wrong first card ends the round. After that your first miss is forgiven and play continues.';
  hs: 'A wrong first card ends the round. Later misses keep only 16%, so every correct guess is worth more.';
  tr: 'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.';
} = {
  base: 'A wrong first card ends the round. Later misses keep 30% of what you had built.',
  sc: 'A wrong first card ends the round. After that your first miss is forgiven and play continues.',
  hs: 'A wrong first card ends the round. Later misses keep only 16%, so every correct guess is worth more.',
  tr: 'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.',
};

/** Longest prefix first, so "sc_" is tested before base's empty one. */
const PREFIXED_FAMILIES = MODE_FAMILIES.slice()
  .sort((a, b) => FAMILY_RULES[b].prefix.length - FAMILY_RULES[a].prefix.length)
  .filter((family) => FAMILY_RULES[family].prefix.length > 0);

/**
 * Did the round go four-for-four with nothing forgiven?
 *
 * This is what "a full game win" has to mean once one family can survive a
 * wrong guess. A Second Chance round that used its forgiveness reached card 4
 * without having guessed all four correctly, and it is the guessing - not the
 * arriving - that the takeover's bottom-tier floor exists to acknowledge.
 *
 * Classic and High Stakes have no forgiveness, so forgivenIndex is always null
 * there and this is exactly "did not bust" - their behaviour is unchanged.
 *
 * Kept here rather than inline in Game.svelte so winTiers.test.ts can assert on
 * the same rule the board applies. The bug this shape prevents is the family
 * flag drifting from the condition the caller actually evaluates.
 */
export function isCleanSweep(
  bustedIndex: number | null,
  forgivenIndex: number | null,
): boolean {
  return bustedIndex === null && forgivenIndex === null;
}

/** The family a published mode name belongs to. */
export function familyOf(mode: string): ModeFamily {
  for (const family of PREFIXED_FAMILIES) {
    if (mode.startsWith(FAMILY_RULES[family].prefix)) return family;
  }
  return 'base';
}

/**
 * Bet mode name: the family prefix and one token per stage. Must match
 * math-sdk game_calculations.py:mode_name exactly.
 */
export function modeName(choices: ChoiceTuple, family: ModeFamily = 'base'): string {
  return `${FAMILY_RULES[family].prefix}${choices.join('_')}`;
}

/**
 * The slug tokens a family actually plays: its fixed combination when it has
 * one, the player's four guesses otherwise. Every caller that builds a slug
 * from `guesses` goes through this, so a fixed family can never be sent with
 * the guesses left on the board from the last four-guess mode.
 */
export function modeChoices(
  family: ModeFamily,
  guesses: {
    color: ColorChoice | null;
    hl: HigherLowerChoice | null;
    io: InsideOutsideChoice | null;
    suit: SuitChoice | null;
  },
): ChoiceTuple | null {
  const fixed = FAMILY_RULES[family].fixedChoices;
  if (fixed) return fixed;
  if (!guesses.color || !guesses.hl || !guesses.io || !guesses.suit) return null;
  return [guesses.color, guesses.hl, guesses.io, guesses.suit];
}

/**
 * Every combination a family publishes: its fixed one, or the 64. Mirrors
 * all_mode_combinations(family) in game_calculations.py.
 */
export function combosFor(family: ModeFamily): ChoiceTuple[] {
  const fixed = FAMILY_RULES[family].fixedChoices;
  if (fixed) return [fixed];
  const combos: ChoiceTuple[] = [];
  for (const color of COLOR_CHOICES) {
    for (const higherLower of HIGHER_LOWER_CHOICES) {
      for (const insideOutside of INSIDE_OUTSIDE_CHOICES) {
        if (!isCombinationPlayable(higherLower, insideOutside)) continue;
        for (const suit of SUIT_CHOICES) combos.push([color, higherLower, insideOutside, suit]);
      }
    }
  }
  return combos;
}

/**
 * A published mode name taken apart. Null when the string is not one.
 *
 * `choices` is the whole tuple, one token per stage; the four named fields
 * are the four-guess reading of it, with `suit` null on a family that deals
 * no fourth card.
 */
export type ParsedMode = {
  family: ModeFamily;
  choices: ChoiceTuple;
  color: ColorChoice | typeof FREE_CHOICE;
  higherLower: HigherLowerChoice;
  insideOutside: InsideOutsideChoice;
  suit: SuitChoice | typeof FREE_CHOICE | null;
};

/**
 * Inverse of modeName(). Mirrors math-sdk game_calculations.py:parse_mode_name.
 *
 * The family prefix is stripped BEFORE splitting, which is the whole point:
 * "sc_red_higher_equal_spade" has five underscore-separated parts, not four, so
 * anything that splits first and counts second reads every non-base mode as
 * malformed. The replay screen did exactly that and printed the raw slug.
 *
 * Returns null rather than throwing - it parses strings that arrive from the
 * RGS and from URLs, so a bad one is an expected input, not a bug.
 */
export function parseModeName(mode: string): ParsedMode | null {
  const family = familyOf(mode);
  const body = mode.slice(FAMILY_RULES[family].prefix.length);
  const parts = body.split('_');
  // Validated against what the family PUBLISHES, not against the four choice
  // lists or a part count: that is what keeps `any` out of every four-guess
  // family, equal+inside out of all of them, and a three-token slug out of a
  // four-stage family, in one check.
  const published = combosFor(family).find(
    (combo) => combo.length === parts.length && combo.every((token, i) => token === parts[i]),
  );
  if (!published) return null;
  const [color, higherLower, insideOutside, suit] = published;
  return {
    family,
    choices: published,
    color: color as ParsedMode['color'],
    higherLower: higherLower as HigherLowerChoice,
    insideOutside: insideOutside as InsideOutsideChoice,
    suit: (suit ?? null) as ParsedMode['suit'],
  };
}

/**
 * The most a given bet mode can actually pay, as a multiple of the bet.
 *
 * DIFFERENT FROM `FAMILY_RULES[f].maxWin`, AND BOTH ARE WANTED. That one is the
 * most the FAMILY can reach - the right headline for a player choosing between
 * Classic, Second Chance and High Stakes, because some combination in it does
 * reach that figure. This one is the most THIS BET can reach, and for most bets
 * it is far lower: only 8 of the 64 combinations in each family touch their
 * family's ceiling, and the median Classic mode stops at 268.8x against a
 * stated 1354.2x.
 *
 * Stake asks for the maximum win to be stated per bet mode and to be
 * realistically obtainable, and every published combination is its own bet
 * mode - so quoting only the family figure told 56 of 64 modes they could reach
 * something they cannot.
 *
 * Read from a generated table rather than enumerated here. The theoretical
 * ceiling of a combination IS derivable from payout.ts, and it is the wrong
 * number: the RGS can only pay what its lookup table holds, and the published
 * tables are sampled, so an enumeration would overstate about half the modes.
 * See modeCeilings.ts for the measurement that settles it.
 *
 * Returns null for a string that is not a published mode, so a caller can fall
 * back to the family figure rather than printing a broken one.
 */
export function ceilingFor(mode: string): number | null {
  return MODE_CEILINGS[mode] ?? null;
}

/**
 * Every playable mode name, across all families. Mirrors all_published_modes()
 * on the math side - 3 x 64 + 1 = 193.
 */
export function allPlayableModes(): string[] {
  const names: string[] = [];
  for (const family of MODE_FAMILIES) {
    for (const combo of combosFor(family)) names.push(modeName(combo, family));
  }
  return names;
}
