<!-- A family's picture, on its card in the mode picker (the owner's pick G3,
     2026-10-17).

     Made of pieces the game already draws, never new art: CardFace for the
     cards, TicketFace for Last Stop's ticket, the table's own chip tokens for
     High Stakes' stack. Each says what the family IS before its sentence does:
     Classic a hand on its way; Second Chance a second card with the forgiven
     arrow over it; Last Stop the ticket, face down, with its range; High Stakes
     the tall stack; Three of a Kind three Kings.

     Decorative - the card's own words carry it - so aria-hidden. Sized by the
     box it is put in: everything is a percentage of it. Styles live HERE,
     because a parent's sheet never reaches a child's elements (the note atop
     ChoiceIcon.svelte); the parent hands in --fam, the family colour. -->
<script lang="ts">
  import CardFace from '../cards/CardFace.svelte';
  import TicketFace from '../cards/TicketFace.svelte';
  import type { ModeFamily } from '../../game/math/modes';

  let { family }: { family: ModeFamily } = $props();

  /** A card in the scene: rank, suit, centre (% of the box), turn, width (%). */
  type Placed = [rank: string, suit: string, x: number, y: number, turn: number, width: number];
  const SCENES: Partial<Record<ModeFamily, Placed[]>> = {
    base: [
      ['7', 'heart', 26, 54, -12, 30],
      ['9', 'club', 42, 48, -4, 30],
      ['3', 'diamond', 58, 48, 4, 30],
      ['J', 'spade', 74, 54, 12, 30],
    ],
    sc: [
      ['8', 'spade', 36, 52, -6, 34],
      ['5', 'heart', 62, 52, 6, 34],
    ],
    tr: [
      ['K', 'spade', 30, 54, -10, 30],
      ['K', 'heart', 50, 48, 0, 30],
      ['K', 'club', 70, 54, 10, 30],
    ],
  };
  const cards = $derived(SCENES[family] ?? []);
  const CHIPS = Array.from({ length: 9 }, (_, index) => index);
</script>

<span class="vignette" aria-hidden="true">
  {#each cards as [rank, suit, x, y, turn, width], index (index)}
    <span class="v-card" style={`left: ${x}%; top: ${y}%; width: ${width}%; transform: translate(-50%, -50%) rotate(${turn}deg)`}>
      <CardFace {rank} {suit} />
    </span>
  {/each}
  {#if family === 'sc'}
    <!-- The board's forgiven arrow, in the family's own colour. -->
    <svg class="v-forgive" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 3v5h-5" />
    </svg>
  {:else if family === 'ls'}
    <span class="v-ticket"><TicketFace value={null} /></span>
  {:else if family === 'hs'}
    <span class="v-stack">
      {#each CHIPS as index (index)}<i style={`bottom: ${index * 9}%`}></i>{/each}
    </span>
  {/if}
</span>

<style>
  .vignette {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
  }

  .v-card {
    position: absolute;
    aspect-ratio: 200 / 298;
    border-radius: 6%;
    overflow: hidden;
    background: var(--card-paper);
    box-shadow: 0 2px 6px rgba(var(--shadow-rgb), 0.45);
  }

  .v-forgive {
    position: absolute;
    left: 62%;
    top: 22%;
    width: 26%;
    transform: translate(-50%, -50%);
    color: var(--fam, var(--forgiven));
    filter: drop-shadow(0 1px 2px rgba(var(--shadow-rgb), 0.7));
  }

  .v-ticket {
    position: absolute;
    left: 50%;
    top: 50%;
    height: 88%;
    aspect-ratio: 120 / 200;
    transform: translate(-50%, -50%) rotate(-6deg);
    filter: drop-shadow(0 4px 6px rgba(var(--shadow-rgb), 0.45));
  }

  /* The table's red chip, nine high: the family that stakes the most on a miss. */
  .v-stack {
    position: absolute;
    left: 50%;
    bottom: 10%;
    width: 34%;
    height: 76%;
    transform: translateX(-50%);
  }

  .v-stack i {
    position: absolute;
    left: 0;
    right: 0;
    height: 22%;
    border-radius: 50%;
    background: repeating-conic-gradient(from 10deg, var(--chip-red-cream) 0 12deg, var(--chip-red-face) 12deg 45deg);
    box-shadow: 0 2px 0 var(--chip-red-dark), 0 3px 4px rgba(var(--shadow-rgb), 0.4);
  }

  .v-stack i::after {
    content: '';
    position: absolute;
    inset: 18%;
    border-radius: 50%;
    background: var(--chip-red-face);
    box-shadow: inset 0 0 0 1px rgba(var(--ink-rgb), 0.6);
  }
</style>
