/**
 * The bare currency symbol, for the one field that cannot use a formatter.
 *
 * Lifted out of Game.svelte unchanged.
 */
import { stateBet } from 'state-shared';
import { NO_LOCALISATION_CURRENCY_MAP } from 'utils-shared/amount';

// Currency symbol for the raw bet-entry field. Everything else formats through
// numberToCurrencyString, but that returns a formatted AMOUNT and this field
// holds the player's own in-progress typing, so it needs just the symbol.
// Hardcoding "$" showed a dollar sign to every non-USD player while the
// balance beside it read in euro/yen.
//
// The social-casino currencies are spelled out the same way the SDK's
// formatter does, since Intl has no symbol for them - and the map is now
// IMPORTED from there rather than copied. The copy had two entries where the
// formatter has three: a player on XEC saw the balance read "10.00 SC" and
// the bet field beside it read "XEC10.00". Two spellings of one currency on
// one screen, from two lists that were never going to stay in step.
export const currencySymbol = () => {
  const code = stateBet.currency || 'USD';
  if (code in NO_LOCALISATION_CURRENCY_MAP) return NO_LOCALISATION_CURRENCY_MAP[code];
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
    }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    // Unknown/!ISO code - Intl throws rather than degrading, and a bet field
    // with no prefix beats a crash.
    return code;
  }
};
