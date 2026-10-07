/**
 * The recent-rounds list: newest first, capped, and made of copies.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { HISTORY_CAP, pushRound, snapshotCards, type HistoryEntry } from '../historyList.ts';

const entry = (id: number): HistoryEntry => ({
  id,
  family: 'base',
  mode: 'red_higher_outside_heart',
  cards: [{ rank: 'K', suit: '♥' }, null, null, null],
  bustedIndex: 1,
  forgivenIndex: null,
  ticket: null,
  bet: 1,
  cost: 1,
  won: 0.5,
  multiplier: 0.5,
  net: false,
  sweep: false,
});

describe('the recent-rounds list', () => {
  test('the newest round is first', () => {
    const list = pushRound(pushRound([], entry(1)), entry(2));
    assert.deepEqual(list.map((e) => e.id), [2, 1]);
  });

  test(`it keeps the last ${HISTORY_CAP} and drops the oldest`, () => {
    let list: HistoryEntry[] = [];
    for (let i = 1; i <= HISTORY_CAP + 3; i++) list = pushRound(list, entry(i));
    assert.equal(list.length, HISTORY_CAP);
    assert.equal(list[0]!.id, HISTORY_CAP + 3);
    assert.equal(list.at(-1)!.id, 4);
  });

  test('adding never changes the list it was given', () => {
    const before = [entry(1)];
    pushRound(before, entry(2));
    assert.deepEqual(before.map((e) => e.id), [1]);
  });

  test('the cards are copies - the next deal cannot rewrite a past row', () => {
    const dealt = [{ rank: 'K', suit: '♥' }, { rank: '7', suit: '♠' }, null, undefined];
    const snap = snapshotCards(dealt);
    dealt[0]!.rank = 'A';
    assert.deepEqual(snap, [{ rank: 'K', suit: '♥' }, { rank: '7', suit: '♠' }, null, null]);
  });
});
