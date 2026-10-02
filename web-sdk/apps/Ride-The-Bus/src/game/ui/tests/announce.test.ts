/**
 * A round's result reaches a screen reader.
 *
 * The bar prints "Busted" or "Banked $1.20" as the last card lands, and for a
 * long time that was all: no focus moved, nothing was live, and the win
 * takeover's result sits in an aria-label that is only read if the overlay is
 * navigated to. WCAG 4.1.3 (Status Messages, AA) wants it said. The failure is
 * silent - nothing on screen changes - so it is pinned here as source.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { source } from '../../sources.testlib.ts';

const BOARD = source('../components/board/GameBoard.svelte');

test('the board keeps a polite status region bound to the round result', () => {
  assert.match(
    BOARD,
    /<p class="round-announcer" role="status">\{announcement\}<\/p>/,
    'GameBoard lost its role="status" region, or it no longer carries `announcement`',
  );
});

test('the announcement is built from the latched readout, so it waits for the card to turn', () => {
  const at = BOARD.indexOf('const announcement = $derived(');
  assert.ok(at >= 0, 'no `announcement` derivation in GameBoard');
  const body = BOARD.slice(at, BOARD.indexOf(');\n', at));
  assert.match(body, /readout\./, 'the announcement must read `readout`, not the live round');
  assert.doesNotMatch(body, /round\.(state|runningWin|wonAmount)/, 'reading the live round would announce the result mid-flip');
});

test('the region is hidden off screen, never display:none - an unrendered live region is not read', () => {
  const css = source('../styles/board/cards.css');
  const rule = css.match(/\.round-announcer\s*\{[^}]*\}/);
  assert.ok(rule, 'no .round-announcer rule');
  assert.doesNotMatch(rule[0], /display:\s*none|visibility:\s*hidden/);
  assert.match(rule[0], /clip-path:\s*inset\(50%\)/);
});
