export default {
	providerName: 'sample_provider',
	gameName: 'Ride The Bus',
	gameID: 'ride_the_bus',
	rtp: 0.98,
	numReels: 5,
	numRows: [3, 3, 3, 3, 3],
	houseEdge: 0.02,
	betModes: {
		base: {
			cost: 1.0,
			feature: true,
			buyBonus: false,
			rtp: 0.98,
			max_win: 500,
		},
	},
	// NOTE: symbols/paddingReels below are unused leftovers from the slot
	// template this app was forked from. Ride The Bus has no board/reels;
	// they're kept only because game/types.ts derives SymbolName/GameType
	// from them and other dead slot-scaffolding files reference those types.
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
