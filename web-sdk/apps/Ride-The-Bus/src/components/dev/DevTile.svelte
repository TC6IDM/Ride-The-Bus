<script lang="ts">
	/**
	 * DEV ONLY: ?dev_tile=fg composes the lobby tile's foreground out of the
	 * game's own cards, for scripts/tile-art.mjs to photograph on a transparent
	 * ground. The background is the live table, photographed with the board's
	 * furniture hidden - nothing here draws it.
	 *
	 * WHY THE TILE IS RENDERED, NOT PAINTED. The tile it replaces was generated
	 * art: a Jack with a garbled lower half, a droplet for the Ace's spade, a
	 * spray of orange sparks and cut-out debris at its edges, over a backyard
	 * party that is in no screen of the game. Stake names "generic AI-generated
	 * assets" as a cause of a low rating, and the tile is the first thing a
	 * player sees. These are the faces the board deals - CardFace, the CC0
	 * English-pattern courts with the house crown, the Ace of Spades as the
	 * house card - so the tile cannot drift from the game or look generated.
	 *
	 * The hand runs J Q K A, one of each suit, so both colour families and all
	 * three court figures are in it - and in that order because a fan shows
	 * only its top card whole, and the top card should be the house Ace, with
	 * its crown and the house name. Lit like everything else: one light from
	 * the upper right, shadows down and to the left (design.md).
	 *
	 * Game.svelte imports this behind an `import.meta.env.DEV` literal, like
	 * DevDeck, so a production build never contains it.
	 */
	import CardFace from '../cards/CardFace.svelte';
	import { courtArt } from '../../game/ui/courtArt.svelte';

	/** The hand, left to right: its card, its turn in the fan, its lift off the arc. */
	const HAND = [
		{ rank: 'J', suit: '♦', turn: -27, lift: 0 },
		{ rank: 'Q', suit: '♣', turn: -9, lift: -10 },
		{ rank: 'K', suit: '♥', turn: 9, lift: -10 },
		{ rank: 'A', suit: '♠', turn: 27, lift: 0 },
	] as const;

	/** Two chips from the bet rack's palette, dropped in front of the hand. */
	const CHIPS = [
		{ colour: 'black', x: 612, y: 592, turn: 18 },
		{ colour: 'red', x: 668, y: 540, turn: -9 },
	] as const;
</script>

<div class="dev-tile" data-courts-ready={courtArt.ready}>
	<div class="tile-stage">
		<div class="tile-hand">
			{#each HAND as card, i (card.rank)}
				<div class="tile-card" style="--turn: {card.turn}deg; --lift: {card.lift}px; --i: {i}">
					<CardFace rank={card.rank} suit={card.suit} />
				</div>
			{/each}
		</div>
		<!-- The deck the hand came out of, squared, face down, in front of it. -->
		<div class="tile-deck">
			<div class="tile-back tile-deck-card" style="--n: 2"></div>
			<div class="tile-back tile-deck-card" style="--n: 1"></div>
			<div class="tile-back tile-deck-card" style="--n: 0"><span class="tile-brand"></span></div>
		</div>
		{#each CHIPS as chip (chip.colour)}
			<div class="tile-chip chip-{chip.colour}" style="--x: {chip.x}px; --y: {chip.y}px; --turn: {chip.turn}deg"></div>
		{/each}
	</div>
</div>

<style>
	/* Transparent on purpose: the script clears the page behind it and keeps
	   the alpha, because Stake composites the foreground over the background. */
	.dev-tile {
		position: fixed;
		inset: 0;
		z-index: 100000;
		display: grid;
		place-items: center;
		background: transparent;
	}

	.tile-stage {
		position: relative;
		width: 800px;
		height: 800px;
	}

	/* Card geometry: the board's card, 9.27 x 13.8, at tile scale. */
	.tile-card,
	.tile-back {
		position: absolute;
		width: 214px;
		height: 319px;
		border-radius: 19px;
		box-sizing: border-box;
	}

	/* Fanned about a point well below the hand, the way a hand is held. */
	.tile-hand {
		position: absolute;
		left: 400px;
		top: 296px;
		width: 0;
		height: 0;
	}

	.tile-card {
		left: -107px;
		top: -160px;
		overflow: hidden;
		transform-origin: 50% 185%;
		transform: translateY(var(--lift)) rotate(var(--turn));
		/* Paper lit from the upper right, the board's front. */
		background:
			linear-gradient(200deg, transparent 35%, rgba(var(--shadow-rgb), 0.1) 100%),
			var(--card-paper);
		box-shadow: inset 0 0 0 2px var(--card-edge);
		/* The table's two-part drop, down and left. */
		filter:
			drop-shadow(-3px 5px 4px rgba(var(--shadow-rgb), 0.45))
			drop-shadow(-14px 22px 26px rgba(var(--shadow-rgb), 0.38));
	}

	/* The deck's crimson crosshatch, as the board's backs, the fan and the
	   table's deck prop draw it. */
	.tile-back {
		overflow: hidden;
		background:
			repeating-linear-gradient(45deg, rgba(var(--ink-rgb), 0.12) 0 3px, transparent 3px 9px),
			repeating-linear-gradient(-45deg, rgba(var(--ink-rgb), 0.12) 0 3px, transparent 3px 9px),
			linear-gradient(160deg, var(--brand-red-lit) 0%, var(--brand-red) 55%, var(--brand-red-deep) 100%);
		box-shadow:
			inset 0 0 0 5px var(--brand-paper),
			inset 0 0 0 7px var(--brand-chrome);
	}

	.tile-deck {
		position: absolute;
		left: 92px;
		top: 376px;
		transform: rotate(-16deg);
		filter:
			drop-shadow(-3px 5px 4px rgba(var(--shadow-rgb), 0.5))
			drop-shadow(-16px 24px 28px rgba(var(--shadow-rgb), 0.4));
	}

	/* A squared deck: each card a hair lower and left, so the stack has an edge. */
	.tile-deck-card {
		left: calc(var(--n) * -2.5px);
		top: calc(var(--n) * 3.5px);
	}

	/* The house name on a plain label, as every back in the game prints it. */
	.tile-brand::before {
		content: var(--brand-wordmark);
		position: absolute;
		top: 50%;
		left: 50%;
		white-space: pre;
		text-align: center;
		font-family: var(--font-body);
		font-weight: 400;
		font-size: 18px;
		line-height: 1.35;
		letter-spacing: 0.24em;
		padding: 0.45em 0.75em 0.45em calc(0.75em + 0.24em);
		background: var(--brand-wordmark-ground);
		border: 1px solid var(--brand-wordmark-edge);
		border-radius: 0.3em;
		color: var(--brand-wordmark-ink);
		transform: translate(-50%, -50%);
	}

	/* A chip seen from above, as the bet rack draws it: body, spot ring, face. */
	.tile-chip {
		position: absolute;
		left: var(--x);
		top: var(--y);
		width: 120px;
		height: 120px;
		border-radius: 50%;
		transform: translate(-50%, -50%) rotate(var(--turn));
		background:
			radial-gradient(closest-side, var(--chip-face) 0 64%, var(--chip-dark) 64.5% 66%, transparent 66.5%),
			repeating-conic-gradient(var(--chip-cream) 0deg 13deg, transparent 13deg 45deg),
			var(--chip);
		box-shadow:
			inset 0 0 0 2px var(--chip-dark),
			-3px 5px 4px rgba(var(--shadow-rgb), 0.45),
			-12px 18px 22px rgba(var(--shadow-rgb), 0.38);
	}

	.chip-red {
		--chip: var(--chip-red);
		--chip-face: var(--chip-red-face);
		--chip-dark: var(--chip-red-dark);
		--chip-cream: var(--chip-red-cream);
	}

	.chip-black {
		--chip: var(--chip-black);
		--chip-face: var(--chip-black-face);
		--chip-dark: var(--chip-black-dark);
		--chip-cream: var(--chip-black-cream);
	}
</style>
