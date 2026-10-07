/**
 * A round's result reaches a screen reader.
 *
 * The bar prints "Busted" or "Kept $1.20" as the last card lands, and for a
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

/*
 * The board itself, heard. Selection was a CSS class only, the dealt cards were
 * drawings with no name, and the four empty chips read "0.0x" before the first
 * deal (the critique, 2026-10-05). All of it is silent on screen, so pinned as
 * source.
 */
test('every guess button reports whether it is picked', () => {
  const picks = BOARD.match(/class:selected=\{guesses\.\w+ === '\w+'\}/g) ?? [];
  assert.equal(picks.length, 12, 'expected the 12 guess buttons (2 + 3 + 3 + 4)');
  for (const pick of picks) {
    const cond = pick.slice('class:selected={'.length, -1);
    assert.ok(BOARD.includes(`${pick} aria-pressed={${cond}}`), `${cond} has no matching aria-pressed`);
  }
});

test('a dealt card is named, and an unshown chip is hidden', () => {
  assert.match(BOARD, /class="card-block" role=\{card \? 'img' : undefined\} aria-label=\{card \? cardLabel\(index\)/);
  assert.match(BOARD, /class:show=\{chipShows\(index\)\}[\s\S]{0,80}aria-hidden=\{!chipShows\(index\)\}/);
});

test('the announcement names the card that ended the round', () => {
  const at = BOARD.indexOf('const announcement = $derived(');
  const body = BOARD.slice(at, BOARD.indexOf(');', at));
  assert.match(body, /cardTitle\(shown\.busted\)/);
});

test('a bust that kept nothing prints no chip, and a miss is never win green', () => {
  assert.match(BOARD, /multiplier !== null && multiplier !== 0 && !isFreeSlot\(index\)/);
  assert.match(BOARD, /chipIsMiss = \(index: number\) => index === shown\.busted \|\| index === shown\.forgiven/);
});

test('the result words: no "Banked", a kept share says Kept', () => {
  assert.doesNotMatch(BOARD, /t\('Banked'\)/);
  assert.match(BOARD, /t\('Kept'\)/);
  assert.match(BOARD, /t\('Won'\)/);
});
