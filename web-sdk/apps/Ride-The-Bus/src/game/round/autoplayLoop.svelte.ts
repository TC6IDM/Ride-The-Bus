/**
 * The autoplay loop: run rounds back to back until something says stop.
 *
 * Separate from autoplaySettings.svelte.ts on purpose. This module CALLS the
 * round flow, and the round flow READS the settings (`auto.running`,
 * `stops.onFullWin`) back out. With the state and the loop in one module that
 * is a cycle; with the state on its own it is a DAG, and the DAG is the version
 * a reader can follow.
 *
 * The loop is otherwise unremarkable and deliberately so: each iteration is one
 * independent /wallet/play, exactly like a manual spin, because Stake's RGS has
 * no server-side notion of "auto". Everything that makes it stop - the count,
 * the balance, an error, a full game win, a loss limit, a single big win, a
 * Stop press - is checked here rather than being pushed into the round. The
 * stake never changes during a run.
 */
import { sound } from '../audio/sound';
import { jurisdiction } from '../jurisdiction/jurisdiction.svelte';

import { isCleanSweep } from '../math/modes';
import { auto, autoRoundsValid, stops } from './autoplaySettings.svelte';
import { limitAmount, limitReached } from './autoplayLimits';
import { allChoicesMade, betIsValid, roundCost } from '../bet/betState.svelte';
import { round } from './roundState.svelte';
import { paceMs } from './revealPacing.svelte';
import { closeBetMenuForRun, runRound } from './roundPlace.svelte';
import { wait } from './roundReveal.svelte';

// Auto play: loop the single-bet round with the player's locked-in guesses
// until the round count runs out, the balance can't cover the next bet, an
// engine round errors, or the player hits Stop.
// `hold` = a space-hold run: it ignores the round count and instead runs for
// as long as auto.spaceHoldRunning stays true (i.e. the key is still down).
export async function startAuto({ hold = false } = {}) {
  // Barred outright by the regulator - covers the popup's Start, the
  // spacebar hold, and any future caller.
  if (jurisdiction.autoplayDisabled()) return;
  if (auto.running || !betIsValid() || !allChoicesMade()) return;
  if (!hold && !autoRoundsValid()) return;
  auto.stopRequested = false;
  auto.running = true;
  sound.playAutoStart();
  // A run can start with the bet menu already open - the spacebar hold does
  // not go through the popup at all. Leaving it up would show a rack of chips
  // that silently refuse to be picked, which is worse than closing it.
  closeBetMenuForRun();
  auto.spaceHoldRunning = hold;
  auto.remaining = hold ? 0 : auto.infinite ? Infinity : Math.floor(Number(auto.roundsInput));

  // The run's net result so far - winnings minus stakes - for the loss limit.
  let net = 0;

  try {
    while ((hold ? auto.spaceHoldRunning : auto.remaining > 0) && !auto.stopRequested) {
      // Affordability and limits, asked of betIsValid rather than re-derived.
      // This used to be its own `betValue() > balance + 1e-9` comparison,
      // which disagreed with betIsValid in two ways: betIsValid has no
      // epsilon, and it also checks minBet/maxBet, which this did not. Either
      // gap let the loop start a round that playRound then refused - and a
      // refusal was silent, so the counter kept ticking down and the run
      // appeared to stop early.
      if (!betIsValid()) break;

      const played = await runRound();
      // A round that refused to play must not count as a spin.
      if (!played) break;
      // Bail on a placement/settlement error rather than repeating it, and
      // honour a Stop pressed during the round (the in-flight bet finished).
      if (round.error || auto.stopRequested) break;

      // This round's stake - what it actually cost, from the bet it was placed
      // on - and the run's net result after it.
      const cost = roundCost(round.initialBet);
      net = Math.round((net + (round.wonAmount - cost)) * 100) / 100;

      // Stop on a full game win if requested.
      //
      // A CLEAN SWEEP, not "did not bust". Second Chance forgives one wrong
      // guess and plays on, so a round that missed card 4 and had it forgiven
      // ends with round.bustedIndex still null and round.state 'won' - three of four
      // guesses right, and the old test stopped the run on it. Same for a
      // forgiven card 2 or 3 that then went on to win: still not four for
      // four. isCleanSweep is the rule the takeover already applied; this is
      // the same question asked in the same words.
      //
      // Classic and High Stakes have no forgiveness, so round.forgivenIndex is
      // always null there and their behaviour is unchanged.
      if (stops.onFullWin && round.state === 'won' && isCleanSweep(round.bustedIndex, round.forgivenIndex))
        break;

      // The two limits the panel offers, as money. A "x" limit is a multiple of
      // the BASE bet - the unit every other "your bet" in the game means - and
      // is read fresh each round, so a limit changed mid-run applies from the
      // next one (autoplayLimits.ts).
      const lossAt = limitAmount(stops.lossLimit, round.initialBet);
      const winAt = limitAmount(stops.winLimit, round.initialBet);
      if (limitReached(lossAt, winAt, net, round.wonAmount)) break;

      if (hold) {
        // Released mid-round: finish here rather than starting another bet.
        if (!auto.spaceHoldRunning) break;
      } else if (!auto.infinite) {
        auto.remaining -= 1;
        if (auto.remaining <= 0) break;
      }
      // Let the just-finished result sit briefly before the board clears.
      await wait(paceMs(750, 200));
    }
  } finally {
    auto.running = false;
    auto.spaceHoldRunning = false;
    auto.remaining = 0;
    // Deliberately DON'T reset the board here: when the run ends (count
    // exhausted or Stop pressed) the final round stays on screen with its
    // revealed cards and win, exactly like a manual round does. The next
    // spin clears it (playRound resets the board itself).
  }
}

export function stopAuto() {
  // Sounded here rather than where auto.running flips false in the loop's
  // `finally`: that runs after the current round has played out, seconds
  // later, and the player needs to hear that the press registered NOW. The
  // run really is ending; only the last round is still in flight.
  if (auto.running && !auto.stopRequested) sound.playAutoStop();
  // Can't cancel a bet already on the server, so just ask the loop to stop
  // before the next round; the current round plays out.
  auto.stopRequested = true;
}

// countDigits and the four autoplay stepper handlers live in
// game/round/autoplaySettings.svelte.ts.
