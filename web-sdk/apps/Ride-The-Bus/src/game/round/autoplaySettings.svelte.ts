/**
 * What an autoplay run is configured to do, and how the panel edits it.
 *
 * SETTINGS ONLY. The loop that actually plays the rounds is in
 * autoplayLoop.svelte.ts, and the split is deliberate: startAuto calls into the
 * round flow, and the round flow reads `auto.running` and `stops.onFullWin`
 * back out. Kept in one module that would be a cycle between two of them; with
 * the state on its own the dependencies are a DAG, which is the version a
 * reader can follow.
 *
 * Two $state objects rather than a dozen exported `let`s, because an exported
 * `let` cannot be reassigned across a module boundary. They are grouped by who
 * asks:
 *
 *   auto      the live run - what was asked for and what is left of it
 *   stops     what ends a run early, and whether it skips the takeover
 */
import type { LimitSetting } from './autoplayLimits';

export const auto = $state({
  roundsInput: '10',
  infinite: false,
  running: false,
  // Rounds still to play in the current auto run. Infinity when the player
  // picked the unlimited option (the run then ends only on Stop, an error, or
  // one of the stop conditions).
  remaining: 0,
  // A Stop press can't cancel a bet already placed on the server, so it just
  // asks the loop to stop BEFORE starting the next round (the in-flight round
  // finishes normally - this matches the documented single-bet RGS model).
  stopRequested: false,
  // Space-hold run: the auto loop keeps going only while the key is physically
  // held, so it has no round count (unlike a normal auto run). Mirrors the SDK's
  // own EnableSpaceHold component.
  spaceHoldRunning: false,
});
// Spin-count presets for the Autoplay popup. These are exactly the SDK's own
// AUTO_SPINS_TEXT_OPTIONS (state-shared/stateUi), infinity included - it is
// rendered as a separate full-width cell below the eight numbers, using the
// drawn lemniscate (iconInfinity) rather than the U+221E character.
export const AUTOSPIN_PRESETS = [10, 25, 50, 75, 100, 250, 500, 1000];

export const autoRoundsValid = () =>
  auto.infinite ||
  (Number.isFinite(Number(auto.roundsInput)) && Math.floor(Number(auto.roundsInput)) >= 1);
/**
 * What ends a run early, plus one switch for how it looks - all on the
 * autoplay panel (the separate "Advanced" panel that held two of them is gone).
 *
 * PASSIVE is the load-bearing word: every one of these either ends a run or
 * shortens an animation. None of them touches the stake. An auto-bet that
 * RAISES the stake after a loss (a martingale) used to sit here behind a
 * DEV-only flag, never shippable - "chasing losses" is the mechanic Stake's
 * own auto-bet does not offer - and it was removed outright rather than left in
 * the source a reviewer can read.
 */
export const stops = $state({
  /**
   * Stop the auto run the moment a round is won outright (all four right, no
   * bust, nothing forgiven - isCleanSweep). Ends the run, never changes the stake.
   */
  onFullWin: false,

  /**
   * Stop once the run is down this much, net of what it won. Typed by the
   * player, in multiples of the BASE bet or in money, and armed by the button
   * beside the field. Off until then. autoplayLimits.ts has the rule, and why
   * the unit is never the round's cost.
   */
  lossLimit: { input: '', unit: 'x', on: false } as LimitSetting,

  /** Stop on any single round that pays at least this much. Same shape. */
  winLimit: { input: '', unit: 'x', on: false } as LimitSetting,

  /**
   * Skip the big-win takeover during an auto run: show the finished figure for
   * a beat, then move on without waiting to be dismissed.
   *
   * Default ON, deliberately. With it off, a 100-round run stops dead on every
   * win of 10x or better - roughly one round in seventy - and each one waits
   * for a tap. That turns "set it going" into "sit here and dismiss things",
   * which is the opposite of what autoplay is for. A player who wants to watch
   * every celebration can switch it off.
   */
  skipWinOnAuto: true,

  // There is deliberately no "skip the card reveal" switch here, for autoplay
  // or for a held spacebar. Both existed once. A slam collapses the reveal to
  // exactly the instant end of the turbo scale (paceMs in revealPacing), so
  // each was the turbo slider at maximum applied to some rounds and not
  // others - a second control for a result the first one already gives.
});

// The rule that applies the limits is in autoplayLimits.ts, a plain module,
// so it is unit-tested without a Svelte compiler.

/**
 * How many digits the rounds-left counter is showing.
 *
 * The count now sits INSIDE the stop square rather than floating over the
 * whole button, so it has to fit. Nothing caps the rounds a player can enter
 * - autoRoundsValid only requires one or more - so a five or six digit run is
 * possible and the type has to shrink to match.
 */
export const countDigits = () => (auto.infinite ? 1 : String(auto.remaining).length);

export function setAutoRounds(n: number) {
  auto.infinite = false;
  auto.roundsInput = String(n);
}
export function toggleAutoInfinite() {
  auto.infinite = !auto.infinite;
}
export function stepAutoRounds(direction: 1 | -1) {
  // Stepping is a count action, so it drops out of unlimited.
  auto.infinite = false;
  const current = Math.floor(Number(auto.roundsInput));
  const base = Number.isFinite(current) && current >= 1 ? current : 1;
  auto.roundsInput = String(Math.max(1, base + direction));
}
export function formatAutoRounds() {
  const n = Math.floor(Number(auto.roundsInput));
  auto.roundsInput = Number.isFinite(n) && n >= 1 ? String(n) : '1';
}
