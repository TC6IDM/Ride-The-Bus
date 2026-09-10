/**
 * How fast this game is allowed to talk to the RGS.
 *
 * Two pieces that only make sense together, which is why they live in one
 * module rather than beside the round flow: the floors decide how often a call
 * may be sent, and the retry raises those floors when the RGS tells us it was
 * still too often. Split across a 2,000-line component they read as unrelated
 * helpers and the feedback loop between them is invisible.
 *
 * EVERY RGS call goes through here, not just /wallet/play. A winning round
 * makes two calls - play, then end-round to settle - and end-round used to be
 * unpaced, so it fired wherever the card reveal happened to finish. At instant
 * turbo that put two requests about 200ms apart, then left the line idle for
 * the rest of the second. The average was fine; the burst was not, and a burst
 * is what a fixed-window limiter actually measures.
 *
 * Deliberately module-scoped rather than per-component state: the limit belongs
 * to the SESSION, not to a mounted component, and it must survive any remount.
 *
 * The arithmetic lives in rgsPacingMath.ts so it can be unit-tested - this
 * module imports the workspace `rgs-requests` package, which `node --test`
 * cannot resolve.
 */
import { RgsHttpError } from 'rgs-requests';

import {
	MIN_REQUEST_GAP_MS,
	MIN_PLAY_INTERVAL_MS,
	delayBeforeCall,
	backedOffFloors,
} from './rgsPacingMath';

export { MIN_REQUEST_GAP_MS, MIN_PLAY_INTERVAL_MS } from './rgsPacingMath';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Both raised if the RGS throttles us anyway - see the catch below. */
let requestFloorMs = MIN_REQUEST_GAP_MS;
let playFloorMs = MIN_PLAY_INTERVAL_MS;

let lastRequestAt = 0;
let lastPlayAt = 0;

/** Hold until both applicable floors have elapsed, then stamp the clock. */
async function hold(isPlay: boolean): Promise<void> {
	const delay = delayBeforeCall({
		now: performance.now(),
		lastRequestAt,
		lastPlayAt,
		isPlay,
		requestFloorMs,
		playFloorMs,
	});
	if (delay > 0) await wait(delay);

	const sentAt = performance.now();
	lastRequestAt = sentAt;
	if (isPlay) lastPlayAt = sentAt;
}

/**
 * Space the call, send it, and wait out a rate limit rather than failing the
 * round.
 *
 * The RGS answers 429 when calls come too fast, and autoplay does exactly that.
 * A 429 used to surface as an unparseable body, get treated as a fatal round
 * error, and stop the run - so a long autoplay reliably died partway through
 * for a reason that was only ever temporary.
 *
 * Backs off exponentially and gives up after a few attempts, at which point the
 * caller's own error handling takes over. Only 429 is retried: a rejected bet
 * or an expired session will not improve by asking again.
 *
 * The hold is re-applied before every attempt, so a retry is spaced by the
 * widened floors as well as by its own backoff.
 */
async function paced<T>(label: string, call: () => Promise<T>, isPlay: boolean): Promise<T> {
	const ATTEMPTS = 4;
	let delay = 700;

	for (let attempt = 1; ; attempt++) {
		await hold(isPlay);
		try {
			return await call();
		} catch (err) {
			const rateLimited = err instanceof RgsHttpError && err.isRateLimited;
			if (!rateLimited || attempt >= ATTEMPTS) throw err;

			// Being throttled at all means the floors are too low for whatever limit
			// this session is under, so raise them for the rest of the session. The
			// run then settles at a rate the RGS accepts instead of repeatedly
			// walking into the same wall. BOTH move: widening only the play interval
			// left end-round going out at the rate that earned the 429.
			({ requestFloorMs, playFloorMs } = backedOffFloors(requestFloorMs, playFloorMs));
			console.warn(
				`[RideTheBus] ${label} rate limited by the RGS; retrying in ${delay}ms ` +
					`(attempt ${attempt} of ${ATTEMPTS}, spacing now ${requestFloorMs}ms ` +
					`between calls and ${playFloorMs}ms between bets)`,
			);
			await wait(delay);
			delay *= 2;
		}
	}
}

/** A /wallet/play. Clears the bet interval as well as the shared gap. */
export const pacedPlay = <T>(label: string, call: () => Promise<T>) => paced(label, call, true);

/** Any other RGS call - end-round today. Clears the shared gap only. */
export const pacedRequest = <T>(label: string, call: () => Promise<T>) => paced(label, call, false);
