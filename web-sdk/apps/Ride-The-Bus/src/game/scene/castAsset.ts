/**
 * Where the back room's characters are fetched from.
 *
 * A file of its own for the reason bedAsset.ts gives: it imports SvelteKit's
 * $app/paths, and a module that reaches $app/* cannot be imported by a node
 * test. `${base}` matters because Stake serves games from a sub-path, not root.
 * The images are FETCHED, never imported, because config-svelte's
 * bundleStrategy "inline" would base64 an import into index.html.
 */
import { base } from '$app/paths';

export const CAST_ART_BASE = `${base}/characters`;
