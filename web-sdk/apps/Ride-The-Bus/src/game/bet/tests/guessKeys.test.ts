/**
 * Keys 1 to 4 and the four guesses.
 *
 * WHAT THIS GUARDS. The keys go through the board's own setters, so the rules
 * the squares obey hold for a key - but the STEPPING and the KEY MATCHING are
 * new, and each has a silent failure:
 *   - a key that lands on Inside after an Equal pick (the one combination with
 *     no bet mode - the /wallet/play would be rejected);
 *   - a key that clears a pick on wrap-around (the setters toggle, so stepping
 *     onto the current option empties the column and the key looks broken);
 *   - keys matched on the CHARACTER, which on a French AZERTY keyboard is
 *     & é " ' - the game ships in French and How to Play tells French players
 *     to use 1 to 4.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GUESS_COLUMNS, guessColumnFor, nextGuess } from '../guessKeys.ts';
import { isCombinationPlayable } from '../../math/modes.ts';
import { source } from '../../sources.testlib.ts';

test("1 to 4 are the board's four columns, by the physical key", () => {
  const cols = ['color', 'hl', 'io', 'suit'];
  for (let n = 1; n <= 4; n++) {
    assert.equal(guessColumnFor({ code: `Digit${n}`, key: String(n) }), cols[n - 1]);
    assert.equal(guessColumnFor({ code: `Numpad${n}`, key: String(n) }), cols[n - 1]);
  }
  // French AZERTY: the unshifted top row types & and e-acute - still the digit keys.
  assert.equal(guessColumnFor({ code: 'Digit1', key: '&' }), 'color');
  assert.equal(guessColumnFor({ code: 'Digit2', key: 'é' }), 'hl');
  // A device that reports no code still works off the printed digit.
  assert.equal(guessColumnFor({ key: '3' }), 'io');
  assert.equal(guessColumnFor({ code: 'KeyA', key: 'a' }), undefined);
});

test('the colour column steps in the order its square draws: black, then red', () => {
  assert.deepEqual([...GUESS_COLUMNS.color], ['black', 'red']);
  const board = source('../components/board/GameBoard.svelte');
  assert.ok(board.indexOf('black-half') < board.indexOf('red-half'), 'the colour square no longer draws black first');
});

test('a column steps through every option and wraps, never back to empty', () => {
  for (const order of Object.values(GUESS_COLUMNS)) {
    let pick: string | null = null;
    const seen: string[] = [];
    for (let i = 0; i < order.length * 2; i++) {
      pick = nextGuess(order as readonly string[], pick);
      assert.ok(pick !== null);
      seen.push(pick);
    }
    assert.deepEqual(seen, [...order, ...order]);
  }
});

test('after an Equal pick, 3 never lands on Inside', () => {
  const allowed = (o: 'inside' | 'outside' | 'equal') => isCombinationPlayable('equal', o);
  let pick: 'inside' | 'outside' | 'equal' | null = null;
  for (let i = 0; i < 6; i++) {
    pick = nextGuess(GUESS_COLUMNS.io, pick, allowed);
    assert.notEqual(pick, 'inside');
  }
  // From an already-barred Inside (picked before Equal was), it moves off it.
  assert.equal(nextGuess(GUESS_COLUMNS.io, 'inside', allowed), 'outside');
});

test('the listener never re-sets the current pick, and stays out of fields and panels', () => {
  const bar = source('../components/board/ControlBar.svelte');
  const at = bar.indexOf('function onGuessKey');
  assert.ok(at > 0, 'the guess keys are gone');
  const body = bar.slice(at, bar.indexOf('\n}\n', at));
  assert.ok(body.includes('guessColumnFor(event)'), 'the keys are matched on something other than guessColumnFor');
  assert.match(body, /next === current\) return/, 'a key can clear a pick by re-setting it');
  for (const gate of ['celebration.active', 'chromeInert', "introPhase !== 'playing'", 'typingInto(', 'fixedChoices', 'choicesLocked()']) {
    assert.ok(body.includes(gate), `the guess keys lost the ${gate} gate`);
  }
});
