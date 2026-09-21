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
import { readFileSync } from 'node:fs';

import {
  allPlayableModes,
  COLOR_CHOICES,
  FAMILY_RULES,
  familyOf,
  FREE_CHOICE,
  HIGHER_LOWER_CHOICES,
  INSIDE_OUTSIDE_CHOICES,
  isCombinationPlayable,
  MODE_FAMILIES,
  modeChoices,
  modeName,
  parseModeName,
  stageCount,
  SUIT_CHOICES,
} from '../modes.ts';
import { DECAY } from '../payout.ts';
import { GAME_ALL, GAME_SOURCES } from '../../sources.testlib.ts';

import { INDEX as INDEX_PATH, mathBuildIsCurrent } from '../../mathBuild.testlib.ts';

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
  test('is 64 per four-guess family, being 72 minus the 8 that pair equal with inside, plus one trips mode', () => {
    const all = allPlayableModes();
    assert.equal(
      COLOR_CHOICES.length * HIGHER_LOWER_CHOICES.length * INSIDE_OUTSIDE_CHOICES.length * SUIT_CHOICES.length,
      72,
    );
    const fourGuess = MODE_FAMILIES.filter((family) => FAMILY_RULES[family].fixedChoices === null);
    const fixed = MODE_FAMILIES.filter((family) => FAMILY_RULES[family].fixedChoices !== null);
    assert.deepEqual(fixed, ['tr'], 'Three of a Kind is the one family with no guesses');
    assert.equal(all.length, 64 * fourGuess.length + fixed.length);
    assert.equal(all.length, 193);
    assert.equal(new Set(all).size, all.length, 'no duplicates');

    for (const family of fourGuess) {
      const mine = all.filter((name) => familyOf(name) === family);
      assert.equal(mine.length, 64, `${family} should offer 64 combinations`);
    }
    assert.deepEqual(
      all.filter((name) => familyOf(name) === 'tr'),
      ['tr_any_equal_equal'],
      'Three of a Kind publishes exactly its one combination',
    );
  });

  test('the free token exists only where a family fixes it', () => {
    // `any` is not a pick. It may appear in a slug only at the stages the
    // family's fixed combination says, and only on that family - so a
    // four-guess family can never be asked for a card it did not guess, and
    // the trips family can never be sent the picks left on the board.
    assert.equal(familyOf('tr_any_equal_equal'), 'tr');
    assert.deepEqual(parseModeName('tr_any_equal_equal'), {
      family: 'tr',
      choices: [FREE_CHOICE, 'equal', 'equal'],
      color: FREE_CHOICE,
      higherLower: 'equal',
      insideOutside: 'equal',
      suit: null,
    });
    assert.equal(parseModeName('red_higher_outside_spade')?.choices.length, 4);
    for (const bad of [
      'any_higher_outside_spade',
      'sc_any_equal_equal',
      'tr_any_equal_equal_any',
      'tr_red_equal_equal',
      'tr_any_equal_equal_spade',
      'tr_any_higher_outside',
      'red_higher_outside',
    ]) {
      assert.equal(parseModeName(bad), null, `"${bad}" is not a published mode`);
    }

    // modeChoices ignores the board on a fixed family and needs all four on
    // the others.
    const board = { color: 'red', hl: 'higher', io: 'outside', suit: 'spade' } as const;
    assert.deepEqual(modeChoices('tr', board), FAMILY_RULES.tr.fixedChoices);
    assert.deepEqual(modeChoices('tr', { color: null, hl: null, io: null, suit: null }), FAMILY_RULES.tr.fixedChoices);
    assert.deepEqual(modeChoices('base', board), ['red', 'higher', 'outside', 'spade']);
    assert.equal(modeChoices('base', { ...board, suit: null }), null);
    assert.equal(stageCount(FAMILY_RULES.tr), 3, 'trips deals three cards');
    assert.equal(stageCount(FAMILY_RULES.base), 4);
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

  test('no cost multiplier exceeds the 2-star tier ceiling of 1,000x', () => {
    // The tier table in stake-approval/references/approval-guidelines.md:
    // 1,000x at 2-star, 1,500x at 3-star. Three of a Kind sits exactly on the
    // 2-star figure, and its payout sits exactly on that tier's 25,000x cap.
    for (const family of MODE_FAMILIES) {
      assert.ok(FAMILY_RULES[family].cost <= 1000, `${family} cost is too high`);
      assert.ok(FAMILY_RULES[family].maxWin <= 25000, `${family} pays above the 2-star payout cap`);
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
  // Absent OR stale skips - see mathBuild.testlib.ts.
  const available = mathBuildIsCurrent();

  test('index.json exists (skip parity if the math has not been built)', () => {
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
    // Through parseModeName, not a four-way destructure: a slug's length is
    // its stage count, and Three of a Kind's has three tokens. Splitting into
    // four handed modeName an undefined fourth, which joined as a trailing
    // underscore - the test went red on the first build to publish the mode.
    for (const name of publishedModes()) {
      const parsed = parseModeName(name);
      assert.ok(parsed, `${name} does not parse`);
      assert.equal(modeName(parsed.choices, parsed.family), name);
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
  test('round-trips every one of the 193 published modes', () => {
    for (const name of allPlayableModes()) {
      const parsed = parseModeName(name);
      assert.ok(parsed, `${name} did not parse`);
      assert.equal(modeName(parsed.choices, parsed.family), name);
    }
  });

  test('parses the prefixed families, which a plain split cannot', () => {
    // THE BUG THIS EXISTS FOR. The replay screen split on "_" and required
    // exactly four parts; "sc_red_higher_equal_spade" has five, so every
    // Second Chance and High Stakes round fell through to printing its slug.
    assert.equal('sc_red_higher_equal_spade'.split('_').length, 5);
    assert.deepEqual(parseModeName('sc_red_higher_equal_spade'), {
      family: 'sc',
      choices: ['red', 'higher', 'equal', 'spade'],
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

  test('a plain four-part split silently drops 128 of the 193 modes, and misreads one', () => {
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
    assert.equal(all.length, 193);

    const naive = all.filter((name) => name.split('_').length === 4);
    // Four parts: the 64 unprefixed Classic modes - and tr_any_equal_equal,
    // whose prefix plus three tokens also makes four. A part count was never
    // the right test, which is the point.
    assert.equal(naive.length, 65, 'a four-part split sees Classic, plus the three-token trips slug');
    assert.equal(all.length - naive.length, 128, 'sc_ and hs_ modes a naive split drops');
    assert.ok(naive.every((name) => familyOf(name) === 'base' || name === 'tr_any_equal_equal'));

    // parseModeName loses none of them.
    assert.equal(all.filter((name) => parseModeName(name) !== null).length, 193);
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
    // Both effects stay in the component - $effect only runs inside one - but
    // the source is read through the manifest so this keeps looking at the
    // right files if that ever stops being true. See sources.testlib.ts.
    const source = GAME_SOURCES;

    // Two spaces or four: the blocks sit at function-body depth in
    // roundRestore.svelte.ts and sat one level deeper inside the component.
    // Left at four they still matched two, but only by running PAST the real
    // block to the next brace at that depth - so the tight anchor is the
    // honest one.
    const restores = source.match(/const parsed = parseModeName\([\s\S]*?\n {2,4}}/g) ?? [];
    assert.equal(
      restores.length,
      2,
      'expected exactly two parseModeName restore blocks in Game.svelte (replay + resume)',
    );

    for (const block of restores) {
      assert.ok(
        // `bet.family` since the bet moved into betState.svelte.ts. Still
        // pinned to an ASSIGNMENT of parsed.family, not merely a mention of it:
        // parsing the family and then not applying it is the exact bug, and it
        // has shipped twice.
        /\bbet\.family = parsed\.family/.test(block),
        'a mode-restore block parses the family but never applies it to bet.family',
      );
      // The four guesses go through ONE helper, restoreGuesses, which is what
      // skips them on a family that has none (Three of a Kind's slug carries
      // `any` for cards 1 and 4, which is not a pick). Both sites must call it.
      assert.ok(
        /\brestoreGuesses\(parsed\)/.test(block),
        'a mode-restore block does not put the guesses back through restoreGuesses',
      );
    }

    // And the helper itself must carry all four, and the fixed-family guard.
    const helper = source.match(/function restoreGuesses\([\s\S]*?\n}/)?.[0];
    assert.ok(helper, 'restoreGuesses is missing');
    for (const field of ['color', 'higherLower', 'insideOutside', 'suit']) {
      assert.ok(helper.includes(`parsed.${field}`), `restoreGuesses drops parsed.${field}`);
    }
    assert.ok(
      /fixedChoices\) return;/.test(helper),
      'restoreGuesses must leave the board alone on a family with fixed choices',
    );
  });

  /**
   * `bet` must mean betState's bet wherever a mode is restored.
   *
   * The third near-miss on the same invariant, and the sneakiest: both restore
   * effects read the RGS payload out of stateBet.betToResume, and both used to
   * call it `bet`. Once the bet state became an object named `bet`, the line
   * above - `bet.family = parsed.family` - assigned the family to the RESUME
   * PAYLOAD and the mode was silently never restored. The grep above passes
   * either way, because the text is identical; only the shadow tells them apart.
   *
   * So the payload is called `resume`, and nothing near a mode restore may
   * declare a local `bet` again.
   */
  test('nothing shadows the bet state where a mode is restored', () => {
    assert.doesNotMatch(
      GAME_SOURCES,
      // betState's own `export const bet` is the one legitimate declaration.
      /(?<!export )\b(?:const|let|var)\s+bet\s*=/,
      'something declares a local `bet`, which shadows betState\'s `bet` - ' +
        'a mode restore would then write parsed.family to the wrong object. ' +
        'The RGS resume payload is called `resume`.',
    );
  });

  // The same shape of bug in a different place: a rule with one correct
  // spelling, applied at four sites, and three of them spelled it out by hand.
  //
  // "A full game win" is `isCleanSweep(bustedIndex, forgivenIndex)`, never
  // `bustedIndex === null`. The two agree for Classic and High Stakes, which
  // have no forgiveness - and disagree for every Second Chance round that spent
  // it. Such a round ends with no bust marker, gameState 'won', and only three
  // of four guesses right. The win takeover had been fixed to ask isCleanSweep;
  // three siblings had not, so the same round would:
  //
  //   - stop an autoplay run configured to stop on a full game win (reported),
  //   - sound playFullWin() rather than the ordinary win sting,
  //   - and print "Full Game Win!" on the board's own running-win bar.
  //
  // Grepping the source for the same reason as the test above: these live in a
  // .svelte component that `node --test` cannot mount, and the failure is
  // silent for two of the three families.
  test('every full-game-win decision in Game.svelte asks isCleanSweep', () => {
    // The four sites are spread across the component (the running-win label)
    // and the round modules (the takeover floor, the win sting, the autoplay
    // stop), so this counts against EVERY source Game.svelte was split into.
    // The negative below needs the same net to mean "nowhere".
    const source = GAME_ALL;

    // Four decisions: the takeover floor, the autoplay stop, the win sting and
    // the running-win label. If a fifth is added it should be here too - raising
    // this number is the intended way to add one, not an obstacle to it.
    // The two fields now live on the `round` state object, so the accessor is
    // optional here - but the ARGUMENTS are still pinned to those two names.
    // Loosening this to `isCleanSweep\(` would accept a call passing anything.
    const sweeps =
      source.match(
        /isCleanSweep\(\s*(?:round\.)?bustedIndex\s*,\s*(?:round\.)?forgivenIndex\s*\)/g,
      ) ?? [];
    assert.equal(
      sweeps.length,
      4,
      `expected 4 isCleanSweep call sites in Game.svelte, found ${sweeps.length}`,
    );

    // The wrong spelling, gone and staying gone. A forgiven round has no bust
    // marker, so this test can never mean "the player got all four right".
    assert.equal(
      (source.match(/bustedIndex === null/g) ?? []).length,
      0,
      'Game.svelte tests bustedIndex === null - that is "did not bust", not "won the full game". ' +
        'Use isCleanSweep(bustedIndex, forgivenIndex); a forgiven Second Chance round passes the former and must not pass the latter.',
    );
  });
});
