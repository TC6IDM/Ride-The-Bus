// @ts-ignore
import config from 'config-vite';

/**
 * Game.svelte's <style> block pulls the real stylesheets in from src/styles/
 * with @import (which keeps them scoped to the component - see that block).
 * Vite doesn't record those files as dependencies of the .svelte module, so
 * editing one would otherwise leave the dev server serving stale CSS until a
 * manual restart. This plugin invalidates the Svelte modules and triggers a
 * reload whenever one of them changes, so styling edits show up normally.
 */
const styleImportHmr = {
	name: 'ride-the-bus:style-import-hmr',
	apply: 'serve',
	handleHotUpdate({ file, server }) {
		if (!/[\\/]src[\\/]styles[\\/][^\\/]+\.css$/.test(file)) return;

		for (const [id, mod] of server.moduleGraph.idToModuleMap) {
			if (id.includes('.svelte')) server.moduleGraph.invalidateModule(mod);
		}
		server.ws.send({ type: 'full-reload' });
		return [];
	},
};

const base = config();
base.plugins = [...(base.plugins ?? []), styleImportHmr];

/**
 * The bundle is ~980 kB raw / ~305 kB gzipped, over Rollup's 500 kB default.
 *
 * Raised rather than split, because the default's advice does not apply here.
 * The weight is Pixi's WebGL renderer, which the first frame needs - splitting
 * it out would trade one request for two before anything can be drawn, on a
 * game that must be playable the moment it loads. There is no route to
 * lazy-load behind and no second page to defer to; this game is one screen.
 *
 * What IS split is the part that should be: the seeded card shuffler
 * (game/roundShuffler.ts), behind an import.meta.env.DEV branch so a
 * real-money build carries no card generator at all.
 *
 * 305 kB gzipped is in normal range for a Pixi title. The limit is raised to
 * 1000 rather than switched off, so the warning still fires if the bundle grows
 * materially - silencing it entirely would give up the signal with the noise.
 */
base.build = { ...(base.build ?? {}), chunkSizeWarningLimit: 1000 };

export default base;
