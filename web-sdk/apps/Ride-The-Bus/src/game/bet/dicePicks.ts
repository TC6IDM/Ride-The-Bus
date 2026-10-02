/**
 * The table die: four picks at random, for the player to look at and deal.
 *
 * WHAT IT IS, AND WHAT IT IS NOT. A quick pick - the owner's call (2026-10-01),
 * chosen over a published "random picks" bet mode. It fills the four guess
 * squares and nothing else: the round is still an ordinary bet mode, bought by
 * the player pressing deal, and its outcome is still the published book's. So
 * there is no math behind it, no mode, nothing for the RGS to know - and the
 * volatility meter shows the rolled combination's own rating before anything is
 * bought, which a mode that drew its picks after the bet could not.
 *
 * UNIFORM OVER THE PLAYABLE COMBINATIONS, NOT PER SQUARE. Each square rolled on
 * its own would make Equal on card 2 a one-in-three pick and then shrink card
 * 3's choices; drawing one of the 64 published combinations makes every bet
 * mode equally likely, and Equal-then-Inside - the combination with no mode -
 * impossible by construction. The current picks are left out, so a roll always
 * changes something: landing on the same four reads as a die that did nothing.
 *
 * `.ts` extensions: `node --test` reads this module (see payoutTable.ts).
 */
import {
  combosFor,
  type ColorChoice,
  type HigherLowerChoice,
  type InsideOutsideChoice,
  type SuitChoice,
} from '../math/modes.ts';

export type Picks = {
  color: ColorChoice;
  hl: HigherLowerChoice;
  io: InsideOutsideChoice;
  suit: SuitChoice;
};

type CurrentPicks = {
  color: ColorChoice | null;
  hl: HigherLowerChoice | null;
  io: InsideOutsideChoice | null;
  suit: SuitChoice | null;
};

/**
 * How long the die tumbles, and where in that time it touches the table - the
 * first landing, the small hop's landing. TableDie animates on these and the
 * roll's knocks are scheduled on them, so the sound lands where the die does.
 */
export const DIE_ROLL_MS = 560;
export const DIE_LANDINGS = [0.62, 1] as const;

/** A draw in [0, 1) from the platform's CSPRNG where there is one. Not a fairness
 *  matter - the picks decide nothing the player could not pick by hand - but an
 *  even spread over 64 is what the die promises. */
export function secureRandom(): number {
  const crypto = globalThis.crypto;
  if (crypto?.getRandomValues) {
    const word = new Uint32Array(1);
    crypto.getRandomValues(word);
    return word[0]! / 2 ** 32;
  }
  return Math.random();
}

/** The 64 combinations a four-guess family publishes, as picks. */
export const ROLLABLE: readonly Picks[] = combosFor('base').map(([color, hl, io, suit]) => ({
  color: color as ColorChoice,
  hl: hl as HigherLowerChoice,
  io: io as InsideOutsideChoice,
  suit: suit as SuitChoice,
}));

/** One of the playable combinations other than the current one, uniformly. */
export function rollPicks(current: CurrentPicks, random: () => number = secureRandom): Picks {
  const others = ROLLABLE.filter(
    (p) => !(p.color === current.color && p.hl === current.hl && p.io === current.io && p.suit === current.suit),
  );
  return others[Math.min(others.length - 1, Math.floor(random() * others.length))]!;
}

/** The face the die shows next, 1-6 and never the one it showed. */
export function rollFace(previous: number, random: () => number = secureRandom): number {
  const next = 1 + Math.min(4, Math.floor(random() * 5));
  return next >= previous ? next + 1 : next;
}
