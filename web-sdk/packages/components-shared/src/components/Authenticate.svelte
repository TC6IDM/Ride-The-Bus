<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	import { requestAuthenticate, requestReplay } from 'rgs-requests';
	import { stateUrlDerived, stateBet, stateConfig, stateModal, stateUi } from 'state-shared';
	import { API_AMOUNT_MULTIPLIER, MOST_USED_BET_INDEXES } from 'constants-shared/bet';

	type Props = { children: Snippet };

	const props: Props = $props();

	let authenticated = $state(false);

	/**
	 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated
	 * from upstream. The fetcher has no timeout, so an RGS host that accepts
	 * the connection and never answers left `authenticated` false forever:
	 * the game's loader fades out on its own clock and the player is left on
	 * an empty table with no error, because the error modal renders inside
	 * the children this component has not mounted. A rejected fetch already
	 * lands in the catch below and shows the modal; this makes a hang do the
	 * same. Only the two launch requests are raced - a timed-out /wallet/play
	 * would be far worse than a slow one, and those go through rgs-requests
	 * untouched. Promise.race rather than AbortSignal.timeout, which iOS < 16
	 * lacks. Kept just UNDER GameLoader's MAX_MS ceiling, so the modal is on
	 * screen when the loader hands over rather than after an empty table.
	 */
	const LAUNCH_TIMEOUT_MS = 10_000;
	const withLaunchTimeout = <T,>(request: Promise<T>): Promise<T> =>
		new Promise<T>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error('The game server did not respond. Please reload.')),
				LAUNCH_TIMEOUT_MS,
			);
			request.then(resolve, reject).finally(() => clearTimeout(timer));
		});

	const authenticate = async () => {
		try {
			const authenticateData = await withLaunchTimeout(requestAuthenticate({
				rgsUrl: stateUrlDerived.rgsUrl(),
				sessionID: stateUrlDerived.sessionID(),
				language: stateUrlDerived.lang(),
			}));

			// error
			if (authenticateData?.error) throw authenticateData;

			// balance
			if (authenticateData?.balance) {
				// Example of authenticateData.balance
				// {
				// 		"amount": 10000000000000000,
				// 		"currency": "USD"
				// },
				stateBet.currency = authenticateData.balance.currency;
				stateBet.balanceAmount = authenticateData.balance.amount / API_AMOUNT_MULTIPLIER;
			}

			// config
			if (authenticateData?.config) {
				// Example of authenticateData.config
				// {
				// 	"gameID": "37_test-lines",
				// 	"minBet": 100000,
				// 	"maxBet": 1000000000,
				// 	"stepBet": 10000,
				// 	"defaultBetLevel": 1000000,
				// 	"betLevels": [100000, 200000, ..., 1000000000],
				// 	"betModes": {},
				// 	"jurisdiction": {
				// 			"socialCasino": false,
				// 			"disabledFullscreen": false,
				// 			"disabledTurbo": false,
				// 			"disabledSuperTurbo": false,
				// 			"disabledAutoplay": false,
				// 			"disabledSlamstop": false,
				// 			"disabledSpacebar": false,
				// 			"disabledBuyFeature": false,
				// 			"displayNetPosition": false,
				// 			"displayRTP": false,
				// 			"displaySessionTimer": false,
				// 			"minimumRoundDuration": 0
				// 	}
				// }
				stateConfig.jurisdiction = authenticateData?.config?.jurisdiction;
				// LOCAL ADDITION to the Stake SDK - re-apply if this package is
				// updated from upstream. The RGS enforces minBet/maxBet/stepBet
				// (see stateConfig.betLimits); keeping only betLevels leaves a
				// game unable to guarantee a bet the RGS will accept. Stored raw,
				// in micro-units, exactly as returned.
				stateConfig.betLimits = {
					minBet: Number(authenticateData.config?.minBet) || 0,
					maxBet: Number(authenticateData.config?.maxBet) || 0,
					stepBet: Number(authenticateData.config?.stepBet) || 0,
				};
				stateConfig.betAmountOptions = (authenticateData.config?.betLevels || []).map(
					(level) => level / API_AMOUNT_MULTIPLIER,
				);
				stateConfig.betMenuOptions = stateConfig.betAmountOptions.filter((_, index) =>
					MOST_USED_BET_INDEXES.includes(index),
				);
				// LOCAL ADDITION - see stateConfig.defaultBetAmount.
				stateConfig.defaultBetAmount =
					(Number(authenticateData.config?.defaultBetLevel) || 0) / API_AMOUNT_MULTIPLIER;
			}

			// round
			if (authenticateData?.round) {
				// Example of authenticateData.round 
				// {
				// 	"betID": 62277967,
				// 	"amount": 1000000,
				// 	"payout": 33400000,
				// 	"payoutMultiplier": 33.4,
				// 	"active": true,
				// 	"state": [...],
				// 	"mode": "BONUS",
				// 	"event": null
				// }

				if(authenticateData.round?.state) {
					// @ts-ignore
					stateBet.betToResume =  authenticateData.round;
				}

				if(authenticateData.round?.amount) {
					const betAmountValue =
						authenticateData.round.amount > 0
							? authenticateData.round.amount / API_AMOUNT_MULTIPLIER
							: 0;
					stateBet.betAmount = betAmountValue;
					stateBet.wageredBetAmount = betAmountValue;
				}

				if (authenticateData.round?.mode) {
					stateBet.activeBetModeKey = authenticateData.round.mode;
				};
			}
		} catch (error) {
			// LOCAL CHANGE to the Stake SDK - re-apply if this package is updated
			// from upstream. The stock line logged the whole RGS response object;
			// approval checks the console for "game information being logged", and
			// the error modal already shows the player everything they need.
			console.error('[RideTheBus] request failed:', (error as any)?.message ?? String(error));
			stateModal.modal = { name: 'error', error };
		}
	};

	const handleReplay = async () => {
		try {
			stateBet.betAmount = (stateUrlDerived.amount() / API_AMOUNT_MULTIPLIER) || 0;
			stateBet.wageredBetAmount = (stateUrlDerived.amount() / API_AMOUNT_MULTIPLIER) || 0;
			stateBet.activeBetModeKey = stateUrlDerived.mode();

			// LOCAL ADDITION to the Stake SDK - re-apply if this package is updated
			// from upstream. Replay never calls /wallet/authenticate, so nothing
			// else ever sets the currency and every replay rendered in the default
			// USD regardless of the ?currency= the URL carried. Only assigned when
			// the parameter is present and well-formed, so an absent or junk value
			// keeps the default rather than breaking every amount on screen.
			const replayCurrency = stateUrlDerived.currency();
			if (replayCurrency) stateBet.currency = replayCurrency;

			const data = await withLaunchTimeout(requestReplay({
				rgsUrl: stateUrlDerived.rgsUrl(),
				game: stateUrlDerived.game(),
				mode: stateUrlDerived.mode(),
				version: stateUrlDerived.version(),
				event: stateUrlDerived.event(),
			}));

			if(data) {
				// @ts-ignore
				stateBet.betToResume = {
					...data,
					event: '0',
					active: true,
					mode: stateUrlDerived.mode(),
				};
			}
		} catch (error) {
			// LOCAL CHANGE to the Stake SDK - re-apply if this package is updated
			// from upstream. The stock line logged the whole RGS response object;
			// approval checks the console for "game information being logged", and
			// the error modal already shows the player everything they need.
			console.error('[RideTheBus] request failed:', (error as any)?.message ?? String(error));
			stateModal.modal = { name: 'error', error };
		}
	};

	onMount(async () => {
		if(stateUrlDerived.replay()) {
			stateUi.config.mode = 'replay';
			await handleReplay();
		} else {
			stateUi.config.mode = 'default';
			await authenticate();
		};

		authenticated = true;
	});
</script>

{#if authenticated}
	{@render props.children()}
{/if}
