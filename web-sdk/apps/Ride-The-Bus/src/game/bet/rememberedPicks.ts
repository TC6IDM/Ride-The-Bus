/**
 * The player's game mode and four picks, remembered between visits.
 *
 * A returning player used to land on Classic with every square empty and pick
 * the same route again. Now the last family and picks come back - on this
 * device, through the same localStorage the sound settings already use, which
 * persists inside Stake's iframe (checked live, 2026-10-05: the mute survived a
 * reload). Where storage is unavailable or wiped (a private window, Brave's
 * cleared third-party storage) the game simply starts as it always did.
 *
 * WHAT IS STORED: the family, and the mode slug when the picks are complete -
 * `hs_red_higher_outside_heart`, `tr_any_equal_equal`. Never the bet amount:
 * bet levels and the default come from the RGS's authenticate response, and a
 * remembered stake would be a stake the operator never offered.
 *
 * WHAT IS TRUSTED: nothing. The slug goes back through parseModeName, which only
 * accepts a mode the math publishes (so never Equal-then-Inside, never a family
 * that no longer exists); the family through MODE_FAMILIES. Anything else reads
 * as "nothing remembered".
 *
 * Pure, with storage injected, so it can be tested. The restore itself is
 * restoreRememberedPicks in game/round/roundRestore.svelte.ts - the third
 * mode-restore block beside replay and resume, and it applies parsed.family like
 * they do.
 */
import { MODE_FAMILIES, parseModeName, type ModeFamily } from '../math/modes.ts';

/** The same prefix the sound settings use (game/audio/audioMixer.ts). */
export const PICKS_KEY = 'ride-the-bus:picks';

/** The smallest slice of Storage this needs, so a test can pass a Map. */
export type PicksStorage = Pick<Storage, 'getItem' | 'setItem'>;

export type RememberedPicks = { family: ModeFamily; mode: string | null };

const isFamily = (value: unknown): value is ModeFamily =>
  typeof value === 'string' && (MODE_FAMILIES as readonly string[]).includes(value);

/** What was remembered, validated - or null for nothing usable. Never throws. */
export function readRememberedPicks(storage: PicksStorage | null | undefined): RememberedPicks | null {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(PICKS_KEY) ?? null;
  } catch {
    return null; // storage blocked (sandboxed iframe, privacy settings)
  }
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || (data as { v?: unknown }).v !== 1) return null;
  const { family, mode } = data as { family?: unknown; mode?: unknown };
  if (!isFamily(family)) return null;
  // A slug that no longer parses (a mode the math stopped publishing, or junk)
  // still leaves the family worth restoring.
  const parsed = typeof mode === 'string' ? parseModeName(mode) : null;
  return { family, mode: parsed && parsed.family === family ? mode as string : null };
}

/** Remember the family and, when the picks are complete, the mode. Never throws. */
export function writeRememberedPicks(
  storage: PicksStorage | null | undefined,
  family: ModeFamily,
  mode: string | null,
): void {
  try {
    storage?.setItem(PICKS_KEY, JSON.stringify({ v: 1, family, mode }));
  } catch {
    // Full or blocked storage costs the convenience, never the game.
  }
}
