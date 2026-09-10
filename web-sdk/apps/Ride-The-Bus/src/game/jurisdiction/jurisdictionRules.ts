/**
 * Pure reading of the RGS jurisdiction block.
 *
 * Split out of jurisdiction.svelte.ts (which binds these to stateConfig) so the
 * fallback behaviour can be unit-tested without Svelte or the SDK - notably the
 * case that matters most: Authenticate.svelte assigns
 *
 *     stateConfig.jurisdiction = authenticateData?.config?.jurisdiction;
 *
 * unconditionally, so an RGS response with no jurisdiction block replaces the
 * defaults object with `undefined`. Every read has to survive that.
 */

export type Jurisdiction = {
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

export type JurisdictionSource = Partial<Jurisdiction> | null | undefined;

/**
 * Read one flag, falling back when the block or the individual key is absent.
 * The fallback is always the permissive value, so a missing block never
 * accidentally disables the game - and never accidentally enables a
 * restriction the regulator did not ask for.
 */
export function readFlag<K extends keyof Jurisdiction>(
  source: JurisdictionSource,
  key: K,
  fallback: Jurisdiction[K],
): Jurisdiction[K] {
  const value = source?.[key];
  return (value === undefined || value === null ? fallback : value) as Jurisdiction[K];
}

/**
 * Minimum round duration in ms. Anything non-numeric, negative or absent means
 * "no floor" rather than throwing or blocking play forever.
 */
export function readMinimumRoundDuration(source: JurisdictionSource): number {
  const raw = Number(readFlag(source, 'minimumRoundDuration', 0));
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/** The cap applied to the turbo slider when only super-turbo is barred. */
export const TURBO_CAP_WITHOUT_SUPER = 0.8;

/** Clamp a turbo speed to what the jurisdiction permits. */
export function clampTurboSpeed(speed: number, source: JurisdictionSource): number {
  if (readFlag(source, 'disabledTurbo', false)) return 0;
  if (readFlag(source, 'disabledSuperTurbo', false)) {
    return Math.min(speed, TURBO_CAP_WITHOUT_SUPER);
  }
  return speed;
}
