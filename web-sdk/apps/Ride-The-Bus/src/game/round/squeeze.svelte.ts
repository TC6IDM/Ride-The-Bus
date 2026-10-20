/**
 * THE SQUEEZE (the owner's pick CL3, built 2026-10-20 with their notes): the
 * held last card comes out of its slot toward the player, and a corner peels
 * up to show the face underneath before the card turns over, shows itself and
 * goes back to the table. It replaced the card rising 1.5 units in place,
 * which the hold's audit found barely moved and said nothing.
 *
 *   OUT     the card leaves its slot for the front of the board, and nothing
 *           peels until it has arrived (the owner's note).
 *   PEEL    automatic by default: the BOTTOM-LEFT corner lifts along the
 *           diagonal, in a straight line, on the hum's own climb, then sits
 *           at the top - the owner's up, hold, slam. Or, with "Peel the last
 *           card myself" (peelSetting.svelte.ts), the player drags any
 *           corner; past PEEL_DONE_AT of the card it turns. Or uses SPACE: a
 *           tap plays the automatic peel through, a hold peels at its pace
 *           while held. Nothing turns it for them - no timer (the owner,
 *           2026-10-20: "just let the user do it").
 *   TURN    the corner drops, the card turns over where it is, holds its face
 *           for a beat, then goes HOME to its slot, where the board's own card
 *           takes over face up.
 *
 * A slam (the deal button, or Space, mid-round) ends whichever step is
 * running, and paceMs shortens the rest, so turbo and the slam behave as they
 * do for every other card. The reveal (roundReveal.svelte.ts) decides whether
 * a card is squeezed at all - only a held card, never under reduced motion -
 * and drives these steps; GameBoard draws them; cardFold.ts is the geometry.
 *
 * Nothing here knows whether the card lands. The peel shows the card that was
 * already dealt; the hold itself is still decided by the stake alone.
 */
import type { Card } from './roundContract';
import { autoPeelPoint, cardCorners, foldCard, type Fold, type Pt } from '../ui/cardFold';
import { paceMs, pacing } from './revealPacing.svelte';

/** The trip out of the slot, and back. */
export const SQUEEZE_OUT_MS = 420;
export const SQUEEZE_HOME_MS = 380;
/** The turn, and the beat the face is held in front before it goes home. */
export const SQUEEZE_TURN_MS = 440;
export const SQUEEZE_FACE_MS = 560;
/** How far the automatic peel reaches in along each edge, as a share of the card's width. */
export const AUTO_REACH = 0.45;
/** The share of the card a player must lift before it turns. */
export const PEEL_DONE_AT = 0.32;
/** How near a corner a press must land to take hold of it, as a share of the width. */
export const GRAB_RADIUS = 0.42;
/** A Space press shorter than this is a TAP: it plays the automatic peel through. */
export const SPACE_TAP_MS = 250;
/** A corner let go too early falls back flat over this long. */
const FALL_BACK_MS = 180;

const FLAT: Fold = { back: null, flap: null, lifted: 0 };

export const squeeze = $state({
  /** The slot being squeezed, or null. */
  index: null as number | null,
  /** The slot a squeezed card came home to: its own card is already face up
   *  there, so it must not turn a second time (GameBoard's instant-turn). */
  landed: null as number | null,
  card: null as Card | null,
  /** In front of the board (or on its way). */
  out: false,
  /** Face up. */
  turned: false,
  /** The room goes dark around it - the hold's tunnel, kept for Huge and up. */
  dark: false,
  /** The player peels it. */
  manual: false,
  /** Waiting for the player's hand. */
  grabbable: false,
  /** What it must be: a suit's name, or a rank (Three of a Kind). */
  need: '',
  needIsSuit: true,
  /** What it wins if it lands, in money, and whether that is "up to" (a ticket family). */
  wins: 0,
  upTo: false,
  fold: FLAT as Fold,
  /** The card's own size at rest, measured by GameBoard. */
  w: 0,
  h: 0,
  turnMs: SQUEEZE_TURN_MS,
  homeMs: SQUEEZE_HOME_MS,
});

/** Wait `ms`, or until a slam - whichever comes first. */
function waitOrSlam(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0 || pacing.slamRequested) {
      resolve();
      return;
    }
    const timer = setTimeout(finish, ms);
    let frame = requestAnimationFrame(watch);
    function watch() {
      if (pacing.slamRequested) finish();
      else frame = requestAnimationFrame(watch);
    }
    function finish() {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      resolve();
    }
  });
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Run `step(t)` for t in 0..1 over `ms`, ending early (at t = 1) on a slam. */
function tween(ms: number, step: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0) {
      step(1);
      resolve();
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = pacing.slamRequested ? 1 : Math.min(1, (now - start) / ms);
      step(t);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Who hears the fold move: the manual hum (sound.ts peelHum), which starts on
 * the first lift, follows it, and stops when the corner is down again. Told
 * the lifted share as a fraction of the line the card turns at.
 */
let onLift: ((share: number) => void) | null = null;
export function squeezeListen(listener: ((share: number) => void) | null) {
  onLift = listener;
}

/** `share` overrides the lifted share the listener hears: the automatic peel's
 *  own progress, which stops well short of PEEL_DONE_AT by design. */
function setFold(C: Pt, P: Pt, share?: number) {
  squeeze.fold = squeeze.w ? foldCard(squeeze.w, squeeze.h, C, P) : FLAT;
  onLift?.(share ?? squeeze.fold.lifted / PEEL_DONE_AT);
}

const autoCorner = (): Pt => [0, squeeze.h];
const autoPoint = (t: number) => autoPeelPoint(squeeze.h, squeeze.w * AUTO_REACH * t);

export type SqueezeOptions = {
  manual: boolean;
  dark: boolean;
  need: string;
  needIsSuit: boolean;
  wins: number;
  upTo: boolean;
};

/** Take the card out of its slot to the front, and resolve once it is there. */
export async function squeezeOut(index: number, card: Card, options: SqueezeOptions): Promise<void> {
  Object.assign(squeeze, { index, landed: null, card, out: false, turned: false, grabbable: false, fold: FLAT }, options);
  squeeze.turnMs = SQUEEZE_TURN_MS;
  squeeze.homeMs = SQUEEZE_HOME_MS;
  // Drawn on its slot first, then sent out, so the trip is a transition.
  await nextFrame();
  squeeze.out = true;
  await waitOrSlam(paceMs(SQUEEZE_OUT_MS, 0));
}

/**
 * The automatic squeeze: the bottom-left corner lifts over `climbMs` (the
 * hum's climb), then sits until `totalMs` has passed since it began - the
 * hold's own wait.
 */
export async function squeezePeel(climbMs: number, totalMs: number): Promise<void> {
  const started = performance.now();
  await tween(climbMs, (t) => setFold(autoCorner(), autoPoint(t)));
  await waitOrSlam(totalMs - (performance.now() - started));
}

let finishPeel: (() => void) | null = null;
let peelClimbMs = 1650;
let peelTopMs = 400;

/**
 * The manual squeeze: wait for the player - their hand on a corner, Space, or
 * a slam from the deal button. No timer turns it for them (the owner,
 * 2026-10-20). `climbMs` and `topMs` are the automatic peel's, which Space
 * plays.
 */
export async function squeezeWaitForPlayer(climbMs = 1650, topMs = 400): Promise<void> {
  peelClimbMs = Math.max(climbMs, 1);
  peelTopMs = topMs;
  squeeze.grabbable = true;
  await new Promise<void>((resolve) => {
    let frame = 0;
    const done = () => {
      cancelAnimationFrame(frame);
      finishPeel = null;
      resolve();
    };
    finishPeel = done;
    // The deal button still turns it at once (a slam).
    const watch = () => {
      if (pacing.slamRequested) done();
      else frame = requestAnimationFrame(watch);
    };
    frame = requestAnimationFrame(watch);
  });
  stopSpace();
  squeeze.grabbable = false;
}

/* ---- Space: the automatic peel, by the player's key ------------------------
   Down: the bottom-left corner lifts at the automatic peel's own pace. A TAP
   (released inside SPACE_TAP_MS) lets it run on - lift, hold at the top, turn
   - exactly the automatic squeeze. A HOLD peels only while the key is down:
   reaching the automatic peel's full reach, it holds its beat and turns; let
   go before that and the corner falls back flat, the hum with it. */
let space: { down: number; progress: number; frame: number; last: number } | null = null;

function stopSpace() {
  if (space) cancelAnimationFrame(space.frame);
  space = null;
}

/** Space went down during a manual squeeze. True if the squeeze took it. */
export function squeezeSpaceDown(): boolean {
  if (!squeeze.grabbable || !finishPeel) return false;
  if (space) return true;
  const now = performance.now();
  space = { down: now, progress: 0, frame: 0, last: now };
  const run = (at: number) => {
    if (!space || !finishPeel) return;
    const dt = at - space.last;
    space.last = at;
    // Space exists only while held, or after a tap that runs on: either way it climbs.
    space.progress = Math.min(1, space.progress + dt / peelClimbMs);
    setFold(autoCorner(), autoPoint(space.progress), space.progress);
    if (space.progress >= 1) {
      // At the top: its beat, then the turn - the automatic squeeze's own.
      const finish = finishPeel;
      stopSpace();
      setTimeout(() => finish?.(), peelTopMs);
      return;
    }
    space.frame = requestAnimationFrame(run);
  };
  space.frame = requestAnimationFrame(run);
  return true;
}

/** Space came up. A tap plays the peel through; a hold let go early falls back. */
export function squeezeSpaceUp(): boolean {
  if (!space) return false;
  // A tap: leave it running on to the top and the turn.
  if (performance.now() - space.down < SPACE_TAP_MS) return true;
  const from = space.progress;
  stopSpace();
  void tween(FALL_BACK_MS, (t) => setFold(autoCorner(), autoPoint(from * (1 - t)), from * (1 - t)));
  return true;
}

/** Turn it over where it is, hold the face, take it home. `onTurn` fires as it turns. */
export async function squeezeTurnAndHome(onTurn: () => void): Promise<void> {
  squeeze.fold = FLAT;
  squeeze.turnMs = paceMs(SQUEEZE_TURN_MS, 0);
  squeeze.homeMs = paceMs(SQUEEZE_HOME_MS, 0);
  squeeze.turned = true;
  onTurn();
  await waitOrSlam(squeeze.turnMs);
  await waitOrSlam(paceMs(SQUEEZE_FACE_MS, 0));
  squeeze.out = false;
  await waitOrSlam(squeeze.homeMs);
}

/** Gone: the board's own card has taken over, face up, in its slot. */
export function squeezeEnd() {
  Object.assign(squeeze, { landed: squeeze.index, index: null, card: null, out: false, turned: false, grabbable: false, fold: FLAT, dark: false });
}

/**
 * The player's hand, as a Svelte action on the squeezed card: press near any
 * corner and drag; past PEEL_DONE_AT the card turns, and a corner let go
 * sooner falls back flat.
 */
export function peelable(node: HTMLElement) {
  let corner: Pt | null = null;
  let last: Pt = [0, 0];
  const local = (event: PointerEvent): Pt => {
    const box = node.getBoundingClientRect();
    const scale = squeeze.w ? box.width / squeeze.w : 1;
    return [(event.clientX - box.left) / scale, (event.clientY - box.top) / scale];
  };
  const down = (event: PointerEvent) => {
    if (!squeeze.grabbable || !finishPeel || space) return;
    const at = local(event);
    const nearest = cardCorners(squeeze.w, squeeze.h).reduce((best, c) =>
      Math.hypot(at[0] - c[0], at[1] - c[1]) < Math.hypot(at[0] - best[0], at[1] - best[1]) ? c : best,
    );
    if (Math.hypot(at[0] - nearest[0], at[1] - nearest[1]) > squeeze.w * GRAB_RADIUS) return;
    corner = nearest;
    last = at;
    node.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const move = (event: PointerEvent) => {
    if (!corner || !finishPeel) return;
    last = local(event);
    setFold(corner, last);
    if (squeeze.fold.lifted >= PEEL_DONE_AT) {
      corner = null;
      finishPeel();
    }
  };
  const up = async () => {
    if (!corner) return;
    const from = last;
    const to = corner;
    corner = null;
    await tween(FALL_BACK_MS, (t) => setFold(to, [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]));
  };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  return {
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
    },
  };
}
