<script lang="ts">
  // cd C:\Users\tcand\OneDrive\Desktop\Stake Game\web-sdk\apps\Ride-The-Bus>  
  // cd C:\Users\Owner\Desktop\Stake Engine Game\web-sdk\apps\ride-the-bus> 
  // npm run dev
  import './app.css';
  import { createRoundContract, rankValue, type Card } from '../game/roundContract';
  import { stateBet, stateUrlDerived } from 'state-shared';
  import { requestBet } from 'rgs-requests';
  import { playBet } from '../game/utils';
  import { eventEmitter } from '../game/eventEmitter';
  import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
  import { sendChoice } from '../game/engineChoice';

  type State = 'start' | 'playing' | 'won' | 'lost' | 'cashed';
  type EndMode = 'cashout' | 'full-win';
  type Props = { roundSeed?: string };
  const fallbackRoundSeed = 'ride-the-bus-local-round';
  let { roundSeed = fallbackRoundSeed }: Props = $props();

  const IS_PROD = Boolean((import.meta as any).env?.PROD);

  let gameState = $state<State>('start');
  let endMode = $state<EndMode>('cashout');
  let isProcessing = $state(false);

  let deck = $state<Card[]>([]);
  let currentIndex = $state(0);
  let roundSequence = $state(0);

  // Store cards revealed so far (max 4)
  let revealedCards = $state<(Card | null)[]>([null, null, null, null]);

  let initialBet = $state(0); // Variable to hold the initial bet
  let betInput = $state(""); // Temporary variable to hold the user's input
  let cashoutAmount = $state(0); // Variable to hold the cashout amount
  let wonAmount = $state(0); // amount shown on cashout/win screen
  let lastRoundId = $state('');
  let roundSource = $state<'engine-auth' | 'engine-replay' | 'local-fallback' | 'none'>('local-fallback');
  let roundDeckPreview = $state('');
  let inputsEnabled = $state(true);
  let currentAwaitIndex = $state<number | null>(null);
  const HOUSE_EDGE = 0.02;
  let engineMultipliers = $state<any>({});
  let lastMultiplier = $state<number | null>(null);

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

    if (IS_PROD) return { seed: null as unknown as string, source: 'none' as const };

    return { seed: fallbackRoundSeed, source: 'local-fallback' as const };
  };

  async function startGameEngineFlow(roundSeedData: { seed: string; source: 'engine-auth' | 'engine-replay' }) {
    isProcessing = true;
    try {
      const data = await requestBet({
        rgsUrl: stateUrlDerived.rgsUrl(),
        sessionID: stateUrlDerived.sessionID(),
        currency: stateBet.currency || 'USD',
        mode: stateBet.activeBetModeKey || 'BASE',
        amount: initialBet,
      });

      if (!data || !data.round || !data.round.state || data.round.state.length === 0) {
        throw new Error('Empty round/state from play API');
      }

      // set identifying fields for UI
      lastRoundId = `${data.round.roundID ?? ''}`;
      roundSource = roundSeedData.source;

      // Hand off to shared play runner (will dispatch book events)
      await playBet(data.round as any);

      // After play completes, mark state appropriately.
      // playBet/book handlers should update global state; we simply ensure UI isn't stuck.
      gameState = 'cashed';
    } catch (err) {
      console.error(err);
      alert('Engine play failed: ' + ((err as any)?.message || String(err)));
    } finally {
      isProcessing = false;
    }
  }

  // subscribe to book/game events so engine-driven plays update UI
  eventEmitter.subscribeOnMount({
    winInfo: (ev: any) => {
      const totalWin = ev?.data?.totalWin;
      if (totalWin !== undefined && totalWin !== null) {
        wonAmount = totalWin / BOOK_AMOUNT_MULTIPLIER;
      }
      // capture payout multiplier if provided
      const pm = ev?.data?.payoutMultiplier ?? ev?.data?.multiplier ?? ev?.data?.payouts ?? null;
      if (pm !== null && pm !== undefined) {
        lastMultiplier = pm as number;
      }
    },
    finalWin: (ev: any) => {
      const amount = ev?.amount;
      if (amount !== undefined && amount !== null) {
        wonAmount = amount / BOOK_AMOUNT_MULTIPLIER;
      }
      // capture payout multiplier if provided on final win
      if (ev?.payoutMultiplier !== undefined && ev?.payoutMultiplier !== null) {
        lastMultiplier = ev.payoutMultiplier as number;
      }
      endMode = 'full-win';
      gameState = 'cashed';
    },
    engineReveal: (ev: any) => {
      const bookEvent = ev?.data;
      if (!bookEvent) return;
      const board = bookEvent.board ?? bookEvent.cards ?? null;
      if (Array.isArray(board)) {
        const flat = board.flat();
        flat.forEach((sym: any, i: number) => {
          if (!sym) return;
          if (typeof sym === 'object' && 'rank' in sym && 'suit' in sym) {
            revealedCards[i] = { rank: `${sym.rank}`, suit: `${sym.suit}` } as Card;
          } else if (typeof sym === 'string') {
            const m = /^([0-9]+|[JQKA])([♠♥♦♣SHDC])$/i.exec(sym);
            if (m) {
              let rank = m[1];
              let suit = m[2];
              if (suit.toUpperCase() === 'S') suit = '♠';
              if (suit.toUpperCase() === 'H') suit = '♥';
              if (suit.toUpperCase() === 'D') suit = '♦';
              if (suit.toUpperCase() === 'C') suit = '♣';
              revealedCards[i] = { rank, suit } as Card;
            }
          }
        });
      }
      // capture any multiplier/payout information provided by server in reveal events
      const pm = bookEvent.payouts ?? bookEvent.multipliers ?? bookEvent.options ?? bookEvent;
      if (pm) {
        // map common shapes into engineMultipliers
        if (pm.red !== undefined && pm.black !== undefined) engineMultipliers = { ...engineMultipliers, color: { red: pm.red, black: pm.black } };
        if (pm.higher !== undefined || pm.lower !== undefined || pm.equal !== undefined) engineMultipliers = { ...engineMultipliers, higherLower: { higher: pm.higher ?? 0, lower: pm.lower ?? 0, equal: pm.equal ?? 0 } };
        if (pm.inside !== undefined || pm.outside !== undefined || pm.equal !== undefined) engineMultipliers = { ...engineMultipliers, insideOutside: { inside: pm.inside ?? 0, outside: pm.outside ?? 0, equal: pm.equal ?? 0 } };
        if (pm.heart !== undefined || pm.diamond !== undefined || pm.club !== undefined || pm.spade !== undefined) engineMultipliers = { ...engineMultipliers, suit: { heart: pm.heart ?? 0, diamond: pm.diamond ?? 0, club: pm.club ?? 0, spade: pm.spade ?? 0 } };
        if (pm.payoutMultiplier !== undefined || pm.multiplier !== undefined) lastMultiplier = (pm.payoutMultiplier ?? pm.multiplier) as number;
      }
    },
    engineAwaitChoice: (ev: any) => {
      const idx = ev?.data?.index;
      currentAwaitIndex = idx ?? null;
      inputsEnabled = true;
      isProcessing = false;
      // server may provide choices' multipliers when awaiting a choice
      const pm = ev?.data?.payouts ?? ev?.data?.multipliers ?? ev?.data?.options ?? ev?.data;
      if (pm) {
        if (pm.red !== undefined && pm.black !== undefined) engineMultipliers = { ...engineMultipliers, color: { red: pm.red, black: pm.black } };
        if (pm.higher !== undefined || pm.lower !== undefined || pm.equal !== undefined) engineMultipliers = { ...engineMultipliers, higherLower: { higher: pm.higher ?? 0, lower: pm.lower ?? 0, equal: pm.equal ?? 0 } };
        if (pm.inside !== undefined || pm.outside !== undefined || pm.equal !== undefined) engineMultipliers = { ...engineMultipliers, insideOutside: { inside: pm.inside ?? 0, outside: pm.outside ?? 0, equal: pm.equal ?? 0 } };
        if (pm.heart !== undefined || pm.diamond !== undefined || pm.club !== undefined || pm.spade !== undefined) engineMultipliers = { ...engineMultipliers, suit: { heart: pm.heart ?? 0, diamond: pm.diamond ?? 0, club: pm.club ?? 0, spade: pm.spade ?? 0 } };
        if (pm.payoutMultiplier !== undefined || pm.multiplier !== undefined) lastMultiplier = (pm.payoutMultiplier ?? pm.multiplier) as number;
      }
    },
  });

  function startGame() {
    if (isNaN(Number(betInput)) || Number(betInput) <= 0) {
      alert("Invalid bet. Please enter a positive number.");
      return;
    }
    initialBet = Number(betInput);
    const roundSeedData = resolveRoundSeed();

    // If the resolved seed says the engine (server) should drive the round,
    // hand off to the engine flow which requests the round from the RGS.
    if (roundSeedData.source === 'engine-auth' || roundSeedData.source === 'engine-replay') {
      // start the server-driven flow which will play events via playBet
      startGameEngineFlow(roundSeedData).catch((err) => {
        console.error('Engine flow failed', err);
      });
      return;
    }

    // local deterministic fallback (dev)
    const round = createRoundContract(`${roundSeedData.seed}:${roundSequence}`);
    roundSequence += 1;
    lastRoundId = round.roundId;
    roundSource = roundSeedData.source;
    roundDeckPreview = round.deck.slice(0, 4).map((card) => `${card.rank}${card.suit}`).join(' ');
    deck = round.deck;
    currentIndex = 0;
    revealedCards = [null, null, null, null];
    cashoutAmount = initialBet;
    wonAmount = 0;
    endMode = 'cashout';
    gameState = 'playing';
    isProcessing = false;
  }

  function drawCard(): Card | null {
    if(currentIndex >= deck.length) return null;
    return deck[currentIndex++];
  }

  function Cashout() {
    if(gameState !== 'playing') return;

    if (roundSource !== 'local-fallback' && currentAwaitIndex !== null) {
      // send cashout choice to engine
      sendChoice(currentAwaitIndex, { type: 'cashout' });
      inputsEnabled = false;
      isProcessing = true;
      return;
    }

    wonAmount = cashoutAmount || initialBet;
    endMode = 'cashout';
    gameState = 'cashed';
  }

  function revealAllCards() {
	for (let i = 0; i < revealedCards.length; i++) {
		if (!revealedCards[i] && deck[i]) {
		revealedCards[i] = deck[i];
		}
	}
  }

  function guessColor(color: 'red'|'black') {
    if(isProcessing) return;

    // engine-driven flow: send choice and let book handlers continue
    if (roundSource !== 'local-fallback' && currentAwaitIndex !== null) {
      inputsEnabled = false;
      isProcessing = true;
      sendChoice(currentAwaitIndex, { type: 'guessColor', value: color });
      return;
    }

    isProcessing = true;

    const payouts = (roundSource !== 'local-fallback') ? getPayoutsColor() : calculatePayoutsColor();
    cashoutAmount = initialBet * (color === 'red' ? payouts.red : payouts.black);

    const card = drawCard();
    if(!card) {
      isProcessing = false;
      return;
    }

    revealedCards[currentIndex-1] = card;
    const cardColor = card.suit === '♥' || card.suit === '♦' ? 'red' : 'black';
    const correct = cardColor === color;

    if(!correct) {
      revealAllCards();
      isProcessing = false;
      gameState = 'lost';
      return;
    }

    isProcessing = false;
  }

  function guessHigherLower(guess: 'higher'|'lower'|'equal') {
    if(isProcessing) return;

    if (roundSource !== 'local-fallback' && currentAwaitIndex !== null) {
      inputsEnabled = false;
      isProcessing = true;
      sendChoice(currentAwaitIndex, { type: 'guessHigherLower', value: guess });
      return;
    }

    isProcessing = true;

    const payouts = (roundSource !== 'local-fallback') ? getPayoutsHigherLower() : calculatePayoutsHigherLower();
    cashoutAmount = cashoutAmount * (guess === 'higher' ? payouts.higher : guess === 'lower' ? payouts.lower : payouts.equal);

    const card = drawCard();
    if(!card) {
      isProcessing = false;
      return;
    }

    revealedCards[currentIndex-1] = card;
    const firstCard = revealedCards[0];
    const correct = firstCard && (
      (guess === 'higher' && rankValue[card.rank] > rankValue[firstCard.rank]) ||
      (guess === 'lower' && rankValue[card.rank] < rankValue[firstCard.rank]) ||
      (guess === 'equal' && rankValue[card.rank] === rankValue[firstCard.rank])
    );

    if(!correct) {
      revealAllCards();
      isProcessing = false;
      gameState = 'lost';
      return;
    }

    isProcessing = false;
  }

  function guessInsideOutside(guess: 'inside'|'outside'|'equal') {
    if(isProcessing) return;

    if (roundSource !== 'local-fallback' && currentAwaitIndex !== null) {
      inputsEnabled = false;
      isProcessing = true;
      sendChoice(currentAwaitIndex, { type: 'guessInsideOutside', value: guess });
      return;
    }

    isProcessing = true;

    const payouts = (roundSource !== 'local-fallback') ? getPayoutsInsideOutside() : calculatePayoutsInsideOutside();
    cashoutAmount = cashoutAmount * (guess === 'inside' ? payouts.inside : guess === 'outside' ? payouts.outside : payouts.equal);

    const card = drawCard();
    if(!card) {
      isProcessing = false;
      return;
    }

    revealedCards[currentIndex-1] = card;
    const firstCard = revealedCards[0];
    const secondCard = revealedCards[1];
    if (!firstCard || !secondCard) {
      isProcessing = false;
      return;
    }
    const firstCardValue = rankValue[firstCard.rank];
    const secondCardValue = rankValue[secondCard.rank];
    const minVal = Math.min(firstCardValue, secondCardValue);
    const maxVal = Math.max(firstCardValue, secondCardValue);
    
    const correct =
      (guess === 'inside' && ((rankValue[card.rank] > minVal && rankValue[card.rank] < maxVal))) ||
      (guess === 'outside' && ((rankValue[card.rank] < minVal) || (rankValue[card.rank] > maxVal))) ||
      (guess === 'equal' && (rankValue[card.rank] === rankValue[secondCard.rank] || rankValue[card.rank] === rankValue[firstCard.rank]));

    if(!correct) {
      revealAllCards();
      isProcessing = false;
      gameState = 'lost';
      return;
    }

    isProcessing = false;

  }

  function guessSuit(guess: '♦'|'♣'|'♥'|'♠') {
    if(isProcessing) return;

    if (roundSource !== 'local-fallback' && currentAwaitIndex !== null) {
      inputsEnabled = false;
      isProcessing = true;
      sendChoice(currentAwaitIndex, { type: 'guessSuit', value: guess });
      return;
    }

    isProcessing = true;

    const payouts = (roundSource !== 'local-fallback') ? getPayoutsSuit() : calculatePayoutsSuit();
    cashoutAmount = cashoutAmount * (guess === '♦' ? payouts.diamond : guess === '♣' ? payouts.club : guess === '♥' ? payouts.heart : payouts.spade);

    const card = drawCard();
    if(!card) return;

    revealedCards[currentIndex-1] = card;
    const correct = (
      (guess === '♦' && card.suit == '♦') ||
      (guess === '♣' && card.suit == '♣') ||
      (guess === '♥' && card.suit == '♥') ||
      (guess === '♠' && card.suit == '♠')
    );

    if(!correct) {
      revealAllCards();
      isProcessing = false;
      gameState = 'lost';
      return;
    }

    wonAmount = cashoutAmount || initialBet;
    endMode = 'full-win';
    gameState = 'cashed';
    isProcessing = false;

  }

  function retryGame() {
    gameState = 'start';
    betInput = initialBet.toString(); // Save the initial bet as the previous bet
    revealedCards = [null, null, null, null]; // Reset all cards to '?'
    endMode = 'cashout';
  }

  function calculatePayoutsColor() {
    const remainingCards = deck.slice(currentIndex);
    const totalRemaining = remainingCards.length;
    if (!revealedCards[0]) {
      const redProb = remainingCards.filter(card => card.suit === '♥' || card.suit === '♦').length / totalRemaining || 0;
      const blackProb = remainingCards.filter(card => card.suit === '♠' || card.suit === '♣').length / totalRemaining || 0;
      return {
        red: redProb > 0 ? (1 - HOUSE_EDGE) / redProb : 0,
        black: blackProb > 0 ? (1 - HOUSE_EDGE) / blackProb : 0,
      };
    }
    return { red: 0, black: 0 };
  }

  function getPayoutsColor() {
    if (roundSource !== 'local-fallback' && engineMultipliers?.color) return engineMultipliers.color;
    return calculatePayoutsColor();
  }

  function calculatePayoutsHigherLower() {
    const remainingCards = deck.slice(currentIndex);
    const totalRemaining = remainingCards.length;
    if (revealedCards[0] && !revealedCards[1]) {
      const firstCard = revealedCards[0];
      if (!firstCard) return { higher: 0, lower: 0, equal: 0 };
      const firstCardValue = rankValue[firstCard.rank];
      const higherProb = remainingCards.filter(card => rankValue[card.rank] > firstCardValue).length / totalRemaining || 0;
      const lowerProb = remainingCards.filter(card => rankValue[card.rank] < firstCardValue).length / totalRemaining || 0;
      const equalProb = remainingCards.filter(card => rankValue[card.rank] === firstCardValue).length / totalRemaining || 0;

      return {
        higher: higherProb > 0 ? (1 - HOUSE_EDGE) / higherProb : 0,
        lower: lowerProb > 0 ? (1 - HOUSE_EDGE) / lowerProb : 0,
        equal: equalProb > 0 ? (1 - HOUSE_EDGE) / equalProb : 0,
      };
    }
    return { higher: 0, lower: 0, equal: 0 };
  }

  function getPayoutsHigherLower() {
    if (roundSource !== 'local-fallback' && engineMultipliers?.higherLower) return engineMultipliers.higherLower;
    return calculatePayoutsHigherLower();
  }

  function calculatePayoutsInsideOutside() {
    const remainingCards = deck.slice(currentIndex);
    const totalRemaining = remainingCards.length;
    if (revealedCards[0] && revealedCards[1] && !revealedCards[2]) {
      const firstCard = revealedCards[0];
      const secondCard = revealedCards[1];
      if (!firstCard && !secondCard) return { inside: 0, outside: 0, equal: 0 };
      const firstCardValue = rankValue[firstCard.rank];
      const secondCardValue = rankValue[secondCard.rank];
      const minVal = Math.min(firstCardValue, secondCardValue);
      const maxVal = Math.max(firstCardValue, secondCardValue);

      const insideProb = remainingCards.filter(card => rankValue[card.rank] > minVal && rankValue[card.rank] < maxVal).length / totalRemaining || 0;
      const outsideProb = remainingCards.filter(card => rankValue[card.rank] < minVal || rankValue[card.rank] > maxVal).length / totalRemaining || 0;
      const equalProb = remainingCards.filter(card => rankValue[card.rank] === minVal || rankValue[card.rank] === maxVal).length / totalRemaining || 0;

      return {
        inside: insideProb > 0 ? (1 - HOUSE_EDGE) / insideProb : 0,
        outside: outsideProb > 0 ? (1 - HOUSE_EDGE) / outsideProb : 0,
        equal: equalProb > 0 ? (1 - HOUSE_EDGE) / equalProb : 0,
      };
    }
    return { inside: 0, outside: 0, equal: 0 };
  }

  function getPayoutsInsideOutside() {
    if (roundSource !== 'local-fallback' && engineMultipliers?.insideOutside) return engineMultipliers.insideOutside;
    return calculatePayoutsInsideOutside();
  }
  
  function calculatePayoutsSuit(){
    const remainingCards = deck.slice(currentIndex);
    const totalRemaining = remainingCards.length;
    const houseEdge = 0.02;

    if (revealedCards[0] && revealedCards[1] && revealedCards[2] && !revealedCards[3]) {
      const heartProb = remainingCards.filter(card => card.suit === '♥').length / totalRemaining || 0;
      const diamondProb = remainingCards.filter(card => card.suit === '♦').length / totalRemaining || 0;
      const spadeProb = remainingCards.filter(card => card.suit === '♠').length / totalRemaining || 0;
      const clubProb = remainingCards.filter(card => card.suit === '♣').length / totalRemaining || 0;
      return {
        heart: heartProb > 0 ? (1 - HOUSE_EDGE) / heartProb : 0,
        diamond: diamondProb > 0 ? (1 - HOUSE_EDGE) / diamondProb : 0,
        spade: spadeProb > 0 ? (1 - HOUSE_EDGE) / spadeProb : 0,
        club: clubProb > 0 ? (1 - HOUSE_EDGE) / clubProb : 0,
      };
    }
    return { heart: 0 , diamond: 0, spade: 0, club: 0 };
  }

  function getPayoutsSuit() {
    if (roundSource !== 'local-fallback' && engineMultipliers?.suit) return engineMultipliers.suit;
    return calculatePayoutsSuit();
  }

  function getBaseAmount() {
    return (cashoutAmount && cashoutAmount > 0) ? cashoutAmount : initialBet;
  }

</script>

<div class="game-container">
  <h1>Ride the Bus</h1>

  <div class="round-debug" aria-live="polite">
    <span>Round source: {roundSource}</span>
    <span>Round ID: {lastRoundId || 'not started'}</span>
    <span>Deck preview: {roundDeckPreview || 'n/a'}</span>
  </div>

  {#if gameState === 'start'}
  <div class="card-row">
    {#each revealedCards as card, index}
      <div class="card-block" class:revealed={card}>
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
  <div class="start-panel">
    <div class="start-stack">
      <button class="start-button" onclick={startGame} disabled={IS_PROD && resolveRoundSeed().source === 'none'}>Start</button>
      <div class="wager-field">
        <label for="bet">Wager</label>
        <input id="bet" class="bet-input" type="number" bind:value={betInput} min="1" placeholder="e.g. 10" />
      </div>
    </div>
  </div>
{/if}

{#if gameState === 'lost'}
  <div class="card-row">
      {#each revealedCards as card, index}
        <div class="card-block" class:revealed={card}>
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
    <p>You lost! The cards are revealed above.</p>
    <div class="button-group">
      <button class="secondary-button" onclick={retryGame}>Retry</button>
    </div>
  </div>
{/if}

{#if gameState === 'won' || gameState === 'cashed'}
  <div class="result-screen">
    <div class="result-hero">
      <p class="result-kicker">{endMode === 'cashout' ? 'Cashed Out' : 'Game Won'}</p>
      <h2>{endMode === 'cashout' ? 'You Secured Your Winnings' : 'Congratulations! Full Game Win'}</h2>
      <p class="result-copy">
        {endMode === 'cashout'
          ? 'You locked in your winnings and are walking away with:'
          : 'You completed all four levels and won the full game!'}
      </p>
      <div class="result-total">x{initialBet > 0 ? (wonAmount / initialBet).toFixed(2) : '0.00'} — ${wonAmount.toFixed(2)}</div>
    </div>

    <div class="result-actions">
      <button class="secondary-button" onclick={() => { gameState = 'start'; betInput = initialBet.toString(); revealedCards = [null, null, null, null]; cashoutAmount = 0; }}>Play Again</button>
    </div>
  </div>
{/if}

{#if gameState === 'playing'}
  <div class="card-row">
    {#each revealedCards as card, index}
      <div class="card-block" class:revealed={card}>
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

  {#if !revealedCards[0]}
    <div class="game-stage">
      <p>Guess the color of the first card:</p>
      <div class="button-group">
        <button class="red-button" onclick={() => guessColor('red')} disabled={!inputsEnabled}>Red
          <div class="multiplier-winnings">x{getPayoutsColor().red.toFixed(2)} (${(getBaseAmount() * getPayoutsColor().red).toFixed(2)})</div>
        </button>
        <button class="black-button" onclick={() => guessColor('black')} disabled={!inputsEnabled}>Black
          <div class="multiplier-winnings">x{getPayoutsColor().black.toFixed(2)} (${(getBaseAmount() * getPayoutsColor().black).toFixed(2)})</div>
        </button>
      </div>
    </div>
  {:else if !revealedCards[1]}
    <div class="game-stage">
      <p>Will the next card be higher or lower?</p>
      <div class="button-group">
        <button class="higher-button" onclick={() => guessHigherLower('higher')} disabled={!inputsEnabled}>Higher
          <div class="multiplier-winnings">x{getPayoutsHigherLower().higher.toFixed(2)} (${(getBaseAmount() * getPayoutsHigherLower().higher).toFixed(2)})</div>
        </button>
        <button class="lower-button" onclick={() => guessHigherLower('lower')} disabled={!inputsEnabled}>Lower
          <div class="multiplier-winnings">x{getPayoutsHigherLower().lower.toFixed(2)} (${(getBaseAmount() * getPayoutsHigherLower().lower).toFixed(2)})</div>
        </button>
        <button class="equal-button" onclick={() => guessHigherLower('equal')} disabled={!inputsEnabled}>Equal
          <div class="multiplier-winnings">x{getPayoutsHigherLower().equal.toFixed(2)} (${(getBaseAmount() * getPayoutsHigherLower().equal).toFixed(2)})</div>
        </button>
        <button class="cashout-button" onclick={() => Cashout()} disabled={!inputsEnabled}>Cashout
          <div class="multiplier-winnings">${cashoutAmount.toFixed(2)}</div>
        </button>
      </div>
    </div>
  {:else if !revealedCards[2]}
    <div class="game-stage">
      <p>Will the next card be in between or outside?</p>
      <div class="button-group">
        <button class="inside-button" onclick={() => guessInsideOutside('inside')} disabled={!inputsEnabled}>Inside
          <div class="multiplier-winnings">x{getPayoutsInsideOutside().inside.toFixed(2)} (${(getBaseAmount() * getPayoutsInsideOutside().inside).toFixed(2)})</div>
        </button>
        <button class="outside-button" onclick={() => guessInsideOutside('outside')} disabled={!inputsEnabled}>Outside
          <div class="multiplier-winnings">x{getPayoutsInsideOutside().outside.toFixed(2)} (${(getBaseAmount() * getPayoutsInsideOutside().outside).toFixed(2)})</div>
        </button>
        <button class="equal-button" onclick={() => guessInsideOutside('equal')} disabled={!inputsEnabled}>Equal
          <div class="multiplier-winnings">x{getPayoutsInsideOutside().equal.toFixed(2)} (${(getBaseAmount() * getPayoutsInsideOutside().equal).toFixed(2)})</div>
        </button>
        <button class="cashout-button" onclick={() => Cashout()} disabled={!inputsEnabled}>Cashout
          <div class="multiplier-winnings">${cashoutAmount.toFixed(2)}</div>
        </button>
      </div>
    </div>
  {:else if !revealedCards[3]}
    <div class="game-stage">
      <p>Guess the suit of the final card:</p>
      <div class="button-group">
        <button class="suit-button heart" onclick={() => guessSuit('♥')} disabled={!inputsEnabled}>♥
          <div class="multiplier-winnings">x{getPayoutsSuit().heart.toFixed(2)} (${(getBaseAmount() * getPayoutsSuit().heart).toFixed(2)})</div>
        </button>
        <button class="suit-button diamond" onclick={() => guessSuit('♦')} disabled={!inputsEnabled}>♦
          <div class="multiplier-winnings">x{getPayoutsSuit().diamond.toFixed(2)} (${(getBaseAmount() * getPayoutsSuit().diamond).toFixed(2)})</div>
        </button>
        <button class="suit-button club" onclick={() => guessSuit('♣')} disabled={!inputsEnabled}>♣
          <div class="multiplier-winnings">x{getPayoutsSuit().club.toFixed(2)} (${(getBaseAmount() * getPayoutsSuit().club).toFixed(2)})</div>
        </button>
        <button class="suit-button spade" onclick={() => guessSuit('♠')} disabled={!inputsEnabled}>♠
          <div class="multiplier-winnings">x{getPayoutsSuit().spade.toFixed(2)} (${(getBaseAmount() * getPayoutsSuit().spade).toFixed(2)})</div>
        </button>
        <button class="cashout-button" onclick={() => Cashout()}>Cashout
          <div class="multiplier-winnings">${cashoutAmount.toFixed(2)}</div>
        </button>
      </div>
    </div>
  {/if}
{/if}

</div>

<style>

  /* Add styles for buttons */
  button {
    padding: 10px 20px;
    margin: 10px;
    font-size: 22px;
    /* font-weight: bold; */
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.3s, transform 0.2s;
  }

  button:hover {
    transform: scale(1.05);
  }

  button:active {
    transform: scale(0.95);
  }

  /* Specific styles for red and black buttons */
  .red-button {
    background-color: #ff4d4d;
    color: white;
  }

  .red-button:hover {
    background-color: #e63939;
  }

  .black-button {
    background-color: #333;
    color: white;
  }

  .black-button:hover {
    background-color: #555;
  }

  /* Styles for higher, lower, and equal buttons */
  .higher-button {
    background-color: #4caf50;
    color: white;
  }

  .higher-button:hover {
    background-color: #45a049;
  }

  .lower-button {
    background-color: #2196f3;
    color: white;
  }

  .lower-button:hover {
    background-color: #1e88e5;
  }

  .equal-button {
    background-color: #ff9800;
    color: white;
  }

  .equal-button:hover {
    background-color: #fb8c00;
  }

  /* Styles for inside, outside, equal, and cashout buttons */
  .inside-button {
    background-color: #8e44ad;
    color: white;
  }

  .inside-button:hover {
    background-color: #732d91;
  }

  .outside-button {
    background-color: #16a085;
    color: white;
  }

  .outside-button:hover {
    background-color: #12876f;
  }

  .equal-button {
    background-color: #ff9800;
    color: white;
  }

  .equal-button:hover {
    background-color: #fb8c00;
  }

  .cashout-button {
    background-color: #c0392b;
    color: white;
  }

  .cashout-button:hover {
    background-color: #a93226;
  }

  .card-row {
    display: flex;
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
    background: url('/backdrop.png') center/cover no-repeat fixed;
    background-size: cover;
    background-color: transparent;
    min-height: 100vh;
  }

  .game-container {
    min-height: 100vh;
    width: 100vw;
    padding: 24px;
    box-sizing: border-box;
    background: transparent;
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

  /* Start panel styles */
  .start-panel {
    display: flex;
    justify-content: center;
    width: 100%;
    margin-top: 6px;
    transform: translateY(-8px);
  }

  .start-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .wager-field {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .wager-field label {
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
  }

  .game-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 130px; /* Ensures consistent height */
  }

  .game-stage p {
    text-align: center;
    margin-bottom: 0px;
    color: #fff4d5;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-shadow: 0 3px 12px rgba(0, 0, 0, 0.6);
    margin: 0 0 16px 0;
  }

  .button-group {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-top: 20px;
  }

  .card-block {
    width: 102px;
    height: 152px;
    border: 2px solid #333;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 18px;
     background: linear-gradient(135deg, #1a5f7a 0%, #0d3a52 50%, #1a5f7a 100%);
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

  /* Styles for suit buttons */
  .suit-button {
    padding: 0px 10px;
    margin: 15px;
    font-size: 50px; /* Increase size */
    font-weight: bold;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .suit-button.heart,
  .suit-button.diamond {
    color: red; /* Red for hearts and diamonds */
  }

  .suit-button.club,
  .suit-button.spade {
    color: rgb(71, 71, 71); /* Black for clubs and spades */
  }

  .suit-button:hover {
    transform: scale(1.1);
  }

  .multiplier-winnings {
    font-size: 12px;
    color: #fff;
    margin-top: 5px;
    text-align: center;
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
