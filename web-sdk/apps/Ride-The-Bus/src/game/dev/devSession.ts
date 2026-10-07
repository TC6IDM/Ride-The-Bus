/**
 * DEV-ONLY: let the URL stand in for the /wallet/authenticate response.
 *
 * The sibling of devOverrides.ts, which does the same job for the jurisdiction
 * block and the dev_* flags. This one covers the things a real session learns
 * from the wallet: the currency, the balance, the opening bet and the three bet
 * limits. Lifted out of Game.svelte unchanged - it ran once at component init
 * and it still runs once, from the same place.
 *
 * The `!IS_PROD` guard that repeated on every branch inside the component is
 * now the CALLER'S, once, and the caller states it as `import.meta.env.DEV` so
 * Vite replaces it with a literal `false` and drops this module from the
 * production bundle entirely. That is stronger than the runtime check it
 * replaces: the RGS is the only thing that may set a currency, a balance or a
 * limit on a real session, and the submission checklist asks for exactly that.
 */
import { stateBet, stateConfig, stateUrlDerived } from 'state-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';

import { limitsAreUnknown } from '../bet/betLimits';

/**
 * Apply the dev stand-ins.
 *
 * Returns the `?bet=` seed, if there was one, because betInput is declared
 * after this ran and seeds itself from it - the one value the caller needs
 * back rather than reading off shared state.
 */
export function applyDevSession(): { startBet: number | null } {
  let startBet: number | null = null;

  // Local dev only: there's no real RGS session to report a balance, so
  // Set Bet always clamps to 0 without this. On the real site, Authenticate
  // populates stateBet.balanceAmount from the RGS - never override that.
  if (stateBet.balanceAmount === 0) {
    stateBet.balanceAmount = 1_000_000;
  }

  /**
   * Local dev only: let the URL stand in for the authenticate response.
   *
   * Replay already reads ?currency= and ?amount= (Authenticate.svelte's
   * handleReplay), but NORMAL play learns both from /wallet/authenticate, which
   * never runs locally - so there was no way to open the game in a currency
   * other than USD and actually play it. Testing a high-denomination currency
   * meant hand-editing the vendored SDK's defaults, which is easy to leave
   * behind by accident.
   *
   * None of this reaches a production build - see the guard described in this
   * module's header. That matters: the RGS is the only thing that may set a
   * currency, a balance or a limit on a real session, and the submission
   * checklist asks for exactly that.
   *
   *   ?currency=UGX      three letters, validated the same way replay does
   *   ?balance=500000000 display units
   *   ?bet=100000000     display units, the starting bet
   *   ?maxbet=100000000  display units, with ?minbet= and ?step=
   */
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const num = (key: string) => {
      const raw = params.get(key);
      if (raw === null) return null;
      const value = Number(raw);
      return Number.isFinite(value) && value > 0 ? value : null;
    };

    // Reuses the replay accessor rather than re-parsing: it already rejects
    // anything that is not three letters, which is what stops Intl throwing a
    // RangeError and taking every amount on screen down with it.
    const devCurrency = stateUrlDerived.currency();
    if (devCurrency) stateBet.currency = devCurrency;

    const devBalance = num('balance');
    if (devBalance !== null) stateBet.balanceAmount = devBalance;

    const devMax = num('maxbet');
    const devMin = num('minbet');
    const devStep = num('step');
    if (devMax !== null || devMin !== null || devStep !== null) {
      stateConfig.betLimits = {
        minBet: (devMin ?? 0.1) * API_AMOUNT_MULTIPLIER,
        maxBet: (devMax ?? 0) * API_AMOUNT_MULTIPLIER,
        stepBet: (devStep ?? devMin ?? 0.1) * API_AMOUNT_MULTIPLIER,
      };
      // The quick-bet chips come from the RGS too, and a rack that stops at
      // 1000 is useless next to a hundred-million cap. Spread ten levels across
      // the range on the same log-ish curve an operator would.
      if (devMax !== null) {
        const lo = devMin ?? 0.1;
        const steps = 9;
        stateConfig.betAmountOptions = Array.from({ length: steps + 1 }, (_, i) =>
          Number((lo * Math.pow(devMax / lo, i / steps)).toPrecision(2)),
        );
      }
    }

    const devBet = num('bet');
    if (devBet !== null) {
      stateBet.betAmount = devBet;
      // Handed back rather than written to shared state: betInput seeds itself
      // from this in its own initialiser, which runs after this does.
      startBet = devBet;
    }
  }

  // Local dev only: stand in for the minBet / maxBet / stepBet a real
  // authenticate response carries.
  //
  // Without these, stateConfig.betLimits is {0,0,0}, which every helper in
  // game/bet/betLimits.ts correctly reads as "unconstrained" - so the clamp, the
  // step snapping and the spin button's range check are all no-ops locally and
  // there is no way to see whether any of them works until the game is on a
  // real session. The clamp in particular is invisible: typing a million into
  // the bet field simply took it.
  //
  // Micro-units, as the RGS sends them. The figures are the shape of a real
  // small-currency configuration rather than a guess: a 0.10 floor, a 0.10
  // step, and a cap two thousand times the floor.
  if (limitsAreUnknown(stateConfig.betLimits)) {
    stateConfig.betLimits = { minBet: 100_000, maxBet: 200_000_000, stepBet: 100_000 };
  }

  return { startBet };
}
