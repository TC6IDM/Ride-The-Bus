/**
 * What the round dealt, what it paid, and what the session has tallied.
 *
 * These were nineteen separate `$state` declarations spread over eighty lines
 * of Game.svelte, interleaved with the bet, the guesses, the intro and the
 * turbo slider. They are one thing: the facts of the round in progress, which
 * the reveal loop writes and the board reads.
 *
 * One $state object rather than nineteen exported `let`s, because an exported
 * `let` cannot be reassigned across a module boundary - the same shape
 * ready.svelte.ts and stateGame.svelte.ts already use.
 *
 * WHAT IS NOT HERE. The player's four guesses and the bet amount live in
 * betState.svelte.ts: they are chosen BEFORE the round and they are what gets
 * sent to /wallet/play, so they outlive any single round. The intro and replay
 * phases stay in the component, because they drive the start screen and are
 * only ever read by it.
 */
import type { Card } from './roundContract';
import { stateUrlDerived } from 'state-shared';
import { auto } from './autoplaySettings.svelte';

/** Shape shared with game/round/localRound.ts, which builds these for DEV rounds. */
export type RevealEvent = {
  stage: number;
  card: Card;
  choice: string;
  correct: boolean;
  payout: number;
};

export type GameState = 'start' | 'playing' | 'lost' | 'won';

export type RoundSource = 'engine-auth' | 'engine-replay' | 'local-fallback' | 'none';

export const round = $state({
  state: 'start' as GameState,
  isProcessing: false,
  /**
   * The win readout stays hidden on the very first screen and appears once the
   * player has taken their first spin.
   */
  hasPlayed: false,

  /** The book's four reveal events, as they arrived. */
  revealEvents: [] as RevealEvent[],
  /** The cards turned so far. null = still face down. */
  revealedCards: [null, null, null, null] as (Card | null)[],
  /** Which card ended the round, or null. */
  bustedIndex: null as number | null,
  /**
   * The card a Second Chance round forgave, or null.
   *
   * Kept apart from bustedIndex because the two mean opposite things to the
   * board: a bust ends the reveal, a forgiven miss does not. Sharing one marker
   * would stop the remaining cards being turned.
   */
  forgivenIndex: null as number | null,
  /**
   * Cumulative (quantized) win multiplier shown above each card as it is
   * revealed - climbs while the streak holds, then shows the banked value on
   * the bust card. null = not revealed yet.
   */
  stageMultipliers: [null, null, null, null] as (number | null)[],
  /** Running cash won so far (current multiplier x bet), shown under the cards. */
  runningWin: 0,
  /**
   * Set from the server's authoritative finalWin event on engine rounds so
   * the displayed win is exactly what the RGS credited (not a local recompute
   * that could drift by a floating-point hair). null => compute locally.
   */
  engineFinalMultiplier: null as number | null,

  /** The bet this round was actually placed at, frozen when it was placed. */
  initialBet: 0,
  wonAmount: 0,
  lastRoundId: '',
  source: 'local-fallback' as RoundSource,
  sequence: 0,
  /**
   * Set true whenever an engine round fails to place/settle, so the auto loop
   * stops instead of hammering /wallet/play with the same failing request
   * (mirrors the SDK autobet resetting autoSpinsCounter to 0 on error).
   */
  error: false,

  /**
   * Most recently settled round, shown in the "Last Win" readout on the control
   * bar. Kept separate from wonAmount so it survives the board resetting between
   * rounds (and during an auto run it shows the previous round while the next
   * one is still revealing).
   */
  lastWinAmount: 0,
  lastWinMultiplier: 0,

  /**
   * Responsible-gambling session tracking, shown only when the jurisdiction
   * asks for it (displayNetPosition / displaySessionTimer). Net position is
   * cumulative payout minus cumulative stake for this session.
   *
   * Session-wide rather than per-round, and here anyway: sessionNet is written
   * by the same line of the reveal loop that settles the round, and a module
   * of its own for two numbers would separate them for no gain. The timer that
   * drives sessionSeconds is an $effect and stays in the component.
   */
  sessionNet: 0,
  sessionSeconds: 0,

  /**
   * True while an interrupted round is being restored from
   * stateBet.betToResume, before its reveal starts.
   *
   * Counts as a round in flight even though `state` is still 'start': the RGS
   * has an unsettled round on this session, so the bet, the mode and the
   * guesses must all stay locked until it is played out.
   */
  resumeInProgress: false,
});

/**
 * Whether a round is on the wire right now.
 *
 * Three states, not one: revealing, placing, or restoring an interrupted
 * round. Everything that must not change mid-round asks this - the bet, the
 * family, the four guesses, and the spin button.
 *
 * Named separately from choicesLocked in Game.svelte, which asks the same
 * question of a wider window: the guess squares and the bet group both need
 * this state, with a DIFFERENT explanation each.
 */
/**
 * Whether the RGS currently has an unsettled round on this session.
 *
 * Exists so the defensive end-round in startGameEngineFlow only fires when
 * there is something to settle. It used to fire before EVERY round, and on a
 * session with nothing open the RGS answers 400 - so a clean run put one
 * failed request in the network tab per spin. Stake's frontend checklist has
 * a line for exactly that ("check the network tab to ensure no errors"), and
 * the noise also buried the end-round failures that matter.
 */
/**
 * Deliberately a plain object, not $state: nothing on screen draws this. It is
 * bookkeeping for the defensive end-round, read inside async functions rather
 * than in a reactive context, and making it reactive would invite an effect to
 * depend on it.
 */
export const engineRound = { open: false };

export const isEngineRound = () => round.source !== 'local-fallback' && round.source !== 'none';

/**
 * When the guess squares stop accepting input.
 *
 * Covers every state the spin button covers, and for the same reason. It used
 * to be `round.state === 'playing' || auto.running`, which leaves the guesses
 * editable for the whole of an engine bet: startGameEngineFlow sets
 * isProcessing, awaits the defensive end-round, THEN builds the mode string
 * from the four choices, then awaits /wallet/play - and `state` only becomes
 * 'playing' once the reveal starts. Two round trips, all of it unlocked.
 *
 * Change a guess in that window and you are either billed for a combination
 * you did not press Start on, or looking at a board that does not describe the
 * round being revealed. It never showed up locally, because the fallback path
 * sets `state` in the same tick with nothing awaited in between.
 *
 * Read by BOTH the board (whose squares it locks) and the bar.
 */
export const choicesLocked = () =>
  roundInProgress() || auto.running || stateUrlDerived.replay();

export const roundInProgress = () =>
  round.state === 'playing' || round.isProcessing || round.resumeInProgress;

/**
 * Clear the board for a round about to be played.
 *
 * The three assignments of [null, null, null, null] the takeover's snapshot
 * comment refers to are all this function now. That matters to the takeover:
 * it draws the round's own cards, so it must hold a COPY - see
 * celebrationState.svelte.ts.
 */
export function resetForNewRound() {
  round.revealedCards = [null, null, null, null];
  round.stageMultipliers = [null, null, null, null];
  round.runningWin = 0;
  round.bustedIndex = null;
  round.forgivenIndex = null;
  round.wonAmount = 0;
  round.state = 'playing';
}

/** The session timer, formatted. h:mm:ss once there is an hour to show. */
export const sessionClock = () => {
  const h = Math.floor(round.sessionSeconds / 3600);
  const m = Math.floor((round.sessionSeconds % 3600) / 60);
  const s = round.sessionSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
