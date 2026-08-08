/**
 * How fast this game is allowed to talk to the RGS.
 *
 * Two pieces that only make sense together, which is why they live in one
 * module rather than beside the round flow: the floor decides how often a bet
 * may be sent, and the retry raises that floor when the RGS tells us it was
 * still too often. Both read and write the same `playFloorMs`, so keeping them
 * adjacent is the point - split across a 2,000-line component they read as two
 * unrelated helpers and the feedback loop between them is invisible.
 *
 * Deliberately module-scoped rather than per-component state: the limit belongs
 * to the SESSION, not to a mounted component, and it must survive any remount.
 */
import { RgsHttpError } from 'rgs-requests';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The floor on how often /wallet/play may be sent, INDEPENDENT of turbo.
 *
 * Turbo speeds up the card reveal, which is presentation - but at the fast end
 * a whole round can finish in a few hundred milliseconds, and every round is
 * one or two RGS calls. That is what earns a 429: the requests were paced by an
 * animation setting that was never meant to govern network traffic.
 *
 * Spacing the plays means the rate limit is never reached in the first place,
 * so an autoplay run does not have to survive being throttled - it simply is
 * not. The reveal still runs at whatever speed turbo asks for; only the gap
 * before the NEXT bet is held open.
 *
 * A manual player never notices: a normal-speed reveal already takes longer
 * than the floor, so the wait has elapsed before they can click again.
 */
export const MIN_PLAY_INTERVAL_MS = 900;

/** Raised if the RGS throttles us anyway - see withRateLimitRetry. */
let playFloorMs = MIN_PLAY_INTERVAL_MS;
let lastPlayAt = 0;

/** The spacing currently in force, for logging and tests. */
export const currentPlayFloorMs = () => playFloorMs;

/** Hold until enough time has passed since the last bet was sent. */
export async function throttlePlay(): Promise<void> {
  const elapsed = performance.now() - lastPlayAt;
  const remaining = playFloorMs - elapsed;
  if (remaining > 0) await wait(remaining);
  lastPlayAt = performance.now();
}

/**
 * Run an RGS call, waiting out a rate limit rather than failing the round.
 *
 * The RGS answers 429 when calls come too fast, and autoplay does exactly that:
 * two requests per round (play, and end-round on a win) with barely a pause
 * between rounds. A 429 used to surface as an unparseable body, get treated as
 * a fatal round error, and stop the run - so a long autoplay reliably died
 * partway through for a reason that was only ever temporary.
 *
 * Backs off exponentially and gives up after a few attempts, at which point the
 * caller's own error handling takes over. Only 429 is retried: a rejected bet
 * or an expired session will not improve by asking again.
 */
export async function withRateLimitRetry<T>(label: string, call: () => Promise<T>): Promise<T> {
  const ATTEMPTS = 4;
  let delay = 700;
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      const rateLimited = err instanceof RgsHttpError && err.isRateLimited;
      if (!rateLimited || attempt >= ATTEMPTS) throw err;
      // Being throttled at all means the floor is too low for whatever limit
      // this session is under, so raise it for the rest of the session. The run
      // then settles at a rate the RGS accepts instead of repeatedly walking
      // into the same wall.
      playFloorMs = Math.min(playFloorMs + 400, 4000);
      console.warn(
        `[RideTheBus] ${label} rate limited by the RGS; retrying in ${delay}ms ` +
          `(attempt ${attempt} of ${ATTEMPTS}, bet spacing now ${playFloorMs}ms)`,
      );
      await wait(delay);
      delay *= 2;
    }
  }
}
