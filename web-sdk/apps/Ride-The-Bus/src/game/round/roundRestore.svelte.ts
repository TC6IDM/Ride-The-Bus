/**
 * Put a round that already exists back on the board.
 *
 * Two paths in, and neither places a bet:
 *
 *   restoreReplay()  ?replay=true - Stake's Fairness view. Authenticate has
 *                    already fetched the settled round via /bet/replay.
 *   restoreResume()  a round the RGS still has OPEN on this session, handed
 *                    over by /wallet/authenticate.
 *
 * BOTH MUST APPLY parsed.family, not just the four guesses. That has shipped
 * broken twice - a High Stakes replay restored as Classic shows the wrong
 * retention rule and the wrong win ladder over a payout the RGS already
 * decided - and modes.test.ts asserts there are EXACTLY TWO restore blocks and
 * that both apply it. Keeping the pair in one file is what makes that countable.
 *
 * Called from $effect in Game.svelte rather than being effects themselves,
 * because $effect only runs inside a component. The guards below are what stop
 * a re-run doing it twice.
 */
import { stateBet, stateUrlDerived } from 'state-shared';

import { parseModeName } from '../math/modes';
import { bet, guesses } from '../bet/betState.svelte';
import { engineRound, round } from './roundState.svelte';
import { animateRoundFromEvents, waitForLoaderGone } from './roundReveal.svelte';

/**
 * What the replay path learns before the reveal is allowed to start.
 *
 * The board waits on `ready`: the reveal must not begin until the player has
 * clicked through the start screen AND the replay-info popup, or it plays out
 * behind the overlay - which is what Stake's own replay view showed.
 */
export const replay = $state({
  ready: false,
  /** The payout multiplier off the replay response, for the details panel. */
  payoutMultiplier: null as number | null,
});

// Replay (Stake's Fairness view, ?replay=true). Authenticate.svelte has
// already fetched the settled round via /bet/replay and parked it in
// stateBet.betToResume, so this must render THAT round — it must never place a
// bet.
//
// The data is parked here and the reveal only starts once the player has
// clicked through the start screen AND the replay-info popup. Before this
// change the reveal auto-fired as soon as the loader cleared, which played
// behind the overlay on Stake's replay view.
let replayStarted = false;

export function restoreReplay() {
  if (replayStarted || !stateUrlDerived.replay()) return;
  const resume = stateBet.betToResume as any;
  if (!resume?.state) return;
  replayStarted = true;

  // The Authenticate replay path (handleReplay) does not set stateBet.currency
  // from the replay URL's ?currency= param, so currency display always falls
  // back to USD / $. Read it here so numberToCurrencyString formats correctly.
  if (typeof window !== 'undefined') {
    const replayCurrency = new URLSearchParams(window.location.search).get('currency');
    if (replayCurrency) stateBet.currency = replayCurrency;
  }

  // Restore the guess squares to the combination the round was originally
  // played with, so the viewer sees which choices were made. The bet mode
  // IS the four guesses (see math-sdk mode_name).
  //
  // Must go through parseModeName, which strips the family prefix BEFORE
  // splitting: "sc_red_higher_equal_spade" has five underscore-separated
  // parts, not four. Splitting first and counting second reads every Second
  // Chance and High Stakes mode as malformed - 128 of the 192 - and silently
  // left the board showing guesses that did not match the round being
  // replayed. See the note atop parseModeName in game/math/modes.ts.
  // The FAMILY has to come across too, not just the four guesses. It is the
  // half of the mode that is not a guess square, and everything downstream
  // reads it: the MODE button, the volatility bolts, the rules popup, the
  // retention percentage the board prints - and winTiers(), which is why
  // getting this wrong was not merely cosmetic. A High Stakes replay left on
  // the Classic ladder measures a 1400x win against Classic's 1354.2 ceiling
  // and announces MAX WIN over a round that paid well under High Stakes'
  // real 1910.2 max. parseModeName has always returned the family; both this
  // path and the resume path below simply dropped it.
  const parsed = parseModeName(String(resume.mode ?? stateUrlDerived.mode() ?? ''));
  if (parsed) {
    bet.family = parsed.family;
    guesses.color = parsed.color;
    guesses.hl = parsed.higherLower;
    guesses.io = parsed.insideOutside;
    guesses.suit = parsed.suit;
  }

  // The replay URL carries the original stake, so the multipliers shown
  // resolve to the same cash amounts the player originally saw.
  round.initialBet = stateBet.wageredBetAmount || stateBet.betAmount || 0;
  bet.input = String(round.initialBet);
  round.hasPlayed = true;

  // REP-02 probe. A replay opened on the Stake Engine site once showed a bet
  // amount of 1000 where the game rendered 1 - an exact 1000x gap, which is a
  // units convention rather than a rounding bug. Stake documents ?amount= as
  // "bet amount in units" and the RGS speaks micro-units (1_000_000 = 1.00),
  // so Authenticate.svelte divides by API_AMOUNT_MULTIPLIER - but only the raw
  // parameter from a real replay URL can say which convention Stake actually
  // sends. This prints every value in the chain, so one replay settles it.
  //
  // HOW TO CAPTURE, given this is dev-only and the symptom is on the uploaded
  // build: a replay needs no session ("player session is not required for
  // viewing bet replay"), so copy the whole query string off the Stake replay
  // URL onto localhost:3001 and the same data loads here, with this line. Do
  // not reach for a production-visible flag instead - approval checks the
  // network tab for game information being logged.
  //
  // import.meta.env.DEV written out literally so Vite proves the branch dead
  // and drops it from the production bundle.
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const rawAmount = new URLSearchParams(window.location.search).get('amount');
    console.log('[RideTheBus] REP-02 replay amount chain:', {
      rawAmountParam: rawAmount,
      parsedAmount: stateUrlDerived.amount(),
      wageredBetAmount: stateBet.wageredBetAmount,
      betAmount: stateBet.betAmount,
      initialBet: round.initialBet,
      currency: stateBet.currency,
    });
  }

  // Read the payout multiplier from the book's finalWin event for the info
  // popup (amount is multiplier × 100 — see math-sdk events.py:final_win_event).
  const finalWin = resume.state.find((e: any) => e.type === 'finalWin') as any;
  replay.payoutMultiplier = finalWin ? Number(finalWin.amount) / 100 : null;

  // Park the data. The reveal starts when the player clicks "Play" on the
  // replay-info popup (onReplayPlay below), not here.
  replay.ready = true;
}

// Resume a round the player was in the middle of. /wallet/authenticate
// returns the session's round, which per the RGS docs "may represent a
// currently active or the last completed round" - and frontends "should
// continue the round if it remains active".
//
// Authenticate.svelte parks it in betToResume whenever it has `state`,
// REGARDLESS of `active`, so that has to be checked here: re-animating an
// already-settled round would show a result the player has been paid for as
// though it were live.
//
// Previously an interrupted round was just closed by the defensive
// end-round in startGameEngineFlow. The player was still paid, but never saw
// the outcome of a round they had bought.
let resumeStarted = false;

export function restoreResume() {
  if (resumeStarted || stateUrlDerived.replay()) return;
  const resume = stateBet.betToResume as any;
  if (!resume?.state || !resume.active) return;
  resumeStarted = true;
  round.resumeInProgress = true;
  // authenticate only parks a round here when it is still active, so the RGS
  // has one open and the defensive settle should be allowed to run.
  engineRound.open = true;

  // Put the guess squares back to the combination the round was bought with,
  // so the board the player returns to matches what they actually bet on.
  // The bet mode IS the four guesses (see math-sdk mode_name).
  //
  // parseModeName for the same reason as the replay path above: the prefix
  // has to come off before the split, or every resumed sc_/hs_ round comes
  // back with the wrong guesses on the board.
  // Family too - see the replay path above. This one matters more, not less:
  // a resumed round is real money mid-flight, and finishing it on the wrong
  // family shows the wrong retention rule and the wrong win ladder over a
  // payout the RGS has already decided.
  const parsed = parseModeName(String(resume.mode ?? ''));
  if (parsed) {
    bet.family = parsed.family;
    guesses.color = parsed.color;
    guesses.hl = parsed.higherLower;
    guesses.io = parsed.insideOutside;
    guesses.suit = parsed.suit;
  }

  // Authenticate populates these from round.amount, so the multipliers
  // resolve to the cash the player actually staked.
  round.initialBet = stateBet.wageredBetAmount || stateBet.betAmount || 0;
  round.hasPlayed = true;
  // Same hold as replay: a resumed round must not reveal behind the loader.
  waitForLoaderGone()
    .then(() =>
      animateRoundFromEvents(
        resume.state,
        `${resume.roundID ?? resume.betID ?? 'resumed'}`,
        'engine-auth',
        'Resumed round contained no state.',
      ),
    )
    .catch((err) => {
      // Don't trap the player on a broken resume - log it, mark the round
      // failed, and let the defensive end-round clear it on the next spin.
      console.error('[RideTheBus] resume failed', err);
      round.error = true;
    })
    .finally(() => {
      round.resumeInProgress = false;
    });
}
