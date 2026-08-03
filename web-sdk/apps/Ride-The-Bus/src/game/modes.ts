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

/** Bet mode name. Must match math-sdk game_calculations.py:mode_name exactly. */
export function modeName(
  color: ColorChoice,
  higherLower: HigherLowerChoice,
  insideOutside: InsideOutsideChoice,
  suit: SuitChoice,
): string {
  return `${color}_${higherLower}_${insideOutside}_${suit}`;
}

/** Every playable mode name. Mirrors all_mode_combinations() on the math side. */
export function allPlayableModes(): string[] {
  const names: string[] = [];
  for (const color of COLOR_CHOICES) {
    for (const higherLower of HIGHER_LOWER_CHOICES) {
      for (const insideOutside of INSIDE_OUTSIDE_CHOICES) {
        if (!isCombinationPlayable(higherLower, insideOutside)) continue;
        for (const suit of SUIT_CHOICES) {
          names.push(modeName(color, higherLower, insideOutside, suit));
        }
      }
    }
  }
  return names;
}
