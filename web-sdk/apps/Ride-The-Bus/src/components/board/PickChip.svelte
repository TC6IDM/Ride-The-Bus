<!-- The chip a pick sets down on a guess square (the owner's pick E3,
     2026-10-17). Its own component since 2026-10-18, because the intro's
     squares set one down too and then fly down to become the board's
     (introHandoff.ts): one drawing, so the chip that lands is the chip that
     left.

     WHERE: `spot` (game/ui/chipSpot.ts) - fractions of the segment it lies in,
     x from the inline start; k its width as a share of the square (the parent's
     --choice-size); spin turns its edge pattern so no two land alike.

     WHICH CHIP: the bet's own (game/bet/betChips.ts chipForBet) - the bet
     menu's chip for the level the bet stands on, rounded down, with the
     menu's alternate inlay where it has one. Plain, no value: it marks the
     pick, and the round is one bet, the bar's. -->
<script lang="ts">
	import type { ChipSpot } from '../../game/ui/chipSpot';
	import type { ChipColour } from '../../game/bet/betChips';

	let { spot, chip }: { spot: ChipSpot; chip: { colour: ChipColour; alt: boolean } } = $props();
</script>

<span
	class="pick-chip chip-{chip.colour}"
	class:alt={chip.alt}
	aria-hidden="true"
	style={`--cx: ${spot.x}; --cy: ${spot.y}; --chip-k: ${spot.k}; --spin: ${spot.spin}deg`}
></span>

<style>
	/* The table's chip tokens (tokens.css --chip-*), drawn top-down: the face, a
	   cream ring, the face again, and the edge spots round the rim. */
	.pick-chip {
		--pc-face: var(--chip-red-face);
		--pc-cream: var(--chip-red-cream);
		--pc-dark: var(--chip-red-dark);
		position: absolute;
		z-index: 3;
		inset-inline-start: calc(var(--cx) * 100%);
		top: calc(var(--cy) * 100%);
		width: calc(var(--choice-size) * var(--chip-k));
		aspect-ratio: 1;
		translate: -50% -50%;
		border-radius: 50%;
		pointer-events: none;
		background:
			radial-gradient(circle, var(--pc-face) 0 37%, var(--pc-cream) 38% 42%, var(--pc-face) 43% 59%, transparent 60%),
			repeating-conic-gradient(from var(--spin), var(--pc-cream) 0 13deg, var(--pc-face) 13deg 45deg);
		box-shadow:
			0 calc(var(--choice-size) * 0.02) 0 var(--pc-dark),
			0 calc(var(--choice-size) * 0.035) calc(var(--choice-size) * 0.05) rgba(var(--shadow-rgb), 0.55);
		/* Set down: dropped from a little above, settling once. */
		animation: chip-down 300ms var(--ease-out) both;
	}

	/* The bet menu's five (popup-bet.css), by the same names. */
	.pick-chip.chip-white {
		--pc-face: var(--chip-white-face);
		--pc-cream: var(--chip-white-cream);
		--pc-dark: var(--chip-white-dark);
	}

	.pick-chip.chip-blue {
		--pc-face: var(--chip-blue-face);
		--pc-cream: var(--chip-blue-cream);
		--pc-dark: var(--chip-blue-dark);
	}

	.pick-chip.chip-green {
		--pc-face: var(--chip-green-face);
		--pc-cream: var(--chip-green-cream);
		--pc-dark: var(--chip-green-dark);
	}

	.pick-chip.chip-black {
		--pc-face: var(--chip-black-face);
		--pc-cream: var(--chip-black-cream);
		--pc-dark: var(--chip-black-dark);
	}

	/* The menu's alternate edge inlay - $5 is the white chip with the red
	   inserts. After the colours, which set --pc-cream at the same specificity. */
	.pick-chip.alt {
		--pc-cream: var(--chip-inlay-alt);
	}

	.pick-chip.chip-white.alt {
		--pc-cream: var(--chip-white-inlay-alt);
	}

	/* translate is physical; from the inline start in Arabic it runs the other way. */
	:global([dir='rtl']) .pick-chip {
		translate: 50% -50%;
	}

	@keyframes chip-down {
		0% {
			opacity: 0;
			transform: translateY(-45%) scale(1.3);
		}
		55% {
			opacity: 1;
		}
		80% {
			transform: scale(0.97);
		}
		100% {
			transform: none;
		}
	}

	@keyframes chip-fade {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pick-chip {
			animation: chip-fade 120ms var(--ease-out) both;
		}
	}
</style>
