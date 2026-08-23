<script lang="ts">
	/**
	 * The big-win takeover.
	 *
	 * Two-stage interaction, which is the convention players already know from
	 * other casino games: the amount counts up, the first tap lands it on the
	 * final figure, and the second tap dismisses. Skipping the count must never
	 * also dismiss - that would hide the number the player stopped to read.
	 *
	 * The count-up is SEGMENTED, one leg per tier the win passes through (see
	 * countUpSegments). Every celebration opens at zero on "Big Win" and climbs to
	 * the top of that band, then restarts at the next tier's floor and climbs
	 * through that one, until the leg that ends on the amount actually won. Each
	 * leg eases in and out, so the number accelerates away from the floor and
	 * settles into the ceiling rather than running at a constant rate.
	 *
	 * A tap advances ONE TIER, not the whole thing: mid-way through "Big Win" it
	 * jumps to the Huge Win floor and sets off again, and the same during the
	 * pause that follows each ceiling. Only on the final leg does a tap land the
	 * real total, and only then does the next tap dismiss. So an impatient player
	 * still sees every tier they earned go past.
	 *
	 * Drawn entirely in CSS. Everything here is gradients, transforms and
	 * pseudo-elements: no images, no canvas, no particle library. Stake's XSS
	 * policy forbids reaching offsite, the whole bundle is base64-inlined into
	 * index.html, and "optimised bundle size" is an explicit 3-star criterion -
	 * so a sprite sheet for one screen would be a bad trade.
	 */
	import { numberToCurrencyString } from 'utils-shared/amount';

	import SuitIcon from './SuitIcon.svelte';
	import { t } from '../i18n/i18nDerived';
	import { sound } from '../game/sound';
	import { CEILING_PAUSE_MS, countUpSegments, type WinTier } from '../game/winTiers';

	type Props = {
		tier: WinTier;
		/** Final payout in display units. */
		amount: number;
		/** Final payout as a multiple of the bet, for the sub-caption. */
		multiplier: number;
		/**
		 * The playing family's ladder. Passed in rather than read from the module
		 * constant because the top band sits on the family's own ceiling - see
		 * winTiersFor. The count-up needs it to know where the leg BELOW the
		 * earned tier stops climbing.
		 */
		tiers: readonly WinTier[];
		/**
		 * Autoplay: show the finished figure, hold briefly, then leave on its own.
		 * Counting up through a 100-round run would make autoplay unusable, and a
		 * partial count cut off mid-climb looks broken - so this snaps straight to
		 * the total rather than counting at speed.
		 */
		autoSkipMs: number | null;
		ondismiss: () => void;
	};

	const props: Props = $props();

	/**
	 * The burst geometry, computed here rather than in CSS.
	 *
	 * The obvious CSS version needs `round()` to alternate the throw distance,
	 * and `round()` is far too new to rely on - Stake tests on older Android and
	 * iOS, where it would silently collapse every mark to the same radius. Plain
	 * arithmetic in a module constant costs nothing and works everywhere.
	 *
	 * THESE ARE SUIT MARKS, NOT SPARKS. They used to be fourteen glowing dots,
	 * which is the particle burst every generated casino screen ships and says
	 * nothing about what game you just won. Ride The Bus is four cards and four
	 * guesses; its celebration should be made of its own deck. The marks come
	 * from SuitIcon - already drawn as SVG because Poppins does not own U+2660..
	 * U+2666 and the fallback is a colour emoji on most phones.
	 *
	 * Sixteen over 360deg, four of each suit so no one suit dominates, jittered
	 * off the exact spoke angles and alternating short/long so the ring does not
	 * read as a perfect circle, on staggered delays so they do not fire as one.
	 * Alternating spin direction keeps the tumble from looking mechanical.
	 */
	const SUIT_CYCLE = ['heart', 'spade', 'diamond', 'club'] as const;

	const BURST = Array.from({ length: 16 }, (_, i) => ({
		suit: SUIT_CYCLE[i % 4]!,
		angle: +(i * (360 / 16) + (i % 2 === 0 ? -7 : 7)).toFixed(2),
		dist: i % 2 === 0 ? 19 : 26,
		/** Font size in --ui units; the mark is sized in em off it. */
		size: i % 3 === 0 ? 2.5 : 1.9,
		spin: i % 2 === 0 ? 210 : -250,
		delay: +((i * 0.13) % 2.1).toFixed(2),
	}));

	/**
	 * The legs of the climb. Built once - the props for a given celebration never
	 * change, and rebuilding mid-count would restart it.
	 */
	const segments = countUpSegments(props.multiplier, props.tier, props.tiers);

	/** Display units per 1x, for converting a leg's multipliers into money. */
	const perX = props.multiplier > 0 ? props.amount / props.multiplier : 0;

	/** Which leg is running. */
	let segmentIndex = $state(0);
	/** Amount currently on screen. */
	let shown = $state(0);
	/** True until the final leg lands - drives which prompt shows. */
	let counting = $state(true);
	/**
	 * Resting on a band's ceiling, between one leg finishing and the next
	 * starting. Every tier gets the same pause - see CEILING_PAUSE_MS.
	 */
	let holding = $state(false);

	/** Name and colours currently displayed. */
	const activeTier = $derived<WinTier>(segments[segmentIndex]?.tier ?? props.tier);

	/** Multiplier matching what is on screen, so it never runs ahead of the title. */
	const shownMultiplier = $derived(perX > 0 ? shown / perX : props.multiplier);

	let titleEl: HTMLElement | undefined = $state(undefined);
	let amountEl: HTMLElement | undefined = $state(undefined);

	/**
	 * When the celebration reached its final state, and how long a dismiss tap is
	 * ignored afterwards.
	 *
	 * Without this the last tier is one careless double-tap from never being
	 * seen: a tap on the Epic leg now lands the Max Win instantly (it has nothing
	 * to count), so the very next tap would dismiss the rarest screen in the game
	 * - 1 in 36,384 - before the player registered it. Short enough that a
	 * deliberate second tap still feels immediate.
	 */
	let settledAt = 0;
	const DISMISS_GRACE_MS = 400;

	/**
	 * What assistive tech is told the overlay is.
	 *
	 * The climbing text stays aria-hidden - under aria-live the upgrading title
	 * would announce three or four times mid-count and the digits would announce
	 * every frame - so this label is the ONLY thing a screen reader gets, and it
	 * has to carry the state as well as the result. It used to be static: a
	 * player was handed the final tier and amount at frame one and never told the
	 * overlay was dismissible, or which of its two states it was in.
	 *
	 * The amount stays the FINAL one rather than the climbing one, deliberately.
	 * A label that changed with the count would re-announce on every frame, which
	 * is the noise the aria-hidden exists to prevent.
	 */
	const ariaLabel = () =>
		[
			t(props.tier.label),
			numberToCurrencyString(props.amount),
			counting ? t('Tap to skip') : t('Tap to continue'),
		].join(' — ');

	/** Mark the celebration finished: nothing left to count, only to dismiss. */
	function settle() {
		holding = false;
		counting = false;
		settledAt = performance.now();
	}
	let frame = 0;
	let autoTimer: ReturnType<typeof setTimeout> | null = null;
	let holdTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * The pop the title gets when it is promoted.
	 *
	 * Driven imperatively rather than by a CSS class, because re-adding a class
	 * does not restart an animation that has already run - the usual workarounds
	 * are removing it, forcing a reflow and adding it back, or keying the
	 * element. Keying is what caused the bug this replaces: it tore the title
	 * down and rebuilt it, replaying the full entrance so the word disappeared
	 * and rose back up between every tier. element.animate() restarts cleanly and
	 * leaves the element alone.
	 */
	function promoteTitle() {
		pop(titleEl, 1.22, 560);
	}

	/** The same treatment for the amount as it settles on a band ceiling. */
	function popAmount() {
		pop(amountEl, 1.12, 520);
	}

	/**
	 * Read from the stylesheet rather than restated here. The literal that used
	 * to sit in this call was a second, slightly different overshoot living one
	 * file away from --ease-pop - the same near-duplicate-value drift that made
	 * --ctl-turbo-rgb a different amber from --ctl-turbo.
	 */
	function easePop(): string {
		if (typeof window === 'undefined') return 'ease-out';
		const declared = getComputedStyle(document.documentElement)
			.getPropertyValue('--ease-pop')
			.trim();
		return declared || 'ease-out';
	}

	function pop(element: HTMLElement | undefined, scale: number, duration: number) {
		if (!element || reducedMotion()) return;
		element.animate(
			[
				{ transform: 'scale(1)' },
				{ transform: `scale(${scale})`, offset: 0.38 },
				{ transform: 'scale(1)' },
			],
			{ duration, easing: easePop() },
		);
	}

	function clearHold() {
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = null;
	}

	const reducedMotion = () =>
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

	/** Money value a leg ends on. The last leg uses props.amount to avoid drift. */
	const segmentEnd = (index: number) =>
		index === segments.length - 1 ? props.amount : segments[index]!.toMultiplier * perX;

	/** Land the whole thing on the real total, without dismissing. */
	function finishAll() {
		cancelAnimationFrame(frame);
		clearHold();
		shown = props.amount;
		segmentIndex = segments.length - 1;
		settle();
		sound.playWinCountEnd(props.tier.id);
	}

	/**
	 * Rest on the ceiling just reached, then move up.
	 *
	 * The pause is the same length for every tier: the point is to give the
	 * player time to read the figure they just climbed to, and that takes as long
	 * at 40x as it does at 300x.
	 */
	function holdThenAdvance(index: number) {
		holding = true;
		popAmount();
		clearHold();
		holdTimer = setTimeout(() => advanceTo(index + 1), CEILING_PAUSE_MS);
	}

	/** Leave the ceiling and start the next leg climbing. */
	function advanceTo(index: number) {
		clearHold();
		holding = false;
		sound.playWinTierUp(segments[index]!.tier.id);
		runSegment(index);
		// After runSegment, so the new word is what pops.
		promoteTitle();
	}

	/**
	 * Run one leg, then chain into the next.
	 *
	 * Eases in AND out: the number pulls away from the floor, runs, and settles
	 * into the ceiling. A leg that arrived at a constant rate would read as a
	 * progress bar rather than a climb.
	 */
	function runSegment(index: number) {
		cancelAnimationFrame(frame);
		segmentIndex = index;

		const segment = segments[index]!;
		const from = segment.fromMultiplier * perX;
		const to = segmentEnd(index);
		const isLast = index === segments.length - 1;

		// A leg with nowhere to climb - the Max Win, whose floor IS the game
		// ceiling, or a win landing exactly on a threshold. There is no count to
		// run and nothing to skip, so it arrives finished: the prompt reads "tap to
		// continue" immediately and the next tap dismisses. Offering "tap to skip"
		// over a static number would be a button that does nothing.
		if (segment.isHold) {
			shown = to;
			settle();
			popAmount();
			sound.playWinCountEnd(props.tier.id);
			return;
		}

		// Deliberately NOT scaled by the turbo slider. Turbo is about how fast the
		// cards flip - how long the player waits to find out the result. The
		// celebration is the result, and someone who has turned the reveal up to
		// instant has not asked to have their max win flashed past them. The two
		// are kept separate; a tap skips this instead.
		const duration = segment.durationMs;
		const start = performance.now();
		let lastTick = 0;
		shown = from;

		const step = (now: number) => {
			const progress = Math.min(1, (now - start) / duration);
			// Ease-in-out cubic.
			const eased =
				progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
			shown = from + (to - from) * eased;

			// Ticks spaced by eased progress, so they crowd through the fast middle
			// and thin out as the number settles - which is what makes the
			// acceleration audible rather than only visible.
			if (progress < 1 && !segment.isHold && eased - lastTick >= 0.05) {
				lastTick = eased;
				sound.playWinCountTick(progress);
			}

			if (progress < 1) {
				frame = requestAnimationFrame(step);
				return;
			}

			shown = to;
			if (isLast) {
				settle();
				sound.playWinCountEnd(props.tier.id);
			} else {
				// Rest on the ceiling before climbing on, so the figure the player
				// just reached is actually readable instead of resetting to the next
				// floor a frame later.
				holdThenAdvance(index);
			}
		};

		frame = requestAnimationFrame(step);
	}

	/**
	 * A tap advances one tier, never straight to the end.
	 *
	 *   climbing, more tiers above -> jump to the next tier's floor and climb
	 *   resting on a ceiling       -> same: stop waiting, start the next leg
	 *   climbing the final leg     -> land the real total
	 *   finished                   -> dismiss
	 *
	 * Climbing and resting behave identically on purpose. From the player's side
	 * they are one state - "this tier is still going" - and making a tap mean two
	 * different things depending on a boundary they cannot see would just feel
	 * unpredictable.
	 */
	function onTap() {
		if (!counting) {
			// Swallow a tap that arrives on the heels of the celebration settling -
			// see DISMISS_GRACE_MS.
			if (performance.now() - settledAt >= DISMISS_GRACE_MS) dismiss();
			return;
		}

		if (segmentIndex >= segments.length - 1) {
			finishAll();
			return;
		}

		advanceTo(segmentIndex + 1);
	}

	/* The overlay announces itself as a button, so it has to behave like one:
	   Enter and Space skip and dismiss exactly as a tap does. Without this the
	   takeover could only be cleared with a pointer, which strands anyone
	   playing by keyboard until the auto-dismiss timer runs out.
	   preventDefault stops Space also scrolling the page behind the overlay. */
	function onKey(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		onTap();
	}

	function dismiss() {
		if (autoTimer) clearTimeout(autoTimer);
		clearHold();
		cancelAnimationFrame(frame);
		props.ondismiss();
	}

	/**
	 * Keys are taken on `window`, not on the element.
	 *
	 * Binding to the overlay would need it focused, and focus after a
	 * programmatic mount is not reliable across browsers - a player pressing
	 * Space would get nothing, or worse, would reach the spin button underneath.
	 * Game.svelte's own Space handler bails out while this is open, so the two
	 * cannot both fire.
	 */
	$effect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.code !== 'Space' && event.key !== ' ' && event.key !== 'Enter') return;
			// Stop Space scrolling the page and stop it reaching the game.
			event.preventDefault();
			event.stopPropagation();
			onTap();
		};
		window.addEventListener('keydown', onKey, { capture: true });
		return () => window.removeEventListener('keydown', onKey, { capture: true });
	});

	$effect(() => {
		sound.playWinFanfare(props.tier.id);

		// Autoplay or reduced motion: show the total and skip the climb entirely.
		// A segmented count cut off part-way through a run looks broken, and at
		// these settings the player has asked not to watch it.
		//
		// Turbo is deliberately absent from this list - see runSegment.
		if (props.autoSkipMs !== null || reducedMotion() || !segments.length) {
			shown = props.amount;
			segmentIndex = Math.max(0, segments.length - 1);
			settle();
			if (props.autoSkipMs !== null) {
				autoTimer = setTimeout(dismiss, props.autoSkipMs);
			}
			return () => {
				if (autoTimer) clearTimeout(autoTimer);
			};
		}

		runSegment(0);
		return () => {
			cancelAnimationFrame(frame);
			clearHold();
		};
	});
</script>

<!-- Whole overlay is the button. A win takeover that needs a small target to
     dismiss is the single most irritating thing a casino game can do. -->
<!-- The tier class drives the whole palette, so the colours escalate with the
     title as the number climbs.

     aria-label carries the FINAL result and the climbing text is hidden from
     assistive tech: under aria-live the upgrading title would announce itself
     three or four times mid-count, which is noise, and the counting digits
     would announce on every frame. -->
<div
	class="wc-overlay tier-{activeTier.id}"
	role="button"
	tabindex="0"
	aria-label={ariaLabel()}
	onclick={onTap}
	onkeydown={onKey}
>
	<!-- Two counter-rotating soft conic sweeps. Every tier draws them; the tier
	     sets how bright and how fast. -->
	<div class="wc-sheen" aria-hidden="true"></div>
	<div class="wc-sheen is-counter" aria-hidden="true"></div>
	<div class="wc-glow" aria-hidden="true"></div>
	<!-- Max Win only, and the one thing no other tier draws. See the note in
	     win-celebration.css. -->
	<div class="wc-deck-sweep" aria-hidden="true"></div>

	<div class="wc-burst" aria-hidden="true">
		{#each BURST as mark}
			<span
				class="wc-mark"
				style={`--angle: ${mark.angle}deg; --dist: calc(var(--ui) * ${mark.dist}); --spin: ${mark.spin}deg; font-size: calc(var(--ui) * ${mark.size}); animation-delay: ${mark.delay}s`}
			>
				<SuitIcon suit={mark.suit} scale={1} />
			</span>
		{/each}
	</div>

	<div class="wc-body" aria-hidden="true">
		<!-- NOT keyed on the tier. Keying it destroys and recreates the element,
		     which replays the entrance animation, so the title vanished and rose
		     back up on every promotion. It stays put now; the word swaps in place,
		     the colour cross-fades, and promoteTitle gives it a pop. -->
		<div class="wc-title" bind:this={titleEl}>{t(activeTier.label)}</div>

		<!-- is-holding only brightens the glow; the pop is applied through
		     popAmount() so it cannot clobber the entrance animation. -->
		<div
			class="wc-amount"
			class:is-counting={counting}
			class:is-holding={holding}
			bind:this={amountEl}
		>
			{numberToCurrencyString(shown)}
		</div>

		<!-- Climbs with the amount, so the multiplier and the title agree at
		     every frame instead of the multiplier spoiling the ending. -->
		<div class="wc-mult">{shownMultiplier.toFixed(2)}×</div>

		<div class="wc-prompt" class:is-ready={!counting}>
			{counting ? t('Tap to skip') : t('Tap to continue')}
		</div>
	</div>
</div>

<style>
	@import '../styles/win-celebration.css';
</style>
