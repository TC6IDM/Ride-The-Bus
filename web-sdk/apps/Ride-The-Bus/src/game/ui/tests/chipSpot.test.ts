/**
 * Where a pick's chip lies (chipSpot.ts) and which chip it is (betChips.ts
 * chipForBet) - the owner's E3 rules of 2026-10-17 and notes of 2026-10-18.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { EQUAL_SPOT, SUIT_CLEAR, chipAt, chipSpot, placeChip } from '../chipSpot.ts';
import { chipColour, chipForBet, chipInlayAlt } from '../../bet/betChips.ts';

const fixed = (value: number) => () => value;

describe('a chip lands near the click, inside the rules', () => {
  test('a click on a colour half is kept clear of the edges', () => {
    const corner = chipSpot('color', 'red', { x: 0, y: 1 }, fixed(0.5));
    assert.deepEqual([corner.x, corner.y], [0.34, 0.76]);
    const middle = chipSpot('color', 'red', { x: 0.5, y: 0.4 }, fixed(0.5));
    assert.deepEqual([middle.x, middle.y], [0.5, 0.4]);
  });

  test('Higher / Lower: the click picks the side of the triangle, never the triangle', () => {
    for (const x of [0, 0.3, 0.49]) assert.ok(chipSpot('hl', 'higher', { x, y: 0.5 }).x <= 0.24, `clicked ${x}`);
    for (const x of [0.51, 0.7, 1]) assert.ok(chipSpot('hl', 'higher', { x, y: 0.5 }).x >= 0.76, `clicked ${x}`);
  });

  test('Inside / Outside: the click picks above or below the card mark', () => {
    for (const y of [0, 0.45]) assert.ok(chipSpot('io', 'outside', { x: 0.5, y }).y <= 0.22);
    for (const y of [0.55, 1]) assert.ok(chipSpot('io', 'outside', { x: 0.5, y }).y >= 0.78);
  });

  test('a suit chip is pushed off the mark, and may overhang the edge a little but not far', () => {
    for (const [x, y] of [[0.5, 0.5], [0.55, 0.45], [0.4, 0.6], [0, 0], [1, 1]]) {
      const spot = chipSpot('suit', 'heart', { x: x!, y: y! });
      assert.ok(Math.hypot(spot.x - 0.5, spot.y - 0.5) >= SUIT_CLEAR - 1e-9, `on the mark from ${x},${y}`);
      assert.ok(spot.x >= 0.12 && spot.x <= 0.88 && spot.y >= 0.12 && spot.y <= 0.88, `too far out from ${x},${y}`);
    }
  });

  test('"=" keeps its seam place whatever is clicked - a little further out than half-on', () => {
    assert.deepEqual(
      [chipSpot('hl', 'equal', { x: 0.1, y: 0.1 }).x, chipSpot('hl', 'equal', null).y],
      [EQUAL_SPOT.hl.x, EQUAL_SPOT.hl.y],
    );
    assert.ok(EQUAL_SPOT.hl.x > 1 && EQUAL_SPOT.io.y > 1, 'the "=" chip moved back onto the badge');
  });

  test('a spot is remembered per pick, so the intro’s chip and the board’s are one', () => {
    const placed = placeChip('color', 'black', { x: 0.6, y: 0.3 });
    assert.equal(chipAt('color', 'black'), placed);
    assert.equal(chipAt('color', null), null);
  });
});

describe('the chip on the square is the bet’s chip', () => {
  const LEVELS = [1, 5, 25, 50, 75, 100, 200, 500, 800, 1000];

  test('each level sets down the bet menu’s own chip, whatever list the operator sends', () => {
    for (const levels of [LEVELS, [0.1, 0.2, 0.5, 1, 2], [100, 500, 2500]]) {
      levels.forEach((level, i) => {
        assert.deepEqual(chipForBet(level, levels), { colour: chipColour(i, levels.length), alt: chipInlayAlt(i, levels.length) });
      });
    }
    // The pair the owner named: $1 and $5 both white, $5 with the alternate inlay.
    assert.deepEqual(chipForBet(1, LEVELS), { colour: 'white', alt: false });
    assert.deepEqual(chipForBet(5, LEVELS), { colour: 'white', alt: true });
  });

  test('a typed bet between levels rounds DOWN, and one under them all takes the smallest', () => {
    assert.deepEqual(chipForBet(49.99, LEVELS), chipForBet(25, LEVELS));
    assert.deepEqual(chipForBet(60, LEVELS), chipForBet(50, LEVELS));
    assert.deepEqual(chipForBet(0.2, LEVELS), chipForBet(1, LEVELS));
    assert.deepEqual(chipForBet(5000, LEVELS), chipForBet(1000, LEVELS));
  });
});
