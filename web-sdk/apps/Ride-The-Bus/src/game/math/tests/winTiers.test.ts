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
  isNetWin,
  HOLD_TOP_MS,
  HOLD_TOP_SHARE,
  holdClimbMs,
  LAST_CARD_HOLD_MS,
  lastCardHoldMs,
  lastCardHolds,
  lastCardTunnels,
  segmentDurationMs,
  winTierFor,
  type WinTierId,
} from '../winTiers.ts';
import { FAMILY_RULES, MODE_FAMILIES, isCleanSweep, type ModeFamily } from '../modes.ts';
import { source } from '../../sources.testlib.ts';

/** The families that climb a ladder - every family whose guesses are the player's. */
const LADDER_FAMILIES: readonly ModeFamily[] = MODE_FAMILIES.filter(
  (family) => FAMILY_RULES[family].fixedChoices === null,
);
/** The families with a single rung - one outcome, one tier. */
const ONE_RUNG_FAMILIES: readonly ModeFamily[] = MODE_FAMILIES.filter(
  (family) => FAMILY_RULES[family].fixedChoices !== null,
);

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

  test('each ladder family tops out on its own ceiling', () => {
    for (const family of LADDER_FAMILIES) {
      const top = tiersFor(family).at(-1)!;
      assert.equal(top.id, 'max');
      assert.equal(
        top.minMultiplier,
        FAMILY_RULES[family].maxWin,
        `${family} celebrates a max win at the wrong figure`,
      );
    }
  });

  test('every ladder family can actually reach its Max Win', () => {
    // Second Chance stops at 585.2x. Against Classic's 1354.2x threshold its
    // real ceiling - the rarest outcome in the mode - could only earn "Epic".
    for (const family of LADDER_FAMILIES) {
      const maxWin = FAMILY_RULES[family].maxWin;
      const tier = winTierFor(maxWin, true, tiersFor(family));
      assert.equal(tier?.id, 'max', `${family} cannot reach its own Max Win`);
    }
  });

  test('a one-rung family celebrates its only win as Max - it IS the most the mode pays', () => {
    // Three of a Kind's only win IS its ceiling, 4,583.3x, about 1 in 19. A
    // five-band ladder would invent four thresholds nothing ever lands
    // between, so the ladder is one rung, and the rung is Max: the label says
    // what the win is, not how rare it is.
    for (const family of ONE_RUNG_FAMILIES) {
      const tiers = tiersFor(family);
      assert.equal(tiers.length, 1, `${family} should have exactly one tier`);
      assert.equal(tiers[0]!.id, 'max');
      assert.equal(tiers[0]!.minMultiplier, FAMILY_RULES[family].maxWin);
      const tier = winTierFor(FAMILY_RULES[family].maxWin, true, tiers);
      assert.equal(tier?.id, 'max', `${family} should celebrate its win as Max`);
      // The count-up is a single leg from zero to the win.
      const segments = countUpSegments(FAMILY_RULES[family].maxWin, tier!, tiers);
      assert.equal(segments.length, 1);
      assert.equal(segments[0]!.fromMultiplier, 0);
      assert.equal(segments[0]!.toMultiplier, FAMILY_RULES[family].maxWin);
      assert.equal(segments[0]!.isHold, false);
      // Nothing below the rung celebrates on size - there is nothing below
      // the rung to celebrate; the full-game floor lands on the same tier.
      assert.equal(winTierFor(FAMILY_RULES[family].maxWin / 2, false, tiers), null);
      assert.equal(winTierFor(FAMILY_RULES[family].maxWin / 2, true, tiers)?.id, 'max');
    }
  });

  test('High Stakes does not call a non-maximum win a Max Win', () => {
    // 1354.2x is Classic's ceiling and an ordinary large win on High Stakes,
    // which pays up to 2237.3x. It must not be announced as a max win.
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
    for (const family of LADDER_FAMILIES) {
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
    // equality match keeps its epsilon - on the one-rung family too, whose
    // single tier is matched the same way.
    for (const family of MODE_FAMILIES) {
      const maxWin = FAMILY_RULES[family].maxWin;
      const want = tiersFor(family).at(-1)!.id;
      for (const nudge of [-1e-9, 0, 1e-9]) {
        assert.equal(
          winTierFor(maxWin + nudge, true, tiersFor(family))?.id,
          want,
          `${family} lost its top tier to floating point at ${nudge}`,
        );
      }
    }
  });
});

describe('the full-game-win floor is about a clean sweep, not about the family', () => {
  const SMALL_FULL_WIN = MIN_FULL_GAME_WIN_MULTIPLIER; // 6.6x, under the 10x entry tier

  /** What Game.svelte passes as winTierFor's `fullGameWin`. */
  const floors = (family: ModeFamily, busted: number | null, forgiven: number | null) =>
    isCleanSweep(busted, forgiven) && FAMILY_RULES[family].celebrateEveryFullWin;

  test('every family celebrates a clean sweep, however small it pays', () => {
    for (const family of MODE_FAMILIES) {
      const tiers = winTiersFor(family);
      const tier = winTierFor(SMALL_FULL_WIN, floors(family, null, null), tiers);
      // The bottom rung: Big on a ladder family, Max on the one-rung family
      // (whose only tier is both).
      assert.equal(
        tier?.id,
        tiers[0]!.id,
        `${family} should celebrate a clean sweep even at ${SMALL_FULL_WIN}x`,
      );
    }
  });

  /**
   * The half of the old per-family flag that was right, kept: a Second Chance
   * round that SPENT its forgiveness reached card 4 without guessing all four,
   * and flooring those would fire the takeover on most rounds.
   */
  test('a spent Second Chance does not floor - it reached the end, it did not sweep', () => {
    const tier = winTierFor(SMALL_FULL_WIN, floors('sc', null, 2), winTiersFor('sc'));
    assert.equal(tier, null, 'a forgiven 6.6x Second Chance round should not take the screen over');
  });

  /**
   * Classic and High Stakes have no forgiveness, so forgivenIndex is structurally
   * always null there. Pinned because the shared rule now reads it for all three
   * and a future family with forgiveness would land here first.
   */
  test('forgiveness is unreachable outside Second Chance', () => {
    for (const family of ['base', 'hs'] as const) {
      assert.equal(FAMILY_RULES[family].forgive, null, `${family} should not forgive`);
    }
    assert.equal(FAMILY_RULES.sc.forgive, 0.5);
  });

  test('a bust never floors, in any family', () => {
    for (const family of MODE_FAMILIES) {
      const tier = winTierFor(SMALL_FULL_WIN, floors(family, 3, null), winTiersFor(family));
      assert.equal(tier, null, `${family} floored a busted round`);
    }
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
    for (const family of LADDER_FAMILIES) {
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

  test('Max is the rarest band in every ladder family, by a clear margin', () => {
    // Classic's Epic sits at 300x rather than 400x precisely because a band
    // inside a payout gap ends up rarer than the Max above it, which makes the
    // ladder read backwards. This asserts that never happens again.
    for (const family of LADDER_FAMILIES) {
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

/**
 * The line between a win and a partial return. Below the round's cost the
 * board and the settle cue must not celebrate: on the guess families that is
 * 31-64% of all rounds, which used to get the green amount and the win sting.
 */
describe('isNetWin', () => {
  test('a payout that covers the cost is a win; one below it is not', () => {
    assert.equal(isNetWin(1, 1), true, 'break-even lost nothing');
    assert.equal(isNetWin(1.9, 1), true);
    assert.equal(isNetWin(0.7, 1), false, "a card-3 bust keeping 30% of 2.5x");
    assert.equal(isNetWin(0.1, 1), false, 'the smallest return the floor allows');
  });

  test('a multiplier a display rounding left a hair under the cost still counts', () => {
    // wonAmount / initialBet divides two already-rounded figures - the same
    // slack winTierFor allows on the Max band.
    assert.equal(isNetWin(0.9999999999999998, 1), true);
  });

  test('nothing paid, or nothing readable, is never a win', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(isNetWin(bad, 1), false, `${bad}`);
    }
    assert.equal(isNetWin(0, 0), false, 'a zero payout is not a win even at zero cost');
  });

  test("each family's ceiling is a win against that family's own cost", () => {
    for (const family of MODE_FAMILIES) {
      const { maxWin, cost } = FAMILY_RULES[family];
      assert.equal(isNetWin(maxWin, cost), true, `${family}: ${maxWin}x against ${cost}x`);
    }
  });

  test('the cost is the one that decides, not the bet', () => {
    // Three of a Kind is 250x the bet: 100x the BET is still a loss there.
    // No such payout exists in its books; this pins what the cost argument
    // means rather than a round that can happen.
    assert.equal(isNetWin(100, FAMILY_RULES.tr.cost), false);
  });
});

/**
 * The last card waits longer when a lot rides on it - and only on what rides
 * on it. A hold keyed to whether the card LANDS would call the result before
 * the card did.
 */
describe('lastCardHoldMs', () => {
  test('no hold for a card that would not reach a celebration', () => {
    assert.equal(lastCardHoldMs(5, false), 0);
    assert.equal(lastCardHoldMs(0, true), 0, 'nothing riding, nothing held');
  });

  test('a card that would complete a clean sweep is held at least the entry length', () => {
    // The takeover floors a full game win at Big, so the card that would
    // complete one is worth a hold even when its figure is small.
    assert.equal(lastCardHoldMs(MIN_FULL_GAME_WIN_MULTIPLIER, true), LAST_CARD_HOLD_MS.big);
  });

  test('the hold grows with the tier, and Max is the longest', () => {
    const order: WinTierId[] = ['big', 'huge', 'mega', 'epic', 'max'];
    for (let i = 1; i < order.length; i++) {
      assert.ok(LAST_CARD_HOLD_MS[order[i]!] > LAST_CARD_HOLD_MS[order[i - 1]!], `${order[i]} is not held longer than ${order[i - 1]}`);
    }
    assert.equal(lastCardHoldMs(MAX_WIN_MULTIPLIER, true), LAST_CARD_HOLD_MS.max);
  });

  test("Three of a Kind's last card is held the longest", () => {
    assert.equal(lastCardHoldMs(FAMILY_RULES.tr.maxWin, true, winTiersFor('tr')), LAST_CARD_HOLD_MS.max);
  });

  test('only a round with an Equal pick holds its last card', () => {
    // The owner's call, 2026-09-25: every clean run to the last card used to be
    // held - about one round in seven on the easy picks - and the moment wore
    // thin. Equal is the long shot the hold exists for.
    assert.equal(lastCardHolds(['red', 'higher', 'outside', 'heart']), false);
    assert.equal(lastCardHolds(['black', 'lower', 'inside', 'club']), false);
    assert.equal(lastCardHolds(['red', 'equal', 'outside', 'heart']), true);
    assert.equal(lastCardHolds(['red', 'higher', 'equal', 'spade']), true);
    assert.equal(lastCardHolds(['black', 'equal', 'equal', 'diamond']), true);
    // Three of a Kind's two Equals are the mode, so its card 3 always may.
    assert.deepEqual([...FAMILY_RULES.tr.fixedChoices!], ['any', 'equal', 'equal']);
    assert.equal(lastCardHolds(FAMILY_RULES.tr.fixedChoices!), true);
  });

  test('the reveal gates the hold on the choices the book was bet on', () => {
    const reveal = source('./round/roundReveal.svelte.ts');
    assert.match(reveal, /const mayHold = lastCardHolds\(round\.revealEvents\.map\(\(e\) => e\.choice\)\)/);
    assert.match(reveal, /if \(i === last && !busted && mayHold\)/, 'the hold no longer asks lastCardHolds');
  });

  test('the reveal decides the hold without reading whether the card lands', () => {
    const reveal = source('./round/roundReveal.svelte.ts');
    const start = reveal.indexOf('if (i === last && !busted && mayHold)');
    const end = reveal.indexOf('await revealWait(650, 0);', start);
    assert.ok(start >= 0 && end > start, 'the last-card hold block moved; re-anchor this test');
    const block = reveal.slice(start, end).replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(block, /\.correct\b/, 'the hold reads event.correct - it would announce the result');
    assert.match(block, /lastCardHoldMs\(/);
  });
});

describe('holdClimbMs', () => {
  // The held card and its hum rise together, sit at the top together, then
  // the card slams down. One split of the wait for both - the shape the owner
  // asked for by ear: up in a straight line, stay at the top, slam down.
  test('every hold climbs for most of its wait and keeps the rest for the top', () => {
    for (const hold of Object.values(LAST_CARD_HOLD_MS)) {
      const wait = hold + 650;
      const climb = holdClimbMs(wait);
      const top = wait - climb;
      assert.ok(top > 0, `a ${wait}ms wait has no time at the top`);
      assert.ok(top <= HOLD_TOP_MS, `a ${wait}ms wait sits at the top for ${top}ms`);
      assert.ok(top <= wait * HOLD_TOP_SHARE + 1e-9, `a ${wait}ms wait spends over a third at the top`);
      assert.ok(climb >= wait * 0.6, `a ${wait}ms wait climbs for only ${climb}ms`);
    }
  });

  test('a long wait sits at the top for the full plateau; a short one for its share', () => {
    assert.equal(holdClimbMs(2050), 1650); // Max: 1400 + 650
    assert.equal(holdClimbMs(1100), 1100 - 1100 * HOLD_TOP_SHARE); // Big: 450 + 650
    assert.equal(holdClimbMs(0), 0);
  });

  test('only a card that could land Huge or bigger gets tunnel vision - by the stake, never the result', () => {
    // The owner's call: a Big-win hold still rises and hums, the room stays
    // lit; the tunnel is kept for the bigger stakes.
    for (const family of ['base', 'sc', 'hs'] as const) {
      const ladder = winTiersFor(family);
      const at = (id: WinTierId) => ladder.find((tier) => tier.id === id)!.minMultiplier;
      assert.equal(lastCardTunnels(1, false, ladder), false, `${family}: a card below every tier tunnels`);
      assert.equal(lastCardTunnels(at('big'), false, ladder), false, `${family}: a Big-win card tunnels`);
      assert.equal(lastCardTunnels(1, true, ladder), false, `${family}: a small clean sweep (floored to Big) tunnels`);
      for (const id of ['huge', 'mega', 'epic', 'max'] as const) {
        assert.equal(lastCardTunnels(at(id), false, ladder), true, `${family}: a ${id}-win card does not tunnel`);
      }
    }
    // Three of a Kind's one rung is Max, so its held card always tunnels.
    assert.equal(lastCardTunnels(FAMILY_RULES.tr.maxWin, true, winTiersFor('tr')), true);

    // Decided in the same slice of the reveal as the hold, with no .correct in it.
    const reveal = source('./round/roundReveal.svelte.ts');
    const start = reveal.indexOf('if (i === last && !busted && mayHold)');
    const block = reveal.slice(start, reveal.indexOf('await revealWait(650, 0);', start)).replace(/\/\/.*$/gm, '');
    assert.match(block, /lastCardTunnels\(/, 'the tunnel is not decided where the hold is');
    assert.doesNotMatch(block, /\.correct\b/, 'the tunnel reads whether the card lands');
  });

  test('the card rises, and the tunnel closes, on that same clock - and the dark never falls on the card', () => {
    // Grep, because the three live in a stylesheet no test can mount. The card
    // and the tunnel both read --hold-climb (set from holdClimbMs); the held
    // card is lifted over the tunnel, or tunnel vision would dim the one thing
    // it exists to show.
    const css = source('../styles/board/cards.css');
    const zIndex = (selector: string) =>
      Number(new RegExp(`${selector.replace(/\./g, '\\.')}\\s*\\{[^}]*z-index:\\s*(\\d+)`).exec(css)?.[1]);
    assert.ok(zIndex('.card-slot.is-lit') > zIndex('.tunnel'), 'the held card is not lifted over the tunnel');
    assert.match(css, /\.card-slot\.is-held \.card-block\s*\{[^}]*transition:\s*transform var\(--hold-climb/, 'the card does not rise on the climb clock');
    assert.match(css, /\.tunnel\.is-closing\s*\{[^}]*transform var\(--hold-climb/, 'the tunnel does not close on the climb clock');
  });

  test('the tunnel rises with the card, by the same distance', () => {
    // It used to stay centred where the card had been and sit 12-15px low at
    // the top of the hold. One --hold-rise for both, so the two cannot part.
    const css = source('../styles/board/cards.css');
    assert.match(css, /\.card-slot,\s*\.tunnel\s*\{[^}]*--hold-rise:/, '--hold-rise is not shared by the card and the tunnel');
    assert.match(css, /\.card-slot\.is-held \.card-block\s*\{[^}]*transform:\s*translateY\(var\(--hold-rise\)\)/, 'the card does not rise by --hold-rise');
    assert.match(css, /\.tunnel\.is-closing\s*\{[^}]*transform:\s*translateY\(var\(--hold-rise\)\) scale\(1\)/, 'the tunnel does not rise with the card');
    assert.match(css, /\.tunnel\s*\{[^}]*transform:\s*translateY\(0\) scale\(2\.4\)/, 'the open tunnel does not name the same two functions');
  });
});
