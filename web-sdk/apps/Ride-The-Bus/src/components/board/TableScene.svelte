<script lang="ts">
	/**
	 * The table and everything sitting on it.
	 *
	 * Decorative, aria-hidden, and nothing in THIS file responds to the game.
	 * The two characters in the room do, and they live in BackRoomCast.svelte,
	 * which the game asks for with `showCast`. It was ninety lines in the middle of Game.svelte's
	 * markup, between the icon snippets and the readouts, which made the board's
	 * actual structure hard to find.
	 *
	 * Drawn entirely in CSS - see styles/scene/table.css. Every prop is placed out
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
	import TicketFace from '../cards/TicketFace.svelte';
	import BackRoomCast from './BackRoomCast.svelte';
	import TumblerGlass from './TumblerGlass.svelte';
	import CardFace from '../cards/CardFace.svelte';
	import { familyRules } from '../../game/bet/betState.svelte';

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
		/**
		 * Whether the two characters and the Boss's bar cart are in the room.
		 * Only the game asks: the loader is up before their frames arrive, and
		 * the start screen's card covers the room either side of the table.
		 */
		showCast?: boolean;
	};

	const props: Props = $props();
	const showProps = $derived(props.showProps ?? true);
	const showCast = $derived(props.showCast ?? false);
	/** The ticket stack is Last Stop's: on a family without a ticket, a stack
	 *  printing "x2 - x10" offers a multiplier that cannot be won there (the
	 *  owner's call, 2026-10-02; a review called it the single-family leak in
	 *  reverse). That side of the table is bare wood on the other families. */
	const showTickets = $derived(familyRules().ticket !== null);
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
  <!-- The back room's one picture: the route the game is named for. -->
  <div class="room-print">
    <svg viewBox="0 0 160 100">
      <rect class="print-frame" x="1" y="1" width="158" height="98" rx="2" />
      <rect class="print-paper" x="9" y="9" width="142" height="82" />
      <path class="print-route" d="M20 70 C45 70 50 30 80 34 S118 66 140 30" />
      <circle class="print-stop" cx="20" cy="70" r="3.4" />
      <circle class="print-stop" cx="52" cy="44" r="3.4" />
      <circle class="print-stop" cx="80" cy="34" r="3.4" />
      <circle class="print-stop" cx="110" cy="55" r="3.4" />
      <circle class="print-end" cx="140" cy="30" r="5" />
    </svg>
  </div>
  <!-- The floor: boards toward the far wall, the rug under the table, the
       skirting where they meet the wall (2026-10-22). -->
  <div class="room-floor">
    <div class="room-floor-plane"><div class="room-rug"></div></div>
    <div class="room-floor-light"></div>
    <div class="room-skirting"></div>
  </div>
  <!-- THE FAR WALLS, drawn only where a wide window shows them (2026-10-23):
       a door behind the Floorman, a night-city painting beside it, and on the
       right wall a framed Ace of Spades, the house card. -->
  <div class="room-dressing">
    <div class="room-door">
      <div class="door-slab">
        <span class="door-panel p1"></span>
        <span class="door-panel p2"></span>
        <span class="door-panel p3"></span>
        <span class="door-panel p4"></span>
        <span class="door-knob"></span>
      </div>
      <span class="door-light"></span>
    </div>
    <div class="room-painting">
      <svg viewBox="0 0 120 84" preserveAspectRatio="none">
        <defs>
          <linearGradient id="room-night" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0d1420" />
            <stop offset="1" stop-color="#2a2430" />
          </linearGradient>
        </defs>
        <rect class="painting-frame" x="0" y="0" width="120" height="84" />
        <rect x="7" y="7" width="106" height="70" fill="url(#room-night)" />
        <circle class="painting-moon" cx="92" cy="22" r="6" />
        <path class="painting-city" d="M7 77 V58 H15 V50 H21 V60 H27 V44 H35 V56 H41 V40 H47 V36 H51 V40 H57 V60 H63 V48 H71 V62 H77 V52 H85 V58 H91 V46 H99 V60 H105 V54 H113 V77 Z" />
        <g class="painting-windows">
          <rect x="29" y="48" width="2" height="2" /><rect x="43" y="44" width="2" height="2" />
          <rect x="43" y="52" width="2" height="2" /><rect x="65" y="52" width="2" height="2" />
          <rect x="93" y="50" width="2" height="2" /><rect x="17" y="54" width="2" height="2" />
          <rect x="79" y="56" width="2" height="2" />
        </g>
      </svg>
    </div>
    <!-- The house card, framed: the deck's own Ace of Spades - CardFace, the
         same face the board turns over, on the same paper - not a lookalike
         (the owner, 2026-10-23: "the exact same as the ace we have in the
         deck"). -->
    <div class="room-ace">
      <div class="ace-paper"><CardFace rank="A" suit="♠" /></div>
    </div>
  </div>
  {#if showCast}
    <BackRoomCast />
  {/if}
  <!-- Cigar smoke hanging under the ceiling, drifting slowly. -->
  <div class="room-haze">
    <span class="haze h1"></span>
    <span class="haze h2"></span>
    <span class="haze h3"></span>
  </div>
  <!-- The room's vignette, over the floor and the characters, under the table. -->
  <div class="room-shade"></div>
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

        <!-- The stack of bus tickets, where the right-hand party cup stood:
             the visible stack Last Stop's clean sweep draws from, on Last
             Stop's table only (see showTickets). Its top ticket is TicketFace,
             the same drawing as the board's slot, lying flat. The cup it
             replaced does not come back: that halved the drinking-game
             imagery the rundown flagged (2026-09-25). -->
        {#if showTickets}
          <div class="prop tickets p-tickets">
            <div class="tickets-shadow"></div>
            <div class="tickets-stack"></div>
            <div class="tickets-face"><TicketFace value={null} /></div>
          </div>
        {/if}
        <!-- A whiskey glass, the twin of the one on the Boss's bar cart
             (2026-10-23; it replaced a red party cup). -->
        <div class="prop tumbler p-glass">
          <span class="tumbler-shadow"></span>
          <span class="tumbler-caustic"></span>
          <span class="tumbler-reflection"></span>
          <TumblerGlass />
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
	@import '../../styles/scene/table.css';
</style>
