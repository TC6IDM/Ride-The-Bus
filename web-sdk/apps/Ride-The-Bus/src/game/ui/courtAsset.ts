/**
 * Where the court figures are fetched from.
 *
 * A file of its own for the reason bedAsset.ts gives: it imports SvelteKit's
 * $app/paths, and a module that reaches $app/* cannot be imported by a node
 * test. `${base}` matters because Stake serves games from a sub-path, not root.
 */
import { base } from '$app/paths';

export const COURT_ART_URL = `${base}/cards/courts.svg`;
