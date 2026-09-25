/**
 * Turn a settled book into the reveal on screen: four cards, in order, with
 * their cues.
 *
 * The middle of three. A round is placed (roundPlace.svelte.ts), revealed
 * (here), then settled (roundSettle.svelte.ts), and the three run strictly in
 * that direction - this module imports settle and is imported by place, and
 * nothing goes back the other way.
 *
 * animateRoundFromEvents is the door in, and it is shared: a freshly placed bet
 * arrives here through it, and so does a replay, which has no bet to place at
 * all. That is why it lives with the reveal rather than with the placing.
 *
 * The per-card cues are `cueLead(i)`-staggered rather than suppressed on an
 * instant reveal - see revealPacing.svelte.ts. sound.test.ts slices this
 * module between `playRevealSequence` and `await settleRound()` and asserts on
 * every cue in between, so a cue added to the loop needs the same treatment.
 */
import type { Card } from './roundContract';
import { loaderGone } from '../platform/ready.svelte';
import { HOLD_MIN_CLIMB, sound } from '../audio/sound';
import { decayFor, forgivenessAvailable, quantizeMultiplier } from '../math/payout';
import { FREE_CHOICE, isCleanSweep, stageCount } from '../math/modes';
import { holdClimbMs, lastCardHoldMs, lastCardHolds, lastCardTier, lastCardTunnels } from '../math/winTiers';
import { familyRules, winTiers } from '../bet/betState.svelte';
import { cueLead, paceMs, pacing, revealWait } from './revealPacing.svelte';
import { resetForNewRound, round } from './roundState.svelte';
import { settleRound } from './roundSettle.svelte';

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

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Hold until the loading screen has gone.
 *
 * Replay and round-resume both start the moment /wallet/authenticate returns a
 * round, but the loader stays up for a minimum 1400ms plus 220ms after that -
 * and the first card turns roughly 650ms in. The reveal therefore played out
 * behind a full-screen overlay, which on Stake's replay view meant the round
 * was already part-finished when the screen cleared.
 *
 * Polled rather than watched with an effect, for the same reason GameLoader
 * polls gameReady: a tracked read inside the calling effect would re-run it
 * when the flag flipped.
 *
 * The timeout is a backstop, not a schedule. GameLoader always resolves - it
 * caps itself at 8s - but if it is ever absent from a route this must not
 * strand the player on a round that never animates.
 */
export function waitForLoaderGone(timeoutMs = 10000): Promise<void> {
  return new Promise((resolve) => {
    if (loaderGone.value) return resolve();
    const started = performance.now();
    const check = () => {
      if (loaderGone.value || performance.now() - started > timeoutMs) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}

// Slam stop, the turbo scale and the reveal's own interruptible pause all

export async function playRevealSequence() {
  // Reveal one card at a time, stopping at the first miss - the round ends
  // where the player "gets off the bus". Unlike the old all-or-nothing
  // flow, a miss past stage 1 still banks partial winnings, so a bust is
  // no longer automatically a loss. `running` is kept RAW (unquantized) and
  // compounded exactly like computeFinalMultiplier / gamestate.run_spin; we
  // only quantize for the per-card display and the final payout, so the
  // last card's shown multiplier equals the credited win.
  // Each round starts un-slammed; the flag only lives for one reveal, and
  // only the Skip button sets it. (Autoplay and a held spacebar used to be
  // able to pre-set it from two panel switches; a slam paces exactly like
  // turbo at maximum, so those were the slider twice over and are gone.)
  pacing.slamRequested = false;
  // The hand goes down. Fills the ~650ms between the press and the first card,
  // which used to be silent - the press resolved into nothing and the round
  // began with a card already landing.
  //
  // Under an instant reveal the per-card cues below fall in behind it at the
  // same riffle spacing, so the whole round reads as one dealt hand.
  sound.playDeal();

  let running = 1;
  let busted = false;
  let forgivenessSpent = false;
  const last = round.revealEvents.length - 1;
  // Whether the last card may be held at all: only on a round with an Equal
  // pick behind it (lastCardHolds). From the choices the book was bet on.
  const mayHold = lastCardHolds(round.revealEvents.map((e) => e.choice));
  for (let i = 0; i < round.revealEvents.length; i++) {
    const event = round.revealEvents[i];
    // The last card waits longer when a lot is riding on it. What it would pay
    // is known before it turns - `event.payout` is the book's price for the
    // pick, written whether or not the pick lands - so the hold says how much
    // is at stake and nothing about the result. See lastCardHoldMs.
    let releaseHold = () => {};
    if (i === last && !busted && mayHold) {
      const landing = quantizeMultiplier(running * event.payout * familyRules().cost);
      const fullGameWin = isCleanSweep(round.bustedIndex, round.forgivenIndex) && familyRules().celebrateEveryFullWin;
      const hold = lastCardHoldMs(landing, fullGameWin, winTiers());
      if (hold > 0) {
        // The wait as it will actually run - the hold plus the ordinary beat
        // before a turn, both turbo-scaled - and the climb within it. The card
        // (--hold-climb) and its hum rise on the same number, then sit at the
        // top together; the release just below is the slam, however the wait
        // ended.
        round.holdClimbMs = holdClimbMs(paceMs(hold, 0) + paceMs(650, 0));
        round.holdIndex = i;
        // The drama only when the hold is long enough to be felt. Near the top
        // of the turbo range the climb shrinks to a blink: the card just hops,
        // and the music stays up and the room stays lit - a duck and a tunnel
        // on every held card of a fast autoplay run would pump and flicker.
        if (round.holdClimbMs >= HOLD_MIN_CLIMB * 1000) {
          round.lastCardHeld = true;
          // Tunnel vision only when the card could land a Huge win or bigger -
          // from the same stake, never from the result. See lastCardTunnels.
          round.holdTunnel = lastCardTunnels(landing, fullGameWin, winTiers());
          // The voices and the strike scale with the same tier, and the hum is
          // tuned to this card's own stage-win chime.
          const heldTier = lastCardTier(landing, fullGameWin, winTiers()) ?? 'big';
          releaseHold = sound.playLastCardHold(round.holdClimbMs / 1000, heldTier, i);
        }
        await revealWait(hold, 0);
      }
    }
    await revealWait(650, 0);
    releaseHold();
    round.holdIndex = null;
    round.revealedCards[i] = event.card;
    // Spaced, not skipped, when the reveal is instant - see cueLead.
    sound.playCardFlip(cueLead(i));
    if (!busted && event.correct) {
      running *= event.payout;
      // A free card (Three of a Kind's card 1) is dealt, not won: it
      // gets the flip and nothing else. A stage-win cue on a 1.00x would tell
      // the player they had just got something right.
      if (event.choice !== FREE_CHOICE) sound.playStageWin(i, cueLead(i));
    } else if (!busted) {
      // A forgiven miss keeps its fraction and the round plays on - no bust
      // marker, no decay term (that stands in for stages a bust skips, and
      // these will be played for real). Mirrors gamestate.py:run_spin.
      if (forgivenessAvailable(familyRules(), i, forgivenessSpent)) {
        running *= familyRules().forgive!;
        forgivenessSpent = true;
        round.forgivenIndex = i;
        // NOT playBust(). The board draws an amber return arrow here and a red
        // cross on a real bust, and cards.css is explicit that the two must
        // differ - "a red cross says the round ended here, and this one carried
        // on". Sounding them identically threw that away, and with it the only
        // thing Second Chance does that the other two families do not.
        sound.playForgiven(cueLead(i));
      } else {
        round.bustedIndex = i;
        // The stages never played, counted from the round's own length -
        // three on Three of a Kind. Mirrors computeFinalMultiplier.
        running *= familyRules().retention[i]! * decayFor(familyRules()) ** (round.revealEvents.length - 1 - i);
        busted = true;
        sound.playBust(cueLead(i));
      }
    }
    round.stageMultipliers[i] = quantizeMultiplier(running * familyRules().cost);
    round.runningWin = round.stageMultipliers[i]! * round.initialBet;
    if (busted) {
      await revealWait(900, 150);
      break;
    }
  }

  await settleRound();
}

// Turn a book's event list into the on-screen reveal. Shared by a freshly
// placed bet (/wallet/play) and by replay, which reads an already-settled
// round instead of placing anything.

export async function animateRoundFromEvents(
  events: unknown,
  roundId: string,
  source: 'engine-auth' | 'engine-replay',
  emptyStateMessage: string,
) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error(emptyStateMessage);
  }

  const reveals = events.filter((event: any) => event.type === 'reveal');
  // As many reveals as the family deals: four on the four-guess ride, three
  // on Three of a Kind. A book with fewer is not a round of this mode.
  const expected = stageCount(familyRules());
  if (reveals.length < expected) {
    throw new Error(`Round did not contain all ${expected} reveal stages`);
  }

  round.revealEvents = reveals.map((event: any) => ({
    stage: event.stage,
    card: event.card as Card,
    choice: event.choice,
    correct: Boolean(event.correct),
    payout: event.payout,
  }));

  // The book's finalWin event carries the authoritative payout the RGS
  // settled (amount is the multiplier x100 - see math-sdk
  // src/events/events.py:final_win_event). Use it verbatim so the display
  // can't disagree with the credited balance.
  const finalWin = events.find((event: any) => event.type === 'finalWin') as any;
  round.engineFinalMultiplier = finalWin ? Number(finalWin.amount) / 100 : null;

  round.lastRoundId = roundId;
  round.source = source;
  resetForNewRound();
  await playRevealSequence();
}
