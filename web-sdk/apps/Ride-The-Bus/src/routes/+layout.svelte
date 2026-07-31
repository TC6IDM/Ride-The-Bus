<script lang="ts">
	import { type Snippet } from 'svelte';
	import { base } from '$app/paths';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoaderStakeEngine, LoadI18n } from 'components-shared';
	import Game from '../components/Game.svelte';
	import GameLoader from '../components/GameLoader.svelte';
	import { setContext } from '../game/context';

	import { stateUrlDerived } from 'state-shared';

	import messagesMap from '../i18n/messagesMap';
	import { applyDirection } from '../i18n/direction';

	type Props = { children: Snippet };

	const props: Props = $props();

	let showYourLoader = $state(false);

	const loaderUrlStakeEngine = `${base}/stake-engine-loader.gif`;

	setContext();

	// Arabic is the one right-to-left language the RGS can request. Set on
	// <html> so it also reaches the popups and the error dialog, which are
	// position:fixed and so live outside any game container.
	$effect(() => {
		applyDirection(stateUrlDerived.lang());
	});
</script>

<GlobalStyle>
	<Authenticate>
		<LoadI18n {messagesMap}>
			<Game />
		</LoadI18n>
	</Authenticate>
</GlobalStyle>

<!-- Stake's own branded loader runs first, left exactly as shipped. -->
<LoaderStakeEngine src={loaderUrlStakeEngine} oncomplete={() => (showYourLoader = true)} />

<!-- Then ours. This replaces the SDK's LoaderExample, which rendered the words
     "Add Your Loader" over a placeholder GIF - template text that would have
     shipped. GameLoader is drawn in CSS (nothing to download) and, unlike a
     fixed-timer GIF, waits for the backdrop bitmap to decode so the table
     can't pop in behind the player a beat after the loader clears. -->
{#if showYourLoader}
	<GameLoader />
{/if}

{@render props.children()}