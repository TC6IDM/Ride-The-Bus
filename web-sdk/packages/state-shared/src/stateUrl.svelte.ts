import { locales } from 'config-lingui';
// Relative, not `from 'utils-shared/language'`: utils-shared already depends on
// state-shared, so importing it back by package name would put a cycle in the
// manifests. language.ts imports nothing, so the module graph stays acyclic.
import { resolveLanguage } from '../../utils-shared/language';
import { page } from '$app/state';

export type Language = (typeof locales)[number];

export type Key =
	// keys for play
	| 'sessionID'
	| 'sessionId'
	| 'rgs_url'
	| 'rgsUrl'
	| 'lang'
	| 'language'
	| 'currency'
	| 'device'
	| 'deviceType'
	| 'front'
	| 'checklist'
	| 'social'
	| 'demo'
	// keys for replay 
	| 'replay'
	| 'amount'
	| 'game'
	| 'mode'
	| 'version'
	| 'event'
	;

const getUrlSearchParam = (...keys: Key[]) => {
	for (const key of keys) {
		const value = page.url.searchParams.get(key);
		if (value !== null && value !== '') return value;
	}

	return '';
};

// params for play
/**
 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
 * upstream. This used to cast the raw parameter straight to `Language`, with a
 * single special case for 'br'. Anything else went through untouched - and an
 * unrecognised-but-well-formed tag is harmless, while a MALFORMED one is not:
 * LoadI18n activates it, and Lingui then hands it to Intl.NumberFormat on every
 * i18n.number() call, which throws a RangeError rather than degrading.
 *
 *     ?lang=xx     -> fine, Intl accepts any well-formed tag
 *     ?lang=en_US  -> RangeError: Incorrect locale information provided
 *     ?lang=zz!!   -> RangeError
 *
 * numberToCurrencyString is what draws the balance, the last win, the bet
 * display and every bet chip, so one underscore in the URL emptied the board.
 * Stake's PreChecks name it: "Invalid language parameters do not break game
 * display."
 *
 * Resolved against the locales actually shipped, so only a code with a
 * catalogue behind it can ever be activated. The 'br' case moved into
 * LANGUAGE_ALIASES alongside 'po' - Stake's own code for Polish, where every
 * catalogue in this repo is named 'pl'. See utils-shared/language.ts.
 */
const lang = () =>
	resolveLanguage(getUrlSearchParam('lang', 'language'), locales) as Language;
const sessionID = () => getUrlSearchParam('sessionID', 'sessionId') || '';
const rgsUrl = () => getUrlSearchParam('rgs_url', 'rgsUrl') || '';
const social = () => getUrlSearchParam('social') === 'true';

// params for replay
const replay = () => getUrlSearchParam('replay') === 'true';
const amount = () => Number(getUrlSearchParam('amount')) || 0;
/**
 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
 * upstream. `currency` was declared in `Key` but never had an accessor, so
 * nothing could read it: a replay URL carrying ?currency=BRL rendered in USD,
 * because replay never calls /wallet/authenticate and so never learns the
 * currency any other way. Bet Replay lists it as a supported parameter.
 *
 * Validated rather than passed straight through - anything that is not three
 * letters makes Intl.NumberFormat throw a RangeError, which would take the
 * whole display down instead of just showing the wrong symbol. A junk value
 * yields '' and leaves the existing default in place.
 */
const currency = () => {
	const raw = getUrlSearchParam('currency');
	return /^[A-Za-z]{3}$/.test(raw) ? raw.toUpperCase() : '';
};
const game = () => getUrlSearchParam('game') || '';
const version = () => getUrlSearchParam('version') || '';
const mode = () => getUrlSearchParam('mode') || '';
const event = () => getUrlSearchParam('event') || '';

export const stateUrlDerived = {
	// states for play
	lang,
	sessionID,
	rgsUrl,
	social,
	// states for replay
	replay,
	amount,
	currency,
	game,
	mode,
	version,
	event,
};
