<!-- The round-details panel shown before a replay plays.

     Split out of StartScreen.svelte alongside IntroPanels.svelte. This is what
     Stake's Fairness view opens on: the stake, the mode, the four guesses and
     the payout of a round that has already been settled, with a Play button
     that starts the reveal.

     Styles are styles/replay-details.css, scoped here. -->
<script lang="ts">
	import { logoAsset } from '../../game/ui/logoAsset.svelte';
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

		<!-- ---- Replay info popup (over the start screen) ---- -->
		<div class="ss-overlay" style={`--logo-url: url(${logoAsset.url})`}>
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
						{betAmount > 0 ? numberToCurrencyString(betAmount) : '—'}
					</span>
				</div>

				<div class="ss-detail-row">
					<span class="ss-detail-cap">{t('Game mode')}</span>
					<span class="ss-detail-val">{modeFamilyLabel(mode)}</span>
				</div>

				<div class="ss-detail-row">
					<span class="ss-detail-cap">{t('Guesses')}</span>
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
