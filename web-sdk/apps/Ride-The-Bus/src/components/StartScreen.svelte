<script lang="ts">
	import { base } from '$app/paths';
	import { numberToCurrencyString } from 'utils-shared/amount';
	import { t } from '../i18n/i18nDerived';
	import gameConfig from '../game/config';
	import { FAMILY_RULES, MODE_FAMILIES, familyOf, parseModeName } from '../game/modes';
	import ChoiceIcon from './ChoiceIcon.svelte';

	/** The biggest figure any mode can pay - High Stakes', at the time of
	 *  writing. Derived so it cannot drift from the maths. */
	const maxWinOverall = Math.max(...MODE_FAMILIES.map((f) => FAMILY_RULES[f].maxWin));
	import SuitIcon from './SuitIcon.svelte';

	/**
	 * The how-to-play picks behave like the real ones on the board.
	 *
	 *   click  - locks a guess in, and clicking it again clears it, exactly as
	 *            setColorChoice and friends do in Game.svelte
	 *   hover  - previews, without disturbing whatever is locked
	 *
	 * `locked` starts with a pick already made in every step, so the screen opens
	 * on a complete four-stage guess rather than four blank controls. Clearing
	 * one falls back to DEFAULTS for the worked example, so the demo never goes
	 * empty even when nothing is selected.
	 */
	let locked = $state<{ color: string | null; hl: string | null; io: string | null; suit: string | null }>({
		color: 'black',
		hl: 'higher',
		io: 'inside',
		suit: 'heart',
	});
	let hover = $state<{ color: string | null; hl: string | null; io: string | null; suit: string | null }>({
		color: null,
		hl: null,
		io: null,
		suit: null,
	});

	const DEFAULTS = { color: 'black', hl: 'higher', io: 'inside', suit: 'heart' } as const;

	/** What the worked example is currently showing. */
	const demo = $derived({
		color: hover.color ?? locked.color ?? DEFAULTS.color,
		hl: hover.hl ?? locked.hl ?? DEFAULTS.hl,
		io: hover.io ?? locked.io ?? DEFAULTS.io,
		suit: hover.suit ?? locked.suit ?? DEFAULTS.suit,
	});

	/** Click to lock in, click again to clear - the board's toggle behaviour. */
	function lock(step: 'color' | 'hl' | 'io' | 'suit', value: string) {
		locked[step] = locked[step] === value ? null : value;
	}

	/*
	 * NOTE: the board disables Inside once Equal is picked at stage 2, because
	 * that combination is unwinnable and the math publishes no such bet mode.
	 * This screen deliberately does NOT copy that rule. Nothing here is a bet -
	 * the four controls are a demonstration - so greying out a pick the player
	 * is only reading about would stop them seeing what Inside even means. The
	 * "?" on this panel explains the restriction in words instead, and the board
	 * enforces it where it actually matters.
	 */

	/** The reference cards the examples are built around. */
	const HL_REF = { rank: '7', suit: '♦', red: true };
	const IO_LOW = { rank: '4', suit: '♣', red: false };
	const IO_HIGH = { rank: '10', suit: '♥', red: true };

	/** Card 2 for each Higher / Lower pick, against the 7. */
	const HL_RESULT: Record<string, { rank: string; suit: string; red: boolean }> = {
		higher: { rank: 'J', suit: '♠', red: false },
		lower: { rank: '3', suit: '♥', red: true },
		equal: { rank: '7', suit: '♣', red: false },
	};

	/** Card 3 for the Inside and Outside picks, against the 4 and the 10. */
	const IO_RESULT: Record<string, { rank: string; suit: string; red: boolean }> = {
		inside: { rank: '7', suit: '♠', red: false },
		outside: { rank: '2', suit: '♦', red: true },
		equal: { rank: '4', suit: '♥', red: true },
	};

	/**
	 * Equal at stage 3 is satisfied by matching the rank of EITHER reference
	 * card, not just the first - so both are shown. Suits deliberately differ
	 * from the cards they match, because only the rank counts.
	 */
	const IO_EQUAL_RESULTS = [
		{ rank: '4', suit: '♥', red: true },
		{ rank: '10', suit: '♠', red: false },
	];

	// `label` is typed as the literal union rather than string: t() is keyed on
	// the English map, and a widened string is not assignable to it.
	const SUIT_GLYPH: Record<
		string,
		{ glyph: string; red: boolean; label: 'Heart' | 'Spade' | 'Club' | 'Diamond' }
	> = {
		heart: { glyph: '♥', red: true, label: 'Heart' },
		spade: { glyph: '♠', red: false, label: 'Spade' },
		club: { glyph: '♣', red: false, label: 'Club' },
		diamond: { glyph: '♦', red: true, label: 'Diamond' },
	};

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

	/** Turn a mode name like "red_higher_inside_heart" into a list of {label, cssClass} badges. */
	/**
	 * The four guesses a replayed round was placed on, as badges.
	 *
	 * Parsed through parseModeName so the family prefix comes off first. The old
	 * version split on "_" and bailed unless it found exactly four parts, which
	 * every Second Chance and High Stakes mode fails - "sc_red_higher_equal_spade"
	 * has five - so those rounds printed the raw slug instead of their picks.
	 *
	 * Labels are title-cased English, which is also the i18n key: the choice
	 * words are already translated for the board's own controls, so they are
	 * looked up rather than shown as the lowercase identifiers they are on the
	 * wire.
	 */
	const CHOICE_LABEL = {
		red: 'Red', black: 'Black',
		higher: 'Higher', lower: 'Lower',
		inside: 'Inside', outside: 'Outside', equal: 'Equal',
		heart: 'Heart', diamond: 'Diamond', club: 'Club', spade: 'Spade',
	} as const;

	function modeBadges(mode: string): { label: string; cssClass: string }[] {
		const parsed = parseModeName(mode);
		if (!parsed) return [{ label: mode, cssClass: '' }];
		const { color, higherLower, insideOutside, suit } = parsed;
		return [
			{ label: t(CHOICE_LABEL[color]), cssClass: `color-${color}` },
			{ label: t(CHOICE_LABEL[higherLower]), cssClass: `choice-${higherLower}` },
			{ label: t(CHOICE_LABEL[insideOutside]), cssClass: `choice-${insideOutside}` },
			{ label: t(CHOICE_LABEL[suit]), cssClass: `suit-${suit}` },
		];
	}

	/** Which of the three modes the replayed round was played on. */
	function modeFamilyLabel(mode: string): string {
		return t(FAMILY_RULES[parseModeName(mode)?.family ?? familyOf(mode)].label);
	}
</script>

<!-- A miniature of the real playing card, for the worked examples. Same face
     colours and corner layout as cards.css, at a size that fits four examples
     across without the row wrapping. -->
{#snippet card(rank: string, suit: string, red: boolean)}
	<span class="ss-card-mini" class:red>
		<span class="ss-card-rank">{rank}</span>
		<span class="ss-card-suit"><SuitIcon {suit} /></span>
	</span>
{/snippet}

<!-- The "?" badge in each panel's top-right corner.
     Focusable rather than a bare hover target, so the explanation is reachable
     by keyboard and by tap - hover alone would hide it from every phone.

     A real <button> rather than a span with tabindex: it is focusable natively,
     which is what makes the :focus-visible rule that reveals the tip work for
     keyboard users, and it needs no role. The span version carried role="note",
     which is non-interactive and cannot legally hold a tabindex.
     type="button" so it never submits anything. -->
{#snippet help(text: Parameters<typeof t>[0])}
	<button type="button" class="ss-help" aria-label={t(text)}>
		?
		<span class="ss-tip">{t(text)}</span>
	</button>
{/snippet}

<div class="ss-overlay" style={`--logo-url: url(${base}/logo.png)`}>
	{#if props.phase === 'start'}
		<!-- ---- Start / intro screen ----
		     Everything animates in on a stagger driven by --d (delay index), set
		     inline per element so one keyframe serves the whole screen. The old
		     version of this was a five-line paragraph of rules text, which is a
		     lot to read before you are allowed to play; the four steps below say
		     the same thing as pictures. The prose version is still in How to Play
		     for anyone who wants it. -->
		<div class="ss-card">
			<div class="ss-logo" style="--d: 0" aria-hidden="true"></div>
			<h1 class="ss-title" style="--d: 1">Ride The Bus</h1>
			<p class="ss-subtitle" style="--d: 2">by Takeover Casino</p>

			<p class="ss-lead" style="--d: 3">{t('Guess your way through four cards:')}</p>

			<!-- The four picks, using the SAME controls as the board (ChoiceIcon,
			     and the same half/third/quad button shapes) so the start screen
			     teaches the actual interface rather than an illustration of it.
			     Hover, focus or tap a pick to see a worked example underneath. -->
			<ol class="ss-steps">
				<!-- 1: colour of card 1 -->
				<li class="ss-step" style="--d: 4">
					<span class="ss-step-n">1</span>
					{@render help('Guess the color of card 1: red or black.')}
					<span class="ss-step-label">{t('Color')}</span>

					<div class="choice-square color-square" role="group" onmouseleave={() => (hover.color = null)} aria-label={t('Pick a color')}>
						<button
							type="button" class="half-btn black-half" class:selected={locked.color === 'black'}
							aria-label={t('Black')}
							onmouseenter={() => (hover.color = 'black')} onfocus={() => (hover.color = 'black')}
							onclick={() => lock('color', 'black')}
						></button>
						<button
							type="button" class="half-btn red-half" class:selected={locked.color === 'red'}
							aria-label={t('Red')}
							onmouseenter={() => (hover.color = 'red')} onfocus={() => (hover.color = 'red')}
							onclick={() => lock('color', 'red')}
						></button>
					</div>

					<div class="ss-demo">
						{@render card('K', demo.color === 'black' ? '♠' : '♥', demo.color === 'red')}
						<span class="ss-mark ok">✓</span>
						{@render card('K', demo.color === 'black' ? '♥' : '♠', demo.color === 'black')}
						<span class="ss-mark no">✕</span>
					</div>
				</li>

				<!-- 2: higher, lower or equal against card 1 -->
				<li class="ss-step" style="--d: 5">
					<span class="ss-step-n">2</span>
					{@render help('Guess whether card 2 is higher or lower than card 1, or equal to it.')}
					<span class="ss-step-label">{t('Higher')} / {t('Lower')}</span>

					<div class="choice-square hl-square" role="group" onmouseleave={() => (hover.hl = null)} aria-label={t('Higher, lower, or equal')}>
						<button
							type="button" class="third-btn higher-third" class:selected={locked.hl === 'higher'}
							aria-label={t('Higher')}
							onmouseenter={() => (hover.hl = 'higher')} onfocus={() => (hover.hl = 'higher')}
							onclick={() => lock('hl', 'higher')}
						><ChoiceIcon name="triangleUp" /></button>
						<button
							type="button" class="third-btn lower-third" class:selected={locked.hl === 'lower'}
							aria-label={t('Lower')}
							onmouseenter={() => (hover.hl = 'lower')} onfocus={() => (hover.hl = 'lower')}
							onclick={() => lock('hl', 'lower')}
						><ChoiceIcon name="triangleDown" /></button>
						<button
							type="button" class="equal-btn" class:selected={locked.hl === 'equal'}
							aria-label={t('Equal')}
							onmouseenter={() => (hover.hl = 'equal')} onfocus={() => (hover.hl = 'equal')}
							onclick={() => lock('hl', 'equal')}
						><ChoiceIcon name="equals" /></button>
					</div>

					<div class="ss-demo">
						{@render card(HL_REF.rank, HL_REF.suit, HL_REF.red)}
						<span class="ss-arrow">→</span>
						{@render card(HL_RESULT[demo.hl].rank, HL_RESULT[demo.hl].suit, HL_RESULT[demo.hl].red)}
						<span class="ss-mark ok">✓</span>
					</div>
				</li>

				<!-- 3: inside, outside or equal against cards 1 and 2 -->
				<li class="ss-step" style="--d: 6">
					<span class="ss-step-n">3</span>
					{@render help('Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either of the first 2 cards. If you pick Equal on step 2, Inside becomes impossible: nothing can fall between two cards of the same rank.')}
					<span class="ss-step-label">{t('Inside')} / {t('Outside')}</span>

					<div class="choice-square io-square" role="group" onmouseleave={() => (hover.io = null)} aria-label={t('Inside, outside, or equal')}>
						<button
							type="button" class="half-btn inside-half" class:selected={locked.io === 'inside'}
							aria-label={t('Inside')}
							onmouseenter={() => (hover.io = 'inside')} onfocus={() => (hover.io = 'inside')}
							onclick={() => lock('io', 'inside')}
						><ChoiceIcon name="inside" /></button>
						<button
							type="button" class="half-btn outside-half" class:selected={locked.io === 'outside'}
							aria-label={t('Outside')}
							onmouseenter={() => (hover.io = 'outside')} onfocus={() => (hover.io = 'outside')}
							onclick={() => lock('io', 'outside')}
						><ChoiceIcon name="outside" /></button>
						<button
							type="button" class="equal-btn" class:selected={locked.io === 'equal'}
							aria-label={t('Equal')}
							onmouseenter={() => (hover.io = 'equal')} onfocus={() => (hover.io = 'equal')}
							onclick={() => lock('io', 'equal')}
						><ChoiceIcon name="equals" /></button>
					</div>

					<!-- is-wide: this step carries three cards, or four on Equal, so its
					     minis are a shade narrower than the other panels'. -->
					<div class="ss-demo is-wide">
						{@render card(IO_LOW.rank, IO_LOW.suit, IO_LOW.red)}
						{@render card(IO_HIGH.rank, IO_HIGH.suit, IO_HIGH.red)}
						<span class="ss-arrow">→</span>
						{#if demo.io === 'equal'}
							{#each IO_EQUAL_RESULTS as result, i}
								{#if i > 0}<span class="ss-or">/</span>{/if}
								{@render card(result.rank, result.suit, result.red)}
							{/each}
						{:else}
							{@render card(IO_RESULT[demo.io].rank, IO_RESULT[demo.io].suit, IO_RESULT[demo.io].red)}
						{/if}
						<span class="ss-mark ok">✓</span>
					</div>
				</li>

				<!-- 4: suit of card 4 -->
				<li class="ss-step" style="--d: 7">
					<span class="ss-step-n">4</span>
					{@render help('Guess the suit of card 4: hearts, diamonds, clubs or spades.')}
					<span class="ss-step-label">{t('Suit')}</span>

					<div class="choice-square suit-square" role="group" onmouseleave={() => (hover.suit = null)} aria-label={t('Pick a suit')}>
						{#each ['heart', 'spade', 'club', 'diamond'] as suit}
							<button
								type="button" class="quad-btn" class:red-suit={SUIT_GLYPH[suit].red}
								class:selected={locked.suit === suit} aria-label={t(SUIT_GLYPH[suit].label)}
								onmouseenter={() => (hover.suit = suit)} onfocus={() => (hover.suit = suit)}
								onclick={() => lock('suit', suit)}
							><SuitIcon {suit} /></button>
						{/each}
					</div>

					<div class="ss-demo">
						{@render card('A', SUIT_GLYPH[demo.suit].glyph, SUIT_GLYPH[demo.suit].red)}
						<span class="ss-mark ok">✓</span>
					</div>
				</li>
			</ol>

			<div class="ss-stats" style="--d: 8">
				<div class="ss-stat">
					<span class="ss-stat-val">{(gameConfig.rtp * 100).toFixed(2)}%</span>
					<span class="ss-stat-cap">{t('RTP')}</span>
				</div>
				<div class="ss-stat">
					<!-- The biggest figure ANY mode can reach, from FAMILY_RULES rather
					     than typed out. It read 1,354.2x - Classic's ceiling - on a
					     screen shown before a mode is chosen, so it understated the
					     game by the whole of High Stakes. -->
					<span class="ss-stat-val">{maxWinOverall.toLocaleString()}×</span>
					<span class="ss-stat-cap">{t('Max Win')}</span>
				</div>
			</div>

			<button class="ss-continue" style="--d: 9" onclick={props.oncontinue}>
				{t('Tap to continue')}
			</button>
		</div>

	{:else if props.phase === 'replay-info'}
		<!-- ---- Replay info popup (over the start screen) ---- -->
		<div class="ss-overlay" style={`--logo-url: url(${base}/logo.png)`}>
			<!-- Card underneath so the start screen is visible behind -->
			<div class="ss-card" aria-hidden="true" style="opacity: 0.55; pointer-events: none">
				<div class="ss-logo"></div>
				<h1 class="ss-title">Ride The Bus</h1>
			</div>
		</div>

		<div class="ss-popup-backdrop">
			<div class="ss-popup" role="dialog" aria-label={t('Round details')}>
				<div class="ss-popup-head">
					<span>{t('Round details')}</span>
				</div>

				<div class="ss-detail-row">
					<span class="ss-detail-cap">{t('Play amount')}</span>
					<span class="ss-detail-val">
						{props.betAmount > 0 ? numberToCurrencyString(props.betAmount) : '—'}
					</span>
				</div>

				<div class="ss-detail-row">
					<span class="ss-detail-cap">{t('Game mode')}</span>
					<span class="ss-detail-val">{modeFamilyLabel(props.mode)}</span>
				</div>

				<div class="ss-detail-row">
					<span class="ss-detail-cap">{t('Guesses')}</span>
					<span class="ss-choices">
						{#each modeBadges(props.mode) as badge}
							<span class="ss-choice-badge {badge.cssClass}">{badge.label}</span>
						{/each}
					</span>
				</div>

				<div class="ss-detail-row">
					<span class="ss-detail-cap">{t('Event')}</span>
					<span class="ss-detail-val">#{props.eventId}</span>
				</div>

				{#if props.payoutMultiplier !== null}
					<div class="ss-detail-row">
						<span class="ss-detail-cap">{t('Payout')}</span>
						<span class="ss-detail-val">{props.payoutMultiplier.toFixed(1)}×</span>
					</div>
				{/if}

				<button class="ss-play-btn" onclick={props.onplay}>
					{t('Play')}
					<svg class="ss-play-tri" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
						<path d="M1 1.2 11 7 1 12.8Z" />
					</svg>
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	@import '../styles/start-screen.css';
	/* The board's guess controls, imported so this screen shows the REAL thing
	   rather than a lookalike - see the note by .ss-step in start-screen.css.
	   choices.css is sized entirely off custom properties, which .ss-step
	   declares at start-screen scale. */
	@import '../styles/choices.css';
</style>
