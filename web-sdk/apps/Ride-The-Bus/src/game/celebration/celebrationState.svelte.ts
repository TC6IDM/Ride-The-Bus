/**
 * The big-win takeover: what is on screen, and the promise the round awaits.
 *
 * showWinCelebration returns a promise that resolves when the player dismisses
 * the overlay (or when it auto-skips), and the reveal loop awaits it. That is
 * the whole mechanism by which a celebration holds up the next autoplay round
 * without the loop needing to know the takeover exists - see the note on
 * `celebration` below and the await at the end of playRevealSequence.
 *
 * Reads roundState for the snapshot and autoplaySettings for the auto-skip.
 * Nothing reads it back, so it is a leaf.
 */
import { autoHoldMs, type WinTier } from '../math/winTiers';
import type { Card } from '../round/roundContract';

import { auto, stops } from '../round/autoplaySettings.svelte';
import { round } from '../round/roundState.svelte';

// ---- Big-win takeover ----------------------------------------------------
// The round flow awaits dismissal, so the celebration naturally holds the
// next auto round rather than needing the loop to know about it.
export type Celebration = {
  tier: WinTier;
  amount: number;
  multiplier: number;
  tiers: readonly WinTier[];
  // The round the takeover is celebrating, SNAPSHOT rather than the live
  // revealedCards array - see showWinCelebration.
  cards: readonly (Card | null)[];
  /** Which card ended the round, and which one a Second Chance let off. */
  bustedIndex: number | null;
  forgivenIndex: number | null;
};

/**
 * The takeover on screen, or null.
 *
 * Wrapped in an object because an exported `let` cannot be reassigned across a
 * module boundary. `celebration.active` rather than a bare `celebration` keeps
 * the word "celebration" at the call site, which is what the board reads.
 */
export const celebration = $state({ active: null as Celebration | null });

let celebrationResolve: (() => void) | null = null;

/**
 * Show the takeover and resolve once the player dismisses it.
 *
 * Takes the tier the caller already resolved rather than working it out
 * again. It used to recompute with `winTierFor(multiplier)` - dropping the
 * fullGameWin argument the caller passed - so a full game win under 10x came
 * back null here and returned without showing anything. That is exactly the
 * case the floor exists for: the smallest possible full win is 6.6x, so
 * landing all four guesses on the least likely-looking round in the game
 * passed in silence.
 */
export function showWinCelebration(
  tier: WinTier,
  amount: number,
  multiplier: number,
  tiers: readonly WinTier[],
): Promise<void> {
  // round.revealedCards is COPIED, not referenced. The takeover draws the round's
  // own cards, and every reset of round.revealedCards happens at the START of a
  // round (see the three assignments of [null, null, null, null]) - so an
  // auto run that begins the next round while this overlay is still on screen
  // would empty the fan under it. A copy cannot be reached that way.
  celebration.active = {
    tier,
    amount,
    multiplier,
    tiers,
    cards: [...round.revealedCards],
    bustedIndex: round.bustedIndex,
    forgivenIndex: round.forgivenIndex,
  };
  return new Promise((resolve) => {
    celebrationResolve = resolve;
  });
}

export function dismissCelebration() {
  celebration.active = null;
  const resolve = celebrationResolve;
  celebrationResolve = null;
  resolve?.();
}

/**
 * How long the takeover holds before leaving on its own, or null to wait for
 * a tap. Only ever non-null during an auto run with the skip switched on -
 * a manual spin always waits, because the player is right there watching.
 *
 * The hold scales with the tier (see autoHoldMs): the rare tiers are exactly
 * the ones worth leaving autoplay running for, so they get longer on screen
 * than a routine Big Win.
 */
export const celebrationAutoSkipMs = () =>
  auto.running && stops.skipWinOnAuto && celebration.active
    ? autoHoldMs(celebration.active.tier)
    : null;
