<script lang="ts">
  import { base } from '$app/paths';
  import './app.css';
  import { createRoundContract, rankValue, type Card } from '../game/roundContract';
  import { stateBet, stateUrlDerived, stateMeta, stateConfig } from 'state-shared';
  import { requestBet, requestEndRound } from 'rgs-requests';
  import { numberToCurrencyString } from 'utils-shared/amount';
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
  const TARGET_RTP = 0.99;
  const DECAY = Math.pow(TARGET_RTP, 0.25);
  const STAGE_RETENTION = [0, 0.3, 0.3, 0.3];

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

  // Bottom control-bar UI: which popup (if any) is open, plus mute state.
  let openPopup = $state<null | 'bet' | 'turbo' | 'autospin' | 'advanced' | 'info'>(null);
  let muted = $state(false);
  let autoRoundsInput = $state('10');
  let autoInfinite = $state(false);
  let autoRunning = $state(false);
  let autoRemaining = $state(0);
  // A Stop press can't cancel a bet already placed on the server, so it just
  // asks the loop to stop BEFORE starting the next round (the in-flight round
  // finishes normally - this matches the documented single-bet RGS model).
  let autoStopRequested = $state(false);
  // Spin-count presets for the Autoplay popup.
  const AUTOSPIN_PRESETS = [10, 25, 50, 100, 250, 500, 1000];
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
    // On a real RGS session, the amount must sit within the allowed range
    // (min..max of the bet levels). Locally there's nothing to enforce.
    const levels = stateConfig.betAmountOptions;
    if (stateUrlDerived.sessionID() && levels && levels.length) {
      return v >= Math.min(...levels) && v <= Math.max(...levels);
    }
    return true;
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
  const betDisplay = () => `$${`${betInput ?? ''}`.trim() || '0.00'}`;

  // Tidy the amount to 2 decimals when the field loses focus (so it reads like
  // "$1.00"); typing is left untouched while the field is focused.
  function formatBetInput() {
    const v = Number(`${betInput ?? ''}`.trim());
    if (`${betInput ?? ''}`.trim() !== '' && !isNaN(v) && v > 0) {
      betInput = v.toFixed(2);
    }
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
  const isEngineRound = () => roundSource !== 'local-fallback' && roundSource !== 'none';
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  // Scale a delay by the turbo speed: 0 => full `normal`, 1 => `fast` (instant).
  // Read at call time so moving the slider mid-reveal takes effect next step.
  const paceMs = (normal: number, fast: number) => Math.round(normal + (fast - normal) * turboSpeed);
  // Card flip duration (seconds) for the --flip-dur CSS var; shrinks to 0 as
  // turbo approaches instant.
  const flipDurSec = () => (0.5 * (1 - turboSpeed)).toFixed(3);

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

  // Bring a raw bet into what the RGS actually accepts. Per Stake's RGS spec
  // the predefined betLevels are only *suggestions* - a bet is valid as long
  // as it (1) sits between minBet and maxBet and (2) is divisible by stepBet.
  // So we do NOT snap to the nearest level (that needlessly turned 11 -> 10);
  // we just clamp into range and round to the cent (the finest common step),
  // which keeps any whole/simple amount the player types. Gated on a real
  // session - in local dev betAmountOptions holds placeholder defaults, so
  // free amounts pass through untouched.
  function normalizeBet(value: number): number {
    const levels = stateConfig.betAmountOptions;
    if (!stateUrlDerived.sessionID() || !levels || levels.length === 0) return value;
    const lo = Math.min(...levels);
    const hi = Math.max(...levels);
    const clamped = Math.min(Math.max(value, lo), hi);
    return Math.round(clamped * 100) / 100;
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
    let running = 1;
    let busted = false;
    for (let i = 0; i < revealEvents.length; i++) {
      await wait(paceMs(650, 0));
      revealedCards[i] = revealEvents[i].card;
      const event = revealEvents[i];
      if (!busted && event.correct) {
        running *= event.payout;
      } else if (!busted) {
        bustedIndex = i;
        running *= STAGE_RETENTION[i] * DECAY ** (3 - i);
        busted = true;
      }
      stageMultipliers[i] = quantizeMultiplier(running);
      runningWin = stageMultipliers[i]! * initialBet;
      if (busted) {
        await wait(paceMs(900, 150));
        break;
      }
    }

    await wait(paceMs(300, 120));
    // Prefer the server's authoritative payout on engine rounds; fall back to
    // the local formula (identical maths) when there's no RGS session.
    const multiplier = engineFinalMultiplier ?? computeFinalMultiplier(revealEvents);
    wonAmount = multiplier * initialBet;
    runningWin = wonAmount;
    if (!isEngineRound()) {
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
  }

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
      console.log('[RideTheBus] /wallet/play request:', {
        mode,
        betAmount: stateBet.betAmount,
        initialBet,
        amountMicroUnits: initialBet * API_AMOUNT_MULTIPLIER,
        currency: stateBet.currency,
        balance: stateBet.balanceAmount,
        allowedBetLevels: stateConfig.betAmountOptions,
      });
      const data = await requestBet({
        rgsUrl: stateUrlDerived.rgsUrl(),
        sessionID: stateUrlDerived.sessionID(),
        currency: stateBet.currency || 'USD',
        mode,
        amount: initialBet,
      });
      console.log('[RideTheBus] /wallet/play response:', data);

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

      const events = data?.round?.state;
      if (!Array.isArray(events) || events.length === 0) {
        throw new Error(
          `No round state from /wallet/play for mode "${mode}". The math for this mode may not be ` +
            `published/approved, or the bet amount isn't a valid level.`,
        );
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

      lastRoundId = `${data?.round?.roundID ?? ''}`;
      roundSource = roundSeedData.source;
      revealedCards = [null, null, null, null];
      stageMultipliers = [null, null, null, null];
      runningWin = 0;
      bustedIndex = null;
      wonAmount = 0;
      gameState = 'playing';
      await playRevealSequence();
    } catch (err) {
      console.error(err);
      roundError = true;
      // One alert is enough; during an auto run the loop stops after this, so
      // we don't pop a dialog for every remaining round.
      if (!autoRunning) alert('Engine play failed: ' + ((err as any)?.message || String(err)));
    } finally {
      isProcessing = false;
    }
  }

  // One full round: place the single bet (engine or local-fallback) and play it
  // out to a won/lost result. Awaitable so the auto loop can run rounds
  // back-to-back; manual Start just fires it and forgets.
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

    // local deterministic fallback (dev): simulate the debit a real
    // /wallet/play call would make, so balance behaves like prod.
    stateBet.balanceAmount -= initialBet;
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
  async function startAuto() {
    if (autoRunning || !betIsValid() || !allChoicesMade() || !autoRoundsValid()) return;
    autoStopRequested = false;
    autoRunning = true;
    autoRemaining = autoInfinite ? Infinity : Math.floor(Number(autoRoundsInput));

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
      while (autoRemaining > 0 && !autoStopRequested) {
        // Bet this round's amount (advanced strategy may have grown / reset it).
        betInput = String(nextBet);
        // Stop if the next bet is no longer affordable (prod: server balance;
        // local: the debited fallback balance) - the same guard the SDK's
        // autobet uses (createIntermediateMachineAutoBet.ts:checkInsufficientFunds).
        if (betValue() > stateBet.balanceAmount + 1e-9) break;

        await playRound();
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

        if (!autoInfinite) autoRemaining -= 1;
        if (autoRemaining <= 0) break;
        // Let the just-finished result sit briefly before the board clears.
        await wait(paceMs(750, 200));
      }
    } finally {
      autoRunning = false;
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
  function stepAutoRounds(direction: 1 | -1) {
    autoInfinite = false;
    const current = Math.floor(Number(autoRoundsInput));
    const base = Number.isFinite(current) && current >= 1 ? current : 1;
    autoRoundsInput = String(Math.max(1, base + direction));
  }
  function toggleAutoInfinite() {
    autoInfinite = !autoInfinite;
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
  const spinDisabled = () =>
    autoRunning
      ? false
      : gameState === 'playing' ||
        isProcessing ||
        !betIsValid() ||
        !allChoicesMade() ||
        (IS_PROD && resolveRoundSeed().source === 'none');
  function onSpin() {
    if (autoRunning) { stopAuto(); return; }
    if (spinDisabled()) return;
    playRound().catch((err) => console.error('Play failed', err));
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

  // Mirrors games/ride_the_bus/game_calculations.py:partial_multiplier - the
  // RAW (unquantized) win multiplier for a correct guess, solved so that for
  // ANY probability p the expected change to the running multiplier is a
  // fixed constant DECAY: p*m + (1-p)*retention == DECAY. Returns 0 when the
  // guess is impossible this round (p<=0), which also flags the dead zone to
  // computeFinalMultiplier below. NOT floored here - only the final compound
  // is quantized, exactly like the real book.
  function partialMultiplier(probability: number, stageIndex: number): number {
    if (probability <= 0) return 0;
    const retention = STAGE_RETENTION[stageIndex];
    return (DECAY - (1 - probability) * retention) / probability;
  }

  // Mirrors games/ride_the_bus/game_calculations.py:quantize_multiplier -
  // floor the final multiplier to the 0.1x steps the RGS lookup uses.
  function quantizeMultiplier(raw: number): number {
    if (raw <= 0) return 0;
    const quantized = Math.floor(raw * 10) / 10;
    return quantized > 0 ? quantized : 0.1;
  }

  // Mirrors games/ride_the_bus/gamestate.py:run_spin exactly - compound the
  // running multiplier over the streak of correct guesses; on the first miss
  // bank STAGE_RETENTION[stage] of it, then apply DECAY for each unplayed
  // stage (so the martingale expectation holds for the stages that never got
  // drawn), and quantize once. A stage-1 (colour) miss banks
  // STAGE_RETENTION[0] === 0, i.e. a total loss.
  function computeFinalMultiplier(events: RevealEvent[]): number {
    let running = 1;
    let busted = false;
    for (let stage = 0; stage < events.length; stage += 1) {
      const event = events[stage];
      if (!busted && event.correct) {
        running *= event.payout;
      } else if (!busted) {
        running *= STAGE_RETENTION[stage];
        running *= DECAY ** (3 - stage);
        busted = true;
      }
    }
    return quantizeMultiplier(running);
  }

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

  const backdropUrl = `${base}/backdrop.png`;
</script>

<div class="game-layout" style={`--backdrop-url: url(${backdropUrl}); --flip-dur: ${flipDurSec()}s`}>
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
          {#if gameState === 'won'}{bustedIndex === null ? 'Full Game Win!' : 'Banked'}{:else if gameState === 'lost'}Busted{:else if gameState === 'playing'}Revealing…{:else}Winning{/if}
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
        <span class="choice-label">Color</span>
        <div class="choice-square color-square" role="group" aria-label="Pick a color">
          <button type="button" class="half-btn black-half" class:selected={colorChoice === 'black'} onclick={() => (colorChoice = 'black')} aria-label="Black"></button>
          <button type="button" class="half-btn red-half" class:selected={colorChoice === 'red'} onclick={() => (colorChoice = 'red')} aria-label="Red"></button>
        </div>
      </div>

      <div class="choice-column">
        <span class="choice-label">Higher / Lower</span>
        <div class="choice-square hl-square" role="group" aria-label="Higher, lower, or equal">
          <button type="button" class="third-btn higher-third" class:selected={hlChoice === 'higher'} onclick={() => (hlChoice = 'higher')} aria-label="Higher">▲</button>
          <button type="button" class="third-btn lower-third" class:selected={hlChoice === 'lower'} onclick={() => (hlChoice = 'lower')} aria-label="Lower">▼</button>
          <button type="button" class="equal-btn" class:selected={hlChoice === 'equal'} onclick={() => (hlChoice = 'equal')} aria-label="Equal">=</button>
        </div>
      </div>

      <div class="choice-column">
        <span class="choice-label">Inside / Outside</span>
        <div class="choice-square io-square" role="group" aria-label="Inside, outside, or equal">
          <button type="button" class="half-btn inside-half" class:selected={ioChoice === 'inside'} onclick={() => (ioChoice = 'inside')} aria-label="Inside">→←</button>
          <button type="button" class="half-btn outside-half" class:selected={ioChoice === 'outside'} onclick={() => (ioChoice = 'outside')} aria-label="Outside">←→</button>
          <button type="button" class="equal-btn" class:selected={ioChoice === 'equal'} onclick={() => (ioChoice = 'equal')} aria-label="Equal">=</button>
        </div>
      </div>

      <div class="choice-column">
        <span class="choice-label">Suit</span>
        <div class="choice-square suit-square" role="group" aria-label="Pick a suit">
          <button type="button" class="quad-btn red-suit" class:selected={suitChoice === 'heart'} onclick={() => (suitChoice = 'heart')} aria-label="Heart">♥</button>
          <button type="button" class="quad-btn" class:selected={suitChoice === 'spade'} onclick={() => (suitChoice = 'spade')} aria-label="Spade">♠</button>
          <button type="button" class="quad-btn" class:selected={suitChoice === 'club'} onclick={() => (suitChoice = 'club')} aria-label="Club">♣</button>
          <button type="button" class="quad-btn red-suit" class:selected={suitChoice === 'diamond'} onclick={() => (suitChoice = 'diamond')} aria-label="Diamond">♦</button>
        </div>
      </div>
    </div>
  </main>

  <!-- Floating control bar: detached pill groups pulled toward the centre,
       with the turbo button and the advanced button floating free at the
       outer edges (slot-style). -->
  <footer class="control-bar">
    <button class="cb-float cb-turbo" class:active={turboSpeed > 0 || openPopup === 'turbo'} onclick={() => togglePopup('turbo')} aria-label="Turbo speed">
      <svg class="cb-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 2v11h3v9l7-12h-4l4-8z" /></svg>
    </button>

    <div class="cb-panel cb-panel-light">
      <button class="cb-icon" onclick={() => (muted = !muted)} aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'}>
        <span class="cb-glyph">{muted ? '🔇' : '🔊'}</span>
      </button>
      <button class="cb-icon" class:active={openPopup === 'info'} onclick={() => togglePopup('info')} aria-label="How to play">
        <span class="cb-glyph cb-info-i">i</span>
      </button>

      <div class="cb-readouts">
        <div class="cb-balance">
          <span class="cb-cap">Balance</span>
          <span class="cb-val">{numberToCurrencyString(stateBet.balanceAmount)}</span>
        </div>
        <!-- Always rendered (even before the first spin) so it can't pop into
             existence mid-session and shove the rest of the bar sideways. -->
        <div class="cb-lastwin" class:won={lastWinAmount > 0}>
          <span class="cb-cap">Last Win</span>
          <span class="cb-val">
            {numberToCurrencyString(lastWinAmount)}
            <span class="cb-lastwin-mult">{lastWinMultiplier.toFixed(2)}×</span>
          </span>
        </div>
      </div>
    </div>

    <div class="cb-panel cb-panel-dark cb-bet">
      <button class="cb-bet-display" class:active={openPopup === 'bet'} onclick={() => togglePopup('bet')} aria-label="Choose bet amount">
        <span class="cb-cap">Bet</span>
        <span class="cb-val">{numberToCurrencyString(betValue() > 0 ? betValue() : 0)}</span>
      </button>
      <div class="cb-betstep">
        <button class="cb-step" onclick={() => stepBet(1)} disabled={autoRunning} aria-label="Increase bet">+</button>
        <button class="cb-step" onclick={() => stepBet(-1)} disabled={autoRunning} aria-label="Decrease bet">−</button>
      </div>
    </div>

    <div class="cb-panel cb-panel-dark cb-actions">
      <button class="cb-round cb-autospin" class:active={openPopup === 'autospin'} onclick={() => togglePopup('autospin')} disabled={autoRunning} aria-label="Autoplay settings">
        <svg class="cb-svg cb-autospin-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
          <path d="M10.4 9.7 14.6 12l-4.2 2.3z" />
        </svg>
      </button>

      <button class="cb-spin" class:stopping={autoRunning} onclick={onSpin} disabled={spinDisabled()} aria-label={autoRunning ? 'Stop autoplay' : 'Spin'}>
        {#if autoRunning}
          <span class="cb-spin-square" aria-hidden="true"></span>
        {:else}
          <svg class="cb-spin-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" /></svg>
        {/if}
      </button>
    </div>

    <button class="cb-float cb-advanced" class:active={openPopup === 'advanced'} onclick={() => togglePopup('advanced')} aria-label="Advanced settings">
      <svg class="cb-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" /></svg>
    </button>
  </footer>

  {#if openPopup}
    <button class="popup-backdrop" aria-label="Close menu" onclick={() => (openPopup = null)}></button>
  {/if}

  {#if openPopup === 'bet'}
    <div class="popup popup-bet" role="dialog" aria-label="Bet menu">
      <div class="popup-head"><span>Bet Menu</span><button class="popup-close" onclick={() => (openPopup = null)} aria-label="Close">✕</button></div>
      <div class="bet-entry">
        <span class="bet-entry-cur">$</span>
        <input class="bet-entry-input" type="text" inputmode="decimal" bind:value={betInput} onblur={formatBetInput} placeholder="0.00" aria-label="Custom bet amount" />
      </div>
      <span class="popup-sub">Quick Bets</span>
      <div class="bet-grid">
        {#each betLevels() as lv}
          <button class="bet-cell" class:active={Math.abs(betValue() - lv) < 1e-9} onclick={() => setBetLevel(lv)}>{numberToCurrencyString(lv)}</button>
        {/each}
      </div>
    </div>
  {/if}

  {#if openPopup === 'turbo'}
    <div class="popup popup-turbo" role="dialog" aria-label="Turbo speed">
      <div class="popup-head"><span>Turbo Speed</span><button class="popup-close" onclick={() => (openPopup = null)} aria-label="Close">✕</button></div>
      <div class="turbo-body">
        <div class="turbo-track">
          <span class="turbo-end">Normal</span>
          <input class="turbo-slider" type="range" min="0" max="1" step="0.05" bind:value={turboSpeed} aria-label="Turbo speed" />
          <span class="turbo-end">Instant</span>
        </div>
        <div class="turbo-readout">{turboSpeed <= 0 ? 'Off — full animation' : turboSpeed >= 1 ? 'Instant' : `${Math.round(turboSpeed * 100)}% faster`}</div>
      </div>
    </div>
  {/if}

  {#if openPopup === 'autospin'}
    <div class="popup popup-autospin" role="dialog" aria-label="Autoplay">
      <div class="popup-head"><span>Autoplay</span><button class="popup-close" onclick={() => (openPopup = null)} aria-label="Close">✕</button></div>
      <div class="autospin-body">
        <span class="popup-sub">Number of Spins</span>
        <div class="spin-grid">
          {#each AUTOSPIN_PRESETS as p}
            <button class="bet-cell" class:active={!autoInfinite && Math.floor(Number(autoRoundsInput)) === p} onclick={() => setAutoRounds(p)}>{p}</button>
          {/each}
          <button class="bet-cell" class:active={autoInfinite} onclick={toggleAutoInfinite}>∞</button>
        </div>
        <div class="rounds-selector autospin-input">
          <div class="rounds-field">
            {#if autoInfinite}
              <span class="rounds-infinite">∞</span>
            {:else}
              <input class="rounds-input" type="text" inputmode="numeric" bind:value={autoRoundsInput} onblur={formatAutoRounds} aria-label="Number of spins" />
            {/if}
          </div>
          <div class="rounds-stepper">
            <button type="button" class="stepper-btn" onclick={() => stepAutoRounds(1)} aria-label="More spins">▲</button>
            <button type="button" class="stepper-btn" onclick={() => stepAutoRounds(-1)} aria-label="Fewer spins">▼</button>
          </div>
        </div>
        <button class="action-button popup-start" onclick={startAutoFromPopup} disabled={!betIsValid() || !allChoicesMade() || !autoRoundsValid()}>
          {#if !allChoicesMade()}Pick all 4 guesses{:else if !betIsValid()}Enter a valid bet{:else}Start{/if}
        </button>
      </div>
    </div>
  {/if}

  {#if openPopup === 'advanced'}
    <div class="popup popup-advanced" role="dialog" aria-label="Advanced">
      <div class="popup-head"><span>Advanced</span><button class="popup-close" onclick={() => (openPopup = null)} aria-label="Close">✕</button></div>
      <div class="advanced-body">
        <div class="advanced-row">
          <span class="control-label">Stop on full game win</span>
          <button type="button" class="switch" class:on={stopOnFullWin} role="switch" aria-checked={stopOnFullWin} aria-label="Stop autoplay on a full game win" disabled={autoRunning} onclick={() => (stopOnFullWin = !stopOnFullWin)}><span class="switch-knob"></span></button>
        </div>
      </div>
    </div>
  {/if}

  {#if openPopup === 'info'}
    <div class="popup popup-info" role="dialog" aria-label="How to play">
      <div class="popup-head"><span>How to Play</span><button class="popup-close" onclick={() => (openPopup = null)} aria-label="Close">✕</button></div>
      <div class="info-body">
        <p>Guess your way through four cards:</p>
        <ol>
          <li><strong>Colour</strong> — red or black for card 1.</li>
          <li><strong>Higher / Lower</strong> — versus card 1 (or =).</li>
          <li><strong>Inside / Outside</strong> — between cards 1 &amp; 2 (or =).</li>
          <li><strong>Suit</strong> — the suit of card 4.</li>
        </ol>
        <p>Pick all four, set your bet, and hit <strong>Spin</strong>. Each correct guess multiplies your win; a wrong guess ends the round but you keep whatever you'd banked so far. Guess all four to win the full game.</p>
        <p>Use <strong>⚡ Turbo</strong> to speed up the reveal and <strong>⟳ Autoplay</strong> to run many rounds with the same guesses.</p>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Styles live in src/styles/*.css and are pulled in here so they stay
     SCOPED to this component (vitePreprocess runs Vite's CSS pipeline, which
     resolves these @imports before Svelte scopes the result). Import order
     matters: responsive.css last so its overrides win. */
  @import '../styles/base.css';
  @import '../styles/cards.css';
  @import '../styles/choices.css';
  @import '../styles/control-bar.css';
  @import '../styles/popups.css';
  @import '../styles/responsive.css';
</style>
