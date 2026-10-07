<script lang="ts">
	/**
	 * A card's face, the way a casino deck prints it - drawn once, used by every
	 * dealt card: the board's four and the takeover's fan.
	 *
	 *   2-10   the value in pips, on the standard grid, lower half upside down
	 *   A      one large pip; the Ace of Spades is the house card, engraved, with
	 *          the house name under it as a deck prints its maker's mark there
	 *   J Q K  the English-pattern courts (CC0, art-masters/courts/), in the
	 *          pattern's own cut-corner frame, restyled into the card tokens
	 *
	 * All geometry is game/ui/cardFaceLayout.ts, in the face's own 200 x 298
	 * units; the SVG scales with whatever card it is put in. The paper, the edge
	 * and the shadow stay the CONTAINER's (cards.css, win-celebration.css): this
	 * draws only what is printed on the paper.
	 *
	 * COLOUR. A red suit draws red, maroon and rose; a black suit ink, slate and
	 * stone; both add gold and paper. Never both families on one card - card 1's
	 * guess is Red or Black and has ~650ms to be read. The court figures are
	 * painted in six roles (--cf-p/g/l/t/d/b); this component maps them to
	 * tokens.css per suit colour, and they inherit through the <use> into the
	 * sprite. A court drawn before the sprite has loaded (courtArt.svelte.ts)
	 * gets its frame, pips and index around a large rank letter instead.
	 *
	 * SMALL. Under COMPACT_BELOW_PX on screen a number card drops to one large
	 * pip and a larger index: ten pips on Popout S's 32px card are ~5px specks.
	 * Measured with bind:clientWidth (a ResizeObserver), not a container query,
	 * which needs iOS 16 - older devices are on Stake's final checklist. Courts
	 * and aces are one large mark already and do not change.
	 *
	 * RIGHT TO LEFT. The whole face mirrors, so the index sits at the reading
	 * corner - the corner the takeover's fan leaves uncovered when it is held the
	 * other way round (rtl.test.ts) - and the rank's glyphs are turned back so
	 * they never read backwards.
	 */
	import { SUIT_PATHS, suitName, isRedSuit } from '../../game/ui/suitPaths';
	import {
		FACE_W,
		FACE_H,
		FACE_CENTRE,
		INDEX,
		COMPACT_BELOW_PX,
		COMPACT_INDEX_SCALE,
		PIP_SIZE,
		ACE,
		COURT_FRAME,
		COURT_PANEL,
		COURT_PIP,
		COURT_CROWN,
		faceKind,
		pipLayout,
		courtSymbol,
	} from '../../game/ui/cardFaceLayout';
	import { courtArt } from '../../game/ui/courtArt.svelte';

	type Props = {
		/** As the book deals it: 'A', '2'..'10', 'J', 'Q', 'K'. */
		rank: string;
		/** The suit character the book deals, or its name. */
		suit: string;
	};

	const props: Props = $props();

	/** 0 until measured; a face is drawn full rather than flashing compact. */
	let width = $state(0);

	const kind = $derived(faceKind(props.rank));
	const red = $derived(isRedSuit(props.suit));
	const shape = $derived(SUIT_PATHS[suitName(props.suit)] ?? []);
	const compact = $derived(kind === 'pips' && width > 0 && width < COMPACT_BELOW_PX);
	const pips = $derived(kind === 'pips' && !compact ? pipLayout(props.rank) : []);
	const isHouseAce = $derived(kind === 'ace' && suitName(props.suit) === 'spade');
	const turned = `rotate(180 ${FACE_CENTRE.x} ${FACE_CENTRE.y})`;
	// Tracking pads the END of a line, so a centred, tracked word sits half a
	// track left of centre; this puts it back (the backs do the same in cards.css).
	const houseX = FACE_CENTRE.x + ACE.nameSize * 0.12;
</script>

<span class="card-face-art" class:is-red={red} bind:clientWidth={width}>
	<svg viewBox="0 0 {FACE_W} {FACE_H}" aria-hidden="true" focusable="false">
		<!-- Declared inside the <svg> so they are built in its namespace. -->
		{#snippet pip(x: number, y: number, size: number, inverted: boolean, cls = 'cf-pip')}
			<g class={cls} transform="translate({x} {y}){inverted ? ' rotate(180)' : ''} scale({size / 24}) translate(-12 -12)">
				{#each shape as d (d)}<path {d} />{/each}
			</g>
		{/snippet}

		<!-- The Takeover crown: the logo's crown, drawn flat in gold on a 24 grid
		     - five points, a band, a pearl on three tips. Over the house spade it
		     makes the logo's own mark; over each court's pip it is the house's
		     signature on the pattern. Gold only, never a suit colour. -->
		{#snippet crown(x: number, y: number, size: number, inverted: boolean)}
			<g class="cf-crown" transform="translate({x} {y}){inverted ? ' rotate(180)' : ''} scale({size / 24}) translate(-12 -12)">
				<path d="M2.5 16.5 4 7l4.2 4.6L12 4.5l3.8 7.1L20 7l1.5 9.5Z" />
				<rect x="2.5" y="17.6" width="19" height="2.6" rx="0.6" />
				<circle cx="4" cy="6.2" r="1.3" />
				<circle cx="12" cy="3.6" r="1.3" />
				<circle cx="20" cy="6.2" r="1.3" />
			</g>
		{/snippet}

		{#snippet index(bottom: boolean)}
			<g transform={bottom ? turned : undefined}>
				<g transform={compact ? `scale(${COMPACT_INDEX_SCALE})` : undefined}>
					<text class="cf-rank" x={INDEX.x} y={INDEX.baseline} font-size={INDEX.fontSize} text-anchor="middle">{props.rank}</text>
					{@render pip(INDEX.x, INDEX.pipY, INDEX.pipSize, false)}
				</g>
			</g>
		{/snippet}

		<g class="cf-face">
			{#if kind === 'pips'}
				{#if compact}
					{@render pip(FACE_CENTRE.x, FACE_CENTRE.y, ACE.pipSize, false)}
				{:else}
					{#each pips as p (`${p.x} ${p.y}`)}
						{@render pip(p.x, p.y, PIP_SIZE, p.inverted)}
					{/each}
				{/if}
			{:else if kind === 'ace'}
				{#if isHouseAce}
					{@render pip(FACE_CENTRE.x, ACE.spadeY, ACE.spadeSize, false)}
					<!-- The engraving: the same spade, smaller, in a gold line. -->
					{@render pip(FACE_CENTRE.x, ACE.spadeY + 3, ACE.spadeSize * 0.78, false, 'cf-engrave')}
					{@render crown(FACE_CENTRE.x, ACE.crownY, ACE.crownSize, false)}
					<!-- The house name, as the backs print it (tokens.css, --brand-wordmark).
					     A proper name, so not translated; written out because a CSS
					     content string cannot be read into SVG text. -->
					<text class="cf-house" x={houseX} y={ACE.nameY[0]} font-size={ACE.nameSize} text-anchor="middle">TAKEOVER</text>
					<text class="cf-house" x={houseX} y={ACE.nameY[1]} font-size={ACE.nameSize} text-anchor="middle">CASINO</text>
				{:else}
					<circle class="cf-ring" cx={FACE_CENTRE.x} cy={FACE_CENTRE.y} r="66" />
					{@render pip(FACE_CENTRE.x, FACE_CENTRE.y, ACE.pipSize, false)}
					{@render pip(FACE_CENTRE.x, FACE_CENTRE.y + 2, ACE.pipSize * 0.8, false, 'cf-engrave')}
				{/if}
			{:else}
				{#if courtArt.ready}
					<use href="#{courtSymbol(props.rank, props.suit)}" x={COURT_PANEL.x} y={COURT_PANEL.y} width={COURT_PANEL.w} height={COURT_PANEL.h} />
				{:else}
					<text class="cf-court-letter" x={FACE_CENTRE.x} y={FACE_CENTRE.y + 40} font-size="112" text-anchor="middle">{props.rank}</text>
				{/if}
				{#each COURT_FRAME as d (d)}<path class="cf-frame" {d} />{/each}
				{@render pip(COURT_PIP.x, COURT_PIP.y, COURT_PIP.size, false)}
				{@render crown(COURT_CROWN.x, COURT_CROWN.y, COURT_CROWN.size, false)}
				{@render pip(FACE_W - COURT_PIP.x, FACE_H - COURT_PIP.y, COURT_PIP.size, true)}
				{@render crown(FACE_W - COURT_CROWN.x, FACE_H - COURT_CROWN.y, COURT_CROWN.size, true)}
			{/if}

			{@render index(false)}
			{@render index(true)}
		</g>
	</svg>
</span>

<style>
	/* The six roles the court sprite is painted in, plus the suit's own ink for
	   pips and index. Black suits by default, red suits below. tokens.css has
	   why a card never mixes the two families. */
	.card-face-art {
		display: block;
		width: 100%;
		height: 100%;
		--cf-p: var(--card-paper);
		--cf-g: var(--court-gold);
		--cf-t: var(--court-ink-tone);
		--cf-d: var(--card-ink);
		--cf-l: var(--card-ink);
		--cf-b: var(--court-ink-tint);
		--cf-suit: var(--card-ink);
	}

	.card-face-art.is-red {
		--cf-t: var(--card-red);
		--cf-d: var(--court-red-deep);
		--cf-l: var(--court-red-deep);
		--cf-b: var(--court-red-tint);
		--cf-suit: var(--card-red);
	}

	svg {
		display: block;
		width: 100%;
		height: 100%;
		/* A card is not text: the book's "10" and the pips' order are the same
		   in every language. The mirror below is the one RTL change. */
		direction: ltr;
	}

	.cf-face {
		transform-box: view-box;
		transform-origin: 50% 50%;
	}

	/* Mirrored in Arabic so the index is at the reading corner; every piece of
	   TEXT on the face - the rank, the house name on the Ace of Spades - is
	   turned back about its own box, so nothing reads backwards. */
	:global([dir='rtl']) .cf-face {
		transform: scaleX(-1);
	}

	:global([dir='rtl']) .cf-rank,
	:global([dir='rtl']) .cf-house {
		transform: scaleX(-1);
		transform-box: fill-box;
		transform-origin: 50% 50%;
	}

	.cf-pip {
		fill: var(--cf-suit);
	}

	.cf-crown {
		fill: var(--cf-g);
	}

	.cf-rank {
		fill: var(--cf-suit);
		font-family: var(--font-display);
		font-weight: 700;
	}

	/* The engraving on an ace: the same shape in a fine gold line, which is
	   what sets an ace apart from a large 1 at a glance. */
	.cf-engrave {
		fill: none;
		stroke: var(--cf-g);
		stroke-width: 0.45;
		stroke-linejoin: round;
	}

	.cf-ring {
		fill: none;
		stroke: var(--cf-g);
		stroke-width: 1.4;
	}

	.cf-house {
		fill: var(--cf-suit);
		font-family: var(--font-body);
		font-weight: 700;
		letter-spacing: 0.24em;
	}

	.cf-frame {
		fill: none;
		stroke: var(--cf-l);
		stroke-width: 1.1;
	}

	.cf-court-letter {
		fill: var(--cf-t);
		font-family: var(--font-display);
		font-weight: 900;
	}
</style>
