/**
 * Win-tier boundaries.
 *
 * These decide when the game interrupts play to celebrate, so an off-by-one at
 * a boundary is either a popup that never fires or one that fires constantly.
 * The Max Win case matters most: it is the rarest outcome in the game (1 in
 * 36,384) and the one a reviewer will deliberately go looking for via a replay
 * URL, so it must not degrade to "Epic Win" on a floating-point remainder.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import {
  MAX_WIN_MULTIPLIER,
  winTiersFor,
  MIN_FULL_GAME_WIN_MULTIPLIER,
  WIN_TIERS,
  CEILING_PAUSE_MS,
  autoHoldMs,
  countUpSegments,
  segmentDurationMs,
  winTierFor,
  type WinTierId,
} from './winTiers.ts';
import { FAMILY_RULES, MODE_FAMILIES, type ModeFamily } from './modes.ts';

const idAt = (multiplier: number): WinTierId | null => winTierFor(multiplier)?.id ?? null;

describe('winTierFor', () => {
  test('no tier below the entry threshold', () => {
    for (const multiplier of [0, 0.5, 1, 2, 5, 9.99]) {
      assert.equal(idAt(multiplier), null, `${multiplier}x should not celebrate`);
    }
  });

  test('each threshold is inclusive', () => {
    assert.equal(idAt(10), 'big');
    assert.equal(idAt(40), 'huge');
    assert.equal(idAt(120), 'mega');
    assert.equal(idAt(300), 'epic');
    assert.equal(idAt(MAX_WIN_MULTIPLIER), 'max');
  });

  test('just under a threshold stays on the tier below', () => {
    assert.equal(idAt(39.99), 'big');
    assert.equal(idAt(119.99), 'huge');
    assert.equal(idAt(299.99), 'mega');
    assert.equal(idAt(MAX_WIN_MULTIPLIER - 0.01), 'epic');
  });

  test('a max win arriving with float drift is still a max win', () => {
    // wonAmount / initialBet divides two already-rounded numbers, so the exact
    // ceiling can arrive a hair under it.
    assert.equal(idAt(1354.1999999999998), 'max');
    assert.equal(idAt(MAX_WIN_MULTIPLIER - 1e-9), 'max');
  });

  test('above the ceiling still resolves to a tier, but not to max', () => {
    // The lookup must not fall off the end if the math ever changes - but it
    // must not claim a Max Win either. The declared wincap is 1400 against a
    // true Classic ceiling of 1354.2, so 1400 is a bound that never binds, not
    // a bigger max win. Understating it as Epic is the safe direction to be
    // wrong in; "MAX WIN" over a payout the ladder cannot explain is not.
    assert.equal(idAt(1400), 'epic');
    assert.equal(idAt(99999), 'epic');
  });

  test('rejects non-finite and negative input', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5]) {
      assert.equal(winTierFor(bad), null, `${bad} should yield no tier`);
    }
  });
});

describe('full-game wins always celebrate', () => {
  test('the smallest possible full win sits BELOW the entry tier', () => {
    // The premise of the whole fullGameWin flag. Established by enumerating all
    // 6,497,400 ordered four-card draws: the floor is 6.6x, not >= 10x. If the
    // payout model ever changes so that every full win clears the entry tier on
    // its own, this fails and the flag can go.
    assert.ok(
      MIN_FULL_GAME_WIN_MULTIPLIER < WIN_TIERS[0]!.minMultiplier,
      `min full win ${MIN_FULL_GAME_WIN_MULTIPLIER}x no longer sits under the ` +
        `${WIN_TIERS[0]!.minMultiplier}x entry tier - the fullGameWin floor may be redundant`,
    );
  });

  test('a small full-game win still gets the entry tier', () => {
    assert.equal(winTierFor(MIN_FULL_GAME_WIN_MULTIPLIER, true)?.id, 'big');
    assert.equal(winTierFor(6.6, true)?.id, 'big');
    assert.equal(winTierFor(9.99, true)?.id, 'big');
  });

  test('the same amount without a full win does not celebrate', () => {
    assert.equal(winTierFor(MIN_FULL_GAME_WIN_MULTIPLIER, false), null);
    assert.equal(winTierFor(9.99, false), null);
  });

  test('the flag floors but never downgrades', () => {
    // A full-game win that IS big keeps the tier it earned.
    for (const multiplier of [10, 40, 120, 300, MAX_WIN_MULTIPLIER]) {
      assert.equal(
        winTierFor(multiplier, true)?.id,
        winTierFor(multiplier, false)?.id,
        `${multiplier}x should tier identically with and without the flag`,
      );
    }
  });

  test('the flag cannot conjure a tier out of a zero payout', () => {
    // A full game win always pays something, but the guard should not depend on
    // that being true elsewhere.
    assert.equal(winTierFor(0, true), null);
    assert.equal(winTierFor(-1, true), null);
    assert.equal(winTierFor(Number.NaN, true), null);
  });
});

describe('WIN_TIERS table', () => {
  test('is ordered low to high', () => {
    // winTierFor scans backwards and returns the first match, which is only
    // correct while the table ascends.
    for (let i = 1; i < WIN_TIERS.length; i++) {
      assert.ok(
        WIN_TIERS[i]!.minMultiplier > WIN_TIERS[i - 1]!.minMultiplier,
        `${WIN_TIERS[i]!.id} must sit above ${WIN_TIERS[i - 1]!.id}`,
      );
    }
  });

  test('rarity ascends with the threshold', () => {
    // The ladder has to read forwards: a higher tier must be RARER. This is the
    // check that caught 400x for Epic, which would have been rarer than Max.
    for (let i = 1; i < WIN_TIERS.length; i++) {
      assert.ok(
        WIN_TIERS[i]!.oneIn > WIN_TIERS[i - 1]!.oneIn,
        `${WIN_TIERS[i]!.id} (1 in ${WIN_TIERS[i]!.oneIn}) must be rarer than ${
          WIN_TIERS[i - 1]!.id
        } (1 in ${WIN_TIERS[i - 1]!.oneIn})`,
      );
    }
  });

  test('the top tier is the game ceiling', () => {
    const top = WIN_TIERS[WIN_TIERS.length - 1]!;
    assert.equal(top.id, 'max');
    assert.equal(top.minMultiplier, MAX_WIN_MULTIPLIER);
  });

  test('every tier has a non-empty label', () => {
    for (const tier of WIN_TIERS) assert.ok(tier.label.trim().length > 0, tier.id);
  });
});

describe('countUpSegments', () => {
  const idsFor = (multiplier: number): WinTierId[] =>
    countUpSegments(multiplier, winTierFor(multiplier, true)!).map((s) => s.tier.id);

  test('always opens on the entry tier, starting from zero', () => {
    for (const multiplier of [MIN_FULL_GAME_WIN_MULTIPLIER, 10, 40, 120, 300, MAX_WIN_MULTIPLIER]) {
      const segments = countUpSegments(multiplier, winTierFor(multiplier, true)!);
      assert.equal(segments[0]!.tier.id, 'big', `${multiplier}x should open on big`);
      assert.equal(segments[0]!.fromMultiplier, 0, `${multiplier}x should start the count at 0`);
    }
  });

  test('walks every tier up to the one earned, in order', () => {
    assert.deepEqual(idsFor(MIN_FULL_GAME_WIN_MULTIPLIER), ['big']);
    assert.deepEqual(idsFor(15), ['big']);
    assert.deepEqual(idsFor(50), ['big', 'huge']);
    assert.deepEqual(idsFor(200), ['big', 'huge', 'mega']);
    assert.deepEqual(idsFor(500), ['big', 'huge', 'mega', 'epic']);
    assert.deepEqual(idsFor(MAX_WIN_MULTIPLIER), ['big', 'huge', 'mega', 'epic', 'max']);
  });

  test('each leg starts where the tier does and ends at the next tier floor', () => {
    const segments = countUpSegments(MAX_WIN_MULTIPLIER, winTierFor(MAX_WIN_MULTIPLIER, true)!);
    // big 0 -> 40, huge 40 -> 120, mega 120 -> 300, epic 300 -> 1354.2
    assert.deepEqual(
      segments.slice(0, 4).map((s) => [s.fromMultiplier, s.toMultiplier]),
      [
        [0, 40],
        [40, 120],
        [120, 300],
        [300, MAX_WIN_MULTIPLIER],
      ],
    );
  });

  test('the legs are contiguous - no gaps and no backtracking', () => {
    for (const multiplier of [15, 50, 200, 500, 900, MAX_WIN_MULTIPLIER]) {
      const segments = countUpSegments(multiplier, winTierFor(multiplier, true)!);
      for (let i = 1; i < segments.length; i++) {
        assert.equal(
          segments[i]!.fromMultiplier,
          segments[i - 1]!.toMultiplier,
          `${multiplier}x: leg ${i} does not start where leg ${i - 1} ended`,
        );
      }
    }
  });

  test('the last leg lands exactly on the amount won', () => {
    for (const multiplier of [MIN_FULL_GAME_WIN_MULTIPLIER, 15, 50, 200, 500, MAX_WIN_MULTIPLIER]) {
      const segments = countUpSegments(multiplier, winTierFor(multiplier, true)!);
      assert.equal(
        segments[segments.length - 1]!.toMultiplier,
        multiplier,
        `${multiplier}x should finish on its real total`,
      );
    }
  });

  test('no leg ever counts backwards', () => {
    for (const multiplier of [6.6, 10, 40, 120, 300, 1000, MAX_WIN_MULTIPLIER]) {
      for (const segment of countUpSegments(multiplier, winTierFor(multiplier, true)!)) {
        assert.ok(
          segment.toMultiplier >= segment.fromMultiplier,
          `${multiplier}x: ${segment.tier.id} runs ${segment.fromMultiplier} -> ${segment.toMultiplier}`,
        );
      }
    }
  });

  test('a max win ends on a hold, because the top tier floor IS the ceiling', () => {
    const segments = countUpSegments(MAX_WIN_MULTIPLIER, winTierFor(MAX_WIN_MULTIPLIER, true)!);
    const last = segments[segments.length - 1]!;
    assert.equal(last.tier.id, 'max');
    assert.ok(last.isHold, 'the max leg has nowhere to climb and must be a hold');
    // Zero, because a hold has nothing to animate: the component lands it the
    // moment it is reached and switches the prompt to "tap to continue" rather
    // than offering to skip a count that does not exist.
    assert.equal(last.durationMs, 0);
  });

  test('a win landing exactly on a threshold still shows that tier', () => {
    // 40x earns "Huge Win" and the huge leg is 40 -> 40, so it holds rather than
    // being dropped - otherwise the title would stop one tier short of the
    // result.
    const segments = countUpSegments(40, winTierFor(40, true)!);
    assert.deepEqual(segments.map((s) => s.tier.id), ['big', 'huge']);
    assert.ok(segments[1]!.isHold);
  });

  test('only the final leg can ever be a hold', () => {
    for (const multiplier of [6.6, 10, 40, 120, 300, 700, MAX_WIN_MULTIPLIER]) {
      const segments = countUpSegments(multiplier, winTierFor(multiplier, true)!);
      for (let i = 0; i < segments.length - 1; i++) {
        assert.ok(!segments[i]!.isHold, `${multiplier}x: leg ${i} (${segments[i]!.tier.id}) holds`);
      }
    }
  });

  test('a sub-threshold full-game win is a single leg from zero', () => {
    const segments = countUpSegments(
      MIN_FULL_GAME_WIN_MULTIPLIER,
      winTierFor(MIN_FULL_GAME_WIN_MULTIPLIER, true)!,
    );
    assert.equal(segments.length, 1);
    assert.equal(segments[0]!.fromMultiplier, 0);
    assert.equal(segments[0]!.toMultiplier, MIN_FULL_GAME_WIN_MULTIPLIER);
    assert.ok(!segments[0]!.isHold);
  });
});

describe('segmentDurationMs', () => {
  test('every tier has a duration and later bands run longer', () => {
    for (let i = 1; i < WIN_TIERS.length; i++) {
      assert.ok(segmentDurationMs(WIN_TIERS[i]!) > segmentDurationMs(WIN_TIERS[i - 1]!));
    }
  });

  test('a max win climb stays watchable end to end', () => {
    // Every leg plus the ceiling pause between them. Long enough to build,
    // short enough that a player who does not tap is not stuck staring at it.
    // The final Max leg contributes nothing - it is a hold.
    const segments = countUpSegments(MAX_WIN_MULTIPLIER, winTierFor(MAX_WIN_MULTIPLIER, true)!);
    const climbing = segments.reduce((sum, segment) => sum + segment.durationMs, 0);
    const pauses = (segments.length - 1) * CEILING_PAUSE_MS;
    const total = climbing + pauses;
    assert.ok(total >= 8000 && total <= 18000, `max win takes ${total}ms end to end`);
  });

  test('a hold takes no time, a climbing leg always does', () => {
    for (const multiplier of [6.6, 15, 40, 50, 120, 300, 700, MAX_WIN_MULTIPLIER]) {
      for (const segment of countUpSegments(multiplier, winTierFor(multiplier, true)!)) {
        if (segment.isHold) {
          assert.equal(segment.durationMs, 0, `${multiplier}x: ${segment.tier.id} hold has a duration`);
        } else {
          assert.ok(segment.durationMs > 0, `${multiplier}x: ${segment.tier.id} climbs in no time`);
        }
      }
    }
  });

  test('the ceiling pause is long enough to read and the same for every tier', () => {
    // Deliberately one constant rather than a per-tier table: the pause exists
    // so the player can read the figure just reached, and that takes as long at
    // 40x as it does at 300x.
    assert.ok(CEILING_PAUSE_MS >= 700, 'too brief to register');
    assert.ok(CEILING_PAUSE_MS <= 1500, 'long enough to feel like a stall');
  });

  test('a routine big win is over quickly', () => {
    const total = countUpSegments(15, winTierFor(15, true)!).reduce(
      (sum, segment) => sum + segment.durationMs,
      0,
    );
    assert.ok(total <= 2400, `a big win climbs for ${total}ms, which will get tiresome`);
  });
});

describe('autoHoldMs', () => {
  test('every tier has a hold', () => {
    for (const tier of WIN_TIERS) assert.ok(autoHoldMs(tier) > 0, tier.id);
  });

  test('rarer tiers stay on screen longer', () => {
    for (let i = 1; i < WIN_TIERS.length; i++) {
      assert.ok(
        autoHoldMs(WIN_TIERS[i]!) > autoHoldMs(WIN_TIERS[i - 1]!),
        `${WIN_TIERS[i]!.id} should hold longer than ${WIN_TIERS[i - 1]!.id}`,
      );
    }
  });

  test('long enough to read, short enough not to stall a run', () => {
    for (const tier of WIN_TIERS) {
      const ms = autoHoldMs(tier);
      assert.ok(ms >= 1500 && ms <= 4000, `${tier.id} holds ${ms}ms, outside the usable range`);
    }
  });
});

describe('the Max Win tier follows the family ceiling', () => {
  // THE BUG THIS EXISTS FOR. The ladder's top band was fixed at Classic's
  // 1354.2x while the other two families reach elsewhere, so it was wrong in
  // both directions at once.
  const tiersFor = (family: ModeFamily) => winTiersFor(family);

  test('each family tops out on its own ceiling', () => {
    for (const family of MODE_FAMILIES) {
      const top = tiersFor(family).at(-1)!;
      assert.equal(top.id, 'max');
      assert.equal(
        top.minMultiplier,
        FAMILY_RULES[family].maxWin,
        `${family} celebrates a max win at the wrong figure`,
      );
    }
  });

  test('every family can actually reach its Max Win', () => {
    // Second Chance stops at 585.2x. Against Classic's 1354.2x threshold its
    // real ceiling - the rarest outcome in the mode - could only earn "Epic".
    for (const family of MODE_FAMILIES) {
      const maxWin = FAMILY_RULES[family].maxWin;
      const tier = winTierFor(maxWin, true, tiersFor(family));
      assert.equal(tier?.id, 'max', `${family} cannot reach its own Max Win`);
    }
  });

  test('High Stakes does not call a non-maximum win a Max Win', () => {
    // 1354.2x is Classic's ceiling and an ordinary large win on High Stakes,
    // which pays up to 1910.2x. It must not be announced as a max win.
    const tier = winTierFor(FAMILY_RULES.base.maxWin, false, tiersFor('hs'));
    assert.equal(tier?.id, 'epic');
  });

  test('a family ladder stays ordered, so the count-up never runs backwards', () => {
    for (const family of MODE_FAMILIES) {
      const tiers = tiersFor(family);
      for (let i = 1; i < tiers.length; i += 1) {
        assert.ok(
          tiers[i]!.minMultiplier > tiers[i - 1]!.minMultiplier,
          `${family}: band ${tiers[i]!.id} does not sit above ${tiers[i - 1]!.id}`,
        );
      }
    }
  });

  test('the count-up climbs to the family ceiling, not the base one', () => {
    const tiers = tiersFor('hs');
    const maxWin = FAMILY_RULES.hs.maxWin;
    const segments = countUpSegments(maxWin, winTierFor(maxWin, true, tiers)!, tiers);
    assert.equal(segments.at(-1)!.toMultiplier, maxWin);
    // The leg below the top one must hand over at the same figure it starts.
    const epicLeg = segments.find((seg) => seg.tier.id === 'epic')!;
    assert.equal(epicLeg.toMultiplier, maxWin);
  });

  test('the default ladder is unchanged for callers naming no family', () => {
    assert.deepEqual(winTiersFor('base'), WIN_TIERS);
  });

  // The Max band is matched on EQUALITY. Every band below it is an open-ended
  // ">= floor", but the ceiling is one reachable figure, so a payout above it
  // is not a bigger max win - it is a number the ladder cannot explain, and
  // "MAX WIN" is the one label in the game that must never be a guess.
  test('a payout ABOVE the ceiling is not called a Max Win', () => {
    for (const family of MODE_FAMILIES) {
      const tiers = tiersFor(family);
      const over = FAMILY_RULES[family].maxWin * 1.05;
      const tier = winTierFor(over, true, tiers);
      assert.notEqual(
        tier?.id,
        'max',
        `${family} announced a Max Win over a payout past its own ceiling`,
      );
      // It still celebrates - it just understates, which is the safe direction.
      assert.equal(tier?.id, 'epic');
    }
  });

  test('the published max_win bound of 1400 is not a Classic Max Win', () => {
    // game_config.py declares max_win 1400 against a true Classic ceiling of
    // 1354.2 - a bound that never binds. If a build ever emits it, the ladder
    // must not dress it up as the rarest screen in the game.
    assert.equal(winTierFor(1400, true, tiersFor('base'))?.id, 'epic');
  });

  test('a true Max Win still lands through display rounding', () => {
    // wonAmount / initialBet is a division of two already-rounded numbers, so
    // the rarest outcome in the game arrives as 1354.1999999999998. The
    // equality match keeps its epsilon.
    for (const family of MODE_FAMILIES) {
      const maxWin = FAMILY_RULES[family].maxWin;
      for (const nudge of [-1e-9, 0, 1e-9]) {
        assert.equal(
          winTierFor(maxWin + nudge, true, tiersFor(family))?.id,
          'max',
          `${family} lost its Max Win to floating point at ${nudge}`,
        );
      }
    }
  });
});

describe('the full-game-win floor is per family', () => {
  const SMALL_FULL_WIN = MIN_FULL_GAME_WIN_MULTIPLIER; // 6.6x, under the 10x entry tier

  test('Classic and High Stakes celebrate any completed round', () => {
    for (const family of ['base', 'hs'] as const) {
      assert.equal(FAMILY_RULES[family].celebrateEveryFullWin, true);
      const tier = winTierFor(
        SMALL_FULL_WIN,
        FAMILY_RULES[family].celebrateEveryFullWin,
        winTiersFor(family),
      );
      assert.equal(tier?.id, 'big', `${family} should celebrate a small full win`);
    }
  });

  test('Second Chance does not, because forgiveness makes it the common case', () => {
    assert.equal(FAMILY_RULES.sc.celebrateEveryFullWin, false);
    const tier = winTierFor(
      SMALL_FULL_WIN,
      FAMILY_RULES.sc.celebrateEveryFullWin,
      winTiersFor('sc'),
    );
    assert.equal(tier, null, 'a 6.6x Second Chance round should not take the screen over');
  });

  test('Second Chance still celebrates on size, on its own ladder', () => {
    // The floor is gone; the ladder is not. This is the half of the change that
    // is easy to lose - suppressing the takeover entirely would mean a 500x
    // Second Chance round passed in silence.
    //
    // Read off winTiersFor rather than typed out: this test is about the floor
    // being absent, not about where the bands sit, and hardcoding 10/40/120/300
    // here is what made it fail when the bands became per family.
    const tiers = winTiersFor('sc');
    for (const tier of tiers) {
      assert.equal(
        winTierFor(tier.minMultiplier, false, tiers)?.id,
        tier.id,
        `a ${tier.minMultiplier}x Second Chance win should earn ${tier.id}`,
      );
    }
    // ...and still nothing at all below the entry band.
    assert.equal(winTierFor(tiers[0]!.minMultiplier - 0.1, false, tiers), null);
  });
});

describe('every band is per family, not just the top one', () => {
  test('the three ladders are genuinely different below Max', () => {
    // If a refactor ever collapses these back to one shared set of bands, the
    // tiers stop meaning the same thing in each mode - which is the bug this
    // whole arrangement exists to prevent.
    const lower = (family: ModeFamily) =>
      winTiersFor(family).filter((t) => t.id !== 'max').map((t) => t.minMultiplier);
    assert.notDeepEqual(lower('base'), lower('sc'));
    assert.notDeepEqual(lower('base'), lower('hs'));
    assert.notDeepEqual(lower('sc'), lower('hs'));
  });

  test('each ladder lands on the same rarities, within tolerance', () => {
    // Classic's originals are the target: a tier is a claim about how often it
    // happens, so "Epic" must be about as rare in one mode as in another.
    const TARGET = [70, 305, 3093, 15561];
    for (const family of MODE_FAMILIES) {
      const tiers = winTiersFor(family).filter((t) => t.id !== 'max');
      tiers.forEach((tier, i) => {
        const ratio = tier.oneIn / TARGET[i]!;
        assert.ok(
          ratio > 0.7 && ratio < 1.3,
          `${family} ${tier.id}: 1 in ${tier.oneIn} against a target of 1 in ${TARGET[i]}`,
        );
      });
    }
  });

  test('Max is the rarest band in every family, by a clear margin', () => {
    // Classic's Epic sits at 300x rather than 400x precisely because a band
    // inside a payout gap ends up rarer than the Max above it, which makes the
    // ladder read backwards. This asserts that never happens again.
    for (const family of MODE_FAMILIES) {
      const tiers = winTiersFor(family);
      const max = tiers.at(-1)!;
      const epic = tiers.at(-2)!;
      assert.equal(max.id, 'max');
      assert.ok(
        max.oneIn > epic.oneIn * 1.5,
        `${family}: Max (1 in ${max.oneIn}) is not clearly rarer than Epic (1 in ${epic.oneIn})`,
      );
    }
  });

  test('rarity rises with every step up each ladder', () => {
    for (const family of MODE_FAMILIES) {
      const tiers = winTiersFor(family);
      for (let i = 1; i < tiers.length; i += 1) {
        assert.ok(
          tiers[i]!.oneIn > tiers[i - 1]!.oneIn,
          `${family}: ${tiers[i]!.id} is not rarer than ${tiers[i - 1]!.id}`,
        );
      }
    }
  });

  test('no band exceeds the ceiling it climbs toward', () => {
    for (const family of MODE_FAMILIES) {
      for (const tier of winTiersFor(family)) {
        assert.ok(
          tier.minMultiplier <= FAMILY_RULES[family].maxWin,
          `${family}: ${tier.id} starts above the mode's ceiling and can never fire`,
        );
      }
    }
  });
});
