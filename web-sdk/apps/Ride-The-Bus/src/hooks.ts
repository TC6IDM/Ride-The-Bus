import type { Reroute } from '@sveltejs/kit';

/**
 * `.../index.html` is the page itself, not a route called "index.html".
 *
 * Stake's own RGS documentation gives the launch URL as
 * `https://{team}.cdn.stake-engine.com/{game}/{version}/index.html?sessionID=...`.
 * The game is one prerendered SPA page, so the client router looked for a route
 * at `/index.html`, found none, and logged `SvelteKitError: Not found:
 * /index.html` on every such launch - the game still rendered, but the error
 * sat in the console a reviewer is told to check ("no errors"). The Studio
 * launches the directory form (`.../v71/`), which is why the live pass only
 * saw it on a hand-built URL (2026-10-05).
 *
 * Mapping the file back to its directory makes both forms the same route.
 */
export const reroute: Reroute = ({ url }) => {
	if (url.pathname.endsWith('/index.html')) return url.pathname.slice(0, -'index.html'.length);
};
