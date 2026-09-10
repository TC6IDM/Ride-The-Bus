/**
 * RGS call pacing.
 *
 * The regression these guard is specific: end-round used to bypass pacing
 * entirely, so a winning round fired two requests a couple of hundred
 * milliseconds apart. That is invisible locally - the DEV fallback never calls
 * the RGS at all - and only shows up as a 429 that stops an autoplay run.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import {
	MIN_REQUEST_GAP_MS,
	MIN_PLAY_INTERVAL_MS,
	MAX_REQUEST_GAP_MS,
	MAX_PLAY_INTERVAL_MS,
	delayBeforeCall,
	backedOffFloors,
} from '../rgsPacingMath.ts';

/** A settled session: both floors at their defaults. */
const base = {
	requestFloorMs: MIN_REQUEST_GAP_MS,
	playFloorMs: MIN_PLAY_INTERVAL_MS,
};

describe('delayBeforeCall', () => {
	test('the first call of a session goes immediately', () => {
		// Timestamps start at 0 while performance.now() is already well past it,
		// so the elapsed time dwarfs either floor.
		const delay = delayBeforeCall({
			...base,
			now: 50_000,
			lastRequestAt: 0,
			lastPlayAt: 0,
			isPlay: true,
		});
		assert.equal(delay, 0);
	});

	test('end-round is spaced from the play that preceded it', () => {
		// THE BUG: this returned nothing at all, because end-round never consulted
		// the pacer. A reveal finishing 200ms after the play put two requests
		// 200ms apart.
		const delay = delayBeforeCall({
			...base,
			now: 1_200,
			lastRequestAt: 1_000, // the play, 200ms ago
			lastPlayAt: 1_000,
			isPlay: false,
		});
		assert.equal(delay, MIN_REQUEST_GAP_MS - 200);
	});

	test('end-round waits out only the shared gap, never the play interval', () => {
		// Settling a win must not be held for the full play interval - the payout
		// is already decided and the player is waiting to see it credited.
		const delay = delayBeforeCall({
			...base,
			now: 1_500,
			lastRequestAt: 1_000,
			lastPlayAt: 1_000,
			isPlay: false,
		});
		assert.equal(delay, 0, 'the 400ms gap had already elapsed');
	});

	test('a play clears the play interval even when the shared gap has passed', () => {
		const delay = delayBeforeCall({
			...base,
			now: 1_500,
			lastRequestAt: 1_000,
			lastPlayAt: 1_000,
			isPlay: true,
		});
		assert.equal(delay, MIN_PLAY_INTERVAL_MS - 500);
	});

	test('a play also clears the shared gap after an intervening end-round', () => {
		// The realistic autoplay shape: play at t=0, end-round at t=800, next play
		// due at t=900 by the play interval - but only 100ms after the end-round.
		// The shared gap is what pushes it out to 800 + 400.
		const delay = delayBeforeCall({
			...base,
			now: 900,
			lastRequestAt: 800, // end-round
			lastPlayAt: 0,
			isPlay: true,
		});
		assert.equal(delay, 300, 'held until 1200ms, i.e. 400ms after the end-round');
	});

	test('never returns a negative delay', () => {
		for (const isPlay of [true, false]) {
			const delay = delayBeforeCall({
				...base,
				now: 99_999,
				lastRequestAt: 0,
				lastPlayAt: 0,
				isPlay,
			});
			assert.ok(delay >= 0, `negative delay for isPlay=${isPlay}`);
		}
	});
});

describe('backedOffFloors', () => {
	test('a 429 widens both floors, not just the play one', () => {
		// Raising only the play interval left end-round hammering at the same rate
		// that earned the 429 in the first place.
		const next = backedOffFloors(MIN_REQUEST_GAP_MS, MIN_PLAY_INTERVAL_MS);
		assert.ok(next.requestFloorMs > MIN_REQUEST_GAP_MS);
		assert.ok(next.playFloorMs > MIN_PLAY_INTERVAL_MS);
	});

	test('repeated 429s settle at the ceilings rather than growing without bound', () => {
		let floors = { requestFloorMs: MIN_REQUEST_GAP_MS, playFloorMs: MIN_PLAY_INTERVAL_MS };
		for (let i = 0; i < 100; i++) {
			floors = backedOffFloors(floors.requestFloorMs, floors.playFloorMs);
		}
		assert.equal(floors.requestFloorMs, MAX_REQUEST_GAP_MS);
		assert.equal(floors.playFloorMs, MAX_PLAY_INTERVAL_MS);
	});
});
