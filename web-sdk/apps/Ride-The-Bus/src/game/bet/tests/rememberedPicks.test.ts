/**
 * Remembered picks: what comes back from storage, and what is refused.
 *
 * The restore is a mode-restore site like replay and resume, so the same rule
 * holds: only a mode the math publishes may reach the board. A slug read from
 * storage is player-controlled data and is validated as such.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { PICKS_KEY, readRememberedPicks, writeRememberedPicks } from '../rememberedPicks.ts';

/** A Map shaped like Storage. */
function memory(initial?: string) {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(PICKS_KEY, initial);
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), map };
}

describe('rememberedPicks', () => {
  test('a complete pick round-trips with its family', () => {
    const s = memory();
    writeRememberedPicks(s, 'hs', 'hs_red_higher_outside_heart');
    assert.deepEqual(readRememberedPicks(s), { family: 'hs', mode: 'hs_red_higher_outside_heart' });
  });

  test('incomplete picks remember the family alone', () => {
    const s = memory();
    writeRememberedPicks(s, 'sc', null);
    assert.deepEqual(readRememberedPicks(s), { family: 'sc', mode: null });
  });

  test('Three of a Kind remembers its one mode', () => {
    const s = memory();
    writeRememberedPicks(s, 'tr', 'tr_any_equal_equal');
    assert.deepEqual(readRememberedPicks(s), { family: 'tr', mode: 'tr_any_equal_equal' });
  });

  test('Equal-then-Inside is refused - the math publishes no such mode', () => {
    const s = memory(JSON.stringify({ v: 1, family: 'base', mode: 'red_equal_inside_heart' }));
    assert.deepEqual(readRememberedPicks(s), { family: 'base', mode: null });
  });

  test('a slug from another family keeps the family but not the picks', () => {
    const s = memory(JSON.stringify({ v: 1, family: 'base', mode: 'hs_red_higher_outside_heart' }));
    assert.deepEqual(readRememberedPicks(s), { family: 'base', mode: null });
  });

  test('junk, an unknown family, an old version or nothing reads as nothing', () => {
    for (const raw of ['not json', '{}', 'null', JSON.stringify({ v: 2, family: 'base', mode: null }), JSON.stringify({ v: 1, family: 'xx', mode: null })]) {
      assert.equal(readRememberedPicks(memory(raw)), null, raw);
    }
    assert.equal(readRememberedPicks(memory()), null);
    assert.equal(readRememberedPicks(null), null);
  });

  test('storage that throws costs the convenience, never the game', () => {
    const hostile = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    assert.equal(readRememberedPicks(hostile), null);
    assert.doesNotThrow(() => writeRememberedPicks(hostile, 'base', null));
  });

  test('the bet amount is never stored', () => {
    const s = memory();
    writeRememberedPicks(s, 'base', 'red_higher_outside_heart');
    const stored = JSON.parse(s.map.get(PICKS_KEY)!);
    assert.deepEqual(Object.keys(stored).sort(), ['family', 'mode', 'v']);
  });
});
