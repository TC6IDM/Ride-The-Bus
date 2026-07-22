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
	game,
	mode,
	version,
	event,
};
