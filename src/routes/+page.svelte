<script>
  import { onMount } from 'svelte';

  let multiplier = 0;

  // Optional: min/max multipliers
  const MIN = 1;
  const MAX = 10;

  function play() {
    // Random multiplier between MIN and MAX
    multiplier = (Math.random() * (MAX - MIN) + MIN).toFixed(2);
  }
</script>

<main style="text-align:center; margin-top:50px;">
  <h1>Simple Stake Game</h1>
  <button on:click={play} style="padding:10px 20px; font-size:18px;">Play</button>
  <p style="font-size:24px; margin-top:20px;">Multiplier: {multiplier}x</p>
</main>
