/**
 * multiplierString (multiplier.ts), bound to the game's active locale - the
 * same Lingui instance numberToCurrencyString formats money through. Kept apart
 * from the pure half so a node test can import that one without dragging
 * state-shared and SvelteKit's virtual modules in behind it.
 */
import { stateI18n } from 'state-shared';

import { multiplierString, ticketString } from './multiplier';

export const formatMultiplier = (value: number) =>
  multiplierString(value, (figure, format) => stateI18n.i18n.number(figure, format));

/** A Last Stop ticket ("×5"), in the game's active locale - see ticketString. */
export const formatTicket = (value: number) =>
  ticketString(value, (figure, format) => stateI18n.i18n.number(figure, format));
