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

  // Manual vs Auto play. Auto simply loops the SAME single-bet round the manual
  // Start does - each iteration is one independent /wallet/play (+ end-round on
  // a win). Stake's RGS has no server-side "auto" concept; this is a purely
  // client-side convenience, exactly like the SDK's autoBet machine
  // (createIntermediateMachineAutoBet.ts) which just counts down a run of
  // discrete bets and stops on 0 / insufficient funds / a Stop.
  let betMode = $state<'manual' | 'auto'>('manual');
  let autoRoundsInput = $state('10');
  let autoInfinite = $state(false);
  let autoRunning = $state(false);
  let autoRemaining = $state(0);
  // A Stop press can't cancel a bet already placed on the server, so it just
  // asks the loop to stop BEFORE starting the next round (the in-flight round
  // finishes normally - this matches the documented single-bet RGS model).
  let autoStopRequested = $state(false);
  const AUTO_ROUND_PRESETS = [10, 25, 50, 100];
  const autoRoundsValid = () =>
    autoInfinite || (Number.isFinite(Number(autoRoundsInput)) && Math.floor(Number(autoRoundsInput)) >= 1);

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
      await wait(650);
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
        await wait(900);
        break;
      }
    }

    await wait(300);
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

  function startGame() {
    // Manual Start: play exactly one round (the reveal animates on its own).
    playRound().catch((err) => console.error('Play failed', err));
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
        await wait(750);
      }
    } finally {
      autoRunning = false;
      autoRemaining = 0;
      // Restore the input to the starting bet so the sidebar doesn't keep the
      // last (possibly grown) strategy amount after the run ends.
      betInput = String(autoBaseBet);
      // Return to the picking screen (guesses kept) so the player can adjust
      // and run again - after leaving the final result up for a moment.
      if (gameState === 'won' || gameState === 'lost') {
        await wait(1000);
        if (!autoRunning) retryGame();
      }
    }
  }

  function stopAuto() {
    // Can't cancel a bet already on the server, so just ask the loop to stop
    // before the next round; the current round plays out.
    autoStopRequested = true;
  }

  // Switch Manual <-> Auto. Blocked while a round/auto run is live. If a result
  // is on screen, drop back to the picking screen (guesses kept) so the choices
  // are visible for the newly selected mode.
  function selectMode(mode: 'manual' | 'auto') {
    if (autoRunning || gameState === 'playing') return;
    betMode = mode;
    if (gameState === 'won' || gameState === 'lost') retryGame();
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

  function retryGame() {
    // Deliberately keep colorChoice/hlChoice/ioChoice/suitChoice so the
    // player's guesses persist across rounds - they can press Start again
    // immediately, or tweak a choice first, without re-picking all four.
    gameState = 'start';
    revealedCards = [null, null, null, null];
    stageMultipliers = [null, null, null, null];
    runningWin = 0;
    revealEvents = [];
    bustedIndex = null;
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

<div class="game-layout" style={`--backdrop-url: url(${backdropUrl})`}>
  <aside class="sidebar">
    <div class="sidebar-title">Ride the Bus</div>

    <div class="mode-toggle" role="tablist" aria-label="Play mode">
      <button
        type="button"
        class="mode-tab"
        class:active={betMode === 'manual'}
        role="tab"
        aria-selected={betMode === 'manual'}
        disabled={autoRunning || gameState === 'playing'}
        onclick={() => selectMode('manual')}
      >Manual</button>
      <button
        type="button"
        class="mode-tab"
        class:active={betMode === 'auto'}
        role="tab"
        aria-selected={betMode === 'auto'}
        disabled={autoRunning || gameState === 'playing'}
        onclick={() => selectMode('auto')}
      >Auto</button>
    </div>

    <div class="control-group">
      <span class="control-label">Bet Amount</span>
      <div class="bet-selector">
        <div class="bet-field">
          <div class="bet-amount-row" bind:this={betRowEl}>
            <span class="bet-currency">$</span>
            <input
              class="bet-input"
              type="text"
              inputmode="decimal"
              bind:value={betInput}
              onblur={formatBetInput}
              placeholder="0.00"
              aria-label="Bet amount"
            />
          </div>
        </div>
        <div class="bet-stepper">
          <button type="button" class="stepper-btn" onclick={() => stepBet(1)} aria-label="Increase bet">▲</button>
          <button type="button" class="stepper-btn" onclick={() => stepBet(-1)} aria-label="Decrease bet">▼</button>
        </div>
      </div>
    </div>

    {#if betMode === 'auto'}
      <div class="control-group">
        <span class="control-label">Number of Rounds</span>
        <div class="rounds-selector">
          <div class="rounds-field">
            {#if autoInfinite}
              <span class="rounds-infinite" aria-label="Infinite rounds">∞</span>
            {:else}
              <input
                class="rounds-input"
                type="text"
                inputmode="numeric"
                bind:value={autoRoundsInput}
                onblur={formatAutoRounds}
                aria-label="Number of rounds"
                disabled={autoRunning}
              />
            {/if}
          </div>
          <div class="rounds-stepper">
            <button type="button" class="stepper-btn" onclick={() => stepAutoRounds(1)} disabled={autoRunning} aria-label="More rounds">▲</button>
            <button type="button" class="stepper-btn" onclick={() => stepAutoRounds(-1)} disabled={autoRunning} aria-label="Fewer rounds">▼</button>
          </div>
        </div>
        <div class="rounds-presets">
          {#each AUTO_ROUND_PRESETS as preset}
            <button
              type="button"
              class="rounds-preset"
              class:active={!autoInfinite && Math.floor(Number(autoRoundsInput)) === preset}
              onclick={() => setAutoRounds(preset)}
              disabled={autoRunning}
            >{preset}</button>
          {/each}
          <button
            type="button"
            class="rounds-preset rounds-preset-inf"
            class:active={autoInfinite}
            onclick={toggleAutoInfinite}
            disabled={autoRunning}
            aria-pressed={autoInfinite}
          >∞</button>
        </div>
      </div>

      <div class="advanced-row">
        <span class="control-label">Advanced{#if !ADVANCED_ENABLED}<span class="soon-tag">Soon</span>{/if}</span>
        <button
          type="button"
          class="switch"
          class:on={advancedMode}
          role="switch"
          aria-checked={advancedMode}
          aria-label="Advanced auto-bet options"
          title={ADVANCED_ENABLED ? undefined : 'Advanced auto-bet is disabled pending approval'}
          disabled={autoRunning || !ADVANCED_ENABLED}
          onclick={() => { if (ADVANCED_ENABLED) advancedMode = !advancedMode; }}
        ><span class="switch-knob"></span></button>
      </div>

      {#if ADVANCED_ENABLED && advancedMode}
        <div class="control-group">
          <span class="control-label">On Win</span>
          <div class="strategy-row">
            <div class="seg">
              <button type="button" class:active={onWinMode === 'reset'} disabled={autoRunning} onclick={() => (onWinMode = 'reset')}>Reset</button>
              <button type="button" class:active={onWinMode === 'increase'} disabled={autoRunning} onclick={() => (onWinMode = 'increase')}>Increase by:</button>
            </div>
            <div class="pct-field" class:disabled={onWinMode !== 'increase'}>
              <input class="pct-input" type="text" inputmode="decimal" bind:value={onWinPct} disabled={onWinMode !== 'increase' || autoRunning} aria-label="On win increase percent" />
              <span class="pct-sign">%</span>
            </div>
          </div>
        </div>

        <div class="control-group">
          <span class="control-label">On Loss</span>
          <div class="strategy-row">
            <div class="seg">
              <button type="button" class:active={onLossMode === 'reset'} disabled={autoRunning} onclick={() => (onLossMode = 'reset')}>Reset</button>
              <button type="button" class:active={onLossMode === 'increase'} disabled={autoRunning} onclick={() => (onLossMode = 'increase')}>Increase by:</button>
            </div>
            <div class="pct-field" class:disabled={onLossMode !== 'increase'}>
              <input class="pct-input" type="text" inputmode="decimal" bind:value={onLossPct} disabled={onLossMode !== 'increase' || autoRunning} aria-label="On loss increase percent" />
              <span class="pct-sign">%</span>
            </div>
          </div>
        </div>

        <div class="control-group">
          <span class="control-label-row"><span>Stop on Profit</span><span class="stop-preview">{numberToCurrencyString(toNum(stopOnProfit))}</span></span>
          <div class="amount-field">
            <input class="amount-input" type="text" inputmode="decimal" bind:value={stopOnProfit} placeholder="0.00" aria-label="Stop on profit amount" disabled={autoRunning} />
            <span class="currency-badge">$</span>
          </div>
        </div>

        <div class="control-group">
          <span class="control-label-row"><span>Stop on Loss</span><span class="stop-preview">{numberToCurrencyString(toNum(stopOnLoss))}</span></span>
          <div class="amount-field">
            <input class="amount-input" type="text" inputmode="decimal" bind:value={stopOnLoss} placeholder="0.00" aria-label="Stop on loss amount" disabled={autoRunning} />
            <span class="currency-badge">$</span>
          </div>
        </div>
      {/if}
    {/if}

    {#if autoRunning}
      <button class="action-button stop" onclick={stopAuto}>
        Stop{autoInfinite ? '' : ` · ${autoRemaining} left`}
      </button>
    {:else if betMode === 'auto'}
      <button
        class="action-button"
        onclick={startAuto}
        disabled={(IS_PROD && resolveRoundSeed().source === 'none') || !betIsValid() || !allChoicesMade() || !autoRoundsValid() || isProcessing}
      >
        {#if !allChoicesMade()}Pick all 4 guesses{:else if !betIsValid()}Enter a valid bet{:else if !autoRoundsValid()}Set rounds{:else}Start Auto{/if}
      </button>
    {:else if gameState === 'start'}
      <button
        class="action-button"
        onclick={startGame}
        disabled={(IS_PROD && resolveRoundSeed().source === 'none') || !betIsValid() || !allChoicesMade() || isProcessing}
      >
        {#if !allChoicesMade()}Pick all 4 guesses{:else if !betIsValid()}Enter a valid bet{:else}Start{/if}
      </button>
    {:else if gameState === 'playing'}
      <button class="action-button" disabled>Revealing…</button>
    {:else}
      <button class="action-button replay" onclick={retryGame}>Play Again</button>
    {/if}

    <div class="control-group">
      <span class="control-label">Total Profit ({initialBet > 0 && wonAmount > 0 ? (wonAmount / initialBet).toFixed(2) : '0.00'}×)</span>
      <div class="profit-display">{numberToCurrencyString(wonAmount)}</div>
    </div>

    <div class="wallet-info">
      <div><span>Balance</span><strong>{numberToCurrencyString(stateBet.balanceAmount)}</strong></div>
      <div><span>Current Bet</span><strong>{numberToCurrencyString(stateBet.betAmount)}</strong></div>
    </div>

    <div class="round-debug" aria-live="polite">
      <span>Source: {roundSource}</span>
      <span>Round: {lastRoundId || 'not started'}</span>
    </div>
  </aside>

  <main class="game-main">
    {#snippet cardRow()}
      <div class="card-row">
        {#each revealedCards as card, index}
          <div class="card-slot">
            <div class="card-mult" class:show={stageMultipliers[index] !== null}>
              {(stageMultipliers[index] ?? 0).toFixed(2)}×
            </div>
            <div class="card-block" class:revealed={card} class:busted={index === bustedIndex}>
              {#if card}
                <div class="card-face" class:red-card={card.suit === '♥' || card.suit === '♦'} class:black-card={card.suit === '♠' || card.suit === '♣'}>
                  <div class="rank top">{card.rank}</div>
                  <div class="suit center">{card.suit}</div>
                  <div class="rank bottom">{card.rank}</div>
                </div>
              {:else}
                <div class="card-back" aria-hidden="true"></div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/snippet}

    {#snippet runningWinBar()}
      <div class="running-win">
        <span class="running-win-label">Winning</span>
        <span class="running-win-amount">{numberToCurrencyString(runningWin)}</span>
      </div>
    {/snippet}

    {#if gameState === 'start'}
      {@render cardRow()}
      <div class="choice-row">
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
    {/if}

    {#if gameState === 'playing' || gameState === 'lost'}
      {@render cardRow()}
      {@render runningWinBar()}
      <div class="game-stage">
        {#if gameState === 'lost'}
          <p>You busted on the first card and lost your bet.</p>
        {:else}
          <p>Revealing your cards…</p>
        {/if}
      </div>
    {/if}

    {#if gameState === 'won'}
      <div class="result-screen">
        {@render cardRow()}
        <div class="result-hero">
          <p class="result-kicker">{bustedIndex === null ? 'Full Game Win' : 'You Rode The Bus'}</p>
          {#if bustedIndex === null}
            <h2>Congratulations! Full Game Win</h2>
            <p class="result-copy">You correctly guessed all four cards!</p>
          {:else}
            <h2>Banked before the bust!</h2>
            <p class="result-copy">You missed on card {bustedIndex + 1}, but kept the winnings earned up to there.</p>
          {/if}
          <div class="result-total">x{initialBet > 0 ? (wonAmount / initialBet).toFixed(2) : '0.00'} — ${wonAmount.toFixed(2)}</div>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  :global(html, body) {
    height: 100%;
    margin: 0;
  }

  :global(body) {
    background: #0b1420;
    min-height: 100vh;
  }

  /* Two-column layout: a fixed control sidebar plus a game area that fills the
     rest of the viewport. The old single-column stack pushed the wager field
     and Start button off the bottom of the screen at most heights; here the
     controls live in the always-visible sidebar and the game centres itself
     in the remaining space. */
  .game-layout {
    /* Sizes are driven by these so the media queries at the bottom can rescale
       the whole game for small / short / portrait viewports in one place. */
    --sidebar-w: 300px;
    --card-w: 102px;
    --card-h: 152px;
    --card-radius: 10px;
    --rank-fs: 17px;
    --suit-fs: 46px;
    --choice-size: 92px;
    --choice-fs: 1.4rem;
    --quad-fs: 1.6rem;
    --gap: 24px;
    --pad: 24px;
    height: 100vh;
    width: 100vw;
    display: flex;
    box-sizing: border-box;
    background: var(--backdrop-url) center/cover no-repeat fixed;
    overflow: hidden;
  }

  .sidebar {
    flex: 0 0 var(--sidebar-w);
    height: 100%;
    box-sizing: border-box;
    padding: 18px 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: rgba(8, 15, 24, 0.85);
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    overflow-y: auto;
  }

  .game-main {
    flex: 1 1 auto;
    height: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: var(--pad);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--gap);
    overflow-y: auto;
  }

  .sidebar-title {
    font-size: 1.25rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #fff2c8;
    text-align: center;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .control-label {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #93a4b5;
  }

  /* Bet selector: "BET / $amount" on the left, a vertical up/down stepper on
     the right, in one rounded control. */
  .bet-selector {
    display: flex;
    align-items: stretch;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(5, 12, 18, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.16);
  }

  .bet-field {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 6px 12px;
  }

  .bet-amount-row {
    display: flex;
    align-items: baseline;
    gap: 1px;
    font-size: 20px;
    line-height: 1.05;
  }

  .bet-currency {
    flex: 0 0 auto;
    font-size: inherit;
    font-weight: 800;
    color: #fff;
  }

  .action-button {
    width: 100%;
    padding: 14px;
    font-size: 1.05rem;
    font-weight: 800;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    background: linear-gradient(180deg, #4c9ffe, #1f6fe0);
    color: #fff;
    letter-spacing: 0.03em;
    box-shadow: 0 6px 16px rgba(31, 111, 224, 0.35);
  }
  .action-button:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
  .action-button:not(:disabled):hover { filter: brightness(1.08); }
  .action-button:not(:disabled):active { transform: translateY(1px); }
  .action-button.replay {
    background: linear-gradient(180deg, #ffb64c, #e08a1f);
    box-shadow: 0 6px 16px rgba(224, 138, 31, 0.35);
  }
  /* Stop (auto running) - a clear danger action. */
  .action-button.stop {
    background: linear-gradient(180deg, #ff5d5d, #d63a3a);
    box-shadow: 0 6px 16px rgba(214, 58, 58, 0.35);
  }

  /* Manual | Auto segmented control (top of the sidebar). The global
     `button { padding/font/text-transform }` in app.css is overridden per
     element below (incl. text-transform:none so it reads "Manual"/"Auto"). */
  .mode-toggle {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: rgba(5, 12, 18, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .mode-tab {
    flex: 1 1 0;
    min-width: 0;
    padding: 9px 8px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: #93a4b5;
    font-size: 0.9rem;
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .mode-tab.active {
    background: linear-gradient(180deg, #3a4d63, #2c3d50);
    color: #fff;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  }
  .mode-tab:not(.active):not(:disabled):hover { color: #cfe0f0; }
  .mode-tab:disabled { cursor: not-allowed; opacity: 0.55; }

  /* Number-of-Rounds selector: mirrors the bet selector (field + vertical
     stepper), with a row of quick presets under it. Reuses .stepper-btn. */
  .rounds-selector {
    display: flex;
    align-items: stretch;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(5, 12, 18, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.16);
  }
  .rounds-field {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    padding: 6px 12px;
  }
  .rounds-input {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
    font-size: 18px;
    font-weight: 800;
    padding: 0;
    border: none;
    outline: none;
    color: #fff;
    background: transparent;
    box-sizing: border-box;
  }
  .rounds-input:disabled { color: rgba(255, 255, 255, 0.55); }
  .rounds-infinite {
    font-size: 20px;
    font-weight: 800;
    line-height: 1;
    color: #fff;
  }
  .rounds-stepper {
    flex: 0 0 auto;
    width: 46px;
    display: flex;
    flex-direction: column;
    border-left: 1px solid rgba(255, 255, 255, 0.16);
  }
  .rounds-presets {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }
  .rounds-preset {
    flex: 1 1 0;
    min-width: 0;
    padding: 6px 0;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    background: rgba(5, 12, 18, 0.5);
    color: #93a4b5;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: none;
    cursor: pointer;
    transition: color 0.12s, border-color 0.12s, background 0.12s;
  }
  .rounds-preset:not(:disabled):hover { color: #cfe0f0; border-color: rgba(255, 255, 255, 0.28); }
  .rounds-preset.active {
    background: rgba(76, 159, 254, 0.2);
    border-color: rgba(76, 159, 254, 0.6);
    color: #fff;
  }
  .rounds-preset:disabled { opacity: 0.5; cursor: not-allowed; }
  .rounds-preset-inf { font-size: 1rem; line-height: 1; }

  /* Advanced auto-bet panel (Stake-style): a switch that reveals On Win /
     On Loss bet progression and Stop on Profit / Stop on Loss limits. */
  .advanced-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  /* "Soon" tag shown next to Advanced while the bet-progression panel is gated
     off (ADVANCED_ENABLED = false) pending Stake approval. */
  .soon-tag {
    margin-left: 6px;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    color: #8296a8;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: none;
    vertical-align: middle;
  }
  .switch {
    flex: 0 0 auto;
    width: 44px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    position: relative;
    cursor: pointer;
    transition: background 0.15s;
  }
  .switch.on { background: #1f8fff; }
  .switch:disabled { opacity: 0.55; cursor: not-allowed; }
  .switch-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s;
  }
  .switch.on .switch-knob { transform: translateX(20px); }

  /* On Win / On Loss: a Reset | Increase-by segmented toggle plus a % field. */
  .strategy-row {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }
  .seg {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(5, 12, 18, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.16);
  }
  .seg button {
    flex: 1 1 0;
    min-width: 0;
    padding: 8px 4px;
    border: none;
    background: transparent;
    color: #93a4b5;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: none;
    white-space: nowrap;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
  }
  .seg button.active { background: rgba(76, 159, 254, 0.2); color: #fff; }
  .seg button:not(.active):not(:disabled):hover { color: #cfe0f0; }
  .seg button:disabled { cursor: not-allowed; opacity: 0.6; }

  .pct-field {
    flex: 0 0 auto;
    width: 72px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 8px;
    border-radius: 8px;
    background: rgba(5, 12, 18, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.16);
  }
  .pct-field.disabled { opacity: 0.5; }
  .pct-input {
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
    padding: 8px 0;
    border: none;
    outline: none;
    background: transparent;
    color: #fff;
    font-weight: 700;
    font-size: 0.85rem;
    text-align: right;
  }
  .pct-sign { flex: 0 0 auto; color: #93a4b5; font-size: 0.8rem; font-weight: 700; }

  /* Stop on Profit / Stop on Loss: label with a live $ readout, then an amount
     field with a currency badge. */
  .control-label-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #93a4b5;
  }
  .stop-preview { color: #6f8296; letter-spacing: 0; text-transform: none; font-weight: 700; }
  .amount-field {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    border-radius: 8px;
    background: rgba(5, 12, 18, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.16);
  }
  .amount-input {
    flex: 1 1 auto;
    min-width: 0;
    padding: 10px 0;
    border: none;
    outline: none;
    background: transparent;
    color: #fff;
    font-weight: 700;
    font-size: 0.95rem;
  }
  .currency-badge {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #26a17b;
    color: #fff;
    font-size: 0.72rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .profit-display {
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(5, 12, 18, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #ffd77e;
    font-weight: 700;
    font-size: 1.05rem;
  }

  .wallet-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .wallet-info div {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: #b9c6d3;
  }
  .wallet-info strong { color: #fff; }

  .round-debug {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.68rem;
    color: #5f7182;
    word-break: break-all;
  }

  .card-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-end;
    gap: var(--gap);
    margin: 0;
  }

  /* Each card sits in a slot with its cumulative win multiplier above it. */
  .card-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .card-mult {
    min-height: 24px;
    padding: 2px 12px;
    border-radius: 999px;
    font-size: 0.95rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #7cffb2;
    background: rgba(6, 24, 16, 0.72);
    border: 1px solid rgba(124, 255, 178, 0.4);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
  .card-mult.show {
    opacity: 1;
    transform: translateY(0);
  }

  /* Running cash won so far, shown under the cards during the reveal. */
  .running-win {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .running-win-label {
    font-size: 0.7rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #cfe8d8;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  }
  .running-win-amount {
    font-size: 1.9rem;
    font-weight: 900;
    color: #7cffb2;
    text-shadow: 0 3px 14px rgba(0, 0, 0, 0.65);
  }

  /* ---------- Responsive ----------
     The game has a lot of fixed content (4 cards + 4 choice squares + the
     control panel), so instead of one breakpoint we rescale the whole thing
     via the --card/--choice/--sidebar variables per viewport shape:
       - portrait phones: stack controls on top, shrink cards/choices so all
         four stay on one row and everything fits without scrolling;
       - short landscape "popout" windows: keep the sidebar beside the game
         but shrink both to fit the limited height. */

  /* Portrait (phones): stack the control panel above a compact game area. */
  @media (orientation: portrait) {
    .game-layout {
      flex-direction: column;
      --card-w: 60px; --card-h: 88px; --card-radius: 7px;
      --rank-fs: 11px; --suit-fs: 26px;
      --choice-size: 62px; --choice-fs: 0.95rem; --quad-fs: 1.05rem;
      --gap: 12px; --pad: 12px;
    }
    .sidebar {
      flex: 0 0 auto;
      height: auto;
      width: 100%;
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 10px 14px;
      gap: 8px;
    }
    .sidebar-title { font-size: 1rem; padding-bottom: 8px; }
    .action-button { padding: 10px; font-size: 0.95rem; }
    .wallet-info {
      margin-top: 8px;
      padding-top: 8px;
      flex-direction: row;
      justify-content: space-between;
      gap: 16px;
    }
    .wallet-info div { flex-direction: column; gap: 0; }
    .round-debug { display: none; }
    .game-main { min-height: 0; }
    .choice-label { font-size: 0.6rem; letter-spacing: 0.05em; }
    .card-mult { font-size: 0.8rem; min-height: 20px; padding: 1px 9px; }
    .running-win-amount { font-size: 1.5rem; }
  }

  /* Short landscape (popout windows): keep the row layout, shrink to fit. */
  @media (orientation: landscape) and (max-height: 520px) {
    .game-layout {
      --sidebar-w: 172px;
      --card-w: 54px; --card-h: 78px; --card-radius: 6px;
      --rank-fs: 10px; --suit-fs: 24px;
      --choice-size: 58px; --choice-fs: 0.9rem; --quad-fs: 1rem;
      --gap: 10px; --pad: 12px;
    }
    .sidebar { padding: 10px 12px; gap: 8px; }
    .sidebar-title { font-size: 0.95rem; padding-bottom: 8px; }
    .action-button { padding: 9px; font-size: 0.9rem; }
    .round-debug { display: none; }
    .card-mult { font-size: 0.8rem; min-height: 20px; }
    .running-win-amount { font-size: 1.5rem; }
    .mode-tab { padding: 7px 6px; font-size: 0.78rem; }
    .rounds-field { padding: 4px 10px; }
    .rounds-input, .rounds-infinite { font-size: 15px; }
    .rounds-preset { padding: 5px 0; font-size: 0.68rem; }
  }

  /* Tiny popout (e.g. 400x225): minimal control panel + very small game. */
  @media (orientation: landscape) and (max-height: 320px) {
    .game-layout {
      --sidebar-w: 138px;
      --card-w: 38px; --card-h: 55px; --card-radius: 4px;
      --rank-fs: 8px; --suit-fs: 17px;
      --choice-size: 44px; --choice-fs: 0.7rem; --quad-fs: 0.8rem;
      --gap: 6px; --pad: 8px;
    }
    .sidebar { padding: 6px 8px; gap: 5px; }
    .sidebar-title { font-size: 0.78rem; padding-bottom: 5px; }
    .control-label { font-size: 0.58rem; }
    .bet-field { padding: 4px 8px; }
    .bet-amount-row { font-size: 14px; }
    .bet-stepper { width: 30px; }
    .stepper-btn { font-size: 0.6rem; padding: 4px 0; }
    .action-button { padding: 6px; font-size: 0.72rem; }
    .profit-display { font-size: 0.8rem; padding: 5px 7px; }
    .wallet-info { gap: 3px; padding-top: 5px; }
    .wallet-info div { font-size: 0.62rem; }
    .running-win-amount { font-size: 1.1rem; }
    .running-win-label { font-size: 0.55rem; }
    .card-mult { font-size: 0.62rem; min-height: 15px; padding: 0 6px; }
    .equal-btn { width: 13px; height: 13px; font-size: 0.5rem; }
    .mode-toggle { padding: 3px; }
    .mode-tab { padding: 5px 4px; font-size: 0.6rem; }
    .rounds-field { padding: 3px 8px; }
    .rounds-input, .rounds-infinite { font-size: 13px; }
    .rounds-stepper { width: 30px; }
    .rounds-presets { gap: 4px; margin-top: 4px; }
    .rounds-preset { padding: 3px 0; font-size: 0.58rem; }
    .switch { width: 34px; height: 19px; }
    .switch-knob { width: 15px; height: 15px; }
    .switch.on .switch-knob { transform: translateX(15px); }
    .strategy-row { gap: 5px; }
    .seg button { padding: 4px 2px; font-size: 0.52rem; }
    .pct-field { width: 50px; padding: 0 5px; }
    .pct-input { font-size: 0.62rem; padding: 4px 0; }
    .control-label-row { font-size: 0.58rem; }
    .amount-input { font-size: 0.72rem; padding: 5px 0; }
    .currency-badge { width: 15px; height: 15px; font-size: 0.56rem; }
  }

  /* Choice squares */
  .choice-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--gap);
    margin: 0;
  }

  .choice-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .choice-label {
    font-size: 0.75rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #fff6df;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
  }

  .choice-square {
    position: relative;
    width: var(--choice-size);
    height: var(--choice-size);
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35), 0 0 0 2px rgba(255, 255, 255, 0.25);
  }

  .half-btn,
  .third-btn,
  .quad-btn {
    border: none;
    cursor: pointer;
    padding: 0;
    margin: 0;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--choice-fs);
    font-weight: 800;
    line-height: 1;
    transition: filter 0.15s, transform 0.15s;
  }

  .half-btn.selected,
  .third-btn.selected,
  .quad-btn.selected {
    filter: brightness(1.3);
    box-shadow: inset 0 0 0 3px #fff, inset 0 0 16px rgba(255, 255, 255, 0.5);
  }

  /* All choice squares use CSS Grid (not flexbox) so adjacent cells share
     exact pixel boundaries - flex:1 splits can leave a subpixel seam where
     the square's background shows through between segments. */

  /* Color square: left/right halves */
  .color-square {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .black-half {
    background: #16181c;
  }
  .red-half {
    background: #c0392b;
  }

  /* Higher/Lower square: top/bottom halves + center equal square */
  .hl-square {
    display: grid;
    grid-template-rows: 1fr 1fr;
  }
  .higher-third {
    background: #2ecc71;
  }
  .lower-third {
    background: #c0392b;
  }

  /* Inside/Outside square: left/right halves */
  .io-square {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .io-square .half-btn {
    font-size: 1rem;
  }
  .inside-half {
    background: #00bcd4;
  }
  .outside-half {
    background: #d81ce0;
  }

  /* Shared small "equal" square, centered over hl/io squares */
  .equal-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 18px;
    height: 18px;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1c40f;
    border: 2px solid rgba(0, 0, 0, 0.45);
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: 800;
    line-height: 1;
    color: #16181c;
    cursor: pointer;
    z-index: 2;
  }
  .equal-btn.selected {
    box-shadow: 0 0 0 3px #fff, 0 0 12px rgba(255, 255, 255, 0.7);
    transform: translate(-50%, -50%) scale(1.15);
  }

  /* Suit square: 2x2 grid */
  .suit-square {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }
  .quad-btn {
    background: #16181c;
    font-size: var(--quad-fs);
  }
  .quad-btn.red-suit {
    color: #e74c3c;
  }

  /* The amount reads as plain bold text inside the field - the box border is
     on .bet-selector, not the input. Font-size is inherited from
     .bet-amount-row so the currency symbol and number scale together (auto-fit
     in fitBetFont). */
  .bet-input {
    flex: 1 1 auto;
    min-width: 0;
    font-size: inherit;
    font-weight: 800;
    padding: 0;
    border: none;
    outline: none;
    color: #fff;
    background: transparent;
    box-sizing: border-box;
  }

  .bet-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .bet-stepper {
    flex: 0 0 auto;
    width: 46px;
    display: flex;
    flex-direction: column;
    border-left: 1px solid rgba(255, 255, 255, 0.16);
  }

  .stepper-btn {
    flex: 1 1 0;
    border: none;
    /* Override the global `button { padding: 1.5rem }` from app.css, which
       otherwise makes each arrow button ~59px tall and forces the whole
       selector (via align-items: stretch) to ~119px. */
    padding: 9px 0;
    background: rgba(255, 255, 255, 0.07);
    color: #fff;
    font-size: 0.72rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
  }
  .stepper-btn:hover { background: rgba(255, 255, 255, 0.16); }
  .stepper-btn:active { background: rgba(255, 255, 255, 0.22); }
  .stepper-btn:first-child { border-bottom: 1px solid rgba(255, 255, 255, 0.12); }

  .result-screen {
    width: min(960px, 100%);
    margin: 12px auto 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22px;
    padding: 18px 18px 26px;
  }

  .result-hero {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 22px 18px 20px;
    border-radius: 24px;
    background: linear-gradient(180deg, rgba(7, 14, 24, 0.72), rgba(22, 36, 48, 0.52));
    border: 1px solid rgba(255, 235, 194, 0.2);
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .result-kicker {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.28em;
    font-size: 0.72rem;
    color: #ffd98b;
  }

  .result-hero h2 {
    margin: 0;
    color: #fff4d5;
    text-shadow: 0 3px 14px rgba(0, 0, 0, 0.7);
  }

  .result-copy {
    margin: 0;
    max-width: 640px;
    color: rgba(255, 248, 230, 0.9);
    text-align: center;
    line-height: 1.4;
  }

  .result-total {
    padding: 10px 18px;
    border-radius: 999px;
    background: rgba(255, 222, 149, 0.14);
    border: 1px solid rgba(255, 222, 149, 0.35);
    color: #fff8e6;
    font-size: 2rem;
    font-weight: 900;
    letter-spacing: 0.04em;
  }

  .game-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 40px;
  }

  .game-stage p {
    text-align: center;
    color: #fff4d5;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-shadow: 0 3px 12px rgba(0, 0, 0, 0.6);
    margin: 0;
  }

  .card-block {
    width: var(--card-w);
    height: var(--card-h);
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 18px;
    color: #fff;
    font-weight: bold;
    border-radius: var(--card-radius);
    box-shadow: 0 4px 8px rgba(0,0,0,0.3), inset 0 1px 3px rgba(255,255,255,0.2);
    letter-spacing: 1px;
    position: relative;
    overflow: hidden;
    border: 3px solid #8b7355;
    background-color: #1a5f7a;
  }

  .card-block::before {
    content: '';
    position: absolute;
    width: 60%;
    height: 80%;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .red-card {
    color: #ff4d4d;
  }
  .black-card {
    color: #fff;
  }

  /* Revealed (face-up) card styling */
  .card-block.revealed {
    background: #fff;
    color: #000;
    border: 2px solid #cfcfcf;
    box-shadow: 0 6px 12px rgba(0,0,0,0.25);
  }

  .card-block.revealed .card-back,
  .card-block.revealed::before {
    display: none;
  }

  .card-block.busted::after {
    content: '✕';
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 64px;
    font-weight: 900;
    color: #ff3b3b;
    text-shadow: 0 0 10px rgba(0, 0, 0, 0.85);
    background: rgba(0, 0, 0, 0.35);
  }

  .card-face {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: stretch;
    padding: 6px;
    box-sizing: border-box;
  }

  .card-face .rank {
    font-size: var(--rank-fs);
    font-weight: 700;
    line-height: 1;
  }

  .card-face .rank.top {
    align-self: flex-start;
  }

  .card-face .rank.bottom {
    align-self: flex-end;
    transform: rotate(180deg);
  }

  .card-face .suit.center {
    font-size: var(--suit-fs);
    text-align: center;
    margin: 0 auto;
    line-height: 1;
  }

  .card-face.red-card .suit.center,
  .card-face.red-card .rank { color: #c0392b; }

  .card-face.black-card .suit.center,
  .card-face.black-card .rank { color: #111; }

  /* Card back element (face-down) */
  .card-back {
    width: 100%;
    height: 100%;
    display: block;
    background: linear-gradient(135deg, #1a5f7a 0%, #0d3a52 50%, #1a5f7a 100%);
    border-radius: 6px;
  }
</style>
