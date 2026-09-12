<script lang="ts">
	/**
	 * A row of lightning bolts, `lit` of them burning.
	 *
	 * The bolt is the SAME path the turbo button draws in Game.svelte. That is
	 * deliberate: two different lightning glyphs on one screen would read as two
	 * different ideas, and this game already has a bug class about exactly that.
	 *
	 * SIZING AND COLOUR LIVE HERE, not in popups.css. Svelte scopes a stylesheet
	 * to the component that imports it, and a child component's elements never
	 * carry the parent's scope class - so a `.bolt` rule written over there would
	 * compile to `.bolt.svelte-<parent>` and match nothing, and the SVGs would
	 * render at their intrinsic size. ChoiceIcon.svelte carries a longer note on
	 * the same trap, which this game has already shipped once.
	 *
	 * What the parent CAN reach are custom properties, which inherit through the
	 * DOM normally: --vol-color sets the lit colour and --bolt-size the scale.
	 */
	type Props = {
		/** How many bolts burn, from the left. */
		lit: number;
		/** How many are drawn in total. */
		total: number;
		/**
		 * Read out in place of the bolts, which are decorative individually and
		 * only mean something as a count. Pre-translated by the caller.
		 */
		label: string;
		/**
		 * Stops past this one burn --vol-overflow instead of --vol-color.
		 *
		 * Marks the point where the rating has left the range the three modes
		 * span on their own and is being driven by the guesses. Defaults to the
		 * total, i.e. no overflow stops at all.
		 */
		overflowAfter?: number;
	};

	const props: Props = $props();

	const overflowAfter = $derived(props.overflowAfter ?? props.total);

	// A plain index array. `{#each Array(n) as _, i}` iterates holes and trips the
	// unused-binding lint; this says what it means and costs nothing at five.
	const bolts = $derived(Array.from({ length: props.total }, (_, index) => index));
</script>

<span class="bolt-meter" role="img" aria-label={props.label}>
	{#each bolts as index}
		<svg
			class="bolt"
			class:lit={index < props.lit}
			class:overflow={index >= overflowAfter}
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
		>
			<path d="M7 2v11h3v9l7-12h-4l4-8z" />
		</svg>
	{/each}
</span>

<style>
	.bolt-meter {
		display: inline-flex;
		align-items: center;
		/* Tight enough that five bolts read as one object rather than five icons. */
		gap: calc(var(--bolt-size, 12px) * 0.1);
		flex: none;
	}

	.bolt {
		display: block;
		width: var(--bolt-size, 12px);
		height: var(--bolt-size, 12px);
		/* The unlit stops are drawn, not omitted: the rating is "3 of 5", and a
		   meter that renders three bolts and stops cannot say what the 5 was. */
		color: rgba(255, 255, 255, 0.16);
		transition: color var(--dur-control) var(--ease-out);
	}

	.bolt.lit {
		color: var(--vol-color, #ffc93c);
		/* A slight bloom, so the burning stops separate from the dead ones on a
		   busy background as well as by hue - the popup rows sit on translucent
		   white over the felt. */
		filter: drop-shadow(0 0 calc(var(--bolt-size, 12px) * 0.25) var(--vol-color, #ffc93c));
	}

	/* Past the family ceiling. Only the OVERFLOW stops change colour, not the
	   whole meter: the first five still say which mode you are on, and the purple
	   ones say the guesses have taken it beyond what any mode reaches by itself.
	   Recolouring all seven would lose the family at exactly the moment the
	   rating is most worth reading. */
	.bolt.lit.overflow {
		color: var(--vol-overflow, #9d4edd);
		filter: drop-shadow(0 0 calc(var(--bolt-size, 12px) * 0.3) var(--vol-overflow, #9d4edd));
	}
</style>
