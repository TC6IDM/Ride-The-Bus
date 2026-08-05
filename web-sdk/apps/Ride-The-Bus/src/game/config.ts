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
