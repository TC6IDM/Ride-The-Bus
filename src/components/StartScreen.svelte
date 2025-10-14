<script lang="ts">
  interface Card {
    suit: '♥' | '♦' | '♣' | '♠';
    rank: 'A'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K';
  }
  export let revealedCards: (Card | null)[];
  export let betInput: string;
  export let startGame: () => void;
</script>

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
<div class="game-stage">
  <label for="bet">Enter your initial bet:</label>
  <input id="bet" type="number" bind:value={betInput} min="1" />
  <div class="button-group">
    <button on:click={startGame}>Start Game</button>
  </div>
</div>

<style src="./common.css"></style>