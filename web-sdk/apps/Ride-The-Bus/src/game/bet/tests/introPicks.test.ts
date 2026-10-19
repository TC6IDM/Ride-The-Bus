/**
 * The intro's picks are the game's (the owner's call, 2026-10-18): a pick on
 * the intro sets the bet's chip down as the board does, and Continue hands
 * the four to the board. Read as source - the components cannot be mounted
 * under node --test.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(import.meta.dirname, rel), 'utf8');
const INTRO = read('../../../components/intro/IntroPanels.svelte');
const BET = read('../betState.svelte.ts');
const HANDOFF = read('../../ui/introHandoff.ts');

test('Continue hands the intro’s picks to the board, unless a round is already there', () => {
  assert.match(INTRO, /function continueWithPicks\(\) \{\s*[^}]*if \(!roundInProgress\(\)\) adoptGuesses\(locked\);\s*oncontinue\(\);/);
  assert.match(INTRO, /class="ss-continue"[^>]*onclick=\{continueWithPicks\}/);
});

test('the intro opens on the player’s own picks when there are any', () => {
  assert.match(INTRO, /hasPicks\s*\?\s*\{ color: guesses\.color, hl: guesses\.hl, io: guesses\.io, suit: guesses\.suit \}/);
});

test('no Inside after an Equal, on the intro and in what it hands over', () => {
  assert.match(INTRO, /if \(step === 'io' && value === 'inside' && locked\.hl === 'equal'\) return;/);
  assert.match(INTRO, /if \(locked\.hl === 'equal' && locked\.io === 'inside'\) locked\.io = null;/);
  const adopt = BET.slice(BET.indexOf('export function adoptGuesses'));
  assert.match(adopt.slice(0, adopt.indexOf('\n}')), /isCombinationPlayable\(guesses\.hl, next\.io/);
});

test('every intro pick sets the bet’s chip down, and the squares fly down carrying them', () => {
  assert.equal((INTRO.match(/<PickChip spot=\{spots\.\w+\} chip=\{betChip\} \/>/g) ?? []).length, 9);
  assert.ok(!/classList\.remove\('selected'\)/.test(HANDOFF), 'the hand-off strips the picks off the flying squares again');
});
