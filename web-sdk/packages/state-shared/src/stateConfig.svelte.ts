export const stateConfig = $state({
	jurisdiction: {
		socialCasino: false,
		disabledFullscreen: false,
		disabledTurbo: false,
		disabledSuperTurbo: false,
		disabledAutoplay: false,
		disabledSlamstop: false,
		disabledSpacebar: false,
		disabledBuyFeature: false,
		displayNetPosition: false,
		displayRTP: false,
		displaySessionTimer: false,
		minimumRoundDuration: 0,
	},
	betAmountOptions: [1, 5, 25, 50, 75, 100, 200, 500, 800, 1000],
	betMenuOptions: [1, 5, 25, 50, 75, 100, 200, 500, 800, 1000],

	/**
	 * LOCAL ADDITION to the Stake SDK - re-apply if these packages are updated
	 * from upstream.
	 *
	 * /wallet/authenticate returns minBet, maxBet and stepBet alongside
	 * betLevels, and the RGS enforces all three: a bet must sit within
	 * [minBet, maxBet] AND be divisible by stepBet (docs/rgs_docs/RGS.md,
	 * "Bet Levels"). The stock SDK keeps only betLevels and drops these, which
	 * leaves a game with free-form bet entry unable to guarantee a valid
	 * amount - an off-grid bet is rejected with ERR_VAL.
	 *
	 * Held in the RGS's own raw micro-units (6dp: 1_000_000 = 1.00), NOT
	 * divided down like betAmountOptions, so step arithmetic stays in integers
	 * and cannot drift. 0 means "not supplied" - treat as unconstrained.
	 */
	betLimits: { minBet: 0, maxBet: 0, stepBet: 0 },
});
