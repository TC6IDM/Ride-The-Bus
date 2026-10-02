/**
 * DEV-ONLY simulation of the RGS config, driven from the URL.
 *
 * On localhost there is no /wallet/authenticate, so the jurisdiction block and
 * the bet limits are never populated and none of the behaviour that depends on
 * them can be exercised by hand. These overrides let you drive all of it from
 * the address bar:
 *
 *   ?dev_disabledTurbo=1
 *   ?dev_disabledAutoplay=1&dev_disabledSpacebar=1
 *   ?dev_minimumRoundDuration=2500
 *   ?dev_displayRTP=1&dev_displayNetPosition=1&dev_displaySessionTimer=1
 *   ?dev_minBet=1&dev_maxBet=100&dev_stepBet=0.10
 *
 * Bet amounts are given in DISPLAY units (dollars) for convenience and
 * converted to the RGS's micro-units here.
 *
 * Every caller is behind `import.meta.env.DEV`, which Vite replaces with a
 * literal `false` in a production build, so this module is dropped from the
 * bundle and cannot be reached on the live site. It never overrides a value the
 * real RGS supplied unless explicitly asked to.
 */
import { stateConfig } from 'state-shared';

import type { Jurisdiction } from '../jurisdiction/jurisdictionRules';

const BOOLEAN_FLAGS: (keyof Jurisdiction)[] = [
  'socialCasino',
  'disabledFullscreen',
  'disabledTurbo',
  'disabledSuperTurbo',
  'disabledAutoplay',
  'disabledSlamstop',
  'disabledSpacebar',
  'disabledBuyFeature',
  'displayNetPosition',
  'displayRTP',
  'displaySessionTimer',
];

const truthy = (v: string) => v === '' || v === '1' || v.toLowerCase() === 'true';

/**
 * Apply any dev_* query parameters over stateConfig. Returns a list of what it
 * changed, for logging.
 */
export function applyDevOverrides(search: string): string[] {
  const params = new URLSearchParams(search);
  const applied: string[] = [];

  // --- jurisdiction ---------------------------------------------------------
  const jurisdictionPatch: Partial<Jurisdiction> = {};
  for (const flag of BOOLEAN_FLAGS) {
    const raw = params.get(`dev_${flag}`);
    if (raw === null) continue;
    jurisdictionPatch[flag] = truthy(raw) as never;
    applied.push(`${flag}=${truthy(raw)}`);
  }
  const minDuration = params.get('dev_minimumRoundDuration');
  if (minDuration !== null) {
    const ms = Number(minDuration);
    if (Number.isFinite(ms) && ms >= 0) {
      jurisdictionPatch.minimumRoundDuration = ms;
      applied.push(`minimumRoundDuration=${ms}ms`);
    }
  }
  if (Object.keys(jurisdictionPatch).length > 0) {
    // Merge rather than replace, so a partial override doesn't wipe whatever a
    // real session supplied.
    stateConfig.jurisdiction = {
      ...(stateConfig.jurisdiction ?? {}),
      ...jurisdictionPatch,
    } as Jurisdiction;
  }

  // --- bet limits -----------------------------------------------------------
  // Given in dollars in the URL; the RGS speaks micro-units (1_000_000 = 1.00).
  const MICRO = 1_000_000;
  const limitPatch: Record<string, number> = {};
  for (const [param, key] of [
    ['dev_minBet', 'minBet'],
    ['dev_maxBet', 'maxBet'],
    ['dev_stepBet', 'stepBet'],
  ] as const) {
    const raw = params.get(param);
    if (raw === null) continue;
    const dollars = Number(raw);
    if (Number.isFinite(dollars) && dollars >= 0) {
      limitPatch[key] = Math.round(dollars * MICRO);
      applied.push(`${key}=$${dollars}`);
    }
  }
  if (Object.keys(limitPatch).length > 0) {
    stateConfig.betLimits = { ...stateConfig.betLimits, ...limitPatch } as typeof stateConfig.betLimits;
  }

  return applied;
}
