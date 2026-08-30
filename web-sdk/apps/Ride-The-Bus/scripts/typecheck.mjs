/**
 * Typecheck the game, and fail only on the game's own errors.
 *
 *   pnpm check
 *
 * WHY THIS IS NOT JUST `tsc --noEmit`
 *
 * Two reasons, both learned the hard way.
 *
 * 1. `npx tsc` does not run TypeScript here. TypeScript was not a dependency of
 *    this app, so npx fell through to the registry and fetched `tsc` - a decoy
 *    package whose entire function is to print "This is not the tsc command you
 *    are looking for" and exit 0. A typecheck that silently does nothing is
 *    worse than none, because it reports success. TypeScript is now a real
 *    devDependency, so the local binary resolves.
 *
 * 2. Bare `tsc` always fails here regardless of this game. tsc follows imports
 *    into web-sdk/packages/*, which is a vendored fork of Stake's SDK carrying
 *    its own pre-existing type errors - rgs-fetcher's indexed access, envs'
 *    missing $env declarations, pixi-svelte's duplicate export, and others.
 *    None are ours and none are going to be fixed here, so a gate that includes
 *    them is permanently red and therefore ignored.
 *
 * So: run the full check, print everything, but exit non-zero only for errors in
 * this app's own src/. Package errors are surfaced as a count so a genuine
 * regression in the fork is still visible.
 *
 * NOTE: tsc does not check .svelte files at all. Game.svelte and friends are
 * outside its scope; the Svelte compiler catches their syntax and template
 * errors, but nothing here typechecks their script blocks. That would need
 * svelte-check, which is not installed.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Find TypeScript, without requiring it to be a declared dependency.
 *
 * It deliberately is not one. Adding `typescript` to this app's package.json and
 * running pnpm install re-resolved a floating range and bumped @types/node from
 * 24.0.13 to 26.1.2 across the whole workspace, which changed global type
 * declarations and lit up errors in .svelte files that the Svelte language
 * server reports but tsc never sees. A typecheck is not worth destabilising the
 * dependency graph of a vendored fork.
 *
 * TypeScript 5.8.3 is already in the pnpm store as a transitive dependency
 * (lingui pulls it in), so the compiler is available without changing anything.
 * The store path is globbed rather than pinned so a version bump does not break
 * this, and require.resolve is tried first in case it ever becomes a real
 * dependency.
 */
const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

function findTsc() {
  try {
    return require.resolve('typescript/bin/tsc');
  } catch {
    /* not a declared dependency - expected; fall through to the store */
  }
  const store = path.resolve(here, '../../../node_modules/.pnpm');
  if (!existsSync(store)) return null;
  const candidates = readdirSync(store)
    .filter((name) => /^typescript@/.test(name))
    .sort()
    .reverse();
  for (const name of candidates) {
    const candidate = path.join(store, name, 'node_modules/typescript/bin/tsc');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const tscPath = findTsc();
if (!tscPath) {
  console.error('Could not find the TypeScript compiler.');
  console.error('Run `pnpm install` from web-sdk, then try again.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [tscPath, '--noEmit', '-p', 'tsconfig.json'], {
  cwd: process.cwd(),
  encoding: 'utf8',
});

if (result.error) {
  console.error('Could not run tsc:', result.error.message);
  process.exit(1);
}

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const lines = output.split(/\r?\n/).filter(Boolean);

/**
 * Errors tsc CANNOT get right here, as opposed to errors that are real.
 *
 * A Svelte 5 component may `export type Props` from its module block, and
 * components-pixi/index.ts imports exactly that from Button.svelte and
 * Amount.svelte to re-export as ButtonProps / AmountProps - which four
 * components in components-ui-pixi then use. The code is correct. But tsc does
 * not read .svelte files (see the header): it falls back to Svelte's ambient
 * `declare module '*.svelte'`, which declares a DEFAULT export and nothing
 * else, so any named type import from a component is reported as missing.
 *
 * svelte-check does read them, resolves these correctly, and reports nothing
 * for that file - which is what makes this a tool boundary rather than a
 * defect. Counting it would put the package total back to being a number
 * nobody looks at, which is the failure `skipLibCheck` was just added to fix.
 *
 * Narrow on purpose: this matches TS2614 against the '*.svelte' module only.
 * A genuine missing export from a .ts file is a different code and still
 * counts, and it is reported separately below rather than silently dropped.
 */
const TSC_CANNOT_SEE_SVELTE = /error TS2614: Module '"\*\.svelte"'/;

// App errors are relative (src/...); package errors escape upward (../../...).
const appErrors = lines.filter((l) => /^src[\\/]/.test(l));
const allPackageErrors = lines.filter((l) => /^\.\.[\\/]/.test(l));
const packageErrors = allPackageErrors.filter((l) => !TSC_CANNOT_SEE_SVELTE.test(l));
const svelteTypeImports = allPackageErrors.filter((l) => TSC_CANNOT_SEE_SVELTE.test(l));

if (packageErrors.length) {
  console.log(`${packageErrors.length} pre-existing error(s) in web-sdk/packages (vendored SDK, not this game):`);
  for (const line of packageErrors.slice(0, 5)) console.log('  ' + line);
  if (packageErrors.length > 5) console.log(`  ...and ${packageErrors.length - 5} more`);
  console.log('');
}

if (svelteTypeImports.length) {
  console.log(
    `${svelteTypeImports.length} named type import(s) from .svelte that tsc cannot resolve ` +
      '- not errors; svelte-check reads those files and reports none.',
  );
  console.log('');
}

if (appErrors.length) {
  console.log(`${appErrors.length} error(s) in this game's own source:`);
  for (const line of appErrors) console.log('  ' + line);
  process.exit(1);
}

console.log("No type errors in this game's own source.");
console.log('(.svelte files are not covered - tsc does not read them.)');
