// Stake Engine Studio: the URLs, the sign-in, and minting demo sessions.
//
// A demo session is minted by opening the Studio's play modal with
// `/math?launch=true&...` (the plain game URL lands on the Overview page with
// no modal). The modal's iframe URL carries the sessionID; once it exists the
// Studio page can close and the game can be opened on that URL in any page of
// a signed-in context. THE SESSION ID IS A CREDENTIAL: it lives in memory
// only, and redact() strips it from anything written down.
//
// The CDN answers 403 to a browser without the Studio sign-in's cookies -
// replays included - so every context the runner opens is built from the
// saved storage state. That file holds cookies, so it lives in the user's
// local app data, never in the repo.
import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { CHANNEL } from './pw.mjs';

export const STUDIO = 'https://studio.engine.io/teams/takeovercasino/games/ride-the-bus';
export const GAME_UUID = '019f7e00-fa38-78fa-9ea7-b4933e75765b';
export const CDN = 'https://takeovercasino.live.engine.io/ride-the-bus';
export const RGS = 'rgsd.engine.io';

const DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'rtb-rgs-live');
export const STATE_FILE = path.join(DIR, 'storage-state.json');
const PROFILE = path.join(DIR, 'profile');

export const redact = (s) => String(s)
  .replace(/sessionID=[^&\s"']+/gi, 'sessionID=<redacted>')
  .replace(/("session\w*"\s*:\s*")[^"]*"/gi, '$1<redacted>"');

export function launchUrl({ front, math, currency = 'USD', lang = 'en', device = 'desktop', balance = 100_000_000_000, social = false, amount = 1_000_000 }) {
  const q = new URLSearchParams({ launch: 'true', team: 'takeovercasino', game: 'ride-the-bus', currency, language: lang, deviceType: device, balance: String(balance), social: String(social), math: String(math), front: String(front), checklist: 'false', replay: 'false', amount: String(amount) });
  return `${STUDIO}/math?${q}`;
}

export function replayUrl({ front, math, mode, event, currency = 'USD', amount = 1_000_000, lang = 'en', device = 'desktop', social = false }) {
  const q = new URLSearchParams({ replay: 'true', game: GAME_UUID, version: String(math), mode, event: String(event), currency, amount: String(amount), lang, device, social: String(social), rgs_url: RGS });
  return `${CDN}/v${front}/?${q}`;
}

/** The same game URL with some query parameters swapped (lang, device, rgs_url, ...). */
export function withParams(url, params) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.toString();
}

/**
 * A storage state that is signed in to Studio AND has launched a game, so the
 * CDN's cookies are in it too. Reuses the saved one while it still works;
 * otherwise opens a visible Chrome on a persistent profile and waits for the
 * owner to sign in in an ordinary Chrome (see signInWithPlainChrome). The
 * password never passes through this process.
 */
export async function ensureSignedIn(chromium, cfg, log) {
  if (!cfg.signin && existsSync(STATE_FILE)) {
    const browser = await chromium.launch({ channel: CHANNEL, headless: true });
    try {
      const ctx = await browser.newContext({ storageState: STATE_FILE });
      const page = await ctx.newPage();
      const ok = await tryLaunch(page, launchUrl(cfg), 30_000);
      if (ok) return STATE_FILE;
    } catch {} finally { await browser.close(); }
    log('The saved Studio sign-in has expired.');
  }
  return signInWithPlainChrome(chromium, cfg, log);
}

/**
 * The sign-in goes through Google, and Google refuses any browser Playwright
 * LAUNCHED ("This browser or app may not be secure") - it sees the automation
 * flags. So this starts the system Chrome as an ordinary process, on the
 * runner's own profile, with a local debugging port, and touches nothing
 * while the owner signs in: it only polls the port's tab list over HTTP,
 * which attaches no debugger. Once a Studio page that is not the sign-in page
 * is open, it attaches, launches a game once (so the CDN's cookies are in the
 * state too), saves the storage state and closes the window.
 */
async function signInWithPlainChrome(chromium, cfg, log) {
  mkdirSync(DIR, { recursive: true });
  const exe = findChrome();
  const port = 9300 + Math.floor(Math.random() * 400);
  const chrome = spawn(exe, [`--user-data-dir=${PROFILE}`, `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check', `${STUDIO}`], { stdio: 'ignore' });
  log('A Chrome window is opening on Studio. Sign in there - this run carries on by itself once you have.');
  const tabs = async () => { try { return await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); } catch { return null; } };
  try {
    const t0 = Date.now();
    // Signed in = a Studio page that is not the sign-in page, and no sign-in or
    // Google page open, three polls running: an unsigned Studio page sits on
    // its own URL for a moment before it redirects.
    let steady = 0;
    while (steady < 3 && Date.now() - t0 < 15 * 60_000) {
      await new Promise(r => setTimeout(r, 1500));
      const list = await tabs();
      if (!list) { if (chrome.exitCode !== null) throw new Error('the sign-in window was closed before signing in'); continue; }
      const pages = list.filter(x => x.type === 'page');
      const studio = pages.some(x => /^https:\/\/studio\.engine\.io\//.test(x.url) && !/\/signin|\/login/.test(x.url));
      const signing = pages.some(x => /\/signin|\/login|accounts\.google\./.test(x.url));
      steady = studio && !signing ? steady + 1 : 0;
    }
    if (steady < 3) throw new Error('no sign-in within 15 minutes');
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    try {
      const ctx = browser.contexts()[0];
      const page = ctx.pages().find(p => /studio\.engine\.io/.test(p.url())) || await ctx.newPage();
      if (!(await tryLaunch(page, launchUrl(cfg), 45_000))) throw new Error('signed in, but the Studio play modal did not open a game');
      await ctx.storageState({ path: STATE_FILE });
    } finally { await browser.close().catch(() => {}); }
    log('Signed in; the sign-in is saved for the next runs.');
    return STATE_FILE;
  } finally { try { chrome.kill(); } catch {} }
}

function findChrome() {
  const c = [process.env.CHROME_PATH,
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'].filter(Boolean);
  const hit = c.find(p => existsSync(p));
  if (!hit) throw new Error('Google Chrome was not found; set CHROME_PATH to chrome.exe');
  return hit;
}

async function tryLaunch(page, url, ms) {
  // Checking the sign-in must not spend RGS budget: the modal's game would authenticate.
  await page.route(/^https:\/\/rgsd\.engine\.io\//, (r) => r.abort('blockedbyclient').catch(() => {})).catch(() => {});
  await page.goto(url).catch(() => {});
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (/\/signin/.test(page.url())) return false;
    const f = page.frames().find(fr => fr.url().includes('live.engine.io') && fr.url().includes('sessionID='));
    if (f) { await page.waitForTimeout(3000); return true; }
    await page.waitForTimeout(500);
  }
  return false;
}

/** Mint a demo session; returns the game's own URL (with its sessionID). */
export async function mintSession(ctx, opts) {
  const page = await ctx.newPage();
  // The modal's own copy of the game would authenticate too - one RGS call per
  // session spent on a page that closes at once. Only its URL is wanted.
  // 'blockedbyclient' (net::ERR_BLOCKED_BY_CLIENT), never the default
  // net::ERR_FAILED: that one is how an RGS refusal looks, and the gate would
  // pause the whole run for it (it did).
  await page.route(/^https:\/\/rgsd\.engine\.io\//, (r) => r.abort('blockedbyclient').catch(() => {}));
  try {
    await page.goto(launchUrl(opts));
    const t0 = Date.now();
    while (Date.now() - t0 < 45_000) {
      if (/\/signin/.test(page.url())) throw new Error('Studio sign-in expired - re-run with --signin');
      const f = page.frames().find(fr => fr.url().includes('live.engine.io') && fr.url().includes('sessionID='));
      if (f) return f.url();
      await page.waitForTimeout(400);
    }
    throw new Error('Studio did not open a game frame within 45s');
  } finally { await page.close().catch(() => {}); }
}
