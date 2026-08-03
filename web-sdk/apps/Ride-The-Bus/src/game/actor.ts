import _ from 'lodash';

import { stateBet } from 'state-shared';
import { checkIsMultipleRevealEvents } from 'utils-book';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet } from './typesBookEvent';
import { stateXstateDerived } from './stateXstate';
import { playBet, convertTorResumableBet } from './utils';
import { stateGameDerived } from './stateGame.svelte';

const primaryMachines = createPrimaryMachines<Bet>({
	onResumeGameActive: (lastBetData) => convertTorResumableBet(lastBetData),
	onResumeGameInactive: (lastBetData) => {
		const lastRevealEvent = _.findLast(
			lastBetData.state,
			(emitterEvent) => emitterEvent?.type === 'reveal',
		);

			// settle() with no board, unlike the slot template this came from.
			// A reveal event here carries a Card, never a reel board - the
			// property simply does not exist on the union in typesBookEvent.ts,
			// so `lastRevealEvent.board` has always been undefined at runtime
			// and this is what it was already doing.
			if (lastRevealEvent) stateGameDerived.enhancedBoard.settle();
	},
	onNewGameStart: async () => {
		if ((stateBet.isTurbo && stateXstateDerived.isAutoBetting()) || stateBet.isSpaceHold) return;
		stateBet.winBookEventAmount = 0;
		await stateGameDerived.enhancedBoard.preSpin({});
	},
	onNewGameError: () => stateGameDerived.enhancedBoard.settle(),
	onPlayGame: async (bet) => await playBet(bet),
	checkIsBonusGame: (bet) => checkIsMultipleRevealEvents({ bookEvents: bet.state }),
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);
