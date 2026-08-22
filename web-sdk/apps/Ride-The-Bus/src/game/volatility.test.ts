/**
 * The volatility rating, checked against what the math actually published.
 *
 * The rating is the only thing in the picker that ranks the three modes against
 * each other, and a ranking that is merely plausible is worse than none: a
 * player choosing High Stakes because it reads as the wildest has to be right.
 * So the ordering is not asserted as a constant here - it is re-derived from
 * stats_summary.json, which reproduces exactly from the published lookup
 * tables, and compared.
 *
 * Skips rather than fails when the math tree is absent, following modes.test.ts:
 * between adding a family here and regenerating the books that is the expected
 * state, and a test that is red for a known reason gets ignored.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  HIGHER_LOWER_CHOICES,
  INSIDE_OUTSIDE_CHOICES,
  MODE_FAMILIES,
  familyOf,
  isCombinationPlayable,
  type ModeFamily,
} from './modes.ts';
import {
  FAMILY_BOLTS,
  FAMILY_BOLT_CEILING,
  VOLATILITY_BOLTS,
  boltsFor,
  equalGuessCount,
  volatilityColorVar,
  volatilityColorRgbVar,
  volatilityRank,
} from './volatility.ts';

const STATS_PATH = resolve(
  import.meta.dirname,
  '../../../../../math-sdk/games/ride_the_bus/library/stats_summary.json',
);

const available = existsSync(STATS_PATH);

/** Every published mode's payout standard deviation, grouped by family. */
function stdByFamily(): Record<ModeFamily, number[]> {
  const stats = JSON.parse(readFileSync(STATS_PATH, 'utf8')) as Record<string, { std: number }>;
  const grouped: Record<ModeFamily, number[]> = { base: [], sc: [], hs: [] };
  for (const [mode, entry] of Object.entries(stats)) {
    grouped[familyOf(mode)].push(entry.std);
  }
  return grouped;
}

/** The guesses part of a mode name - what the three families have in common. */
function combination(mode: string): string {
  const family = familyOf(mode);
  return family === 'base' ? mode : mode.slice(family.length + 1);
}

describe('volatility ruler', () => {
  test('every family has a bolt count on the ruler', () => {
    for (const family of MODE_FAMILIES) {
      const bolts = FAMILY_BOLTS[family];
      assert.ok(
        Number.isInteger(bolts) && bolts >= 1 && bolts <= FAMILY_BOLT_CEILING,
        `${family} is ${bolts}, outside 1..${FAMILY_BOLT_CEILING}`,
      );
    }
  });

  test('the ruler has room for the guesses on top of the wildest family', () => {
    // Two Equal picks is the most any bet can carry, so the top family plus two
    // has to fit - otherwise boltsFor's clamp would quietly swallow a stop and
    // Equal + Equal on High Stakes would look the same as one Equal.
    assert.equal(FAMILY_BOLT_CEILING + 2, VOLATILITY_BOLTS);
  });

  test('no two families share a bolt count', () => {
    // The meter is the only thing separating the rows once every mode costs the
    // same, so a tie would leave two modes indistinguishable at a glance.
    const counts = MODE_FAMILIES.map((family) => FAMILY_BOLTS[family]);
    assert.equal(new Set(counts).size, counts.length, `bolt counts collide: ${counts.join(', ')}`);
  });

  test('the family ruler is used end to end', () => {
    // 1/2/3 drawn on a wider meter would say nothing is ever very volatile,
    // which is false of a mode that can pay 1910x.
    const counts = MODE_FAMILIES.map((family) => FAMILY_BOLTS[family]);
    assert.equal(Math.min(...counts), 1);
    assert.equal(Math.max(...counts), FAMILY_BOLT_CEILING);
  });

  test('volatilityRank agrees with the bolt counts', () => {
    const byRank = MODE_FAMILIES.slice().sort((a, b) => volatilityRank(a) - volatilityRank(b));
    const byBolts = MODE_FAMILIES.slice().sort((a, b) => FAMILY_BOLTS[a] - FAMILY_BOLTS[b]);
    assert.deepEqual(byRank, byBolts);
    assert.deepEqual(
      byRank.map(volatilityRank),
      byRank.map((_, index) => index + 1),
      'ranks must be 1..n with no gaps',
    );
  });

  test('every family has its own colour token', () => {
    const vars = MODE_FAMILIES.map(volatilityColorVar);
    assert.equal(new Set(vars).size, vars.length, `colour tokens collide: ${vars.join(', ')}`);
    for (const value of vars) {
      // Must be a custom-property reference: BoltMeter is a child component, and
      // a scoped selector in the parent's stylesheet cannot reach into it, so a
      // hex literal here would silently never apply.
      assert.match(value, /^var\(--vol-[a-z]+\)$/, value);
    }
  });

  /**
   * The bet panel tints its own controls with the live rating, and a border
   * wash or a glow needs an alpha - so every colour token has an rgb-triplet
   * sibling that rgba() can take. The two are built from the same family name
   * rather than from two lookup tables, and this is what holds them together:
   * rename a family and BOTH have to move, or this fails rather than the glow
   * silently falling back to nothing.
   */
  test('the colour token and its rgb sibling name the same family', () => {
    for (const family of MODE_FAMILIES) {
      const colour = volatilityColorVar(family);
      const triplet = volatilityColorRgbVar(family);
      assert.match(triplet, /^var\(--vol-[a-z]+-rgb\)$/, triplet);
      assert.equal(
        triplet,
        colour.replace(/\)$/, '-rgb)'),
        `${family}: ${colour} and ${triplet} do not name the same token`,
      );
    }
  });
});

/** Every playable (higherLower, insideOutside) pair - the guesses that move the meter. */
const GUESS_PAIRS = HIGHER_LOWER_CHOICES.flatMap((hl) =>
  INSIDE_OUTSIDE_CHOICES.filter((io) => isCombinationPlayable(hl, io)).map(
    (io) => [hl, io] as const,
  ),
);

describe('the guesses on top of the family', () => {
  test('an unmade guess counts as calm, not as missing', () => {
    // The meter is live while the player is still choosing, so a null has to
    // mean something. No Equal picked IS the calm end of the scale.
    assert.equal(equalGuessCount(null, null), 0);
    for (const family of MODE_FAMILIES) {
      assert.equal(boltsFor(family, null, null), FAMILY_BOLTS[family], family);
    }
  });

  test('each Equal pick is worth exactly one stop', () => {
    for (const family of MODE_FAMILIES) {
      const base = FAMILY_BOLTS[family];
      assert.equal(boltsFor(family, 'higher', 'outside'), base, family);
      assert.equal(boltsFor(family, 'equal', 'outside'), base + 1, family);
      assert.equal(boltsFor(family, 'higher', 'equal'), base + 1, family);
      assert.equal(boltsFor(family, 'equal', 'equal'), base + 2, family);
    }
  });

  test('Inside and Outside rate the same - the documented simplification', () => {
    // Not an accident. Inside really is more volatile than Outside, and this
    // rule knowingly ignores that; see the note on boltsFor. Asserted so the
    // simplification is a decision on the record rather than a silent gap.
    for (const family of MODE_FAMILIES) {
      assert.equal(
        boltsFor(family, 'higher', 'inside'),
        boltsFor(family, 'higher', 'outside'),
        family,
      );
    }
  });

  test('no bet can draw more stops than the meter has', () => {
    for (const family of MODE_FAMILIES) {
      for (const [hl, io] of GUESS_PAIRS) {
        const bolts = boltsFor(family, hl, io);
        assert.ok(
          bolts >= 1 && bolts <= VOLATILITY_BOLTS,
          `${family} ${hl}/${io} draws ${bolts}, outside 1..${VOLATILITY_BOLTS}`,
        );
      }
    }
  });

  test('only High Stakes reaches past the family ceiling', () => {
    // The purple stops mean "the guesses have taken this beyond what any mode
    // reaches on its own". If a second family could get there the colour would
    // stop meaning that.
    const overflowing = MODE_FAMILIES.filter((family) =>
      GUESS_PAIRS.some(([hl, io]) => boltsFor(family, hl, io) > FAMILY_BOLT_CEILING),
    );
    assert.deepEqual(overflowing, ['hs']);
  });

  test('the wildest bet in the game fills the meter', () => {
    assert.equal(boltsFor('hs', 'equal', 'equal'), VOLATILITY_BOLTS);
  });
});

describe('the ordering matches the published math', () => {
  test('stats_summary.json exists (skip parity if the math has not been built)', () => {
    if (!available) {
      console.warn(`  ! ${STATS_PATH} missing - run the math build to enable these checks`);
    }
    assert.ok(true);
  });

  test('all three families are published, 64 modes each', { skip: !available }, () => {
    const grouped = stdByFamily();
    for (const family of MODE_FAMILIES) {
      assert.equal(grouped[family].length, 64, `${family} has ${grouped[family].length} modes`);
    }
  });

  test('more bolts means a higher median std', { skip: !available }, () => {
    const grouped = stdByFamily();
    const median = (values: number[]) => values.slice().sort((a, b) => a - b)[values.length >> 1]!;

    const ascending = MODE_FAMILIES.slice().sort((a, b) => FAMILY_BOLTS[a] - FAMILY_BOLTS[b]);
    for (let i = 1; i < ascending.length; i += 1) {
      const quieter = ascending[i - 1]!;
      const louder = ascending[i]!;
      assert.ok(
        median(grouped[quieter]) < median(grouped[louder]),
        `${quieter} shows fewer bolts than ${louder} but its median std is not lower ` +
          `(${median(grouped[quieter])} vs ${median(grouped[louder])})`,
      );
    }
  });

  /**
   * The claim the whole rating rests on.
   *
   * A ranking built on medians would only be true on average, and a player does
   * not place an average bet - they place one of the 64 combinations. This
   * asserts the ordering holds for every single one of them, which is what makes
   * one row of bolts an honest summary of a family rather than a headline.
   */
  test('the ordering holds for every guess combination', { skip: !available }, () => {
    const stats = JSON.parse(readFileSync(STATS_PATH, 'utf8')) as Record<string, { std: number }>;
    const byCombination = new Map<string, Map<ModeFamily, number>>();
    for (const [mode, entry] of Object.entries(stats)) {
      const key = combination(mode);
      if (!byCombination.has(key)) byCombination.set(key, new Map());
      byCombination.get(key)!.set(familyOf(mode), entry.std);
    }

    const ascending = MODE_FAMILIES.slice().sort((a, b) => FAMILY_BOLTS[a] - FAMILY_BOLTS[b]);
    const violations: string[] = [];
    for (const [key, stds] of byCombination) {
      for (let i = 1; i < ascending.length; i += 1) {
        const quieter = stds.get(ascending[i - 1]!)!;
        const louder = stds.get(ascending[i]!)!;
        if (!(quieter < louder)) {
          violations.push(`${key}: ${ascending[i - 1]} ${quieter} !< ${ascending[i]} ${louder}`);
        }
      }
    }
    assert.deepEqual(violations, [], `${violations.length} combinations rank against the meter`);
  });

  /**
   * The claim behind "one stop per Equal pick".
   *
   * Not a correlation and not a median: grouping each family's 64 modes by how
   * many Equal picks they carry gives three bands that do not overlap AT ALL.
   * The CALMEST 1-Equal mode is wilder than the WILDEST 0-Equal mode, in every
   * family. That is what makes counting Equal picks an exact ranking rather than
   * a rule of thumb, so it is asserted in its strict form - a rebuild that
   * merely blurred the bands would fail here rather than quietly leaving the
   * meter overstating a bet.
   */
  test('every extra Equal pick is strictly wilder', { skip: !available }, () => {
    const stats = JSON.parse(readFileSync(STATS_PATH, 'utf8')) as Record<string, { std: number }>;

    for (const family of MODE_FAMILIES) {
      const bands = new Map<number, number[]>();
      for (const [mode, entry] of Object.entries(stats)) {
        if (familyOf(mode) !== family) continue;
        const [, higherLower, insideOutside] = combination(mode).split('_') as [
          string,
          'higher' | 'lower' | 'equal',
          'inside' | 'outside' | 'equal',
          string,
        ];
        const equals = equalGuessCount(higherLower, insideOutside);
        if (!bands.has(equals)) bands.set(equals, []);
        bands.get(equals)!.push(entry.std);
      }

      assert.deepEqual([...bands.keys()].sort(), [0, 1, 2], `${family} band count`);
      for (const equals of [1, 2]) {
        const below = bands.get(equals - 1)!;
        const here = bands.get(equals)!;
        assert.ok(
          Math.max(...below) < Math.min(...here),
          `${family}: ${equals - 1} Equal reaches ${Math.max(...below)} but ` +
            `${equals} Equal starts at ${Math.min(...here)} - the bands overlap, ` +
            'so one stop per Equal pick is no longer an exact ranking',
        );
      }
    }
  });
});
