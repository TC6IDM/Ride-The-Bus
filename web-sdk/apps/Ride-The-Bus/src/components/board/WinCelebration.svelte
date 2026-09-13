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
	 * THE SCENE IS THE ROUND, not ambience over it. The centrepiece is the four
	 * cards the player just played, fanned - drawn from the same warm paper and
	 * crimson crosshatch as every other card in the game. The screen used
	 * to be a scrim gradient, a conic gradient, a radial gradient and a text
	 * stack, which is item for item the list Stake's rating notes give for a
	 * 1-star release ("standard fonts, gradients, emoji icons and border
	 * effects"). Gradients cannot be what a celebration is MADE of; they can
	 * only light it.
	 *
	 * Drawn entirely in CSS. Everything here is gradients, transforms and
	 * pseudo-elements: no images, no canvas, no particle library. Stake's XSS
	 * policy forbids reaching offsite, the whole bundle is base64-inlined into
	 * index.html, and "optimised bundle size" is an explicit 3-star criterion -
	 * so a sprite sheet for one screen would be a bad trade.
	 */
	import { logoAsset } from '../../game/ui/logoAsset.svelte';
	import { numberToCurrencyString } from 'utils-shared/amount';
	import { evenDigitEms } from '../../game/ui/typeFit';
	import Figure from './Figure.svelte';
	import { titleFaceFor } from '../../game/ui/displayFace';

	import MarkIcon from '../icons/MarkIcon.svelte';
	import SuitIcon from '../icons/SuitIcon.svelte';
	import type { Card } from '../../game/round/roundContract';
	import { t } from '../../i18n/i18nDerived';
	import { sound } from '../../game/audio/sound';
	import { CEILING_PAUSE_MS, countUpSegments, type WinTier } from '../../game/math/winTiers';
	import { BURST, FAN } from '../../game/celebration/celebrationScene';
	import {
		hopFan,
		pop,
		popAmount,
		promoteTitle,
		reducedMotion,
	} from '../../game/celebration/celebrationGestures';

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
		 * The four card slots of the round being celebrated, in deal order, with
		 * null for any the player never reached.
		 *
		 * A SNAPSHOT taken at the call site, not the live board array - see
		 * showWinCelebration in Game.svelte.
		 */
		cards: readonly (Card | null)[];
		/**
		 * The card that ended the round, and the one a Second Chance let off.
		 * null for neither. Snapshotted with the cards, for the same reason.
		 */
		bustedIndex: number | null;
		forgivenIndex: number | null;
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
	/**
	 * How wide the SETTLED figure prints, so the CSS can size the amount to fit
	 * the screen rather than to a constant.
	 *
	 * Measured before this existed: High Stakes' 1910.20x cap on a
	 * high-denomination currency gives "NGN 3,820,400,000.00", and at Mobile M
	 * that ran off BOTH edges of the viewport - the one figure the whole screen
	 * exists to hand over, unreadable.
	 *
	 * Taken from props.amount and NOT from `shown`, which is the climbing value.
	 * Sizing off the live string would re-solve the font on every frame of the
	 * count-up and visibly pump the headline; sizing off the final one means the
	 * type is chosen once, for the widest string that will ever appear, and the
	 * count grows into it.
	 */
	/**
	 * The tier name, and the face that can draw ALL of it.
	 *
	 * Derived rather than called twice in the markup because t() is reactive and
	 * the face has to be decided from the SAME string that gets rendered - call
	 * it twice and a locale change between the two lands a class chosen for the
	 * previous language. game/ui/displayFace.ts has the argument for why this is
	 * a three-way answer rather than "display or not".
	 */
	const titleText = $derived(t(activeTier.label));
	const titleFace = $derived(titleFaceFor(titleText));

	// evenDigitEms, not labelEms: the amount is rendered through Figure below,
	// which sets every digit in a box one "0" wide, so the settled string is
	// wider than its proportional width - a "1" takes 0.66em, not 0.42. Sizing
	// from the plain estimate would fit the type to a narrower string than the
	// one that is drawn, and a nine-digit figure would run off both edges again.
	const amountEms = $derived(evenDigitEms(numberToCurrencyString(props.amount)));

	let amountEl: HTMLElement | undefined = $state(undefined);
	let fanEl: HTMLElement | undefined = $state(undefined);

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
	function clearHold() {
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = null;
	}

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
		popAmount(amountEl);
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
		promoteTitle(titleEl);
		hopFan(fanEl);
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
			popAmount(amountEl);
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
	style={`--logo-url: url(${logoAsset.url})`}
	onclick={onTap}
	onkeydown={onKey}
>
	<!-- One wide soft beam from the upper right - the same light the table is lit
	     by. Every tier draws it; the tier sets how bright. -->
	<div class="wc-beam" aria-hidden="true"></div>
	<!-- Max Win only, and the one thing no other tier draws. See the note in
	     win-celebration.css. -->
	<div class="wc-deck-sweep" aria-hidden="true"></div>

	<!-- KEYED, and unlike the title that is the whole point.
	     A burst is an event: it should fire when the tier is promoted and be
	     over. The marks used to loop forever on independent delays, which meant
	     they never shared a start and the ring only ever drifted. Keying tears
	     the container down and rebuilds it on each promotion, which restarts the
	     one-shot animation - the exact behaviour that was WRONG for .wc-title
	     (see promoteTitle) and is right here. -->
	{#key activeTier.id}
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
	{/key}

	<div class="wc-body" aria-hidden="true">
		<!-- The round's own hand, dealt above the figure.

		     A CHILD of .wc-body, not a sibling of it, and that is load-bearing. As
		     a sibling it was positioned in --ui units against the viewport centre
		     while the title above it is capped in vw - so on a 375px phone, where
		     the vw cap binds and the title is 41px against a --ui of 7.5px, the
		     two sized off different rulers and the word landed across the middle
		     of the cards. Anchored to the text block it clears the title at every
		     size, whatever the type is doing.

		     NOT keyed: the fan is the scene, not a beat. Rebuilding it on every
		     promotion would re-deal the hand four times during one count-up. It
		     widens instead, off --wc-fan-spread. -->
		<div class="wc-fan" bind:this={fanEl} aria-hidden="true">
			{#each FAN as slot}
				{@const card = props.cards[slot.index] ?? null}
				<!-- is-face carries NO styling and is not meant to: scripts/shoot.mjs
				     reads it to report which slots came back face-up, which is the
				     "fan [2 2 2 3]" line every takeover screenshot prints. It looks
				     like a dead class to any audit, and deleting it would take the
				     visual driver's fan check with it silently. -->
				<div
					class="wc-fan-card"
					class:is-face={card !== null}
					class:is-busted={slot.index === props.bustedIndex}
					class:is-forgiven={slot.index === props.forgivenIndex}
					style={`--tilt: ${slot.tilt}deg; --shift: ${slot.shift}; --drop: ${slot.drop}; animation-delay: ${slot.delay}s`}
				>
					{#if card}
						<span
							class="wc-fan-face"
							class:is-red={card.suit === '♥' || card.suit === '♦'}
						>
							<span class="wc-fan-index">
								<span class="wc-fan-rank">{card.rank}</span>
								<SuitIcon suit={card.suit} scale={0.72} />
							</span>
							<span class="wc-fan-pip"><SuitIcon suit={card.suit} scale={1} /></span>
						</span>
					{/if}
					<!-- The board's own marks, not new ones. See the note at the top. -->
					{#if slot.index === props.bustedIndex}
						<span class="wc-fan-mark is-bust"><MarkIcon name="cross" /></span>
					{:else if slot.index === props.forgivenIndex}
						<span class="wc-fan-mark is-forgiven">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M20 12a8 8 0 1 1-2.34-5.66" />
								<path d="M20 3v5h-5" />
							</svg>
						</span>
					{/if}
				</div>
			{/each}
		</div>

		<!-- NOT keyed on the tier. Keying it destroys and recreates the element,
		     which replays the entrance animation, so the title vanished and rose
		     back up on every promotion. It stays put now; the word swaps in place,
		     the colour cross-fades, and promoteTitle gives it a pop. -->
		<div class="wc-title face-{titleFace}" bind:this={titleEl}>{titleText}</div>

		<!-- is-holding only brightens the glow; the pop is applied through
		     popAmount(amountEl) so it cannot clobber the entrance animation. -->
		<div
			class="wc-amount"
			class:is-counting={counting}
			class:is-holding={holding}
			style="--amount-ems: {amountEms}"
			bind:this={amountEl}
		>
			<!-- Through Figure, so the digits hold their places as the count
			     turns them over. Poppins has no tabular figures (see Figure.svelte
			     and the note on .wc-amount in win-celebration.css); under a
			     centred headline every changed digit used to shift the whole
			     figure by the width difference, and the count-up wobbled. -->
			<Figure text={numberToCurrencyString(shown)} />
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
	@import '../../styles/scene/win-celebration.css';
</style>
