<!-- A range input drawn as the game's own control.

     WHY THIS EXISTS. The sound and turbo panels used a bare <input type="range">
     with accent-color, which hands the whole control to the browser: Chrome
     draws a thick filled track and a round thumb, Firefox a thinner one, Safari
     its own - three different sliders inside a panel whose every other part is
     drawn to the table. They were the last UA-chrome widgets in the game, the
     same class of defect as the emoji suits and the Georgia "i" were.

     STILL A REAL RANGE INPUT. Only the paint is ours: the track and thumb
     pseudo-elements. Keyboard (arrows, Home/End, Page), the accessible name,
     `disabled` and the value semantics are the browser's, untouched.

     ONE DEFINITION, TWO IMPORTERS. A stylesheet is scoped to whichever
     component imports it, so the two panels could not share a slider rule -
     each would have carried a copy, which is the drift readout.css exists to
     prevent. A child component styles itself (the ChoiceIcon / BoltMeter
     precedent) and takes the panel's colour through the custom properties the
     tint contract already publishes: --tint fills the track and the thumb,
     --tint-rgb is not needed here. The parent sets nothing else.

     THE FILL. Firefox has ::-moz-range-progress for the travelled part of the
     track; WebKit has nothing, so the track is a two-stop gradient split at
     --fill, which this component publishes from the value. -->
<script lang="ts">
	type Props = {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		/** The accessible name. Pre-translated by the caller. */
		label: string;
		oninput?: (event: Event) => void;
	};

	let {
		value = $bindable(),
		min = 0,
		max = 100,
		step = 1,
		disabled = false,
		label,
		oninput,
	}: Props = $props();

	/** How far along the track the thumb sits, for the WebKit fill. */
	const fill = $derived(max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0);
</script>

<input
	class="range"
	type="range"
	{min}
	{max}
	{step}
	{disabled}
	bind:value
	{oninput}
	aria-label={label}
	style={`--fill: ${fill}%`}
/>

<style>
	.range {
		/* The thumb: a chip on the track. Scaled with the panel's unit and
		   floored, because a 6px disc on Popout S is not a thing a pointer can
		   find - the same trade the panel's close button makes. */
		--thumb: max(12px, calc(var(--ui-bar, 11px) * 1.64));
		--track: 4px;
		appearance: none;
		-webkit-appearance: none;
		display: block;
		width: 100%;
		min-width: 0;
		/* The TARGET, not the track: a range input has no height of its own
		   beyond the UA's ~16px, and the track below paints thin. The native
		   track centres itself in this box. */
		height: 24px;
		margin: 0;
		padding: 0;
		background: transparent;
		cursor: pointer;
	}

	@media (pointer: coarse) {
		/* A thumb is not a cursor - same argument as the bar's 36px floor. */
		.range {
			height: 32px;
		}
	}

	/* ---- The track: a groove, filled in the panel's colour up to the thumb. */
	.range::-webkit-slider-runnable-track {
		height: var(--track);
		border-radius: 999px;
		background: linear-gradient(
			to right,
			var(--tint) 0 var(--fill, 0%),
			rgba(var(--ink-rgb), 0.14) var(--fill, 0%) 100%
		);
		/* A hairline of shade along the top, so the groove reads as cut into the
		   panel - the inverse of the lit top edge every raised surface here
		   carries. */
		box-shadow: inset 0 1px 0 rgba(var(--shadow-rgb), 0.5);
	}

	/* Arabic runs the input right to left - the thumb starts at the right and
	   the travelled part of the track is on ITS right - and a gradient "to
	   right" would paint the fill on the wrong side. Firefox's
	   ::-moz-range-progress follows the direction on its own; WebKit's gradient
	   has to be told. :global() because [dir] is set on <html>, outside this
	   component - the same reason MarkIcon flips its arrow that way. */
	:global([dir='rtl']) .range::-webkit-slider-runnable-track {
		background: linear-gradient(
			to left,
			var(--tint) 0 var(--fill, 0%),
			rgba(var(--ink-rgb), 0.14) var(--fill, 0%) 100%
		);
	}

	.range::-moz-range-track {
		height: var(--track);
		border-radius: 999px;
		background: rgba(var(--ink-rgb), 0.14);
		box-shadow: inset 0 1px 0 rgba(var(--shadow-rgb), 0.5);
	}

	.range::-moz-range-progress {
		height: var(--track);
		border-radius: 999px;
		background: var(--tint);
	}

	/* ---- The thumb: a disc in the tint with the panel's own lit edge and the
	   table's two-part contact shadow, ringed in the panel colour so it reads
	   as sitting ON the track rather than painted across it. */
	.range::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		width: var(--thumb);
		height: var(--thumb);
		/* Centres the disc on the track; WebKit lays the thumb out from the
		   track's top edge. */
		margin-top: calc((var(--track) - var(--thumb)) / 2);
		border-radius: 50%;
		background: var(--tint);
		border: 2px solid var(--panel);
		box-shadow:
			inset 0 1px 0 var(--panel-lit),
			0 1px 2px rgba(var(--shadow-rgb), 0.55),
			0 3px 6px rgba(var(--shadow-rgb), 0.45);
	}

	.range::-moz-range-thumb {
		width: var(--thumb);
		height: var(--thumb);
		border-radius: 50%;
		background: var(--tint);
		border: 2px solid var(--panel);
		box-shadow:
			inset 0 1px 0 var(--panel-lit),
			0 1px 2px rgba(var(--shadow-rgb), 0.55),
			0 3px 6px rgba(var(--shadow-rgb), 0.45);
	}

	/* ---- States. Hover lifts the thumb's brightness a step; the press takes
	   it back below rest, the same "in, not brighter" language every control on
	   the bar speaks. Hover is gated so a tapped thumb does not keep it. */
	@media (hover: hover) {
		.range:not(:disabled):hover::-webkit-slider-thumb {
			filter: brightness(1.08);
		}

		.range:not(:disabled):hover::-moz-range-thumb {
			filter: brightness(1.08);
		}
	}

	.range:not(:disabled):active::-webkit-slider-thumb {
		filter: brightness(0.94);
	}

	.range:not(:disabled):active::-moz-range-thumb {
		filter: brightness(0.94);
	}

	/* Disabled: the muted bus keeps its level on show ("the level you will come
	   back to" - see SoundPopup.svelte), so the fill stays and the whole control
	   steps back in the dim ink, as the accent-color version did. */
	.range:disabled {
		--tint: var(--ink-dim);
		opacity: 0.38;
		cursor: not-allowed;
	}

	/* The ring goes on the input's box, which is the 24px target - never
	   transitioned. */
	.range:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
