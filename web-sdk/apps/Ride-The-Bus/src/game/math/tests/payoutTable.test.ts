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

import { PAYOUT_ROWS, bustRowsFor, oddsExampleFor, payoutRowsFor } from '../payoutTable.ts';
import { partialMultiplier, stageRetention } from '../payout.ts';
import {
	localColorPayouts,
	localHigherLowerPayouts,
	localInsideOutsidePayouts,
	localSuitPayouts,
} from '../../round/localRound.ts';
import { createDeck, rankValue, ranks } from '../../round/roundContract.ts';
import { FAMILY_RULES, MODE_FAMILIES, type ModeFamily } from '../modes.ts';

/** The families whose four guesses are the player's - every table row swings there. */
const LADDER_FAMILIES: readonly ModeFamily[] = MODE_FAMILIES.filter((f) => FAMILY_RULES[f].fixedChoices === null);
// The bust rules are i18n KEYS now, not sentences, so the assertions below
// render them the way HowToPlayPopup does. That makes this test strictly
// stronger than it was: it checks the English catalogue copy as well as the
// maths, and it fails if a key is ever added here without one.
import en from '../../../i18n/messagesMap/en.ts';
import type { BustRow } from '../payoutTable.ts';

const render = (row: BustRow) => {
	const text = (en as Record<string, string>)[row.key];
	assert.ok(text, `no English copy for the bust key "${row.key}"`);
	return row.percent === null ? text : text.replace('%s', String(row.percent));
};
import { MAX_WIN_MULTIPLIER } from '../winTiers.ts';

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

	test('the celebration ceiling matches the base family the rules quote', () => {
		// Replaces a check against FULL_WIN_ROWS, which restated 1354.2x as data
		// and so only ever confirmed the constant agreed with itself. The claim
		// worth pinning is that winTiers' DEFAULT ladder tops out where the base
		// family actually does - every other family passes its own ceiling in.
		assert.equal(
			MAX_WIN_MULTIPLIER,
			FAMILY_RULES.base.maxWin,
			'the default win ladder must not advertise a ceiling the base mode cannot reach',
		);
	});

	test('every four-guess family says what a wrong guess costs, starting with card 1', () => {
		for (const family of LADDER_FAMILIES) {
			const rows = bustRowsFor(FAMILY_RULES[family]);
			assert.ok(rows.length >= 2, `${family} should state at least two outcomes`);
			assert.equal(rows[0]!.label, 'Card 1', `${family} must start with card 1`);
			for (const row of rows) {
				assert.ok(render(row).trim().length > 0, `${family}: empty detail`);
			}
		}
	});

	test('Three of a Kind has one bust rule, and it is nothing', () => {
		// A family that keeps nothing has one rule; three rows would be the same
		// sentence three times, and a percentage would be a number for a rule
		// that has none.
		const rows = bustRowsFor(FAMILY_RULES.tr);
		assert.equal(rows.length, 1);
		assert.equal(rows[0]!.label, 'Any wrong guess');
		assert.equal(rows[0]!.percent, null);
		assert.match(render(rows[0]!), /pays nothing/);
	});

	test('the Three of a Kind table says what the chips will say', () => {
		// Three single-value rows from the 12-card deck: card 1 dealt, card 2
		// matching 3 of 11, card 3 matching 2 of 10. Every figure is min === max
		// because the deck is symmetric.
		const rows = payoutRowsFor(FAMILY_RULES.tr);
		assert.deepEqual(
			rows.map((r) => [r.stage, r.label, r.min, r.max]),
			[
				[1, 'Any card', 1, 1],
				[2, 'Equal', 3.67, 3.67],
				[3, 'Equal', 5, 5],
			],
		);
		// And they multiply to the sweep the family advertises, per cost - at
		// full precision, since the table rounds 11/3 for display.
		assert.equal(Math.round((11 / 3) * 5 * FAMILY_RULES.tr.cost * 10) / 10, FAMILY_RULES.tr.maxWin);
	});

	test('a retention is never quoted in two units in the same list', () => {
		// THE BUG THIS EXISTS FOR. The rows used to read "Card 2 - 0.5x your bet"
		// beside "Card 3 or 4 - keep 30%": one multiple of the BET and one share
		// of the RUNNING MULTIPLIER, listed as though they were two rules. They
		// are one rule seen twice. Every row must now speak in percent, and the
		// bet-multiple lives in the note.
		for (const family of MODE_FAMILIES) {
			const rows = bustRowsFor(FAMILY_RULES[family]);
			for (const row of rows) {
				const detail = render(row);
				assert.ok(
					!/\d× your bet/.test(detail),
					`${family}: "${detail}" mixes a bet multiple into the rules list`,
				);
			}
		}
	});

	test('each family quotes its own retention', () => {
		assert.match(render(bustRowsFor(FAMILY_RULES.base)[1]!), /30%/);
		assert.match(render(bustRowsFor(FAMILY_RULES.hs)[1]!), /16%/);
	});

	test('the forgiving family describes forgiveness, not a card-2 payout', () => {
		const rows = bustRowsFor(FAMILY_RULES.sc);
		assert.equal(rows[1]!.label, 'Your first wrong guess');
		assert.match(render(rows[1]!), /forgiven/);
	});

	test('every bust sentence is a real catalogue key, in every locale', async () => {
		// THE BUG THIS EXISTS FOR. These sentences used to be built as already
		// substituted English and rendered raw as `{row.detail}`, so they were the
		// one block of player-visible copy that never went through t(). Two things
		// followed and no test could see either: the "If you guess wrong" section
		// read in English in all sixteen other locales, and in social mode "the
		// round ends and PAYS nothing" survived - a term Stake prohibits outright.
		// locales.test.ts walks the catalogues, and these strings were not in one.
		const { readdirSync } = await import('node:fs');
		const pathMod = await import('node:path');
		const { fileURLToPath } = await import('node:url');
		const here = pathMod.dirname(fileURLToPath(import.meta.url));
		const dir = pathMod.join(here, '../../../i18n/messagesMap');
		const locales = readdirSync(dir)
			.filter((f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'))
			.map((f) => f.replace(/\.ts$/, ''));
		assert.equal(locales.length, 16, 'expected sixteen catalogues');

		const keys = new Set(
			MODE_FAMILIES.flatMap((f) => bustRowsFor(FAMILY_RULES[f]).map((r) => r.key)),
		);
		for (const locale of locales) {
			const mod = (await import(`../../../i18n/messagesMap/${locale}.ts`)).default as Record<string, string>;
			for (const key of keys) {
				assert.ok(mod[key], `${locale} has no entry for the bust sentence "${key}"`);
			}
		}
	});
});

describe('the worked example in How to Play', () => {
	// THE BUG THIS EXISTS FOR. "With a 3 on the table, Lower pays about 4.75x"
	// was typed into the copy with Classic's five figures, and rendered ABOVE
	// the mode tabs - so a High Stakes player read 4.75x on a page whose own
	// paytable said 5.28x, and a reviewer checking a High Stakes round against
	// the rules found the board and the rules disagreeing. The catalogues now
	// carry %1..%5 and the figures come from the same function as the table.
	const EXAMPLE_KEY =
		'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.';

	test('every family quotes its own odds, solved against its own retention', () => {
		for (const f of LADDER_FAMILIES) {
			const rules = FAMILY_RULES[f];
			const r = stageRetention(rules, 1, false);
			const o = oddsExampleFor(rules);
			const expect = (cards: number) => Math.round(partialMultiplier(cards / 51, 1, r) * 100) / 100;
			assert.equal(o.lowerOn3, expect(8), `${f} lower on 3`);
			assert.equal(o.higherOn3, expect(40), `${f} higher on 3`);
			assert.equal(o.lowerOn8, expect(28), `${f} lower on 8`);
			assert.equal(o.higherOn8, expect(20), `${f} higher on 8`);
			assert.equal(o.equal, expect(3), `${f} equal`);
		}
	});

	test('the three families genuinely differ, which is why the example moves', () => {
		const base = oddsExampleFor(FAMILY_RULES.base);
		const hs = oddsExampleFor(FAMILY_RULES.hs);
		const sc = oddsExampleFor(FAMILY_RULES.sc);
		assert.ok(hs.lowerOn3 > base.lowerOn3 && base.lowerOn3 > sc.lowerOn3);
		assert.ok(hs.equal > base.equal && base.equal > sc.equal);
	});

	test('the example figures sit inside the stage-2 rows of the same table', () => {
		// The four-guess families only: Three of a Kind has no Higher or Lower
		// to work an example on, and the popup does not show one there.
		for (const f of LADDER_FAMILIES) {
			const rows = payoutRowsFor(FAMILY_RULES[f]);
			const o = oddsExampleFor(FAMILY_RULES[f]);
			const row = (label: string) => rows.find((r) => r.stage === 2 && r.label === label)!;
			for (const [label, v] of [['Lower', o.lowerOn3], ['Lower', o.lowerOn8], ['Higher', o.higherOn3], ['Higher', o.higherOn8], ['Equal', o.equal]] as const) {
				const { min, max } = row(label);
				assert.ok(v >= min - EPS && v <= max + EPS, `${f} ${label} ${v} outside ${min}-${max}`);
			}
		}
	});

	test('no catalogue carries a typed-in figure for the example', async () => {
		const { readdirSync } = await import('node:fs');
		const pathMod = await import('node:path');
		const { fileURLToPath } = await import('node:url');
		const here = pathMod.dirname(fileURLToPath(import.meta.url));
		const dir = pathMod.join(here, '../../../i18n/messagesMap');
		const locales = readdirSync(dir)
			.filter((f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'))
			.map((f) => f.replace(/\.ts$/, ''));
		const social = (await import('../../../i18n/socialMessages.ts')).default as Record<string, string>;
		const values = [social[EXAMPLE_KEY]];
		for (const locale of locales) {
			const mod = (await import(`../../../i18n/messagesMap/${locale}.ts`)).default as Record<string, string>;
			values.push(mod[EXAMPLE_KEY]);
		}
		assert.equal(values.length, 17);
		for (const v of values) {
			assert.ok(v, 'catalogue is missing the worked example');
			for (const ph of ['%1', '%2', '%3', '%4', '%5']) assert.ok(v.includes(ph), `missing ${ph} in "${v.slice(0, 40)}"`);
			assert.doesNotMatch(v, /4[.,]75|1[.,]19|1[.,]57|2[.,]08/, 'a Classic figure is typed into the copy');
		}
	});
});
