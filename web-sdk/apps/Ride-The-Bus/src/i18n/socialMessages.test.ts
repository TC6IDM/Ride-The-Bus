/**
 * Stake.US prohibited-term coverage.
 *
 * US social-casino rules bar a list of gambling terms outright, and a game that
 * renders any of them is not approved for stake.us. Because `t()` falls back to
 * the key - which IS the English text - a string with no entry in
 * socialMessages renders its restricted wording verbatim. That is invisible
 * unless something checks, so this walks every key the game can render in
 * social mode and asserts the result is clean.
 *
 * Five strings shipped that way before this test existed, three of them on the
 * error dialog, where they only surface on a failure path.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import en from './messagesMap/en.ts';
import socialMessages from './socialMessages.ts';

/**
 * Stake's prohibited-phrase table.
 *
 * "win", "won", "play" and "coins" are the REPLACEMENT words, so they are
 * deliberately absent - flagging them would make the whole table unusable.
 */
const RESTRICTED = [
	'win feature',
	'pay out',
	'paid out',
	'pays out',
	'payout',
	'payouts',
	'betting',
	'total bet',
	'bet',
	'bets',
	'rebet',
	'cash',
	'money',
	'currency',
	'credit',
	'fund',
	'funds',
	'pay',
	'pays',
	'paid',
	'payer',
	'buy',
	'bought',
	'purchase',
	'bonus buy',
	'buy bonus',
	'gamble',
	'gambling',
	'wager',
	'deposit',
	'withdraw',
	'at the cost of',
	'cost of',
	'stake',
];

const RESTRICTED_RE = new RegExp(
	`\\b(${RESTRICTED.map((t) => t.replace(/ /g, '\\s+')).join('|')})\\b`,
	'gi',
);

/** Exactly what a player in social mode sees for one key - see i18nDerived.t. */
const renderedInSocialMode = (key: string): string =>
	(socialMessages as Record<string, string>)[key] ?? key;

describe('social mode contains no prohibited terms', () => {
	for (const key of Object.keys(en)) {
		test(`"${key.slice(0, 50)}"`, () => {
			const rendered = renderedInSocialMode(key);
			const hits = [...new Set([...rendered.matchAll(RESTRICTED_RE)].map((m) => m[0].toLowerCase()))]
				// "Stake Engine" is the platform's own brand name in the legal
				// disclaimer, not the common noun the table bans.
				.filter((hit) => !(hit === 'stake' && /Stake\s+Engine/.test(rendered)));

			assert.deepEqual(hits, [], `renders prohibited term(s) [${hits.join(', ')}]: "${rendered}"`);
		});
	}
});

describe('social overrides stay in step with English', () => {
	test('no override targets a key that no longer exists', () => {
		const stale = Object.keys(socialMessages).filter((k) => !(k in en));
		assert.deepEqual(stale, [], `stale social keys: ${stale.join(' | ')}`);
	});

	test('overrides keep the %s placeholder', () => {
		const dropped = Object.entries(socialMessages).filter(
			([k, v]) => k.includes('%s') && !String(v).includes('%s'),
		);
		assert.deepEqual(
			dropped.map(([k]) => k),
			[],
			'social override dropped its %s placeholder',
		);
	});
});
