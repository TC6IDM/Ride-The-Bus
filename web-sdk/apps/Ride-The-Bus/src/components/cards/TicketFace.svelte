<script lang="ts">
	/**
	 * Last Stop's ticket, drawn once - the board's slot, the takeover's fan
	 * and How to Play's stack all print this, the way every dealt card prints
	 * CardFace.
	 *
	 * A bus ticket, not a card: a portrait stub of the card's own paper with a
	 * perforated notch either side, a band across the top in the family's
	 * colour naming the stop, and a hole punched where a conductor would. Face
	 * up it prints its value - "×5", the sign in front, because a ticket is an
	 * instruction to multiply the running total and not a payout (ticketString
	 * in game/ui/multiplier.ts). Face down it prints the whole range of the
	 * stack, "×2 – ×10", so the prize the lower-priced cards are paying for is
	 * on the table before anyone picks.
	 *
	 * The container owns the flip and the shadow (cards.css, win-celebration.css,
	 * popup-how-to-play.css): this draws only the paper and what is printed on
	 * it, in the ticket's own 120 x 200 units, scaling with whatever box it is
	 * put in.
	 *
	 * RIGHT TO LEFT. Nothing mirrors - a ticket has no reading corner. The name
	 * in the band runs in the page's direction; the figures are pinned left to
	 * right, or Arabic reorders "×2 – ×10" around its dash.
	 */
	import { t } from '../../i18n/i18nDerived';
	import { formatTicket } from '../../game/ui/formatMultiplier';
	import { FAMILY_RULES } from '../../game/math/modes';
	import { ticketValues } from '../../game/math/payout';

	type Props = {
		/** Face up with this value, or null for the back. */
		value: number | null;
	};

	const props: Props = $props();
	/** One mask per ticket: the board, the fan and How to Play can all draw one
	 *  at once, and a shared id would cut every ticket's hole from the first. */
	const uid = $props.id();
	const maskId = `ticket-cut-${uid}`;

	const W = 120;
	const H = 200;
	/** Where the band ends and the perforation line sits. */
	const BAND = 44;
	const NOTCH_Y = 128;
	const values = ticketValues(FAMILY_RULES.ls) ?? [2, 10];
	const range = `${formatTicket(Math.min(...values))} – ${formatTicket(Math.max(...values))}`;
</script>

<span class="ticket-art" class:is-face={props.value !== null}>
	<svg viewBox="0 0 {W} {H}" aria-hidden="true" focusable="false">
		<defs>
			<!-- The notch on either edge and the punched hole are cut OUT of the
			     paper, so the table shows through them - a mask, not a dark dot
			     painted on, which would read as a stain on any other ground. -->
			<mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
				<rect x="0" y="0" width={W} height={H} fill="white" />
				<circle cx="0" cy={NOTCH_Y} r="9" fill="black" />
				<circle cx={W} cy={NOTCH_Y} r="9" fill="black" />
				{#if props.value !== null}
					<circle cx={W * 0.78} cy={NOTCH_Y + 38} r="6.5" fill="black" />
				{/if}
			</mask>
		</defs>
		<g mask="url(#{maskId})">
			<rect class="tk-paper" x="0" y="0" width={W} height={H} rx="9" />
			<rect class="tk-band" x="0" y="0" width={W} height={BAND} />
			<rect class="tk-band-edge" x="0" y={BAND - 2.5} width={W} height="2.5" />
			<line class="tk-perf" x1="12" y1={NOTCH_Y} x2={W - 12} y2={NOTCH_Y} />
		</g>
		<text class="tk-stop" x={W / 2} y={BAND / 2 + 5.5} text-anchor="middle" textLength={W - 22} lengthAdjust="spacingAndGlyphs">
			{t('Last Stop')}
		</text>
		{#if props.value !== null}
			<text class="tk-value" x={W / 2} y={BAND + 58} text-anchor="middle">{formatTicket(props.value)}</text>
		{:else}
			<text class="tk-range" x={W / 2} y={BAND + 48} text-anchor="middle" textLength={W - 30} lengthAdjust="spacingAndGlyphs">
				{range}
			</text>
		{/if}
		<!-- The route printed on the stub: four stops and the terminus, the same
		     line the board draws under its cards. -->
		<g class="tk-route">
			<line x1="20" y1={H - 30} x2={W - 20} y2={H - 30} />
			{#each [0, 1, 2, 3] as stop (stop)}
				<circle cx={20 + stop * ((W - 40) / 4)} cy={H - 30} r="3" />
			{/each}
			<circle class="tk-terminus" cx={W - 20} cy={H - 30} r="5" />
		</g>
	</svg>
</span>

<style>
	.ticket-art {
		display: block;
		width: 100%;
		height: 100%;
	}

	svg {
		display: block;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.tk-paper {
		fill: var(--card-paper);
	}

	/* The family's colour, the same --vol-ls the picker and the bar wear, so
	   the ticket reads as Last Stop's before its words are read. */
	.tk-band {
		fill: var(--vol-ls);
	}

	.tk-band-edge {
		fill: rgba(var(--shadow-rgb), 0.18);
	}

	.tk-perf {
		stroke: rgba(var(--card-ink-rgb), 0.35);
		stroke-width: 1.6;
		stroke-dasharray: 3.2 3.2;
	}

	.tk-stop {
		fill: var(--on-vol-ink);
		font-family: var(--font-body);
		font-weight: 800;
		font-size: 15px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	/* The figures read left to right in every language: in Arabic the page's
	   direction reordered the range around its dash into "10× – 2×". The name
	   in the band keeps the page's direction, so it still reads right to left. */
	.tk-value,
	.tk-range {
		direction: ltr;
		unicode-bidi: isolate;
	}

	.tk-value {
		fill: var(--card-ink);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 52px;
		font-variant-numeric: tabular-nums;
	}

	.tk-range {
		fill: var(--card-ink);
		font-family: var(--font-body);
		font-weight: 700;
		font-size: 20px;
		opacity: 0.72;
	}

	.tk-route line {
		stroke: rgba(var(--card-ink-rgb), 0.45);
		stroke-width: 2;
	}

	.tk-route circle {
		fill: var(--card-paper);
		stroke: rgba(var(--card-ink-rgb), 0.55);
		stroke-width: 1.6;
	}

	.tk-route .tk-terminus {
		fill: var(--vol-ls);
		stroke: none;
	}
</style>
