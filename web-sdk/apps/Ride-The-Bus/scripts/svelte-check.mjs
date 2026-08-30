/**
 * Typecheck the .svelte files, which `pnpm check` cannot reach.
 *
 *   pnpm check:svelte
 *
 * WHY THIS RUNS THROUGH dlx RATHER THAN A DEPENDENCY
 *
 * `pnpm add -D svelte-check` was tried and reverted. Adding it re-resolved
 * floating ranges across the whole workspace: @types/node went 24.0.13 ->
 * 26.2.0 and vite 6.2.0 -> 7.0.0, rewriting 876 lines of the lockfile and
 * leaving @sveltejs/kit with an unmet vite peer. That is the same collateral
 * bump that once produced a screenful of phantom errors in Game.svelte, and it
 * is not a price worth paying for a typechecker.
 *
 * dlx resolves into its own store, so the lockfile is never touched.
 *
 * The three --package pins matter. On the first attempt svelte-check dragged in
 * its own svelte@5.56.8, which then disagreed with the workspace's 5.20.5 about
 * its own AST types and produced 97 spurious errors reading
 * "Property 'tag' must be of type 'Expression', but here has type 'Expression'".
 * Pinning svelte and typescript to the versions this app actually uses removes
 * all of it.
 *
 * WHAT IT FAILS ON
 *
 * Errors in this app's own src/ only. The vendored SDK under web-sdk/packages
 * reports a few hundred of its own, none of which this game can fix, and a gate
 * that is permanently red gets ignored - which is exactly how a decoy `tsc`
 * package went unnoticed here for weeks. Warnings are reported but do not fail:
 * they are almost entirely "unused CSS selector", which is what you get when a
 * component imports a shared stylesheet and uses part of it.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
 * Run as a single command string with shell: true, rather than an args array.
 *
 * On Windows pnpm is a .cmd, which modern Node refuses to spawn without a
 * shell - and passing an args ARRAY alongside shell: true is what triggers
 * DEP0190. One string satisfies both. Nothing here is interpolated from
 * anywhere, so there is nothing for a shell to mis-parse.
 */
const COMMAND = [
  'pnpm',
  '--package=svelte-check@4.7.5',
  '--package=svelte@5.20.5',
  '--package=typescript@5.8.3',
  'dlx',
  'svelte-check',
  '--tsconfig ./tsconfig.json',
  '--output machine',
].join(' ');

const result = spawnSync(COMMAND, { cwd: APP, encoding: 'utf8', shell: true });

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
if (!output.trim()) {
  console.error('svelte-check produced no output; is pnpm on PATH?');
  console.error(result.error ?? '');
  process.exit(1);
}

/** `<ts> ERROR "<file>" <line>:<col> "<message>"` */
const LINE = /^\d+ (ERROR|WARNING) "(.*?)" (\d+):(\d+) "([\s\S]*?)"\s*$/;

const ours = { errors: [], warnings: [] };
let outsideErrors = 0;
let toolingArtefacts = 0;

/**
 * Not a type error, and not deterministic either.
 *
 * Seven vendored components use the Lingui macro, and svelte-check reported
 * "No Lingui config found" for them on SOME runs and not others - measured at
 * 7 / 7 / 0 / 0 / 0 / 7 / 7 across consecutive runs with no edits between. A
 * gate whose count flaps is worse than one that is merely high, because the
 * number stops meaning anything.
 *
 * The config is not actually missing: apps/Ride-The-Bus/lingui.config.ts
 * exists and re-exports the workspace `config-lingui`. The cause is how this
 * script invokes the checker - `pnpm dlx` with three pinned packages, in a
 * temporary environment isolated from the workspace's own node_modules, where
 * a workspace import in a .ts config resolves or does not depending on what
 * pnpm has cached. That is a property of the harness, not of the code.
 *
 * Counted separately rather than dropped, so it stays visible; matched on the
 * exact message so a real error in those same files still counts.
 */
const LINGUI_CONFIG_ARTEFACT = /No Lingui config found/;

for (const line of output.split(/\r?\n/)) {
  const match = LINE.exec(line);
  if (!match) continue;
  const [, kind, rawPath, lineNo, col, message] = match;
  const file = rawPath.replace(/\\\\/g, '/').replace(/\\/g, '/');

  if (LINGUI_CONFIG_ARTEFACT.test(message)) {
    toolingArtefacts++;
    continue;
  }

  // Paths are relative to the app; anything starting with .. is outside it.
  if (file.startsWith('..')) {
    if (kind === 'ERROR') outsideErrors++;
    continue;
  }
  // The machine format escapes the message: a line break arrives as a literal
  // backslash-n, and every quote as backslash-quote. Cut at the first break
  // (svelte appends a docs URL after it) and unescape what remains.
  const summary = message.split(String.raw`\n`)[0].replace(/\\"/g, '"');
  const entry = `${file}:${lineNo}:${col}  ${summary}`;
  (kind === 'ERROR' ? ours.errors : ours.warnings).push(entry);
}

if (outsideErrors) {
  console.log(
    `${outsideErrors} pre-existing error(s) outside this app (vendored SDK) - not this game's to fix.`,
  );
}

if (toolingArtefacts) {
  console.log(
    `${toolingArtefacts} "No Lingui config found" report(s) ignored - a pnpm dlx ` +
      'resolution artefact of this script, not a code error. See the note above.',
  );
}

if (ours.warnings.length) {
  console.log(`\n${ours.warnings.length} warning(s) in this game's source:`);
  for (const warning of ours.warnings.slice(0, 10)) console.log(`  ${warning}`);
  if (ours.warnings.length > 10) console.log(`  ...and ${ours.warnings.length - 10} more`);
}

if (ours.errors.length) {
  console.error(`\n${ours.errors.length} error(s) in this game's source:`);
  for (const error of ours.errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log("\nNo .svelte type errors in this game's own source.");
