/**
 * Settle the round: decide the payout, close it with the RGS, and bank it.
 *
 * The back half of what used to be one 200-line playRevealSequence. The seam is
 * exact - the reveal animation finishes, and then this runs - and nothing
 * crosses it: everything here reads the round off `round` rather than off the
 * loop's own locals, which is why it takes no arguments.
 *
 * WORTH ITS OWN FILE because of what it does rather than how long it is. This
 * is the code that credits the player and closes the round with the RGS, and
 * the two failure modes are both invisible locally:
 *
 *   - skip the /wallet/end-round and the round stays "active", so the NEXT
 *     /wallet/play comes back ERR_VAL and the game blocks after the first win;
 *   - take the end-round balance without checking it is a finite number and a
 *     `balance: { amount: null }` response zeroes the player's balance outright.
 *
 * Both are commented at the branch that guards them. Neither shows up in the
 * local-fallback path, which credits wins directly.
 */
import { stateBet, stateUrlDerived } from 'state-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { requestEndRound } from 'rgs-requests';

import { pacedRequest } from './rgsPacing';
import { sound } from '../audio/sound';
import { computeFinalMultiplier } from '../math/payout';
import { isCleanSweep } from '../math/modes';
import { winTierFor } from '../math/winTiers';

import { familyRules, roundCost, winTiers } from '../bet/betState.svelte';
import { showWinCelebration } from '../celebration/celebrationState.svelte';
import { revealWait } from './revealPacing.svelte';
import { engineRound, isEngineRound, round } from './roundState.svelte';

/**
 * Everything after the last card lands.
 *
 * Awaited by playRevealSequence, which is awaited by runRound, which the auto
 * loop awaits - so a takeover held open at the end of this pauses the whole run
 * without the loop needing to know the takeover exists.
 */
export async function settleRound() {
  await revealWait(300, 120);
  // Prefer the server's authoritative payout on engine rounds; fall back to
  // the local formula (identical maths) when there's no RGS session.
  const multiplier = round.engineFinalMultiplier ?? computeFinalMultiplier(round.revealEvents, familyRules());
  round.wonAmount = multiplier * round.initialBet;
  round.runningWin = round.wonAmount;
  if (stateUrlDerived.replay()) {
    // Replay is a read-only view of an already-settled round: nothing to
    // credit and nothing to close (the SDK's own end-round helper bails out on
    // replay too - createPrimaryMachines.ts:43).
  } else if (!isEngineRound()) {
    // Local-fallback has no server - credit the win locally.
    stateBet.balanceAmount += round.wonAmount;
  } else if (round.wonAmount <= 0) {
    // A zero-payout round auto-closes on the RGS, so there is nothing to
    // settle and calling end-round would just be a 400.
    engineRound.open = false;
  } else {
    // A WINNING engine round must be settled with /wallet/end-round: this
    // credits the payout and closes the round. Without it the round stays
    // "active" and the NEXT /wallet/play is rejected with ERR_VAL - which is
    // exactly why the game blocked right after the first win. Losing rounds
    // (0 payout) auto-close on the RGS, so they need no end-round (that's
    // why consecutive losses kept working). Use the end-round balance as the
    // post-win source of truth.
    //
    // The credit MUST land one way or the other. /wallet/play already
    // debited the stake and set the tracked balance to the post-debit
    // figure, so if end-round neither returns a usable balance nor throws
    // somewhere we notice, the win is simply never added back. The tracked
    // balance then only ever falls - a stake every round, a credit never -
    // and after enough rounds it drops under the bet, betIsValid() goes
    // false and the autoplay loop stops for "insufficient funds" while the
    // real balance is fine. That failure is invisible locally, because the
    // local-fallback branch above credits wins directly.
    let credited = false;
    try {
      const endData = await pacedRequest('end-round', () =>
        requestEndRound({
          rgsUrl: stateUrlDerived.rgsUrl(),
          sessionID: stateUrlDerived.sessionID(),
        }),
      );
      const amount = (endData as any)?.balance?.amount;
      // Checked as a finite number, not `!== undefined`. That older guard let
      // null through, and `null / 1_000_000` is 0 - so a response carrying
      // `balance: { amount: null }` zeroed the balance outright and killed the
      // run on the very next affordability check. A string would have given
      // NaN, which compares false against everything and is worse again.
      if (typeof amount === 'number' && Number.isFinite(amount)) {
        stateBet.balanceAmount = amount / API_AMOUNT_MULTIPLIER;
        credited = true;
      }
      // Settled, whatever the body looked like - the call came back without
      // throwing, so the round is closed.
      engineRound.open = false;
    } catch (err) {
      // Still open. The defensive settle at the top of the next round will
      // retry it, which is the case that guard exists for.
      console.error('[RideTheBus] end-round failed', err);
    }
    if (!credited) {
      // The RGS has already settled and paid this round - end-round simply
      // came back without a balance we could read. Only the DISPLAYED figure
      // is being repaired here, so the affordability check does not start
      // refusing bets the player can afford; the next /wallet/play response
      // overwrites it with the server's own number. No payout is decided,
      // altered or predicted on this side.
      //
      // The wording matters: an earlier version of this line said "crediting
      // the win locally", which describes a client-side payout - the exact
      // thing approval looks for - rather than what the code does.
      console.warn('[RideTheBus] end-round returned no readable balance; refreshing the displayed balance until the next play response');
      stateBet.balanceAmount += round.wonAmount;
    }
  }
  round.state = round.wonAmount > 0 ? 'won' : 'lost';
  // Record the settled result for the "Last Win" readout on the control bar.
  round.lastWinAmount = round.wonAmount;
  round.lastWinMultiplier = round.initialBet > 0 ? round.wonAmount / round.initialBet : 0;
  // Net position for this session: payout minus the stake actually placed.
  // Against the round's COST, not the bet - a 2x mode takes twice the bet,
  // and a net position that ignored that would read as a steady profit.
  round.sessionNet = Math.round((round.sessionNet + (round.wonAmount - roundCost(round.initialBet))) * 100) / 100;

  // A win big enough to celebrate gets the takeover, which plays its own
  // escalating fanfare - so the ordinary win sting is suppressed rather than
  // stacked underneath it.
  //
  // Tiering is on payout size, so a bust on card 4 that kept a share of a big
  // multiplier still celebrates. The second argument floors a FULL game win
  // at the entry tier regardless of size: the smallest one possible is 6.6x
  // (exhaustively enumerated - see winTiers.ts), which would otherwise slip
  // under the 10x threshold and land the game's defining moment in silence.
  //
  // That floor is per family. Second Chance forgives a wrong guess, so most
  // of its rounds reach card 4 and the takeover fired on nearly all of them -
  // see celebrateEveryFullWin and isCleanSweep in modes.ts. A round that
  // spent its Second Chance still celebrates on SIZE, just not on the floor.
  const tiers = winTiers();

  const celebrationTier = winTierFor(
    round.lastWinMultiplier,
    isCleanSweep(round.bustedIndex, round.forgivenIndex) &&
      round.wonAmount > 0 &&
      familyRules().celebrateEveryFullWin,
    tiers,
  );

  if (round.wonAmount <= 0) {
    sound.playRoundLoss();
  } else if (celebrationTier) {
    // WinCelebration owns the audio for this round.
  } else if (isCleanSweep(round.bustedIndex, round.forgivenIndex)) {
    // Clean sweep, not "did not bust" - a forgiven Second Chance round got
    // three of four and must not sound like the game's best outcome.
    sound.playFullWin();
  } else {
    sound.playRoundWin();
  }

  // Blocks here until dismissed (or auto-skipped). runRound awaits this, and
  // the auto loop awaits runRound, so the run pauses without the loop needing
  // to know the takeover exists.
  if (celebrationTier) {
    await showWinCelebration(celebrationTier, round.wonAmount, round.lastWinMultiplier, tiers);
  }
}
