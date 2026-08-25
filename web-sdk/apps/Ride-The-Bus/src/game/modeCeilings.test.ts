/**
 * The per-mode win ceilings the game quotes a player.
 *
 * WHAT THIS GUARDS. Stake requires the maximum win to be stated per bet mode
 * and to be realistically obtainable, and in this game every four-guess
 * combination is its own published bet mode. The rules screen used to state
 * only the FAMILY ceiling - 1354.2x on Classic - which 56 of that family's 64
 * modes cannot reach at all. modeCeilings.ts is the per-mode figure, generated
 * from the build by scripts/mode-ceilings.js.
 *
 * Because it is generated and committed, it can drift from the build that
 * produced it. The cross-check below is the thing that actually matters and it
 * SKIPS when the math tree is absent - which is the normal state of a fresh
 * checkout, since the 1.6 GB library is gitignored. A permanently-red gate gets
 * ignored, so the structural assertions run always and the parity check runs
 * when it can.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODE_CEILINGS } from './modeCeilings.ts';
import {
  FAMILY_RULES,
  MODE_FAMILIES,
  allPlayableModes,
  ceilingFor,
  familyOf,
  type ModeFamily,
} from './modes.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIBRARY = path.join(HERE, '../../../../../math-sdk/games/ride_the_bus/library');
const STATS = path.join(LIBRARY, 'stats_summary.json');

const published = allPlayableModes();

describe('the generated ceilings table', () => {
  test('covers exactly the modes the client can play', () => {
    assert.deepEqual(Object.keys(MODE_CEILINGS).sort(), [...published].sort());
  });

  test('has 192 entries - three families of 64', () => {
    assert.equal(published.length, 192);
    assert.equal(Object.keys(MODE_CEILINGS).length, 192);
  });

  test('is frozen, so nothing can edit a ceiling at runtime', () => {
    assert.ok(Object.isFrozen(MODE_CEILINGS));
  });

  test('every ceiling is a positive figure at one decimal place', () => {
    for (const [mode, value] of Object.entries(MODE_CEILINGS)) {
      assert.ok(Number.isFinite(value) && value > 0, `${mode}: ${value}`);
      // The RGS carries one decimal place and the payout maths floors to it, so
      // a ceiling with more precision than that would be unreachable by
      // construction - see quantizeMultiplier in payout.ts.
      assert.equal(Math.round(value * 10) / 10, value, `${mode} has sub-0.1x precision`);
    }
  });
});

describe('ceilings against their family', () => {
  test('no mode can pay more than its family says it can', () => {
    // The family figure is the headline and has to remain an upper bound, or
    // the two numbers on screen contradict each other.
    for (const mode of published) {
      const family = familyOf(mode);
      assert.ok(
        MODE_CEILINGS[mode]! <= FAMILY_RULES[family].maxWin,
        `${mode} tops out at ${MODE_CEILINGS[mode]}x, above ${family}'s stated ${FAMILY_RULES[family].maxWin}x`,
      );
    }
  });

  test('each family ceiling is reached by exactly the 8 equal-equal modes', () => {
    // This is what makes FAMILY_RULES.maxWin an honest headline rather than a
    // number nothing reaches: two Equal picks is the hardest round in the game,
    // and the four suits x two colours that make it are the eight that top out.
    for (const family of MODE_FAMILIES) {
      const atCeiling = published
        .filter((mode) => familyOf(mode) === family)
        .filter((mode) => MODE_CEILINGS[mode] === FAMILY_RULES[family].maxWin);
      // The message is long because a failure here reads as flaky and is not.
      // The ceilings are SAMPLED maxima, so a fresh simulation set can genuinely
      // fail to draw a mode's best round - and at zero the Max Win tier could
      // never fire at all, because winTierFor keys on this exact figure.
      assert.equal(
        atCeiling.length,
        8,
        [
          `${family}: ${atCeiling.length} of 64 modes reach ${FAMILY_RULES[family].maxWin}x, expected 8.`,
          '  Rerun `node scripts/mode-ceilings.js` first, in case the table is merely stale',
          '  against a newer build. If it still disagrees, the new simulation set did not draw',
          '  that mode ceiling, and the family headline is no longer reachable on it.',
        ].join('\n'),
      );
      for (const mode of atCeiling) {
        assert.match(mode, /_equal_equal_/, `${mode} reaches the ceiling but is not equal+equal`);
      }
    }
  });

  test('most modes fall well short of their family figure - the reason this exists', () => {
    // Stated as a property rather than a comment so the motivation cannot be
    // quietly lost. If a future build made every mode reach its family ceiling,
    // this table would be redundant and this test says so.
    for (const family of MODE_FAMILIES) {
      const mine = published.filter((mode) => familyOf(mode) === family);
      const short = mine.filter((mode) => MODE_CEILINGS[mode]! < FAMILY_RULES[family].maxWin);
      assert.equal(short.length, 56, `${family}: only ${short.length} of 64 fall short`);
    }
  });
});

describe('ceilingFor', () => {
  test('returns the table entry for every published mode', () => {
    for (const mode of published) {
      assert.equal(ceilingFor(mode), MODE_CEILINGS[mode]);
    }
  });

  test('returns null rather than a wrong number for anything else', () => {
    // Mode names arrive from the RGS and from replay URLs, so a string that is
    // not one is an expected input. The caller falls back to the family figure.
    for (const junk of ['', 'red_higher_inside', 'nonsense', 'xx_red_equal_equal_heart']) {
      assert.equal(ceilingFor(junk), null, `expected null for ${JSON.stringify(junk)}`);
    }
  });

  test('is not fooled by the equal+inside combination the math never published', () => {
    // Nothing falls strictly between two cards of the same rank, so this mode
    // does not exist in any family - see isCombinationPlayable.
    for (const family of MODE_FAMILIES) {
      const prefix = FAMILY_RULES[family as ModeFamily].prefix;
      assert.equal(ceilingFor(`${prefix}red_equal_inside_heart`), null);
    }
  });
});

describe('parity with the published math', () => {
  const haveMath = existsSync(STATS);

  test('every ceiling matches stats_summary.json', { skip: !haveMath }, () => {
    const stats = JSON.parse(readFileSync(STATS, 'utf8')) as Record<string, { max_win: number }>;
    const drift: string[] = [];
    for (const mode of published) {
      const fromBuild = Math.round(stats[mode]!.max_win) / 100;
      if (fromBuild !== MODE_CEILINGS[mode]) {
        drift.push(`${mode}: table ${MODE_CEILINGS[mode]}x vs build ${fromBuild}x`);
      }
    }
    assert.deepEqual(
      drift,
      [],
      `modeCeilings.ts is stale - rerun \`node scripts/mode-ceilings.js\`:\n  ${drift.slice(0, 5).join('\n  ')}`,
    );
  });

  test('the build publishes exactly the modes the client offers', { skip: !haveMath }, () => {
    const index = JSON.parse(
      readFileSync(path.join(LIBRARY, 'publish_files/index.json'), 'utf8'),
    ) as { modes: { name: string }[] };
    assert.deepEqual(index.modes.map((m) => m.name).sort(), [...published].sort());
  });
});
