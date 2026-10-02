/**
 * The decks the families deal from.
 *
 * createDeck grew a spec when Three of a Kind arrived with its own deck. The
 * four-guess families still deal the standard 52, and the odds every one of
 * their stages is priced on assume it - so the default has to stay exactly
 * what it was, and the trips deck has to be exactly what game_calculations.py
 * builds (TRIPS_DECK there, TRIPS_DECK here), in the same order. Twelve cards.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { createDeck, ranks, suits } from '../roundContract.ts';
import { FAMILY_RULES, MODE_FAMILIES, TRIPS_DECK } from '../../math/modes.ts';

describe('createDeck', () => {
  test('with no spec it is the standard 52, one of each', () => {
    const deck = createDeck();
    assert.equal(deck.length, 52);
    assert.equal(new Set(deck.map((c) => c.rank + c.suit)).size, 52);
    for (const suit of suits) {
      assert.deepEqual(
        deck.filter((c) => c.suit === suit).map((c) => c.rank),
        [...ranks],
        `${suit} is not every rank in ranks order`,
      );
    }
  });

  test('null means the same as no spec', () => {
    assert.deepEqual(createDeck(null), createDeck());
  });

  test("Three of a Kind's deck is the Ace, King and Queen of each suit, once", () => {
    const deck = createDeck(TRIPS_DECK);
    assert.equal(deck.length, 12);
    assert.equal(new Set(deck.map((c) => c.rank + c.suit)).size, 12, 'no card twice');
    assert.deepEqual(
      [...new Set(deck.map((c) => c.rank))],
      ['A', 'Q', 'K'],
      'ranks come out in roundContract order (Ace low), so rankValue keeps its meaning',
    );
    for (const suit of suits) {
      assert.equal(deck.filter((c) => c.suit === suit).length, 3, `${suit}`);
    }
    // The odds the family is priced on: card 2 matches 3 of 11, card 3 matches
    // 2 of 10 - four of every rank, one deck.
    const perRank = deck.filter((c) => c.rank === deck[0]!.rank).length;
    assert.equal(perRank, 4);
  });

  test('copies multiply the whole deck, and ranks stay in order', () => {
    const deck = createDeck({ ranks: ['Q', 'K', 'A'], copies: 2 });
    assert.equal(deck.length, 24);
    assert.equal(deck.filter((c) => c.rank === 'A' && c.suit === '♠').length, 2);
    assert.deepEqual([...new Set(deck.map((c) => c.rank))], ['A', 'Q', 'K']);
  });

  test('every family deals the deck its rules name', () => {
    for (const family of MODE_FAMILIES) {
      const spec = FAMILY_RULES[family].deck;
      const deck = createDeck(spec);
      if (spec === null) {
        assert.equal(deck.length, 52, `${family} should deal the standard deck`);
      } else {
        assert.equal(deck.length, spec.ranks.length * suits.length * spec.copies, family);
      }
    }
    assert.equal(FAMILY_RULES.tr.deck, TRIPS_DECK);
  });
});
