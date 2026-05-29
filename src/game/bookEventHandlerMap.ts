import _ from 'lodash';

import { recordBookEvent, checkIsMultipleRevealEvents, type BookEventHandlerMap } from 'utils-book';
import { stateBet } from 'state-shared';
import { sequence } from 'utils-shared/sequence';

import { eventEmitter } from './eventEmitter';
import { playBookEvent, playBookEvents } from './utils';
import { waitForChoice } from './engineChoice';
import { winLevelMap, type WinLevel, type WinLevelData } from './winLevelMap';
import { stateGame, stateGameDerived } from './stateGame.svelte';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';
import type { Position } from './types';

const winLevelSoundsPlay = ({ winLevelData }: { winLevelData: WinLevelData }) => {
	if (winLevelData?.alias === 'max') eventEmitter.broadcastAsync({ type: 'uiHide' });
	if (winLevelData?.sound?.sfx) {
		eventEmitter.broadcast({ type: 'soundOnce', name: winLevelData.sound.sfx });
	}
	if (winLevelData?.sound?.bgm) {
		eventEmitter.broadcast({ type: 'soundMusic', name: winLevelData.sound.bgm });
	}
	if (winLevelData?.type === 'big') {
		eventEmitter.broadcast({ type: 'soundLoop', name: 'sfx_bigwin_coinloop' });
	}
};

const winLevelSoundsStop = () => {
	eventEmitter.broadcast({ type: 'soundStop', name: 'sfx_bigwin_coinloop' });
	if (stateBet.activeBetModeKey === 'SUPERSPIN' || stateGame.gameType === 'freegame') {
		// check if SUPERSPIN, when finishing a bet.
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_freespin' });
	} else {
		eventEmitter.broadcast({ type: 'soundMusic', name: 'bgm_main' });
	}
	eventEmitter.broadcastAsync({ type: 'uiShow' });
};

const animateSymbols = async ({ positions }: { positions: Position[] }) => {
	eventEmitter.broadcast({ type: 'boardShow' });
	await eventEmitter.broadcastAsync({
		type: 'boardWithAnimateSymbols',
		symbolPositions: positions,
	});
};

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {

	reveal: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		const isBonusGame = checkIsMultipleRevealEvents({ bookEvents });
		if (isBonusGame) {
			eventEmitter.broadcast({ type: 'stopButtonEnable' });
			recordBookEvent({ bookEvent });
		}

		// broadcast raw reveal so UI can update
		await eventEmitter.broadcastAsync({ type: 'engineReveal', data: bookEvent });

		// if the reveal requires player input (server indicates via awaitChoice flag), wait for it
		// NOTE: 'awaitChoice' is an optional flag in bookEvent schema used by interactive books
		if ((bookEvent as any).awaitChoice) {
			eventEmitter.broadcast({ type: 'engineAwaitChoice', data: { index: bookEvent.index, payouts: (bookEvent as any).payouts ?? (bookEvent as any).multipliers ?? (bookEvent as any).options } });
			const choice = await waitForChoice(bookEvent.index);
			// record the player's input event with the server so the engine advances and return any new state
			const res = await recordBookEvent({ bookEvent, choice });
			// If the engine returned an updated round/state, continue playing those events
			if (res) {
				const anyRes: any = res;
				const maybeActionState = anyRes?.action?.state || anyRes?.round?.state || anyRes?.state;
				if (Array.isArray(maybeActionState) && maybeActionState.length > 0) {
					await playBookEvents(maybeActionState as any);
				}
			}
		}
	},

	winInfo: async (bookEvent: BookEventOfType<'reveal'>, { bookEvents }: BookEventContext) => {
		await eventEmitter.broadcastAsync({ type: 'winInfo', data: bookEvent });
	},
	finalWin: async (bookEvent: BookEventOfType<'winInfo'>) => {
		await eventEmitter.broadcastAsync({ type: 'finalWin', data: bookEvent });
	},
};
