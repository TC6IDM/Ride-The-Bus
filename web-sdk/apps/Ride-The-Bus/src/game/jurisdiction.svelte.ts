/**
 * Jurisdiction rules handed down by the RGS.
 *
 * /wallet/authenticate returns a `config.jurisdiction` block (see
 * math-sdk/docs/rgs_docs/RGS.md) describing what the player's regulator allows.
 * Authenticate.svelte parks it on stateConfig.jurisdiction and nothing in the
 * SDK reads it - honouring it is entirely the game's job.
 *
 * Everything here is read through `flag()` rather than off stateConfig
 * directly, because Authenticate assigns the block unconditionally:
 *
 *     stateConfig.jurisdiction = authenticateData?.config?.jurisdiction;
 *
 * An RGS response without a jurisdiction block therefore replaces the default
 * object with `undefined`, and a bare stateConfig.jurisdiction.disabledTurbo
 * would throw. `flag()` falls back to the permissive default in that case,
 * which is also the right behaviour offline and in local dev.
 */
import { stateConfig } from 'state-shared';

type Jurisdiction = {
  socialCasino: boolean;
  disabledFullscreen: boolean;
  disabledTurbo: boolean;
  disabledSuperTurbo: boolean;
  disabledAutoplay: boolean;
  disabledSlamstop: boolean;
  disabledSpacebar: boolean;
  disabledBuyFeature: boolean;
  displayNetPosition: boolean;
  displayRTP: boolean;
  displaySessionTimer: boolean;
  minimumRoundDuration: number;
};

function flag<K extends keyof Jurisdiction>(key: K, fallback: Jurisdiction[K]): Jurisdiction[K] {
  const j = stateConfig.jurisdiction as Partial<Jurisdiction> | undefined | null;
  const value = j?.[key];
  return (value === undefined || value === null ? fallback : value) as Jurisdiction[K];
}

export const jurisdiction = {
  /** Turbo (the speed slider) may not be offered at all. */
  turboDisabled: () => flag('disabledTurbo', false),
  /**
   * "Super turbo" is the instant end of our speed slider. When only super
   * turbo is barred we keep the slider but cap it short of instant, so the
   * reveal is always at least partly animated.
   */
  superTurboDisabled: () => flag('disabledSuperTurbo', false),
  /** Autoplay may not be offered. */
  autoplayDisabled: () => flag('disabledAutoplay', false),
  /** The spacebar shortcut (tap to spin, hold to repeat) may not be offered. */
  spacebarDisabled: () => flag('disabledSpacebar', false),

  /**
   * Floor on how long one round may take, in milliseconds. Regulators use it
   * to stop games cycling faster than a player can register the result, so it
   * gates the NEXT spin rather than slowing the current animation.
   */
  minimumRoundDurationMs: () => {
    const raw = Number(flag('minimumRoundDuration', 0));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  },

  /** Responsible-gambling readouts the regulator wants on screen. */
  showNetPosition: () => flag('displayNetPosition', false),
  showRTP: () => flag('displayRTP', false),
  showSessionTimer: () => flag('displaySessionTimer', false),

  /** True when any of the three readouts above is switched on. */
  showAnyReadout: () =>
    jurisdiction.showNetPosition() || jurisdiction.showRTP() || jurisdiction.showSessionTimer(),
};
