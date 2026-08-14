<script lang="ts">
	/**
	 * The guess icons, in one place.
	 *
	 * These are drawn in two screens now - the board and the start screen's
	 * how-to-play - and they have to be identical in both: the whole point of the
	 * start screen is teaching the player what the controls on the board mean, so
	 * a redrawn approximation would actively mislead. Game.svelte's snippets
	 * delegate here rather than holding their own copies, which is what stops the
	 * two drifting the next time one is tweaked.
	 *
	 * Sizing lives in this file, not in choices.css. Svelte scopes a stylesheet to
	 * the component that imports it, and a child component's elements never carry
	 * the parent's scope class - so the rules over there stopped matching these
	 * SVGs the moment they moved in here, and they rendered at their intrinsic
	 * size. The numbers are unchanged; they are just expressed where they can
	 * reach the elements. --ui is inherited from whichever square is hosting the
	 * icon, so the board and the start screen each get the right scale.
	 */
	type Props = {
		name: 'inside' | 'outside' | 'triangleUp' | 'triangleDown' | 'equals';
	};

	const props: Props = $props();
</script>

{#if props.name === 'inside'}
	<!-- Inside: the card lands BETWEEN the bounds, so the arrows converge. -->
	<svg
		class="io-icon"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M2.6 5v14" />
		<path d="M21.4 5v14" />
		<path d="M6 12h4.4" />
		<path d="M8.2 9.6 10.6 12l-2.4 2.4" />
		<path d="M18 12h-4.4" />
		<path d="M15.8 9.6 13.4 12l2.4 2.4" />
	</svg>
{:else if props.name === 'outside'}
	<!-- Outside: the card lands BEYOND the bounds, so the arrows diverge. Same
	     parts as Inside, mirrored - the pair has to read as opposites. -->
	<svg
		class="io-icon"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M10.2 5v14" />
		<path d="M13.8 5v14" />
		<path d="M7.6 12H3.2" />
		<path d="M5.4 9.6 3 12l2.4 2.4" />
		<path d="M16.4 12h4.4" />
		<path d="M18.6 9.6 21 12l-2.4 2.4" />
	</svg>
{:else if props.name === 'triangleUp'}
	<!-- Higher / Lower. Solid triangles, matching the typed U+25B2/U+25BC they
	     replace - a filled wedge reads as a value direction where the stepper's
	     open chevron reads as a nudge, so the two stay deliberately different. -->
	<svg class="hl-icon" viewBox="0 0 24 20" fill="currentColor" aria-hidden="true">
		<path d="M12 1.6 23 18.4H1Z" />
	</svg>
{:else if props.name === 'triangleDown'}
	<svg class="hl-icon" viewBox="0 0 24 20" fill="currentColor" aria-hidden="true">
		<path d="M12 18.4 1 1.6h22Z" />
	</svg>
{:else if props.name === 'equals'}
	<!-- The "=" pick. Typed, its ink sat 2px low in an 18px button (the glyph
	     rides the font's math axis, not the line box's centre, so flex centring
	     cannot fix it). Drawn, the two bars are centred by construction. -->
	<svg
		class="eq-icon"
		viewBox="0 0 24 12"
		fill="none"
		stroke="currentColor"
		stroke-width="3"
		stroke-linecap="round"
		aria-hidden="true"
	>
		<path d="M3 3.5h18" />
		<path d="M3 8.5h18" />
	</svg>
{/if}

<style>
	/* Sized to the typed triangle it replaces (~0.72em of the 22.4px choice
	   font), so the square looks unchanged - only the font dependency goes away. */
	.hl-icon {
		display: block;
		width: calc(var(--ui) * 1.97);
		height: calc(var(--ui) * 1.64);
	}

	/* The converge / diverge arrows. Kept narrower than the half they sit in so
	   they clear the yellow "equal" badge, which is centred on the seam and
	   overlaps both halves.

	   Both numbers here are clearance, not taste. The half is 4.18 --ui wide
	   (8.36 --ui square, split in two) and the badge eats half its own width off
	   the inner edge, so a centred icon of width I collides once
	   I/2 + badge/2 > 2.09 --ui. At 2.55 it cleared the OLD 1.64 badge by
	   nothing at all - they met exactly - which is why growing the badge put the
	   arrows underneath it. 2.3 plus a small outward nudge restores a real gap
	   and keeps the arrow heads clear of the yellow.

	   The nudge is a custom property because of Svelte scoping: this element
	   carries THIS component's scope class, so choices.css can never select it,
	   but a custom property inherits across the boundary. The parent sets the
	   direction per half - inside pushes left, outside pushes right. */
	.io-icon {
		display: block;
		width: calc(var(--ui) * 2.3);
		height: calc(var(--ui) * 2.3);
		transform: translateX(var(--io-icon-shift, 0px));
	}

	/* The drawn "=", sized to the ~11x5px ink of the glyph it replaces so the
	   badge looks unchanged apart from finally being centred. */
	/* Sized through overridable variables rather than --ui directly, so a caller
	   can put a floor under the glyph.
	   A custom property is the only lever that works here: this element carries
	   THIS component's scope class, so a selector written in the parent's
	   stylesheet can never match it - but custom properties inherit across the
	   boundary normally. The start screen uses that to keep the equals badge
	   legible on phones and popouts, where --ui bottoms out near 3px. */
	.eq-icon {
		display: block;
		width: var(--eq-icon-w, calc(var(--ui) * 1.19));
		height: var(--eq-icon-h, calc(var(--ui) * 0.585));
	}
</style>
