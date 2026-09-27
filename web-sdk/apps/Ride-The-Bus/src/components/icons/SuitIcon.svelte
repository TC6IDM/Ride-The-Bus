<script lang="ts">
	/**
	 * The four suits, drawn rather than typed.
	 *
	 * They used to be the Unicode characters U+2660..U+2666 set in the body face
	 * (Poppins then, Geist now - neither ships them in its subsets). That is a
	 * font dependency for the most important glyphs in a card game, and the
	 * font does not actually own them - they fall through to whatever the device
	 * substitutes, which on many phones is a colour emoji. So the same card could
	 * render as a flat black spade on desktop and a glossy blue-grey emoji on
	 * iOS, and neither respected the red/black colour the game sets. Stake's
	 * rating notes call out emoji icons directly as a mark against a release.
	 *
	 * Drawn, they are identical everywhere, take the colour from `currentColor`
	 * like every other icon here, and cost nothing to ship.
	 *
	 * The shapes live in game/ui/suitPaths.ts, because the card face's pips draw
	 * them too and a game with two hearts in it has one too many.
	 *
	 * ACCEPTS THE SUIT CHARACTER ITSELF as well as the name, because the
	 * character IS the data: roundContract types a card's suit as
	 * '♥' | '♦' | '♣' | '♠' and the math-sdk books carry the same, so call sites
	 * holding a real card pass it straight through with nothing to translate.
	 */
	import { SUIT_PATHS, suitName, type SuitName, type SuitChar } from '../../game/ui/suitPaths';

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

	const paths = $derived(SUIT_PATHS[suitName(props.suit)] ?? []);
	const size = $derived(`${props.scale ?? 0.82}em`);
</script>

<svg
	class="suit-icon"
	viewBox="0 0 24 24"
	fill="currentColor"
	style={`width:${size};height:${size}`}
	aria-hidden="true"
>
	{#each paths as d (d)}
		<path {d} />
	{/each}
</svg>

<style>
	.suit-icon {
		display: block;
		flex: 0 0 auto;
	}
</style>
