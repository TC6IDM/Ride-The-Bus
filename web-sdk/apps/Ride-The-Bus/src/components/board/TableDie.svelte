<script lang="ts">
	/**
	 * THE TABLE DIE - roll it and it picks all four guesses at random; nothing
	 * is bought until the player deals (the owner's call, 2026-10-01). The picks
	 * and the reason it is a quick pick and not a bet mode are in
	 * game/bet/dicePicks.ts; the drawing is DieFace.
	 *
	 * PART OF THE GUESS ROW, AND LOCKED WITH IT. It lives inside .choice-row, so
	 * the row's lock (no pointer events, dimmed - a round in flight, autoplay,
	 * replay) and the takeover's dimming reach it with no rule of its own, and
	 * choicesLocked() refuses a keyboard press the same way pick() does for the
	 * squares. Three of a Kind has no guesses, and GameBoard renders no die there.
	 *
	 * THE PICKS CHANGE ON THE CLICK, not when the die lands: a deal pressed
	 * mid-tumble buys exactly what the squares already show. The tumble and the
	 * knocks are the die's alone, timed on DIE_ROLL_MS / DIE_LANDINGS.
	 *
	 * ON THE PHYSICAL RIGHT, IN EVERY LANGUAGE. The table's props do not mirror
	 * in Arabic - the deck stays top left, the chips where they are - and a die
	 * mirrored to the row's other end would land on the bottom-left chip stacks.
	 * So `left`, not inset-inline-start. On a portrait phone the row is the
	 * table's full width, so the die goes under the Color square, on the wood
	 * left of the cup (the one place a layout may be rearranged).
	 */
	import DieFace from '../cards/DieFace.svelte';
	import { guesses, setAllGuesses } from '../../game/bet/betState.svelte';
	import { DIE_LANDINGS, DIE_ROLL_MS, rollFace, rollPicks } from '../../game/bet/dicePicks';
	import { choicesLocked } from '../../game/round/roundState.svelte';
	import { reducedMotion } from '../../game/celebration/celebrationGestures';
	import { sound } from '../../game/audio/sound';
	import { t } from '../../i18n/i18nDerived';

	let face = $state(5);
	let bodyEl = $state<HTMLElement | undefined>();
	let shadowEl = $state<HTMLElement | undefined>();
	let timers: ReturnType<typeof setTimeout>[] = [];

	$effect(() => () => timers.forEach(clearTimeout));

	/** Space never reaches the die: it always deals (ControlBar's spaceIsForUs).
	 *  The die rolls on a click, a tap or Enter. */
	function roll() {
		if (choicesLocked()) {
			sound.playBlocked();
			return;
		}
		setAllGuesses(rollPicks(guesses));
		timers.forEach(clearTimeout);
		timers = [];
		const landing = rollFace(face);
		if (reducedMotion() || !bodyEl || !shadowEl) {
			// No tumble: one knock, and the new face.
			sound.playDiceRoll([0]);
			face = landing;
			return;
		}
		sound.playDiceRoll(DIE_LANDINGS.map((at) => (at * DIE_ROLL_MS) / 1000));
		tumble(bodyEl, shadowEl);
		// Faces flicker while it is in the air, and it lands on `landing`.
		for (const at of [0.14, 0.32, 0.5]) timers.push(setTimeout(() => (face = rollFace(face)), at * DIE_ROLL_MS));
		timers.push(setTimeout(() => (face = landing), DIE_LANDINGS[0] * DIE_ROLL_MS));
	}

	/**
	 * Up, turning, down on the first landing (squashed a little), a short hop,
	 * and still - the landings at DIE_LANDINGS, where the knocks are. The shadow
	 * stays on the table and shrinks as the die leaves it.
	 */
	function tumble(body: HTMLElement, shadow: HTMLElement) {
		body.getAnimations().forEach((a) => a.cancel());
		shadow.getAnimations().forEach((a) => a.cancel());
		const [first] = DIE_LANDINGS;
		const rise = 'cubic-bezier(0.2, 0.7, 0.4, 1)';
		const fall = 'cubic-bezier(0.6, 0, 0.9, 0.5)';
		body.animate(
			[
				{ transform: 'translate(0, 0) rotate(0deg)', easing: rise },
				{ transform: 'translate(-8%, -70%) rotate(-170deg)', offset: first * 0.5, easing: fall },
				{ transform: 'translate(-4%, 0) rotate(-300deg) scale(1.06, 0.9)', offset: first, easing: rise },
				{ transform: 'translate(-2%, -16%) rotate(-345deg)', offset: (first + 1) / 2, easing: fall },
				{ transform: 'translate(0, 0) rotate(-360deg)' },
			],
			{ duration: DIE_ROLL_MS },
		);
		shadow.animate(
			[
				{ transform: 'scale(1)', opacity: 1 },
				{ transform: 'scale(0.62)', opacity: 0.5, offset: first * 0.5 },
				{ transform: 'scale(1)', opacity: 1, offset: first },
				{ transform: 'scale(0.88)', opacity: 0.85, offset: (first + 1) / 2 },
				{ transform: 'scale(1)', opacity: 1 },
			],
			{ duration: DIE_ROLL_MS },
		);
	}
</script>

<button
	type="button"
	class="table-die"
	onclick={roll}
	aria-disabled={choicesLocked()}
	aria-label={t('Roll the die for random guesses')}
>
	<span class="die-shadow" bind:this={shadowEl} aria-hidden="true"></span>
	<span class="die-body" bind:this={bodyEl}><DieFace {face} /></span>
</button>

<style>
	.table-die {
		--die: calc(var(--choice-size) * 0.62);
		position: absolute;
		/* Physical, not logical - see the note at the top. */
		left: calc(100% + var(--choice-size) * 0.28);
		bottom: calc(var(--choice-size) * 0.5 - var(--die) * 0.5);
		width: var(--die);
		height: var(--die);
		padding: 0;
		border: 0;
		border-radius: 22%;
		background: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	/* A finger needs 44px whatever the die measures (design.md's touch floor
	   for a control alone); the hit area grows, the drawing does not. Touch
	   only: on Popout S, a mouse-driven mini-player, a grown target would
	   reach over the Suit square. */
	@media (pointer: coarse) {
		.table-die::before {
			content: '';
			position: absolute;
			inset: min(0px, calc((var(--die) - 44px) / 2));
		}
	}

	.die-body {
		position: absolute;
		inset: 0;
		/* Squashes onto its base when it lands. */
		transform-origin: 50% 80%;
	}

	/* The table's two-part shadow - a tight contact patch and a wide soft one -
	   thrown down and to the left, like every prop's. */
	.die-shadow {
		position: absolute;
		left: 2%;
		right: 14%;
		bottom: -2%;
		height: 34%;
		border-radius: 50%;
		background:
			radial-gradient(closest-side, rgba(var(--shadow-rgb), 0.5), rgba(var(--shadow-rgb), 0.28) 55%, transparent),
			radial-gradient(farthest-side, rgba(var(--shadow-rgb), 0.22), transparent);
		transform-origin: 50% 50%;
	}

	.table-die:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.table-die:active .die-body {
		transform: scale(0.94);
	}

	@media (any-hover: hover) {
		.table-die:hover:not([aria-disabled='true']) .die-body {
			filter: brightness(1.14);
		}
	}

	/* Portrait phones: the row is the table's width, so under the Color square,
	   on the wood left of the cup. */
	@media (max-width: 620px) and (orientation: portrait) {
		.table-die {
			left: calc(var(--choice-size) * 0.34);
			top: calc(100% + var(--choice-size) * 0.14);
			bottom: auto;
		}
	}
</style>
