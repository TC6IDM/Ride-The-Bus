/**
 * How fast the reveal runs, and the one interruptible pause it runs on.
 *
 * Two knobs - the turbo slider and the slam flag - and everything that reads
 * them. They are together because they are the SAME knob at two ends: a slam
 * collapses every remaining pause to the instant end of the turbo scale rather
 * than inventing a second notion of "fast", which is what keeps a slammed
 * round from finishing faster than the fastest setting a player can choose.
 *
 * `pacing` is one $state object because an exported `let` cannot be reassigned
 * across a module boundary - the same shape as soundSettings.svelte.ts.
 *
 * The regulator's clamp on turboSpeed is NOT here. It is an $effect, and an
 * $effect only runs inside a component, so it stays in Game.svelte where it
 * can also close a barred popup. See jurisdictionRules.ts for the rule itself.
 */
import { sound } from '../audio/sound';

export const pacing = $state({
  /**
   * Turbo is a SPEED (0 = full-length reveal ... 1 = instant), set by the
   * turbo popup's slider. It scales the per-step reveal delays (paceMs) and
   * the card flip duration (--flip-dur) continuously.
   */
  turboSpeed: 0,
  /**
   * Tapping the button mid-reveal cuts the animation short and shows the
   * result now. Purely cosmetic: the outcome came from the book the moment
   * /wallet/play returned, so nothing here can change what is paid.
   */
  slamRequested: false,
});

// --- Slam stop -------------------------------------------------------------
// Tapping the button mid-reveal cuts the animation short and shows the result
// now. Purely cosmetic: the outcome came from the book the moment
// /wallet/play returned, so nothing here can change what is paid.


// Scale a delay by the turbo speed: 0 => full `normal`, 1 => `fast` (instant).
// Read at call time so moving the slider mid-reveal takes effect next step.
// A slam collapses every remaining pause to the instant end of the scale -
// exactly what turbo at maximum does, so it reuses that value rather than
// inventing a second notion of "fast".
export const paceMs = (normal: number, fast: number) =>
  pacing.slamRequested ? fast : Math.round(normal + (fast - normal) * pacing.turboSpeed);
/**
 * True when the cards do not land in sequence at all - the gap between them is
 * zero and the whole reveal resolves inside one frame. A slam, or turbo at
 * maximum, which the comment above notes collapse to the same value.
 *
 * Used to SPACE the per-card cues, not to suppress them. They were suppressed
 * at first, on the reasoning that ~24 voices on one millisecond would be ducked
 * by the limiter into a single mush. That was a theory about the mix that was
 * never checked by ear, and on the actual hardware it was plainly wrong in the
 * other direction: an instant round played the deal and then almost nothing,
 * so the faster you played the less game you got. A round that resolved
 * quickly still happened, and the player is still owed the sound of it.
 */
export const revealIsInstant = () => paceMs(650, 0) <= 0;

/**
 * How far apart to place the per-card cues when the reveal itself has no gaps.
 *
 * 60ms is playDeal's own riffle spacing, so an instant round comes out at the
 * cadence of a hand being dealt rather than as four separate events crushed
 * together. Everything still sounds; it is spread across ~180ms instead of
 * landing on one millisecond, which is the part the limiter actually objected
 * to. Scheduled through each cue's `lead`, so it is Web Audio doing the
 * spacing at sample accuracy rather than a chain of timers.
 */
const INSTANT_CUE_STAGGER = 0.06;
export const cueLead = (index: number) => (revealIsInstant() ? index * INSTANT_CUE_STAGGER : 0);

// Card flip duration (seconds) for the --flip-dur CSS var; shrinks to 0 as
// turbo approaches instant, and snaps to 0 on a slam.
export const flipDurSec = () =>
  pacing.slamRequested ? '0.000' : (0.5 * (1 - pacing.turboSpeed)).toFixed(3);

// The reveal gets its OWN interruptible wait. Deliberately not the shared
// wait(): that is also what holds the minimum-round-duration gate open, and a
// slam must never be able to shorten a regulator's floor.
//
// Takes the normal/fast PAIR rather than a finished duration, because a slam
// has to re-time a pause that is already running and that needs the instant
// figure for this particular step, not just how long was originally asked for.
let revealWaitTimer: ReturnType<typeof setTimeout> | null = null;
let revealWaitResolve: (() => void) | null = null;
let revealWaitFastMs = 0;
let revealWaitStartedAt = 0;

export const revealWait = (normalMs: number, fastMs: number) =>
  new Promise<void>((resolve) => {
    const ms = paceMs(normalMs, fastMs);
    if (ms <= 0) {
      resolve();
      return;
    }
    revealWaitFastMs = fastMs;
    revealWaitStartedAt = performance.now();
    revealWaitResolve = resolve;
    revealWaitTimer = setTimeout(() => {
      revealWaitTimer = null;
      revealWaitResolve = null;
      resolve();
    }, ms);
  });

/**
 * Bring the in-flight pause down to instant-turbo speed - no further.
 *
 * This used to resolve the pause outright, which made a slammed round finish
 * FASTER than the same round at maximum turbo: every later step already paces
 * itself at `fast` via paceMs, so cancelling the running one was the single
 * thing that pushed slam past the fastest setting a player can otherwise
 * choose. Rounds then arrived at the RGS closer together than any turbo
 * setting could produce them.
 *
 * Re-timing to `fast` measured from when the pause STARTED means a slam lands
 * exactly on the instant-turbo timeline. If that much time has already gone by
 * the step is simply due, so it resolves now.
 *
 * The bet spacing in rgsPacing.ts is what actually guarantees the RGS is never
 * outrun - it floors /wallet/play regardless of any of this. This keeps the
 * presentation honest about its own fastest setting rather than relying on
 * that floor to absorb it.
 */
export function collapseRevealWaitToInstant() {
  if (revealWaitTimer === null || revealWaitResolve === null) return;

  const settle = () => {
    revealWaitTimer = null;
    const resolve = revealWaitResolve;
    revealWaitResolve = null;
    resolve?.();
  };

  clearTimeout(revealWaitTimer);
  const remaining = revealWaitFastMs - (performance.now() - revealWaitStartedAt);
  if (remaining <= 0) {
    settle();
    return;
  }
  revealWaitTimer = setTimeout(settle, remaining);
}

// The turbo slider sounds its own position - pitch climbs to the right, falls
// to the left. Read off the event target rather than turboSpeed so it cannot
// depend on whether bind:value has been applied by the time this runs.
//
// Guarded on the value actually changing: a range input fires `input` for
// pointer movement inside the current step too, which without this retriggers
// the same note over and over while the thumb is merely being nudged.
let lastTurboTick = -1;

export function onTurboInput(event: Event) {
  const value = Number((event.currentTarget as HTMLInputElement).value);
  if (!Number.isFinite(value) || value === lastTurboTick) return;
  lastTurboTick = value;
  sound.playSliderTick(value);
}
