<script lang="ts">
  import './app.css';
  import './common.css';
  import LostScreen from './LostScreen.svelte';
  import WinScreen from './WinScreen.svelte';
  import StartScreen from './StartScreen.svelte';
  import {
    createDeck,
    shuffleDeck,
    calculatePayoutsColor,
    calculatePayoutsHigherLower,
    calculatePayoutsInsideOutside,
    calculatePayoutsSuit
  } from './gameLogic';
  import type { Card } from './gameLogic';

  type State = 'start' | 'playing' | 'won' | 'lost';
  let gameState: State = 'start';
  let isProcessing = false;

  let deck: Card[] = [];
  let currentIndex = 0;

  // Store cards revealed so far (max 4)
  let revealedCards: (Card | null)[] = [null, null, null, null];

  let initialBet = 0; // Variable to hold the initial bet
  let betInput = ""; // Temporary variable to hold the user's input
  let cashoutAmount = 0; // Variable to hold the cashout amount

  // Map card ranks to their numeric values
  const rankValue: { [key: string]: number } = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

  function startGame() {
    if (isNaN(Number(betInput)) || Number(betInput) <= 0) {
      alert("Invalid bet. Please enter a positive number.");
      return;
    }
    initialBet = Number(betInput); // Convert to a number
    deck = shuffleDeck(createDeck());
    currentIndex = 0;
    revealedCards = [null, null, null, null];
    gameState = 'playing';
    isProcessing = false;
  }

  function drawCard(): Card | null {
    if (currentIndex >= deck.length) return null;
    return deck[currentIndex++];
  }

  function Cashout() {
    if (gameState !== 'playing') return;
    gameState = 'won';
  }

  function revealAllCards() {
    for (let i = 0; i < revealedCards.length; i++) {
      if (!revealedCards[i] && deck[i]) {
        revealedCards[i] = deck[i];
      }
    }
  }

  function guessColor(color: 'red' | 'black') {
    if (isProcessing) return;
    isProcessing = true;

    const payouts = calculatePayoutsColor(deck, currentIndex);
    cashoutAmount = initialBet * (color === 'red' ? payouts.red : payouts.black);

    const card = drawCard();
    if (!card) {
      isProcessing = false;
      return;
    }

    revealedCards[currentIndex - 1] = card;
    const cardColor = card.suit === '♥' || card.suit === '♦' ? 'red' : 'black';
    const correct = cardColor === color;

    if (!correct) {
      revealAllCards();
      isProcessing = false;
      gameState = 'lost';
      return;
    }

    isProcessing = false;
  }

  function guessHigherLower(guess: 'higher' | 'lower' | 'equal') {
    if (isProcessing) return;
    isProcessing = true;

    const firstCard = revealedCards[0];
    if (!firstCard) {
      isProcessing = false;
      return;
    }

    const payouts = calculatePayoutsHigherLower(deck, currentIndex, firstCard);
    cashoutAmount = cashoutAmount * (guess === 'higher' ? payouts.higher : guess === 'lower' ? payouts.lower : payouts.equal);

    const card = drawCard();
    if (!card) {
      isProcessing = false;
      return;
    }

    revealedCards[currentIndex - 1] = card;
    const correct =
      (guess === 'higher' && card.rank > firstCard.rank) ||
      (guess === 'lower' && card.rank < firstCard.rank) ||
      (guess === 'equal' && card.rank === firstCard.rank);

    if (!correct) {
      revealAllCards();
      isProcessing = false;
      gameState = 'lost';
      return;
    }

    isProcessing = false;
  }

  function guessInsideOutside(guess: 'inside' | 'outside' | 'equal') {
    if (isProcessing) return;
    isProcessing = true;

    const firstCard = revealedCards[0];
    const secondCard = revealedCards[1];
    if (!firstCard || !secondCard) {
      isProcessing = false;
      return;
    }

    const payouts = calculatePayoutsInsideOutside(deck, currentIndex, firstCard, secondCard);
    cashoutAmount = cashoutAmount * (guess === 'inside' ? payouts.inside : guess === 'outside' ? payouts.outside : payouts.equal);

    const card = drawCard();
    if (!card) {
      isProcessing = false;
      return;
    }

    revealedCards[currentIndex - 1] = card;
    const firstCardValue = rankValue[firstCard.rank];
    const secondCardValue = rankValue[secondCard.rank];
    const minVal = Math.min(firstCardValue, secondCardValue);
    const maxVal = Math.max(firstCardValue, secondCardValue);

    const correct =
      (guess === 'inside' && rankValue[card.rank] > minVal && rankValue[card.rank] < maxVal) ||
      (guess === 'outside' && (rankValue[card.rank] < minVal || rankValue[card.rank] > maxVal)) ||
      (guess === 'equal' && (rankValue[card.rank] === minVal || rankValue[card.rank] === maxVal));

    if (!correct) {
      revealAllCards();
      isProcessing = false;
      gameState = 'lost';
      return;
    }

    isProcessing = false;
  }

  function guessSuit(guess: '♦' | '♣' | '♥' | '♠') {
    if (isProcessing) return;
    isProcessing = true;

    const payouts = calculatePayoutsSuit(deck, currentIndex);
    cashoutAmount = cashoutAmount * (guess === '♦' ? payouts.diamond : guess === '♣' ? payouts.club : guess === '♥' ? payouts.heart : payouts.spade);

    const card = drawCard();
    if (!card) return;

    revealedCards[currentIndex - 1] = card;
    const correct = card.suit === guess;

    if (!correct) {
      revealAllCards();
      isProcessing = false;
      gameState = 'lost';
      return;
    }

    gameState = 'won';
    isProcessing = false;
  }

  function retryGame() {
    gameState = 'start';
    betInput = initialBet.toString(); // Save the initial bet as the previous bet
    revealedCards = [null, null, null, null]; // Reset all cards to '?'
  }
</script>

<h1>Ride the Bus</h1>

{#if gameState === 'start'}
  <StartScreen {revealedCards} bind:betInput {startGame} />
{/if}

{#if gameState === 'lost'}
  <LostScreen {revealedCards} {retryGame} />
{/if}

{#if gameState === 'won'}
  <WinScreen {revealedCards} {cashoutAmount} {retryGame} />
{/if}

{#if gameState === 'playing'}
  <div class="card-row">
    {#each revealedCards as card, index}
      <div class="card-block">
        {#if card}
          <p class={card.suit === '♥' || card.suit === '♦' ? 'red-card' : 'black-card'}>{card.rank} {card.suit}</p>
        {:else}
          <p>?</p>
        {/if}
      </div>
    {/each}
  </div>

  {#if !revealedCards[0]}
    <div class="game-stage">
      <p>Guess the color of the first card:</p>
      <div class="button-group">
        <button class="red-button" on:click={() => guessColor('red')}>Red
          <div class="multiplier-winnings">x{calculatePayoutsColor(deck, currentIndex).red.toFixed(2)} (${(initialBet * calculatePayoutsColor(deck, currentIndex).red).toFixed(2)})</div>
        </button>
        <button class="black-button" on:click={() => guessColor('black')}>Black
          <div class="multiplier-winnings">x{calculatePayoutsColor(deck, currentIndex).black.toFixed(2)} (${(initialBet * calculatePayoutsColor(deck, currentIndex).black).toFixed(2)})</div>
        </button>
      </div>
    </div>
  {:else if !revealedCards[1]}
    <div class="game-stage">
      <p>Will the next card be higher or lower?</p>
      <div class="button-group">
        <button class="higher-button" on:click={() => guessHigherLower('higher')}>Higher
          <div class="multiplier-winnings">x{calculatePayoutsHigherLower(deck, currentIndex, revealedCards[0]!).higher.toFixed(2)} (${(cashoutAmount * calculatePayoutsHigherLower(deck, currentIndex, revealedCards[0]!).higher).toFixed(2)})</div>
        </button>
        <button class="lower-button" on:click={() => guessHigherLower('lower')}>Lower
          <div class="multiplier-winnings">x{calculatePayoutsHigherLower(deck, currentIndex, revealedCards[0]!).lower.toFixed(2)} (${(cashoutAmount * calculatePayoutsHigherLower(deck, currentIndex, revealedCards[0]!).lower).toFixed(2)})</div>
        </button>
        <button class="equal-button" on:click={() => guessHigherLower('equal')}>Equal
          <div class="multiplier-winnings">x{calculatePayoutsHigherLower(deck, currentIndex, revealedCards[0]!).equal.toFixed(2)} (${(cashoutAmount * calculatePayoutsHigherLower(deck, currentIndex, revealedCards[0]!).equal).toFixed(2)})</div>
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
          <div class="multiplier-winnings">x{calculatePayoutsInsideOutside(deck, currentIndex, revealedCards[0]!, revealedCards[1]!).inside.toFixed(2)} (${(cashoutAmount * calculatePayoutsInsideOutside(deck, currentIndex, revealedCards[0]!, revealedCards[1]!).inside).toFixed(2)})</div>
        </button>
        <button class="outside-button" on:click={() => guessInsideOutside('outside')}>Outside
          <div class="multiplier-winnings">x{calculatePayoutsInsideOutside(deck, currentIndex, revealedCards[0]!, revealedCards[1]!).outside.toFixed(2)} (${(cashoutAmount * calculatePayoutsInsideOutside(deck, currentIndex, revealedCards[0]!, revealedCards[1]!).outside).toFixed(2)})</div>
        </button>
        <button class="equal-button" on:click={() => guessInsideOutside('equal')}>Equal
          <div class="multiplier-winnings">x{calculatePayoutsInsideOutside(deck, currentIndex, revealedCards[0]!, revealedCards[1]!).equal.toFixed(2)} (${(cashoutAmount * calculatePayoutsInsideOutside(deck, currentIndex, revealedCards[0]!, revealedCards[1]!).equal).toFixed(2)})</div>
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
          <div class="multiplier-winnings">x{calculatePayoutsSuit(deck, currentIndex).heart.toFixed(2)} (${(cashoutAmount * calculatePayoutsSuit(deck, currentIndex).heart).toFixed(2)})</div>
        </button>
        <button class="suit-button diamond" on:click={() => guessSuit('♦')}>♦
          <div class="multiplier-winnings">x{calculatePayoutsSuit(deck, currentIndex).diamond.toFixed(2)} (${(cashoutAmount * calculatePayoutsSuit(deck, currentIndex).diamond).toFixed(2)})</div>
        </button>
        <button class="suit-button club" on:click={() => guessSuit('♣')}>♣
          <div class="multiplier-winnings">x{calculatePayoutsSuit(deck, currentIndex).club.toFixed(2)} (${(cashoutAmount * calculatePayoutsSuit(deck, currentIndex).club).toFixed(2)})</div>
        </button>
        <button class="suit-button spade" on:click={() => guessSuit('♠')}>♠
          <div class="multiplier-winnings">x{calculatePayoutsSuit(deck, currentIndex).spade.toFixed(2)} (${(cashoutAmount * calculatePayoutsSuit(deck, currentIndex).spade).toFixed(2)})</div>
        </button>
        <button class="cashout-button" on:click={() => Cashout()}>Cashout
          <div class="multiplier-winnings">${cashoutAmount.toFixed(2)}</div>
        </button>
      </div>
    </div>
  {/if}
{/if}
<style>
  @import './common.css';
  @import './app.css';

  /* Add styles for buttons */
  button {
    padding: 10px 20px;
    margin: 10px;
    font-size: 22px;
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

  .game-stage p {
    text-align: center;
    margin-bottom: 0px; /* Reduce gap */
  }

  .button-group {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-top: 20px;
  }

  .card-block {
    width: 80px;
    height: 120px;
    border: 2px solid #333;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 18px;
    background-color: #333;
    color: #fff;
    font-weight: bold;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    letter-spacing: 1px;
  }
  .card-block p {
    margin: 0;
    font-size: 20px;
    font-weight: bold;
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

</style>
