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
	 * and stroked arcs, sized by the caller. Muted swaps the arcs for a cross
	 * rather than hiding them, so the two states read as the same control in
	 * different positions instead of one gaining and losing parts.
	 */
	type Props = { muted: boolean };

	const props: Props = $props();
</script>

<svg class="cb-svg sound-icon" viewBox="0 0 24 24" aria-hidden="true">
	<!-- The cone: body and the flare out to the left, as one filled shape. -->
	<path d="M4 9.2h3.4L12.2 5.1a0.6 0.6 0 0 1 1 0.46v12.88a0.6 0.6 0 0 1-1 0.46L7.4 14.8H4a0.8 0.8 0 0 1-0.8-0.8v-4a0.8 0.8 0 0 1 0.8-0.8Z" fill="currentColor" />

	{#if props.muted}
		<!-- A cross, at the same weight as the arcs it replaces. -->
		<path
			d="M16.6 9.6 21.4 14.4M21.4 9.6 16.6 14.4"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		/>
	{:else}
		<!-- Two arcs. The outer one is lighter, so the pair reads as sound
		     falling away rather than as two identical strokes. -->
		<path
			d="M16.4 9.5a3.6 3.6 0 0 1 0 5"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
		/>
		<path
			d="M19.2 7.1a7.2 7.2 0 0 1 0 9.8"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			opacity="0.62"
		/>
	{/if}
</svg>
