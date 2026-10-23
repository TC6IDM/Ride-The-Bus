/**
 * The two characters in the back room (BackRoomCast.svelte, cast.svelte.ts,
 * castScript.ts; built by scripts/character-art.py; CHARACTER.MD has the
 * brief).
 *
 * What these pin fails SILENTLY in a browser: a pose with no frame is a man
 * who vanishes mid-move (the frame swap shows nothing), a file nobody draws
 * still ships to every player, and a reaction that read the result would be
 * a tell nobody sees in a screenshot.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';

import { CAST_GEOMETRY } from '../castGeometry.ts';
import { winTiersFor } from '../../math/winTiers.ts';
import {
	BOSS_EXHALE,
	BOSS_POSES,
	BOSS_PUFF,
	BOSS_SALUTE,
	FLOORMAN_HATTIP,
	FLOORMAN_POSES,
	reactionTo,
	type Step,
} from '../castScript.ts';

const APP = resolve(import.meta.dirname, '../../../..');
const STATIC = resolve(APP, 'static/characters');
const REPO = resolve(APP, '../../..');
const read = (rel: string) => readFileSync(resolve(APP, rel), 'utf8');

describe('the frames', () => {
	test('every pose the moves use has a frame the art script built', () => {
		assert.deepEqual([...CAST_GEOMETRY.boss.frames].sort(), [...BOSS_POSES].sort());
		assert.deepEqual([...CAST_GEOMETRY.floorman.frames].sort(), [...FLOORMAN_POSES].sort());
	});

	test('every frame is in static/characters, and nothing else ships there', () => {
		const expected = [
			...BOSS_POSES.map((p) => `boss-${p}.webp`),
			...FLOORMAN_POSES.map((p) => `floorman-${p}.webp`),
			'cart-idle.webp',
			// cast.svelte.ts preloads, and BackRoomCast draws, three wisps and one plume.
			'smoke-wisp-1.webp',
			'smoke-wisp-2.webp',
			'smoke-wisp-3.webp',
			'smoke-plume-1.webp',
		].sort();
		assert.deepEqual(readdirSync(STATIC).sort(), expected);
	});

	test('the set stays small: under 800 kB, fetched after the game is up', () => {
		const total = readdirSync(STATIC).reduce((sum, f) => sum + statSync(resolve(STATIC, f)).size, 0);
		assert.ok(total < 800 * 1024, `static/characters is ${Math.round(total / 1024)} kB`);
	});

	test('every shipped file has a row in ASSET_LICENCES.md', (t) => {
		const path = resolve(REPO, 'ASSET_LICENCES.md');
		if (!existsSync(path)) return t.skip('no ASSET_LICENCES.md in this checkout');
		const licences = readFileSync(path, 'utf8');
		for (const f of readdirSync(STATIC)) {
			assert.ok(licences.includes(f), `${f} ships but has no row in ASSET_LICENCES.md`);
		}
	});

	test('every measured point lies inside its figure', () => {
		const inside = (v: number) => v >= 0 && v <= 1;
		for (const figure of [CAST_GEOMETRY.boss, CAST_GEOMETRY.floorman, CAST_GEOMETRY.cart]) {
			for (const f of figure.feet) assert.ok(inside(f.x) && inside(f.y) && f.w > 0, JSON.stringify(f));
		}
		for (const p of [CAST_GEOMETRY.boss.ember, CAST_GEOMETRY.boss.mouth]) assert.ok(inside(p.x) && inside(p.y));
		// The ember is out at the far chair arm's end (right of the figure), the
		// mouth up at the head - if these swap, the smoke rises off his face.
		assert.ok(CAST_GEOMETRY.boss.ember.x > 0.85 && CAST_GEOMETRY.boss.mouth.y < 0.3);
	});
});

describe('the moves', () => {
	const ordered = <P>(steps: readonly Step<P>[]) =>
		steps.every((s, i) => i === 0 || s.at > steps[i - 1]!.at) && steps[0]!.at >= 0;

	test('each runs forward in time', () => {
		for (const steps of [BOSS_PUFF, BOSS_EXHALE, BOSS_SALUTE, FLOORMAN_HATTIP]) assert.ok(ordered(steps as readonly Step<string>[]));
	});

	test('the puff ends on the puff - held until the card turns - and every other move ends at rest', () => {
		assert.equal(BOSS_PUFF.at(-1)!.pose, 'puff');
		for (const steps of [BOSS_EXHALE, BOSS_SALUTE, FLOORMAN_HATTIP]) assert.equal(steps.at(-1)!.pose, 'idle');
	});

	test('the lift is the lowering played backwards: low, mid, high, then the lips', () => {
		assert.deepEqual(
			BOSS_PUFF.map((s) => s.pose),
			['low', 'mid', 'high', 'puff'],
		);
		assert.deepEqual(
			BOSS_EXHALE.map((s) => s.pose),
			['high', 'mid', 'low', 'idle'],
		);
	});
});

/**
 * NO TELL. The men may anticipate only the HELD card, which is decided from
 * the stake and what is already face up (round.lastCardHeld), and react to a
 * result only after the takeover has shown it. If either file ever reads what
 * a card is or what it pays, the Boss's puff becomes a way to read the round
 * before the cards do.
 */
describe('no early tell', () => {
	const COMPONENT = read('src/components/board/BackRoomCast.svelte');
	const MODULE = read('src/game/scene/cast.svelte.ts');

	test('neither reads a card, a result or a price', () => {
		for (const [name, src] of [
			['BackRoomCast.svelte', COMPONENT],
			['cast.svelte.ts', MODULE],
		] as const) {
			for (const banned of ['revealEvents', 'revealedCards', '.correct', 'payout', 'runningWin', 'stageMultipliers', 'holdTunnel']) {
				assert.ok(!src.includes(banned), `${name} reads ${banned}`);
			}
		}
	});

	/**
	 * The ONE look ahead, by the owner's choice (2026-10-23): on half the rounds
	 * whose last card WILL be held, the Boss puffs at the deal - "a rare
	 * animation that would indicate that the game is going long". It is decided
	 * in the reveal, from the same hold questions the reveal asks at the last
	 * card, and the cast only reads the flag. Pinned so it stays exactly that
	 * narrow: half, and only rounds that will hold.
	 */
	test('the early puff: half of the rounds that will hold, decided in the reveal', () => {
		const reveal = read('src/game/round/roundReveal.svelte.ts');
		assert.match(reveal, /round\.bossPuffsEarly = mayHold && willHoldLastCard\(\) && Math\.random\(\) < BOSS_EARLY_PUFF_SHARE;/);
		assert.match(reveal, /const BOSS_EARLY_PUFF_SHARE = 0\.5;/);
		const fn = reveal.slice(reveal.indexOf('function willHoldLastCard'), reveal.indexOf('function devPeelInReplay'));
		for (const asked of ['lastCardHoldMs(', 'holdClimbMs(', 'HOLD_MIN_CLIMB', 'forgivenessAvailable(']) {
			assert.ok(fn.includes(asked), `willHoldLastCard no longer asks ${asked} - it would drift from the real hold`);
		}
		assert.match(COMPONENT, /round\.bossPuffsEarly/);
	});

	test('the anticipation keys off the hold, and the reaction off the takeover closing', () => {
		assert.match(COMPONENT, /round\.lastCardHeld && round\.holdIndex !== null/);
		assert.match(COMPONENT, /castOnHold\(\)/);
		assert.match(COMPONENT, /castOnTurn\(\)/);
		assert.match(COMPONENT, /celebration\.active/);
		assert.match(MODULE, /reactionTo\(tier\.oneIn/);
	});

	test('once he is puffing he keeps the cigar up until the turn', () => {
		// The early puff and the hold share one start, which does nothing the
		// second time - he must not put the cigar down to pick it up again.
		assert.match(MODULE, /function startPuffing\(\) \{\r?\n\tif \(cast\.puffing\) return;/);
		assert.match(MODULE, /export function castOnHold\(\)[\s\S]*?startPuffing\(\)/);
		assert.match(MODULE, /export function castEarlyPuff\(\)[\s\S]*?startPuffing/);
		assert.doesNotMatch(MODULE.slice(MODULE.indexOf('export function castEarlyPuff'), MODULE.indexOf('export function castOnTurn')), /BOSS_EXHALE/);
	});
});

/**
 * WHO IS IMPRESSED (castScript.ts reactionTo): rarer wins move them more,
 * the Floorman is the easier to impress, Max always moves both, and they do
 * not stay impressed. Driven by a seeded random so the shares are exact.
 */
describe('the reactions', () => {
	const seeded = (seed: number) => () => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return seed / 2147483648;
	};
	const shares = (oneIn: number, recently = false) => {
		const random = seeded(7);
		const n = 20000;
		const count = { none: 0, floorman: 0, boss: 0, both: 0 };
		for (let i = 0; i < n; i++) count[reactionTo(oneIn, recently, random)]++;
		return Object.fromEntries(Object.entries(count).map(([k, v]) => [k, v / n])) as typeof count;
	};

	test('Max on every family moves both, always', () => {
		for (const family of ['sc', 'base', 'ls', 'hs'] as const) {
			const max = winTiersFor(family).find((t) => t.id === 'max')!;
			assert.equal(shares(max.oneIn).both, 1, family);
			assert.equal(shares(max.oneIn, true).both, 1, `${family}, even just after a reaction`);
		}
	});

	test('the rarer the win, the likelier someone is impressed - and both of them', () => {
		const ladder = winTiersFor('base');
		const s = ladder.map((t) => shares(t.oneIn));
		for (let i = 1; i < s.length; i++) {
			assert.ok(s[i]!.none <= s[i - 1]!.none, `${ladder[i]!.id} leaves no one impressed more often than ${ladder[i - 1]!.id}`);
			assert.ok(s[i]!.both >= s[i - 1]!.both, `${ladder[i]!.id} moves both less often than ${ladder[i - 1]!.id}`);
		}
		assert.ok(s[0]!.none > 0.7, 'a Big win impresses someone most of the time - too often');
	});

	test('a small win, if it moves anyone, moves the Floorman; a big one, the Boss', () => {
		const big = shares(70);
		const mega = shares(3092);
		assert.ok(big.floorman > big.boss * 3);
		assert.ok(mega.boss > mega.floorman);
	});

	test('Three of a Kind, whose one win comes 1 in 19, rarely impresses anyone', () => {
		const trips = winTiersFor('tr')[0]!;
		assert.ok(shares(trips.oneIn).none > 0.9);
	});

	test('they do not stay impressed: a reaction makes the next one less likely, short of Max', () => {
		assert.ok(shares(3092, true).none > shares(3092).none + 0.2);
	});
});
