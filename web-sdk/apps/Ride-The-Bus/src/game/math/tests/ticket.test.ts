/**
 * Last Stop: the ticket, and the suit card it pays for.
 *
 * What is pinned here, and why each is its own assertion:
 *
 *   * THE STACK is ten 2x, five 3x, three 5x and two 10x, mirroring
 *     TICKET_STACK in game_calculations.py. How to Play draws it and the
 *     reweight publishes it at exactly these odds.
 *   * CARDS 1-3 ARE CLASSIC'S, AND THE SUIT CARD HAS NO PRICE. Every price on
 *     cards 1-3 is Classic's to the bit, a miss keeps Classic's 30% decayed
 *     the same way, and a right suit multiplies the running total by nothing
 *     until the ticket does. The owner's call (2026-09-30), after a design that
 *     took the ticket's price out of card 1 read 1.28x where Classic reads
 *     1.99x - a mode that cut the player's profit and handed it back.
 *   * NO RIGHT GUESS SHOWS UNDER 1x, on any family (the owner's rule,
 *     2026-09-27). Checked at each stage's most likely pick, which is where a
 *     price is lowest.
 *   * THE TICKET multiplies the running total before the one floor, only on a
 *     clean sweep, and a sweep must carry one.
 *   * bookTicket REFUSES every ticket this game never writes, and a sweep with
 *     none.
 *   * THE BEAT BEFORE THE TICKET TURNS reads nothing of its value, and card 4's
 *     chip lands with the ticket rather than before it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';

import {
  applyBust,
  bookTicket,
  computeFinalMultiplier,
  guessPrice,
  quantizeMultiplier,
  TICKET_STAGE_PAYOUT,
  ticketStage,
  ticketValues,
  topTicket,
} from '../payout.ts';
import { FAMILY_RULES, MODE_FAMILIES, TICKET_STACK } from '../modes.ts';
import { classicEndingFor, exampleRoundFor, payoutRowsFor, ticketStackFor } from '../payoutTable.ts';
import { ticketString } from '../../ui/multiplier.ts';

const LS = FAMILY_RULES.ls;
const BASE = FAMILY_RULES.base;

describe('the ticket stack', () => {
  test('is ten 2x, five 3x, three 5x and two 10x - twenty tickets', () => {
    assert.deepEqual(TICKET_STACK, [
      [2, 10],
      [3, 5],
      [5, 3],
      [10, 2],
    ]);
    assert.equal(ticketValues(LS)!.length, 20);
    assert.equal(topTicket(LS), 10);
  });

  test('is Last Stop alone, and pays its last card', () => {
    for (const family of MODE_FAMILIES) {
      assert.equal(FAMILY_RULES[family].ticket !== null, family === 'ls', family);
      assert.equal(ticketStage(FAMILY_RULES[family]), family === 'ls' ? 3 : -1, family);
    }
    assert.equal(topTicket(BASE), 1);
  });

  test('How to Play lists every value with its count, lowest first', () => {
    assert.deepEqual(ticketStackFor(LS), [
      { value: 2, count: 10, of: 20 },
      { value: 3, count: 5, of: 20 },
      { value: 5, count: 3, of: 20 },
      { value: 10, count: 2, of: 20 },
    ]);
    assert.equal(ticketStackFor(FAMILY_RULES.hs), null);
  });

  test('prints with the sign in front, as an instruction and not a payout', () => {
    assert.equal(ticketString(5), '×5');
    assert.equal(ticketString(10), '×10');
    const ar = (v: number, f: Intl.NumberFormatOptions) => new Intl.NumberFormat('ar-EG', f).format(v);
    assert.equal(ticketString(10, ar), '×١٠');
  });
});

describe('Last Stop is Classic until the suit', () => {
  test('its rules are Classic’s but for the ticket', () => {
    assert.deepEqual(LS.retention, BASE.retention);
    assert.equal(LS.forgive, BASE.forgive);
    assert.equal(LS.targetRtp, BASE.targetRtp);
    assert.equal(LS.cost, BASE.cost);
  });

  test('cards 1-3 are priced exactly as Classic’s, at every probability and miss state', () => {
    for (let stage = 0; stage < 3; stage += 1) {
      for (const p of [1 / 51, 3 / 51, 0.25, 0.5, 26 / 51, 48 / 51, 48 / 50]) {
        assert.equal(guessPrice(LS, stage, p), guessPrice(BASE, stage, p), `card ${stage + 1} at p=${p}`);
      }
    }
  });

  test('a miss keeps what Classic’s does, decayed the same way', () => {
    for (let stage = 1; stage < 4; stage += 1) {
      assert.equal(applyBust(7.3, LS, stage, 4), applyBust(7.3, BASE, stage, 4), `card ${stage + 1}`);
    }
    // A wrong suit keeps 30% exactly - no card is left to decay for.
    assert.equal(applyBust(10, LS, 3, 4), 3);
  });

  test('the suit card has no price: a right suit multiplies by 1 until the ticket turns', () => {
    for (const p of [10 / 49, 12 / 49, 13 / 49]) assert.equal(guessPrice(LS, 3, p), TICKET_STAGE_PAYOUT);
    assert.equal(TICKET_STAGE_PAYOUT, 1);
  });

  test('the payout table’s suit row is the stack, and every other row is Classic’s', () => {
    const mine = payoutRowsFor(LS);
    const classic = payoutRowsFor(BASE);
    for (const [i, row] of mine.entries()) {
      if (row.stage === 4) {
        assert.deepEqual({ min: row.min, max: row.max, kind: row.kind }, { min: 2, max: 10, kind: 'factor' });
      } else {
        assert.deepEqual(row, classic[i], `row ${row.stage} ${row.label}`);
      }
    }
  });
});

describe('the owner’s rule', () => {
  test('never makes a right guess show under 1x, on any family', () => {
    // A price falls as its odds rise, so each stage is checked at its most
    // likely pick: card 1 is always 26 of 52; Higher on an Ace (or Lower on a
    // King) is 48 of 51; Outside on a pair is 48 of 50; a suit is at most 13
    // of 49. The ticket's card reads 1 here and is paid at least 2x by the
    // ticket.
    const MOST_LIKELY = [26 / 52, 48 / 51, 48 / 50, 13 / 49];
    for (const family of MODE_FAMILIES) {
      const rules = FAMILY_RULES[family];
      if (rules.fixedChoices) continue;
      for (const spent of [false, true]) {
        MOST_LIKELY.forEach((p, stage) => {
          const m = guessPrice(rules, stage, p, spent);
          assert.ok(m >= 1, `${family} card ${stage + 1} (spent=${spent}) pays x${m.toFixed(4)} for a right guess`);
        });
      }
    }
    assert.ok(Math.min(...ticketValues(LS)!) >= 2);
  });
});

describe('settling a Last Stop round', () => {
  const sweep = [
    { correct: true, payout: 1.995 },
    { correct: true, payout: 1.7 },
    { correct: true, payout: 2.3 },
    { correct: true, payout: TICKET_STAGE_PAYOUT },
  ];

  test('the ticket multiplies the run to card 3 before the one floor', () => {
    const running = 1.995 * 1.7 * 2.3;
    assert.equal(computeFinalMultiplier(sweep, LS, 5), quantizeMultiplier(running * 5));
    assert.equal(computeFinalMultiplier(sweep, LS, 2), quantizeMultiplier(running * 2));
  });

  test('a ticket on a round that did not sweep is refused, and so is a sweep without one', () => {
    const bust = sweep.map((stage, i) => ({ ...stage, correct: i !== 1 }));
    assert.throws(() => computeFinalMultiplier(bust, LS, 10));
    assert.throws(() => computeFinalMultiplier(sweep, LS), /no ticket/);
    assert.throws(() => computeFinalMultiplier(sweep, BASE, 2), 'Classic draws no ticket');
  });

  test('a bust keeps Classic’s share, and no ticket', () => {
    const missedSuit = sweep.map((stage, i) => ({ ...stage, correct: i !== 3 }));
    assert.equal(computeFinalMultiplier(missedSuit, LS), computeFinalMultiplier(missedSuit, BASE));
  });

  test('the worked example ends on the ticket’s range, set beside Classic’s ending', () => {
    const mine = exampleRoundFor(LS);
    const classic = exampleRoundFor(BASE);
    // Cards 1-3 read exactly as Classic's...
    for (let i = 0; i < 3; i += 1) assert.deepEqual(mine[i], classic[i], `step ${i + 1}`);
    // ...and the suit card's total is the range the ticket decides.
    const last = mine.at(-1)!;
    assert.ok(last.upTo !== null && last.runningTotal < last.upTo);
    assert.equal(classic.at(-1)!.upTo, null);
    assert.equal(classicEndingFor(LS), classic.at(-1)!.runningTotal);
    assert.equal(classicEndingFor(BASE), null);
  });
});

describe('bookTicket', () => {
  const reveal = (correct: boolean) => ({ type: 'reveal', correct });
  const sweep = [reveal(true), reveal(true), reveal(true), reveal(true)];

  test('reads the ticket off a clean sweep, and null off a round that missed', () => {
    assert.equal(bookTicket([...sweep, { type: 'ticket', value: 5 }, { type: 'finalWin' }], LS), 5);
    assert.equal(bookTicket([reveal(true), reveal(false), { type: 'finalWin' }], LS), null);
    assert.equal(bookTicket([...sweep, { type: 'finalWin' }], BASE), null);
  });

  test('refuses every ticket this game never writes, and a sweep with none', () => {
    const bust = [reveal(true), reveal(false), reveal(false), reveal(false)];
    assert.throws(() => bookTicket([...bust, { type: 'ticket', value: 5 }], LS), /missed/);
    assert.throws(() => bookTicket([...sweep, { type: 'ticket', value: 5 }], BASE), /draws none/);
    assert.throws(() => bookTicket([...sweep, { type: 'ticket', value: 4 }], LS), /not in the stack/);
    assert.throws(
      () => bookTicket([...sweep, { type: 'ticket', value: 2 }, { type: 'ticket', value: 2 }], LS),
      /more than one/,
    );
    assert.throws(() => bookTicket([...sweep, { type: 'finalWin' }], LS), /no ticket/);
  });
});

describe('the reveal', () => {
  const REVEAL = resolve(import.meta.dirname, '../../round/roundReveal.svelte.ts');
  const source = readFileSync(REVEAL, 'utf8');
  const OPEN = 'if (round.ticket !== null && !busted) {';

  test('reads nothing of the ticket before it turns', () => {
    // The pause before the flip must be the same whatever is under it -
    // pacing that knew the value would announce it. So between the beat's
    // opening and the ticket being turned face up, the only thing read off
    // round.ticket is whether there is one.
    const open = source.indexOf(OPEN);
    const turned = source.indexOf('round.ticketShown = round.ticket;', open);
    assert.ok(open > 0 && turned > open, 'the ticket beat moved - re-point this test');
    const before = source.slice(open + OPEN.length, turned);
    assert.doesNotMatch(before, /round\.ticket/, 'the beat before the flip reads the ticket');
    assert.match(before, /revealWait\(TICKET_BEAT_MS, 0\)/);
  });

  test('never turns a ticket over after a bust', () => {
    assert.ok(source.includes(OPEN));
  });

  test('the running total waits for the ticket to turn, as it waits for a card', () => {
    // Found in review (2026-10-01): the reveal sets the ticketed total in the
    // same tick it turns the ticket, and the board's readout latch only waited
    // for CARDS - so a x10 printed while the ticket still showed its back.
    const board = readFileSync(resolve(import.meta.dirname, '../../../components/board/GameBoard.svelte'), 'utf8');
    assert.match(
      board,
      /if \(dealt > dealtBefore \|\| \(ticket !== null && ticketBefore === null\)\) \{\s*landsAt = /,
      'the readout no longer treats the ticket as a landing',
    );
  });

  test('lands card 4’s chip with the ticket, not before it', () => {
    // A right suit has not paid until the ticket turns, so the loop leaves
    // its chip alone and the ticket beat sets it on the ticketed total.
    assert.match(source, /if \(i !== paidByTicket \|\| busted\) \{\s*round\.stageMultipliers\[i\]/);
    const beat = source.slice(source.indexOf(OPEN));
    assert.match(beat, /running \*= round\.ticket;\s*round\.stageMultipliers\[last\] = quantizeMultiplier/);
  });
});

describe('the ticket in right to left', () => {
  test('its figures are pinned left to right, so "×2 – ×10" never reorders', () => {
    // Found in Arabic on 2026-09-27: the range printed "10× – 2×", the page's
    // direction reordering the figures around the dash. The name in the band
    // keeps the page's direction; the figures do not.
    const face = readFileSync(resolve(import.meta.dirname, '../../../components/cards/TicketFace.svelte'), 'utf8');
    const rule = face.match(/\.tk-value,\s*\.tk-range\s*\{([^}]*)\}/);
    assert.ok(rule, 'TicketFace no longer pins its figures');
    assert.match(rule[1]!, /direction:\s*ltr/);
  });
});
