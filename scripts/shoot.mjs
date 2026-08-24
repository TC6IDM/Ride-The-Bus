/**
 * Drive the real game in a real browser and screenshot it.
 *
 *   npm run shots                 -- every tier, every target size
 *   npm run shots -- --tiers      -- the five win tiers, desktop only
 *   npm run shots -- --sizes      -- one max win at each target size
 *   npm run shots -- --mode hs_red_equal_equal_heart --event 975
 *   npm run shots -- --reduced    -- with prefers-reduced-motion: reduce
 *   npm run shots -- --intro      -- the intro and replay-details screens
 *
 * Shots land in scripts/.shots/ (git-ignored).
 *
 * WHY THIS EXISTS. The win takeover was rewritten twice on the strength of the
 * intent recorded in its own stylesheet, and both times the intent was right and
 * the render was not: three ambient circles that composed into a smudge, sixteen
 * suit marks that never shared a start and read as dust, and the settled payout
 * printed legibly behind a blur while the count-up was still climbing. Every one
 * of those was invisible in the source and obvious in a screenshot. RGS_TEST_PLAN
 * also carries 52 checks that begin "look at".
 *
 * WHY NO PLAYWRIGHT. Node 22+ ships a WebSocket client and Playwright's chromium
 * is already on disk from some other install, so the DevTools Protocol is
 * reachable with nothing added to package.json. That matters more here than
 * usual: config-svelte sets bundleStrategy "inline", so everything Vite processes
 * is base64'd into index.html, and bundle size is an explicit 3-star criterion.
 * A dev-only dependency would not reach the bundle, but the habit of adding one
 * is what puts things there. If chromium is missing, CHROME_PATH can point at any
 * Chrome or Edge.
 *
 * It needs the game and the local replay RGS running:  npm run dev:replay
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scripts/.shots');

const GAME_PORT = Number(process.env.GAME_PORT || 3001);
const REPLAY_PORT = Number(process.env.REPLAY_PORT || 3010);

const CHROME =
  process.env.CHROME_PATH ||
  path.join(
    process.env.LOCALAPPDATA || '',
    'ms-playwright/chromium-1234/chrome-win64/chrome.exe',
  );

/** The seven target screen sizes from CLAUDE.md, minus Desktop which is the default. */
const SIZES = [
  ['desktop', 1200, 675, false],
  ['laptop', 1024, 576, false],
  ['popout-l', 800, 450, false],
  ['popout-s', 400, 225, false],
  ['mobile-l', 425, 812, true],
  ['mobile-m', 375, 667, true],
  ['mobile-s', 320, 568, true],
];

/**
 * The one mode per family that actually reaches its family ceiling, and so is
 * the only one that fires the MAX WIN tier. Every other combination stops short
 * - see the note on scenarios() in replay-server.mjs.
 */
const MAX_WIN_EVENT = 975;
const DEFAULT_MODE = 'red_equal_equal_heart';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- Argument parsing ---------------------------------------------------- */
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const opts = {
  mode: value('mode', DEFAULT_MODE),
  event: value('event', String(MAX_WIN_EVENT)),
  reduced: flag('reduced'),
  intro: flag('intro'),
  tiers: flag('tiers') || (!flag('sizes') && !flag('reduced') && !flag('intro')),
  sizes: flag('sizes') || (!flag('tiers') && !flag('reduced') && !flag('intro')),
  headed: flag('headed'),
};

const replayUrl = (mode, event) =>
  `http://localhost:${GAME_PORT}/?replay=true&game=ride_the_bus&version=1` +
  `&mode=${mode}&event=${event}&rgs_url=localhost%3A${REPLAY_PORT}` +
  `&currency=USD&amount=1000000&lang=en`;

/* ---- The browser --------------------------------------------------------- */
async function launch() {
  const port = 9200 + Math.floor(Math.random() * 500);
  const userDir = mkdtempSync(path.join(tmpdir(), 'rtb-shot-'));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    'about:blank',
  ];
  if (!opts.headed) args.unshift('--headless=new');
  const proc = spawn(CHROME, args, { stdio: 'ignore' });

  let version = null;
  for (let i = 0; i < 120; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      break;
    } catch {
      await sleep(100);
    }
  }
  if (!version) {
    proc.kill();
    throw new Error(
      `Chrome did not start. Looked for:\n  ${CHROME}\n` +
        'Set CHROME_PATH to a Chrome or Edge binary.',
    );
  }

  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { res, rej } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const n = ++id;
      pending.set(n, { res, rej });
      ws.send(JSON.stringify({ id: n, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');

  const page = {
    send,
    async viewport(w, h, mobile) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        // 2 so text and card pips are legible in the capture. It does NOT change
        // layout - --ui is driven by vw/vh, which are CSS pixels.
        deviceScaleFactor: 2,
        mobile,
        screenWidth: w,
        screenHeight: h,
      });
    },
    async reducedMotion(on) {
      await send('Emulation.setEmulatedMedia', {
        features: on ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [],
      });
    },
    async goto(url, waitMs = 6000) {
      await send('Page.navigate', { url });
      await sleep(waitMs);
    },
    async evaluate(body) {
      const r = await send('Runtime.evaluate', {
        expression: `(async () => { ${body} })()`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      }
      return r.result.value;
    },
    click(selector) {
      return page.evaluate(
        `const el = document.querySelector(${JSON.stringify(selector)});
         if (!el) return false; el.click(); return true;`,
      );
    },
    async waitFor(selector, timeout = 25000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        if (await page.evaluate(`return !!document.querySelector(${JSON.stringify(selector)});`)) {
          return true;
        }
        await sleep(150);
      }
      return false;
    },
    async shot(name) {
      mkdirSync(OUT, { recursive: true });
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT, `${name}.png`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      console.log(`  ${path.relative(ROOT, file)}`);
      return file;
    },
    close() {
      try {
        ws.close();
      } catch {
        /* the socket is going away anyway */
      }
      proc.kill();
      try {
        rmSync(userDir, { recursive: true, force: true });
      } catch {
        /* Windows sometimes still has a handle on the profile; it is in TEMP */
      }
    },
  };
  return page;
}

/* ---- The overlay's state, read out of the live DOM ----------------------- */
const OVERLAY_STATE = [
  "const el = document.querySelector('.wc-overlay'); if (!el) return null;",
  "const text = (s) => { const n = el.querySelector(s); return n ? n.textContent.trim() : null; };",
  "return {",
  "  tier: (el.className.match(/tier-[a-z]+/) || [null])[0],",
  "  title: text('.wc-title'), amount: text('.wc-amount'), prompt: text('.wc-prompt'),",
  "  fan: [...el.querySelectorAll('.wc-fan-card')].map(c =>",
  "    c.className.indexOf('is-face') >= 0 ? (c.textContent.trim() || 'face') : 'back'),",
  "  settled: /continue/i.test(text('.wc-prompt') || ''),",
  "};",
].join('');

/** Load a replay and press play. Returns false if the round never got going. */
async function startRound(page, mode, event) {
  await page.goto(replayUrl(mode, event));
  if (!(await page.waitFor('.ss-continue'))) return false;
  await page.click('.ss-continue');
  await sleep(1200);
  if (!(await page.waitFor('.ss-popup'))) return false;
  await page.click('.ss-play-btn');
  return true;
}

/**
 * Shoot every tier the count-up climbs through.
 *
 * A max win passes big -> huge -> mega -> epic -> max on its way up, so one
 * round is a shot of all five rather than five rounds.
 */
async function shootTiers(page, tag) {
  if (!(await startRound(page, opts.mode, opts.event))) {
    console.log(`  ${tag}: round never started`);
    return;
  }
  const seen = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    const state = await page.evaluate(OVERLAY_STATE);
    if (state?.tier && !seen.has(state.tier)) {
      seen.add(state.tier);
      // A beat after the promotion, so the burst is mid-flight and the count has
      // moved off the floor - shooting on the transition catches neither.
      await sleep(700);
      await page.shot(`${tag}-${String(seen.size).padStart(2, '0')}-${state.tier}`);
    }
    if (state?.settled) {
      await sleep(700);
      await page.shot(`${tag}-settled`);
      console.log(`  ${tag}: ${state.title} ${state.amount}  fan [${state.fan.join(' ')}]`);
      return;
    }
    await sleep(160);
  }
  console.log(`  ${tag}: timed out; saw ${[...seen].join(', ') || 'nothing'}`);
}

/** One settled max win at a given size. */
async function shootSize(page, tag) {
  if (!(await startRound(page, opts.mode, opts.event))) {
    console.log(`  ${tag}: round never started`);
    return;
  }
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    const state = await page.evaluate(OVERLAY_STATE);
    if (state?.settled) {
      await sleep(700);
      await page.shot(`size-${tag}`);
      console.log(`  ${tag}: ${state.title} ${state.amount}`);
      return;
    }
    await sleep(160);
  }
  console.log(`  ${tag}: timed out`);
}

/**
 * The two screens before the board: the intro's four dealt panels, and the
 * replay round-details panel.
 *
 * Both are worth a size sweep of their own. The intro panels are a FAN - four
 * cards spread left to right - and wrapping them 2-per-row on a phone splits
 * that fan into two half-fans leaning off opposite sides unless the tilts are
 * re-dealt, which is invisible in the source. The details panel restates the
 * bet in the choice colours, which have to be the board's own.
 */
async function shootIntro(page, tag) {
  await page.goto(replayUrl(opts.mode, opts.event));
  if (!(await page.waitFor('.ss-continue'))) {
    console.log(`  ${tag}: no intro`);
    return;
  }
  await page.shot(`intro-${tag}`);
  await page.click('.ss-continue');
  await sleep(1200);
  if (!(await page.waitFor('.ss-popup'))) {
    console.log(`  ${tag}: no replay details`);
    return;
  }
  await sleep(400);
  await page.shot(`details-${tag}`);
  const rows = await page.evaluate(
    "return [...document.querySelectorAll('.ss-detail-row')]" +
      ".map(r => [...r.children].map(c => c.textContent.trim()).join(' = '));",
  );
  console.log(`  ${tag}: ${rows.join('  |  ')}`);
}

/* ---- Run ----------------------------------------------------------------- */
const reachable = await fetch(`http://localhost:${GAME_PORT}/`)
  .then(() => true)
  .catch(() => false);
if (!reachable) {
  console.error(`Nothing serving on localhost:${GAME_PORT}. Start it with:\n\n    npm run dev:replay\n`);
  process.exit(1);
}

const page = await launch();
try {
  if (opts.reduced) await page.reducedMotion(true);
  const suffix = opts.reduced ? '-reduced' : '';

  if (opts.tiers) {
    console.log(`\nTiers  ${opts.mode} #${opts.event}${suffix}`);
    await page.viewport(1200, 675, false);
    await shootTiers(page, `tier${suffix}`);
  }

  if (opts.sizes) {
    console.log(`\nSizes  ${opts.mode} #${opts.event}${suffix}`);
    for (const [tag, w, h, mobile] of SIZES) {
      await page.viewport(w, h, mobile);
      await shootSize(page, `${tag}${suffix}`);
    }
  }

  if (opts.intro) {
    console.log(`
Intro + details  ${opts.mode} #${opts.event}`);
    for (const [tag, w, h, mobile] of SIZES) {
      await page.viewport(w, h, mobile);
      await shootIntro(page, tag);
    }
  }

  if (opts.reduced && !opts.tiers && !opts.sizes && !opts.intro) {
    console.log(`\nReduced motion  ${opts.mode} #${opts.event}`);
    await page.viewport(1200, 675, false);
    await shootTiers(page, 'tier-reduced');
  }
} finally {
  page.close();
}
console.log(`\nShots in ${path.relative(ROOT, OUT)}\n`);
