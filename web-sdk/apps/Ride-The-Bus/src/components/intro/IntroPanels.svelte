<!-- The intro screen: four demo panels a player can actually operate.

     Split out of StartScreen.svelte, which was two unrelated screens sharing a
     file. This is the one shown on a normal load; ReplayDetails.svelte is the
     one shown for ?replay=true. They shared nothing but the phase that chose
     between them - not a snippet, not a helper, not a prop.

     The lookup tables the worked examples are built from live in
     game/introDemo.ts. The styles are styles/intro-panels.css, scoped here:
     see the Svelte scoping note in CLAUDE.md. -->
<script lang="ts">
	import { t } from '../../i18n/i18nDerived';
	import gameConfig from '../../game/platform/config';
	import { FAMILY_RULES, MODE_FAMILIES } from '../../game/math/modes';
	import ChoiceIcon from '../icons/ChoiceIcon.svelte';
	import MarkIcon from '../icons/MarkIcon.svelte';
	import SuitIcon from '../icons/SuitIcon.svelte';
	import {
		DEFAULTS,
		HL_REF,
		HL_RESULT,
		IO_EQUAL_RESULTS,
		IO_HIGH,
		IO_LOW,
		IO_RESULT,
		SUIT_GLYPH,
	} from '../../game/dev/introDemo';

	let { oncontinue }: { oncontinue: () => void } = $props();

	/** The biggest figure any mode can pay - High Stakes', at the time of
	 *  writing. Derived so it cannot drift from the maths. */
	const maxWinOverall = Math.max(...MODE_FAMILIES.map((f) => FAMILY_RULES[f].maxWin));

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

	/**
	 * Which help tip is open, identified by its own text.
	 *
	 * The tips used to open on :hover and :focus-visible alone. Hover is gated
	 * behind `@media (hover: hover)` so it never fires on a phone, and a touch
	 * tap does not produce :focus-visible - that state is reserved for
	 * keyboard-like input. So on every phone the four badges were visible,
	 * focusable, labelled, and did nothing at all when tapped. The sentence
	 * still reached a screen reader through aria-label, which is why this was
	 * invisible to an audit that only read the markup.
	 *
	 * Keyed on the text rather than an index because `help` is a snippet
	 * rendered four times and a snippet cannot hold state of its own.
	 */
	let openTip = $state<string | null>(null);

	/**
	 * Close the open tip on the next click anywhere else. The badge itself stops
	 * propagation, so its own click cannot reach this and close what it just
	 * opened.
	 */
	$effect(() => {
		if (openTip === null) return;
		const close = () => (openTip = null);
		window.addEventListener('click', close);
		return () => window.removeEventListener('click', close);
	});
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
     type="button" so it never submits anything.

     The tip is the badge's SIBLING, not its child, and that is load-bearing
     rather than tidiness. An absolutely positioned box is laid out against its
     nearest positioned ancestor, and inside the button that was the ~20px badge
     - so the tip could be told where to start but never how much room it had,
     and it ran off the screen on the narrow layouts. As a sibling its
     containing block is the step panel, which means a percentage max-width
     resolves against something meaningful: see --tip-room in start-screen.css.

     aria-hidden because the same sentence is already the button's aria-label;
     without it a screen reader reads the explanation twice. -->
{#snippet help(text: Parameters<typeof t>[0])}
	<button
		type="button"
		class="ss-help"
		class:open={openTip === text}
		aria-label={t(text)}
		aria-expanded={openTip === text}
		onclick={(event) => {
			// Stop the window listener above from closing what this opens.
			event.stopPropagation();
			openTip = openTip === text ? null : text;
		}}
	>?</button>
	<span class="ss-tip" aria-hidden="true">{t(text)}</span>
{/snippet}

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
						<span class="ss-mark ok"><MarkIcon name="check" /></span>
						{@render card('K', demo.color === 'black' ? '♥' : '♠', demo.color === 'black')}
						<span class="ss-mark no"><MarkIcon name="cross" /></span>
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
						<span class="ss-arrow"><MarkIcon name="arrow" /></span>
						{@render card(HL_RESULT[demo.hl].rank, HL_RESULT[demo.hl].suit, HL_RESULT[demo.hl].red)}
						<span class="ss-mark ok"><MarkIcon name="check" /></span>
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
						<span class="ss-arrow"><MarkIcon name="arrow" /></span>
						{#if demo.io === 'equal'}
							{#each IO_EQUAL_RESULTS as result, i}
								{#if i > 0}<span class="ss-or">/</span>{/if}
								{@render card(result.rank, result.suit, result.red)}
							{/each}
						{:else}
							{@render card(IO_RESULT[demo.io].rank, IO_RESULT[demo.io].suit, IO_RESULT[demo.io].red)}
						{/if}
						<span class="ss-mark ok"><MarkIcon name="check" /></span>
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
						<span class="ss-mark ok"><MarkIcon name="check" /></span>
					</div>
				</li>
			</ol>

			<div class="ss-stats" style="--d: 8">
				<div class="ss-stat">
					<span class="ss-stat-cap">{t('RTP')}</span>
					<span class="ss-stat-val">{(gameConfig.rtp * 100).toFixed(2)}%</span>
				</div>
				<div class="ss-stat">
					<!-- The biggest figure ANY mode can reach, from FAMILY_RULES rather
					     than typed out. It read 1,354.2x - Classic's ceiling - on a
					     screen shown before a mode is chosen, so it understated the
					     game by the whole of High Stakes. -->
					<span class="ss-stat-cap">{t('Max Win')}</span>
					<span class="ss-stat-val">{maxWinOverall.toLocaleString()}×</span>
				</div>
			</div>

			<button class="ss-continue" style="--d: 9" onclick={oncontinue}>
				{t('Tap to continue')}
			</button>
		</div>

<style>
	@import '../../styles/intro/intro-panels.css';
	/* The four guess controls are the board's own, so they take the board's
	   stylesheet rather than a copy of it. */
	@import '../../styles/board/choices.css';
</style>
