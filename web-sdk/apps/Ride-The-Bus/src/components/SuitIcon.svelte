<script lang="ts">
	/**
	 * The four suits, drawn rather than typed.
	 *
	 * They used to be the Unicode characters U+2660..U+2666 set in Poppins. That
	 * is a font dependency for the most important glyphs in a card game, and the
	 * font does not actually own them - they fall through to whatever the device
	 * substitutes, which on many phones is a colour emoji. So the same card could
	 * render as a flat black spade on desktop and a glossy blue-grey emoji on
	 * iOS, and neither respected the red/black colour the game sets. Stake's
	 * rating notes call out emoji icons directly as a mark against a release.
	 *
	 * Drawn, they are identical everywhere, take the colour from `currentColor`
	 * like every other icon here, and cost nothing to ship.
	 *
	 * ACCEPTS THE SUIT CHARACTER ITSELF as well as the name, because the
	 * character IS the data: roundContract types a card's suit as
	 * '♥' | '♦' | '♣' | '♠' and the math-sdk books carry the same, so call sites
	 * holding a real card pass it straight through with nothing to translate.
	 */
	type SuitName = 'heart' | 'diamond' | 'club' | 'spade';
	type SuitChar = '♥' | '♦' | '♣' | '♠';

	type Props = {
		suit: SuitName | SuitChar | string;
		/**
		 * Size, relative to the surrounding font-size. Defaults to the ratio a
		 * typed suit glyph actually occupied, so swapping one for the other does
		 * not change the look: a glyph set at 1em only inks about 0.8em of it,
		 * where an SVG at 1em would ink all of it and come out visibly larger.
		 */
		scale?: number;
	};

	const props: Props = $props();

	const FROM_CHAR: Record<string, SuitName> = {
		'♥': 'heart',
		'♦': 'diamond',
		'♣': 'club',
		'♠': 'spade',
	};

	const name = $derived((FROM_CHAR[props.suit] ?? props.suit) as SuitName);
	const size = $derived(`${props.scale ?? 0.82}em`);
</script>

<svg
	class="suit-icon"
	viewBox="0 0 24 24"
	fill="currentColor"
	style={`width:${size};height:${size}`}
	aria-hidden="true"
>
	{#if name === 'heart'}
		<!-- Two lobes meeting at a point. Wider and rounder than a UI heart -
		     card pips are squat. -->
		<path
			d="M12 21.4C12 21.4 2.6 15.1 2.6 9C2.6 5.7 5.1 3.2 8.2 3.2C10 3.2 11.3 4.1 12 5.3C12.7 4.1 14 3.2 15.8 3.2C18.9 3.2 21.4 5.7 21.4 9C21.4 15.1 12 21.4 12 21.4Z"
		/>
	{:else if name === 'diamond'}
		<!-- A rhombus, taller than wide, with the points very slightly softened
		     so it does not read as a sharp geometric shape at small sizes. -->
		<path
			d="M12 2.2C12 2.2 14.4 6.6 19.3 12C14.4 17.4 12 21.8 12 21.8C12 21.8 9.6 17.4 4.7 12C9.6 6.6 12 2.2 12 2.2Z"
		/>
	{:else if name === 'club'}
		<!-- Three lobes and a flared stem. Drawn as separate shapes rather than
		     one path - the overlap is what makes a club read as a club. -->
		<circle cx="12" cy="7.1" r="4.05" />
		<circle cx="6.85" cy="14.3" r="4.05" />
		<circle cx="17.15" cy="14.3" r="4.05" />
		<path d="M12 12.3C13 16 13.3 18.9 15.2 21.7H8.8C10.7 18.9 11 16 12 12.3Z" />
	{:else if name === 'spade'}
		<!-- An inverted heart over a flared stem. -->
		<path
			d="M12 2.3C12 2.3 3.4 9 3.4 14C3.4 16.7 5.5 18.6 8 18.6C9.6 18.6 10.9 17.8 11.6 16.7C11.4 18.9 10.6 20.5 9 21.7H15C13.4 20.5 12.6 18.9 12.4 16.7C13.1 17.8 14.4 18.6 16 18.6C18.5 18.6 20.6 16.7 20.6 14C20.6 9 12 2.3 12 2.3Z"
		/>
	{/if}
</svg>

<style>
	.suit-icon {
		display: block;
		flex: 0 0 auto;
	}
</style>
