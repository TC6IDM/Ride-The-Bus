// Remove files from build/ that the page never loads, before it is uploaded.
//
// config-svelte's bundleStrategy "inline" puts the game's JS and CSS inside
// index.html, but SvelteKit still writes the separate copies it would have
// linked: on the 2026-10-02 build that was two style.*.css files (634 kB) and
// _app/env.js that index.html never names, plus static/music/.gitignore copied
// along with the music. Nothing fetches them; they only make the upload bigger
// and the folder harder to audit.
//
// Deliberately conservative: a file under _app/ is removed ONLY if its file name
// does not appear anywhere in index.html. bundle.*.js survives because the
// inlined code names it (as a URL base for dynamic imports), version.json because
// the version poll fetches it. Run as part of `npm run build`.
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const BUILD = resolve(process.argv[2] ?? 'build');
const html = readFileSync(join(BUILD, 'index.html'), 'utf8');

/** Every file under `dir`, recursively. */
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const removed = [];
for (const file of walk(BUILD)) {
  const rel = relative(BUILD, file).replaceAll('\\', '/');
  const name = rel.split('/').pop();
  const strayIgnore = name === '.gitignore';
  const unreferencedAppFile = rel.startsWith('_app/') && !html.includes(name);
  if (strayIgnore || unreferencedAppFile) {
    removed.push(`${rel} (${Math.round(statSync(file).size / 1024)} kB)`);
    rmSync(file);
  }
}
console.log(removed.length ? `prune-build: removed ${removed.length}\n  ${removed.join('\n  ')}` : 'prune-build: nothing to remove');
