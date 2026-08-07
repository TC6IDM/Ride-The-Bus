import { locales } from 'config-lingui';
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
const lang = () =>
getUrlSearchParam('lang', 'language') === 'br'
	? 'pt'
	: (getUrlSearchParam('lang', 'language') as Language) || 'en';
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
