/**
 * The autoplay loop: run rounds back to back until something says stop.
 *
 * Separate from autoplaySettings.svelte.ts on purpose. This module CALLS the
 * round flow, and the round flow READS the settings (`auto.running`,
 * `stops.slamOnAuto`) back out. With the state and the loop in one module that
 * is a cycle; with the state on its own it is a DAG, and the DAG is the version
 * a reader can follow.
 *
 * The loop is otherwise unremarkable and deliberately so: each iteration is one
 * independent /wallet/play, exactly like a manual spin, because Stake's RGS has
 * no server-side notion of "auto". Everything that makes it stop - the count,
 * the balance, an error, a full game win, a Stop press - is checked here rather
 * than being pushed into the round.
 */
import { sound } from '../audio/sound';
import { jurisdiction } from '../jurisdiction/jurisdiction.svelte';

import { isCleanSweep } from '../math/modes';
import {
  ADVANCED_ENABLED,
  advanced,
  auto,
  autoRoundsValid,
  run,
  stops,
  toNum,
} from './autoplaySettings.svelte';
import { allChoicesMade, bet, betIsValid, betValue, normalizeBet, roundCost } from '../bet/betState.svelte';
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

  // Advanced strategy setup: the starting bet is the reset target, and the
  // net result is tracked so Stop on Profit / Stop on Loss can end the run.
  run.baseBet = normalizeBet(betValue());
  run.profit = 0;
  let nextBet = run.baseBet;
  // Advanced strategy only applies when the feature is enabled AND switched on
  // (the switch is currently hard-disabled - see ADVANCED_ENABLED). This keeps
  // the stake constant, matching the SDK's own auto-bet.
  const useAdvanced = ADVANCED_ENABLED && advanced.mode;
  const stopProfit = useAdvanced ? toNum(advanced.stopOnProfit) : 0;
  const stopLoss = useAdvanced ? toNum(advanced.stopOnLoss) : 0;

  try {
    while ((hold ? auto.spaceHoldRunning : auto.remaining > 0) && !auto.stopRequested) {
      // Bet this round's amount (advanced strategy may have grown / reset it).
      bet.input = String(nextBet);
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

      // Tally this round's net result (payout minus the stake actually placed).
      const roundBet = roundCost(round.initialBet);
      const won = round.wonAmount > roundBet;
      run.profit = Math.round((run.profit + (round.wonAmount - roundBet)) * 100) / 100;

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

      if (useAdvanced) {
        // End the run once a cumulative profit / loss target is hit.
        if (stopProfit > 0 && run.profit >= stopProfit - 1e-9) break;
        if (stopLoss > 0 && -run.profit >= stopLoss - 1e-9) break;
        // Set the next bet from the win/loss rule: reset to base, or grow the
        // current bet by the given % (100% = classic martingale double).
        const mode = won ? advanced.onWinMode : advanced.onLossMode;
        const pct = won ? toNum(advanced.onWinPct) : toNum(advanced.onLossPct);
        nextBet = mode === 'reset' ? run.baseBet : nextBet * (1 + pct / 100);
        nextBet = Math.round(Math.max(0, nextBet) * 100) / 100;
        if (!(nextBet > 0)) nextBet = run.baseBet;
      }

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
    // Restore the input to the starting bet so the sidebar doesn't keep the
    // last (possibly grown) strategy amount after the run ends.
    bet.input = String(run.baseBet);
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
