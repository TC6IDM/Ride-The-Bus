import { stateI18n } from 'state-shared';

import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBet } from 'state-shared';

// LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
// upstream. Both helpers live in ./currency so they can be unit tested without
// dragging state-shared (and SvelteKit's $app/* virtuals) into a node test.
// Re-exported here because callers already import currencyDecimals from this
// module.
import { currencyDecimals, displayFractionDigits } from './currency';

export { currencyDecimals, displayFractionDigits };

/**
 * EXPORTED - local addition. The bet-entry field needs the same spelling for
 * these codes as the formatter uses, and it had its own copy that was missing
 * XEC: the balance beside it read "SC" while the field said "XEC". One map.
 */
export const NO_LOCALISATION_CURRENCY_MAP: Record<string, string> = {
	XGC: 'GC',
	XSC: 'SC',
	// LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
	// upstream. XEC (Stake Euro Cash) is the third social-casino currency and
	// also displays as "SC" (RGS.md, "Supported Currencies"). Without it, Intl
	// falls through and renders the raw code - "XEC 10.00" instead of "SC 10.00".
	XEC: 'SC',
};

// bookEventAmount: is the amount or win numbers in the events of books, e.g. the amount in setTotalWin bookEvent
// {
// 	"index": 3,
// 	"type": "setTotalWin",
// 	"amount": 100
// },
// if betting on $1,   100 bookEventAmount equals to $1.    betAmountMultiplier is (100 / BOOK_AMOUNT_MULTIPLIER =) 1
// if betting on $1,    50 bookEventAmount equals to $0.5.  betAmountMultiplier is ( 50 / BOOK_AMOUNT_MULTIPLIER =) 0.5
// if betting on $0.5, 100 bookEventAmount equals to $0.5.  betAmountMultiplier is (100 / BOOK_AMOUNT_MULTIPLIER =) 1
// if betting on $0.5,  50 bookEventAmount equals to $0.25. betAmountMultiplier is ( 50 / BOOK_AMOUNT_MULTIPLIER =) 0.5

export const bookEventAmountToBetAmountMultiplier = (bookEventAmount: number) =>
	bookEventAmount / BOOK_AMOUNT_MULTIPLIER;

export const bookEventAmountToNormalisedAmount = (bookEventAmount: number) => {
	const betAmountMultiplier = bookEventAmountToBetAmountMultiplier(bookEventAmount);
	return stateBet.wageredBetAmount * betAmountMultiplier;
};

export const numberToFloat = (value: number) => Number.parseFloat(`${value}`);

export const numberToCurrencyString = (value: number) => {
	if (stateBet.currency in NO_LOCALISATION_CURRENCY_MAP) {
		// Social currencies are shown to two places, widened the same way so a
		// sub-cent SC/GC payout is not rendered as "0.00 SC".
		//
		// LOCAL ADDITION to the Stake SDK - re-apply if this package is updated
		// from upstream. The label is a SUFFIX: Stake's currency table gives the
		// format as "10.00 GC" / "10.00 SC", where every other currency is shown
		// with a leading symbol. The SDK had it leading, like the rest.
		const digits = displayFractionDigits(value, 2);
		return `${numberToFloat(value).toFixed(digits)} ${NO_LOCALISATION_CURRENCY_MAP[stateBet.currency]}`;
	}

	// LOCAL ADDITION to the Stake SDK - re-apply if this package is updated
	// from upstream. This used to pin minimumFractionDigits and
	// maximumFractionDigits to 2 for every currency, which rendered a ten-yen
	// balance as "10.00" - yen has no subunit, so the correct display is "10".
	const places = currencyDecimals(stateBet.currency);
	return stateI18n.i18n.number(value, {
		style: 'currency',
		currency: stateBet.currency,
		// Both are set explicitly, and neither is left to Intl. The minimum has
		// to be, because Intl's own default for KWD/JOD/TND/OMR/BHD is the ISO
		// 3 and a maximum of 2 underneath it throws a RangeError. The maximum
		// only ever widens past `places`, and only for amounts that would
		// otherwise render as zero - see displayFractionDigits.
		minimumFractionDigits: places,
		maximumFractionDigits: displayFractionDigits(value, places),
		// numberingSystem: 'latn',
	});
};

export const bookEventAmountToCurrencyString = (bookEventAmount: number) => {
	const normalisedAmount = bookEventAmountToNormalisedAmount(bookEventAmount);
	return numberToCurrencyString(normalisedAmount);
};
