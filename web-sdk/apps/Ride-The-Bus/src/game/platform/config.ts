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
	// INERT. Nothing in this app reads it - the sibling template apps derive a
	// type from `config.betModes`, but our types.ts does not, and the live bet
	// modes arrive from the RGS as stateMeta.betModeMeta (192 of them, across
	// three families). Kept only so this config keeps the template's shape.
	//
	// Do not treat the figures below as the game's. Each family declares its own
	// wincap in math-sdk game_calculations.py:MODE_FAMILIES (1400 / 700 / 2000)
	// against true ceilings of 1354.2x / 585.2x / 1910.2x, and the frontend's
	// copy of those lives in game/math/modes.ts:FAMILY_RULES.
	betModes: {
		base: {
			cost: 1.0,
			feature: true,
			buyBonus: false,
			rtp: 0.96,
			max_win: 1400,
		},
	},
	// Minimal stubs replacing the slot-template symbol/paddingReels data. This
	// game has no reels or game-type variants — the original was load-bearing
	// only for types that no code now reads.
	symbols: {
		CARD: { paytable: null },
	},
	paddingReels: {
		basegame: '',
	},
};
