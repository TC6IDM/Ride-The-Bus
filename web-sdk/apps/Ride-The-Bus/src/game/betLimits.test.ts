/**
 * Bet-grid arithmetic. The RGS rejects an off-grid bet with ERR_VAL, so these
 * cases are the difference between a playable game and a dead spin button.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { betWithinRange, limitsAreUnknown, snapBetToGrid, type BetLimits } from './betLimits.ts';

/** Micro-units, as the RGS sends them: 1_000_000 === 1.00 */
const M = 1_000_000;
const limits = (min: number, max: number, step: number): BetLimits => ({
  minBet: min * M,
  maxBet: max * M,
  stepBet: step * M,
});

const onGrid = (value: number, step: number) => Math.round(value * M) % Math.round(step * M) === 0;

describe('limitsAreUnknown', () => {
  test('true for null, undefined and all-zero', () => {
    assert.equal(limitsAreUnknown(null), true);
    assert.equal(limitsAreUnknown(undefined), true);
    assert.equal(limitsAreUnknown({ minBet: 0, maxBet: 0, stepBet: 0 }), true);
  });

  test('false as soon as anything is supplied', () => {
    assert.equal(limitsAreUnknown({ minBet: M, maxBet: 0, stepBet: 0 }), false);
  });
});

describe('snapBetToGrid', () => {
  const tenCent = limits(1, 100, 0.1);

  test('snaps down onto the step grid', () => {
    assert.equal(snapBetToGrid(1.37, tenCent, M), 1.3);
    assert.equal(snapBetToGrid(99.99, tenCent, M), 99.9);
    assert.equal(snapBetToGrid(2.05, tenCent, M), 2.0);
  });

  test('never rounds a bet UP - a player is not staked more than they asked', () => {
    for (const typed of [1.19, 4.99, 12.34, 47.07]) {
      assert.ok(snapBetToGrid(typed, tenCent, M) <= typed, `typed ${typed}`);
    }
  });

  test('leaves an already-valid amount alone', () => {
    for (const v of [1, 2.5, 10, 99.9]) assert.equal(snapBetToGrid(v, tenCent, M), v);
  });

  test('clamps to the ceiling', () => {
    assert.equal(snapBetToGrid(250, tenCent, M), 100);
  });

  test('clamps to the floor', () => {
    assert.equal(snapBetToGrid(0.2, tenCent, M), 1);
  });

  test('whole-dollar step', () => {
    const dollar = limits(1, 50, 1);
    assert.equal(snapBetToGrid(3.9, dollar, M), 3);
    assert.equal(snapBetToGrid(7, dollar, M), 7);
    assert.equal(snapBetToGrid(80, dollar, M), 50);
    assert.equal(snapBetToGrid(0.2, dollar, M), 1);
  });

  test('output is always exactly on the grid', () => {
    for (const step of [0.01, 0.1, 0.25, 1, 5]) {
      const L = limits(1, 1000, step);
      for (const typed of [0.004, 1, 1.37, 7.77, 13.02, 99.99, 456.789, 5000]) {
        const got = snapBetToGrid(typed, L, M);
        assert.ok(onGrid(got, step), `step ${step}, typed ${typed} -> ${got} is off-grid`);
      }
    }
  });

  test('result always sits within [min, max]', () => {
    const L = limits(2, 40, 0.5);
    for (const typed of [-10, 0, 0.1, 2, 17.3, 40, 1e6]) {
      const got = snapBetToGrid(typed, L, M);
      assert.ok(got >= 2 && got <= 40, `typed ${typed} -> ${got}`);
    }
  });

  test('binary floating point cannot drift the result off-grid', () => {
    // 0.1 * 3 !== 0.3 in float; the integer micro-unit path must be immune.
    const L = limits(0.1, 10, 0.1);
    for (let i = 1; i <= 100; i += 1) {
      const got = snapBetToGrid(i * 0.1, L, M);
      assert.ok(onGrid(got, 0.1), `${i} * 0.1 -> ${got}`);
    }
  });

  test('with no limits known, tidies to the cent and lets anything through', () => {
    assert.equal(snapBetToGrid(1.379, null, M), 1.38);
    assert.equal(snapBetToGrid(99999, null, M), 99999);
  });
});

describe('betWithinRange', () => {
  const L = limits(1, 100, 0.1);

  test('rejects below the floor and above the ceiling', () => {
    assert.equal(betWithinRange(0.5, L, M), false);
    assert.equal(betWithinRange(250, L, M), false);
  });

  test('accepts the boundaries themselves', () => {
    assert.equal(betWithinRange(1, L, M), true);
    assert.equal(betWithinRange(100, L, M), true);
  });

  test('an off-GRID but in-RANGE amount is still valid - snapping fixes it', () => {
    // Divisibility deliberately is not checked here: it should not grey out
    // the spin button, because normalizeBet corrects it at play time.
    assert.equal(betWithinRange(1.37, L, M), true);
  });

  test('unconstrained when the RGS supplied nothing', () => {
    assert.equal(betWithinRange(12345, null, M), true);
  });
});
