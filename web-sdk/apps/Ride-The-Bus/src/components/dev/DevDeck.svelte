<script lang="ts">
	/**
	 * DEV ONLY: ?dev_deck=1 lays out every face the game can deal, at the sizes
	 * a card is actually drawn - the board on Desktop (102px), on Mobile S
	 * (65px), the takeover's fan on Desktop (81px) and Popout S's board (32px,
	 * where the compact face takes over). It is how the card art is judged and
	 * what `npm run shots` photographs, because a round deals four cards and a
	 * face that looks wrong in one suit can take a hundred rounds to come up.
	 *
	 * Game.svelte imports this behind an `import.meta.env.DEV` literal, the same
	 * way it reaches devOverrides, so a production build never contains it.
	 */
	import CardFace from '../cards/CardFace.svelte';
	import { ranks } from '../../game/round/roundContract';
	import { courtArt } from '../../game/ui/courtArt.svelte';

	const SUITS = ['♠', '♥', '♦', '♣'] as const;
	const SIZES = [
		{ label: 'Board, Desktop', w: 102, ratio: 13.8 / 9.27 },
		{ label: 'Fan, Desktop', w: 81, ratio: 10.4 / 7.4 },
		{ label: 'Board, Mobile S', w: 65, ratio: 13.8 / 9.27 },
		{ label: 'Board, Popout S (compact)', w: 32, ratio: 13.8 / 9.27 },
	];
</script>

<div class="dev-deck" data-courts-ready={courtArt.ready}>
	<p class="dev-deck-note">?dev_deck=1 - every face at the sizes the game draws it. Courts {courtArt.ready ? 'loaded' : 'NOT loaded (fallback)'}.</p>
	{#each SIZES as size (size.label)}
		<h2>{size.label} - {size.w}px</h2>
		{#each SUITS as suit (suit)}
			<div class="dev-deck-row">
				{#each ranks as rank (rank)}
					<div class="dev-deck-card" style="width:{size.w}px;height:{Math.round(size.w * size.ratio)}px">
						<CardFace {rank} {suit} />
					</div>
				{/each}
			</div>
		{/each}
	{/each}
</div>

<style>
	.dev-deck {
		position: fixed;
		inset: 0;
		z-index: 100000;
		overflow: auto;
		padding: 16px;
		background: var(--felt-lit);
		color: var(--ink-strong);
		font: 13px/1.4 var(--font-body);
	}

	h2 {
		margin: 18px 0 8px;
		font-size: 14px;
	}

	.dev-deck-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 8px;
	}

	/* The board's front, restated: paper, the cut edge, the table's shadow. */
	.dev-deck-card {
		position: relative;
		flex: 0 0 auto;
		border-radius: 9%/6%;
		overflow: hidden;
		background: var(--card-paper);
		box-shadow:
			inset 0 0 0 1px var(--card-edge),
			0 4px 8px rgba(var(--shadow-rgb), 0.38);
	}
</style>
