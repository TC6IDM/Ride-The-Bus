<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import { getContextEventEmitter } from 'utils-event-emitter';

	import type { EmitterEventHotKey } from '../types';

	const context = getContextEventEmitter<EmitterEventHotKey>();
	const PREVENT_DEFAULT_KEYS = ['Space', 'ArrowUp', 'ArrowDown'];
	const EXCLUDED_TAGS = ['input', 'textarea', 'select'];

	/**
	 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
	 * upstream. A cast; the logic is unchanged.
	 *
	 * `KeyboardEvent.target` is `EventTarget | null`, which has no `tagName` -
	 * only Element does. The optional chaining meant this never threw, so the
	 * bug was purely that the type lied; svelte-check reported it.
	 *
	 * Element rather than HTMLElement because the cast should claim no more than
	 * it needs: `tagName` is on Element, and a keydown can land on an SVG node,
	 * which is an Element but not an HTMLElement. The `?.` chain stays, so a
	 * target that is neither still falls through to `undefined` and the
	 * includes() check correctly says "not excluded".
	 */
	const getValidElement = (e: KeyboardEvent) =>
		!EXCLUDED_TAGS.includes((e?.target as Element | null)?.tagName?.toLowerCase());

	function handleKeydown(e: KeyboardEvent) {
		if (getValidElement(e)) {
			const isSpace = e.key === ' ';
			const key = isSpace ? 'Space' : e.key;
			if (PREVENT_DEFAULT_KEYS.includes(key)) e.preventDefault();
			if (key) context.eventEmitter.broadcast({ type: 'hotKey', key, action: 'keyDown' });
		}
	}

	function handleKeyup(e: KeyboardEvent) {
		if (getValidElement(e)) {
			const isSpace = e.key === ' ';
			const key = isSpace ? 'Space' : e.key;
			if (PREVENT_DEFAULT_KEYS.includes(key)) e.preventDefault();
			if (key) context.eventEmitter.broadcast({ type: 'hotKey', key, action: 'keyUp' });
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('keyup', handleKeyup);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
		window.removeEventListener('keyup', handleKeyup);
	});
</script>
