import type { paths } from './schema';
import { fetcher } from 'utils-fetcher';

/**
 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
 * upstream.
 *
 * A non-2xx response from the RGS, carrying the status so callers can tell a
 * rate limit from a real failure.
 *
 * Both methods below used to log the response and then call `response.json()`
 * on it regardless. The RGS answers 429 with the plain text "Too Many Requests",
 * so that threw `SyntaxError: Unexpected token 'T'` - an error with no status,
 * no body and nothing to distinguish "slow down" from "this bet is invalid".
 * Autoplay treated it as a fatal round error and stopped the run.
 */
export class RgsHttpError extends Error {
	readonly status: number;
	readonly body: string;

	constructor(status: number, body: string) {
		super(`RGS responded ${status}${body ? `: ${body.slice(0, 200)}` : ''}`);
		this.name = 'RgsHttpError';
		this.status = status;
		this.body = body;
	}

	/** Rate limited. Worth retrying after a pause; everything else is not. */
	get isRateLimited(): boolean {
		return this.status === 429;
	}
}

/**
 * Read a response body once, tolerating a non-JSON payload.
 *
 * Errors from the RGS are not always JSON - 429 is plain text - so the body is
 * taken as text and parsed optionally, rather than assuming.
 */
async function readBody(response: Response): Promise<{ text: string; data: unknown }> {
	const text = await response.text();
	if (!text) return { text, data: null };
	try {
		return { text, data: JSON.parse(text) };
	} catch {
		return { text, data: null };
	}
}

/**
 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
 * upstream. Same convention as the currency fix in Authenticate.svelte.
 *
 * The scheme is hardcoded to https below, which is right for every real RGS and
 * impossible for a local one: `rgs_url=localhost:3010` is fetched as
 * `https://localhost:3010`, so a local stand-in has to serve TLS, which means a
 * self-signed certificate, which means the browser silently refuses the fetch
 * until someone has visited the origin and clicked through a warning. That is a
 * trap rather than a workflow - and in dev the failure is invisible, because
 * Game.svelte clears error modals when there is no session.
 *
 * So: use http when BOTH the target and the page itself are loopback.
 *
 * Both halves are required, and together they make this unreachable in
 * production rather than merely unlikely: a live build is served from
 * stake.com, never from localhost, so `location.host` alone already closes it.
 * Requiring the RGS host to be loopback too means it can never rewrite the
 * scheme on a real RGS even when someone runs the dev server.
 *
 * Deliberately a RUNTIME check rather than `import.meta.env.DEV`. The compile-
 * time flag would let the branch be dropped from the production bundle, which
 * is tidier - but nothing else in these vendored packages relies on Vite's env
 * replacement, and if it silently failed to apply here the symptom would be the
 * exact hang this was written to remove. An origin check cannot silently fail.
 *
 * See scripts/replay-server.mjs, which is what this exists for.
 */
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function endpointFor(rgsUrl: string, url: string): string {
	const pageIsLocal =
		typeof location !== 'undefined' && LOOPBACK.test(location.host);
	if (pageIsLocal && LOOPBACK.test(rgsUrl)) return `http://${rgsUrl}${url}`;
	return `https://${rgsUrl}${url}`;
}

export const rgsFetcher = {
	post: async function post<
		T extends keyof paths,
		TResponse = paths[T]['post']['responses'][200]['content']['application/json'],
	>(options: {
		url: T;
		rgsUrl: string;
		variables?: paths[T]['post']['requestBody']['content']['application/json'];
	}): Promise<TResponse> {
		const response = await fetcher({
			method: 'POST',
			variables: options.variables,
			endpoint: endpointFor(options.rgsUrl, options.url as string),
		});

		const { text, data } = await readBody(response);
		if (!response.ok) throw new RgsHttpError(response.status, text);
		return data as TResponse;
	},
	/**
	 * LOCAL ADDITION to the Stake SDK - re-apply if this package is updated from
	 * upstream. Types only; the body below is untouched.
	 *
	 * This signature accounted for FIVE of the seven errors `npm run check` used
	 * to report, and both tsc and svelte-check flagged it, so it was real rather
	 * than a tool artefact.
	 *
	 * The default was `paths[T]['get'][...]`, and **not one of the eight paths in
	 * schema.ts declares a `get`** - they are all `post`. So `paths[T]['get']`
	 * cannot resolve for any T the constraint admits, and TypeScript said so five
	 * times over, once per link in the chain.
	 *
	 * Kept rather than deleted: it is vendored API surface, and upstream may add
	 * a GET endpoint later. Written as a conditional so the type tells the truth
	 * instead of asserting a shape that is not there - it still infers the
	 * response exactly as before for any path that DOES gain a `get`, and
	 * resolves to `unknown` for the ones that have not, which is correct. Nothing
	 * in this game calls it; `rgs-requests.ts` uses `post` for all five requests.
	 */
	get: async function get<
		T extends keyof paths,
		TResponse = paths[T] extends {
			get: { responses: { 200: { content: { 'application/json': infer R } } } };
		}
			? R
			: unknown,
	>(options: { url: T; rgsUrl: string }): Promise<TResponse> {
		const response = await fetcher({
			method: 'GET',
			endpoint: endpointFor(options.rgsUrl, options.url as string),
		});

		const { text, data } = await readBody(response);
		if (!response.ok) throw new RgsHttpError(response.status, text);
		return data as TResponse;
	},
};
