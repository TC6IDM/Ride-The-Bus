/**
 * Turning a `?lang=` query parameter into a locale that is safe to activate.
 *
 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
 * upstream. It lives here, beside currency.ts, for the reason that file gives:
 * so a node test can reach it without dragging state-shared (and SvelteKit's
 * $app/* virtuals) in behind it.
 *
 * WHY THIS EXISTS AT ALL, GIVEN t() ALREADY FALLS BACK.
 *
 * stateUrl.svelte.ts used to cast the raw parameter straight to `Language` and
 * hand it to LoadI18n, which passes it to `i18n.activate()`. Looking up a
 * missing catalogue is harmless - this game's t() falls back to English and
 * then to the key, which IS the English text. What is NOT harmless is that
 * Lingui keeps the activated locale and passes it to `Intl.NumberFormat` on
 * every `i18n.number()` call, and Intl THROWS a RangeError on a structurally
 * invalid language tag rather than degrading:
 *
 *     ?lang=xx      -> $1,234.50   (unknown but well-formed; Intl is happy)
 *     ?lang=en_US   -> RangeError: Incorrect locale information provided
 *     ?lang=zz!!    -> RangeError
 *     ?lang=en;a    -> RangeError
 *
 * numberToCurrencyString in amount.ts is what renders the balance, the last
 * win, the bet display, the running win, the win takeover's amount and every
 * bet chip - so one underscore in a URL took the whole board down. Stake's
 * PreChecks name this directly: "Invalid language parameters do not break game
 * display."
 *
 * The fix is to let only a locale we actually ship reach `activate`. Nothing
 * downstream then has to be defensive about the locale itself.
 */

/**
 * Codes Stake may send that are spelled differently from the catalogue.
 *
 * `br` -> `pt` was already in stateUrl.svelte.ts and is kept here so both
 * spellings live in one place. `po` is Stake's own code for Polish in the
 * supported-languages list ("ar de en es fi fr hi id ja ko po pt ru tr zh vi"),
 * while Lingui and every catalogue file in this repo use the ISO 639-1 `pl` -
 * so without the alias a Polish session silently got English number formatting.
 */
export const LANGUAGE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
	br: 'pt',
	po: 'pl',
});

/**
 * The locale to activate for a raw `?lang=` value.
 *
 * Case-insensitive, and tolerant of a region subtag: Stake sends bare codes,
 * but `pt-BR` from an operator should land on Portuguese rather than English.
 * Anything still unrecognised - junk, empty, malformed - returns `fallback`.
 *
 * `supported` is passed in rather than imported so this stays free of every
 * other module; callers hand it `locales` from config-lingui.
 */
export function resolveLanguage(
	raw: string | null | undefined,
	supported: readonly string[],
	fallback = 'en',
): string {
	const known = (code: string) => (supported.includes(code) ? code : null);

	if (typeof raw !== 'string') return fallback;
	const trimmed = raw.trim().toLowerCase();
	if (!trimmed) return fallback;

	return (
		known(LANGUAGE_ALIASES[trimmed] ?? trimmed) ??
		// A region subtag, e.g. "pt-br" or "zh-hans". Take the base code, and run
		// it through the aliases too so "po-pl" behaves like "po".
		known(LANGUAGE_ALIASES[trimmed.split(/[-_]/)[0]!] ?? trimmed.split(/[-_]/)[0]!) ??
		fallback
	);
}
