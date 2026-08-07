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

			<ol class="ss-steps">
				<!-- 1: colour of card 1 -->
				<li class="ss-step" style="--d: 4">
					<span class="ss-step-n">1</span>
					<span class="ss-step-art" aria-hidden="true">
						<span class="ss-mini-card">
							<span class="ss-halfsplit"></span>
						</span>
					</span>
					<span class="ss-step-label">{t('Color')}</span>
				</li>

				<!-- 2: higher or lower than card 1 -->
				<li class="ss-step" style="--d: 5">
					<span class="ss-step-n">2</span>
					<span class="ss-step-art" aria-hidden="true">
						<span class="ss-arrows">
							<span class="ss-arrow up">▲</span>
							<span class="ss-arrow down">▼</span>
						</span>
					</span>
					<span class="ss-step-label">{t('Higher')} / {t('Lower')}</span>
				</li>

				<!-- 3: inside or outside cards 1 and 2 -->
				<li class="ss-step" style="--d: 6">
					<span class="ss-step-n">3</span>
					<span class="ss-step-art" aria-hidden="true">
						<span class="ss-range">
							<span class="ss-range-pip"></span>
							<span class="ss-range-bar"></span>
							<span class="ss-range-pip"></span>
						</span>
					</span>
					<span class="ss-step-label">{t('Inside')} / {t('Outside')}</span>
				</li>

				<!-- 4: suit of card 4 -->
				<li class="ss-step" style="--d: 7">
					<span class="ss-step-n">4</span>
					<span class="ss-step-art" aria-hidden="true">
						<span class="ss-suits">
							<span class="ss-suit red">♥</span>
							<span class="ss-suit red">♦</span>
							<span class="ss-suit">♣</span>
							<span class="ss-suit">♠</span>
						</span>
					</span>
					<span class="ss-step-label">{t('Suit')}</span>
				</li>
			</ol>

			<div class="ss-stats" style="--d: 8">
				<div class="ss-stat">
					<span class="ss-stat-val">{(gameConfig.rtp * 100).toFixed(2)}%</span>
					<span class="ss-stat-cap">{t('RTP')}</span>
				</div>
				<div class="ss-stat">
					<span class="ss-stat-val">1,354.2×</span>
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
