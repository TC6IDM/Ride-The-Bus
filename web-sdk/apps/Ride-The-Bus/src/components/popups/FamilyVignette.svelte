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
    // Higher and a touch narrower than the other hands (2026-10-18): the
    // outer Kings' turned corners hung into the blurb under them on a laptop,
    // where Three of a Kind's four-line sentence takes the most room.
    tr: [
      ['K', 'spade', 31, 44, -10, 27],
      ['K', 'heart', 50, 39, 0, 27],
      ['K', 'club', 69, 44, 10, 27],
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
      {#each CHIPS as index (index)}<i class="v-chip" style={`--n: ${index}`}></i>{/each}
      <i class="v-top"></i>
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

  /* The table's red chip, nine high: the family that stakes the most on a miss.
     A REAL STACK (the owner's note, 2026-10-18: the chips "look like they're
     just floating on top of each other"). They were nine flat ellipses 9%
     apart with a 2px shadow between, so the table showed through every gap.
     Now each chip is its WALL - one chip's thickness of the rim, striped with
     its edge spots and shaded round the cylinder, as table.css draws the
     table's own stacks - laid exactly one thickness above the one under it,
     so they touch, and only the top chip shows its face. All in percentages
     of the stack, so it scales with the card. */
  .v-stack {
    --face: 20%;
    --thick: 7.5%;
    position: absolute;
    left: 50%;
    bottom: 8%;
    width: 34%;
    height: 80%;
    transform: translateX(-50%);
  }

  /* One chip: its face's ellipse plus its thickness, rounded top and bottom
     by the face's half-height (10% of the stack is 36.4% of the chip's box). */
  .v-chip {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(var(--n) * var(--thick));
    z-index: var(--n);
    height: calc(var(--face) + var(--thick));
    border-radius: 50% / 36.4%;
    background:
      linear-gradient(90deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.22) 14%, rgba(255, 255, 255, 0.04) 46%, rgba(255, 255, 255, 0.14) 62%, rgba(0, 0, 0, 0.3) 88%, rgba(0, 0, 0, 0.6) 100%),
      linear-gradient(90deg,
        var(--chip-red-cream) 0 0.32%, var(--chip-red) 0.32% 10.87%, var(--chip-red-cream) 10.87% 18.87%, var(--chip-red) 18.87% 44.34%,
        var(--chip-red-cream) 44.34% 55.66%, var(--chip-red) 55.66% 81.13%, var(--chip-red-cream) 81.13% 89.13%, var(--chip-red) 89.13% 99.68%,
        var(--chip-red-cream) 99.68% 100%);
    /* The join to the chip below: a hairline on the wall's own lower arc. */
    box-shadow: inset 0 -1px 0 rgba(var(--shadow-rgb), 0.55);
  }

  /* The bottom chip stands on the card: its contact shadow. */
  .v-chip:first-child {
    box-shadow:
      inset 0 -1px 0 rgba(var(--shadow-rgb), 0.55),
      0 3px 5px rgba(var(--shadow-rgb), 0.45);
  }

  /* The face of the top chip: cream spots round the rim, the dark ring, the
     flat centre - the table's chip top, seen from a little above. */
  .v-top {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(9 * var(--thick));
    z-index: 10;
    height: var(--face);
    border-radius: 50%;
    /* The guess chip's face (PickChip.svelte), as on the table's chips:
       a cream ring, eight 13deg cream spots round the rim. */
    background:
      radial-gradient(closest-side, var(--chip-red-face) 0 52.3%, var(--chip-red-cream) 53.7% 59.4%, var(--chip-red-face) 60.8% 83.4%, transparent 84.9%),
      conic-gradient(
        var(--chip-red-cream) 0deg 9.6deg, var(--chip-red-face) 9.6deg 49.6deg, var(--chip-red-cream) 49.6deg 61.7deg,
        var(--chip-red-face) 61.7deg 85.6deg, var(--chip-red-cream) 85.6deg 94.4deg, var(--chip-red-face) 94.4deg 118.3deg,
        var(--chip-red-cream) 118.3deg 130.4deg, var(--chip-red-face) 130.4deg 170.4deg, var(--chip-red-cream) 170.4deg 189.6deg,
        var(--chip-red-face) 189.6deg 229.6deg, var(--chip-red-cream) 229.6deg 241.7deg, var(--chip-red-face) 241.7deg 265.6deg,
        var(--chip-red-cream) 265.6deg 274.4deg, var(--chip-red-face) 274.4deg 298.3deg, var(--chip-red-cream) 298.3deg 310.4deg,
        var(--chip-red-face) 310.4deg 350.4deg, var(--chip-red-cream) 350.4deg 360deg
      );
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
  }
</style>
