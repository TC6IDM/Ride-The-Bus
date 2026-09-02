/**
 * Rebuild the queryable knowledge graph in graphify-out/.
 *
 *   npm run graph          (from web-sdk/apps/Ride-The-Bus/)
 *   node scripts/graph-build.mjs
 *
 * WHY THIS IS NOT JUST `graphify extract .`.
 *
 * Two things go wrong if you point graphify at the monorepo root and walk away.
 *
 * FIRST, SCOPE. Rooting at `.` yields 5,603 nodes of which only ~11% are this
 * game; the rest is the vendored SDK and the other sample games that ship
 * inside it. The "most connected" nodes come back as `eslint`, `node_modules`
 * and `BetMode` - true of the monorepo, useless about Ride The Bus - and the
 * graph lands above graphify's 5,000-node ceiling, which silently degrades
 * graph.html from a real map to an aggregated community blob. So this builds
 * the two directories that ARE the game and merges them.
 *
 * SECOND, SVELTE. Graphify maps .svelte onto the JS/TS grammar. Component
 * markup is not valid JS, so the parser emits one top-level ERROR node and
 * every symbol in the file is lost - BoltMeter and ChoiceIcon extract zero.
 * A regex pass rescues the imports, which is why the components appear in the
 * graph at all, wired to each other but hollow.
 *
 * That is a real loss rather than a cosmetic one: 64% of this app's Svelte is
 * <script>, and Game.svelte alone is 2,724 lines of it - the largest source
 * file in the client, and until now invisible.
 *
 * The fix is a shadow tree. Each Foo.svelte is rewritten to Foo.svelte.ts
 * holding ONLY its script blocks, which is ordinary TypeScript and parses
 * clean. The markup and style lines are not deleted but BLANKED, so every
 * surviving line keeps the line number it had in the .svelte file. That is the
 * whole trick, and it is why there is no offset table to maintain and drift:
 * graphify reporting L47 of the shadow is reporting L47 of the component. The
 * shadow's source_file paths are then rewritten back to the real .svelte
 * before merging, so nothing downstream ever sees the shadow existed.
 *
 * What this still cannot reach is the other 36% - markup and <style>. Those
 * are for `npm run shots` and `npm run check:svelte`; a graph is the wrong
 * instrument for asking how something looks.
 *
 * Everything here is local AST parsing. --code-only is deliberate and load
 * bearing: without it graphify sends 122 docs - CLAUDE.md, the rtb-invariants
 * references, stake-approval - through a third-party LLM for a semantic pass,
 * which ships unreleased game math and compliance text off the machine.
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  watch as fsWatch,
  writeFileSync,
} from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = 'web-sdk/apps/Ride-The-Bus';
const MATH = 'math-sdk/games/ride_the_bus';
const OUT = 'graphify-out';

// Intermediates. Removed on the way out, and on the way in - a stale shadow
// from a crashed run would otherwise be merged as if it were current.
const TMP = ['.graph-app', '.graph-math', '.graph-svelte'];

const SCRIPT_RE = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;

/** Run graphify, surfacing its output only when it fails. */
function graphify(args, label) {
  process.stdout.write(`  ${label}... `);
  try {
    execFileSync('python', ['-m', 'graphify', ...args], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    console.log('ok');
  } catch (err) {
    console.log('FAILED');
    console.error(err.stdout || '');
    console.error(err.stderr || String(err));
    process.exit(1);
  }
}

/**
 * Rewrite one component as line-preserving TypeScript.
 *
 * Returns null when the file has no <script> at all - a markup-only component
 * would otherwise become an empty shadow file and a phantom node.
 */
function shadowSource(src) {
  const lines = src.split('\n');
  const keep = new Array(lines.length).fill('');
  let found = false;

  for (const m of src.matchAll(SCRIPT_RE)) {
    const body = m[1];
    if (!body.trim()) continue;
    found = true;
    // Line index of the block's first content line: count newlines up to the
    // end of the opening tag. matchAll gives the index of `<script`, and the
    // body starts at m.index + (full match length - body length - closing tag).
    const bodyStart = m.index + m[0].indexOf(body);
    const startLine = src.slice(0, bodyStart).split('\n').length - 1;
    body.split('\n').forEach((line, i) => {
      keep[startLine + i] = line;
    });
  }

  return found ? keep.join('\n') : null;
}

/**
 * Mirror every .svelte under an app into parallel .svelte.ts files.
 *
 * The shadow mirrors the app root, not the src directory, so a shadow node's
 * source_file reads `src/components/Foo.svelte` exactly as the app graph's
 * does. Rooted at src/ instead, the two graphs disagree on the prefix and each
 * component lands in the merge twice - once hollow, once with its symbols.
 *
 * Returns the repo-relative paths written, WITHOUT the .ts, for unshadow to
 * put back precisely. Note the filter is `.svelte` and not `.svelte.ts`: the
 * latter is a real Svelte 5 rune module (stateGame.svelte.ts), ordinary
 * TypeScript that graphify already parses correctly and that must not be
 * shadowed or renamed.
 */
async function buildShadow(appDir, shadowDir) {
  const entries = await readdir(path.join(ROOT, appDir, 'src'), {
    recursive: true,
    withFileTypes: true,
  });

  const written = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.svelte')) continue;

    const abs = path.join(e.parentPath ?? e.path, e.name);
    const rel = path.relative(path.join(ROOT, appDir), abs).split(path.sep).join('/');
    const shadow = shadowSource(readFileSync(abs, 'utf-8'));
    if (shadow === null) continue;

    const dest = path.join(ROOT, shadowDir, `${rel}.ts`);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, shadow, 'utf-8');
    written.push(rel);
  }
  return written;
}

/**
 * Point the shadow graph back at the real components.
 *
 * Rewrites ONLY the exact paths buildShadow wrote, each `<rel>.svelte.ts` back
 * to `<rel>.svelte`. A blanket replace of the .svelte.ts suffix is the obvious
 * shortcut and is wrong: it also renames the repo's genuine Svelte 5 rune
 * modules (stateGame.svelte.ts, jurisdiction.svelte.ts) to files that do not
 * exist, silently pointing every symbol in them at a phantom path.
 *
 * Done over the raw JSON text rather than per-field because source_file is not
 * the only place a path appears - ids and edge endpoints carry them too, and a
 * half-rewritten graph links real nodes to phantom ones.
 */
function unshadow(graphPath, written) {
  let raw = readFileSync(graphPath, 'utf-8');
  for (const rel of written) {
    raw = raw.replaceAll(`${rel}.ts`, rel);
    // Node labels carry the bare filename rather than the path, and left alone
    // they show up as a second, phantom "Foo.svelte.ts" file node beside the
    // real one. Quoted so the match cannot straddle a longer path.
    const base = rel.slice(rel.lastIndexOf('/') + 1);
    raw = raw.replaceAll(`"${base}.ts"`, `"${base}"`);
  }
  writeFileSync(graphPath, raw, 'utf-8');
}

function cleanTemps() {
  for (const d of TMP) rmSync(path.join(ROOT, d), { recursive: true, force: true });
}

const graphOf = (dir) => `${dir}/graphify-out/graph.json`;

/**
 * Watch the graphed directories and rebuild once the edits stop.
 *
 * Debounced on IDLE rather than throttled, because a rebuild costs ~15s and a
 * save every few seconds would otherwise queue rebuilds faster than they drain.
 * Waiting for a pause also skips the intermediate states: what gets graphed is
 * the code you stopped to think about, not every keystroke on the way there.
 *
 * The filter matches the post-commit hook's - the graph holds structure, and a
 * CSS or markdown save cannot move it.
 */
function watch(idleMs) {
  const dirs = [path.join(ROOT, APP, 'src'), path.join(ROOT, MATH)].filter(existsSync);
  let timer = null;
  let building = false;
  let again = false;

  const run = async () => {
    if (building) {
      again = true;
      return;
    }
    building = true;
    try {
      await build();
    } catch (err) {
      console.error('  rebuild failed:', err.message);
    } finally {
      building = false;
      if (again) {
        again = false;
        run();
      } else {
        console.log(`\nWatching for changes (Ctrl+C to stop)\n`);
      }
    }
  };

  for (const dir of dirs) {
    fsWatch(dir, { recursive: true }, (_event, file) => {
      if (!file || !/\.(ts|svelte|py|mjs)$/.test(file)) return;
      clearTimeout(timer);
      timer = setTimeout(run, idleMs);
    });
  }

  console.log(`Watching ${dirs.length} director${dirs.length === 1 ? 'y' : 'ies'}`);
  console.log(`Rebuilds after ${idleMs / 1000}s of quiet. Ctrl+C to stop.\n`);
}

async function build() {
  process.chdir(ROOT);
  cleanTemps();

  console.log('Building knowledge graph (local AST, no network)\n');

  const written = await buildShadow(APP, '.graph-svelte');
  console.log(`  shadow tree: ${written.length} component(s) rewritten as line-preserving .ts`);

  graphify(['extract', APP, '--code-only', '--out', '.graph-app'], 'app');
  graphify(['extract', '.graph-svelte', '--code-only', '--out', '.graph-svelte-out'], 'svelte scripts');
  TMP.push('.graph-svelte-out');

  unshadow(path.join(ROOT, graphOf('.graph-svelte-out')), written);

  const sources = [graphOf('.graph-app'), graphOf('.graph-svelte-out')];

  // The math tree is absent between a client change and the next math build.
  // Skip rather than fail - the same rule the tests follow.
  if (existsSync(path.join(ROOT, MATH))) {
    graphify(['extract', MATH, '--code-only', '--out', '.graph-math'], 'math');
    sources.push(graphOf('.graph-math'));
  } else {
    console.log(`  math: skipped (${MATH} absent)`);
  }

  mkdirSync(path.join(ROOT, OUT), { recursive: true });
  graphify(['merge-graphs', ...sources, '--out', `${OUT}/graph.json`], 'merge');
  graphify(['cluster-only', '.', '--no-label'], 'cluster + report');
  graphify(['export', 'obsidian'], 'obsidian vault');

  cleanTemps();

  // networkx node-link JSON calls them "links", not "edges".
  const g = JSON.parse(readFileSync(path.join(ROOT, OUT, 'graph.json'), 'utf-8'));
  console.log(`\n${g.nodes?.length ?? 0} nodes, ${g.links?.length ?? 0} edges\n`);
  console.log(`  ${OUT}/graph.html        interactive map`);
  console.log(`  ${OUT}/GRAPH_REPORT.md   written summary`);
  console.log(`  ${OUT}/obsidian/         open as a vault in Obsidian\n`);
  console.log('Ask it things:');
  console.log('  python -m graphify affected "FAMILY_RULES"');
  console.log('  python -m graphify explain "stageRetention()"');
}

async function main() {
  if (!existsSync(path.join(ROOT, APP))) {
    console.error(`Cannot find ${APP} - run from inside the monorepo.`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const watching = args.includes('--watch');
  const idleArg = args.find((a) => a.startsWith('--idle='));
  const idleMs = idleArg ? Number(idleArg.split('=')[1]) * 1000 : 10_000;

  await build();

  if (watching) {
    process.on('SIGINT', () => {
      cleanTemps();
      console.log('\nStopped watching.');
      process.exit(0);
    });
    watch(idleMs);
  }
}

main().catch((err) => {
  cleanTemps();
  console.error(err);
  process.exit(1);
});
