<script lang="ts">
	import { type Snippet } from 'svelte';
	import { GlobalStyle } from 'components-ui-html';
	import { Authenticate, LoadI18n } from 'components-shared';
	import Game from '../components/Game.svelte';
	import GameLoader from '../components/intro/GameLoader.svelte';
	import { setContext } from '../game/platform/context';

	import { stateUrlDerived } from 'state-shared';

	import messagesMap from '../i18n/messagesMap';
	import { applyDirection } from '../i18n/direction';
	import { isSocialMode } from '../i18n/i18nDerived';

	type Props = { children: Snippet };

	const props: Props = $props();

	setContext();

	// Arabic is the one right-to-left language the RGS can request. Set on
	// <html> so it also reaches the popups and the error dialog, which are
	// position:fixed and so live outside any game container.
	// Social mode (Stake.US) restricts the game to English only.
	$effect(() => {
		const lang = isSocialMode() ? 'en' : stateUrlDerived.lang();
		applyDirection(lang);
	});
</script>

<GlobalStyle>
	<Authenticate>
		<LoadI18n {messagesMap}>
			<Game />
		</LoadI18n>
	</Authenticate>
</GlobalStyle>

<!-- Our loader, drawn entirely in CSS. It waits for the logo to decode and the
     game tree to mount, with a 1400ms floor and 8000ms ceiling, so the board
     can never pop in behind the player. -->
<GameLoader />

{@render props.children()}