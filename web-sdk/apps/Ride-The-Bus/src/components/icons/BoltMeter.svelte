<script lang="ts">
	/**
	 * A row of lightning bolts, `lit` of them burning.
	 *
	 * The bolt is the SAME silhouette the turbo button draws in ControlBar.svelte
	 * - and, deliberately, not the same treatment. This one is FILLED; that one
	 * is an outline. Controls are lines, gauges are fills: a stroked mark is
	 * something you press, a filled one is something you read. They used to be
	 * pixel-identical, and "speed" on the far left of the bar and "risk" under
	 * the bet amount were one glyph three inches apart, which is this game's
	 * two-units-on-one-screen bug class wearing an icon. One silhouette keeps
	 * them kin; the fill is what tells them apart.
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
			<path d="M13.5 2.2 4.5 13.4h7.3l-1.3 8.4 9-11.2h-7.3Z" />
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
		color: rgba(var(--ink-rgb), 0.16);
		transition: color var(--dur-control) var(--ease-out);
	}

	/* Fallbacks name the tokens rather than restating their hex - the value has
	   one home, and a meter that fails to receive --vol-color still burns the
	   ramp's own yellow. */
	.bolt.lit {
		color: var(--vol-color, var(--vol-base));
		/* A slight bloom, so the burning stops separate from the dead ones on a
		   busy background as well as by hue - the popup rows sit on translucent
		   white over the felt. Kept through the pass that removed the bar's
		   other glows: this one is a 3px separation on a 12px glyph, and it is
		   doing a job the hue alone was measured not to do. */
		filter: drop-shadow(0 0 calc(var(--bolt-size, 12px) * 0.25) var(--vol-color, var(--vol-base)));
	}

	/* Past the family ceiling. Only the OVERFLOW stops change colour, not the
	   whole meter: the first five still say which mode you are on, and the purple
	   ones say the guesses have taken it beyond what any mode reaches by itself.
	   Recolouring all seven would lose the family at exactly the moment the
	   rating is most worth reading. */
	.bolt.lit.overflow {
		color: var(--vol-overflow);
		filter: drop-shadow(0 0 calc(var(--bolt-size, 12px) * 0.3) var(--vol-overflow));
	}
</style>
