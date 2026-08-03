<script lang="ts">
  import { base } from '$app/paths';
  import './app.css';
  // `ranks` is imported (rather than the order being retyped in the help text)
  // so the strip in How to Play can never drift from the order the game and
  // the math-sdk actually use.
  import { createRoundContract, rankValue, ranks, type Card } from '../game/roundContract';
  import { stateBet, stateUrlDerived, stateMeta, stateConfig, stateModal } from 'state-shared';
  import ErrorModal from './ErrorModal.svelte';
  // Of the five documented RGS endpoints this game uses three: authenticate
  // (via <Authenticate>), play and end-round. The other two are deliberately
  // not called, recorded here so the omissions read as decisions:
  //
  //   /bet/event   - tracks how far through a round the player has got, for
  //                  resuming after a disconnect. This round is atomic: all
  //                  four guesses are locked in before the bet, so there are no
  //                  in-round player actions to track, and the outcome is fixed
  //                  the moment /wallet/play returns. Reporting it would mean
  //                  one call per book event - five per round, so ~5,000 extra
  //                  requests across a 1,000-round autoplay - to buy a resume
  //                  that starts mid-reveal instead of replaying the round,
  //                  which is arguably worse to watch anyway.
  //
  //   /wallet/balance - "useful for periodic balance updates" (RGS.md). The
  //                  balance here is refreshed from every play and end-round
  //                  response, which covers every way this game can change it.
  //                  The SDK ships no helper for it at all, which is a fair
  //                  signal it is not expected of a game like this.
  import { requestBet, requestEndRound } from 'rgs-requests';
  import { sound, type PressKind } from '../game/sound';
  import { isCombinationPlayable } from '../game/modes';
  import { gameReady } from '../game/ready.svelte';
  import { jurisdiction, TURBO_CAP_WITHOUT_SUPER } from '../game/jurisdiction.svelte';
  // Payout maths and bet-grid arithmetic live in plain modules so they can be
  // unit-tested (src/game/*.test.ts) - payout.ts is checked against the real
  // published books, which is the only way to be sure the number shown here
  // matches the number the RGS credits.
  import {
    DECAY,
    STAGE_RETENTION,
    computeFinalMultiplier,
    partialMultiplier,
    quantizeMultiplier,
  } from '../game/payout';
  import { betDecimals, betWithinRange, snapBetToGrid, snapToStep } from '../game/betLimits';
  // Sourced from the shared config rather than retyped, so a displayed RTP can
  // never drift from the one the math is actually built and reweighted to.
  import gameConfig from '../game/config';
  import { t } from '../i18n/i18nDerived';
  import { currencyDecimals, numberToCurrencyString } from 'utils-shared/amount';
  import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';

  // Stake Engine requires every bet to be a single, independent, stateless
  // outcome - no continuation, no early cashout (Key Restrictions in Stake's
  // approval docs). So the player picks all 4 guesses up front; pressing
  // Start places ONE bet (mode encodes the full choice combination - see
  // math-sdk games/ride_the_bus/game_calculations.py:mode_name) that
  // resolves completely in a single /wallet/play call. Everything after
  // that is just animating the already-fully-determined result.

  type State = 'start' | 'playing' | 'lost' | 'won';
  type ColorChoice = 'red' | 'black' | null;
  type HigherLowerChoice = 'higher' | 'lower' | 'equal' | null;
  type InsideOutsideChoice = 'inside' | 'outside' | 'equal' | null;
  type SuitChoice = 'heart' | 'diamond' | 'club' | 'spade' | null;
  type RevealEvent = { stage: number; card: Card; choice: string; correct: boolean; payout: number };
  type Props = { roundSeed?: string };

  const fallbackRoundSeed = 'ride-the-bus-local-round';
  let { roundSeed = fallbackRoundSeed }: Props = $props();

  const IS_PROD = Boolean((import.meta as any).env?.PROD);

  // Payout model mirrors math-sdk games/ride_the_bus/game_calculations.py +
  // gamestate.py so a local-fallback round pays exactly what the real book
  // would for the same cards. A miss no longer zeroes the round: it banks
  // STAGE_RETENTION[stage] of what was earned so far (partial credit). Each
  // correct-guess multiplier is solved so the expected per-stage change is a
  // fixed constant DECAY for any probability (see partialMultiplier), so the
  // per-mode raw RTP tends to the same target regardless of the mode's odds.
  // NOTE: production then reweights each mode's book frequencies to pin RTP
  // to a flat 0.94 (reweight_luts.py). The local deck is drawn uniformly and
  // is NOT reweighted, so its long-run RTP differs from prod's (most for the
  // structurally-hard "inside" modes) - but any single hand pays identically,
  // which is what matters for local testing.
  // TARGET_RTP / DECAY / STAGE_RETENTION and the three multiplier functions now
  // live in game/payout.ts (imported above) so they can be unit-tested against
  // the published books.

  // Local dev only: there's no real RGS session to report a balance, so
  // Set Bet always clamps to 0 without this. On the real site, Authenticate
  // populates stateBet.balanceAmount from the RGS - never override that.
  if (!IS_PROD && stateBet.balanceAmount === 0) {
    stateBet.balanceAmount = 1_000_000;
  }

  // This game has no "BASE" bet mode - every one of its 64 modes encodes a
  // full guess combination (see math-sdk mode_name). The shared bet state
  // defaults activeBetModeKey to 'BASE', and the framework's bet-cost
  // helpers (stateBetDerived.betCostMultiplier -> activeBetMode().type)
  // dereference the looked-up mode without a null guard - so once the RGS
  // loads our modes, 'BASE' resolves to null and Set Bet / any cost check
  // throws "Cannot read properties of null (reading 'type')". Keep the active
  // key pointed at a mode that actually exists in betModeMeta. All our modes
  // cost 1.0x, so any is fine for cost purposes; the real per-round mode is
  // sent explicitly to /wallet/play in startGameEngineFlow.
  $effect(() => {
    const meta = stateMeta.betModeMeta ?? {};
    const key = stateBet.activeBetModeKey ?? '';
    const resolves = meta[key] || meta[key.toUpperCase?.()] || meta[key.toLowerCase?.()];
    if (!resolves) {
      const firstMode = Object.keys(meta)[0];
      if (firstMode) stateBet.activeBetModeKey = firstMode;
    }
  });

  // Local dev has no RGS to authenticate against, so Authenticate always fails
  // and posts an error modal. That's expected here - this game deliberately
  // falls back to a locally-generated round - and the modal would otherwise
  // cover the board on every load. Deliberately narrow: a production build, or
  // any real session, keeps the modal, because an auth failure there is
  // something the player genuinely needs to see.
  $effect(() => {
    if (IS_PROD || stateUrlDerived.sessionID()) return;
    if (stateModal.modal?.name === 'error') stateModal.modal = null;
  });

  let gameState = $state<State>('start');
  let isProcessing = $state(false);
  // The win readout stays hidden on the very first screen and appears once the
  // player has taken their first spin.
  let hasPlayed = $state(false);
  // Most recently settled round, shown in the "Last Win" readout on the control
  // bar. Kept separate from wonAmount so it survives the board resetting between
  // rounds (and during an auto run it shows the previous round while the next
  // one is still revealing).
  let lastWinAmount = $state(0);
  let lastWinMultiplier = $state(0);

  // Responsible-gambling session tracking, shown only when the jurisdiction
  // asks for it (displayNetPosition / displaySessionTimer).
  // Net position is cumulative payout minus cumulative stake for this session.
  let sessionNet = $state(0);
  let sessionSeconds = $state(0);
  $effect(() => {
    if (!jurisdiction.showSessionTimer()) return;
    const startedAt = Date.now();
    const id = setInterval(() => {
      sessionSeconds = Math.floor((Date.now() - startedAt) / 1000);
    }, 1000);
    return () => clearInterval(id);
  });
  const sessionClock = () => {
    const h = Math.floor(sessionSeconds / 3600);
    const m = Math.floor((sessionSeconds % 3600) / 60);
    const s = sessionSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  };

  let colorChoice = $state<ColorChoice>(null);
  let hlChoice = $state<HigherLowerChoice>(null);
  let ioChoice = $state<InsideOutsideChoice>(null);
  let suitChoice = $state<SuitChoice>(null);

  let revealEvents = $state<RevealEvent[]>([]);
  let revealedCards = $state<(Card | null)[]>([null, null, null, null]);
  let bustedIndex = $state<number | null>(null);
  // Cumulative (quantized) win multiplier shown above each card as it is
  // revealed - climbs while the streak holds, then shows the banked value on
  // the bust card. null = not revealed yet.
  let stageMultipliers = $state<(number | null)[]>([null, null, null, null]);
  // Running cash won so far (current multiplier x bet), shown under the cards.
  let runningWin = $state(0);
  // Set from the server's authoritative finalWin event on engine rounds so
  // the displayed win is exactly what the RGS credited (not a local recompute
  // that could drift by a floating-point hair). null => compute locally.
  let engineFinalMultiplier = $state<number | null>(null);

  let initialBet = $state(0);
  let betInput = $state('1');
  let wonAmount = $state(0);
  let lastRoundId = $state('');
  let roundSource = $state<'engine-auth' | 'engine-replay' | 'local-fallback' | 'none'>('local-fallback');
  let roundSequence = $state(0);
  let betDefaulted = $state(false);
  let betRowEl = $state<HTMLElement>();
  // Set true whenever an engine round fails to place/settle, so the auto loop
  // stops instead of hammering /wallet/play with the same failing request
  // (mirrors the SDK autobet resetting autoSpinsCounter to 0 on error).
  let roundError = $state(false);

  // Autoplay simply loops the SAME single-bet round a manual spin does - each
  // iteration is one independent /wallet/play (+ end-round on a win). Stake's
  // RGS has no server-side "auto" concept; this is a purely client-side
  // convenience, exactly like the SDK's autoBet machine
  // (createIntermediateMachineAutoBet.ts) which just counts down a run of
  // discrete bets and stops on 0 / insufficient funds / a Stop.
  //
  // Turbo is a SPEED (0 = full-length reveal ... 1 = instant), set by the
  // turbo popup's slider. It scales the per-step reveal delays (paceMs) and the
  // card flip duration (--flip-dur) continuously.
  let turboSpeed = $state(0);

  // The regulator can bar Turbo outright, or bar only its instant end
  // ("super turbo"). Clamp continuously rather than just at startup: the
  // jurisdiction block arrives with /wallet/authenticate, and this also
  // re-corrects if a stale value was restored from a previous session.
  $effect(() => {
    // The cap and the clamping rule live in game/jurisdictionRules.ts, so the
    // slider's max attribute below and this backstop can't disagree.
    const clamped = jurisdiction.clampTurbo(turboSpeed);
    if (clamped !== turboSpeed) turboSpeed = clamped;
    // A barred control must not sit open either.
    if (jurisdiction.turboDisabled() && openPopup === 'turbo') openPopup = null;
  });

  // Same for autoplay: bar the control, and stop any run already going.
  $effect(() => {
    if (!jurisdiction.autoplayDisabled()) return;
    if (openPopup === 'autospin') openPopup = null;
    if (autoRunning) stopAuto();
  });

  // Bottom control-bar UI: which popup (if any) is open, plus mute state.
  let openPopup = $state<null | 'bet' | 'turbo' | 'autospin' | 'advanced' | 'info'>(null);
  // Seeded from the persisted preference so mute survives a reload.
  let muted = $state(sound.isMuted());
  function toggleMuted() {
    muted = sound.toggleMuted();
    // Unmuting should be audible; also doubles as the user gesture that lets the
    // browser start the audio context.
    if (!muted) sound.playPress('toggle');
  }
  let autoRoundsInput = $state('10');
  let autoInfinite = $state(false);
  let autoRunning = $state(false);
  // Rounds still to play in the current auto run. Infinity when the player
  // picked the unlimited option (the run then ends only on Stop, an error, or
  // one of the stop conditions).
  let autoRemaining = $state(0);
  // A Stop press can't cancel a bet already placed on the server, so it just
  // asks the loop to stop BEFORE starting the next round (the in-flight round
  // finishes normally - this matches the documented single-bet RGS model).
  let autoStopRequested = $state(false);
  // Space-hold run: the auto loop keeps going only while the key is physically
  // held, so it has no round count (unlike a normal auto run). Mirrors the SDK's
  // own EnableSpaceHold component.
  let spaceHoldRunning = $state(false);
  // Spin-count presets for the Autoplay popup. These are exactly the SDK's own
  // AUTO_SPINS_TEXT_OPTIONS (state-shared/stateUi), infinity included - it is
  // rendered as a separate full-width cell below the eight numbers, using the
  // drawn lemniscate (iconInfinity) rather than the U+221E character.
  const AUTOSPIN_PRESETS = [10, 25, 50, 75, 100, 250, 500, 1000];
  // Fallback bet levels for the bet menu when no RGS session has supplied any
  // (local dev). On a real session stateConfig.betAmountOptions drives it.
  const DEFAULT_BET_LEVELS = [1, 5, 25, 50, 75, 100, 200, 500, 800, 1000];
  const betLevels = () => {
    const lv = stateConfig.betAmountOptions;
    return lv && lv.length ? [...lv].sort((a, b) => a - b) : DEFAULT_BET_LEVELS;
  };
  const autoRoundsValid = () =>
    autoInfinite || (Number.isFinite(Number(autoRoundsInput)) && Math.floor(Number(autoRoundsInput)) >= 1);
  // Stop the auto run the moment a round is won outright (all 4 cards correct,
  // no bust). A passive stop condition - it only ends the run, never changes
  // the stake - so it's safe to ship (unlike the gated Advanced progression).
  let stopOnFullWin = $state(false);

  // Advanced auto-bet strategy (Stake-style). When the Advanced switch is on:
  //  - On Win / On Loss adjust the next bet: 'reset' back to the starting bet,
  //    or 'increase' it by a percentage (100% = classic martingale double).
  //  - Stop on Profit / Stop on Loss end the run once the cumulative net result
  //    for this auto run crosses the given amount.
  // Win vs loss is decided by the round's NET result (payout vs the bet placed),
  // not just gameState - this game's partial credit means a "won" round can
  // still pay back less than the stake.
  //
  // COMPLIANCE GATE: the On Win / On Loss bet-progression (martingale) is NOT
  // part of the Stake Engine SDK's auto-bet, which keeps the stake constant and
  // only offers stop-limits (see packages/state-shared stateUi AUTO_SPINS /
  // LOSS_LIMIT / SINGLE_WIN_LIMIT). Auto-raising the bet on a loss is a
  // "chasing losses" mechanic that needs Stake's approval before it can ship,
  // so the Advanced switch is hard-disabled for now. Flip this to true (and
  // confirm with Stake) to re-enable the whole panel - all the logic below is
  // kept intact and gated on it.
  const ADVANCED_ENABLED = false;
  let advancedMode = $state(false);
  let onWinMode = $state<'reset' | 'increase'>('reset');
  let onLossMode = $state<'reset' | 'increase'>('reset');
  let onWinPct = $state('0');
  let onLossPct = $state('0');
  let stopOnProfit = $state('0');
  let stopOnLoss = $state('0');
  // Running net profit (payouts - stakes) for the active auto run; drives the
  // stop-on checks and the live readouts next to those fields.
  let autoProfit = $state(0);
  let autoBaseBet = $state(0);
  const toNum = (s: string) => {
    const n = Number(`${s ?? ''}`.trim());
    return Number.isFinite(n) ? n : 0;
  };

  // The bet is live now (no Set button): the input + / - drive it directly and
  // the Start button only enables when the amount is actually playable.
  const betValue = () => Number(betInput);
  const betIsValid = () => {
    const v = betValue();
    if (!(v > 0) || v > stateBet.balanceAmount) return false;
    // On a real session the RGS enforces minBet/maxBet, so check against those
    // rather than the min/max of betLevels - betLevels is a suggestion list and
    // need not span the full allowed range. Divisibility by stepBet is NOT
    // checked here: normalizeBet snaps the amount onto the grid at play time,
    // so an off-grid figure in the input is correctable, not invalid.
    // betWithinRange is a no-op when no limits are known, so this needs no
    // session gate either.
    return betWithinRange(v, stateConfig.betLimits, API_AMOUNT_MULTIPLIER);
  };

  // Keep the shared bet state in sync with the live input so "Current Bet" and
  // the play call always reflect what's shown.
  $effect(() => {
    const raw = `${betInput ?? ''}`.trim();
    const v = Number(raw);
    stateBet.betAmount = raw !== '' && !isNaN(v) && v >= 0 ? v : 0;
  });

  // Auto-fit the "$amount" font to its box so the whole number is always
  // visible, even a long maximum bet in a narrow sidebar - the currency symbol
  // and the number share one font-size (set on the row) and shrink together,
  // down to a floor, only as far as needed to avoid clipping. Re-runs on the
  // value changing and on the box resizing (responsive breakpoints / window).
  const MAX_BET_FONT = 20;
  const MIN_BET_FONT = 9;
  function fitBetFont() {
    const el = betRowEl;
    if (!el || typeof document === 'undefined') return;
    const text = betDisplay();
    // Start from the breakpoint's CSS font size (reset the inline override
    // first so we read the base), capped at MAX, then shrink to fit the width.
    el.style.fontSize = '';
    const style = getComputedStyle(el);
    const avail = el.clientWidth - 4; // small safety margin
    if (avail <= 0) return;
    const maxSize = Math.min(MAX_BET_FONT, Math.round(parseFloat(style.fontSize) || MAX_BET_FONT));
    const canvas = (fitBetFont as any)._c ?? ((fitBetFont as any)._c = document.createElement('canvas'));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let size = maxSize;
    for (; size > MIN_BET_FONT; size -= 1) {
      ctx.font = `800 ${size}px ${style.fontFamily}`;
      if (ctx.measureText(text).width <= avail) break;
    }
    el.style.fontSize = `${size}px`;
  }
  // Currency symbol for the raw bet-entry field. Everything else formats through
  // numberToCurrencyString, but that returns a formatted AMOUNT and this field
  // holds the player's own in-progress typing, so it needs just the symbol.
  // Hardcoding "$" showed a dollar sign to every non-USD player while the
  // balance beside it read in euro/yen.
  //
  // The two social-casino currencies are spelled out the same way the SDK's
  // formatter does (utils-shared/amount.ts NO_LOCALISATION_CURRENCY_MAP), since
  // Intl has no symbol for them.
  const SOCIAL_CURRENCY_LABELS: Record<string, string> = { XGC: 'GC', XSC: 'SC' };
  const currencySymbol = () => {
    const code = stateBet.currency || 'USD';
    if (code in SOCIAL_CURRENCY_LABELS) return SOCIAL_CURRENCY_LABELS[code];
    try {
      const parts = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
      }).formatToParts(0);
      return parts.find((p) => p.type === 'currency')?.value ?? code;
    } catch {
      // Unknown/!ISO code - Intl throws rather than degrading, and a bet field
      // with no prefix beats a crash.
      return code;
    }
  };
  const betDisplay = () => `${currencySymbol()}${`${betInput ?? ''}`.trim() || '0.00'}`;

  // When the field loses focus, snap the amount onto the operator's step grid
  // and tidy the decimals. Typing is left untouched while the field is focused.
  //
  // Snapping HERE rather than only at spin time is deliberate: the RGS rejects
  // an off-grid bet, so the amount has to change either way - doing it now means
  // the player sees what they will actually be staked while they can still
  // change their mind, instead of watching 1.37 become 1.30 after they commit.
  //
  // Range is not clamped here, only the grid: pulling 0.50 up to a 1.00 minimum
  // would stake them more than they asked. Out-of-range amounts stay visible and
  // betIsValid() refuses them, which the spin tooltip explains.
  function formatBetInput() {
    const raw = `${betInput ?? ''}`.trim();
    const v = Number(raw);
    if (raw === '' || isNaN(v) || v <= 0) return;
    const snapped = snapToStep(v, stateConfig.betLimits, API_AMOUNT_MULTIPLIER);
    betInput = snapped.toFixed(
      // The currency's own precision is the floor, not 2 - a yen bet field has
      // no decimals to offer.
      betDecimals(stateConfig.betLimits, API_AMOUNT_MULTIPLIER, currencyDecimals(stateBet.currency)),
    );
  }

  $effect(() => {
    betInput; // re-fit whenever the shown amount changes
    fitBetFont();
  });

  $effect(() => {
    const el = betRowEl;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fitBetFont());
    ro.observe(el);
    return () => ro.disconnect();
  });

  // Once (when the RGS's levels arrive) nudge an out-of-range starting bet to
  // the nearest valid level, so the player opens on a playable amount.
  $effect(() => {
    if (betDefaulted || !stateUrlDerived.sessionID()) return;
    const levels = stateConfig.betAmountOptions;
    if (levels && levels.length) {
      const v = Number(betInput);
      const lo = Math.min(...levels);
      const hi = Math.max(...levels);
      if (!(v >= lo && v <= hi)) {
        betInput = String(levels.reduce((best, l) => (Math.abs(l - v) < Math.abs(best - v) ? l : best), levels[0]));
      }
      betDefaulted = true;
    }
  });

  const allChoicesMade = () => Boolean(colorChoice && hlChoice && ioChoice && suitChoice);

  // --- The one impossible pairing --------------------------------------------
  // Stage 2 "equal" ties card 2 to card 1's rank, which leaves nothing strictly
  // between them for stage 3 "inside" to land on. The math does not publish that
  // combination (64 modes, not 72 - see game/modes.ts), so the client must not
  // offer it either: the mode string is built by concatenating the four choices,
  // and naming a mode that does not exist gets the bet rejected by the RGS.
  //
  // It survived this long because it is invisible locally - without a sessionID
  // and rgs_url the game deals from roundContract and never sends a mode at all.
  const insideIsPossible = () => isCombinationPlayable(hlChoice, 'inside');

  // --- Picking, and un-picking -----------------------------------------------
  // Every choice toggles: clicking the option already selected clears it. There
  // is no other way to undo a guess - the four groups have no "none" button -
  // so without this a misclick could only be corrected by choosing one of the
  // other options in that group, and never by changing your mind back to
  // undecided. Clearing any one choice disables Start, which is correct: the
  // bet mode needs all four.
  function toggle<T>(current: T | null, next: T): T | null {
    return current === next ? null : next;
  }

  // The turbo slider sounds its own position - pitch climbs to the right, falls
  // to the left. Read off the event target rather than turboSpeed so it cannot
  // depend on whether bind:value has been applied by the time this runs.
  //
  // Guarded on the value actually changing: a range input fires `input` for
  // pointer movement inside the current step too, which without this retriggers
  // the same note over and over while the thumb is merely being nudged.
  let lastTurboTick = -1;

  function onTurboInput(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(value) || value === lastTurboTick) return;
    lastTurboTick = value;
    sound.playSliderTick(value);
  }

  function setColorChoice(next: ColorChoice) {
    colorChoice = toggle(colorChoice, next);
  }

  function setSuitChoice(next: SuitChoice) {
    suitChoice = toggle(suitChoice, next);
  }

  function setIoChoice(next: InsideOutsideChoice) {
    ioChoice = toggle(ioChoice, next);
  }

  // Choosing Equal at stage 2 retires Inside at stage 3. If it was already
  // picked it is cleared rather than silently left selected-but-impossible,
  // which would leave the Start button enabled on a bet that cannot be placed.
  // Un-picking Equal makes Inside available again, which falls out of
  // insideIsPossible() reading hlChoice directly.
  function setHlChoice(next: HigherLowerChoice) {
    hlChoice = toggle(hlChoice, next);
    if (!isCombinationPlayable(hlChoice, ioChoice)) ioChoice = null;
  }
  const isEngineRound = () => roundSource !== 'local-fallback' && roundSource !== 'none';
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  // --- Slam stop -------------------------------------------------------------
  // Tapping the button mid-reveal cuts the animation short and shows the result
  // now. Purely cosmetic: the outcome came from the book the moment
  // /wallet/play returned, so nothing here can change what is paid.
  let slamRequested = $state(false);

  // The reveal gets its OWN interruptible wait. Deliberately not the shared
  // wait(): that is also what holds the minimum-round-duration gate open, and a
  // slam must never be able to shorten a regulator's floor.
  let revealWaitTimer: ReturnType<typeof setTimeout> | null = null;
  let revealWaitResolve: (() => void) | null = null;
  const revealWait = (ms: number) =>
    new Promise<void>((resolve) => {
      if (ms <= 0) {
        resolve();
        return;
      }
      revealWaitResolve = resolve;
      revealWaitTimer = setTimeout(() => {
        revealWaitTimer = null;
        revealWaitResolve = null;
        resolve();
      }, ms);
    });
  /** Resolve the reveal's in-flight pause immediately. */
  function cutShortRevealWait() {
    if (revealWaitTimer !== null) {
      clearTimeout(revealWaitTimer);
      revealWaitTimer = null;
    }
    const resolve = revealWaitResolve;
    revealWaitResolve = null;
    resolve?.();
  }
  // Scale a delay by the turbo speed: 0 => full `normal`, 1 => `fast` (instant).
  // Read at call time so moving the slider mid-reveal takes effect next step.
  // A slam collapses every remaining pause to the instant end of the scale -
  // exactly what turbo at maximum does, so it reuses that value rather than
  // inventing a second notion of "fast".
  const paceMs = (normal: number, fast: number) =>
    slamRequested ? fast : Math.round(normal + (fast - normal) * turboSpeed);
  // Card flip duration (seconds) for the --flip-dur CSS var; shrinks to 0 as
  // turbo approaches instant, and snaps to 0 on a slam.
  const flipDurSec = () => (slamRequested ? '0.000' : (0.5 * (1 - turboSpeed)).toFixed(3));

  const resolveRoundSeed = () => {
    if (roundSeed !== fallbackRoundSeed) {
      return { seed: roundSeed, source: 'engine-auth' as const };
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

    return { seed: fallbackRoundSeed, source: 'local-fallback' as const };
  };

  // Bring a raw bet into what the RGS will actually accept.
  //
  // Per the RGS spec ("Bet Levels") the predefined betLevels are only
  // *suggestions* - free-form amounts are allowed - but two rules are hard:
  // the bet must sit within [minBet, maxBet] AND be divisible by stepBet. So
  // we don't snap to a level (that needlessly turned 11 -> 10); we snap to the
  // operator's step grid, which keeps free typing while guaranteeing the bet
  // is one the RGS accepts. Without this, typing 1.37 against a 0.10 step is
  // rejected with ERR_VAL.
  //
  // All arithmetic is in the RGS's own micro-units (integers), because doing
  // it in decimal dollars drifts: 0.1 * 3 !== 0.3 in binary floating point,
  // and an off-by-one-micro-unit bet is exactly what ERR_VAL catches.
  function normalizeBet(value: number): number {
    // Keyed on whether limits are actually known rather than on the presence of
    // a session: snapBetToGrid falls back to cent-rounding when they are all
    // zero (local dev), and this way the dev_* URL overrides can exercise the
    // real grid logic without a live RGS.
    return snapBetToGrid(value, stateConfig.betLimits, API_AMOUNT_MULTIPLIER);
  }

  // Stake-style +/- stepper: step to the next / previous suggested bet level
  // (stateConfig.betAmountOptions) relative to whatever is currently shown, so
  // the increment scales sensibly across the range. It just rewrites the live
  // input - typing any amount still works. Falls back to +/-1 when no levels
  // are known (local dev before authenticate).
  function stepBet(direction: 1 | -1) {
    const shown = Number(betInput);
    const current = !isNaN(shown) && shown > 0 ? shown : stateBet.betAmount;
    const levels = stateConfig.betAmountOptions;
    if (levels && levels.length) {
      const sorted = [...levels].sort((a, b) => a - b);
      const next =
        direction > 0
          ? sorted.find((l) => l > current + 1e-9)
          : [...sorted].reverse().find((l) => l < current - 1e-9);
      if (next !== undefined) betInput = String(next);
    } else {
      betInput = String(Math.max(1, current + direction));
    }
  }

  async function playRevealSequence() {
    // Reveal one card at a time, stopping at the first miss - the round ends
    // where the player "gets off the bus". Unlike the old all-or-nothing
    // flow, a miss past stage 1 still banks partial winnings, so a bust is
    // no longer automatically a loss. `running` is kept RAW (unquantized) and
    // compounded exactly like computeFinalMultiplier / gamestate.run_spin; we
    // only quantize for the per-card display and the final payout, so the
    // last card's shown multiplier equals the credited win.
    // Each round starts un-slammed; the flag only lives for one reveal.
    slamRequested = false;
    let running = 1;
    let busted = false;
    for (let i = 0; i < revealEvents.length; i++) {
      await revealWait(paceMs(650, 0));
      revealedCards[i] = revealEvents[i].card;
      sound.playCardFlip();
      const event = revealEvents[i];
      if (!busted && event.correct) {
        running *= event.payout;
        sound.playStageWin(i);
      } else if (!busted) {
        bustedIndex = i;
        running *= STAGE_RETENTION[i] * DECAY ** (3 - i);
        busted = true;
        sound.playBust();
      }
      stageMultipliers[i] = quantizeMultiplier(running);
      runningWin = stageMultipliers[i]! * initialBet;
      if (busted) {
        await revealWait(paceMs(900, 150));
        break;
      }
    }

    await revealWait(paceMs(300, 120));
    // Prefer the server's authoritative payout on engine rounds; fall back to
    // the local formula (identical maths) when there's no RGS session.
    const multiplier = engineFinalMultiplier ?? computeFinalMultiplier(revealEvents);
    wonAmount = multiplier * initialBet;
    runningWin = wonAmount;
    if (stateUrlDerived.replay()) {
      // Replay is a read-only view of an already-settled round: nothing to
      // credit and nothing to close (the SDK's own end-round helper bails out on
      // replay too - createPrimaryMachines.ts:43).
    } else if (!isEngineRound()) {
      // Local-fallback has no server - credit the win locally.
      stateBet.balanceAmount += wonAmount;
    } else if (wonAmount > 0) {
      // A WINNING engine round must be settled with /wallet/end-round: this
      // credits the payout and closes the round. Without it the round stays
      // "active" and the NEXT /wallet/play is rejected with ERR_VAL - which is
      // exactly why the game blocked right after the first win. Losing rounds
      // (0 payout) auto-close on the RGS, so they need no end-round (that's
      // why consecutive losses kept working). Use the end-round balance as the
      // post-win source of truth.
      try {
        const endData = await requestEndRound({
          rgsUrl: stateUrlDerived.rgsUrl(),
          sessionID: stateUrlDerived.sessionID(),
        });
        if ((endData as any)?.balance?.amount !== undefined) {
          stateBet.balanceAmount = (endData as any).balance.amount / API_AMOUNT_MULTIPLIER;
        }
      } catch (err) {
        console.error('end-round failed', err);
      }
    }
    gameState = wonAmount > 0 ? 'won' : 'lost';
    // Record the settled result for the "Last Win" readout on the control bar.
    lastWinAmount = wonAmount;
    lastWinMultiplier = initialBet > 0 ? wonAmount / initialBet : 0;
    // Net position for this session: payout minus the stake actually placed.
    sessionNet = Math.round((sessionNet + (wonAmount - initialBet)) * 100) / 100;

    if (wonAmount <= 0) {
      sound.playRoundLoss();
    } else if (bustedIndex === null) {
      sound.playFullWin();
    } else {
      sound.playRoundWin();
    }
  }

  // Turn a book's event list into the on-screen reveal. Shared by a freshly
  // placed bet (/wallet/play) and by replay, which reads an already-settled
  // round instead of placing anything.
  async function animateRoundFromEvents(
    events: unknown,
    roundId: string,
    source: 'engine-auth' | 'engine-replay',
    emptyStateMessage: string,
  ) {
    if (!Array.isArray(events) || events.length === 0) {
      throw new Error(emptyStateMessage);
    }

    const reveals = events.filter((event: any) => event.type === 'reveal');
    if (reveals.length < 4) {
      throw new Error('Round did not contain all 4 reveal stages');
    }

    revealEvents = reveals.map((event: any) => ({
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
    engineFinalMultiplier = finalWin ? Number(finalWin.amount) / 100 : null;

    lastRoundId = roundId;
    roundSource = source;
    revealedCards = [null, null, null, null];
    stageMultipliers = [null, null, null, null];
    runningWin = 0;
    bustedIndex = null;
    wonAmount = 0;
    gameState = 'playing';
    await playRevealSequence();
  }

  // Replay (Stake's Fairness view, ?replay=true). Authenticate.svelte has
  // already fetched the settled round via /bet/replay and parked it in
  // stateBet.betToResume, so this must render THAT round - it must never place a
  // bet. Replaying used to fall through to startGameEngineFlow, which would have
  // called /wallet/play and charged the player for a brand new round.
  let replayStarted = false;
  $effect(() => {
    if (replayStarted || !stateUrlDerived.replay()) return;
    const bet = stateBet.betToResume as any;
    if (!bet?.state) return;
    replayStarted = true;

    // The replay URL carries the original stake, so the multipliers shown
    // resolve to the same cash amounts the player originally saw.
    initialBet = stateBet.wageredBetAmount || stateBet.betAmount || 0;
    hasPlayed = true;
    animateRoundFromEvents(
      bet.state,
      `${bet.roundID ?? stateUrlDerived.event()}`,
      'engine-replay',
      'Replay returned no round state for this event.',
    ).catch((err) => {
      console.error(err);
      stateModal.modal = { name: 'error', error: err };
    });
  });

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
  let resumeInProgress = $state(false);
  $effect(() => {
    if (resumeStarted || stateUrlDerived.replay()) return;
    const bet = stateBet.betToResume as any;
    if (!bet?.state || !bet.active) return;
    resumeStarted = true;
    resumeInProgress = true;

    // Put the guess squares back to the combination the round was bought with,
    // so the board the player returns to matches what they actually bet on.
    // The bet mode IS the four guesses (see math-sdk mode_name).
    const parts = String(bet.mode ?? '').split('_');
    if (parts.length === 4) {
      colorChoice = parts[0] as ColorChoice;
      hlChoice = parts[1] as HigherLowerChoice;
      ioChoice = parts[2] as InsideOutsideChoice;
      suitChoice = parts[3] as SuitChoice;
    }

    // Authenticate populates these from round.amount, so the multipliers
    // resolve to the cash the player actually staked.
    initialBet = stateBet.wageredBetAmount || stateBet.betAmount || 0;
    hasPlayed = true;
    animateRoundFromEvents(
      bet.state,
      `${bet.roundID ?? bet.betID ?? 'resumed'}`,
      'engine-auth',
      'Resumed round contained no state.',
    )
      .catch((err) => {
        // Don't trap the player on a broken resume - log it, mark the round
        // failed, and let the defensive end-round clear it on the next spin.
        console.error('resume failed', err);
        roundError = true;
      })
      .finally(() => {
        resumeInProgress = false;
      });
  });

  async function startGameEngineFlow(roundSeedData: { seed: string; source: 'engine-auth' | 'engine-replay' }) {
    isProcessing = true;
    try {
      // Defensively settle any round still open on this session before starting
      // a new one. A round left active (a win whose end-round didn't complete,
      // or one abandoned mid-reveal by a reload) makes the RGS reject the next
      // /wallet/play with ERR_VAL - which is why that error cleared on a page
      // refresh (a refresh starts a fresh session). Ending it here lets the
      // game self-heal on the next Start instead of needing a manual refresh.
      // Harmless when there's nothing open (the RGS just no-ops / errors, which
      // we swallow). This game is stateless, so there's never a round we want
      // to resume rather than close.
      try {
        await requestEndRound({
          rgsUrl: stateUrlDerived.rgsUrl(),
          sessionID: stateUrlDerived.sessionID(),
        });
      } catch {
        /* no open round to settle - fine */
      }

      const mode = `${colorChoice}_${hlChoice}_${ioChoice}_${suitChoice}`;
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
          initialBet,
          amountMicroUnits: initialBet * API_AMOUNT_MULTIPLIER,
          currency: stateBet.currency,
          balance: stateBet.balanceAmount,
          allowedBetLevels: stateConfig.betAmountOptions,
        });
      }
      const data = await requestBet({
        rgsUrl: stateUrlDerived.rgsUrl(),
        sessionID: stateUrlDerived.sessionID(),
        currency: stateBet.currency || 'USD',
        mode,
        amount: initialBet,
      });
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

      if (data?.balance?.amount !== undefined) {
        stateBet.balanceAmount = data.balance.amount / API_AMOUNT_MULTIPLIER;
      }

      await animateRoundFromEvents(
        data?.round?.state,
        `${data?.round?.roundID ?? ''}`,
        roundSeedData.source,
        `No round state from /wallet/play for mode "${mode}". The math for this mode may not be ` +
          `published/approved, or the bet amount isn't a valid level.`,
      );
    } catch (err) {
      console.error(err);
      roundError = true;
      // Surface through ErrorModal (mounted at the bottom of this
      // file) rather than a raw alert(), so a failed bet looks the same as the
      // auth/session errors the framework already reports. Only report once:
      // an auto run stops after this, so we don't stack a dialog per round.
      if (!autoRunning) {
        stateModal.modal = { name: 'error', error: err };
      }
    } finally {
      isProcessing = false;
    }
  }

  // Single-flight wrapper around playRound. A space-hold starts one round on
  // keydown and then, 400ms later, an auto loop - so without this the loop's
  // first iteration would place a second bet on top of the still-running tap
  // round. Callers that arrive mid-round get the in-flight promise instead,
  // which is exactly the "wait for it, then carry on" the auto loop wants.
  let roundInFlight: Promise<void> | null = null;
  // True while a settled round is being held open to satisfy the regulator's
  // minimum round duration. Feeds spinDisabled so the button stays dead.
  let roundGateHeld = $state(false);
  // 0..1 through the hold, drawn as a ring that fills clockwise around the
  // spin button so the wait reads as a countdown rather than a dead control.
  let cooldownProgress = $state(0);
  // The regulator's floor in seconds, for the tooltip. Trimmed so a whole
  // number reads "3" rather than "3.0".
  const cooldownSecondsLabel = () => {
    const s = jurisdiction.minimumRoundDurationMs() / 1000;
    return Number.isInteger(s) ? String(s) : s.toFixed(1);
  };
  function runRound(): Promise<void> {
    if (roundInFlight) return roundInFlight;
    const started = performance.now();
    roundInFlight = playRound()
      .then(async () => {
        // Enforce jurisdiction.minimumRoundDuration. Deliberately applied
        // AFTER the result is on screen rather than by slowing the reveal:
        // the rule exists so a player can register the outcome, so padding
        // the gap before the next spin is what it actually asks for. Covers
        // manual and autoplay alike, since the auto loop awaits runRound.
        const min = jurisdiction.minimumRoundDurationMs();
        if (min <= 0) return;
        const remaining = min - (performance.now() - started);
        if (remaining <= 0) return;
        roundGateHeld = true;
        cooldownProgress = 0;
        // Drive the ring off the clock rather than a CSS transition, so it
        // stays honest if the tab is throttled or the hold is cut short.
        const gateStart = performance.now();
        let raf = requestAnimationFrame(function tick() {
          cooldownProgress = Math.min(1, (performance.now() - gateStart) / remaining);
          if (cooldownProgress < 1) raf = requestAnimationFrame(tick);
        });
        try {
          await wait(remaining);
        } finally {
          cancelAnimationFrame(raf);
          cooldownProgress = 0;
          roundGateHeld = false;
        }
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
  async function playRound() {
    // The Start button is disabled unless these hold, but guard anyway.
    if (!betIsValid() || !allChoicesMade()) return;
    roundError = false;
    hasPlayed = true;

    // Normalize the live bet to what the RGS accepts (clamp to range, round to
    // the cent) at the moment of play.
    initialBet = normalizeBet(betValue());
    stateBet.betAmount = initialBet;
    betInput = String(initialBet);
    const roundSeedData = resolveRoundSeed();

    if (roundSeedData.source === 'engine-auth' || roundSeedData.source === 'engine-replay') {
      await startGameEngineFlow(roundSeedData);
      return;
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
    stateBet.balanceAmount -= initialBet;
    const { createRoundContract } = await import('../game/roundContract');
    const round = createRoundContract(`${roundSeedData.seed}:${roundSequence}`);
    roundSequence += 1;
    lastRoundId = round.roundId;
    roundSource = roundSeedData.source;
    revealEvents = buildLocalRevealEvents(round.deck);
    engineFinalMultiplier = null; // local round computes its own payout
    revealedCards = [null, null, null, null];
    stageMultipliers = [null, null, null, null];
    runningWin = 0;
    bustedIndex = null;
    wonAmount = 0;
    gameState = 'playing';
    await playRevealSequence();
  }

  // Auto play: loop the single-bet round with the player's locked-in guesses
  // until the round count runs out, the balance can't cover the next bet, an
  // engine round errors, or the player hits Stop.
  // `hold` = a space-hold run: it ignores the round count and instead runs for
  // as long as spaceHoldRunning stays true (i.e. the key is still down).
  async function startAuto({ hold = false } = {}) {
    // Barred outright by the regulator - covers the popup's Start, the
    // spacebar hold, and any future caller.
    if (jurisdiction.autoplayDisabled()) return;
    if (autoRunning || !betIsValid() || !allChoicesMade()) return;
    if (!hold && !autoRoundsValid()) return;
    autoStopRequested = false;
    autoRunning = true;
    spaceHoldRunning = hold;
    autoRemaining = hold ? 0 : autoInfinite ? Infinity : Math.floor(Number(autoRoundsInput));

    // Advanced strategy setup: the starting bet is the reset target, and the
    // net result is tracked so Stop on Profit / Stop on Loss can end the run.
    autoBaseBet = normalizeBet(betValue());
    autoProfit = 0;
    let nextBet = autoBaseBet;
    // Advanced strategy only applies when the feature is enabled AND switched on
    // (the switch is currently hard-disabled - see ADVANCED_ENABLED). This keeps
    // the stake constant, matching the SDK's own auto-bet.
    const useAdvanced = ADVANCED_ENABLED && advancedMode;
    const stopProfit = useAdvanced ? toNum(stopOnProfit) : 0;
    const stopLoss = useAdvanced ? toNum(stopOnLoss) : 0;

    try {
      while ((hold ? spaceHoldRunning : autoRemaining > 0) && !autoStopRequested) {
        // Bet this round's amount (advanced strategy may have grown / reset it).
        betInput = String(nextBet);
        // Stop if the next bet is no longer affordable (prod: server balance;
        // local: the debited fallback balance) - the same guard the SDK's
        // autobet uses (createIntermediateMachineAutoBet.ts:checkInsufficientFunds).
        if (betValue() > stateBet.balanceAmount + 1e-9) break;

        await runRound();
        // Bail on a placement/settlement error rather than repeating it, and
        // honour a Stop pressed during the round (the in-flight bet finished).
        if (roundError || autoStopRequested) break;

        // Tally this round's net result (payout minus the stake actually placed).
        const roundBet = initialBet;
        const won = wonAmount > roundBet;
        autoProfit = Math.round((autoProfit + (wonAmount - roundBet)) * 100) / 100;

        // Stop on a full game win (all 4 correct, no bust) if requested.
        if (stopOnFullWin && gameState === 'won' && bustedIndex === null) break;

        if (useAdvanced) {
          // End the run once a cumulative profit / loss target is hit.
          if (stopProfit > 0 && autoProfit >= stopProfit - 1e-9) break;
          if (stopLoss > 0 && -autoProfit >= stopLoss - 1e-9) break;
          // Set the next bet from the win/loss rule: reset to base, or grow the
          // current bet by the given % (100% = classic martingale double).
          const mode = won ? onWinMode : onLossMode;
          const pct = won ? toNum(onWinPct) : toNum(onLossPct);
          nextBet = mode === 'reset' ? autoBaseBet : nextBet * (1 + pct / 100);
          nextBet = Math.round(Math.max(0, nextBet) * 100) / 100;
          if (!(nextBet > 0)) nextBet = autoBaseBet;
        }

        if (hold) {
          // Released mid-round: finish here rather than starting another bet.
          if (!spaceHoldRunning) break;
        } else if (!autoInfinite) {
          autoRemaining -= 1;
          if (autoRemaining <= 0) break;
        }
        // Let the just-finished result sit briefly before the board clears.
        await wait(paceMs(750, 200));
      }
    } finally {
      autoRunning = false;
      spaceHoldRunning = false;
      autoRemaining = 0;
      // Restore the input to the starting bet so the sidebar doesn't keep the
      // last (possibly grown) strategy amount after the run ends.
      betInput = String(autoBaseBet);
      // Deliberately DON'T reset the board here: when the run ends (count
      // exhausted or Stop pressed) the final round stays on screen with its
      // revealed cards and win, exactly like a manual round does. The next
      // spin clears it (playRound resets the board itself).
    }
  }

  function stopAuto() {
    // Can't cancel a bet already on the server, so just ask the loop to stop
    // before the next round; the current round plays out.
    autoStopRequested = true;
  }

  function setAutoRounds(n: number) {
    autoInfinite = false;
    autoRoundsInput = String(n);
  }
  function toggleAutoInfinite() {
    autoInfinite = !autoInfinite;
  }
  function stepAutoRounds(direction: 1 | -1) {
    // Stepping is a count action, so it drops out of unlimited.
    autoInfinite = false;
    const current = Math.floor(Number(autoRoundsInput));
    const base = Number.isFinite(current) && current >= 1 ? current : 1;
    autoRoundsInput = String(Math.max(1, base + direction));
  }
  function formatAutoRounds() {
    const n = Math.floor(Number(autoRoundsInput));
    autoRoundsInput = Number.isFinite(n) && n >= 1 ? String(n) : '1';
  }

  // --- Bottom control-bar handlers ---
  function togglePopup(name: 'bet' | 'turbo' | 'autospin' | 'advanced' | 'info') {
    openPopup = openPopup === name ? null : name;
  }
  // The big spin button: acts as Stop while an auto run is live, otherwise
  // plays exactly one round. Disabled (greyed) until a bet + all 4 guesses are
  // valid.
  // Can the button cut the current reveal short right now?
  //
  // Not offered during an auto run: there the button is Stop, and overloading a
  // single control with "skip this round" and "end the whole run" would make
  // the destructive one easy to hit by accident. Not offered in replay either,
  // which is a read-only view.
  const canSlam = () =>
    gameState === 'playing' &&
    !slamRequested &&
    !autoRunning &&
    !jurisdiction.slamstopDisabled() &&
    !stateUrlDerived.replay();

  const spinDisabled = () =>
    autoRunning
      ? false
      : canSlam()
        ? false // it is a Skip button for the duration of the reveal
        : gameState === 'playing' ||
        isProcessing ||
        // An interrupted round is being replayed onto the board - the player
        // must not be able to buy a new one on top of it.
        resumeInProgress ||
        // Held open to satisfy the regulator's minimum round duration.
        roundGateHeld ||
        // Replay is a read-only view of a past round - never let it bet.
        stateUrlDerived.replay() ||
        !betIsValid() ||
        !allChoicesMade() ||
        (IS_PROD && resolveRoundSeed().source === 'none');

  // Why the spin button is dead right now, or null when it's live. Shown as a
  // tooltip on hovering the wrapper, so a greyed button always explains itself
  // instead of leaving the player guessing.
  //
  // Deliberately mirrors spinDisabled()'s conditions in the same order, so the
  // two can't disagree - a disabled button with no reason (or a reason on a
  // live button) would be worse than no tooltip at all. Ordered most-specific
  // first: transient states before "you haven't finished setting up".
  function spinBlockedReason(): string | null {
    if (autoRunning) return null; // it's a Stop button; always live
    // Mid-reveal but slammable: the button is live as Skip, so there is no
    // blocked reason to explain. Without this it claimed "Round in progress"
    // over an enabled button.
    if (canSlam()) return null;
    if (stateUrlDerived.replay()) return t('Replay is view-only');
    if (roundGateHeld) {
      return t('Spins must be %s seconds apart').replace('%s', cooldownSecondsLabel());
    }
    if (gameState === 'playing' || isProcessing || resumeInProgress) return t('Round in progress');
    if (!allChoicesMade()) return t('Pick all 4 guesses');
    if (!betIsValid()) return t('Enter a valid bet');
    if (IS_PROD && resolveRoundSeed().source === 'none') return t('No active game session');
    return null;
  }

  function onSpin() {
    // No playPress() here - the delegated click listener below already sounds
    // every button. The spacebar path, which isn't a click, sounds its own.
    if (autoRunning) { stopAuto(); return; }
    // Mid-reveal: cut the animation short rather than starting a new round.
    // cutShortRevealWait() resolves the pause already in flight, so the skip is
    // immediate instead of waiting out the current step.
    if (canSlam()) {
      slamRequested = true;
      cutShortRevealWait();
      return;
    }
    if (spinDisabled()) return;
    runRound().catch((err) => console.error('Play failed', err));
  }
  // Bet menu: choose a preset level then close.
  function setBetLevel(v: number) {
    betInput = String(v);
    openPopup = null;
  }
  // Autoplay popup Start: close it and kick off the run.
  function startAutoFromPopup() {
    if (!betIsValid() || !allChoicesMade() || !autoRoundsValid()) return;
    openPopup = null;
    startAuto();
  }

  // --- Spacebar: tap to spin, hold to keep spinning -------------------------
  // Same shape as the SDK's EnableSpaceHold / OnHotkey pair: keydown spins once
  // immediately, and if the key is still down after HOLD_MS the run continues
  // until it is released. The hold run is bounded by the key being physically
  // held, so it is not an unattended unlimited autoplay.
  const SPACE_HOLD_MS = 400;
  let spaceDown = false;
  let spaceHoldTimer: ReturnType<typeof setTimeout> | null = null;

  // Don't hijack Space while the player is typing a bet / round count, or
  // operating a focused button (Space is that button's own activation key).
  function spaceIsForUs(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el) return true;
    if (el.isContentEditable) return false;
    return !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.code !== 'Space' && event.key !== ' ') return;
    // Regulator has barred the shortcut - leave Space to the browser.
    if (jurisdiction.spacebarDisabled()) return;
    if (!spaceIsForUs(event.target)) return;
    // Space scrolls the page by default.
    event.preventDefault();
    // Held keys auto-repeat; only the first keydown counts.
    if (event.repeat || spaceDown) return;
    spaceDown = true;

    // A live auto run treats Space like the Stop button.
    if (autoRunning) { sound.playPress('primary'); onSpin(); return; }
    if (spinDisabled()) return;

    // Keyboard activation isn't a click, so it never reaches the delegated
    // handler - sound it here, as the primary control Space stands in for.
    sound.playPress('primary');
    onSpin(); // the tap: one round, straight away
    spaceHoldTimer = setTimeout(() => {
      spaceHoldTimer = null;
      // Still held, and the tap's round is done or nearly so - keep going.
      if (spaceDown && !autoRunning) startAuto({ hold: true });
    }, SPACE_HOLD_MS);
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.code !== 'Space' && event.key !== ' ') return;
    releaseSpace();
  }

  function releaseSpace() {
    spaceDown = false;
    if (spaceHoldTimer !== null) {
      clearTimeout(spaceHoldTimer);
      spaceHoldTimer = null;
    }
    // Ends the hold run after the in-flight round settles (a placed bet can't
    // be cancelled).
    spaceHoldRunning = false;
  }

  // DEV ONLY: let ?dev_* query params stand in for the RGS config, so the
  // jurisdiction rules and bet grid can be exercised on localhost where there
  // is no /wallet/authenticate. Written as an `import.meta.env.DEV` literal so
  // Vite drops the whole thing - and devOverrides itself - from a production
  // build.
  if (import.meta.env.DEV) {
    $effect(() => {
      void import('../game/devOverrides').then(({ applyDevOverrides }) => {
        const applied = applyDevOverrides(window.location.search);
        if (applied.length) console.log('[RideTheBus] dev overrides:', applied.join(', '));
      });
    });
  }

  // Tell the loader the board is actually on screen. It sits outside this
  // component's tree (see game/ready.svelte.ts), and clearing on a timer alone
  // left a gap of empty screen while <Authenticate> was still resolving.
  $effect(() => {
    gameReady.value = true;
  });

  // --- Click sound on every button ------------------------------------------
  // Delegated rather than a sound.playPress() in each of the ~40 onclick
  // handlers: one place to change, nothing to forget, and buttons added later
  // are covered for free. Capture phase so the cue fires before the handler
  // runs - notably the mute button, which should still be audible as it mutes.
  //
  // The kind is read off the button's own class, because all 34 of them sharing
  // one identical click was the single most mechanical thing about the audio.
  // Committing to a guess, nudging the bet and closing a popup are different
  // sorts of action and now sound like it. Anything unrecognised falls through
  // to 'soft', so a button added later is still covered - just generically.
  // Which guess column a button sits in: 0 colour, 1 higher/lower, 2 inside/
  // outside, 3 suit. The press cue climbs a whole tone per column, so the row
  // is audibly a sequence rather than four interchangeable taps. -1 for
  // anything outside the guess row, where the stage means nothing.
  const CHOICE_SQUARES = ['.color-square', '.hl-square', '.io-square', '.suit-square'];

  function choiceStageFor(el: HTMLElement): number {
    return CHOICE_SQUARES.findIndex((selector) => el.closest(selector));
  }

  function pressKindFor(el: HTMLElement): PressKind {
    // Checked before the halves and thirds, because an equal badge overlaps
    // them and is the more specific match.
    if (el.closest('.equal-btn')) return 'equal';
    if (el.closest('.half-btn, .third-btn, .quad-btn')) return 'choice';
    if (el.closest('.cb-step, .stepper-btn, .bet-cell, .cb-bet-display')) return 'chip';
    if (el.closest('.cb-spin, .cb-round, .cb-float, .popup-start')) return 'primary';
    if (el.closest('.switch, .cb-icon')) return 'toggle';
    return 'soft';
  }

  function onDocumentClick(event: MouseEvent) {
    const el = (event.target as HTMLElement | null)?.closest?.('button');
    // Disabled buttons don't dispatch clicks at all, but a click landing on a
    // child of one can still bubble here, and a dead control shouldn't sound.
    if (!el || (el as HTMLButtonElement).disabled) return;
    const target = el as HTMLElement;
    sound.playPress(pressKindFor(target), Math.max(0, choiceStageFor(target)));
  }

  $effect(() => {
    document.addEventListener('click', onDocumentClick, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    // A lost focus / hidden tab never delivers the keyup, which would otherwise
    // leave the hold run going with nobody holding anything.
    window.addEventListener('blur', releaseSpace);
    return () => {
      document.removeEventListener('click', onDocumentClick, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseSpace);
      releaseSpace();
    };
  });




  function localColorPayouts(remaining: Card[]) {
    const total = remaining.length;
    const red = remaining.filter((card) => card.suit === '♥' || card.suit === '♦').length;
    const black = total - red;
    return { red: partialMultiplier(red / total, 0), black: partialMultiplier(black / total, 0) };
  }

  function localHigherLowerPayouts(remaining: Card[], ref: number) {
    const total = remaining.length;
    const higher = remaining.filter((card) => rankValue[card.rank] > ref).length;
    const lower = remaining.filter((card) => rankValue[card.rank] < ref).length;
    const equal = total - higher - lower;
    return {
      higher: partialMultiplier(higher / total, 1),
      lower: partialMultiplier(lower / total, 1),
      equal: partialMultiplier(equal / total, 1),
    };
  }

  function localInsideOutsidePayouts(remaining: Card[], a: number, b: number) {
    const total = remaining.length;
    const minVal = Math.min(a, b);
    const maxVal = Math.max(a, b);
    const inside = remaining.filter((card) => rankValue[card.rank] > minVal && rankValue[card.rank] < maxVal).length;
    const outside = remaining.filter((card) => rankValue[card.rank] < minVal || rankValue[card.rank] > maxVal).length;
    const equal = total - inside - outside;
    return {
      inside: partialMultiplier(inside / total, 2),
      outside: partialMultiplier(outside / total, 2),
      equal: partialMultiplier(equal / total, 2),
    };
  }

  function localSuitPayouts(remaining: Card[]) {
    const total = remaining.length;
    const counts = { heart: 0, diamond: 0, club: 0, spade: 0 };
    for (const card of remaining) {
      if (card.suit === '♥') counts.heart += 1;
      else if (card.suit === '♦') counts.diamond += 1;
      else if (card.suit === '♣') counts.club += 1;
      else counts.spade += 1;
    }
    return {
      heart: partialMultiplier(counts.heart / total, 3),
      diamond: partialMultiplier(counts.diamond / total, 3),
      club: partialMultiplier(counts.club / total, 3),
      spade: partialMultiplier(counts.spade / total, 3),
    };
  }

  const SUIT_NAME_MAP: Record<string, string> = { '♥': 'heart', '♦': 'diamond', '♣': 'club', '♠': 'spade' };

  function isCorrectGuess(stageIndex: number, choice: string, card: Card, ranks: number[]): boolean {
    const value = rankValue[card.rank];
    if (stageIndex === 0) {
      const color = card.suit === '♥' || card.suit === '♦' ? 'red' : 'black';
      return choice === color;
    }
    if (stageIndex === 1) {
      const ref = ranks[0];
      if (value === ref) return choice === 'equal';
      return choice === (value > ref ? 'higher' : 'lower');
    }
    if (stageIndex === 2) {
      const minVal = Math.min(ranks[0], ranks[1]);
      const maxVal = Math.max(ranks[0], ranks[1]);
      if (value === minVal || value === maxVal) return choice === 'equal';
      return choice === (value > minVal && value < maxVal ? 'inside' : 'outside');
    }
    return choice === SUIT_NAME_MAP[card.suit];
  }

  // Mirrors games/ride_the_bus/gamestate.py:run_spin - draws the same 4
  // cards from a deterministic local deck and resolves them against the
  // player's pre-selected choices, exactly like the real math-sdk book does.
  function buildLocalRevealEvents(deck: Card[]): RevealEvent[] {
    const drawn = deck.slice(0, 4);
    const ranks = drawn.map((card) => rankValue[card.rank]);
    const choices = [colorChoice as string, hlChoice as string, ioChoice as string, suitChoice as string];
    const stagePayouts = [
      localColorPayouts(deck.slice(0)),
      localHigherLowerPayouts(deck.slice(1), ranks[0]),
      localInsideOutsidePayouts(deck.slice(2), ranks[0], ranks[1]),
      localSuitPayouts(deck.slice(3)),
    ] as Record<string, number>[];

    return drawn.map((card, index) => {
      const choice = choices[index];
      return {
        stage: index + 1,
        card,
        choice,
        correct: isCorrectGuess(index, choice, card, ranks),
        payout: stagePayouts[index][choice],
      };
    });
  }

</script>

<!-- The backdrop is drawn in CSS, always. There used to be a second path here
     that painted a 1.9 MB bitmap instead, selected by a BACKDROP constant in
     game/backdrop.ts; both the switch and the image are gone. -->
<div
  class="game-layout"
  style={`--flip-dur: ${flipDurSec()}s; --logo-url: url(${base}/logo.png)`}
>
  <!-- Custom glyphs, drawn rather than typed. The Unicode arrows and infinity
       sign vary a lot between platform fonts (weight, size, whether the glyph
       exists at all), so these are inline SVG instead: identical everywhere,
       sized from --ui, and inheriting currentColor. Decorative - every button
       using them carries its own aria-label. -->

  <!-- Inside: the card lands BETWEEN the two bounds, so the arrows converge. -->
  {#snippet iconInside()}
    <svg class="io-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2.6 5v14" />
      <path d="M21.4 5v14" />
      <path d="M6 12h4.4" />
      <path d="M8.2 9.6 10.6 12l-2.4 2.4" />
      <path d="M18 12h-4.4" />
      <path d="M15.8 9.6 13.4 12l2.4 2.4" />
    </svg>
  {/snippet}

  <!-- Outside: the card lands BEYOND the bounds, so the arrows diverge. Same
       parts as Inside, mirrored - the pair has to read as opposites. -->
  {#snippet iconOutside()}
    <svg class="io-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M10.2 5v14" />
      <path d="M13.8 5v14" />
      <path d="M7.6 12H3.2" />
      <path d="M5.4 9.6 3 12l2.4 2.4" />
      <path d="M16.4 12h4.4" />
      <path d="M18.6 9.6 21 12l-2.4 2.4" />
    </svg>
  {/snippet}

  <!-- Lemniscate: two symmetric loops crossing at the centre. The viewBox hugs
       the drawing (2:1) rather than padding it into a square, so the CSS width
       maps straight onto the glyph's real size and it can be weighted against
       adjacent numerals. -->
  {#snippet iconInfinity()}
    <svg class="inf-icon" viewBox="0 0 24 12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path
        d="M12 6C10.5 3.6 8.7 2 6.6 2 4.1 2 2.6 3.8 2.6 6s1.5 4 4 4c2.1 0 3.9-1.6 5.4-4 1.5-2.4 3.3-4 5.4-4 2.5 0 4 1.8 4 4s-1.5 4-4 4c-2.1 0-3.9-1.6-5.4-4Z"
      />
    </svg>
  {/snippet}

  <!-- Stepper chevrons. The viewBox hugs the stroke (no padding) so the CSS
       height IS the glyph height - the typed triangles they replace filled only
       39% of their 31px button, which read timid for the hit area. -->
  {#snippet iconChevronUp()}
    <svg class="step-icon" viewBox="0 0 24 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2.5 9.5 12 2.5l9.5 7" />
    </svg>
  {/snippet}
  {#snippet iconChevronDown()}
    <svg class="step-icon" viewBox="0 0 24 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M2.5 2.5 12 9.5l9.5-7" />
    </svg>
  {/snippet}

  <!-- Higher / Lower. Solid triangles, matching the typed U+25B2/U+25BC they
       replace - a filled wedge reads as a value direction where the stepper's
       open chevron reads as a nudge, so the two stay deliberately different. -->
  {#snippet iconTriangleUp()}
    <svg class="hl-icon" viewBox="0 0 24 20" fill="currentColor" aria-hidden="true">
      <path d="M12 1.6 23 18.4H1Z" />
    </svg>
  {/snippet}
  {#snippet iconTriangleDown()}
    <svg class="hl-icon" viewBox="0 0 24 20" fill="currentColor" aria-hidden="true">
      <path d="M12 18.4 1 1.6h22Z" />
    </svg>
  {/snippet}

  <!-- The "=" pick. Typed, its ink sat 2px low in an 18px button (the glyph
       rides the font's math axis, not the line box's centre, so flex centring
       cannot fix it). Drawn, the two bars are centred by construction. -->
  {#snippet iconEquals()}
    <svg class="eq-icon" viewBox="0 0 24 12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
      <path d="M3 3.5h18" />
      <path d="M3 8.5h18" />
    </svg>
  {/snippet}

  <!-- Bet nudge +/-, drawn to match rather than typed as "+" and U+2212. -->
  {#snippet iconPlus()}
    <svg class="step-icon step-icon-sq" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
      <path d="M12 4.5v15" />
      <path d="M4.5 12h15" />
    </svg>
  {/snippet}
  {#snippet iconMinus()}
    <svg class="step-icon step-icon-sq" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
      <path d="M4.5 12h15" />
    </svg>
  {/snippet}

  <!-- One chip, or a pile of them. Each chip in a stack is its own disc rather
       than one tall drum with lines ruled across it: the boundary between two
       stacked chips is a circle seen at the table's angle, so it has to be an
       arc. Drawn as straight seams the stack read as a striped can. Every disc
       is the same capsule, offset by one chip's thickness, and the one above
       covers all of the one below except its front edge. -->
  {#snippet chipStack(colour: string, place: string, stack: number)}
    <div class="prop chip {colour} {place}" style="--stack: {stack}">
      <div class="chip-shadow"></div>
      {#each Array(stack) as _, i (i)}
        <div class="chip-disc" style="--i: {i}"></div>
      {/each}
      <div class="chip-top"></div>
    </div>
  {/snippet}

  <!-- Drawn entirely in CSS (see styles/table.css). Purely decorative, and
       every prop is placed out toward the table's rim so the middle stays
       clear for the cards and guesses. -->
  <!-- Each prop is built from separate top / side / shadow layers rather than
       one flat shape, because the volume is what sells the scene: a chip is a
       cylinder (elliptical top + side wall), the table has a real edge, and
       everything casts to the lower-left from a light at the upper right. -->
  <div class="scene" aria-hidden="true">
    <div class="table">
      <div class="table-edge"></div>
      <div class="table-surface">
        <!-- The bullnose rim, lit right round the table's perimeter. -->
        <div class="table-rim"></div>

        <!-- The deck, top left: the same brand-red back, chrome edge and
             Takeover chip mark as the four dealt cards (styles/cards.css), so
             the cards visibly come from it. -->
        <div class="prop deck p-deck">
          <div class="deck-shadow"></div>
          <div class="deck-stack"></div>
          <div class="deck-face"></div>
        </div>

        <!-- A party cup either side - it is a drinking game, and a pair reads
             as two people sitting at the table. The left one is further down
             its drink so they are not the same object twice. -->
        <div class="prop cup p-cup-1">
          <div class="cup-shadow"></div>
          <div class="cup-body">
            <!-- The three stepped ribs below the lip and the roll above the
                 base, which is what makes a party cup that shape and not a
                 plain cone. Each is the front arc of a circle round the cone,
                 so each has its own width and squash. -->
            <div class="cup-rib rib-1"></div>
            <div class="cup-rib rib-2"></div>
            <div class="cup-rib rib-3"></div>
            <div class="cup-rib rib-4"></div>
            <div class="cup-rib rib-5"></div>
          </div>
          <div class="cup-rim"></div>
          <div class="cup-inside"><div class="cup-drink"></div></div>
        </div>
        <div class="prop cup cup-low p-cup-2">
          <div class="cup-shadow"></div>
          <div class="cup-body">
            <!-- The three stepped ribs below the lip and the roll above the
                 base, which is what makes a party cup that shape and not a
                 plain cone. Each is the front arc of a circle round the cone,
                 so each has its own width and squash. -->
            <div class="cup-rib rib-1"></div>
            <div class="cup-rib rib-2"></div>
            <div class="cup-rib rib-3"></div>
            <div class="cup-rib rib-4"></div>
            <div class="cup-rib rib-5"></div>
          </div>
          <div class="cup-rim"></div>
          <div class="cup-inside"><div class="cup-drink"></div></div>
        </div>

        <!-- Two tight clusters, diagonally opposite, each holding all three
             denominations - that is what a player's own chips look like when
             they have been sitting there a while. An earlier pass had ten
             loose counters ringing the table and it read as clutter. -->
        <!-- Four stacks per cluster, set along an arc that follows the rim.
             DOM order runs from the far end of each arc to the near one, so
             the nearer stacks paint over the ones behind them. -->
        {@render chipStack('chip-red', 'p-chip-1', 5)}
        {@render chipStack('chip-blue', 'p-chip-2', 3)}
        {@render chipStack('chip-green', 'p-chip-3', 2)}
        {@render chipStack('chip-black', 'p-chip-4', 1)}

        {@render chipStack('chip-white', 'p-chip-5', 4)}
        {@render chipStack('chip-black', 'p-chip-6', 3)}
        {@render chipStack('chip-red', 'p-chip-7', 2)}
        {@render chipStack('chip-green', 'p-chip-8', 1)}
      </div>
    </div>
  </div>

  <!-- Responsible-gambling readouts, rendered only where the player's regulator
       asks for them (displayNetPosition / displayRTP / displaySessionTimer).
       Pinned top-right rather than sitting in the control bar: in the bar it
       pushed the row count to five and took 40% of the viewport height on a
       400x225 popout, squeezing the play area. Up here it costs the layout
       nothing, and it is reference information rather than a control. -->
  {#if jurisdiction.showAnyReadout()}
    <aside class="rg-panel" aria-label={t('Session information')}>
      {#if jurisdiction.showNetPosition()}
        <div class="rg-item" class:up={sessionNet > 0} class:down={sessionNet < 0}>
          <span class="cb-cap">{t('Net Position')}</span>
          <span class="cb-val">{numberToCurrencyString(sessionNet)}</span>
        </div>
      {/if}
      {#if jurisdiction.showRTP()}
        <div class="rg-item">
          <span class="cb-cap">{t('RTP')}</span>
          <span class="cb-val">{(gameConfig.rtp * 100).toFixed(2)}%</span>
        </div>
      {/if}
      {#if jurisdiction.showSessionTimer()}
        <div class="rg-item">
          <span class="cb-cap">{t('Session')}</span>
          <span class="cb-val">{sessionClock()}</span>
        </div>
      {/if}
    </aside>
  {/if}

  <!-- Game name over the casino's, stacked. The logo deliberately stays out of
       this plate - it is the hero on the loader and sits on every card back,
       which is enough branding once play has started. -->
  <div class="game-title" aria-hidden="true">
    <span class="game-title-main">Ride The Bus</span>
    <span class="game-title-sub">by Takeover Casino</span>
  </div>

  <main class="play-area">
    {#snippet cardRow()}
      <div class="card-row">
        {#each revealedCards as card, index}
          <div class="card-slot">
            <div class="card-mult" class:show={stageMultipliers[index] !== null}>
              {(stageMultipliers[index] ?? 0).toFixed(2)}×
            </div>
            <div class="card-block">
              <div class="card-inner" class:flipped={card}>
                <div class="card-back" aria-hidden="true"></div>
                <div class="card-front">
                  {#if card}
                    <div class="card-face" class:red-card={card.suit === '♥' || card.suit === '♦'} class:black-card={card.suit === '♠' || card.suit === '♣'}>
                      <div class="rank top">{card.rank}</div>
                      <div class="suit center">{card.suit}</div>
                      <div class="rank bottom">{card.rank}</div>
                    </div>
                  {/if}
                  {#if index === bustedIndex}
                    <div class="bust-x" aria-hidden="true">✕</div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/snippet}

    {#snippet runningWinBar()}
      <div class="running-win" class:is-win={gameState === 'won' && wonAmount > 0} class:is-loss={gameState === 'lost'}>
        <span class="running-win-label">
          {#if gameState === 'won'}{bustedIndex === null ? t('Full Game Win!') : t('Banked')}{:else if gameState === 'lost'}{t('Busted')}{:else if gameState === 'playing'}{t('Revealing…')}{:else}{t('Winning')}{/if}
        </span>
        <span class="running-win-amount">{numberToCurrencyString(runningWin)}</span>
        <!-- Always rendered (a non-breaking space when there's no result yet) so
             the multiplier appearing at the end of a round doesn't grow the bar
             and shove the cards / choices around. -->
        <span class="running-win-mult">{(gameState === 'won' || gameState === 'lost') && initialBet > 0 ? `${(wonAmount / initialBet).toFixed(2)}×` : ' '}</span>
      </div>
    {/snippet}

    {@render cardRow()}
    {#if hasPlayed}{@render runningWinBar()}{/if}

    <div class="choice-row" class:locked={gameState === 'playing' || autoRunning}>
      <div class="choice-column">
        <span class="choice-label">{t('Color')}</span>
        <div class="choice-square color-square" role="group" aria-label={t('Pick a color')}>
          <button type="button" class="half-btn black-half" class:selected={colorChoice === 'black'} onclick={() => setColorChoice('black')} aria-label={t('Black')}></button>
          <button type="button" class="half-btn red-half" class:selected={colorChoice === 'red'} onclick={() => setColorChoice('red')} aria-label={t('Red')}></button>
        </div>
      </div>

      <div class="choice-column">
        <span class="choice-label">{t('Higher')}<br />{t('Lower')}</span>
        <div class="choice-square hl-square" role="group" aria-label={t('Higher, lower, or equal')}>
          <button type="button" class="third-btn higher-third" class:selected={hlChoice === 'higher'} onclick={() => setHlChoice('higher')} aria-label={t('Higher')}>{@render iconTriangleUp()}</button>
          <button type="button" class="third-btn lower-third" class:selected={hlChoice === 'lower'} onclick={() => setHlChoice('lower')} aria-label={t('Lower')}>{@render iconTriangleDown()}</button>
          <button type="button" class="equal-btn" class:selected={hlChoice === 'equal'} onclick={() => setHlChoice('equal')} aria-label={t('Equal')}>{@render iconEquals()}</button>
        </div>
      </div>

      <div class="choice-column">
        <span class="choice-label">{t('Inside')}<br />{t('Outside')}</span>
        <div class="choice-square io-square" role="group" aria-label={t('Inside, outside, or equal')}>
          <button
            type="button"
            class="half-btn inside-half"
            class:selected={ioChoice === 'inside'}
            onclick={() => setIoChoice('inside')}
            disabled={!insideIsPossible()}
            title={insideIsPossible() ? undefined : t('Not possible after guessing Equal')}
            aria-label={t('Inside')}
          >{@render iconInside()}</button>
          <button type="button" class="half-btn outside-half" class:selected={ioChoice === 'outside'} onclick={() => setIoChoice('outside')} aria-label={t('Outside')}>{@render iconOutside()}</button>
          <button type="button" class="equal-btn" class:selected={ioChoice === 'equal'} onclick={() => setIoChoice('equal')} aria-label={t('Equal')}>{@render iconEquals()}</button>
        </div>
      </div>

      <div class="choice-column">
        <span class="choice-label">{t('Suit')}</span>
        <div class="choice-square suit-square" role="group" aria-label={t('Pick a suit')}>
          <button type="button" class="quad-btn red-suit" class:selected={suitChoice === 'heart'} onclick={() => setSuitChoice('heart')} aria-label={t('Heart')}>♥</button>
          <button type="button" class="quad-btn" class:selected={suitChoice === 'spade'} onclick={() => setSuitChoice('spade')} aria-label={t('Spade')}>♠</button>
          <button type="button" class="quad-btn" class:selected={suitChoice === 'club'} onclick={() => setSuitChoice('club')} aria-label={t('Club')}>♣</button>
          <button type="button" class="quad-btn red-suit" class:selected={suitChoice === 'diamond'} onclick={() => setSuitChoice('diamond')} aria-label={t('Diamond')}>♦</button>
        </div>
      </div>
    </div>
  </main>

  <!-- Floating control bar: detached pill groups pulled toward the centre,
       with the turbo button and the advanced button floating free at the
       outer edges (slot-style). -->
  <footer class="control-bar">
    <!-- Removed, not just disabled, when the regulator bars Turbo: a greyed
         control still advertises a feature the player may not have. -->
    {#if !jurisdiction.turboDisabled()}
      <button class="cb-float cb-turbo" class:active={turboSpeed > 0 || openPopup === 'turbo'} onclick={() => togglePopup('turbo')} aria-label={t('Turbo speed')}>
        <svg class="cb-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 2v11h3v9l7-12h-4l4-8z" /></svg>
      </button>
    {/if}

    <div class="cb-panel cb-panel-light">
      <button class="cb-icon" onclick={toggleMuted} aria-pressed={muted} aria-label={muted ? t('Unmute') : t('Mute')}>
        <span class="cb-glyph">{muted ? '🔇' : '🔊'}</span>
      </button>
      <button class="cb-icon" class:active={openPopup === 'info'} onclick={() => togglePopup('info')} aria-label={t('How to play')}>
        <span class="cb-glyph cb-info-i">i</span>
      </button>

      <div class="cb-readouts">
        <div class="cb-balance">
          <span class="cb-cap">{t('Balance')}</span>
          <span class="cb-val">{numberToCurrencyString(stateBet.balanceAmount)}</span>
        </div>
        <!-- Always rendered (even before the first spin) so it can't pop into
             existence mid-session and shove the rest of the bar sideways. -->
        <div class="cb-lastwin" class:won={lastWinAmount > 0}>
          <span class="cb-cap">{t('Last Win')}</span>
          <span class="cb-val">
            {numberToCurrencyString(lastWinAmount)}
            <span class="cb-lastwin-mult">{lastWinMultiplier.toFixed(2)}×</span>
          </span>
        </div>
      </div>
    </div>

    <div class="cb-panel cb-panel-dark cb-bet">
      <button class="cb-bet-display" class:active={openPopup === 'bet'} onclick={() => togglePopup('bet')} aria-label={t('Choose bet amount')}>
        <span class="cb-cap">{t('Bet')}</span>
        <span class="cb-val">{numberToCurrencyString(betValue() > 0 ? betValue() : 0)}</span>
      </button>
      <div class="cb-betstep">
        <button class="cb-step" onclick={() => stepBet(1)} disabled={autoRunning} aria-label={t('Increase bet')}>{@render iconPlus()}</button>
        <button class="cb-step" onclick={() => stepBet(-1)} disabled={autoRunning} aria-label={t('Decrease bet')}>{@render iconMinus()}</button>
      </div>
    </div>

    <div class="cb-panel cb-panel-dark cb-actions">
      {#if !jurisdiction.autoplayDisabled()}
        <button class="cb-round cb-autospin" class:active={openPopup === 'autospin'} onclick={() => togglePopup('autospin')} disabled={autoRunning} aria-label={t('Autoplay settings')}>
          <svg class="cb-svg cb-autospin-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
            <path d="M10.4 9.7 14.6 12l-4.2 2.3z" />
          </svg>
        </button>
      {/if}

      <!-- Wraps the spin button so the cooldown ring and tooltip have a host
           that still receives hover while the button itself is disabled. -->
      <div class="cb-spin-wrap">
      <button
        class="cb-spin"
        class:stopping={autoRunning}
        class:slammable={canSlam()}
        onclick={onSpin}
        disabled={spinDisabled()}
        aria-label={autoRunning ? t('Stop autoplay') : canSlam() ? t('Skip the reveal') : t('Spin')}
      >
        {#if autoRunning}
          <span class="cb-spin-square" aria-hidden="true"></span>
          <!-- Rounds left, over the stop square. An unlimited run shows the
               infinity mark instead of a number; a space-hold run shows
               nothing, since it lasts only as long as the key is held. -->
          {#if !spaceHoldRunning}
            <span class="cb-spin-count" class:is-infinite={autoInfinite}>
              {#if autoInfinite}{@render iconInfinity()}{:else}{autoRemaining}{/if}
            </span>
          {/if}
        {:else if canSlam()}
          <!-- Skip-to-end: two chevrons into a bar. Distinct from the spin
               arrows so the button's job is readable at a glance. -->
          <svg class="cb-spin-svg cb-slam-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M4 5.5 12 12 4 18.5z" />
            <path d="M11 5.5 19 12l-8 6.5z" />
            <rect x="19.6" y="5" width="2.4" height="14" rx="1.2" />
          </svg>
        {:else}
          <svg class="cb-spin-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" /></svg>
        {/if}
      </button>

      <!-- Ring and tooltip live on the WRAPPER, not the button: the button is
           disabled whenever either is relevant, and a disabled button receives
           no mouse events, so :hover on it would never fire. -->
      {#if roundGateHeld}
        <svg class="cb-cooldown" viewBox="0 0 100 100" aria-hidden="true">
          <circle class="cb-cooldown-track" cx="50" cy="50" r="46" />
          <!-- Rotated -90deg so the sweep starts at 12 o'clock; dashoffset
               shrinks from the full circumference to 0 as it fills clockwise.
               2*pi*46 = 289.03 -->
          <circle
            class="cb-cooldown-fill"
            cx="50"
            cy="50"
            r="46"
            style={`stroke-dasharray: 289.03; stroke-dashoffset: ${(289.03 * (1 - cooldownProgress)).toFixed(2)}`}
          />
        </svg>
      {/if}
      <!-- Any reason the button is dead, not just the cooldown. -->
      {#if spinBlockedReason()}
        <span class="cb-cooldown-tip" role="tooltip">{spinBlockedReason()}</span>
      {/if}
      </div>
    </div>

    <button class="cb-float cb-advanced" class:active={openPopup === 'advanced'} onclick={() => togglePopup('advanced')} aria-label={t('Advanced settings')}>
      <svg class="cb-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" /></svg>
    </button>
  </footer>

  {#if openPopup}
    <button class="popup-backdrop" aria-label={t('Close menu')} onclick={() => (openPopup = null)}></button>
  {/if}

  {#if openPopup === 'bet'}
    <div class="popup popup-bet" role="dialog" aria-label={t('Bet Menu')}>
      <div class="popup-head"><span>{t('Bet Menu')}</span><button class="popup-close" onclick={() => (openPopup = null)} aria-label={t('Close')}>✕</button></div>
      <div class="bet-entry">
        <span class="bet-entry-cur">{currencySymbol()}</span>
        <input class="bet-entry-input" type="text" inputmode="decimal" bind:value={betInput} onblur={formatBetInput} placeholder="0.00" aria-label={t('Custom bet amount')} />
      </div>
      <span class="popup-sub">{t('Quick Bets')}</span>
      <div class="bet-grid">
        {#each betLevels() as lv}
          <button class="bet-cell" class:active={Math.abs(betValue() - lv) < 1e-9} onclick={() => setBetLevel(lv)}>{numberToCurrencyString(lv)}</button>
        {/each}
      </div>
    </div>
  {/if}

  {#if openPopup === 'turbo' && !jurisdiction.turboDisabled()}
    <div class="popup popup-turbo" role="dialog" aria-label={t('Turbo speed')}>
      <div class="popup-head"><span>{t('Turbo Speed')}</span><button class="popup-close" onclick={() => (openPopup = null)} aria-label={t('Close')}>✕</button></div>
      <div class="turbo-body">
        <div class="turbo-track">
          <span class="turbo-end">{t('Normal')}</span>
          <!-- The track's own max is capped when super turbo is barred, so the
               slider can't even be dragged to instant - the clamp above is the
               backstop, this is the affordance. -->
          <input
            class="turbo-slider"
            type="range"
            min="0"
            max={jurisdiction.superTurboDisabled() ? TURBO_CAP_WITHOUT_SUPER : 1}
            step="0.05"
            bind:value={turboSpeed}
            oninput={onTurboInput}
            aria-label={t('Turbo speed')}
          />
          <span class="turbo-end">{jurisdiction.superTurboDisabled() ? t('Fast') : t('Instant')}</span>
        </div>
        <div class="turbo-readout">{turboSpeed <= 0 ? t('Off — full animation') : turboSpeed >= 1 ? t('Instant') : `${Math.round(turboSpeed * 100)}${t('% faster')}`}</div>
      </div>
    </div>
  {/if}

  {#if openPopup === 'autospin' && !jurisdiction.autoplayDisabled()}
    <div class="popup popup-autospin" role="dialog" aria-label={t('Autoplay')}>
      <div class="popup-head"><span>{t('Autoplay')}</span><button class="popup-close" onclick={() => (openPopup = null)} aria-label={t('Close')}>✕</button></div>
      <div class="autospin-body">
        <span class="popup-sub">{t('Number of Spins')}</span>
        <div class="spin-grid">
          {#each AUTOSPIN_PRESETS as p}
            <button class="bet-cell" class:active={!autoInfinite && Math.floor(Number(autoRoundsInput)) === p} onclick={() => setAutoRounds(p)}>{p}</button>
          {/each}
          <!-- Unlimited spans the last row: nine cells in a 4-column grid would
               otherwise leave a ragged single cell. -->
          <button class="bet-cell bet-cell-wide" class:active={autoInfinite} onclick={toggleAutoInfinite} aria-label={t('Unlimited spins')}>{@render iconInfinity()}</button>
        </div>
        <div class="rounds-selector autospin-input">
          <div class="rounds-field">
            {#if autoInfinite}
              <span class="rounds-infinite">{@render iconInfinity()}</span>
            {:else}
              <input class="rounds-input" type="text" inputmode="numeric" bind:value={autoRoundsInput} onblur={formatAutoRounds} aria-label={t('Number of spins')} />
            {/if}
          </div>
          <div class="rounds-stepper">
            <button type="button" class="stepper-btn" onclick={() => stepAutoRounds(1)} aria-label={t('More spins')}>{@render iconChevronUp()}</button>
            <button type="button" class="stepper-btn" onclick={() => stepAutoRounds(-1)} aria-label={t('Fewer spins')}>{@render iconChevronDown()}</button>
          </div>
        </div>
        <button class="action-button popup-start" onclick={startAutoFromPopup} disabled={!betIsValid() || !allChoicesMade() || !autoRoundsValid()}>
          {#if !allChoicesMade()}{t('Pick all 4 guesses')}{:else if !betIsValid()}{t('Enter a valid bet')}{:else}{t('Start')}{/if}
        </button>
      </div>
    </div>
  {/if}

  {#if openPopup === 'advanced'}
    <div class="popup popup-advanced" role="dialog" aria-label={t('Advanced')}>
      <div class="popup-head"><span>{t('Advanced')}</span><button class="popup-close" onclick={() => (openPopup = null)} aria-label={t('Close')}>✕</button></div>
      <div class="advanced-body">
        <div class="advanced-row">
          <span class="control-label">{t('Stop on full game win')}</span>
          <button type="button" class="switch" class:on={stopOnFullWin} role="switch" aria-checked={stopOnFullWin} aria-label={t('Stop autoplay on a full game win')} disabled={autoRunning} onclick={() => (stopOnFullWin = !stopOnFullWin)}><span class="switch-knob"></span></button>
        </div>
      </div>
    </div>
  {/if}

  {#if openPopup === 'info'}
    <div class="popup popup-info" role="dialog" aria-label={t('How to play')}>
      <div class="popup-head"><span>{t('How to Play')}</span><button class="popup-close" onclick={() => (openPopup = null)} aria-label={t('Close')}>✕</button></div>
      <div class="info-body">
        <p>{t('Guess your way through four cards:')}</p>
        <ol>
          <li>{t('Colour — red or black for card 1.')}</li>
          <li>{t('Higher / Lower — versus card 1 (or =).')}</li>
          <li>{t('Inside / Outside — between cards 1 & 2 (or =).')}</li>
          <li>{t('Suit — the suit of card 4.')}</li>
        </ol>
        <p>{t('Pick all four, set your bet, and hit Spin. Each correct guess multiplies your win; a wrong guess ends the round but you keep whatever you had banked so far. Guess all four to win the full game.')}</p>

        <h4 class="info-h">{t('Card order')}</h4>
        <p>{t('Ace is low and King is high — worth knowing, since plenty of card games play it the other way. Suit never affects rank; only the number counts for Higher / Lower and Inside / Outside.')}</p>
        <!-- Rendered from the same `ranks` array the game runs on, so it cannot
             disagree with the real ordering. An ordered list because that is
             exactly what it is: lowest to highest. -->
        <ol class="rank-strip">
          {#each ranks as rank}
            <li class="rank-chip">{rank}</li>
          {/each}
        </ol>
        <div class="rank-ends" aria-hidden="true">
          <span>{t('Lowest')}</span>
          <span>{t('Highest')}</span>
        </div>

        <h4 class="info-h">{t('Payouts follow the odds')}</h4>
        <p>{t('Every correct guess pays its true odds, so the less likely your pick, the more it pays — and that depends on the cards already showing.')}</p>
        <p>{t('With a 3 on the table, Lower pays about 4.75× because only 8 of the 51 remaining cards are lower, while Higher pays about 1.19× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about 1.57× and Higher rises to about 2.08×. Equal is always the longest shot at roughly 12×.')}</p>

        <h4 class="info-h">{t('If you guess wrong')}</h4>
        <ul>
          <li>{t('Card 1 — the round pays nothing.')}</li>
          <li>{t('Card 2 — you get 0.5× your bet back.')}</li>
          <li>{t('Card 3 or 4 — you keep 30% of the multiplier you had built up, which ranges from 0.6× to 129×.')}</li>
        </ul>

        <h4 class="info-h">{t('Full game wins')}</h4>
        <p>{t('Guess all four cards right and the payout depends on how hard your picks were:')}</p>
        <ul>
          <li>{t('No Equal picks — averages 17.3×, up to 317.4×.')}</li>
          <li>{t('One Equal pick — averages 67.5×, up to 381.9×.')}</li>
          <li>{t('Two Equal picks — averages 1329.2×, up to 1354.2×, the most this game can pay.')}</li>
        </ul>
        <p>{t('Equal is the rarest guess, so the rounds built on it carry the largest wins — and are the hardest to land.')}</p>

        <h4 class="info-h">{t('Speed and autoplay')}</h4>
        <ul>
          <li>{t('Turbo (the lightning button) slides from Normal to Instant and changes only how fast the cards flip. It never changes the cards, the odds or the payout.')}</li>
          <li>{t('Autoplay (the circular arrows) replays the same four guesses for a set number of rounds, or unlimited. The round counter sits on the button while it runs — press the red square to stop, and the round already in play finishes first.')}</li>
          <li>{t('Stop on full game win (the sliders button) ends an autoplay run the moment a round lands all four cards. It only stops the run; your bet never changes.')}</li>
          <li>{t('Tap the spacebar to play one round, or hold it to keep spinning until you let go.')}</li>
        </ul>
      </div>
    </div>
  {/if}
</div>

<!-- Our own failure dialog, NOT the SDK's <Modals> bundle.

     This is load-bearing: Authenticate and the bet flow report failures by
     setting stateModal.modal to { name: 'error', ... }, and with nothing
     mounted to read that, a player hitting an auth or session failure just
     sees a stuck screen.

     <Modals> would mount eight others alongside it, including ModalPayTable
     and ModalGameRules, whose bodies are the template's literal "ADD YOUR PAY
     TABLE" / "ADD YOUR GAME RULES" - and those strings were shipping in the
     production bundle. Nothing can open them here: the only triggers are
     ButtonPayTable / ButtonGameRules in components-ui-pixi, the SDK UI this
     game replaced, and there is no postMessage channel for the platform to
     reach them either. This game's rules and payouts live in How to Play.

     ModalError itself is not reused because it renders `<p>{error}</p>` for
     anything lacking both .error and .message - and an RGS failure body is
     { error: 'ERR_IS', status: {...} }, so it showed the player the literal
     text "[object Object]". ErrorModal maps the documented codes instead. -->
<ErrorModal />

<style>
  /* Styles live in src/styles/*.css and are pulled in here so they stay
     SCOPED to this component (vitePreprocess runs Vite's CSS pipeline, which
     resolves these @imports before Svelte scopes the result). Import order
     matters: responsive.css last so its overrides win. */
  @import '../styles/base.css';
  @import '../styles/table.css';
  @import '../styles/cards.css';
  @import '../styles/choices.css';
  @import '../styles/control-bar.css';
  @import '../styles/popups.css';
  @import '../styles/responsive.css';
</style>
