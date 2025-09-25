<script lang="ts">
  import './app.css';

  type State = 'start' | 'playing' | 'won' | 'lost';
  let gameState: State = 'start';
  let isProcessing = false;

  interface Card {
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    rank: 'A'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K';
  }

  const suits: Card['suit'][] = ['hearts','diamonds','clubs','spades'];
  const ranks: Card['rank'][] = ['A','2','3','4','5','6','7','8','9' ,'10','J' ,'Q' ,'K'];
  const rankValue: Record<Card['rank'],number> = {
    'A':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13
  };

  let deck: Card[] = [];
  let currentIndex = 0;
  let previousCard: Card | null = null;

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
    previousCard = null;
    revealedCards = [null, null, null, null];
    gameState = 'playing';
    isProcessing = false;
  }

  function drawCard(): Card | null {
    if(currentIndex >= deck.length) return null;
    return deck[currentIndex++];
  }

  function guessColor(color: 'red'|'black') {
    if(isProcessing || currentIndex >= 4) return;
    isProcessing = true;

    const card = drawCard();
    if(!card) return;

    revealedCards[currentIndex-1] = card; // store card in correct block

    const cardColor = card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black';
    if(cardColor !== color) gameState = 'lost';

    previousCard = card;
    isProcessing = false;
  }

  function guessHigherLower(guess: 'higher'|'lower') {
    if(isProcessing || !previousCard || currentIndex >= 4) return;
    isProcessing = true;

    const card = drawCard();
    if(!card) return;

    revealedCards[currentIndex-1] = card; // store in block

    const correct =
      (guess === 'higher' && rankValue[card.rank] > rankValue[previousCard.rank]) ||
      (guess === 'lower' && rankValue[card.rank] < rankValue[previousCard.rank]);

    if(!correct) gameState = 'lost';

    previousCard = card;
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
          <p>{card.rank} of {card.suit}</p>
        {:else}
          <p>?</p>
        {/if}
      </div>
    {/each}
  </div>
  <p>You lost! The card was revealed above.</p>
  <button on:click={startGame}>Retry</button>
{/if}

{#if gameState === 'playing'}
  <div class="card-row">
    {#each revealedCards as card, index}
      <div class="card-block">
        {#if card}
          <p>{card.rank} of {card.suit}</p>
        {:else}
          <p>?</p>
        {/if}
      </div>
    {/each}
  </div>

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
</style>
