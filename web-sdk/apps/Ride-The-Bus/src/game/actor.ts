import _ from 'lodash';

import { stateBet } from 'state-shared';
import { checkIsMultipleRevealEvents } from 'utils-book';
import { createPrimaryMachines, createIntermediateMachines, createGameActor } from 'utils-xstate';

import type { Bet } from './typesBookEvent';
import { stateXstateDerived } from './stateXstate';
import { playBet, convertTorResumableBet } from './utils';

const primaryMachines = createPrimaryMachines<Bet>({
	onResumeGameActive: (lastBetData) => convertTorResumableBet(lastBetData),
	onResumeGameInactive: () => {
		// This game has no reel board to settle — the slot template called
		// enhancedBoard.settle() here. The reveal events themselves carry the
		// full outcome, so there is no board state to unwind on resume.
	},
	onNewGameStart: async () => {
		if ((stateBet.isTurbo && stateXstateDerived.isAutoBetting()) || stateBet.isSpaceHold) return;
		stateBet.winBookEventAmount = 0;
		// enhancedBoard.preSpin({}) was a no-op on the fake board — nothing to do.
	},
	onNewGameError: () => {
		// enhancedBoard.settle() was a no-op on the fake board.
	},
	onPlayGame: async (bet) => await playBet(bet),
	checkIsBonusGame: (bet) => checkIsMultipleRevealEvents({ bookEvents: bet.state }),
});

const intermediateMachines = createIntermediateMachines(primaryMachines);

export const gameActor = createGameActor(intermediateMachines);
