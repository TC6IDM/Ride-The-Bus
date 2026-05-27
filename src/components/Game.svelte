<script lang="ts">
  // cd C:\Users\tcand\OneDrive\Desktop\Stake Game\web-sdk\apps\Ride-The-Bus>  
  // cd C:\Users\Owner\Desktop\Stake Engine Game\web-sdk\apps\ride-the-bus> 
  // npm run dev
  import './app.css';

  type State = 'start' | 'playing' | 'won' | 'lost' | 'cashed';
  type EndMode = 'cashout' | 'full-win';
  let gameState: State = 'start';
  let endMode: EndMode = 'cashout';
  let isProcessing = false;

  interface Card {
    suit: '♥' | '♦' | '♣' | '♠';
    rank: 'A'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K';
  }

  const suits: Card['suit'][] = ['♥','♦','♣','♠'];
  const ranks: Card['rank'][] = ['A','2','3','4','5','6','7','8','9' ,'10','J' ,'Q' ,'K'];
  const rankValue: Record<Card['rank'],number> = {
    'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13
  };

  let deck: Card[] = [];
  let currentIndex = 0;

  // Store cards revealed so far (max 4)
  let revealedCards: (Card | null)[] = [null, null, null, null];

  let initialBet = 0; // Variable to hold the initial bet
  let betInput = ""; // Temporary variable to hold the user's input
  let cashoutAmount = 0; // Variable to hold the cashout amount
  let wonAmount = 0; // amount shown on cashout/win screen

  function createDeck(): Card[] {
    const d: Card[] = [];
    for(const suit of suits){
      for(const rank of ranks) d.push({suit, rank});
    }
    return d;
  }

  function shuffleDeck(d: Card[]): Card[] {
    const shuffled = [...d];
    for(let i = shuffled.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function startGame() {
    if (isNaN(Number(betInput)) || Number(betInput) <= 0) {
      alert("Invalid bet. Please enter a positive number.");
      return;
    }
    initialBet = Number(betInput);
    deck = shuffleDeck(createDeck());
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
    isProcessing = true;

    const payouts = calculatePayoutsColor();
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
    isProcessing = true;

    const payouts = calculatePayoutsHigherLower();
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
    isProcessing = true;

    const payouts = calculatePayoutsInsideOutside();
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
    isProcessing = true;

    const payouts = calculatePayoutsSuit();
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
    const houseEdge = 0.02;

    if (!revealedCards[0]) {
      const redProb = remainingCards.filter(card => card.suit === '♥' || card.suit === '♦').length / totalRemaining;
      const blackProb = remainingCards.filter(card => card.suit === '♠' || card.suit === '♣').length / totalRemaining;
      return {
        red: (1 - houseEdge) / redProb,
        black: (1 - houseEdge) / blackProb
      };
    }
    return { red: 0, black: 0 };
  }

  function calculatePayoutsHigherLower() {
    const remainingCards = deck.slice(currentIndex);
    const totalRemaining = remainingCards.length;
    const houseEdge = 0.02;

    if (revealedCards[0] && !revealedCards[1]) {
      const firstCard = revealedCards[0];
      if (!firstCard) return { higher: 0, lower: 0, equal: 0 };
      const firstCardValue = rankValue[firstCard.rank];
      const higherProb = remainingCards.filter(card => rankValue[card.rank] > firstCardValue).length / totalRemaining;
      const lowerProb = remainingCards.filter(card => rankValue[card.rank] < firstCardValue).length / totalRemaining;
      const equalProb = remainingCards.filter(card => rankValue[card.rank] === firstCardValue).length / totalRemaining;

      return {
        higher: (1 - houseEdge) / higherProb,
        lower: (1 - houseEdge) / lowerProb,
        equal: (1 - houseEdge) / equalProb
      };
    }
    return { higher: 0, lower: 0, equal: 0 };
  }

  function calculatePayoutsInsideOutside() {
    const remainingCards = deck.slice(currentIndex);
    const totalRemaining = remainingCards.length;
    const houseEdge = 0.02;

    if (revealedCards[0] && revealedCards[1] && !revealedCards[2]) {
      const firstCard = revealedCards[0];
      const secondCard = revealedCards[1];
      if (!firstCard && !secondCard) return { inside: 0, outside: 0, equal: 0 };
      const firstCardValue = rankValue[firstCard.rank];
      const secondCardValue = rankValue[secondCard.rank];
      const minVal = Math.min(firstCardValue, secondCardValue);
      const maxVal = Math.max(firstCardValue, secondCardValue);

      const insideProb = remainingCards.filter(card => rankValue[card.rank] > minVal && rankValue[card.rank] < maxVal).length / totalRemaining;
      const outsideProb = remainingCards.filter(card => rankValue[card.rank] < minVal || rankValue[card.rank] > maxVal).length / totalRemaining;
      const equalProb = remainingCards.filter(card => rankValue[card.rank] === minVal || rankValue[card.rank] === maxVal).length / totalRemaining;

      return {
        inside: (1 - houseEdge) / insideProb,
        outside: (1 - houseEdge) / outsideProb,
        equal: (1 - houseEdge) / equalProb
      };
    }
    return { inside: 0, outside: 0, equal: 0 };
  }
  
  function calculatePayoutsSuit(){
    const remainingCards = deck.slice(currentIndex);
    const totalRemaining = remainingCards.length;
    const houseEdge = 0.02;

    if (revealedCards[0] && revealedCards[1] && revealedCards[2] && !revealedCards[3]) {
      const heartProb = remainingCards.filter(card => card.suit === '♥').length / totalRemaining;
      const diamondProb = remainingCards.filter(card => card.suit === '♦').length / totalRemaining;
      const spadeProb = remainingCards.filter(card => card.suit === '♠').length / totalRemaining;
      const clubProb = remainingCards.filter(card => card.suit === '♣').length / totalRemaining;
      return {
        heart: (1 - houseEdge) / heartProb,
        diamond: (1 - houseEdge) / diamondProb,
        spade: (1 - houseEdge) / spadeProb,
        club: (1 - houseEdge) / clubProb
      };
    }
    return { heart: 0 , diamond: 0, spade: 0, club: 0 };
  }

  function getBaseAmount() {
    return (cashoutAmount && cashoutAmount > 0) ? cashoutAmount : initialBet;
  }

</script>

<div class="game-container">
  <h1>Ride the Bus</h1>

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
      <button class="start-button" on:click={startGame}>Start</button>
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
      <button class="secondary-button" on:click={retryGame}>Retry</button>
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
      <div class="result-total">${wonAmount.toFixed(2)}</div>
    </div>

    <div class="result-actions">
      <button class="secondary-button" on:click={() => { gameState = 'start'; betInput = initialBet.toString(); revealedCards = [null, null, null, null]; cashoutAmount = 0; }}>Play Again</button>
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
        <button class="red-button" on:click={() => guessColor('red')}>Red
          <div class="multiplier-winnings">x{calculatePayoutsColor().red.toFixed(2)} (${(getBaseAmount() * calculatePayoutsColor().red).toFixed(2)})</div>
        </button>
        <button class="black-button" on:click={() => guessColor('black')}>Black
          <div class="multiplier-winnings">x{calculatePayoutsColor().black.toFixed(2)} (${(getBaseAmount() * calculatePayoutsColor().black).toFixed(2)})</div>
        </button>
      </div>
    </div>
  {:else if !revealedCards[1]}
    <div class="game-stage">
      <p>Will the next card be higher or lower?</p>
      <div class="button-group">
        <button class="higher-button" on:click={() => guessHigherLower('higher')}>Higher
          <div class="multiplier-winnings">x{calculatePayoutsHigherLower().higher.toFixed(2)} (${(getBaseAmount() * calculatePayoutsHigherLower().higher).toFixed(2)})</div>
        </button>
        <button class="lower-button" on:click={() => guessHigherLower('lower')}>Lower
          <div class="multiplier-winnings">x{calculatePayoutsHigherLower().lower.toFixed(2)} (${(getBaseAmount() * calculatePayoutsHigherLower().lower).toFixed(2)})</div>
        </button>
        <button class="equal-button" on:click={() => guessHigherLower('equal')}>Equal
          <div class="multiplier-winnings">x{calculatePayoutsHigherLower().equal.toFixed(2)} (${(getBaseAmount() * calculatePayoutsHigherLower().equal).toFixed(2)})</div>
        </button>
        <button class="cashout-button" on:click={() => Cashout()}>Cashout
          <div class="multiplier-winnings">${cashoutAmount.toFixed(2)}</div>
        </button>
      </div>
    </div>
  {:else if !revealedCards[2]}
    <div class="game-stage">
      <p>Will the next card be in between or outside?</p>
      <div class="button-group">
        <button class="inside-button" on:click={() => guessInsideOutside('inside')}>Inside
          <div class="multiplier-winnings">x{calculatePayoutsInsideOutside().inside.toFixed(2)} (${(getBaseAmount() * calculatePayoutsInsideOutside().inside).toFixed(2)})</div>
        </button>
        <button class="outside-button" on:click={() => guessInsideOutside('outside')}>Outside
          <div class="multiplier-winnings">x{calculatePayoutsInsideOutside().outside.toFixed(2)} (${(getBaseAmount() * calculatePayoutsInsideOutside().outside).toFixed(2)})</div>
        </button>
        <button class="equal-button" on:click={() => guessInsideOutside('equal')}>Equal
          <div class="multiplier-winnings">x{calculatePayoutsInsideOutside().equal.toFixed(2)} (${(getBaseAmount() * calculatePayoutsInsideOutside().equal).toFixed(2)})</div>
        </button>
        <button class="cashout-button" on:click={() => Cashout()}>Cashout
          <div class="multiplier-winnings">${cashoutAmount.toFixed(2)}</div>
        </button>
      </div>
    </div>
  {:else if !revealedCards[3]}
    <div class="game-stage">
      <p>Guess the suit of the final card:</p>
      <div class="button-group">
        <button class="suit-button heart" on:click={() => guessSuit('♥')}>♥
          <div class="multiplier-winnings">x{calculatePayoutsSuit().heart.toFixed(2)} (${(getBaseAmount() * calculatePayoutsSuit().heart).toFixed(2)})</div>
        </button>
        <button class="suit-button diamond" on:click={() => guessSuit('♦')}>♦
          <div class="multiplier-winnings">x{calculatePayoutsSuit().diamond.toFixed(2)} (${(getBaseAmount() * calculatePayoutsSuit().diamond).toFixed(2)})</div>
        </button>
        <button class="suit-button club" on:click={() => guessSuit('♣')}>♣
          <div class="multiplier-winnings">x{calculatePayoutsSuit().club.toFixed(2)} (${(getBaseAmount() * calculatePayoutsSuit().club).toFixed(2)})</div>
        </button>
        <button class="suit-button spade" on:click={() => guessSuit('♠')}>♠
          <div class="multiplier-winnings">x{calculatePayoutsSuit().spade.toFixed(2)} (${(getBaseAmount() * calculatePayoutsSuit().spade).toFixed(2)})</div>
        </button>
        <button class="cashout-button" on:click={() => Cashout()}>Cashout
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
