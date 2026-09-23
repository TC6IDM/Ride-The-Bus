/**
 * Where the math build lives, and whether the one on disk is the one this
 * client describes. NOT a test - a helper the tests that read the build share.
 *
 * Four test files read `math-sdk/games/ride_the_bus/library`: the book-parity
 * replay, the ceilings cross-check, the volatility ranking and the published
 * mode list. All of them used to skip when the tree was ABSENT (the normal
 * state of a fresh checkout - the library is gitignored) and run against
 * whatever was there otherwise. That was fine while the client never got
 * ahead of the build. It stopped being fine the first time it did: High
 * Stakes moved from 20% to 16% and Three of a Kind was added, the books on
 * disk still described the old game, and every parity test went red for the
 * 40 minutes-plus until the rebuild - which is exactly the permanently-red
 * gate CLAUDE.md says gets ignored.
 *
 * So there are three states, not two. A build is STALE when it exists but
 * publishes a different set of modes from the client - the cheapest honest
 * sign that it predates the client - and the parity tests skip on stale as
 * they do on absent, saying which. A build with the SAME mode list but
 * different numbers is not stale, it is a drift, and those tests fail on it
 * as they should: that is the worst bug this project can have.
 *
 * Absolute paths from this file, so the tests that import it keep working
 * wherever they sit under game/ - a moved test that rebuilt these paths from
 * its own depth is how ten anchors broke in the last reorganisation.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { FAMILY_RULES, MODE_FAMILIES, allPlayableModes } from './math/modes.ts';

export const LIBRARY = resolve(
  import.meta.dirname,
  '../../../../../math-sdk/games/ride_the_bus/library',
);
export const STATS = resolve(LIBRARY, 'stats_summary.json');
export const PUBLISH_DIR = resolve(LIBRARY, 'publish_files');
export const INDEX = resolve(PUBLISH_DIR, 'index.json');
/**
 * The family rules the build was made with - written by run.py beside the
 * stats since 2026-09-22 (backfilled by hand for the 2026-09-20 build it
 * describes). Absent on older builds, in which case only the mode list can
 * say whether the build is stale.
 */
export const RULES = resolve(LIBRARY, 'build_rules.json');

export type MathBuildState = 'absent' | 'stale' | 'current';

/** One reading per process - the tests call this at describe time, repeatedly. */
let cached: { state: MathBuildState; detail: string } | null = null;

/**
 * Is the build on disk the one this client describes?
 *
 * `detail` is a sentence for the skip message, because "skipped" on its own
 * hides the difference between "you have not built the math" and "you have,
 * and it is older than the code you are testing".
 */
export function mathBuild(): { state: MathBuildState; detail: string } {
  if (cached) return cached;
  if (!existsSync(INDEX) || !existsSync(STATS)) {
    cached = { state: 'absent', detail: `${LIBRARY} is missing - run the math build to enable the parity tests` };
    return cached;
  }
  const index = JSON.parse(readFileSync(INDEX, 'utf8')) as { modes: { name: string }[] };
  const built = new Set(index.modes.map((m) => m.name));
  const offered = new Set(allPlayableModes());
  const missing = [...offered].filter((m) => !built.has(m));
  const extra = [...built].filter((m) => !offered.has(m));
  if (missing.length || extra.length) {
    cached = {
      state: 'stale',
      detail:
        `the math build on disk publishes ${built.size} modes and the client offers ${offered.size}` +
        (missing.length ? ` - not built: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ', ...' : ''}` : '') +
        (extra.length ? ` - no longer offered: ${extra.slice(0, 3).join(', ')}${extra.length > 3 ? ', ...' : ''}` : '') +
        '. Rebuild the math before trusting any parity result.',
    };
    return cached;
  }
  // Same modes - but the same RULES? A retention or cost change keeps the
  // mode list identical, so without this the 0.16 -> 0.15 High Stakes
  // rebuild window read as a drift in the client's arithmetic: hundreds of
  // parity assertions red for a reason that was not a bug. The build says
  // what it was made with; if that is not what the client says now, the
  // build is older than the code, which is what "stale" means.
  if (existsSync(RULES)) {
    const built = JSON.parse(readFileSync(RULES, 'utf8')) as {
      families?: Record<string, { cost: number; retention: number[]; forgive: number | null; forgive_from: number }>;
    };
    for (const family of MODE_FAMILIES) {
      const rules = FAMILY_RULES[family];
      const was = built.families?.[family];
      const differs =
        !was ||
        was.cost !== rules.cost ||
        was.forgive !== rules.forgive ||
        was.forgive_from !== rules.forgiveFrom ||
        was.retention.length !== rules.retention.length ||
        was.retention.some((r, i) => Math.abs(r - rules.retention[i]!) > 1e-9);
      if (differs) {
        cached = {
          state: 'stale',
          detail:
            `the math build on disk was made with ${family} = ${JSON.stringify(was ?? null)} and the client now says ` +
            `cost ${rules.cost}, retention [${rules.retention.join(', ')}], forgive ${rules.forgive} from ${rules.forgiveFrom}. ` +
            'Rebuild the math before trusting any parity result.',
        };
        return cached;
      }
    }
  }
  cached = { state: 'current', detail: '' };
  return cached;
}

/** True when the parity tests should run. Prints why they will not, once. */
export function mathBuildIsCurrent(): boolean {
  const { state, detail } = mathBuild();
  if (state !== 'current' && !warned) {
    warned = true;
    console.warn(`  ! math build ${state}: ${detail}`);
  }
  return state === 'current';
}
let warned = false;
