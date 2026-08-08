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
  MIN_FULL_GAME_WIN_MULTIPLIER,
  WIN_TIERS,
  CEILING_PAUSE_MS,
  autoHoldMs,
  countUpSegments,
  segmentDurationMs,
  winTierFor,
  type WinTierId,
} from './winTiers.ts';

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

  test('above the ceiling is still max, not undefined', () => {
    // The declared wincap is 1400; nothing should ever exceed 1354.2, but a
    // tier lookup must not fall off the end if the math ever changes.
    assert.equal(idAt(1400), 'max');
    assert.equal(idAt(99999), 'max');
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
