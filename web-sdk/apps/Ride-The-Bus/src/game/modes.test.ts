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
  FAMILY_RULES,
  HIGHER_LOWER_CHOICES,
  INSIDE_OUTSIDE_CHOICES,
  MODE_FAMILIES,
  SUIT_CHOICES,
  allPlayableModes,
  familyOf,
  isCombinationPlayable,
  modeName,
  parseModeName,
} from './modes.ts';
import { DECAY } from './payout.ts';

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
  test('is 64 per family, being 72 minus the 8 that pair equal with inside', () => {
    const all = allPlayableModes();
    assert.equal(
      COLOR_CHOICES.length * HIGHER_LOWER_CHOICES.length * INSIDE_OUTSIDE_CHOICES.length * SUIT_CHOICES.length,
      72,
    );
    assert.equal(all.length, 64 * MODE_FAMILIES.length);
    assert.equal(new Set(all).size, all.length, 'no duplicates');

    for (const family of MODE_FAMILIES) {
      const mine = all.filter((name) => familyOf(name) === family);
      assert.equal(mine.length, 64, `${family} should offer 64 combinations`);
    }
  });

  test('contains no equal-then-inside mode, in any family', () => {
    for (const name of allPlayableModes()) {
      const body = name.slice(FAMILY_RULES[familyOf(name)].prefix.length);
      const [, higherLower, insideOutside] = body.split('_');
      assert.ok(
        !(higherLower === 'equal' && insideOutside === 'inside'),
        `${name} should not be offered`,
      );
    }
  });

  test('base names carry no prefix, so published replay IDs stay valid', () => {
    for (const name of allPlayableModes()) {
      if (familyOf(name) !== 'base') continue;
      assert.ok(
        !name.startsWith('sc_') && !name.startsWith('hs_'),
        `${name} must keep its original unprefixed name`,
      );
    }
  });
});

describe('family rules match the math', () => {
  test('base is the cheapest mode, which Stake requires', () => {
    const costs = MODE_FAMILIES.map((f) => FAMILY_RULES[f].cost);
    assert.equal(FAMILY_RULES.base.cost, 1);
    assert.equal(Math.min(...costs), FAMILY_RULES.base.cost);
  });

  test('no cost multiplier exceeds Stake 2,000x ceiling', () => {
    for (const family of MODE_FAMILIES) {
      assert.ok(FAMILY_RULES[family].cost <= 2000, `${family} cost is too high`);
    }
  });

  test('card 1 is never forgiven', () => {
    // Forgiving it left almost no round paying zero, which pushed the mode's
    // win-conditional mean below its reweight target and made the lookup table
    // unbuildable. See MODE_FAMILIES in game_calculations.py.
    for (const family of MODE_FAMILIES) {
      const rules = FAMILY_RULES[family];
      if (rules.forgive === null) continue;
      assert.ok(rules.forgiveFrom >= 1, `${family} must not forgive the first card`);
    }
  });

  test('a forgiven miss keeps less than the decay, or a win would pay under 1x', () => {
    // m = (decay - (1-p)*retention) / p, so retention at or above decay drives
    // the multiplier for a near-certain pick to 1x or below - a "win" that
    // shrinks the running total.
    for (const family of MODE_FAMILIES) {
      const { forgive } = FAMILY_RULES[family];
      if (forgive === null) continue;
      assert.ok(forgive < DECAY, `${family} forgiveness must stay under ${DECAY}`);
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

  /**
   * Checked PER FAMILY, so the check keeps working while the math build catches
   * up with the client.
   *
   * A family the client offers but the math has not published yet is reported
   * rather than failed - that is the expected state between adding a family here
   * and regenerating the books, and a test that is red for a known reason gets
   * ignored, which is how a decoy typecheck survived in this repo for weeks.
   * A family that IS published is compared exactly, in both directions, so the
   * moment the build lands the full check is live again with no edit here.
   */
  const publishedModes = () =>
    available
      ? (JSON.parse(readFileSync(INDEX_PATH, 'utf8')).modes as { name: string }[]).map(
          (mode) => mode.name,
        )
      : [];

  test('every published mode is one the client can select', { skip: !available }, () => {
    const offered = new Set(allPlayableModes());
    const missing = publishedModes().filter((name) => !offered.has(name));
    assert.deepEqual(missing, [], 'math published modes the client can never select');
  });

  test('the client invents no mode within a published family', { skip: !available }, () => {
    const published = publishedModes();
    const builtFamilies = new Set(published.map(familyOf));
    const invented = allPlayableModes().filter(
      (name) => builtFamilies.has(familyOf(name)) && !published.includes(name),
    );
    assert.deepEqual(invented, [], 'client would send modes the math never published');

    const notBuilt = MODE_FAMILIES.filter((family) => !builtFamilies.has(family));
    if (notBuilt.length) {
      console.warn(
        `  ! families not in the published math yet: ${notBuilt.join(', ')} ` +
          '- run the math build before selecting them against a real RGS',
      );
    }
  });

  test('every published mode name round-trips through modeName', { skip: !available }, () => {
    for (const name of publishedModes()) {
      const family = familyOf(name);
      const body = name.slice(FAMILY_RULES[family].prefix.length);
      const [color, higherLower, insideOutside, suit] = body.split('_') as [
        (typeof COLOR_CHOICES)[number],
        (typeof HIGHER_LOWER_CHOICES)[number],
        (typeof INSIDE_OUTSIDE_CHOICES)[number],
        (typeof SUIT_CHOICES)[number],
      ];
      assert.equal(modeName(color, higherLower, insideOutside, suit, family), name);
    }
  });

  test('published costs match the client family rules', { skip: !available }, () => {
    const modes = JSON.parse(readFileSync(INDEX_PATH, 'utf8')).modes as {
      name: string;
      cost: number;
    }[];
    for (const mode of modes) {
      assert.equal(
        mode.cost,
        FAMILY_RULES[familyOf(mode.name)].cost,
        `${mode.name}: published cost disagrees with the client's family rules`,
      );
    }
  });
});

describe('parseModeName', () => {
  test('round-trips every one of the 192 published modes', () => {
    for (const name of allPlayableModes()) {
      const parsed = parseModeName(name);
      assert.ok(parsed, `${name} did not parse`);
      assert.equal(
        modeName(parsed.color, parsed.higherLower, parsed.insideOutside, parsed.suit, parsed.family),
        name,
      );
    }
  });

  test('parses the prefixed families, which a plain split cannot', () => {
    // THE BUG THIS EXISTS FOR. The replay screen split on "_" and required
    // exactly four parts; "sc_red_higher_equal_spade" has five, so every
    // Second Chance and High Stakes round fell through to printing its slug.
    assert.equal('sc_red_higher_equal_spade'.split('_').length, 5);
    assert.deepEqual(parseModeName('sc_red_higher_equal_spade'), {
      family: 'sc',
      color: 'red',
      higherLower: 'higher',
      insideOutside: 'equal',
      suit: 'spade',
    });
    assert.equal(parseModeName('hs_black_lower_outside_club')?.family, 'hs');
    assert.equal(parseModeName('black_lower_outside_club')?.family, 'base');
  });

  test('rejects rather than throws on strings that are not modes', () => {
    // These arrive from the RGS and from replay URLs, so a bad one is an
    // expected input. Every case must be null, not an exception or a partial.
    for (const bad of ['', 'BASE', 'sc_', 'red_higher_equal', 'red_higher_equal_spade_extra',
                       'purple_higher_equal_spade', 'red_sideways_equal_spade',
                       'sc_red_higher_equal_wand']) {
      assert.equal(parseModeName(bad), null, `"${bad}" should not parse`);
    }
  });

  test('a plain four-part split silently drops 128 of the 192 modes', () => {
    // The cost of getting this wrong, in numbers, because the failure is silent.
    //
    // Restoring the four guess squares from a mode name happens in three places:
    // StartScreen.svelte, and the replay and resume effects in Game.svelte. Two
    // of them used `split('_')` with a `length === 4` guard, which does not
    // throw and does not warn - it just does not fire. Replayed and resumed
    // Second Chance and High Stakes rounds therefore showed a board whose
    // guesses did not match the mode being displayed, which is REP-01/REP-05.
    //
    // Anything reading a mode name must go through parseModeName.
    const all = allPlayableModes();
    assert.equal(all.length, 192);

    const naive = all.filter((name) => name.split('_').length === 4);
    assert.equal(naive.length, 64, 'a four-part split sees only the unprefixed Classic family');
    assert.equal(all.length - naive.length, 128, 'sc_ and hs_ modes a naive split drops');
    assert.ok(naive.every((name) => familyOf(name) === 'base'));

    // parseModeName loses none of them.
    assert.equal(all.filter((name) => parseModeName(name) !== null).length, 192);
  });

  // The SECOND half of the same bug. Once parseModeName was in place all three
  // callers restored the four guess squares correctly - and two of them threw
  // `parsed.family` away, which is the half of the mode that is not a guess.
  //
  // That is not cosmetic. betFamily drives the retention rule the board prints,
  // the volatility bolts, the MODE button, the rules popup and winTiers() - so
  // a High Stakes replay left on Classic's ladder measures the round against
  // Classic's 1354.2x ceiling and announces MAX WIN over a 1400x win that is
  // nowhere near High Stakes' real 1910.2x max.
  //
  // Grepping the source because the assignment lives in a .svelte effect that
  // `node --test` cannot mount. Crude, but the failure it guards is silent, has
  // now happened twice on the same two call sites, and a replay is exactly the
  // thing a Stake reviewer opens.
  test('the replay and resume effects carry the family, not just the guesses', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../components/Game.svelte'),
      'utf8',
    );

    const restores = source.match(/const parsed = parseModeName\([\s\S]*?\n {4}}/g) ?? [];
    assert.equal(
      restores.length,
      2,
      'expected exactly two parseModeName restore blocks in Game.svelte (replay + resume)',
    );

    for (const block of restores) {
      for (const field of ['family', 'color', 'higherLower', 'insideOutside', 'suit']) {
        assert.ok(
          block.includes(`parsed.${field}`),
          `a mode-restore block in Game.svelte drops parsed.${field}`,
        );
      }
      assert.ok(
        /betFamily = parsed\.family/.test(block),
        'a mode-restore block parses the family but never applies it to betFamily',
      );
    }
  });
});
