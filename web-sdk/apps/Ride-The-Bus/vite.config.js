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

export default base;
