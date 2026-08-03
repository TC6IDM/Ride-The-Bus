import { stateI18n } from 'state-shared';

import { BOOK_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { stateBet } from 'state-shared';

const NO_LOCALISATION_CURRENCY_MAP: Record<string, string> = {
	XGC: 'GC',
	XSC: 'SC',
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

/**
 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
 * upstream.
 *
 * How many decimal places a currency actually has. Five of the currencies the
 * RGS supports have NONE - JPY, IDR, KRW, VND and CLP (see the CurrencyMeta
 * table in docs/rgs_docs/RGS.md) - because they have no subunit to show.
 *
 * Read out of Intl rather than kept as our own table, so it cannot drift from
 * the platform and needs no maintenance when the supported list grows.
 * Anything Intl does not recognise falls back to 2.
 */
export const currencyDecimals = (currency: string): number => {
	try {
		const resolved = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions();
		return resolved.maximumFractionDigits ?? 2;
	} catch {
		return 2;
	}
};

export const numberToCurrencyString = (value: number) => {
	if (stateBet.currency in NO_LOCALISATION_CURRENCY_MAP) {
		return `${NO_LOCALISATION_CURRENCY_MAP[stateBet.currency]} ${numberToFloat(value).toFixed(2)}`;
	}

	// LOCAL ADDITION to the Stake SDK - re-apply if this package is updated
	// from upstream. This used to pin minimumFractionDigits and
	// maximumFractionDigits to 2 for every currency, which rendered a ten-yen
	// balance as "10.00" - yen has no subunit, so the correct display is
	// "10". Letting Intl use each currency's own default fixes JPY, IDR, KRW,
	// VND and CLP and changes nothing for the other sixteen.
	return stateI18n.i18n.number(value, {
		style: 'currency',
		currency: stateBet.currency,
		// numberingSystem: 'latn',
	});
};

export const bookEventAmountToCurrencyString = (bookEventAmount: number) => {
	const normalisedAmount = bookEventAmountToNormalisedAmount(bookEventAmount);
	return numberToCurrencyString(normalisedAmount);
};
