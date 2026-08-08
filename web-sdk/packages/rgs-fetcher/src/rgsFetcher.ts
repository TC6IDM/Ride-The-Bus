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
			endpoint: `https://${options.rgsUrl}${options.url}`,
		});

		const { text, data } = await readBody(response);
		if (!response.ok) throw new RgsHttpError(response.status, text);
		return data as TResponse;
	},
	get: async function get<
		T extends keyof paths,
		TResponse = paths[T]['get']['responses'][200]['content']['application/json'],
	>(options: { url: T; rgsUrl: string }): Promise<TResponse> {
		const response = await fetcher({
			method: 'GET',
			endpoint: `https://${options.rgsUrl}${options.url}`,
		});

		const { text, data } = await readBody(response);
		if (!response.ok) throw new RgsHttpError(response.status, text);
		return data as TResponse;
	},
};
