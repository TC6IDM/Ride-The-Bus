/**
 * Stub board state — this game has no reel board. The original was inherited
 * from the slot template and built a 5×3 grid with cascading reels, scatter
 * counters and multiplier symbols, none of which this card game ever rendered.
 *
 * The two no-op methods (preSpin / settle) keep actor.ts's lifecycle hooks
 * from throwing. GameType stays 'basegame' because the type is derived from
 * config.paddingReels and is required by the SDK's context plumbing.
 */

export const stateGame = $state({
	board: [] as any[],
	gameType: 'basegame' as const,
	multiplierBoard: [] as any[],
	scatterCounter: 0,
});

export const stateGameDerived = {
	enhancedBoard: {
		preSpin: async (_: any) => {},
		settle: () => {},
	},
	boardLayout: () => ({
		x: 0,
		y: 0,
		anchor: { x: 0.5, y: 0.5 },
		pivot: { x: 0, y: 0 },
		width: 0,
		height: 0,
	}),
	boardRaw: () => [],
	scatterLandIndex: () => 1,
	getWinLevelDataByWinLevelAlias: () => ({}),
};
