<script lang="ts">
	import { base } from '$app/paths';
	import { numberToCurrencyString } from 'utils-shared/amount';
	import { t } from '../i18n/i18nDerived';
	import gameConfig from '../game/config';

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
	function modeBadges(mode: string): { label: string; cssClass: string }[] {
		const parts = mode.split('_');
		if (parts.length !== 4) return [{ label: mode, cssClass: '' }];
		const [color, hl, io, suit] = parts;
		return [
			{ label: color, cssClass: `color-${color}` },
			{ label: hl, cssClass: `choice-${hl}` },
			{ label: io, cssClass: `choice-${io}` },
			{ label: suit, cssClass: `suit-${suit}` },
		];
	}
</script>

<div class="ss-overlay" style={`--logo-url: url(${base}/logo.png)`}>
	{#if props.phase === 'start'}
		<!-- ---- Start / intro screen ---- -->
		<div class="ss-card">
			<div class="ss-logo" aria-hidden="true"></div>
			<h1 class="ss-title">Ride The Bus</h1>
			<p class="ss-subtitle">by Takeover Casino</p>

			<p class="ss-rules">
				{t('Guess your way through four cards:')}<br />
				{t('Colour — red or black for card 1.')}<br />
				{t('Higher / Lower — versus card 1 (or =).')}<br />
				{t('Inside / Outside — between cards 1 & 2 (or =).')}<br />
				{t('Suit — the suit of card 4.')}
			</p>

			<div class="ss-stats">
				<div class="ss-stat">
					<span class="ss-stat-val">{(gameConfig.rtp * 100).toFixed(2)}%</span>
					<span class="ss-stat-cap">{t('RTP')}</span>
				</div>
				<div class="ss-stat">
					<span class="ss-stat-val">1,354.2×</span>
					<span class="ss-stat-cap">{t('Max Win')}</span>
				</div>
			</div>

			<button class="ss-continue" onclick={props.oncontinue}>
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
					<span class="ss-detail-cap">{t('Mode')}</span>
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
					{t('Play')} ▶
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	@import '../styles/start-screen.css';
</style>
