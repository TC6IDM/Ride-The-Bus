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
	 * countUpSegments). Every celebration opens at zero under the FIRST tier and
	 * climbs Big, Huge, Mega, Epic, Max as far as the win reaches (the owner's
	 * call, 2026-10-18: a max win always climbs the whole ladder). It used to open
	 * on the board's last figure and skip the bands below it; the board's figures
	 * are hidden under the takeover, so nothing on screen disagrees with a count
	 * from zero. Each leg climbs to the top of its band, then the next starts at
	 * its floor, until the leg that ends on the amount actually won. Each
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
	import { currencyFractionDigits, numberToCurrencyString } from 'utils-shared/amount';
	import { titleFaceFor } from '../../game/ui/displayFace';
	import { fitValue } from '../../game/ui/fitValue';
	import { fingerPointer } from '../../game/ui/pointerWords';

	import MarkIcon from '../icons/MarkIcon.svelte';
	import SuitIcon from '../icons/SuitIcon.svelte';
	import CardFace from '../cards/CardFace.svelte';
	import SplitFlap from './SplitFlap.svelte';
	import TicketFace from '../cards/TicketFace.svelte';
	import type { Card } from '../../game/round/roundContract';
	import { t } from '../../i18n/i18nDerived';
	import { sound } from '../../game/audio/sound';
	import { CEILING_PAUSE_MS, countUpSegments, type WinTier } from '../../game/math/winTiers';
	import { FAMILY_RULES, stageCount, type ModeFamily } from '../../game/math/modes';
	import { BURST, fanFor } from '../../game/celebration/celebrationScene';
	import { formatMultiplier } from '../../game/ui/formatMultiplier';
	import { hopFan, reducedMotion } from '../../game/celebration/celebrationGestures';
	import { flyHand } from '../../game/celebration/handFlight';

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
		 * The family the round was played on - for how many cards it dealt.
		 * `cards` is always four wide (roundState keeps one shape); a three-card
		 * family fans three, and an empty fourth slot would read as a card that
		 * never turned.
		 */
		family: ModeFamily;
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
		 * The ticket a Last Stop sweep drew, or null. When there is one it is the
		 * last piece of the hand - after the cards, in the fan's own geometry,
		 * drawn by TicketFace like the board's slot.
		 */
		ticket: number | null;
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
	/** Where the count starts: the first leg's floor (zero, since 2026-10-18). */
	const startAmount = segments.length ? segments[0]!.fromMultiplier * perX : 0;
	/** The count's value, every frame. The board prints `printed`, below. */
	let shown = $state(startAmount);
	/** True until the final leg lands - drives which prompt shows. */
	let counting = $state(true);

	/**
	 * WHAT THE FLAPS PRINT (W1, 2026-10-18: the amount is a split-flap board,
	 * SplitFlap.svelte, the running total's own). The count changes every frame
	 * and a flap needs about 120ms to turn, so a flap re-keyed every frame would
	 * restart its turn forever and never show a digit. The board takes the
	 * latest figure at most every FLAP_STEP_MS, and the trailing timer means the
	 * last one always lands - a ceiling, the settled total. The multiple under
	 * it reads the same value, so the two never disagree mid-count.
	 */
	const FLAP_STEP_MS = 70;
	let printed = $state(startAmount);
	let printedAt = 0;
	$effect(() => {
		const value = shown;
		const wait = FLAP_STEP_MS - (performance.now() - printedAt);
		const print = () => {
			printed = value;
			printedAt = performance.now();
		};
		if (wait <= 0) return print();
		const timer = setTimeout(print, wait);
		return () => clearTimeout(timer);
	});

	/** Name and colours currently displayed. */
	const activeTier = $derived<WinTier>(segments[segmentIndex]?.tier ?? props.tier);
	/**
	 * Which stop the sign has rolled to: the active tier's place on the
	 * family's ladder. The count climbs from the first rung (countUpSegments),
	 * so this walks 0, 1, 2 ... as the win is promoted.
	 */
	const stopIndex = $derived(Math.max(0, props.tiers.findIndex((tier) => tier.id === activeTier.id)));

	/** How many cards the round dealt - see `family` in Props. */
	const dealt = $derived(stageCount(FAMILY_RULES[props.family]));
	/** The fan, sized to the cards the round dealt - see `family` in Props. */
	const fan = $derived(fanFor(dealt));
	/**
	 * A Last Stop ticket is laid ON the hand rather than dealt into it: the
	 * cards fan exactly as on every family, and the ticket sits over the middle
	 * of them, lower, arriving after the last card (the owner's call,
	 * 2026-09-30 - as a fifth place in the fan it read as a fifth card).
	 */
	const ticketDelay = $derived(fanFor(dealt)[dealt - 1]!.delay + 0.14);

	/** Multiplier matching what the board prints, so it never runs ahead of the title. */
	const shownMultiplier = $derived(perX > 0 ? printed / perX : props.multiplier);

	/**
	 * The count-up prints every frame at the FINAL amount's precision. Money is
	 * shown exactly now, so a frame on its way to $0.711 would otherwise print
	 * "$0.0002" and then "$0.068213" - the width jumping and six decimals
	 * flashing past - before settling on the real figure. Fixed to the total's
	 * digits, the climb reads $0.000 ... $0.711.
	 */
	const amountDigits = $derived(currencyFractionDigits(props.amount));

	let fanEl: HTMLElement | undefined = $state(undefined);
	/**
	 * Continue was pressed and the hand is flying home: the overlay is going, so
	 * a second tap or key must not dismiss it twice. See dismiss().
	 */
	let leaving = $state(false);

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
	/** A finger taps and a mouse clicks - the prompt says which (pointerWords.ts). */
	const finger = fingerPointer();

	const ariaLabel = () =>
		[
			t(props.tier.label),
			numberToCurrencyString(props.amount),
			counting ? (finger ? t('Tap to skip') : t('Click to skip')) : finger ? t('Tap to continue') : t('Click to continue'),
		].join(', ');

	/** Mark the celebration finished: nothing left to count, only to dismiss. */
	function settle() {
		counting = false;
		settledAt = performance.now();
	}
	let frame = 0;
	let autoTimer: ReturnType<typeof setTimeout> | null = null;
	let holdTimer: ReturnType<typeof setTimeout> | null = null;

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
		clearHold();
		holdTimer = setTimeout(() => advanceTo(index + 1), CEILING_PAUSE_MS);
	}

	/** Leave the ceiling and start the next leg climbing. */
	function advanceTo(index: number) {
		clearHold();
		sound.playWinTierUp(segments[index]!.tier.id);
		runSegment(index);
		// The sign rolls to the new stop off stopIndex; the hand hops with it.
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
		// A first leg can be a hold too, when the board had already passed its
		// ceiling: it rests there and climbs on, like any other ceiling.
		if (segment.isHold && !isLast) {
			shown = to;
			holdThenAdvance(index);
			return;
		}
		if (segment.isHold) {
			shown = to;
			settle();
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
			// Clamped at 0 as well as 1: a requestAnimationFrame timestamp is the
			// frame's START, which can fall before `start` (read with
			// performance.now() a moment later), and a negative progress eased to
			// a figure under the leg's floor - the live max win opened on
			// "-$0.00001" (live pass, 2026-10-06).
			const progress = Math.max(0, Math.min(1, (now - start) / duration));
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
		if (leaving) return;
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

	/**
	 * Leave the way the hand came: the cards fly back to their board slots while
	 * the words and the veil fade, and only then does the round hear the
	 * takeover is gone (handFlight.ts). Under reduced motion the flight resolves
	 * at once and the overlay simply goes.
	 */
	function dismiss() {
		if (leaving) return;
		if (autoTimer) clearTimeout(autoTimer);
		clearHold();
		cancelAnimationFrame(frame);
		leaving = true;
		void flyHand(fanEl, 'out').then(() => props.ondismiss());
	}

	/* The hand is dealt OUT of the board's slots, once, as the takeover opens. */
	$effect(() => {
		if (fanEl) void flyHand(fanEl, 'in');
	});

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
	class:is-leaving={leaving}
	role="button"
	tabindex="0"
	aria-label={ariaLabel()}
	onclick={onTap}
	onkeydown={onKey}
>
	<!-- The veil, its own layer so it can fade out on Continue while the hand
	     flies home over it. One veil for the whole ladder (--wc-veil). -->
	<div class="wc-veil" aria-hidden="true"></div>
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
	     one-shot animation - the exact behaviour that is WRONG for .wc-title
	     (it would replay the sign's entrance on every promotion) and is right
	     here. -->
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
			{#each fan as slot}
				{@const card = props.cards[slot.index] ?? null}
				<!-- is-face carries NO styling and is not meant to: scripts/shoot.mjs
				     reads it to report which slots came back face-up, which is the
				     "fan [2 2 2 3]" line every takeover screenshot prints. It looks
				     like a dead class to any audit, and deleting it would take the
				     visual driver's fan check with it silently. -->
				<div
					class="wc-fan-card"
					data-slot={slot.index}
					class:is-face={card !== null}
					class:is-busted={slot.index === props.bustedIndex}
					class:is-forgiven={slot.index === props.forgivenIndex}
					style={`--tilt: ${slot.tilt}deg; --shift: ${slot.shift}; --drop: ${slot.drop}; animation-delay: ${slot.delay}s`}
				>
					{#if card}
						<!-- The board's own face (CardFace), so a fanned K is the King the
						     player just watched turn over. The paper is this sheet's. -->
						<span class="wc-fan-face">
							<CardFace rank={card.rank} suit={card.suit} />
						</span>
					{:else}
						<!-- Face down: the pack's printed mark, drawn by the sheet. -->
						<span class="wc-fan-brand"></span>
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
			{#if props.ticket !== null}
				<!-- The ticket the round ended on, laid over the middle of the hand
				     and lower than the cards, so their indices stay in sight: the
				     board's own drawing (TicketFace). Not a .wc-fan-card, so
				     shoot.mjs's fan line still counts the cards alone. -->
				<div class="wc-fan-ticket" style={`animation-delay: ${ticketDelay}s`}>
					<TicketFace value={props.ticket} />
				</div>
			{/if}
		</div>

		<!-- THE TIER IS A DESTINATION BLIND (the owner's pick W1, 2026-10-18): the
		     loader's sign, rolling one stop per rung as the count is promoted, and
		     under it the route, a stop per rung, the bus riding to the one reached
		     and Max as the end of the line. Every rung of the family's ladder is a
		     stop on the blind, each lettered in its own tier's colours (the stop
		     carries its tier's class, which sets only custom properties).

		     NOT keyed on the tier. Keying it destroys and recreates the element,
		     which replays the entrance, so the title vanished and rose back up on
		     every promotion (the reason promoteTitle once existed). The blind is
		     built once and rolls. -->
		<div class="wc-title" style="--stop: {stopIndex}; --stops: {props.tiers.length}">
			<div class="wc-sign">
				<div class="wc-roll">
					{#each props.tiers as tier (tier.id)}
						{@const word = t(tier.label)}
						<div
							class="wc-stop tier-{tier.id} face-{titleFaceFor(word)}"
							class:is-terminus={tier.id === 'max'}
							use:fitValue={word}
						>
							{word}
						</div>
					{/each}
				</div>
			</div>
			<!-- A one-rung ladder (Three of a Kind) has nowhere to ride: no route. -->
			{#if props.tiers.length > 1}
				<div class="wc-route">
					<span class="wc-route-line"></span>
					<span class="wc-route-lit"></span>
					{#each props.tiers as tier, at (tier.id)}
						<span
							class="wc-route-dot"
							class:is-lit={at <= stopIndex}
							class:is-end={at === props.tiers.length - 1}
							style="--at: {at}"
						></span>
					{/each}
					<svg class="wc-route-bus" viewBox="0 0 26 14">
						<rect class="wc-bus-body" x="1" y="1" width="24" height="10" rx="2.5" />
						<rect class="wc-bus-glass" x="4" y="3" width="4" height="3" />
						<rect class="wc-bus-glass" x="10" y="3" width="4" height="3" />
						<rect class="wc-bus-glass" x="16" y="3" width="6" height="3" />
						<circle class="wc-bus-wheel" cx="7" cy="11.5" r="2" />
						<circle class="wc-bus-wheel" cx="19" cy="11.5" r="2" />
					</svg>
				</div>
			{/if}
		</div>

		<!-- THE AMOUNT ON A SPLIT-FLAP BOARD (W1, 2026-10-18): the running total's
		     own board (RW1) at the takeover's scale, so the figure the player
		     watched climb under the cards is the figure handed over here. Each
		     character flips as it changes; a long currency shares the room out
		     rather than clipping (SplitFlap's own fit). The digits take the
		     element's colour: the tier's while counting, cream when it lands. -->
		<div class="wc-amount" class:is-counting={counting}>
			<SplitFlap text={numberToCurrencyString(printed, amountDigits)} />
		</div>

		<!-- Climbs with the amount, so the multiplier and the title agree at
		     every frame instead of the multiplier spoiling the ending. -->
		<div class="wc-mult">{formatMultiplier(shownMultiplier)}</div>

		<div class="wc-prompt" class:is-ready={!counting}>
			{counting ? (finger ? t('Tap to skip') : t('Click to skip')) : finger ? t('Tap to continue') : t('Click to continue')}
		</div>
	</div>
</div>

<style>
	@import '../../styles/scene/win-celebration.css';
</style>
