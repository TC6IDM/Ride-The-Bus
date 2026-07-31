export default {
	// Was 'sample_provider' - SDK template boilerplate. Must name the real
	// operator before submission; it identifies the game's provider.
	providerName: 'Takeover Casino',
	gameName: 'Ride The Bus',
	gameID: 'ride_the_bus',
	// Single published RTP every bet mode is reweighted onto - see math-sdk
	// games/ride_the_bus/game_config.py:rtp and reweight_luts.py. Keep both in
	// step; 0.96 sits inside Stake's 90%-96.70% band with headroom below the top.
	rtp: 0.96,
	betModes: {
		base: {
			cost: 1.0,
			feature: true,
			buyBonus: false,
			rtp: 0.96,
			// Keep in step with math-sdk games/ride_the_bus/game_config.py:wincap.
			// The game's true ceiling is 1354.2x (proven by exhaustive
			// enumeration - see that file), so 1400 never binds.
			max_win: 1400,
		},
	},
	// DO NOT DELETE: symbols/paddingReels describe a reel board this game does
	// not have (it was forked from the slot template), but they are load-bearing
	// types, not dead data. game/types.ts derives SymbolName from `symbols` and
	// GameType from `paddingReels`; those types flow through constants.ts /
	// utils.ts / stateGame into game/context.ts, whose setContext() call in
	// +layout.svelte provides the layout and event-emitter contexts that the
	// SDK's <Modals> requires - ModalBuyBonus and ModalSettingsSound call
	// getContextLayout() / getContextEventEmitter() on mount even though this
	// game never opens them. Removing these fields breaks the error modal.
	// (numReels / numRows were genuinely unread and have been removed.)
	symbols: {
		W: {
			paytable: null,
			special_properties: ['wild'],
		},
		H4: {
			paytable: [
				{
					'5': 3,
				},
				{
					'4': 1,
				},
				{
					'3': 0.5,
				},
			],
		},
		H5: {
			paytable: [
				{
					'5': 2,
				},
				{
					'4': 0.8,
				},
				{
					'3': 0.4,
				},
			],
		},
		S: {
			paytable: null,
			special_properties: ['scatter'],
		},
		L1: {
			paytable: [
				{
					'5': 2,
				},
				{
					'4': 0.8,
				},
				{
					'3': 0.4,
				},
			],
		},
		L2: {
			paytable: [
				{
					'5': 1.5,
				},
				{
					'4': 0.5,
				},
				{
					'3': 0.2,
				},
			],
		},
		L3: {
			paytable: [
				{
					'5': 1.5,
				},
				{
					'4': 0.5,
				},
				{
					'3': 0.2,
				},
			],
		},
		L4: {
			paytable: [
				{
					'5': 1,
				},
				{
					'4': 0.3,
				},
				{
					'3': 0.1,
				},
			],
		},
		H3: {
			paytable: [
				{
					'5': 5,
				},
				{
					'4': 2,
				},
				{
					'3': 1,
				},
			],
		},
		H2: {
			paytable: [
				{
					'5': 8,
				},
				{
					'4': 4,
				},
				{
					'3': 2,
				},
			],
		},
		H1: {
			paytable: [
				{
					'5': 10,
				},
				{
					'4': 5,
				},
				{
					'3': 3,
				},
			],
		},
	},
	paddingReels: {
		basegame: '',
		freegame: '',
		superspingame: '',
	},
};
