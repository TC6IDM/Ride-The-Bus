/**
 * The table die's picks (game/bet/dicePicks.ts) and the wiring around it.
 *
 *   * EVERY PLAYABLE COMBINATION, EVENLY, AND NEVER THE ONE ON THE BOARD. A
 *     roll is one of the 64 published combinations - so Equal-then-Inside, the
 *     one with no bet mode, cannot come up - and a roll always changes
 *     something.
 *   * THE DIE IS PART OF THE GUESS ROW: rendered in the four-guess row only,
 *     refused by the same lock as the squares, its picks set on the click
 *     through one assignment (the setters toggle), and on the physical right
 *     in Arabic, because the table's props do not mirror.
 *   * IT SOUNDS ONCE: its own roll, never a press under it.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DIE_LANDINGS, DIE_ROLL_MS, ROLLABLE, rollFace, rollPicks } from '../dicePicks.ts';
import { combosFor, isCombinationPlayable } from '../../math/modes.ts';
import { source } from '../../sources.testlib.ts';

const key = (p: { color: unknown; hl: unknown; io: unknown; suit: unknown }) => `${p.color}_${p.hl}_${p.io}_${p.suit}`;

/** A stand-in random source that walks [0, 1) evenly. */
const sweep = (n: number) => {
  let i = 0;
  return () => (i++ % n) / n + 1 / (2 * n);
};

describe('the picks', () => {
  test('are the 64 combinations a four-guess family publishes, and only those', () => {
    assert.equal(ROLLABLE.length, 64);
    assert.deepEqual(
      ROLLABLE.map(key).sort(),
      combosFor('base').map(([c, h, i, s]) => `${c}_${h}_${i}_${s}`).sort(),
    );
    assert.ok(ROLLABLE.every((p) => isCombinationPlayable(p.hl, p.io)), 'Equal then Inside can be rolled');
  });

  test('a roll reaches every other combination evenly, and never repeats the board', () => {
    const current = ROLLABLE[17]!;
    const random = sweep(63 * 4);
    const seen = new Map<string, number>();
    for (let i = 0; i < 63 * 4; i++) {
      const p = rollPicks(current, random);
      seen.set(key(p), (seen.get(key(p)) ?? 0) + 1);
    }
    assert.equal(seen.has(key(current)), false, 'the roll landed on the picks already on the board');
    assert.equal(seen.size, 63);
    assert.ok([...seen.values()].every((n) => n === 4), 'the 63 are not equally likely');
  });

  test('from a board with picks missing, any of the 64 can come up', () => {
    const random = sweep(64);
    const seen = new Set<string>();
    for (let i = 0; i < 64; i++) seen.add(key(rollPicks({ color: 'red', hl: null, io: null, suit: null }, random)));
    assert.equal(seen.size, 64);
  });

  test('stays in range at the very top of the random source', () => {
    assert.ok(rollPicks(ROLLABLE[0]!, () => 0.9999999999));
    assert.ok(rollFace(6, () => 0.9999999999) <= 6);
  });

  test('the die shows a new face every roll, and every face can come up', () => {
    for (let previous = 1; previous <= 6; previous++) {
      const random = sweep(5);
      const faces = new Set<number>();
      for (let i = 0; i < 5; i++) faces.add(rollFace(previous, random));
      assert.equal(faces.has(previous), false, `rolled ${previous} again`);
      assert.deepEqual([...faces].sort(), [1, 2, 3, 4, 5, 6].filter((f) => f !== previous));
    }
  });

  test('its landings sit inside its tumble, the last at its end', () => {
    assert.ok(DIE_ROLL_MS > 0);
    assert.ok(DIE_LANDINGS.every((at, i) => at > 0 && at <= 1 && (i === 0 || at > DIE_LANDINGS[i - 1]!)));
    assert.equal(DIE_LANDINGS.at(-1), 1);
  });
});

describe('the die on the table', () => {
  const die = source('../components/board/TableDie.svelte');
  const board = source('../components/board/GameBoard.svelte');

  test('is in the four-guess row, and not on Three of a Kind', () => {
    const fourGuess = board.slice(board.indexOf('{:else}\n<div class="choice-row"'), board.lastIndexOf('{/if}'));
    assert.match(fourGuess, /<TableDie \/>/, 'the die is not in the four-guess row');
    const trips = board.slice(board.indexOf('{#if fixed}'), board.indexOf('{:else}\n<div class="choice-row"'));
    assert.doesNotMatch(trips, /TableDie/, 'Three of a Kind has no guesses to roll');
    assert.match(source('../styles/board/choices-board.css'), /\.choice-row \{\s*position: relative;/);
  });

  test('is refused by the squares\' own lock, and sets the picks on the click', () => {
    const start = die.indexOf('function roll(');
    assert.ok(start >= 0, 'TableDie lost roll()');
    const roll = die.slice(start, die.indexOf('function tumble('));
    // Space always deals, a focused die included: the bar takes it from every
    // button, keydown and keyup (the owner's call, 2026-10-02).
    const bar = source('../components/board/ControlBar.svelte');
    assert.match(bar, /return !\['INPUT', 'TEXTAREA', 'SELECT'\]\.includes\(el\.tagName\);/, 'Space yields to a focused button again');
    assert.match(bar, /if \(spaceDown\) event\.preventDefault\(\);/, 'a focused button still fires on the keyup');
    assert.match(roll, /if \(choicesLocked\(\)\) \{\s*sound\.playBlocked\(\);\s*return;/, 'a locked die still rolls');
    assert.ok(roll.indexOf('setAllGuesses(rollPicks(guesses))') < roll.indexOf('tumble('), 'picks wait for the landing');
    const betState = source('./bet/betState.svelte.ts');
    const assign = betState.slice(betState.indexOf('export function setAllGuesses'));
    assert.match(assign.slice(0, assign.indexOf('\n}\n')), /\) \{\n {2}if \(!isCombinationPlayable\(next\.hl, next\.io\)\) return;/);
  });

  test('sits on the physical right in every language', () => {
    const rule = die.match(/\n\t\.table-die \{[^}]*\}/)?.[0] ?? '';
    assert.match(rule, /\bleft: calc\(100% \+/, 'the die is not placed off the row\'s right edge');
    const styles = die.slice(die.indexOf('<style>'));
    assert.doesNotMatch(styles, /inset-inline|margin-inline|padding-inline/, 'a logical offset mirrors the die onto the left-hand chips in Arabic');
  });

  test('sounds its own roll, on its landings, and no press under it', () => {
    assert.match(die, /sound\.playDiceRoll\(DIE_LANDINGS\.map\(/);
    const cues = source('./ui/pressCues.ts');
    assert.match(cues, /export const OWN_CUE = '\.table-die';/);
    assert.match(cues, /if \(el\.closest\(OWN_CUE\)\) return;/);
  });
});
