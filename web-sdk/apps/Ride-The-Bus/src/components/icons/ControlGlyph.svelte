<script lang="ts">
	/**
	 * The control bar's marks, for How to Play's controls guide - so each line
	 * shows the button it describes instead of describing it in words ("the
	 * circular arrows").
	 *
	 * The paths are COPIED from ControlBar.svelte, not shared with it: the bar
	 * sizes its own copies in control-bar.css, and one component rendered in
	 * both places would put two sizing contracts in one scope - the same trade
	 * AutospinPopup makes for its infinity, plus and minus (CLAUDE.md, "each
	 * popup is its own component"). If a bar glyph is redrawn, redraw it here.
	 *
	 * Sized by the parent through --ctl-glyph-size; everything inside scales off
	 * it, so the guide can set one number per breakpoint.
	 */
	import MarkIcon from './MarkIcon.svelte';
	import SoundIcon from './SoundIcon.svelte';

	type Props = {
		name: 'deal' | 'mode' | 'bet' | 'chip' | 'turbo' | 'autoplay' | 'advanced' | 'sound' | 'info';
		/** The MODE pill's word, already translated - the bar prints it too. */
		label?: string;
	};

	const props: Props = $props();
</script>

<span
	class="ctl-glyph"
	class:is-deal={props.name === 'deal'}
	class:is-pill={props.name === 'mode' || props.name === 'bet'}
	class:is-mode={props.name === 'mode'}
	aria-hidden="true"
>
	{#if props.name === 'deal'}
		<!-- The deck square-on and the card being dealt off it, tilted. -->
		<svg viewBox="0 0 24 24" fill="none">
			<rect x="2.6" y="7.4" width="9.2" height="12.6" rx="1.6" fill="currentColor" opacity="0.55" />
			<rect x="11.4" y="3.2" width="9.2" height="12.6" rx="1.6" fill="currentColor" transform="rotate(19 16 9.5)" />
		</svg>
	{:else if props.name === 'mode'}
		<span class="ctl-mode-word">{props.label}</span>
	{:else if props.name === 'bet'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
			<path d="M12 4.5v15" />
			<path d="M4.5 12h15" />
		</svg>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
			<path d="M4.5 12h15" />
		</svg>
	{:else if props.name === 'chip'}
		<!-- A phone's bar has no plus and minus: the bet is the amount itself,
		     and the menu it opens is a rack of chips. -->
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
			<circle cx="12" cy="12" r="8.4" />
			<circle cx="12" cy="12" r="4.2" />
			<path d="M12 3.6v2.6M12 17.8v2.6M3.6 12h2.6M17.8 12h2.6" />
		</svg>
	{:else if props.name === 'turbo'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M13.5 2.2 4.5 13.4h7.3l-1.3 8.4 9-11.2h-7.3Z" />
		</svg>
	{:else if props.name === 'autoplay'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
			<g transform="rotate(45 12 12)">
				<path d="M4.6 12a7.4 7.4 0 0 1 12.7-5.2L19.4 8.9" />
				<path d="M19.6 5.4v3.6h-3.6" />
				<path d="M19.4 12a7.4 7.4 0 0 1-12.7 5.2L4.6 15.1" />
				<path d="M4.4 18.6v-3.6h3.6" />
			</g>
			<path d="M10.6 14.1 12 9.9l1.4 4.2M11.2 12.8h1.6" stroke-width="1.2" />
		</svg>
	{:else if props.name === 'advanced'}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
			<path d="M3 5h9.4M17.6 5H21M15 2.4v5.2" />
			<path d="M3 12h2.4M10.6 12H21M8 9.4v5.2" />
			<path d="M3 19h7.4M15.6 19H21M13 16.4v5.2" />
		</svg>
	{:else if props.name === 'sound'}
		<SoundIcon muted={false} />
	{:else if props.name === 'info'}
		<MarkIcon name="info" />
	{/if}
</span>

<style>
	/* A small disc in the bar's own material, so the guide shows the control
	   the way the bar does rather than a bare glyph floating in prose. */
	.ctl-glyph {
		--size: var(--ctl-glyph-size, 2em);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: calc(var(--size) * 0.06);
		flex: 0 0 auto;
		box-sizing: border-box;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		border: 1px solid rgba(var(--ink-rgb), 0.14);
		background: var(--panel-float);
		box-shadow: var(--panel-elevation-low);
		color: var(--ink-body);
		/* MarkIcon reads its size from here; the info mark is a stroked "i". */
		--mark-size: calc(var(--size) * 0.5);
	}

	.ctl-glyph :global(svg) {
		width: calc(var(--size) * 0.56);
		height: calc(var(--size) * 0.56);
	}

	/* The deal button: the one filled control, in its own blue. */
	.ctl-glyph.is-deal {
		border: max(1.5px, calc(var(--size) * 0.07)) solid rgba(var(--ink-rgb), 0.85);
		background: radial-gradient(circle at 50% 35%, var(--spin-lit), var(--spin-deep) 75%);
		color: var(--ink);
	}

	/* Plus-and-minus and the MODE word are wider than a disc. */
	.ctl-glyph.is-pill {
		width: auto;
		min-width: calc(var(--size) * 1.6);
		padding: 0 calc(var(--size) * 0.22);
		border-radius: calc(var(--size) * 0.5);
	}

	.ctl-glyph.is-pill :global(svg) {
		width: calc(var(--size) * 0.44);
		height: calc(var(--size) * 0.44);
	}

	.ctl-glyph.is-mode {
		border-color: var(--gold);
		color: var(--gold);
	}

	.ctl-mode-word {
		font-size: calc(var(--size) * 0.34);
		font-weight: 900;
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		white-space: nowrap;
	}
</style>
