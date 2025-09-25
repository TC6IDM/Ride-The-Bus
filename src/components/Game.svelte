<script lang="ts">
  import './app.css';
  import { waitForTimeout } from 'utils-shared/wait';

  type State = 'start' | 'playing' | 'won' | 'lost' | 'finished';
  let gameState: State = 'start';
  let isProcessing = false;
  let deck: Card[] = [];
  let currentIndex = 0;
  let currentCard: Card | null = null;
  let previousCard: Card | null = null;

  interface Card {
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    rank: 'A'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K';
  }

  const suits: Card['suit'][] = ['hearts','diamonds','clubs','spades'];
  const ranks: Card['rank'][] = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const rankValue: Record<Card['rank'],number> = {
    'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13
  };

  // Create a deck
  function createDeck(): Card[] {
    const d: Card[] = [];
    for(const suit of suits) {
      for(const rank of ranks) d.push({suit, rank});
    }
    return d;
  }

  // Shuffle
  function shuffleDeck(d: Card[]): Card[] {
    const shuffled = [...d];
    for(let i = shuffled.length-1; i>0; i--){
      const j = Math.floor(Math.random()*(i+1));
      [shuffled[i],shuffled[j]] = [shuffled[j],shuffled[i]];
    }
    return shuffled;
  }

  // Start game
  function startGame() {
    deck = shuffleDeck(createDeck());
    currentIndex = 0;
    previousCard = null;
    currentCard = null;
    gameState = 'playing';
  }

  // Draw next card
  function drawCard(): Card | null {
    if(currentIndex >= deck.length) return null;
    return deck[currentIndex++];
  }

  // Player guess functions
  function guessColor(color: 'red' | 'black') {
    if(isProcessing) return;
    isProcessing = true;

    const card = drawCard();
    if(!card) return;
    currentCard = card;

    const cardColor = card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black';
    if(cardColor === color) gameState = 'playing'; // correct
    else gameState = 'lost'; // wrong

    previousCard = card;
    isProcessing = false;
  }

  function guessHigherLower(guess: 'higher' | 'lower') {
    if(isProcessing || !previousCard) return;
    isProcessing = true;

    const card = drawCard();
    if(!card) return;
    currentCard = card;

    const correct =
      (guess === 'higher' && rankValue[card.rank] > rankValue[previousCard.rank]) ||
      (guess === 'lower' && rankValue[card.rank] < rankValue[previousCard.rank]);

    gameState = correct ? 'playing' : 'lost';
    previousCard = card;
    isProcessing = false;
  }

</script>

<h1>Ride the Bus</h1>

{#if gameState === 'start' || gameState === 'lost' || gameState === 'finished'}
  <button on:click={startGame}>Start Game</button>
  {#if gameState === 'lost'}<p>You lost! Try again.</p>{/if}
{/if}

{#if gameState === 'playing'}
  {#if !previousCard}
    <p>Guess the color of the first card:</p>
    <button on:click={() => guessColor('red')}>Red</button>
    <button on:click={() => guessColor('black')}>Black</button>
  {:else}
    <p>Previous card: {previousCard.rank} of {previousCard.suit}</p>
    <p>Will the next card be higher or lower?</p>
    <button on:click={() => guessHigherLower('higher')}>Higher</button>
    <button on:click={() => guessHigherLower('lower')}>Lower</button>
  {/if}

  {#if currentCard}
    <p>Current card: {currentCard.rank} of {currentCard.suit}</p>
  {/if}
{/if}
