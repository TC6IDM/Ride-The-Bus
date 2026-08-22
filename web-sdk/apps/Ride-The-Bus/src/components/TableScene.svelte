<script lang="ts">
	/**
	 * The table and everything sitting on it.
	 *
	 * Purely decorative: no props, no state, aria-hidden, and nothing in here
	 * responds to the game. It was ninety lines in the middle of Game.svelte's
	 * markup, between the icon snippets and the readouts, which made the board's
	 * actual structure hard to find.
	 *
	 * Drawn entirely in CSS - see styles/table.css. Every prop is placed out
	 * toward the table's rim so the middle stays clear for the cards and guesses,
	 * and each is built from separate top / side / shadow layers rather than one
	 * flat shape, because the volume is what sells the scene: a chip is a
	 * cylinder (elliptical top plus side wall), the table has a real edge, and
	 * everything casts to the lower-left from a light at the upper right.
	 *
	 * table.css is imported by Game.svelte and its selectors are scoped there, so
	 * the markup carries a :global block below rather than moving the stylesheet -
	 * a Svelte stylesheet only applies to the component that imports it.
	 */
	type Props = {
		/**
		 * Whether to draw the deck, the cups and the chip stacks.
		 *
		 * The start screen asks for them OFF. Its card is wider than the table at
		 * every landscape size - four square step panels need about 128 of its own
		 * units across, where the table is min(96vw, 130vh) - so every prop sits
		 * exactly where a panel is about to be drawn. Rendering thirty-odd elements
		 * to be completely occluded is waste, and any that did peek out would be
		 * fighting the controls the intro exists to demonstrate.
		 *
		 * The table itself still draws. The wood, the rim and the pool of light are
		 * the point: they put the intro in the same room as the game rather than on
		 * a green gradient of its own.
		 */
		showProps?: boolean;
	};

	const props: Props = $props();
	const showProps = $derived(props.showProps ?? true);
</script>

<!-- One chip, or a pile of them. Each chip in a stack is its own disc rather
     than one tall drum with lines ruled across it: the boundary between two
     stacked chips is a circle seen at the table's angle, so it has to be an
     arc. Drawn as straight seams the stack read as a striped can. Every disc
     is the same capsule, offset by one chip's thickness, and the one above
     covers all of the one below except its front edge. -->
{#snippet chipStack(colour: string, place: string, stack: number)}
  <div class="prop chip {colour} {place}" style="--stack: {stack}">
    <div class="chip-shadow"></div>
    {#each Array(stack) as _, i (i)}
      <div class="chip-disc" style="--i: {i}"></div>
    {/each}
    <div class="chip-top"></div>
  </div>
{/snippet}

<!-- Drawn entirely in CSS (see styles/table.css). Purely decorative, and
     every prop is placed out toward the table's rim so the middle stays
     clear for the cards and guesses. -->
<!-- Each prop is built from separate top / side / shadow layers rather than
     one flat shape, because the volume is what sells the scene: a chip is a
     cylinder (elliptical top + side wall), the table has a real edge, and
     everything casts to the lower-left from a light at the upper right. -->
<div class="scene" aria-hidden="true">
  <div class="table">
    <div class="table-edge"></div>
    <div class="table-surface">
      <!-- The bullnose rim, lit right round the table's perimeter. -->
      <div class="table-rim"></div>

{#if showProps}
        <!-- The deck, top left: the same brand-red back, chrome edge and
             Takeover chip mark as the four dealt cards (styles/cards.css), so
             the cards visibly come from it. -->
        <div class="prop deck p-deck">
          <div class="deck-shadow"></div>
          <div class="deck-stack"></div>
          <div class="deck-face"></div>
        </div>

        <!-- A party cup either side - it is a drinking game, and a pair reads
             as two people sitting at the table. The left one is further down
             its drink so they are not the same object twice. -->
        <div class="prop cup p-cup-1">
          <div class="cup-shadow"></div>
          <div class="cup-body">
            <!-- The three stepped ribs below the lip and the roll above the
                 base, which is what makes a party cup that shape and not a
                 plain cone. Each is the front arc of a circle round the cone,
                 so each has its own width and squash. -->
            <div class="cup-rib rib-1"></div>
            <div class="cup-rib rib-2"></div>
            <div class="cup-rib rib-3"></div>
            <div class="cup-rib rib-4"></div>
            <div class="cup-rib rib-5"></div>
          </div>
          <div class="cup-rim"></div>
          <div class="cup-inside"><div class="cup-drink"></div></div>
        </div>
        <div class="prop cup cup-low p-cup-2">
          <div class="cup-shadow"></div>
          <div class="cup-body">
            <!-- The three stepped ribs below the lip and the roll above the
                 base, which is what makes a party cup that shape and not a
                 plain cone. Each is the front arc of a circle round the cone,
                 so each has its own width and squash. -->
            <div class="cup-rib rib-1"></div>
            <div class="cup-rib rib-2"></div>
            <div class="cup-rib rib-3"></div>
            <div class="cup-rib rib-4"></div>
            <div class="cup-rib rib-5"></div>
          </div>
          <div class="cup-rim"></div>
          <div class="cup-inside"><div class="cup-drink"></div></div>
        </div>

        <!-- Two tight clusters, diagonally opposite, each holding all three
             denominations - that is what a player's own chips look like when
             they have been sitting there a while. An earlier pass had ten
             loose counters ringing the table and it read as clutter. -->
        <!-- Four stacks per cluster, set along an arc that follows the rim.
             DOM order runs from the far end of each arc to the near one, so
             the nearer stacks paint over the ones behind them. -->
        {@render chipStack('chip-red', 'p-chip-1', 5)}
        {@render chipStack('chip-blue', 'p-chip-2', 3)}
        {@render chipStack('chip-green', 'p-chip-3', 2)}
        {@render chipStack('chip-black', 'p-chip-4', 1)}

        {@render chipStack('chip-white', 'p-chip-5', 4)}
        {@render chipStack('chip-black', 'p-chip-6', 3)}
        {@render chipStack('chip-red', 'p-chip-7', 2)}
        {@render chipStack('chip-green', 'p-chip-8', 1)}
      {/if}
    </div>
  </div>
</div>

<style>
	@import '../styles/table.css';
</style>
