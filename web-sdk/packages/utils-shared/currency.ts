/**
 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
 * upstream.
 *
 * Currency precision arithmetic, kept deliberately free of imports.
 *
 * These two helpers live here rather than in amount.ts so they can be unit
 * tested: amount.ts pulls in `state-shared`, which reaches SvelteKit's `$app/*`
 * virtual modules, and those only exist inside a Vite build - importing it from
 * `node --test` throws before a single assertion runs.
 *
 * This file therefore imports NOTHING, deliberately. `constants-shared` has no
 * `exports` map and no `.js` output, so a subpath like `constants-shared/bet`
 * resolves under Vite but not under plain node ESM, which does no extension
 * guessing. One import would put the whole file back out of reach of a test.
 */

/**
 * The only currencies Stake displays without decimals - every other entry in
 * the "Supported Currencies" table (RGS.md) is shown to two places.
 */
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'IDR', 'KRW', 'VND', 'CLP']);

/**
 * How many decimal places to show for a currency, per Stake's own table.
 *
 * This USED to read `Intl.NumberFormat().resolvedOptions()`, on the reasoning
 * that deferring to the platform could not drift. It drifts: Intl follows ISO
 * 4217, and Stake's published table does not agree with ISO on nine of its
 * forty-six currencies.
 *
 *   KWD JOD TND OMR BHD - ISO gives 3, Stake's table shows "KD10.00" (2)
 *   PKR ISK UGX XOF     - ISO gives 0, Stake's table shows "₨10.00"  (2)
 *
 * Reviewers check against that table, so the table is the specification here
 * even where it disagrees with ISO. Only JPY, IDR, KRW, VND and CLP are shown
 * without a minor unit; everything else - listed or not - gets two places.
 *
 * Callers MUST pass this as `minimumFractionDigits` as well as the basis for
 * the maximum: Intl's own default minimum for KWD is 3, and a maximum of 2
 * below a minimum of 3 is a RangeError.
 */
export const currencyDecimals = (currency: string): number =>
	ZERO_DECIMAL_CURRENCIES.has(String(currency).toUpperCase()) ? 0 : 2;

/**
 * The RGS's own resolution: amounts travel as integers of 1e-6 of a unit, so
 * six decimals is the finest distinction the server can even express and the
 * right place to stop widening.
 *
 * Written out rather than derived from API_AMOUNT_MULTIPLIER so this file stays
 * import-free (see above). currency.test.ts asserts the two still agree.
 */
export const RGS_DECIMALS = 6;

/**
 * How many decimals to actually render: as many as the amount really has.
 *
 * Money on the RGS carries six decimal places, so a payout can legitimately
 * land between cents - this game refunds 0.5x on a card-2 miss and retains 30%
 * of the built-up multiplier later, and at small bets those payouts are worth
 * fractions of a cent. Stake's submission checklist names the case directly
 * ("Game displays sub-cent payouts correctly").
 *
 * The rule USED to be "keep the currency's precision unless the amount would
 * round to zero". That cleared the zero case and missed the rest: measured over
 * every paying round in the published tables (2026-10-05), at a $0.01 bet 58%
 * of payouts displayed a figure different from the one credited - mostly
 * HIGHER, because Intl rounds half away from zero: the common 0.5x miss paid
 * $0.005 and showed $0.01; a 1.7x win paid $0.017 and showed $0.02. The owner's
 * call that day: show every amount exactly.
 *
 * So: the currency's own precision as a floor (an amount in whole cents looks
 * exactly as it always did), widened one decimal at a time, capped at the
 * RGS's six, until the figure is exact. 0.017 -> 3, 997.468 -> 3, 0.0004 -> 4.
 * Only amounts that carry sub-unit digits change. Callers formatting a figure
 * that is animating towards a total (a count-up) should pass the TOTAL's
 * digits instead, so in-between frames do not flash six decimals.
 *
 * Never returns less than `currencyPlaces`, which is what lets callers pass the
 * result as `maximumFractionDigits` while leaving `minimumFractionDigits` to
 * Intl: a maximum below the minimum is a RangeError.
 */
export const displayFractionDigits = (value: number, currencyPlaces: number): number => {
	if (!Number.isFinite(value) || value === 0) return currencyPlaces;
	const magnitude = Math.abs(value);
	for (let digits = currencyPlaces; digits < RGS_DECIMALS; digits++) {
		const scaled = magnitude * 10 ** digits;
		// Exact at this precision, allowing for binary floating-point noise
		// (0.017 * 1000 === 17.000000000000004) and its growth on large values.
		if (Math.abs(scaled - Math.round(scaled)) <= 1e-9 + scaled * 1e-12) return digits;
	}
	return RGS_DECIMALS;
};
