<script lang="ts">
  import { base } from '$app/paths';
  import './app.css';
  import { createRoundContract, rankValue, type Card } from '../game/roundContract';
  import { stateBet, stateBetDerived, stateUrlDerived } from 'state-shared';
  import { requestBet } from 'rgs-requests';
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

  let gameState = $state<State>('start');
  let isProcessing = $state(false);

  let colorChoice = $state<ColorChoice>(null);
  let hlChoice = $state<HigherLowerChoice>(null);
  let ioChoice = $state<InsideOutsideChoice>(null);
  let suitChoice = $state<SuitChoice>(null);

  let revealEvents = $state<RevealEvent[]>([]);
  let revealedCards = $state<(Card | null)[]>([null, null, null, null]);
  let bustedIndex = $state<number | null>(null);
  // Set from the server's authoritative finalWin event on engine rounds so
  // the displayed win is exactly what the RGS credited (not a local recompute
  // that could drift by a floating-point hair). null => compute locally.
  let engineFinalMultiplier = $state<number | null>(null);

  let initialBet = $state(0);
  let betInput = $state('');
  let wonAmount = $state(0);
  let lastRoundId = $state('');
  let roundSource = $state<'engine-auth' | 'engine-replay' | 'local-fallback' | 'none'>('local-fallback');
  let roundDeckPreview = $state('');
  let roundSequence = $state(0);

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

  function setBet() {
    const value = Number(betInput);
    if (isNaN(value) || value <= 0) {
      alert('Invalid bet. Please enter a positive number.');
      return;
    }
    stateBetDerived.setBetAmount(value);
    betInput = stateBet.betAmount.toString();
  }

  async function playRevealSequence() {
    // Reveal one card at a time, stopping at the first miss - the round ends
    // where the player "gets off the bus". Unlike the old all-or-nothing
    // flow, a miss past stage 1 still banks partial winnings, so a bust is
    // no longer automatically a loss.
    for (let i = 0; i < revealEvents.length; i++) {
      await wait(650);
      revealedCards[i] = revealEvents[i].card;
      if (!revealEvents[i].correct) {
        bustedIndex = i;
        await wait(900);
        break;
      }
    }

    await wait(300);
    // Prefer the server's authoritative payout on engine rounds; fall back to
    // the local formula (identical maths) when there's no RGS session.
    const multiplier = engineFinalMultiplier ?? computeFinalMultiplier(revealEvents);
    wonAmount = multiplier * initialBet;
    // Local-fallback has no server to credit it - the engine path's balance
    // was already settled by the /wallet/play response in
    // startGameEngineFlow (a single atomic bet, no separate end-round).
    if (!isEngineRound()) {
      stateBet.balanceAmount += wonAmount;
    }
    gameState = wonAmount > 0 ? 'won' : 'lost';
  }

  async function startGameEngineFlow(roundSeedData: { seed: string; source: 'engine-auth' | 'engine-replay' }) {
    isProcessing = true;
    try {
      const mode = `${colorChoice}_${hlChoice}_${ioChoice}_${suitChoice}`;
      const data = await requestBet({
        rgsUrl: stateUrlDerived.rgsUrl(),
        sessionID: stateUrlDerived.sessionID(),
        currency: stateBet.currency || 'USD',
        mode,
        amount: initialBet,
      });

      if (data?.balance?.amount !== undefined) {
        stateBet.balanceAmount = data.balance.amount / API_AMOUNT_MULTIPLIER;
      }

      const events = data?.round?.state;
      if (!Array.isArray(events) || events.length === 0) {
        throw new Error('Empty round/state from play API');
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
      bustedIndex = null;
      wonAmount = 0;
      gameState = 'playing';
      playRevealSequence();
    } catch (err) {
      console.error(err);
      alert('Engine play failed: ' + ((err as any)?.message || String(err)));
    } finally {
      isProcessing = false;
    }
  }

  function startGame() {
    if (stateBet.betAmount <= 0) {
      alert('Set a bet amount first.');
      return;
    }
    if (!allChoicesMade()) {
      alert('Pick all four options first.');
      return;
    }

    initialBet = stateBet.betAmount;
    const roundSeedData = resolveRoundSeed();

    if (roundSeedData.source === 'engine-auth' || roundSeedData.source === 'engine-replay') {
      startGameEngineFlow(roundSeedData).catch((err) => {
        console.error('Engine flow failed', err);
      });
      return;
    }

    // local deterministic fallback (dev): simulate the debit a real
    // /wallet/play call would make, so balance behaves like prod.
    stateBet.balanceAmount -= initialBet;
    const round = createRoundContract(`${roundSeedData.seed}:${roundSequence}`);
    roundSequence += 1;
    lastRoundId = round.roundId;
    roundSource = roundSeedData.source;
    roundDeckPreview = round.deck.slice(0, 4).map((card) => `${card.rank}${card.suit}`).join(' ');
    revealEvents = buildLocalRevealEvents(round.deck);
    engineFinalMultiplier = null; // local round computes its own payout
    revealedCards = [null, null, null, null];
    bustedIndex = null;
    wonAmount = 0;
    gameState = 'playing';
    playRevealSequence();
  }

  function retryGame() {
    gameState = 'start';
    revealedCards = [null, null, null, null];
    revealEvents = [];
    bustedIndex = null;
    colorChoice = null;
    hlChoice = null;
    ioChoice = null;
    suitChoice = null;
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

<div class="game-container" style={`--backdrop-url: url(${backdropUrl})`}>
  <h1>Ride the Bus</h1>

  <div class="round-debug" aria-live="polite">
    <span>Round source: {roundSource}</span>
    <span>Round ID: {lastRoundId || 'not started'}</span>
    <span>Deck preview: {roundDeckPreview || 'n/a'}</span>
  </div>

  <div class="wallet-bar" aria-live="polite">
    <span>Balance: {numberToCurrencyString(stateBet.balanceAmount)}</span>
    <span>Current Bet: {numberToCurrencyString(stateBet.betAmount)}</span>
  </div>

  {#if gameState === 'start'}
    <div class="card-row">
      {#each revealedCards as _card}
        <div class="card-block">
          <div class="card-back" aria-hidden="true"></div>
        </div>
      {/each}
    </div>

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

    <div class="start-panel">
      <div class="start-stack">
        <div class="wager-field">
          <label for="bet">Wager</label>
          <input id="bet" class="bet-input" type="number" bind:value={betInput} min="1" placeholder="e.g. 10" />
          <button class="secondary-button" onclick={setBet}>Set Bet</button>
        </div>
        <button
          class="start-button"
          onclick={startGame}
          disabled={(IS_PROD && resolveRoundSeed().source === 'none') || stateBet.betAmount <= 0 || !allChoicesMade() || isProcessing}
        >
          Start
        </button>
      </div>
    </div>
  {/if}

  {#if gameState === 'playing'}
    <div class="card-row">
      {#each revealedCards as card, index}
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
      {/each}
    </div>
    <div class="game-stage">
      <p>Revealing your cards…</p>
    </div>
  {/if}

  {#if gameState === 'lost'}
    <div class="card-row">
      {#each revealedCards as card, index}
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
      {/each}
    </div>
    <div class="game-stage">
      <p>You busted on the first card and lost your bet.</p>
      <div class="button-group">
        <button class="secondary-button" onclick={retryGame}>Retry</button>
      </div>
    </div>
  {/if}

  {#if gameState === 'won'}
    <div class="result-screen">
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

      <div class="result-actions">
        <button class="secondary-button" onclick={retryGame}>Play Again</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .card-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 30px;
    margin: 26px 0 18px;
  }

  :global(html, body) {
    height: 100%;
    margin: 0;
  }

  :global(body) {
    background: #000;
    background-color: transparent;
    min-height: 100vh;
  }

  .game-container {
    min-height: 100vh;
    width: 100vw;
    padding: 24px;
    box-sizing: border-box;
    background: var(--backdrop-url) center/cover no-repeat fixed;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
  }

  .game-container h1 {
    margin: 34px 0 12px;
    padding: 10px 22px;
    border-radius: 999px;
    background: rgba(10, 18, 28, 0.58);
    color: #fff2c8;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.78), 0 0 14px rgba(255, 215, 126, 0.25);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.12);
    letter-spacing: 0.04em;
  }

  .round-debug {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px 16px;
    margin-bottom: 12px;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(7, 14, 24, 0.45);
    color: #fff4d5;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
  }

  .wallet-bar {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px 24px;
    margin-bottom: 16px;
    padding: 10px 18px;
    border-radius: 999px;
    background: rgba(7, 14, 24, 0.65);
    color: #ffd77e;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  /* Choice squares */
  .choice-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 22px;
    margin: 6px 0 10px;
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
    width: 92px;
    height: 92px;
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
    font-size: 1.4rem;
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
    font-size: 1.6rem;
  }
  .quad-btn.red-suit {
    color: #e74c3c;
  }

  /* Start panel styles */
  .start-panel {
    display: flex;
    justify-content: center;
    width: 100%;
    margin-top: 6px;
  }

  .start-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .wager-field {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px 10px;
  }

  .wager-field label {
    flex-basis: 100%;
    text-align: center;
    font-size: 0.85rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #fff6df;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
  }

  .bet-input {
    font-size: 20px;
    padding: 10px 14px;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.55);
    width: 180px;
    text-align: center;
    color: #fff;
    background: rgba(5, 12, 18, 0.38);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255,255,255,0.14);
  }

  .bet-input::placeholder {
    color: rgba(255, 255, 255, 0.55);
  }

  .start-button {
    padding: 12px 30px;
    font-size: 20px;
    font-weight: 800;
    background: linear-gradient(180deg, #ff6464, #c72c41);
    color: #fff;
    border-radius: 14px;
    border: none;
    cursor: pointer;
    box-shadow: 0 8px 18px rgba(199, 44, 65, 0.38);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .start-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .start-button:hover { transform: translateY(-2px) scale(1.03); }

  .start-button:active { transform: translateY(0) scale(0.98); }

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

  .result-actions {
    display: flex;
    justify-content: center;
  }

  .secondary-button {
    padding: 12px 24px;
    border-radius: 999px;
    background: rgba(7, 14, 24, 0.58);
    color: #fff4d5;
    border: 1px solid rgba(255, 244, 213, 0.28);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.22);
    cursor: pointer;
  }

  .game-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 60px;
  }

  .game-stage p {
    text-align: center;
    color: #fff4d5;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-shadow: 0 3px 12px rgba(0, 0, 0, 0.6);
    margin: 0 0 16px 0;
  }

  .button-group {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 15px;
    margin-top: 20px;
  }

  .card-block {
    width: 102px;
    height: 152px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 18px;
    color: #fff;
    font-weight: bold;
    border-radius: 10px;
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
    font-size: 17px;
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
    font-size: 46px;
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
