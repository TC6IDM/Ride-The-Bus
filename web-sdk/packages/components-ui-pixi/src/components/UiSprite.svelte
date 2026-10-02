<script lang="ts" module>
	import { Rectangle, type RectangleProps } from 'pixi-svelte';

	/**
	 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
	 * upstream.
	 *
	 * `key` accounted for FIVE of the vendored svelte-check errors, in
	 * ButtonBet, ButtonBuyBonus, ButtonDrawer and UiLabel (twice) - all of them
	 * "'key' does not exist in type 'Props'".
	 *
	 * They are right and this file was wrong. This component is the SDK's
	 * PLACEHOLDER - see "ADD YOUR DESIGN" below, where the real implementation
	 * sits commented out - and that commented version declares
	 * `SpriteProps & { key: keyof typeof sharedAssetsPixi }`. The stub that
	 * replaced it draws a Rectangle and dropped `key` from the type, while its
	 * own five call sites inside this same package went on passing it.
	 *
	 * So the type is widened to match what the package already does, rather than
	 * editing five call sites to stop doing it - they are correct against the
	 * real component and would only have to be put back. Optional and a plain
	 * string, because the stub has no asset map to key into; the commented
	 * version narrows it to the real asset keys and should win when a design
	 * lands here.
	 *
	 * Ride The Bus never renders this - the board is HTML and CSS, and the game
	 * imports only types and message maps from components-ui-pixi - so this is a
	 * type-level repair to a vendored package, with no runtime surface in this
	 * game at all. The body is untouched.
	 */
	export type Props = RectangleProps & { key?: string };
</script>

<script lang="ts">
	const props: Props = $props();
</script>

<Rectangle borderRadius={50} {...props} />

<!-- ADD YOUR DESIGN -->

<!-- <script lang="ts" module>
	import { Sprite, type SpriteProps } from 'pixi-svelte';
	import type { sharedAssetsPixi } from 'constants-shared/assets';

	export type Props = SpriteProps & {
		key: keyof typeof sharedAssetsPixi;
	};
</script>

<script lang="ts">
	const props: Props = $props();
</script>

<Sprite {...props} /> -->
