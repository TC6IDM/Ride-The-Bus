/**
 * The template's `stateApp` - the loading/asset state a PixiJS game keeps.
 *
 * This game draws no canvas. It used to call pixi-svelte's `createApp` for
 * this object anyway, to match the Stake template file for file, and that one
 * import cost about 375 KB of a 1.05 MB bundle: the package's context module
 * imports the Spine runtime at module scope, which brings PixiJS with it, and
 * none of it ever ran. Bundle size is a named 3-star criterion, so the object
 * is declared here with the same shape and nothing else - a plain object, not
 * a rune, because nothing reads it reactively and a `.svelte.ts` suffix would
 * break the rule that `platform/` names its twelve files exactly as the
 * template does.
 */
export const stateApp = {
	loaded: false,
	loadingProgress: 0,
	loadedAssets: {} as Record<string, unknown>,
};
