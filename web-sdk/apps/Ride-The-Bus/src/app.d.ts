/// <reference types="@sveltejs/kit" />
/// <reference types="vite/client" />

/**
 * Ambient declarations for the editor.
 *
 * These two references are what stop the language server reporting errors in
 * the .svelte files that nothing else checks:
 *
 *   - `@sveltejs/kit` declares the `$app/*` virtual modules. Without it,
 *     `import { base } from '$app/paths'` in Game.svelte, GameLoader.svelte and
 *     +layout.svelte reads as "Cannot find module '$app/paths'".
 *   - `vite/client` declares `import.meta.env`. Without it, the
 *     `import.meta.env.DEV` guards around the dev-only logging read as
 *     "Property 'env' does not exist on type 'ImportMeta'".
 *
 * Neither ever broke the build - Vite and SvelteKit supply both at build time
 * regardless - which is exactly why they went unnoticed. `$app/paths` and
 * `import.meta.env` are used only inside .svelte files, and nothing in this
 * repo typechecks those: `tsc` does not read them, and svelte-check is not
 * installed. The errors were only ever visible in an editor.
 *
 * The kit reference is also emitted into .svelte-kit/ambient.d.ts by
 * `svelte-kit sync`, but that file is generated, gitignored, and only exists
 * after a dev or build run - so declaring it here as well means a fresh clone
 * is clean in the editor before anything has been run.
 */

declare module '*.css';
