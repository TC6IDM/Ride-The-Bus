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
import { describe, test } from 'node:test';

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

test("Last Stop's ticket and the route are laid over the card row, never in it", () => {
  // Both arrived with Last Stop (2026-09-27). In the row they would widen it -
  // the four cards would stand somewhere else on Last Stop than on every other
  // family, and a ticket turning or a stop lighting could shift a slot. Laid
  // over it (absolute, on a positioned row) they move nothing; the deal and the
  // ticket's tilt are transforms, `rotate` and `translate`, which move no box.
  const css = source('../styles/board/cards.css');
  const rule = (selector: string) => {
    const at = css.indexOf(`\n${selector} {`);
    assert.ok(at >= 0, `cards.css lost its ${selector} rule`);
    return css.slice(at, css.indexOf('}', at));
  };
  assert.match(rule('.ticket-slot'), /position:\s*absolute/, 'the ticket slot is in the row');
  assert.match(rule('.route-line'), /position:\s*absolute/, 'the route line is in the row');
  assert.match(css, /\n\.card-row \{[^}]*position:\s*relative/, 'the row the two are laid over is not positioned');
  const board = source('../components/board/GameBoard.svelte');
  // The deal moves the CARD, not its slot - the slot is what the board is measured by.
  assert.match(board, /slot\?\.querySelector(<HTMLElement>)?\('\.card-block'\)/, 'the deal no longer animates the card block');
  assert.doesNotMatch(board, /slotEls\[[^\]]*\]\.animate\(/, 'the deal animates a slot, which moves the board');
});

describe('the deal', () => {
  const board = source('../components/board/GameBoard.svelte');
  const fn = (name: string) => {
    const start = board.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `GameBoard lost ${name}()`);
    return board.slice(start, board.indexOf('\n  }\n', start));
  };

  test('rests on the deck - cards and ticket alike - and card 1 waits out the beat', () => {
    // The owner's call (2026-10-01): with no rest, the last round's cards went
    // back to the deck and came out again in one motion. ONE constant, held as
    // two equal keyframes on the pile, and the reveal holds card 1 back by it -
    // a card dealt late would turn over in mid-flight.
    const pacing = source('./round/revealPacing.svelte.ts');
    const rest = /export const DEAL_REST_MS = (\d+);/.exec(pacing);
    assert.ok(rest && Number(rest[1]) > 0, 'DEAL_REST_MS is gone or zero');
    const deal = fn('dealFromDeck');
    assert.match(deal, /const rest = paceMs\(DEAL_REST_MS, 0\);/, 'the rest is not the shared, turbo-scaled beat');
    assert.match(deal, /\{ transform: atPile, offset: landed \},\s*\{ transform: atPile, offset: leaves/, 'no hold on the pile');
    assert.ok(/viaPile\(block,/.test(deal) && /viaPile\(ticketEl,/.test(deal), 'the cards and the ticket both rest');
    const reveal = source('./round/roundReveal.svelte.ts');
    const first = reveal.indexOf('if (i === 0) await revealWait(DEAL_REST_MS, 0);');
    assert.ok(first > 0, 'card 1 no longer waits out the rest');
    assert.ok(first < reveal.indexOf('await revealWait(650, 0);'), 'the rest must come before the first turn');
  });

  test('lands ON the pile: fitted to the prop, and out of sight while it rests', () => {
    // A fixed scale hovered over the deck at some sizes, and a full-brightness
    // card on a deck sunk to 60% floats however well it fits (2026-10-01).
    const deal = fn('dealFromDeck');
    assert.doesNotMatch(deal, /scale\(0\.\d+\)/, 'a fixed pile scale is back');
    assert.match(deal, /pile\.width \/ element\.offsetWidth/, 'the piece is not sized to the pile');
    assert.match(deal, /\{ opacity: 0, offset: landed \},\s*\{ opacity: 0, offset: leaves \}/, 'the piece shows while it rests');
  });

  test('measures each piece at rest, and a slam finishes the deal outright', () => {
    // Measured mid-transform - a deal still in flight, a lift easing back - a
    // card was sent to the wrong place, and fast slams strewed the cards over
    // the board (2026-10-01).
    const deal = fn('dealFromDeck');
    assert.ok(deal.indexOf("settleDeal('cancel')") >= 0, 'the last deal is not cleared first');
    assert.ok(deal.indexOf("settleDeal('cancel')") < deal.indexOf('restCentre('), 'cleared after measuring');
    assert.doesNotMatch(deal, /getBoundingClientRect/, 'a piece is measured where it is drawn, not where it rests');
    assert.match(fn('restCentre'), /matrixOf\(element\)/, 'restCentre no longer takes the running transform out');
    assert.match(board, /if \(pacing\.slamRequested\) untrack\(\(\) => settleDeal\('finish'\)\)/, 'a slam leaves the deal running');
    const bus = source('../styles/board/cards.css').match(/\n\.route-bus \{[^}]*\}/)?.[0] ?? '';
    assert.match(bus, /inset-inline-start calc\(var\(--flip-dur/, 'the bus drives on its own clock through a slam');
  });
});
