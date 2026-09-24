/**
 * The "needs" line and the example round say what a card had to be and how
 * many cards could be it. That count is only honest if it is the one the stage
 * was PRICED on, so this file does two things: pins the counts by hand, and
 * replays published books to prove stagePrice(stageNeed(...)) reproduces every
 * stage payout the math wrote - correct guesses, misses, Second Chance's
 * forgiveness, and the stages a book goes on pricing after a bust.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { createReadStream, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';

import { formatRankRuns, stageNeed, stagePrice } from '../stageOdds.ts';
import { DECAY, forgivenessAvailable, partialMultiplier } from '../payout.ts';
import { FAMILY_RULES, familyOf } from '../modes.ts';
import type { Card } from '../../round/roundContract.ts';
import { INDEX, PUBLISH_DIR, mathBuildIsCurrent } from '../../mathBuild.testlib.ts';

const card = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });
const base = FAMILY_RULES.base;
const trips = FAMILY_RULES.tr;

describe('stageNeed counts the deck the stage is priced on', () => {
  test('card 1: a colour is half of a full deck', () => {
    assert.deepEqual(stageNeed(base, 0, 'red', []), { kind: 'color', color: 'red', hits: 26, total: 52 });
    assert.deepEqual(stageNeed(base, 0, 'black', []), { kind: 'color', color: 'black', hits: 26, total: 52 });
  });

  test('card 2: higher, lower and equal against card 1', () => {
    const dealt = [card('7', '♥')];
    const higher = stageNeed(base, 1, 'higher', dealt);
    assert.equal(higher.kind, 'ranks');
    assert.deepEqual(higher.kind === 'ranks' && higher.ranks, ['8', '9', '10', 'J', 'Q', 'K']);
    assert.equal(higher.hits, 24);
    assert.equal(higher.total, 51);
    assert.equal(stageNeed(base, 1, 'lower', dealt).hits, 24);
    const equal = stageNeed(base, 1, 'equal', dealt);
    assert.deepEqual(equal.kind === 'ranks' && equal.ranks, ['7']);
    assert.equal(equal.hits, 3, 'three sevens left once one is on the table');
  });

  test('a guess nothing left can land is an empty list and zero hits', () => {
    const higherOnKing = stageNeed(base, 1, 'higher', [card('K', '♣')]);
    assert.deepEqual(higherOnKing.kind === 'ranks' && higherOnKing.ranks, []);
    assert.equal(higherOnKing.hits, 0);
    const insideAdjacent = stageNeed(base, 2, 'inside', [card('4', '♣'), card('5', '♦')]);
    assert.equal(insideAdjacent.hits, 0);
  });

  test('card 3: inside, outside and equal are strict about the two references', () => {
    const dealt = [card('4', '♣'), card('7', '♦')];
    const inside = stageNeed(base, 2, 'inside', dealt);
    assert.deepEqual(inside.kind === 'ranks' && inside.ranks, ['5', '6']);
    assert.equal(inside.hits, 8);
    assert.equal(inside.total, 50);
    const outside = stageNeed(base, 2, 'outside', dealt);
    assert.deepEqual(outside.kind === 'ranks' && outside.ranks, ['A', '2', '3', '8', '9', '10', 'J', 'Q', 'K']);
    assert.equal(outside.hits, 36);
    const equal = stageNeed(base, 2, 'equal', dealt);
    assert.deepEqual(equal.kind === 'ranks' && equal.ranks, ['4', '7']);
    assert.equal(equal.hits, 6, 'three fours and three sevens');
  });

  test('card 4: a suit, with the ones already dealt taken out', () => {
    const dealt = [card('7', '♥'), card('J', '♠'), card('2', '♣')];
    assert.deepEqual(stageNeed(base, 3, 'heart', dealt), { kind: 'suit', suit: '♥', hits: 12, total: 49 });
    assert.deepEqual(stageNeed(base, 3, 'club', dealt), { kind: 'suit', suit: '♣', hits: 12, total: 49 });
    assert.equal(stageNeed(base, 3, 'diamond', dealt).hits, 13);
  });

  test("Three of a Kind counts its own twelve-card deck", () => {
    assert.deepEqual(stageNeed(trips, 0, 'any', []), { kind: 'free', hits: 12, total: 12 });
    const second = stageNeed(trips, 1, 'equal', [card('A', '♠')]);
    assert.deepEqual(second.kind === 'ranks' && second.ranks, ['A']);
    assert.equal(second.hits, 3);
    assert.equal(second.total, 11);
    const third = stageNeed(trips, 2, 'equal', [card('A', '♠'), card('A', '♥')]);
    assert.equal(third.hits, 2);
    assert.equal(third.total, 10);
  });

  test('stagePrice is partialMultiplier on the same odds', () => {
    const red = stageNeed(base, 0, 'red', []);
    assert.equal(stagePrice(base, 0, red, false), partialMultiplier(0.5, 0, 0, DECAY));
    // The free card pays exactly 1.00x on the only family that has one.
    assert.equal(stagePrice(trips, 0, stageNeed(trips, 0, 'any', []), false), 1);
  });
});

describe('formatRankRuns', () => {
  test('runs of three or more are ranges; pairs and singles are named', () => {
    assert.equal(formatRankRuns(['8', '9', '10', 'J', 'Q', 'K']), '8–K');
    assert.equal(formatRankRuns(['A', '2', '3', '8', '9', '10', 'J', 'Q', 'K']), 'A–3, 8–K');
    assert.equal(formatRankRuns(['4', '7']), '4, 7');
    assert.equal(formatRankRuns(['5', '6']), '5, 6');
    assert.equal(formatRankRuns(['7']), '7');
    assert.equal(formatRankRuns([]), '—');
  });
});

// ---------------------------------------------------------------------------
// Parity with the published books - the reason the line can be trusted.
// ---------------------------------------------------------------------------

type Book = { id: number; events: any[] };

async function readBooks(file: string, limit: number): Promise<Book[]> {
  const stream = createReadStream(file).pipe(createZstdDecompress());
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  const out: Book[] = [];
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      out.push(JSON.parse(line));
      if (out.length >= limit) break;
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  return out;
}

describe('parity with the published books', () => {
  const available = mathBuildIsCurrent();

  test('every stage payout in the books is stagePrice(stageNeed(...))', { skip: !available }, async () => {
    const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { modes: { name: string; events: string }[] };
    let checked = 0;
    const mismatches: string[] = [];

    for (const mode of index.modes) {
      const rules = FAMILY_RULES[familyOf(mode.name)];
      for (const book of await readBooks(join(PUBLISH_DIR, mode.events), 40)) {
        const reveals = book.events.filter((e: any) => e.type === 'reveal');
        const cards: Card[] = [];
        let busted = false;
        let forgivenessSpent = false;
        reveals.forEach((event: any, i: number) => {
          const price = stagePrice(rules, i, stageNeed(rules, i, event.choice, cards), forgivenessSpent);
          if (Math.abs(price - event.payout) > 1e-9 && mismatches.length < 5) {
            mismatches.push(`${mode.name} id=${book.id} stage ${i + 1} ${event.choice}: ${price} vs book ${event.payout}`);
          }
          checked += 1;
          // The book walks on past a bust, pricing the stages it never plays;
          // only a FORGIVEN miss changes what the next stage is priced against.
          if (!busted && !event.correct) {
            if (forgivenessAvailable(rules, i, forgivenessSpent)) forgivenessSpent = true;
            else busted = true;
          }
          cards.push(event.card as Card);
        });
      }
    }

    assert.equal(mismatches.length, 0, `${mismatches.length} stage prices disagree:\n  ${mismatches.join('\n  ')}`);
    assert.ok(checked > 10_000, `only ${checked} stages checked`);
    console.log(`    ${checked.toLocaleString()} stage prices reproduced from the published books`);
  });
});
