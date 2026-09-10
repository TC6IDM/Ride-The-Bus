/**
 * Buy a round: resolve where it comes from, place the bet, and hold the gate.
 *
 * The first of three - place, then reveal (roundReveal.svelte.ts), then settle
 * (roundSettle.svelte.ts). This is the half that spends money, which is why it
 * has its own file and its own name:
 *
 *   - the DEFENSIVE end-round, gated on engineRound.open. Firing it before
 *     every round put one failed request in the network tab per spin on a
 *     clean run, and Stake's checklist has a line for exactly that.
 *   - the mode slug, built from the family and the four guesses. Naming a mode
 *     the math never published gets the bet rejected outright.
 *   - /wallet/play through pacedPlay, so nothing here can outrun the RGS.
 *   - the single-flight gate, so a spacebar tap and the auto loop 400ms behind
 *     it cannot place two bets on one round.
 *   - the regulator's minimum round duration, applied AFTER the result is on
 *     screen rather than by slowing the reveal - the rule exists so a player
 *     can register the outcome.
 *
 * CONFIGURED ONCE. resolveRoundSeed needs the `roundSeed` prop and startAuto
 * has to close an open bet menu; neither is reachable from a module, so
 * configureRoundFlow takes both at mount.
 */
import { stateBet, stateConfig, stateModal, stateUrlDerived } from 'state-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { requestBet, requestEndRound } from 'rgs-requests';
import { jurisdiction } from '../jurisdiction/jurisdiction.svelte';
import { pacedPlay, pacedRequest } from './rgsPacing';
import { modeName } from '../math/modes';
import { auto } from './autoplaySettings.svelte';
import {
  allChoicesMade,
  bet,
  betIsValid,
  betValue,
  familyRules,
  guesses,
  normalizeBet,
  roundCost,
} from '../bet/betState.svelte';
import { engineRound, resetForNewRound, round } from './roundState.svelte';
import { animateRoundFromEvents, playRevealSequence, wait } from './roundReveal.svelte';

const IS_PROD = Boolean((import.meta as any).env?.PROD);

// Payout model mirrors math-sdk games/ride_the_bus/game_calculations.py +
// gamestate.py so a local-fallback round pays exactly what the real book
// would for the same cards. A miss no longer zeroes the round: it banks
// STAGE_RETENTION[stage] of what was earned so far (partial credit). Each
// correct-guess multiplier is solved so the expected per-stage change is a
// fixed constant DECAY for any probability (see partialMultiplier), so the
// per-mode raw RTP tends to the same target regardless of the mode's odds.
// NOTE: production then reweights each mode's book frequencies to pin RTP
// to a flat 0.96 (reweight_luts.py). The local deck is drawn uniformly and
// is NOT reweighted, so its long-run RTP differs from prod's (most for the
// structurally-hard "inside" modes) - but any single hand pays identically,
// which is what matters for local testing.
// TARGET_RTP / DECAY / STAGE_RETENTION and the three multiplier functions now
// live in game/math/payout.ts, imported above, so they can be unit-tested against
// the published books.

// Bet spacing and the 429 retry live in rgsPacing.ts - the floor and
// the retry that raises it are one feedback loop and belong together.

/**
 * The two things the round flow cannot reach on its own.
 *
 * `roundSeed` is a component prop. `closeBetMenu` is how startAuto puts away a
 * bet menu that is open when a run begins - `openPopup` belongs to the
 * component, and a rack of chips that silently refuses taps is worse than a
 * closed panel.
 */
type FlowDeps = {
  roundSeed: () => string;
  fallbackRoundSeed: string;
  closeBetMenu: () => void;
};

let deps: FlowDeps = {
  roundSeed: () => '',
  fallbackRoundSeed: '',
  closeBetMenu: () => {},
};

export function configureRoundFlow(next: FlowDeps) {
  deps = next;
}

export const resolveRoundSeed = () => {
  if (deps.roundSeed() !== deps.fallbackRoundSeed) {
    return { seed: deps.roundSeed(), source: 'engine-auth' as const };
  }

  if (stateUrlDerived.replay()) {
    const replaySeed = stateUrlDerived.event();
    if (replaySeed) {
      return { seed: replaySeed, source: 'engine-replay' as const };
    }
  }

  const authenticatedRoundId = stateBet.betToResume?.roundID;
  if (authenticatedRoundId !== undefined && authenticatedRoundId !== null && `${authenticatedRoundId}`.trim()) {
    return { seed: `${authenticatedRoundId}`, source: 'engine-auth' as const };
  }

  if (stateUrlDerived.sessionID() && stateUrlDerived.rgsUrl()) {
    return { seed: 'new-round', source: 'engine-auth' as const };
  }

  if (IS_PROD) return { seed: null as unknown as string, source: 'none' as const };

  return { seed: deps.fallbackRoundSeed, source: 'local-fallback' as const };
};


export async function startGameEngineFlow(roundSeedData: { seed: string; source: 'engine-auth' | 'engine-replay' }) {
  round.isProcessing = true;
  try {
    // Defensively settle any round still open on this session before starting
    // a new one. A round left active (a win whose end-round didn't complete,
    // or one abandoned mid-reveal by a reload) makes the RGS reject the next
    // /wallet/play with ERR_VAL - which is why that error cleared on a page
    // refresh (a refresh starts a fresh session). Ending it here lets the
    // game self-heal on the next Start instead of needing a manual refresh.
    // Gated on engineRound.open. Firing it unconditionally - which is what
    // this did - meant a 400 from the RGS before every single spin, because
    // there is normally nothing to settle. This game is stateless, so there
    // is never a round we want to resume rather than close.
    if (engineRound.open) {
      try {
        await pacedRequest('end-round (settling previous)', () =>
          requestEndRound({
            rgsUrl: stateUrlDerived.rgsUrl(),
            sessionID: stateUrlDerived.sessionID(),
          }),
        );
        engineRound.open = false;
      } catch (err) {
        // Leave the flag set: the round is still open, and the play below
        // will tell us plainly if that is a problem.
        console.warn('[RideTheBus] could not settle the previous round', err);
      }
    }

    // Built through modeName so the family prefix and the choice order come
    // from one place; string concatenation here is what once sent a mode the
    // math had never published.
    //
    // Re-checked rather than asserted non-null. playRound already refuses
    // without all four, but that guard is several branches back, and the
    // failure if it ever stopped holding is a mode string containing "null"
    // - rejected by the RGS with an error naming nothing useful.
    if (!guesses.color || !guesses.hl || !guesses.io || !guesses.suit) {
      round.error = true;
      return false;
    }
    const mode = modeName(guesses.color, guesses.hl, guesses.io, guesses.suit, bet.family);
    // Keep the shared bet state's active mode in sync with what we actually
    // play, so any framework helper that reads activeBetModeKey agrees.
    stateBet.activeBetModeKey = mode;
    // Diagnostic: log exactly what we send so an RGS ERR_VAL can be traced to
    // the offending field (mode vs amount vs currency) from the console.
    //
    // Gated on `import.meta.env.DEV` written out literally, NOT on the IS_PROD
    // const above: Vite substitutes this expression at build time, so the
    // whole block is dead code in a production build and gets dropped. The
    // const is computed at runtime and would keep the payload - including the
    // player's balance - in the shipped bundle.
    if (import.meta.env.DEV) {
      console.log('[RideTheBus] /wallet/play request:', {
        mode,
        betAmount: stateBet.betAmount,
        initialBet: round.initialBet,
        amountMicroUnits: round.initialBet * API_AMOUNT_MULTIPLIER,
        currency: stateBet.currency,
        balance: stateBet.balanceAmount,
        allowedBetLevels: stateConfig.betAmountOptions,
      });
    }
    // Turbo-independent spacing, so autoplay cannot outrun the RGS. pacedPlay
    // holds for the bet interval AND the shared inter-call gap before sending.
    const data = await pacedPlay('play', () =>
      requestBet({
        rgsUrl: stateUrlDerived.rgsUrl(),
        sessionID: stateUrlDerived.sessionID(),
        currency: stateBet.currency || 'USD',
        mode,
        amount: round.initialBet,
      }),
    );
    if (import.meta.env.DEV) console.log('[RideTheBus] /wallet/play response:', data);

    // The RGS returns a failure in the body (status.statusCode !== SUCCESS,
    // and/or an `error` field) rather than throwing; surface the real reason
    // (e.g. ERR_IS invalid session, ERR_IPB balance) instead of masking it
    // behind the generic empty-state error below.
    const statusCode = (data as any)?.status?.statusCode;
    if ((data as any)?.error || (statusCode && statusCode !== 'SUCCESS')) {
      const detail =
        (data as any)?.status?.statusMessage ||
        (typeof (data as any)?.error === 'string' ? (data as any).error : '') ||
        JSON.stringify((data as any)?.error ?? (data as any)?.status ?? {});
      throw new Error(`RGS rejected play (${statusCode ?? 'error'})${detail ? `: ${detail}` : ''}`);
    }

    // Same finite-number check as the end-round credit below, and for the
    // same reason: `!== undefined` accepts null, and null / 1_000_000 is 0.
    const playBalance = (data as any)?.balance?.amount;
    if (typeof playBalance === 'number' && Number.isFinite(playBalance)) {
      stateBet.balanceAmount = playBalance / API_AMOUNT_MULTIPLIER;
    }
    // The RGS now holds an open round for this session.
    engineRound.open = true;

    await animateRoundFromEvents(
      data?.round?.state,
      `${data?.round?.roundID ?? ''}`,
      roundSeedData.source,
      `No round state from /wallet/play for mode "${mode}". The math for this mode may not be ` +
        `published/approved, or the bet amount isn't a valid level.`,
    );
  } catch (err) {
    console.error('[RideTheBus] round failed', err);
    round.error = true;
    // Surface through ErrorModal (mounted at the bottom of this
    // file) rather than a raw alert(), so a failed bet looks the same as the
    // auth/session errors the framework already reports. Only report once:
    // an auto run stops after this, so we don't stack a dialog per round.
    if (!auto.running) {
      stateModal.modal = { name: 'error', error: err };
    }
  } finally {
    round.isProcessing = false;
  }
}

// Single-flight wrapper around playRound. A space-hold starts one round on
// keydown and then, 400ms later, an auto loop - so without this the loop's
// first iteration would place a second bet on top of the still-running tap
// round. Callers that arrive mid-round get the in-flight promise instead,
// which is exactly the "wait for it, then carry on" the auto loop wants.
let roundInFlight: Promise<boolean> | null = null;
// True while a settled round is being held open to satisfy the regulator's
// minimum round duration. Feeds spinDisabled so the button stays dead.
export const gate = $state({
  /** True while a settled round is held open for the regulator's floor. */
  held: false,
  /** 0..1 through that hold, drawn as a ring round the spin button. */
  progress: 0,
});
// 0..1 through the hold, drawn as a ring that fills clockwise around the
// spin button so the wait reads as a countdown rather than a dead control.
// The regulator's floor in seconds, for the tooltip. Trimmed so a whole
// number reads "3" rather than "3.0".
export const cooldownSecondsLabel = () => {
  const s = jurisdiction.minimumRoundDurationMs() / 1000;
  return Number.isInteger(s) ? String(s) : s.toFixed(1);
};
export function runRound(): Promise<boolean> {
  if (roundInFlight) return roundInFlight;
  const started = performance.now();
  roundInFlight = playRound()
    .then(async (played) => {
      // Enforce jurisdiction.minimumRoundDuration. Deliberately applied
      // AFTER the result is on screen rather than by slowing the reveal:
      // the rule exists so a player can register the outcome, so padding
      // the gap before the next spin is what it actually asks for. Covers
      // manual and autoplay alike, since the auto loop awaits runRound.
      const min = jurisdiction.minimumRoundDurationMs();
      if (min <= 0) return played;
      const remaining = min - (performance.now() - started);
      if (remaining <= 0) return played;
      gate.held = true;
      gate.progress = 0;
      // Drive the ring off the clock rather than a CSS transition, so it
      // stays honest if the tab is throttled or the hold is cut short.
      const gateStart = performance.now();
      let raf = requestAnimationFrame(function tick() {
        gate.progress = Math.min(1, (performance.now() - gateStart) / remaining);
        if (gate.progress < 1) raf = requestAnimationFrame(tick);
      });
      try {
        await wait(remaining);
      } finally {
        cancelAnimationFrame(raf);
        gate.progress = 0;
        gate.held = false;
      }
      return played;
    })
    .finally(() => {
      roundInFlight = null;
    });
  return roundInFlight;
}

// One full round: place the single bet (engine or local-fallback) and play it
// out to a won/lost result. Awaitable so the auto loop can run rounds
// back-to-back; manual Start just fires it and forgets. Go through runRound()
// rather than calling this directly, so rounds can never overlap.
/**
 * Play one round. Returns false when it REFUSED to play.
 *
 * That distinction is what the auto loop needs. This used to return void, so
 * a refusal was indistinguishable from a completed round: the loop counted it
 * as played, decremented the counter and went round again, silently burning
 * the remaining spins in a fraction of a second. From the player's side an
 * autoplay run just ended early for no visible reason.
 */

export async function playRound(): Promise<boolean> {
  // The Start button is disabled unless these hold, but guard anyway.
  if (!betIsValid() || !allChoicesMade()) return false;
  round.error = false;
  round.hasPlayed = true;

  // Normalize the live bet to what the RGS accepts (clamp to range, round to
  // the cent) at the moment of play.
  round.initialBet = normalizeBet(betValue());
  stateBet.betAmount = round.initialBet;
  bet.input = String(round.initialBet);
  const roundSeedData = resolveRoundSeed();

  if (roundSeedData.source === 'engine-auth' || roundSeedData.source === 'engine-replay') {
    await startGameEngineFlow(roundSeedData);
    return true;
  }

  // Local deterministic fallback - DEV ONLY. resolveRoundSeed already refuses
  // to return this source under IS_PROD, but the guard is repeated here as an
  // `import.meta.env.DEV` literal so Vite can prove the branch dead and drop
  // roundContract's client-side shuffler from the production bundle entirely.
  // A real-money build should not ship a card generator, even an unreachable
  // one - it is the first thing an auditor reading the bundle would query.
  if (!import.meta.env.DEV) {
    throw new Error('Local fallback is not available in a production build.');
  }

  // Simulate the debit a real /wallet/play call would make, so balance
  // behaves like prod.
  // Local fallback only - the RGS debits the real thing. Cost, not bet.
  stateBet.balanceAmount -= roundCost(round.initialBet);
  const [{ createRoundContract }, { buildLocalRevealEvents }] = await Promise.all([
    import('./roundShuffler'),
    import('./localRound'),
  ]);
  const contract = createRoundContract(`${roundSeedData.seed}:${round.sequence}`);
  round.sequence += 1;
  round.lastRoundId = contract.roundId;
  round.source = roundSeedData.source;
  round.revealEvents = buildLocalRevealEvents(
    contract.deck,
    [guesses.color as string, guesses.hl as string, guesses.io as string, guesses.suit as string],
    familyRules(),
  );
  round.engineFinalMultiplier = null; // local round computes its own payout
  resetForNewRound();
  await playRevealSequence();
  return true;
}

/**
 * Put away a bet menu that is open as an autoplay run begins.
 *
 * The autoplay loop cannot reach `openPopup` - that is the component's - and it
 * should not have to. Named for what it is FOR rather than for what it does, so
 * the loop reads as "close the bet menu for this run" rather than as poking at
 * UI state.
 */

export function closeBetMenuForRun() {
  deps.closeBetMenu();
}

