<script lang="ts">
	/**
	 * The screen before the board - whichever of the two it is.
	 *
	 * This file used to be both of them: 188 lines of script and 289 of markup
	 * covering the interactive intro AND the replay round-details panel, which
	 * share nothing at all. They are now IntroPanels.svelte and
	 * ReplayDetails.svelte, and what is left here is the part they really do
	 * share: the overlay, the table behind it, and the phase that picks one.
	 */
	import { logoAsset } from '../../game/ui/logoAsset.svelte';
	import TableScene from '../board/TableScene.svelte';
	import IntroPanels from './IntroPanels.svelte';
	import ReplayDetails from './ReplayDetails.svelte';

	type Props = {
		phase: 'loading' | 'start' | 'replay-info' | 'playing';
		/** Bet mode string, e.g. "red_higher_inside_heart". */
		mode: string;
		/** Bet amount in display units. */
		betAmount: number;
		/** Replay event ID. */
		eventId: string;
		/** Payout multiplier from the replay RGS response, or null if not yet known. */
		payoutMultiplier: number | null;
		oncontinue: () => void;
		onplay: () => void;
	};

	const props: Props = $props();
</script>

<div class="ss-overlay" style={`--logo-url: url(${logoAsset.url})`}>
	<!-- The same table the game is played on, so the first thing a player sees
	     is the place rather than a green gradient standing in for one. Its props
	     are off: the intro card is wider than the table at every landscape size,
	     so every one of them would be drawn underneath a step panel. See the
	     note on showProps in TableScene.svelte. -->
	<TableScene showProps={false} />

	{#if props.phase === 'start'}
		<IntroPanels oncontinue={props.oncontinue} />
	{:else if props.phase === 'replay-info'}
		<ReplayDetails
			mode={props.mode}
			betAmount={props.betAmount}
			eventId={props.eventId}
			payoutMultiplier={props.payoutMultiplier}
			onplay={props.onplay}
		/>
	{/if}
</div>

<style>
	/* Only the shell's own rules are left; each screen's travel with it. */
	@import '../../styles/intro/start-screen-shell.css';
</style>
