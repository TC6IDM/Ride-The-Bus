<script lang="ts">
	/**
	 * Mute / unmute, drawn to match the rest of the control bar.
	 *
	 * Replaces the muted / unmuted speaker emoji, which were the only colour
	 * glyphs on screen and sat oddly against the flat drawn turbo, autoplay and
	 * stepper icons beside them. Like every emoji they also render differently
	 * on every platform, so the button's weight and alignment shifted between
	 * devices.
	 *
	 * Same construction as the neighbouring icons: a 24x24 box, a filled cone
	 * and stroked arcs, sized by the caller.
	 *
	 * MUTED IS A SLASH ACROSS THE WHOLE ICON, NOT A SWAPPED-IN CROSS.
	 *
	 * It used to replace the two arcs with a small cross where they had been, on
	 * the reasoning that the two states then read as the same control in
	 * different positions rather than one gaining and losing parts. That is a
	 * fair principle and it produced a weak mark: the cross sat in the arcs' own
	 * space, at the arcs' own weight, in the arcs' own colour, so at 24px the
	 * difference between "on" and "off" was two short strokes changing angle.
	 *
	 * A slash reads at a glance because it crosses the SILHOUETTE - it runs over
	 * the cone as well as the arcs, so the whole glyph is struck through rather
	 * than one corner of it being redrawn. The arcs stay underneath, so nothing
	 * is lost; they are only dimmed, because sound is off, not absent.
	 *
	 * WHY THE COLOUR ARRIVES AS A CUSTOM PROPERTY
	 *
	 * A stylesheet is scoped to the component that imports it, and this
	 * component's elements never carry the caller's scope class - so a
	 * `.sound-mute.off svg path` rule over in popups.css would compile to
	 * `...svelte-<parent>` and match nothing at all. Custom properties inherit
	 * through the DOM normally, which is the standing workaround here (see the
	 * notes atop ChoiceIcon.svelte and BoltMeter.svelte). `--sound-slash`
	 * defaults to currentColor so an un-styled caller still gets a visible mark.
	 */
	type Props = { muted: boolean };

	const props: Props = $props();
</script>

<svg class="cb-svg sound-icon" class:is-muted={props.muted} viewBox="0 0 24 24" aria-hidden="true">
	<!-- The cone: body and the flare out to the left, as one filled shape. -->
	<path
		class="cone"
		d="M4 9.2h3.4L12.2 5.1a0.6 0.6 0 0 1 1 0.46v12.88a0.6 0.6 0 0 1-1 0.46L7.4 14.8H4a0.8 0.8 0 0 1-0.8-0.8v-4a0.8 0.8 0 0 1 0.8-0.8Z"
		fill="currentColor"
	/>

	<!-- Two arcs. The outer one is lighter, so the pair reads as sound falling
	     away rather than as two identical strokes. Kept when muted and dimmed
	     rather than removed: the slash is what says "off". -->
	<path
		class="wave"
		d="M16.4 9.5a3.6 3.6 0 0 1 0 5"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
	/>
	<path
		class="wave wave-far"
		d="M19.2 7.1a7.2 7.2 0 0 1 0 9.8"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
	/>

	{#if props.muted}
		<!-- Drawn twice. The under-stroke is the button's own ground colour and
		     sits a little wider, cutting a channel through whatever the slash
		     crosses; without it a red line over a red-ish arc is invisible at the
		     one size that matters. Same trick, and the same reason, as the
		     keyline under the choice icons. -->
		<path
			class="slash-cut"
			d="M3.6 3.6 20.4 20.4"
			fill="none"
			stroke-width="4.4"
			stroke-linecap="round"
		/>
		<path
			class="slash"
			d="M3.6 3.6 20.4 20.4"
			fill="none"
			stroke-width="2.2"
			stroke-linecap="round"
		/>
	{/if}
</svg>

<style>
	.wave-far {
		opacity: 0.62;
	}

	/* Sound is off, not absent - the glyph stays whole and steps back. */
	.is-muted .cone {
		opacity: 0.72;
	}

	.is-muted .wave {
		opacity: 0.3;
	}

	.is-muted .wave-far {
		opacity: 0.18;
	}

	.slash-cut {
		stroke: var(--sound-slash-cut, transparent);
	}

	.slash {
		stroke: var(--sound-slash, currentColor);
	}
</style>
