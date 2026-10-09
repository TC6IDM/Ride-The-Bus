// Playwright for the live runner, without making it a project dependency.
//
// The repo already relies on the global @playwright/cli (CLAUDE.md: "Browser
// work defaults to playwright-cli"), and that package carries playwright-core.
// So this looks for a local install first and then for the global CLI's copy,
// and drives the system Chrome (channel 'chrome'), which is what playwright-cli
// opens too - no browser download either way.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';

export function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const name of ['playwright-core', 'playwright']) {
    try { return require(name); } catch {}
  }
  let root = '';
  try { root = execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  for (const rel of ['@playwright/cli/node_modules/playwright-core', 'playwright-core', 'playwright']) {
    try { return require(path.join(root, rel)); } catch {}
  }
  throw new Error('Playwright was not found. Install the CLI this repo uses: npm i -g @playwright/cli');
}

export const CHANNEL = process.env.RGS_LIVE_CHANNEL || 'chrome';
