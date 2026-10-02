<script lang="ts">
	/**
	 * The die: three faces of a casino die lying on the table, from the scene's
	 * camera - the geometry is game/ui/dieGeometry.ts, held to table.css's --flat
	 * and --upright. One drawing for the table die and How to Play's controls
	 * guide, the way CardFace and TicketFace are one drawing each.
	 *
	 * The card back's reds (--brand-red*), so the die reads as part of the same
	 * set as the deck it sits beside, shaded by the room's one light from the
	 * upper right: the top lit, the right face in it, the front face turned away.
	 * The pips are the cards' paper. Sizes itself to its box.
	 */
	import { DIE_VIEW, PIPS, dieFaces, dieOutline, faceValues } from '../../game/ui/dieGeometry';

	type Props = {
		/** The value on top, 1-6. The two sides follow it, as on a real die. */
		face: number;
	};

	const props: Props = $props();
	const faces = dieFaces();
	const outline = dieOutline();
	const values = $derived(faceValues(props.face));
</script>

<svg class="die" viewBox={`0 0 ${DIE_VIEW} ${DIE_VIEW}`} aria-hidden="true">
	<polygon class="die-body" points={outline} />
	{#each faces as side (side.name)}
		<g class={`die-side is-${side.name}`} transform={side.matrix}>
			<rect x="-0.5" y="-0.5" width="1" height="1" rx="0.14" />
			{#if side.name === 'top'}
				<!-- The top's far edge, which projects to its upper right: the one
				     edge the room's light catches. Not a ring round the face - a
				     hairline all the way round is a box drawn, not lit. -->
				<line class="catch" x1="-0.34" y1="-0.47" x2="0.34" y2="-0.47" />
			{/if}
			{#each PIPS[values[side.name]] ?? [] as [u, v], i (i)}
				<circle cx={u} cy={v} r="0.088" />
			{/each}
		</g>
	{/each}
</svg>

<style>
	.die {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	/* The silhouette, rounded by its own stroke, in the deepest red: it fills
	   the notches where the faces' rounded corners leave the cube's corners. */
	.die-body {
		fill: var(--brand-red-deep);
		stroke: var(--brand-red-deep);
		stroke-width: 5;
		stroke-linejoin: round;
	}

	.die-side rect {
		fill: var(--brand-red);
	}

	.die-side circle {
		fill: var(--brand-paper);
	}

	/* Lit from the upper right: the top takes the light, and its far edge
	   the catch-light... */
	.is-top rect {
		fill: var(--brand-red-lit);
	}

	.catch {
		/* The room's light, the same warm white the panels' lit top edges take. */
		stroke: rgba(var(--panel-lit-rgb), 0.4);
		stroke-width: 1.2;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}

	/* ...the right face is in it... */
	.is-right circle {
		opacity: 0.88;
	}

	/* ...and the front face is turned away from it. */
	.is-front rect {
		fill: var(--brand-red-deep);
	}

	.is-front circle {
		opacity: 0.66;
	}
</style>
