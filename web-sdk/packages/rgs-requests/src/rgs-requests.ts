import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { rgsFetcher } from 'rgs-fetcher';

export * from './types';

export const requestAuthenticate = async (options: {
	sessionID: string;
	rgsUrl: string;
	language: string;
}) => {
	const data = await rgsFetcher.post({
		rgsUrl: options.rgsUrl,
		url: '/wallet/authenticate',
		variables: {
			sessionID: options.sessionID,
			language: options.language,
		},
	});

	return data;
};

/**
 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
 * upstream. Same convention as the two additions in rgs-fetcher/rgsFetcher.ts.
 *
 * RGS.md documents /wallet/balance as "useful for periodic balance updates" and
 * the SDK ships no helper for it. Ride The Bus needs one: play and end-round
 * refresh the balance after every round, which covers every way the GAME can
 * change it and none of the ways the PLAYER can - a deposit made on Stake with
 * the game open left a stale figure on the control bar until the next round
 * settled.
 *
 * Added here rather than fetched from the app directly so it goes through the
 * same rgsFetcher as its four siblings, and inherits the local fixes on it: the
 * 429 handling, and the scheme handling that makes a localhost RGS reachable.
 */
export const requestBalance = async (options: {
	sessionID: string;
	rgsUrl: string;
}) => {
	const data = await rgsFetcher.post({
		rgsUrl: options.rgsUrl,
		url: '/wallet/balance',
		variables: {
			sessionID: options.sessionID,
		},
	});

	return data;
};

export const requestEndRound = async (options: {
	sessionID: string;
	rgsUrl: string;
}) => {
	const data = await rgsFetcher.post({
		rgsUrl: options.rgsUrl,
		url: '/wallet/end-round',
		variables: {
			sessionID: options.sessionID,
		},
	});

	return data;
};

export const requestEndEvent = async (options: {
	sessionID: string;
	eventIndex: number;
	rgsUrl: string;
}) => {
	const data = await rgsFetcher.post({
		rgsUrl: options.rgsUrl,
		url: '/bet/event',
		variables: {
			sessionID: options.sessionID,
			event: `${options.eventIndex}`,
		},
	});

	return data;
};

export const requestBet = async (options: {
	sessionID: string;
	currency: string;
	amount: number;
	mode: string;
	rgsUrl: string;
}) => {
	const data = await rgsFetcher.post({
		rgsUrl: options.rgsUrl,
		url: '/wallet/play',
		variables: {
			mode: options.mode,
			currency: options.currency,
			sessionID: options.sessionID,
			amount: options.amount * API_AMOUNT_MULTIPLIER,
		},
	});

	return data;
};

/**
 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
 * upstream. The return type only; the body is untouched.
 *
 * `/bet/replay/{game}/{version}/{mode}/{event}` is not in schema.ts - the
 * `@ts-ignore` below is upstream's own, and its TODO says so - so this returned
 * the untyped result of an untyped call. Authenticate.svelte then spread it
 * into `stateBet.betToResume`, which svelte-check reported as "Spread types may
 * only be created from object types" because there was nothing saying it was an
 * object at all.
 *
 * Typed as a record rather than a made-up interface on purpose. The honest
 * statement is "an object whose shape this schema does not describe"; inventing
 * field names that were never checked against a real RGS response would read as
 * more certainty than exists, and this is the replay path, where getting the
 * shape wrong shows a player the wrong round. Callers already narrow with
 * `if (data)` and the assignment keeps its own `@ts-ignore`.
 */
export const requestReplay = async (options: {
	game: string;
	version: string;
	mode: string;
	event: string;
	rgsUrl: string;
}): Promise<Record<string, unknown> | null> => {
	const data = await rgsFetcher.get({
		rgsUrl: options.rgsUrl,
		// @ts-ignore TODO: update the schema.ts
		url: `/bet/replay/${options.game}/${options.version}/${options.mode}/${options.event}`,
	});

	return (data ?? null) as Record<string, unknown> | null;
}