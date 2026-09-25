/**
 * The board holds still: the card row, the readout and the guess squares keep
 * their places through picks, deals and settles.
 *
 * WHAT THIS GUARDS. The readout's third line (the settled multiplier) is empty
 * most of the time, and an empty line must still take its height, or the board
 * jumps every time it fills or empties. Its placeholder was once retyped as a
 * plain space - which collapses - and every card and square moved at the fourth
 * pick and at every settle (2026-09-25; measured 0.0px of movement once fixed,
 * sampled every frame through a session at three sizes). Two guards, and this
 * fails if either goes: the non-breaking space, written as an escape so no
 * editor can turn it back into a plain one, and a one-line minimum height.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { source } from '../../sources.testlib.ts';

test("the readout's third line can never collapse, so the board never jumps", () => {
  const board = source('../components/board/GameBoard.svelte');
  const at = board.indexOf('class="running-win-mult"');
  assert.ok(at >= 0, 'the readout lost its third line');
  const line = board.slice(at, board.indexOf('</span>', at));
  assert.match(line, /:\s*'(\\u00a0|\u00a0)'\}$/, 'the empty line is not a non-breaking space');
  const css = source('../styles/board/cards.css');
  assert.match(css, /\.running-win-mult\s*\{[^}]*min-height:\s*1lh/, 'the line has no minimum height');
});
