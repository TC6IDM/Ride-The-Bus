/**
 * Reading the RGS jurisdiction block.
 *
 * The case that motivated all of this: Authenticate.svelte assigns
 * `stateConfig.jurisdiction = authenticateData?.config?.jurisdiction`
 * unconditionally, so an RGS response without the block replaces the defaults
 * with `undefined`. A naive `stateConfig.jurisdiction.disabledTurbo` throws a
 * TypeError and takes the game down at startup.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import {
  TURBO_CAP_WITHOUT_SUPER,
  clampTurboSpeed,
  readFlag,
  readMinimumRoundDuration,
} from '../jurisdictionRules.ts';

describe('readFlag survives a missing block', () => {
  for (const [label, source] of [
    ['undefined', undefined],
    ['null', null],
    ['empty object', {}],
  ] as const) {
    test(`${label} falls back without throwing`, () => {
      assert.equal(readFlag(source, 'disabledTurbo', false), false);
      assert.equal(readFlag(source, 'disabledAutoplay', false), false);
      assert.equal(readFlag(source, 'displayRTP', false), false);
    });
  }

  test('a missing individual key falls back', () => {
    assert.equal(readFlag({ disabledTurbo: true }, 'disabledAutoplay', false), false);
  });

  test('an explicit null value falls back rather than reading as false', () => {
    assert.equal(readFlag({ disabledTurbo: null as any }, 'disabledTurbo', false), false);
  });

  test('a supplied value wins over the fallback', () => {
    assert.equal(readFlag({ disabledTurbo: true }, 'disabledTurbo', false), true);
    assert.equal(readFlag({ disabledTurbo: false }, 'disabledTurbo', true), false);
  });

  test('defaults are permissive - a missing block never restricts the game', () => {
    for (const key of [
      'disabledTurbo',
      'disabledSuperTurbo',
      'disabledAutoplay',
      'disabledSpacebar',
    ] as const) {
      assert.equal(readFlag(undefined, key, false), false, key);
    }
  });
});

describe('readMinimumRoundDuration', () => {
  test('absent or zero means no floor', () => {
    assert.equal(readMinimumRoundDuration(undefined), 0);
    assert.equal(readMinimumRoundDuration({}), 0);
    assert.equal(readMinimumRoundDuration({ minimumRoundDuration: 0 }), 0);
  });

  test('reads a positive floor', () => {
    assert.equal(readMinimumRoundDuration({ minimumRoundDuration: 2500 }), 2500);
  });

  test('a numeric string still works (RGS field typing is not guaranteed)', () => {
    assert.equal(readMinimumRoundDuration({ minimumRoundDuration: '2500' as any }), 2500);
  });

  test('junk means no floor rather than NaN or a hang', () => {
    assert.equal(readMinimumRoundDuration({ minimumRoundDuration: NaN }), 0);
    assert.equal(readMinimumRoundDuration({ minimumRoundDuration: -500 }), 0);
    assert.equal(readMinimumRoundDuration({ minimumRoundDuration: 'soon' as any }), 0);
  });

  test('Infinity is treated as no floor, not an eternal cooldown', () => {
    // Nonsense data must not be able to lock the spin button forever - that
    // would be a worse failure than ignoring the restriction.
    assert.equal(readMinimumRoundDuration({ minimumRoundDuration: Infinity }), 0);
  });
});

describe('clampTurboSpeed', () => {
  test('unrestricted speeds pass through', () => {
    assert.equal(clampTurboSpeed(1, {}), 1);
    assert.equal(clampTurboSpeed(0.4, undefined), 0.4);
  });

  test('disabledTurbo forces 0 regardless of what was set', () => {
    assert.equal(clampTurboSpeed(1, { disabledTurbo: true }), 0);
    assert.equal(clampTurboSpeed(0.5, { disabledTurbo: true }), 0);
  });

  test('disabledSuperTurbo caps short of instant but keeps the slider useful', () => {
    assert.equal(clampTurboSpeed(1, { disabledSuperTurbo: true }), TURBO_CAP_WITHOUT_SUPER);
    assert.ok(TURBO_CAP_WITHOUT_SUPER > 0 && TURBO_CAP_WITHOUT_SUPER < 1);
  });

  test('a speed already under the cap is left alone', () => {
    assert.equal(clampTurboSpeed(0.3, { disabledSuperTurbo: true }), 0.3);
  });

  test('disabledTurbo beats disabledSuperTurbo', () => {
    assert.equal(clampTurboSpeed(1, { disabledTurbo: true, disabledSuperTurbo: true }), 0);
  });
});
