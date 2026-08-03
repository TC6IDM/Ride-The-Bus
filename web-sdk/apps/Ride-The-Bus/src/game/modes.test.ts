/**
 * The client's idea of which choice combinations are playable, checked against
 * the modes the math actually published.
 *
 * This is the test that would have caught the bug it was written for: the UI let
 * a player pick stage 2 "equal" and stage 3 "inside", which is unwinnable and so
 * is not among the published modes. The client built the mode string by plain
 * concatenation, so the bet went out naming a mode that does not exist.
 *
 * Checking the client list against index.json rather than against a second copy
 * of the rule is the point - a rule duplicated in two places drifts, whereas
 * this fails the moment the two disagree in either direction.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  COLOR_CHOICES,
  HIGHER_LOWER_CHOICES,
  INSIDE_OUTSIDE_CHOICES,
  SUIT_CHOICES,
  allPlayableModes,
  isCombinationPlayable,
  modeName,
} from './modes.ts';

const INDEX_PATH = resolve(
  import.meta.dirname,
  '../../../../../math-sdk/games/ride_the_bus/library/publish_files/index.json',
);

describe('isCombinationPlayable', () => {
  test('rejects only equal-then-inside', () => {
    let rejected = 0;
    for (const higherLower of HIGHER_LOWER_CHOICES) {
      for (const insideOutside of INSIDE_OUTSIDE_CHOICES) {
        if (!isCombinationPlayable(higherLower, insideOutside)) {
          rejected += 1;
          assert.equal(higherLower, 'equal');
          assert.equal(insideOutside, 'inside');
        }
      }
    }
    assert.equal(rejected, 1, 'exactly one of the nine stage-2/3 pairings is impossible');
  });

  test('treats an unmade choice as playable, so a part-filled selection is not blocked', () => {
    assert.equal(isCombinationPlayable(null, null), true);
    assert.equal(isCombinationPlayable('equal', null), true);
    assert.equal(isCombinationPlayable(null, 'inside'), true);
    // ...but the moment both are known, the impossible pair is refused.
    assert.equal(isCombinationPlayable('equal', 'inside'), false);
  });
});

describe('allPlayableModes', () => {
  test('is 64, being 72 minus the 8 that pair equal with inside', () => {
    const all = allPlayableModes();
    assert.equal(
      COLOR_CHOICES.length * HIGHER_LOWER_CHOICES.length * INSIDE_OUTSIDE_CHOICES.length * SUIT_CHOICES.length,
      72,
    );
    assert.equal(all.length, 64);
    assert.equal(new Set(all).size, 64, 'no duplicates');
  });

  test('contains no equal-then-inside mode', () => {
    for (const name of allPlayableModes()) {
      const [, higherLower, insideOutside] = name.split('_');
      assert.ok(
        !(higherLower === 'equal' && insideOutside === 'inside'),
        `${name} should not be offered`,
      );
    }
  });
});

describe('parity with the published math', () => {
  const available = existsSync(INDEX_PATH);

  test('index.json exists (skip parity if the math has not been built)', () => {
    if (!available) {
      console.warn(`  ! ${INDEX_PATH} missing - run the math build to enable this check`);
    }
    assert.ok(true);
  });

  test('the client offers exactly the modes the math published', { skip: !available }, () => {
    const published: string[] = JSON.parse(readFileSync(INDEX_PATH, 'utf8')).modes.map(
      (mode: { name: string }) => mode.name,
    );
    const offered = allPlayableModes();

    const missing = published.filter((name) => !offered.includes(name));
    const invented = offered.filter((name) => !published.includes(name));

    assert.deepEqual(invented, [], 'client would send modes the math never published');
    assert.deepEqual(missing, [], 'math published modes the client can never select');
    assert.equal(offered.length, published.length);
  });

  test('every mode name round-trips through modeName', { skip: !available }, () => {
    const published: string[] = JSON.parse(readFileSync(INDEX_PATH, 'utf8')).modes.map(
      (mode: { name: string }) => mode.name,
    );
    for (const name of published) {
      const [color, higherLower, insideOutside, suit] = name.split('_') as [
        (typeof COLOR_CHOICES)[number],
        (typeof HIGHER_LOWER_CHOICES)[number],
        (typeof INSIDE_OUTSIDE_CHOICES)[number],
        (typeof SUIT_CHOICES)[number],
      ];
      assert.equal(modeName(color, higherLower, insideOutside, suit), name);
    }
  });
});
