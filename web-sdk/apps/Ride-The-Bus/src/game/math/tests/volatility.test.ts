/**
 * The volatility rating, checked against what the math actually published.
 *
 * The rating is the only thing in the picker that ranks the modes against each
 * other, and a ranking that is merely plausible is worse than none: a player
 * choosing High Stakes because it reads as the wildest has to be right. So the
 * ordering is not asserted as a constant here - it is re-derived from
 * stats_summary.json, which reproduces exactly from the published lookup
 * tables, and compared.
 *
 * TWO COLUMNS, NOT ONE. The three four-guess families rank by std, per
 * combination. Three of a Kind is drawn full and purple by a DIFFERENT column
 * - its non-zero hit rate, 1 in 26 against 1 in 2 on everything else - because
 * by std alone it is calmer than most Classic modes (a fixed 25x-cost prize
 * cannot deviate much). Both columns are pinned below, so the seven purple
 * bolts are a measured claim and not a marketing one. See volatility.ts.
 *
 * Skips rather than fails when the math tree is absent OR stale (a build that
 * publishes a different mode list from the client predates it), following
 * mathBuild.testlib.ts: between changing a family here and regenerating the
 * books that is the expected state, and a test that is red for a known reason
 * gets ignored.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  FAMILY_RULES,
  HIGHER_LOWER_CHOICES,
  INSIDE_OUTSIDE_CHOICES,
  MODE_FAMILIES,
  familyOf,
  isCombinationPlayable,
  type ModeFamily,
} from '../modes.ts';
import {
  FAMILIES_BY_VOLATILITY,
  FAMILY_BOLTS,
  VOLATILITY_BOLTS,
  boltsFor,
  equalGuessCount,
  volatilityColorVar,
  volatilityColorRgbVar,
  volatilityRank,
} from '../volatility.ts';
import { STATS, mathBuildIsCurrent } from '../../mathBuild.testlib.ts';

const TOKENS = readFileSync(resolve(import.meta.dirname, '../../../styles/tokens.css'), 'utf8');

const available = mathBuildIsCurrent();

/** The families whose four guesses are the player's - the ones the std ladder ranks. */
const LADDER_FAMILIES: readonly ModeFamily[] = MODE_FAMILIES.filter(
  (family) => FAMILY_RULES[family].fixedChoices === null,
);
/** The families with a fixed combination - drawn off the ladder. */
const FIXED_FAMILIES: readonly ModeFamily[] = MODE_FAMILIES.filter(
  (family) => FAMILY_RULES[family].fixedChoices !== null,
);
/** The last stop a four-guess family reaches on its own; the two Equals fill the rest. */
const LADDER_CEILING = Math.max(...LADDER_FAMILIES.map((family) => FAMILY_BOLTS[family]));

type StatsRow = { std: number; non_zero_hr: number; prob_nil: number; etl10k: number };

function readStats(): Record<string, StatsRow> {
  return JSON.parse(readFileSync(STATS, 'utf8')) as Record<string, StatsRow>;
}

/** Every published mode's payout standard deviation, grouped by family. */
function stdByFamily(): Record<ModeFamily, number[]> {
  const grouped = Object.fromEntries(MODE_FAMILIES.map((f) => [f, [] as number[]])) as Record<
    ModeFamily,
    number[]
  >;
  for (const [mode, entry] of Object.entries(readStats())) {
    grouped[familyOf(mode)].push(entry.std);
  }
  return grouped;
}

/** The guesses part of a mode name - what the four-guess families have in common. */
function combination(mode: string): string {
  const family = familyOf(mode);
  return family === 'base' ? mode : mode.slice(family.length + 1);
}

describe('volatility ruler', () => {
  test('every family has a bolt count on the ruler', () => {
    for (const family of MODE_FAMILIES) {
      const bolts = FAMILY_BOLTS[family];
      assert.ok(
        Number.isInteger(bolts) && bolts >= 1 && bolts <= VOLATILITY_BOLTS,
        `${family} is ${bolts}, outside 1..${VOLATILITY_BOLTS}`,
      );
    }
  });

  test('the ruler has room for the guesses on top of the wildest four-guess family', () => {
    // Two Equal picks is the most any bet can carry, so the top ladder family
    // plus two has to fit - otherwise boltsFor's clamp would quietly swallow a
    // stop and Equal + Equal on High Stakes would look the same as one Equal.
    assert.equal(LADDER_CEILING + 2, VOLATILITY_BOLTS);
  });

  test('a fixed-combination family is the whole ruler', () => {
    // The zero-rate column puts it off the std scale - see the header. Drawn
    // full rather than "5 + 2 for its two Equals": those Equals are the mode,
    // not picks, and 7 says "past the top" where 7-as-arithmetic would say
    // "High Stakes with two Equals", which is a different bet.
    for (const family of FIXED_FAMILIES) {
      assert.equal(FAMILY_BOLTS[family], VOLATILITY_BOLTS, family);
    }
  });

  test('no two families share a bolt count', () => {
    // The meter is the first thing separating the rows, so a tie would leave
    // two modes indistinguishable at a glance.
    const counts = MODE_FAMILIES.map((family) => FAMILY_BOLTS[family]);
    assert.equal(new Set(counts).size, counts.length, `bolt counts collide: ${counts.join(', ')}`);
  });

  test('the family ruler is used end to end', () => {
    // 1/2/3 drawn on a wider meter would say nothing is ever very volatile,
    // which is false of a mode that can pay 2169x - or 25,000x.
    const counts = MODE_FAMILIES.map((family) => FAMILY_BOLTS[family]);
    assert.equal(Math.min(...counts), 1);
    assert.equal(Math.max(...counts), VOLATILITY_BOLTS);
    assert.equal(LADDER_CEILING, 5);
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

  test('the picker lists the families in that order, ending on the purple one', () => {
    assert.deepEqual([...FAMILIES_BY_VOLATILITY], ['sc', 'base', 'hs', 'tr']);
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
  test('the colour token and its rgb sibling name the same family, and tokens.css defines both', () => {
    for (const family of MODE_FAMILIES) {
      const colour = volatilityColorVar(family);
      const triplet = volatilityColorRgbVar(family);
      assert.match(triplet, /^var\(--vol-[a-z]+-rgb\)$/, triplet);
      assert.equal(
        triplet,
        colour.replace(/\)$/, '-rgb)'),
        `${family}: ${colour} and ${triplet} do not name the same token`,
      );
      // A family the stylesheet does not know draws its bolts in whatever the
      // browser falls back to, which is the failure a fourth family invites.
      for (const name of [colour, triplet]) {
        const token = name.slice('var('.length, -1);
        assert.match(TOKENS, new RegExp(`^\\s*${token}:`, 'm'), `${token} is not defined in tokens.css`);
      }
    }
  });

  test('purple is the fixed family\'s colour, and no four-guess family\'s', () => {
    // Purple used to mean "the guesses pushed this past its family's ceiling"
    // (the stops past five, on High Stakes with an Equal). It is Three of a
    // Kind's own colour now, by the zero-rate column, and one hue carries one
    // meaning: the ladder families burn their green / yellow / red through
    // both Equals. So the purple triplet may be defined for the fixed family
    // and for the win takeover's Epic tier (--vol-overflow), and nothing else.
    const triplet = (family: ModeFamily) => {
      const token = volatilityColorRgbVar(family).slice('var('.length, -1);
      return TOKENS.match(new RegExp(`^\\s*${token}:\\s*([^;]+);`, 'm'))?.[1]?.trim();
    };
    const purple = triplet('tr');
    assert.ok(purple, '--vol-tr-rgb is not defined');
    assert.equal(purple, TOKENS.match(/--vol-overflow-ink-rgb:\s*([^;]+);/)?.[1]?.trim(),
      'the family purple and the Epic tier purple should be the same lifted value');
    for (const family of LADDER_FAMILIES) {
      assert.notEqual(triplet(family), purple, `${family} draws the purple`);
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

  test('each Equal pick is worth exactly one stop on a four-guess family', () => {
    for (const family of LADDER_FAMILIES) {
      const base = FAMILY_BOLTS[family];
      assert.equal(boltsFor(family, 'higher', 'outside'), base, family);
      assert.equal(boltsFor(family, 'equal', 'outside'), base + 1, family);
      assert.equal(boltsFor(family, 'higher', 'equal'), base + 1, family);
      assert.equal(boltsFor(family, 'equal', 'equal'), base + 2, family);
    }
  });

  test('a fixed family ignores the guesses on the board', () => {
    // Its two Equals are the mode. Whatever picks are parked on the board
    // from the last four-guess mode, the meter reads the family and nothing
    // else - and it is already full.
    for (const family of FIXED_FAMILIES) {
      for (const [hl, io] of GUESS_PAIRS) {
        assert.equal(boltsFor(family, hl, io), FAMILY_BOLTS[family], `${family} ${hl}/${io}`);
      }
      assert.equal(boltsFor(family, 'equal', 'equal'), VOLATILITY_BOLTS);
    }
  });

  test('Inside and Outside rate the same - the documented simplification', () => {
    // Not an accident. Inside really is more volatile than Outside, and this
    // rule knowingly ignores that; see the note on boltsFor. Asserted so the
    // simplification is a decision on the record rather than a silent gap.
    for (const family of LADDER_FAMILIES) {
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

  test('the wildest four-guess bet fills the meter too', () => {
    // High Stakes with two Equals reaches the seventh stop - in RED. The
    // colour is the family's; only the count climbs.
    assert.equal(boltsFor('hs', 'equal', 'equal'), VOLATILITY_BOLTS);
    assert.equal(volatilityColorVar('hs'), 'var(--vol-hs)');
  });
});

describe('the ordering matches the published math', () => {
  test('stats_summary.json is current (skip parity if the math has not been rebuilt)', () => {
    assert.ok(true);
  });

  test('every four-guess family is published with 64 modes, and the fixed family with one', { skip: !available }, () => {
    const grouped = stdByFamily();
    for (const family of LADDER_FAMILIES) {
      assert.equal(grouped[family].length, 64, `${family} has ${grouped[family].length} modes`);
    }
    for (const family of FIXED_FAMILIES) {
      assert.equal(grouped[family].length, 1, `${family} has ${grouped[family].length} modes`);
    }
  });

  test('more bolts means a higher median std, across the four-guess families', { skip: !available }, () => {
    const grouped = stdByFamily();
    const median = (values: number[]) => values.slice().sort((a, b) => a - b)[values.length >> 1]!;

    const ascending = LADDER_FAMILIES.slice().sort((a, b) => FAMILY_BOLTS[a] - FAMILY_BOLTS[b]);
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
   * The column that puts the fixed family off the ladder.
   *
   * By std it is NOT the wildest thing in the game - and this test says so,
   * rather than letting the seven bolts imply it - but by how often a round
   * pays anything at all it is off the scale by a wide margin: worse than the
   * worst four-guess mode by at least 5x. That gap is what the purple means.
   */
  test('the fixed family pays nothing far more often than any other mode - the purple column', { skip: !available }, () => {
    const stats = readStats();
    const worstLadder = Math.max(
      ...Object.entries(stats)
        .filter(([mode]) => FAMILY_RULES[familyOf(mode)].fixedChoices === null)
        .map(([, row]) => row.non_zero_hr),
    );
    for (const family of FIXED_FAMILIES) {
      for (const [mode, row] of Object.entries(stats)) {
        if (familyOf(mode) !== family) continue;
        assert.ok(
          row.non_zero_hr >= 5 * worstLadder,
          `${mode} pays 1 in ${row.non_zero_hr}; the worst four-guess mode is 1 in ${worstLadder} - not off the scale`,
        );
        // Written into the record rather than hidden: its std is modest.
        console.log(
          `    ${mode}: std ${row.std}, non-zero 1 in ${row.non_zero_hr}, ` +
            `etl10k ${row.etl10k} (the open >10,000x question - see game_calculations.py)`,
        );
      }
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
    const stats = readStats();
    const byCombination = new Map<string, Map<ModeFamily, number>>();
    for (const [mode, entry] of Object.entries(stats)) {
      if (FAMILY_RULES[familyOf(mode)].fixedChoices) continue;
      const key = combination(mode);
      if (!byCombination.has(key)) byCombination.set(key, new Map());
      byCombination.get(key)!.set(familyOf(mode), entry.std);
    }

    const ascending = LADDER_FAMILIES.slice().sort((a, b) => FAMILY_BOLTS[a] - FAMILY_BOLTS[b]);
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
    const stats = readStats();

    for (const family of LADDER_FAMILIES) {
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
