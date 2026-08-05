import _ from 'lodash';
import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';

import { eventEmitter } from './eventEmitter';
import type { Bet } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';

// Book-event utilities
export const { playBookEvent, playBookEvents } = createPlayBookUtils({ bookEventHandlerMap });

export const playBet = async (bet: Bet) => {
	stateBet.winBookEventAmount = 0;
	await playBookEvents(bet.state);
	eventEmitter.broadcast({ type: 'stopButtonEnable' });
};

/**
 * Trim a partly-played round down to the events still to come.
 *
 * The slot template this came from also prepended a synthetic
 * `createBonusSnapshot` event carrying the bonus state accumulated before the
 * resume point — global multiplier, free-spin counters, running total. None of
 * that exists here: this game's book events are `reveal` and `finalWin` only,
 * so the four types it collected for the snapshot could never match anything,
 * the snapshot was always empty, and no handler in bookEventHandlerMap.ts would
 * have processed it if it had not been.
 *
 * Dropping it changes nothing at runtime and lets the types describe what the
 * function really does.
 */
export const convertTorResumableBet = (lastBetData: Bet) => {
	const resumingIndex = Number(lastBetData.event);
	const bookEventsAfterResume = lastBetData.state.filter(
		(_, eventIndex) => eventIndex >= resumingIndex,
	);

	return { ...lastBetData, state: bookEventsAfterResume };
};
