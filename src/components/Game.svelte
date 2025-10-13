<script lang="ts">
  // cd C:\Users\tcand\OneDrive\Desktop\Stake Game\web-sdk\apps\Ride-The-Bus>  
  // cd C:\Users\Owner\Desktop\Stake Engine Game\web-sdk\apps\ride-the-bus> 
  // npm run dev
  import './app.css';

  type State = 'start' | 'playing' | 'won' | 'lost';
  let gameState: State = 'start';
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

  function createDeck(): Card[] {
    const d: Card[] = [];
    for(const suit of suits){
      for(const rank of ranks) d.push({suit, rank});
    }
    return d;
  }

  function shuffleDeck(d: Card[]): Card[] {
    const shuffled = [...d];
    for(let i = shuffled.length-1; i>0; i--){
      const j = Math.floor(Math.random()*(i+1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function startGame() {
    deck = shuffleDeck(createDeck());
    currentIndex = 0;
    revealedCards = [null, null, null, null];
    gameState = 'playing';
    isProcessing = false;
  }

  function drawCard(): Card | null {
    if(currentIndex >= deck.length) return null;
    return deck[currentIndex++];
  }

  function Cashout() {
	if(gameState !== 'playing') return;
	gameState = 'won';
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

    const card = drawCard();
    if(!card) {
      isProcessing = false;
      return;
    }

    revealedCards[currentIndex-1] = card;
    const firstCard = revealedCards[0];
    const secondCard = revealedCards[1];
    const correct = firstCard && secondCard && (
      (guess === 'inside' && ((rankValue[card.rank] > rankValue[firstCard.rank] && rankValue[card.rank] < rankValue[secondCard.rank]) || (rankValue[card.rank] > rankValue[secondCard.rank] && rankValue[card.rank] < rankValue[firstCard.rank]))) ||
      (guess === 'outside' && ((rankValue[card.rank] < rankValue[firstCard.rank] && rankValue[card.rank] < rankValue[secondCard.rank]) || (rankValue[card.rank] > rankValue[secondCard.rank] && rankValue[card.rank] > rankValue[firstCard.rank]))) ||
      (guess === 'equal' && (rankValue[card.rank] === rankValue[secondCard.rank] || rankValue[card.rank] === rankValue[firstCard.rank]))
    );

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

    gameState = 'won';
    isProcessing = false;

  }
</script>

<h1>Ride the Bus</h1>

{#if gameState === 'start'}
  <button on:click={startGame}>Start Game</button>
{/if}

{#if gameState === 'lost'}
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
  <p>You lost! The cards are revealed above.</p>
  <button on:click={startGame}>Retry</button>
{/if}

{#if gameState === 'won'}
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
  <h2>Congratulations! You won!</h2>
  <button on:click={startGame}>Play Again</button>
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
    <p>Guess the color of the first card:</p>
    <button on:click={() => guessColor('red')}>Red</button>
    <button on:click={() => guessColor('black')}>Black</button>
  {:else if !revealedCards[1]}
    <p>Will the next card be higher or lower?</p>
    <button on:click={() => guessHigherLower('higher')}>Higher</button>
    <button on:click={() => guessHigherLower('lower')}>Lower</button>
    <button on:click={() => guessHigherLower('equal')}>Equal</button>
	<button on:click={() => Cashout()}>Cashout</button>

  {:else if !revealedCards[2]}
	<p>Will the next card be in between or outside?</p>
	<button on:click={() => guessInsideOutside('inside')}>Inside</button>
	<button on:click={() => guessInsideOutside('outside')}>Outside</button>
	<button on:click={() => guessInsideOutside('equal')}>Equal</button>
	<button on:click={() => Cashout()}>Cashout</button>

  {:else if !revealedCards[3]}
	<p>Guess the suit of the final card:</p>
	<button on:click={() => guessSuit('♥')}>♥</button>
	<button on:click={() => guessSuit('♦')}>♦</button>
	<button on:click={() => guessSuit('♣')}>♣</button>
	<button on:click={() => guessSuit('♠')}>♠</button>
	<button on:click={() => Cashout()}>Cashout</button>

  {/if}
{/if}

<style>
  .card-row {
    display: flex;
    gap: 20px;
    margin: 20px 0;
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
</style>
