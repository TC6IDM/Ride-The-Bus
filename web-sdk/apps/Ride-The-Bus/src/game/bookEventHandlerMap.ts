import { type BookEventHandlerMap } from 'utils-book';

import { eventEmitter } from './eventEmitter';
import type { BookEvent, BookEventOfType, BookEventContext } from './typesBookEvent';

export const bookEventHandlerMap: BookEventHandlerMap<BookEvent, BookEventContext> = {
	reveal: async (bookEvent: BookEventOfType<'reveal'>, _context: BookEventContext) => {
		await eventEmitter.broadcastAsync({ type: 'engineReveal', data: bookEvent });
	},

	finalWin: async (bookEvent: BookEventOfType<'finalWin'>) => {
		await eventEmitter.broadcastAsync({ type: 'finalWin', data: bookEvent });
	},
};
