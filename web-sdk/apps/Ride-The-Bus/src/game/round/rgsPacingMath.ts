/**
 * How long to hold before the next RGS call. Pure arithmetic, no imports.
 *
 * Import-free on purpose, exactly like winTiers.ts: rgsPacing.ts imports
 * `RgsHttpError` from the workspace `rgs-requests` package, which `node --test`
 * cannot resolve. Keeping the decision here means the part worth asserting can
 * be tested directly, and the module that talks to the clock stays a thin shell.
 */

/**
 * Minimum gap between ANY two RGS calls.
 *
 * A winning round makes two: /wallet/play, then /wallet/end-round to settle it.
 * Only the play used to be spaced, so end-round simply landed wherever the
 * reveal happened to finish - about 200ms before the next play at instant
 * turbo. Average traffic was within budget, but it arrived as a burst of two
 * requests roughly 200ms apart followed by a long idle gap, which is precisely
 * what a fixed-window or token-bucket limiter rejects. Spacing every call
 * evenly spends the same budget without the spike.
 */
export const MIN_REQUEST_GAP_MS = 400;

/**
 * Minimum gap between two /wallet/play calls, INDEPENDENT of turbo.
 *
 * Turbo speeds up the card reveal, which is presentation - but at the fast end
 * a whole round can finish in a few hundred milliseconds, and every round is
 * one or two RGS calls. That is what earns a 429: the requests were paced by an
 * animation setting that was never meant to govern network traffic.
 *
 * A manual player never notices - a normal-speed reveal already takes longer
 * than this - and the reveal still runs at whatever speed turbo asks for. Only
 * the gap before the NEXT bet is held open.
 */
export const MIN_PLAY_INTERVAL_MS = 900;

/** Ceilings for the adaptive backoff, so a bad session cannot stall outright. */
export const MAX_REQUEST_GAP_MS = 2000;
export const MAX_PLAY_INTERVAL_MS = 4000;

/** Added to the floors each time the RGS answers 429. */
export const REQUEST_GAP_STEP_MS = 200;
export const PLAY_INTERVAL_STEP_MS = 400;

export type PacingState = {
	now: number;
	/** Timestamp of the last RGS call of any kind. */
	lastRequestAt: number;
	/** Timestamp of the last /wallet/play specifically. */
	lastPlayAt: number;
	/** A play has to clear both floors; anything else only the shared gap. */
	isPlay: boolean;
	requestFloorMs: number;
	playFloorMs: number;
};

/**
 * Milliseconds to wait before issuing the call. 0 means go now.
 *
 * A play must satisfy BOTH floors - the play-to-play interval and the shared
 * request gap - so it takes whichever is longer. Everything else only has to
 * clear the shared gap; holding end-round to the full play interval would delay
 * settling a win for no reason, since the win is already decided.
 */
export function delayBeforeCall(state: PacingState): number {
	const sinceRequest = state.now - state.lastRequestAt;
	const gap = Math.max(0, state.requestFloorMs - sinceRequest);
	if (!state.isPlay) return gap;

	const sincePlay = state.now - state.lastPlayAt;
	return Math.max(gap, state.playFloorMs - sincePlay, 0);
}

/** The floors after the RGS has thrown a 429 at us, clamped to the ceilings. */
export function backedOffFloors(requestFloorMs: number, playFloorMs: number) {
	return {
		requestFloorMs: Math.min(requestFloorMs + REQUEST_GAP_STEP_MS, MAX_REQUEST_GAP_MS),
		playFloorMs: Math.min(playFloorMs + PLAY_INTERVAL_STEP_MS, MAX_PLAY_INTERVAL_MS),
	};
}
