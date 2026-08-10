/**
 * The paytable shown to the player must equal what the game actually pays.
 *
 * payoutTable.ts derives its ranges by counting ranks; the live game derives
 * each stage's multiplier from localRound.ts against the real remaining deck.
 * Those are two independent routes to the same number, which is the point -
 * this test walks a real 52-card deck through localRound and asserts every
 * multiplier it produces falls inside the range the rules advertise.
 *
 * If they ever diverge, the game is showing a player one paytable and crediting
 * another. That is the failure this file exists to make impossible.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { PAYOUT_ROWS, FULL_WIN_ROWS, BUST_ROWS } from './payoutTable.ts';
import {
	localColorPayouts,
	localHigherLowerPayouts,
	localInsideOutsidePayouts,
	localSuitPayouts,
} from './localRound.ts';
import { createDeck, rankValue, ranks } from './roundContract.ts';
import { MAX_WIN_MULTIPLIER } from './winTiers.ts';

const row = (stage: number, label: string) => {
	const found = PAYOUT_ROWS.find((r) => r.stage === stage && r.label === label);
	assert.ok(found, `no published row for stage ${stage} "${label}"`);
	return found;
};

/** Allow for the 2dp rounding the published rows carry. */
const EPS = 0.005;

const within = (value: number, label: string, stage: number, context: string) => {
	const r = row(stage, label);
	assert.ok(
		value >= r.min - EPS && value <= r.max + EPS,
		`${context}: ${label} paid ${value.toFixed(4)}x, outside published ${r.min}x-${r.max}x`,
	);
};

describe('published paytable matches the live payout model', () => {
	const deck = createDeck();

	test('stage 1 colour is the fixed figure the rules state', () => {
		const { red, black } = localColorPayouts(deck);
		assert.equal(
			Math.round(red * 100),
			Math.round(black * 100),
			'red and black are always 26 of 52, so they must pay the same',
		);
		within(red, 'Red or Black', 1, 'full deck');
	});

	test('stage 2 covers every possible first card', () => {
		for (const rank of ranks) {
			const first = deck.find((c) => c.rank === rank)!;
			const remaining = deck.filter((c) => c !== first);
			const p = localHigherLowerPayouts(remaining, rankValue[rank]);
			const where = `card 1 = ${rank}`;
			// An ace can never go lower nor a king higher; those pay 0 because the
			// branch is unreachable, and the published range excludes them.
			if (p.higher > 0) within(p.higher, 'Higher', 2, where);
			if (p.lower > 0) within(p.lower, 'Lower', 2, where);
			within(p.equal, 'Equal', 2, where);
		}
	});

	test('stage 2 Equal never moves', () => {
		const r = row(2, 'Equal');
		assert.equal(r.min, r.max, 'Equal is always the 3 remaining cards of that rank');
	});

	test('stage 3 covers every possible pair of first cards', () => {
		for (const firstRank of ranks) {
			for (const secondRank of ranks) {
				const first = deck.find((c) => c.rank === firstRank)!;
				const second = deck.find((c) => c !== first && c.rank === secondRank)!;
				const remaining = deck.filter((c) => c !== first && c !== second);
				const p = localInsideOutsidePayouts(
					remaining,
					rankValue[firstRank],
					rankValue[secondRank],
				);
				const where = `cards ${firstRank}/${secondRank}`;
				if (p.inside > 0) within(p.inside, 'Inside', 3, where);
				if (p.outside > 0) within(p.outside, 'Outside', 3, where);
				if (p.equal > 0) within(p.equal, 'Equal', 3, where);
			}
		}
	});

	test('stage 4 covers every reachable suit distribution', () => {
		// The first three cards can take 0-3 of any one suit, leaving 10-13.
		for (let taken = 0; taken <= 3; taken += 1) {
			const removed: typeof deck = [];
			for (const card of deck) {
				if (removed.length < taken && card.suit === '♥') removed.push(card);
			}
			// Top the removal up to exactly three cards using other suits.
			for (const card of deck) {
				if (removed.length >= 3) break;
				if (!removed.includes(card) && card.suit !== '♥') removed.push(card);
			}
			const remaining = deck.filter((c) => !removed.includes(c));
			assert.equal(remaining.length, 49);
			const p = localSuitPayouts(remaining);
			for (const [suit, value] of Object.entries(p)) {
				if (value > 0) within(value, 'Any suit', 4, `${taken} hearts gone, ${suit}`);
			}
		}
	});
});

describe('paytable is complete and self-consistent', () => {
	test('every one of the four cards has at least one row', () => {
		for (const stage of [1, 2, 3, 4]) {
			assert.ok(
				PAYOUT_ROWS.some((r) => r.stage === stage),
				`stage ${stage} has no published rows`,
			);
		}
	});

	test('no row is inverted or non-positive', () => {
		for (const r of PAYOUT_ROWS) {
			assert.ok(r.min > 0, `${r.label} has a non-positive minimum`);
			assert.ok(r.max >= r.min, `${r.label} has max below min`);
		}
	});

	test('the biggest full win matches the published max win', () => {
		const biggest = Math.max(...FULL_WIN_ROWS.map((r) => r.max));
		assert.equal(
			biggest,
			MAX_WIN_MULTIPLIER,
			'the rules must not advertise a ceiling different from winTiers',
		);
	});

	test('full-win families are ordered and each average sits under its max', () => {
		for (const r of FULL_WIN_ROWS) {
			assert.ok(r.average < r.max, `${r.label}: average is not below max`);
		}
		const maxes = FULL_WIN_ROWS.map((r) => r.max);
		assert.deepEqual(maxes, [...maxes].sort((a, b) => a - b), 'families are out of order');
	});

	test('bust rules cover all four cards', () => {
		assert.equal(BUST_ROWS.length, 3, 'card 1, card 2, and cards 3-or-4');
	});
});
