/**
 * The emitter events this game broadcasts.
 *
 * This file used to import eight event types from Board.svelte,
 * BoardFrame.svelte, FreeSpinIntro.svelte, Win.svelte and friends - components
 * belonging to the slot template that were deleted when this game replaced it.
 * The imports survived because TypeScript resolves `*.svelte` through a wildcard
 * ambient declaration, so it reported "no exported member" rather than a missing
 * file, and nothing in the build ever failed: `tsc` was never actually being
 * run (`npx tsc` resolves to a decoy package, not TypeScript), and Vite strips
 * type-only imports without resolving them.
 *
 * What the game actually emits is the two events in bookEventHandlerMap.ts, one
 * per book event type the math produces.
 */
import type { BookEventOfType } from './typesBookEvent';

/** A card turning over, broadcast per reveal event in the book. */
export type EmitterEventEngineReveal = {
	type: 'engineReveal';
	data: BookEventOfType<'reveal'>;
};

/** The round's settled payout. */
export type EmitterEventFinalWin = {
	type: 'finalWin';
	data: BookEventOfType<'finalWin'>;
};

export type EmitterEventGame = EmitterEventEngineReveal | EmitterEventFinalWin;
