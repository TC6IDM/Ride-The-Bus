<script lang="ts">
	/**
	 * The small marks - cross, tick, arrow, info - drawn rather than typed.
	 *
	 * This is the same argument SuitIcon.svelte makes, applied to the glyphs it
	 * did not cover, and it is a correctness fix rather than a taste one. The
	 * self-hosted body face's latin block declares this unicode-range (Google's
	 * standard latin subset; it was the same under Poppins and is under Barlow):
	 *
	 *   U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC,
	 *   U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,
	 *   U+2212, U+2215, U+FEFF, U+FFFD
	 *
	 * U+2715 MULTIPLICATION X, U+2713 CHECK MARK and U+2192 RIGHTWARDS ARROW are
	 * not in it. Note how close the near miss is: the range carries U+2191 and
	 * U+2193, the up and down arrows, but not the right one in between (and the
	 * shipped Barlow files do not even carry those two). So every one of those
	 * characters fell straight through the webfont to whatever the device
	 * substitutes - which on Android and iOS is routinely a colour emoji,
	 * at a weight and colour the game does not control. Stake names emoji icons
	 * directly as a mark against a release.
	 *
	 * The bust cross is the worst of them: it is the loss moment, drawn at about
	 * 64px, and it was the one glyph on screen guaranteed not to be the game's
	 * own typeface.
	 *
	 * NOT drawn here, deliberately: the card RANKS. A to K are ASCII, they are
	 * inside U+0000-00FF, and both self-hosted faces ship them in the latin
	 * subset. There is no fallback bug to fix, and hand-cutting
	 * thirteen glyph outlines would trade a real typeface for a worse one.
	 *
	 * SIZING LIVES HERE, not in the parent stylesheet. Svelte scopes a stylesheet
	 * to the component that imports it, and a child component's elements never
	 * carry the parent's scope class - so `.bust-x svg` written in cards.css
	 * compiles to a selector that matches nothing. Custom properties inherit
	 * through the DOM normally, so the parent sets --mark-size and this sizes
	 * itself off it. BoltMeter.svelte does the same with --bolt-size, and
	 * ChoiceIcon.svelte carries the long version of this note.
	 */
	type Props = {
		name: 'cross' | 'check' | 'arrow' | 'info';
		/**
		 * Height, when the parent has not set --mark-size. Expressed in em so a
		 * mark dropped into a text run takes its size from the surrounding font,
		 * exactly as the character it replaces did.
		 */
		scale?: number;
	};

	const props: Props = $props();

	/**
	 * Width as a multiple of height. The arrow is the only wide one: its viewBox
	 * hugs the drawing (2:1) rather than padding it out to a square, so the size
	 * below maps onto the glyph's real ink instead of onto empty margin. The
	 * lemniscate in Game.svelte is drawn on the same principle.
	 */
	const ASPECT: Record<Props['name'], number> = {
		cross: 1,
		check: 1,
		arrow: 2,
		info: 1,
	};

	const size = $derived(`var(--mark-size, ${props.scale ?? 0.8}em)`);
	const aspect = $derived(ASPECT[props.name]);
</script>

<svg
	class="mark-icon"
	class:is-directional={props.name === 'arrow'}
	viewBox={props.name === 'arrow' ? '0 0 24 12' : '0 0 24 24'}
	fill="none"
	stroke="currentColor"
	stroke-linecap="round"
	stroke-linejoin="round"
	style={`width: calc(${size} * ${aspect}); height: ${size}`}
	aria-hidden="true"
>
	{#if props.name === 'cross'}
		<!-- Two strokes through the centre. Round caps, matching every other drawn
		     glyph here - the stepper chevrons, the equals bars and the converge
		     arrows all use them, and a square-capped cross would read as a
		     different icon set. -->
		<path d="M5.5 5.5 18.5 18.5" stroke-width="3" />
		<path d="M18.5 5.5 5.5 18.5" stroke-width="3" />
	{:else if props.name === 'check'}
		<!-- Deliberately NOT the mirror of the cross. A tick and a cross are the
		     two verdicts the worked examples show side by side, so they have to be
		     distinguishable at a glance and at about 12px, which two diagonals of
		     equal weight are not. The long arm runs well past the short one. -->
		<path d="M4.2 12.6 9.6 18 19.8 6.4" stroke-width="3" />
	{:else if props.name === 'arrow'}
		<!-- Shaft plus an open head, on a 2:1 viewBox. The head is open rather
		     than a filled triangle because this is a connector between two cards,
		     not a verdict - the filled wedges belong to Higher and Lower, and
		     ChoiceIcon keeps that distinction on purpose. -->
		<path d="M1.6 6h19" stroke-width="2.4" />
		<path d="M15.6 1.8 20.4 6l-4.8 4.2" stroke-width="2.4" />
	{:else if props.name === 'info'}
		<!-- Replaces a lowercase i set in italic Georgia - a system-font fallback
		     chain (Georgia, then Times New Roman, then whatever) in an app that
		     self-hosts its typeface precisely so it never has to make that guess.
		     On a device carrying neither, that one glyph was the only text on
		     screen in an unknown face. -->
		<circle cx="12" cy="12" r="9.4" stroke-width="2" />
		<circle cx="12" cy="7.3" r="1.4" fill="currentColor" stroke="none" />
		<path d="M12 10.9v6.3" stroke-width="2.4" />
	{/if}
</svg>

<style>
	.mark-icon {
		display: block;
		flex: 0 0 auto;
		/* A drop-shadow rather than a text-shadow, and it has to come from the
		   parent through a custom property for the same scoping reason the size
		   does. The bust cross needs one to stay legible over a revealed card
		   face; nothing else does, so the default is none. Applying it to the
		   parent element instead would shadow that element's background box as
		   well as the glyph. */
		filter: var(--mark-shadow, none);
	}

	/* The arrow is the only mark that MEANS a direction: it joins one card to
	   the next in the worked examples, and those rows are laid out by flex, so
	   in Arabic they run the other way. Left pointing right it aimed from the
	   second card back at the first, and the sequence read backwards.

	   A cross and a tick are verdicts on the card beside them and mirror to
	   nothing, which is why this is opt-in rather than applied to .mark-icon.
	   :global() because [dir] is set on <html>, outside this component - see
	   loader.css:204, which flips transform-origin the same way. */
	:global([dir='rtl']) .is-directional {
		transform: scaleX(-1);
	}
</style>
