/**
 * What an autoplay run is configured to do, and how the panel edits it.
 *
 * SETTINGS ONLY. The loop that actually plays the rounds is in
 * autoplayLoop.svelte.ts, and the split is deliberate: startAuto calls into the
 * round flow, and the round flow reads `auto.running` and `stops.slamOnAuto`
 * back out. Kept in one module that would be a cycle between two of them; with
 * the state on its own the dependencies are a DAG, which is the version a
 * reader can follow.
 *
 * Four $state objects rather than nineteen exported `let`s, because an exported
 * `let` cannot be reassigned across a module boundary. They are grouped by who
 * asks:
 *
 *   auto      the live run - what was asked for and what is left of it
 *   stops     the four passive switches on the autoplay panel
 *   advanced  the gated bet-progression fields (see ADVANCED_ENABLED)
 *   run       the running net result, for the stop-on checks
 */
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
 * The four passive switches on the autoplay panel.
 *
 * Passive is the load-bearing word: every one of these either ends a run or
 * shortens an animation. None of them touches the stake, which is what keeps
 * them shippable while the Advanced progression below stays gated.
 */
export const stops = $state({
  /**
   * Stop the auto run the moment a round is won outright (all 4 cards correct,
   * no bust). A passive stop condition - it only ends the run, never changes
   * the stake - so it's safe to ship (unlike the gated Advanced progression).
   */
  onFullWin: false,

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

  /**
   * Skip the card reveal during an auto run - the same effect as pressing Skip
   * on every round, applied automatically.
   *
   * Default OFF, unlike the takeover skip above. That one removes a wait the
   * player did not ask for; this one removes the game's main animation, which
   * is a taste question rather than an annoyance. Turbo already covers "faster"
   * for anyone who wants it by degrees; this is for players who want the result
   * and nothing else.
   */
  slamOnAuto: false,

  /**
   * Skip the card reveal while the spacebar is HELD.
   *
   * Hold only, not the single tap. A tap is one deliberate round and the reveal
   * is the point of it; a hold is a run, and a run is where throughput matters.
   * Separate from slamOnAuto because they answer different questions - that one
   * is about unattended runs, this is about a player driving from the keyboard.
   * Default OFF, like the other skip.
   */
  slamOnSpaceHold: false,
});

// Advanced auto-bet strategy (Stake-style). When the Advanced switch is on:
//  - On Win / On Loss adjust the next bet: 'reset' back to the starting bet,
//    or 'increase' it by a percentage (100% = classic martingale double).
//  - Stop on Profit / Stop on Loss end the run once the cumulative net result
//    for this auto run crosses the given amount.
// Win vs loss is decided by the round's NET result (payout vs the bet placed),
// not just gameState - this game's partial credit means a "won" round can
// still pay back less than the stake.
//
// COMPLIANCE GATE: the On Win / On Loss bet-progression (martingale) is NOT
// part of the Stake Engine SDK's auto-bet, which keeps the stake constant and
// only offers stop-limits (see packages/state-shared stateUi AUTO_SPINS /
// LOSS_LIMIT / SINGLE_WIN_LIMIT). Auto-raising the bet on a loss is a
// "chasing losses" mechanic that needs Stake's approval before it can ship,
// so the Advanced switch is hard-disabled for now. Flip this to true (and
// confirm with Stake) to re-enable the whole panel - all the logic below is
// kept intact and gated on it.
export const ADVANCED_ENABLED = import.meta.env.DEV as boolean;
export const advanced = $state({
  mode: false,
  onWinMode: 'reset' as 'reset' | 'increase',
  onLossMode: 'reset' as 'reset' | 'increase',
  onWinPct: '0',
  onLossPct: '0',
  stopOnProfit: '0',
  stopOnLoss: '0',
});
// Running net profit (payouts - stakes) for the active auto run; drives the
// stop-on checks and the live readouts next to those fields.
export const run = $state({
  profit: 0,
  baseBet: 0,
});
export const toNum = (s: string) => {
  const n = Number(`${s ?? ''}`.trim());
  return Number.isFinite(n) ? n : 0;
};

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
