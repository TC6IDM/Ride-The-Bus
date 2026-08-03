import _ from 'lodash';
import { stateBet } from 'state-shared';
import { createPlayBookUtils } from 'utils-book';
import { createGetEmptyPaddedBoard } from 'utils-slots';

import { SYMBOL_SIZE, REEL_PADDING, SYMBOL_INFO_MAP, BOARD_DIMENSIONS } from './constants';
import { eventEmitter } from './eventEmitter';
import type { Bet } from './typesBookEvent';
import { bookEventHandlerMap } from './bookEventHandlerMap';
import type { RawSymbol, SymbolState } from './types';

// general utils
export const { getEmptyBoard } = createGetEmptyPaddedBoard({ reelsDimensions: BOARD_DIMENSIONS });
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
 * resume point - global multiplier, free-spin counters, running total. None of
 * that exists here: this game's book events are `reveal` and `finalWin` only,
 * so the four types it collected for the snapshot could never match anything,
 * the snapshot was always empty, and no handler in bookEventHandlerMap.ts would
 * have processed it if it had not been. It also did not typecheck -
 * BookEventOfType<'createBonusSnapshot'> resolves to `never` against this
 * game's union - which went unnoticed because `tsc` was never actually running.
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

// other utils
export const getSymbolX = (reelIndex: number) => SYMBOL_SIZE * (reelIndex + REEL_PADDING);
export const getSymbolY = (symbolIndexOfBoard: number) => (symbolIndexOfBoard + 0.5) * SYMBOL_SIZE;

export const getSymbolInfo = ({
	rawSymbol,
	state,
}: {
	rawSymbol: RawSymbol;
	state: SymbolState;
}) => {
	return SYMBOL_INFO_MAP[rawSymbol.name][state];
};
