<!-- The round-details panel shown before a replay plays.

     Split out of StartScreen.svelte alongside IntroPanels.svelte. This is what
     Stake's Fairness view opens on: the stake, the mode, the four guesses and
     the payout of a round that has already been settled, with a Play button
     that starts the reveal.

     Styles are styles/replay-details.css, scoped here. -->
<script lang="ts">
	import { numberToCurrencyString } from 'utils-shared/amount';
	import { t } from '../../i18n/i18nDerived';
	import { FAMILY_RULES, familyOf, parseModeName } from '../../game/math/modes';

	let {
		mode,
		betAmount,
		eventId,
		payoutMultiplier,
		onplay,
	}: {
		/** Bet mode string, e.g. "red_higher_inside_heart". */
		mode: string;
		/** Bet amount in display units. */
		betAmount: number;
		/** Replay event ID. */
		eventId: string;
		/** Payout multiplier from the replay RGS response, or null if not yet known. */
		payoutMultiplier: number | null;
		onplay: () => void;
	} = $props();

	/**
	 * The tokens a replayed round was placed on, as badges - one per stage.
	 *
	 * Parsed through parseModeName so the family prefix comes off first. The old
	 * version split on "_" and bailed unless it found exactly four parts, which
	 * every Second Chance and High Stakes mode fails - "sc_red_higher_equal_spade"
	 * has five - so those rounds printed the raw slug instead of their picks.
	 *
	 * Walks `parsed.choices`, the whole tuple, rather than the four named fields:
	 * Three of a Kind deals three cards, so its slug has three tokens and its
	 * `suit` is null. Reading the four fields drew a fourth, empty badge on every
	 * trips replay. The stage decides the colour class - a colour badge, a pick
	 * badge, a suit badge - because the same token ("equal") means a different
	 * control at stages 2 and 3, and the class is what the stylesheet keys on.
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
		// Three of a Kind's dealt card: no guess was made, and the badge says so.
		any: 'Any',
	} as const;

	/** The class family for each stage of the slug: colour, pick, pick, suit. */
	const STAGE_CLASS = ['color', 'choice', 'choice', 'suit'] as const;

	function modeBadges(mode: string): { label: string; cssClass: string }[] {
		const parsed = parseModeName(mode);
		if (!parsed) return [{ label: mode, cssClass: '' }];
		return parsed.choices.map((token, stage) => ({
			label: t(CHOICE_LABEL[token]),
			cssClass: `${STAGE_CLASS[stage]}-${token}`,
		}));
	}

	/** The family the replayed round was played on - its rules, for the rows below. */
	const family = $derived(parseModeName(mode)?.family ?? familyOf(mode));
	const rules = $derived(FAMILY_RULES[family]);

</script>

		<!-- ---- Replay info popup (over the start screen) ----
		     NO OVERLAY OF ITS OWN. This used to wrap the lockup below in a second
		     .ss-overlay - position: fixed, inset: 0, painted --felt-edge, opaque -
		     stacked on top of the shell's. StartScreen.svelte mounts a TableScene
		     into ITS overlay "so the first thing a player sees is the place", and
		     on the replay path that table was dead paint under this wrapper: the
		     round-details panel, which is what Stake's Fairness view opens on, sat
		     on a black screen. The shell's overlay already carries --logo-url,
		     the unit and the ink; this component is its child and inherits all
		     three. -->
		<!-- The lockup, dimmed, so the details read as a card on the table
		     rather than a form on a page. -->
		<div class="ss-card" aria-hidden="true" style="opacity: 0.55; pointer-events: none">
			<div class="ss-logo"></div>
			<h1 class="ss-title">Ride The Bus</h1>
		</div>

		<div class="ss-popup-backdrop">
			<div class="ss-popup" role="dialog" aria-label={t('Round details')}>
				<div class="ss-popup-head">
					<span>{t('Round details')}</span>
				</div>

				<div class="ss-detail-row">
					<span class="ss-detail-cap">{t('Play amount')}</span>
					<span class="ss-detail-val">
						{betAmount > 0 ? numberToCurrencyString(betAmount) : '–'}
					</span>
				</div>

				<!-- What the round actually cost, on a mode that multiplies the bet.
				     Stake's replay checklist asks for "bet cost and applied multiplier"
				     to be clearly displayed, and the play amount above is the BASE
				     bet - on Three of a Kind the round took 250 times that. Read from
				     FAMILY_RULES, the same figure the bar's second line and the mode
				     confirmation print, so the three cannot disagree. -->
				{#if rules.cost !== 1}
					<div class="ss-detail-row">
						<span class="ss-detail-cap">{t('Round cost')}</span>
						<span class="ss-detail-val">
							{betAmount > 0 ? numberToCurrencyString(betAmount * rules.cost) : '–'} (×{rules.cost})
						</span>
					</div>
				{/if}

				<div class="ss-detail-row">
					<span class="ss-detail-cap">{t('Game mode')}</span>
					<span class="ss-detail-val">{t(rules.label)}</span>
				</div>

				<!-- "Cards", not "Guesses", on a family with no guesses: Three of a
				     Kind's tokens say what each card had to be, and nobody picked them. -->
				<div class="ss-detail-row">
					<span class="ss-detail-cap">{rules.fixedChoices ? t('Cards') : t('Guesses')}</span>
					<span class="ss-choices">
						{#each modeBadges(mode) as badge}
							<span class="ss-choice-badge {badge.cssClass}">{badge.label}</span>
						{/each}
					</span>
				</div>

				<div class="ss-detail-row">
					<span class="ss-detail-cap">{t('Event')}</span>
					<span class="ss-detail-val">#{eventId}</span>
				</div>

				{#if payoutMultiplier !== null}
					<div class="ss-detail-row">
						<span class="ss-detail-cap">{t('Payout')}</span>
						<span class="ss-detail-val">{payoutMultiplier.toFixed(1)}×</span>
					</div>
				{/if}

				<button class="ss-play-btn" onclick={onplay}>
					{t('Play')}
					<svg class="ss-play-tri" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
						<path d="M1 1.2 11 7 1 12.8Z" />
					</svg>
				</button>
			</div>
		</div>

<style>
	@import '../../styles/intro/replay-details.css';
</style>
