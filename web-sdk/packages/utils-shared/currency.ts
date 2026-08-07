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
 * How many decimals to actually render, widened when the currency's own
 * precision would swallow the amount entirely.
 *
 * Money on the RGS carries six decimal places, so a payout can legitimately
 * land below one cent - this game refunds 0.5x on a card-2 miss and retains 30%
 * of the built-up multiplier later, both of which go sub-cent at small bets.
 * At the currency's default precision Intl renders those as "$0.00", which
 * reads as "you won nothing" for a round that actually paid. Stake's submission
 * checklist calls this out directly ("Game displays sub-cent payouts
 * correctly").
 *
 * So: keep the currency's own precision whenever the amount survives rounding
 * at it, and only widen - one decimal at a time, capped at the RGS's own six -
 * when it does not. Every ordinary amount formats exactly as before; only
 * amounts that would otherwise display as zero change.
 *
 * Never returns less than `currencyPlaces`, which is what lets callers pass the
 * result as `maximumFractionDigits` while leaving `minimumFractionDigits` to
 * Intl: a maximum below the minimum is a RangeError.
 */
export const displayFractionDigits = (value: number, currencyPlaces: number): number => {
	if (!Number.isFinite(value) || value === 0) return currencyPlaces;
	const magnitude = Math.abs(value);
	// Half a unit of the last shown decimal is the rounding threshold: at or
	// above it the amount still displays, below it the amount reads as zero.
	for (let digits = currencyPlaces; digits < RGS_DECIMALS; digits++) {
		if (magnitude >= 0.5 / 10 ** digits) return digits;
	}
	return RGS_DECIMALS;
};
