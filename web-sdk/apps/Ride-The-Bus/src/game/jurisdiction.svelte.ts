/**
 * Jurisdiction rules handed down by the RGS, bound to shared state.
 *
 * /wallet/authenticate returns a `config.jurisdiction` block (see
 * math-sdk/docs/rgs_docs/RGS.md) describing what the player's regulator
 * allows. Authenticate.svelte parks it on stateConfig.jurisdiction and nothing
 * in the SDK reads it - honouring it is entirely the game's job.
 *
 * The reading logic lives in jurisdictionRules.ts (pure, unit-tested); this
 * file only wires it to stateConfig. Reads go through readFlag rather than
 * touching stateConfig.jurisdiction directly because Authenticate assigns it
 * unconditionally, so a response without the block replaces the default object
 * with `undefined` and a bare property access would throw.
 */
import { stateConfig } from 'state-shared';

import {
  TURBO_CAP_WITHOUT_SUPER,
  clampTurboSpeed,
  readFlag,
  readMinimumRoundDuration,
  type JurisdictionSource,
} from './jurisdictionRules';

export { TURBO_CAP_WITHOUT_SUPER };

const source = (): JurisdictionSource => stateConfig.jurisdiction as JurisdictionSource;

export const jurisdiction = {
  /** Turbo (the speed slider) may not be offered at all. */
  turboDisabled: () => readFlag(source(), 'disabledTurbo', false),
  /**
   * "Super turbo" is the instant end of our speed slider. When only super
   * turbo is barred we keep the slider but cap it short of instant, so the
   * reveal is always at least partly animated.
   */
  superTurboDisabled: () => readFlag(source(), 'disabledSuperTurbo', false),
  /** Autoplay may not be offered. */
  autoplayDisabled: () => readFlag(source(), 'disabledAutoplay', false),
  /** The spacebar shortcut (tap to spin, hold to repeat) may not be offered. */
  spacebarDisabled: () => readFlag(source(), 'disabledSpacebar', false),
  /** Tapping mid-reveal to cut the animation short may not be offered. */
  slamstopDisabled: () => readFlag(source(), 'disabledSlamstop', false),

  /**
   * Floor on how long one round may take, in milliseconds. Regulators use it
   * to stop games cycling faster than a player can register the result, so it
   * gates the NEXT spin rather than slowing the current animation.
   */
  minimumRoundDurationMs: () => readMinimumRoundDuration(source()),

  /** Clamp a turbo speed to what the jurisdiction permits. */
  clampTurbo: (speed: number) => clampTurboSpeed(speed, source()),

  /** Responsible-gambling readouts the regulator wants on screen. */
  showNetPosition: () => readFlag(source(), 'displayNetPosition', false),
  showRTP: () => readFlag(source(), 'displayRTP', false),
  showSessionTimer: () => readFlag(source(), 'displaySessionTimer', false),

  /** True when any of the three readouts above is switched on. */
  showAnyReadout: () =>
    jurisdiction.showNetPosition() || jurisdiction.showRTP() || jurisdiction.showSessionTimer(),
};
