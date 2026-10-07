/**
 * Drive the real game in a real browser and screenshot it.
 *
 *   npm run shots                 -- every tier, every target size
 *   npm run shots -- --tiers      -- the five win tiers, desktop only
 *   npm run shots -- --sizes      -- one max win at each target size
 *   npm run shots -- --mode hs_red_equal_equal_heart --event 975
 *   npm run shots -- --reduced    -- with prefers-reduced-motion: reduce
 *   npm run shots -- --intro      -- the intro and replay-details screens
 *   npm run shots -- --board      -- the idle board and control bar, every size
 *   npm run shots -- --popups     -- all eight panels, opened and tabbed through
 *   npm run shots -- --errors     -- the error dialog, one round refused per code
 *                                    (all eight RGS codes, and an unknown one)
 *   npm run shots -- --loader     -- the loading screen, every size
 *   npm run shots -- --reveal     -- a round mid-reveal: a card turning, a card
 *                                    landed, the held last card rising and at
 *                                    the top of its hold (with the tunnel)
 *   npm run shots -- --tips       -- the refusals: spin with nothing picked,
 *                                    Inside after Equal
 *   npm run shots -- --autoplay   -- a run in progress: the bar, the panel
 *                                    mid-run, and the bet and mode locked
 *   npm run shots -- --howto      -- How to Play scrolled top to bottom, and
 *                                    every game-mode tab
 *   npm run shots -- --resume     -- a round the RGS hands back as still active,
 *                                    finished on load (replay-server
 *                                    /__force-resume); --mode/--event pick it
 *   npm run shots -- --all        -- every scenario above, then reduced motion
 *   npm run shots -- --board --social        -- social mode (?social=true)
 *   npm run shots -- --board --operator turbo,autoplay
 *                    -- the operator's switches: turbo, superturbo, autoplay,
 *                       slamstop, spacebar off; rg turns the three
 *                       responsible-gambling readouts on
 *   npm run shots -- --board --query "&dev_minimumRoundDuration=3000"
 *                                        -- anything else, on every URL
 *   npm run shots -- --sizes --lang pl   -- any scenario in another locale
 *   npm run shots -- --board --family tr -- the board/panels on another family
 *                                           (opens the picker, confirms the row)
 *   npm run shots -- --tag trips ...      -- prefix every file of this run
 *   npm run shots -- --board --cur TZS --bet 200000 --balance 1e9
 *                                        -- the plain game in another currency
 *
 * Shots land in scripts/.shots/ (git-ignored).
 *
 * WHY THIS EXISTS. The win takeover was rewritten twice on the strength of the
 * intent recorded in its own stylesheet, and both times the intent was right and
 * the render was not: three ambient circles that composed into a smudge, sixteen
 * suit marks that never shared a start and read as dust, and the settled payout
 * printed legibly behind a blur while the count-up was still climbing. Every one
 * of those was invisible in the source and obvious in a screenshot. RGS_TEST_PLAN
 * also carries 94 checks that begin "look at".
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
  board: flag('board'),
  popups: flag('popups'),
  errors: flag('errors'),
  lang: value('lang', 'en'),
  /* The plain game's family. `--board` and `--popups` open the game with no
     round to replay, so nothing in the URL can pick a mode; the only way onto
     Second Chance, High Stakes or Three of a Kind is the way a player takes -
     the MODE button, a row, Switch. See switchFamily. */
  family: value('family', null),
  /* A prefix for every file this run writes, so two runs of the same scenario
     on different families or currencies do not overwrite each other. */
  tag: value('tag', ''),
  /* The plain game's currency, opening bet, balance and cap - the dev-session
     URL parameters game/dev/devSession.ts reads. Display units. */
  cur: value('cur', 'USD'),
  bet: value('bet', null),
  balance: value('balance', null),
  maxbet: value('maxbet', null),
  /* The rest of the app, which the scenarios above never reached: the loader,
     a reveal in flight, the refusals, a run of autoplay, How to Play past its
     first screen, and a resumed round. */
  loader: flag('loader'),
  reveal: flag('reveal'),
  tips: flag('tips'),
  autoplay: flag('autoplay'),
  howto: flag('howto'),
  resume: flag('resume'),
  all: flag('all'),
  /* Appended to EVERY URL a run opens, so any scenario can be shot in social
     mode or under an operator's jurisdiction block (game/dev/devOverrides.ts
     reads the dev_* flags). */
  social: flag('social'),
  operator: value('operator', ''),
  query: value('query', ''),
  headed: flag('headed'),
};

/* No scenario named means the original default: the tiers and the sizes. */
const SCENARIO_FLAGS = ['tiers', 'sizes', 'reduced', 'intro', 'board', 'popups', 'errors',
  'loader', 'reveal', 'tips', 'autoplay', 'howto', 'resume', 'all'];
const anyScenario = SCENARIO_FLAGS.some(flag);
opts.tiers = flag('tiers') || opts.all || !anyScenario;
opts.sizes = flag('sizes') || opts.all || !anyScenario;
for (const name of ['intro', 'board', 'popups', 'errors', 'loader', 'reveal', 'tips', 'autoplay', 'howto', 'resume']) {
  opts[name] = opts[name] || opts.all;
}

/** The operator's switches, by the names a person would use. */
const OPERATOR_FLAGS = {
  turbo: ['disabledTurbo'],
  superturbo: ['disabledSuperTurbo'],
  autoplay: ['disabledAutoplay'],
  slamstop: ['disabledSlamstop'],
  spacebar: ['disabledSpacebar'],
  rg: ['displayNetPosition', 'displayRTP', 'displaySessionTimer'],
};
const urlExtra = () => {
  const operator = opts.operator
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .flatMap((name) => {
      if (!OPERATOR_FLAGS[name]) {
        console.error(`--operator: unknown switch "${name}" (${Object.keys(OPERATOR_FLAGS).join(', ')})`);
        process.exit(1);
      }
      return OPERATOR_FLAGS[name].map((f) => `&dev_${f}=1`);
    })
    .join('');
  return (opts.social ? '&social=true' : '') + operator + opts.query;
};

/** The three sizes that stand for the range, for the slower scenarios. */
const KEY_SIZES = ['desktop', 'popout-s', 'mobile-s'];

const replayUrl = (mode, event) =>
  `http://localhost:${GAME_PORT}/?replay=true&game=ride_the_bus&version=1` +
  `&mode=${mode}&event=${event}&rgs_url=localhost%3A${REPLAY_PORT}` +
  `&currency=USD&amount=1000000&lang=${opts.lang}` +
  urlExtra();

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

  // /json/version answers before Chrome has opened its first tab, so a list
  // read straight after it can hold no page at all - and `target` came back
  // undefined and killed the run (seen with two drivers starting at once).
  // Wait for the tab; if one never appears, open one.
  let target = null;
  for (let i = 0; i < 50 && !target; i++) {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    target = targets.find((t) => t.type === 'page') ?? null;
    if (!target) await sleep(100);
  }
  if (!target) {
    target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  }
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

  /* setEmulatedMedia REPLACES the whole feature list on every call, so the two
     things that need emulating - reduced motion and a coarse pointer - have to
     be written together or the second silently clears the first. */
  let touch = false;
  // The current viewport, for a fast shot's clip.
  let size = { w: 1200, h: 675 };
  let reduced = false;
  const applyMedia = () => {
    const features = [];
    if (reduced) features.push({ name: 'prefers-reduced-motion', value: 'reduce' });
    if (touch) {
      features.push({ name: 'pointer', value: 'coarse' });
      features.push({ name: 'any-pointer', value: 'coarse' });
      features.push({ name: 'hover', value: 'none' });
      features.push({ name: 'any-hover', value: 'none' });
    }
    return send('Emulation.setEmulatedMedia', { features });
  };

  const page = {
    send,
    async viewport(w, h, mobile) {
      size = { w, h };
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

      // A PHONE ALSO HAS A FINGER, and setDeviceMetricsOverride does not say so.
      // `mobile: true` changes the viewport and the UA, and nothing else - the
      // page still matches (pointer: fine) and (hover: hover). This app leans on
      // the opposite in 13 places: every tap-target floor, and every hover rule
      // gated so it cannot stick on a touch screen. So for years the three
      // mobile sizes here were being measured as narrow desktops, and the floors
      // reported targets of 15-21px that a real phone never sees.
      touch = mobile;
      // maxTouchPoints must be 1-16 even when disabling - 0 is rejected outright.
      await send('Emulation.setTouchEmulationEnabled', {
        enabled: mobile,
        maxTouchPoints: 5,
      });
      await applyMedia();
    },
    async reducedMotion(on) {
      reduced = on;
      await applyMedia();
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
    /**
     * `fast` is for a MOMENT rather than a screen: a JPEG with Chrome's
     * optimizeForSpeed. The PNG at 2x took around a second here, which is
     * longer than a card takes to turn - a "mid-turn" shot came back with the
     * card landed, and a "held card" shot came back as the win takeover.
     * It is also drawn at 1x rather than the 2x device scale: at Desktop even
     * a fast JPEG of 2400x1350 outlasted the half-second a card takes to land.
     */
    async shot(name, { fast = false } = {}) {
      mkdirSync(OUT, { recursive: true });
      const { data } = await send(
        'Page.captureScreenshot',
        fast
          ? {
              format: 'jpeg',
              quality: 88,
              optimizeForSpeed: true,
              clip: { x: 0, y: 0, width: size.w, height: size.h, scale: 0.5 },
            }
          : { format: 'png' },
      );
      const file = path.join(OUT, `${prefix()}${name}.${fast ? 'jpg' : 'png'}`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      console.log(`  ${path.relative(ROOT, file)}`);
      return file;
    },
    /**
     * A REAL Tab keypress, not el.focus().
     *
     * This is the whole point of the popup pass. ':focus-visible' only matches
     * when the browser decides focus came from the keyboard, so a programmatic
     * .focus() reports the ring as absent on controls that do have one and
     * present on controls that do not. Dispatching the key through CDP is the
     * only way to read the ring the player actually sees.
     */
    async tab() {
      await page.key('Tab', 'Tab', 9);
    },
    async key(key, code, vk) {
      for (const type of ['rawKeyDown', 'keyUp']) {
        await send('Input.dispatchKeyEvent', {
          type,
          windowsVirtualKeyCode: vk,
          nativeVirtualKeyCode: vk,
          code,
          key,
        });
      }
      await sleep(90);
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
  // NOT a text match. This read /continue/i against .wc-prompt, which is a
  // TRANSLATED string - so a run in any locale but English would have sat here
  // until it timed out. .is-ready is the class the component sets for exactly
  // this state, and it says the same thing in all sixteen.
  "  settled: !!el.querySelector('.wc-prompt.is-ready'),",
  // Which font file the title actually got. game/ui/displayFace.ts picks that
  // per string, because unicode-range falls back PER CHARACTER and a partly
  // covered string renders in two faces inside a single word.
  "  titleFace: (() => { const n = el.querySelector('.wc-title'); if (!n) return null;",
  "    const cls = [...n.classList].find((c) => c.indexOf('face-') === 0) || 'face-display';",
  "    return cls + ' / ' + getComputedStyle(n).fontFamily.split(',')[0].replace(/[\"']/g, ''); })(),",
  "};",
].join('');

/** Load a replay and press play. Returns false if the round never got going. */
async function startRound(page, mode, event) {
  await page.goto(replayUrl(mode, event));
  // A replay opens straight on its round details since 2026-09-22 (Stake's spec
  // is load, then show Play - launchGuards.test.ts pins it). This used to wait
  // for the intro's continue first, and after that change every run printed
  // "round never started" at every size. Take the intro only if it is there.
  if (!(await page.waitFor('.ss-popup, .ss-continue'))) return false;
  if (!(await page.evaluate("return !!document.querySelector('.ss-popup');"))) {
    await page.click('.ss-continue');
    await sleep(1200);
    if (!(await page.waitFor('.ss-popup'))) return false;
  }
  await sleep(300);
  await page.click('.ss-play-btn');
  return true;
}

/**
 * Put the plain game on another family, the way a player does.
 *
 * MODE button -> the row -> Switch. The rows are picked by the family's own
 * colour variable (`--vol-<family>` on the row's inline style) rather than by
 * their label, which is translated, or their position, which is volatility
 * order and not publication order. Returns false if any step did not happen,
 * so a caller can say so instead of shooting Classic under a trips filename.
 */
async function switchFamily(page, family) {
  if (!(await page.click('.cb-mode-btn'))) return false;
  if (!(await page.waitFor('.popup-mode', 4000))) return false;
  await sleep(300);
  const picked = await page.evaluate(
    `const rows = [...document.querySelectorAll('.mode-option')];
     const row = rows.find((r) => (r.getAttribute('style') || '').indexOf('--vol-${family})') >= 0);
     if (!row) return 'no row';
     if (row.classList.contains('selected')) { row.click(); return 'already'; }
     row.click(); return 'picked';`,
  );
  if (picked === 'no row') return false;
  if (picked === 'already') {
    await sleep(300);
    return true;
  }
  if (!(await page.waitFor('.mode-confirm-go', 3000))) return false;
  await sleep(200);
  await page.click('.mode-confirm-go');
  await sleep(500);
  return !(await page.evaluate("return !!document.querySelector('.popup-mode');"));
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
      console.log(`  ${tag}: ${state.title} ${state.amount}  [${state.titleFace}]`);
      return;
    }
    // A round that never takes the screen over - a loss, or a win under the
    // entry tier - settles on the BOARD, and that board is worth a shot too:
    // it is the only place the bust cross, the "Busted" bar and the settled
    // Last Win readout can be seen together.
    if (!state) {
      const board = await page.evaluate(BOARD_SETTLED);
      if (board) {
        await sleep(900);
        await page.shot(`size-${tag}-board`);
        console.log(`  ${tag}: settled on the board - ${board}`);
        return;
      }
    }
    await sleep(160);
  }
  console.log(`  ${tag}: timed out`);
}

/** The running-win bar once a round has settled without a takeover. */
const BOARD_SETTLED = [
  "const bar = document.querySelector('.running-win.is-loss, .running-win.is-win');",
  'if (!bar) return null;',
  "return bar.textContent.trim().replace(/\\s+/g, ' ');",
].join('');

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
  // The intro is the PLAIN game's first screen. A replay opens straight on its
  // round details since 2026-09-22, so the two are shot from two URLs; this
  // used to reach both through a replay and printed "no intro" at every size.
  await page.goto(plainUrl());
  if (!(await page.waitFor('.ss-continue'))) {
    console.log(`  ${tag}: no intro`);
    return;
  }
  // LET IT SETTLE. The intro rises in on a staggered entrance - ten elements at
  // 0.075s apart over a 0.52s animation, so the last lands about 1.2s after the
  // first. Shooting the moment .ss-continue exists caught every one of these
  // mid-flight, panels at different scales and offsets - which is exactly the
  // "staggered" reading a screenshot is supposed to settle.
  await sleep(2000);
  await page.shot(`intro-${tag}`);
  await page.goto(replayUrl(opts.mode, opts.event));
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

/* ---- The board, read out of the live DOM ---------------------------------
   The takeover HIDES the bar's three readouts by design, so --sizes can never
   see them: a settled max win is the one screen where .cb-val being unstyled
   would look correct. This probe exists for the opposite reason - it measures
   the bar and board at rest, which is where the ControlBar / GameBoard /
   SessionReadouts split could go wrong without any test noticing.

   It reports COMPUTED styles, not classes. .cb-cap and .cb-val live in
   readout.css because two different components render them, and the failure
   mode that sheet was created to prevent is a rule that still exists and
   simply stops reaching one of them - which is invisible in the source and in
   every assertion currencies.test.ts makes. */
const BOARD_STATE = [
  "const one = (s) => document.querySelector(s);",
  "const all = (s) => [...document.querySelectorAll(s)];",
  "const bar = one('footer'); if (!bar) return null;",
  // A readout is only 'styled' if the money-fitting contract actually reached
  // it. nowrap + a real max-width is that contract; see readout.css.
  "const fit = (el) => { if (!el) return 'ABSENT';",
  "  const c = getComputedStyle(el);",
  "  const mw = c.maxWidth;",
  "  return c.whiteSpace + '/' + (mw === 'none' ? 'NO-MAX-WIDTH' : 'max') +",
  "    '/' + (el.getBoundingClientRect().height > 0 ? 'vis' : 'HIDDEN'); };",
  "return {",
  "  barRows: Math.round(bar.getBoundingClientRect().height),",
  "  barBottom: Math.round(window.innerHeight - bar.getBoundingClientRect().bottom),",
  "  caps: all('.cb-cap').length, vals: all('.cb-val').length,",
  "  val: fit(one('.cb-val')),",
  "  rgVal: fit(one('.rg-item .cb-val')),",
  "  rgPanel: one('.rg-panel') ? 'present' : 'absent',",
  "  squares: all('.choice-square').length,",
  "  cards: all('.card-slot').length,",
  "  spin: (() => { const b = one('.cb-spin'); return b ? (b.textContent.trim().replace(/\s+/g,' ') || '(icon only)') + (b.disabled ? ' [disabled]' : '') : 'ABSENT'; })(),",
  "  overflowX: document.documentElement.scrollWidth > window.innerWidth + 1",
  "    ? 'OVERFLOWS by ' + (document.documentElement.scrollWidth - window.innerWidth) + 'px'",
  "    : 'ok',",
  "};",
].join('');

/** The plain game - no replay, so the board sits idle with the bar live. */
const plainUrl = (extra = '') =>
  `http://localhost:${GAME_PORT}/?currency=${opts.cur}&lang=${opts.lang}` +
  (opts.bet ? `&bet=${opts.bet}` : '') +
  (opts.balance ? `&balance=${opts.balance}` : '') +
  (opts.maxbet ? `&maxbet=${opts.maxbet}` : '') +
  extra +
  urlExtra();

/**
 * Open the plain game and get past its intro onto the board.
 *
 * ONE RELOAD on a first load that never shows the intro. A full `--all` run on
 * a dev server that is compiling, or sharing the machine with another capture,
 * missed the 25s window exactly once in its first pass (board at desktop) and
 * passed on its own a minute later - a slow compile, not a defect, and not a
 * reason to lose that size from the run.
 */
async function openPlain(page, tag, extra = '') {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(plainUrl(extra));
    if (await page.waitFor('.ss-continue', attempt === 1 ? 25000 : 45000)) {
      await page.click('.ss-continue');
      await sleep(1400);
      if (await page.waitFor('footer')) return true;
      console.log(`  ${tag}: never reached the board`);
      return false;
    }
    console.log(`  ${tag}: no intro${attempt === 1 ? ' - reloading once' : ''}`);
  }
  return false;
}

/** `<tag>-` when a run was given one, so its files do not overwrite another's. */
const prefix = () => (opts.tag ? `${opts.tag}-` : '');

/**
 * The board and the bar at rest, which no other mode captures.
 *
 * `rg` turns on the three responsible-gambling readouts, because the RG panel
 * is the second importer of readout.css and the only way to see whether that
 * sheet reached it is to render it.
 */
async function shootBoard(page, tag, rg) {
  const rgFlags = rg ? '&dev_displayNetPosition=1&dev_displayRTP=1&dev_displaySessionTimer=1' : '';
  if (!(await openPlain(page, tag, rgFlags))) return;
  if (opts.family && !(await switchFamily(page, opts.family))) {
    console.log(`  ${tag}: could not switch to ${opts.family}`);
    return;
  }
  await sleep(500);
  await page.shot(`board-${opts.family ? opts.family + '-' : ''}${tag}`);
  const b = await page.evaluate(BOARD_STATE);
  if (!b) {
    console.log(`  ${tag}: no bar`);
    return;
  }
  console.log(
    `  ${tag}: bar ${b.barRows}px  cards ${b.cards}  squares ${b.squares}  ` +
      `caps ${b.caps} vals ${b.vals}  cb-val ${b.val}  ` +
      `rg ${b.rgPanel} ${b.rgVal}  spin "${b.spin}"  ${b.overflowX}`,
  );
}

/* ---- The panels ----------------------------------------------------------
   Eight panels, and until this existed the only way to judge any of them was to
   read the stylesheet. That is the exact habit that let a whole panel ship with
   no focus ring on any of its own controls: popup-sound.css has hover, active
   and disabled rules, so nothing about reading it says "this one is missing".

   So the probe TABS. It sends real Tab keys and, at each stop, records whether
   the focused control paints anything - because :focus-visible is a browser
   decision, not a stylesheet fact, and .focus() from script gets the answer
   wrong in both directions.

   It also reports where Tab GOES. Every panel declares aria-modal="true", which
   tells a screen reader the rest of the page is inert; if Tab walks out of the
   panel and onto the board, that claim is false. */
const PANELS = [
  ['turbo', '.cb-turbo', '.popup-turbo'],
  ['sound', '.cb-sound', '.popup-sound'],
  ['info', '.cb-info', '.popup-info'],
  ['mode', '.cb-mode-btn', '.popup-mode'],
  ['bet', '.cb-bet-display', '.popup-bet'],
  ['autospin', '.cb-autospin', '.popup-autospin'],
];

/**
 * What has focus, and whether ANYTHING on screen changed to say so.
 *
 * Reading the focused element alone is not good enough and the first version of
 * this cried wolf because of it: the bet field and the rounds field put their
 * indicator on the WRAPPER, via :focus-within, so the input itself is bare by
 * design and a probe that stops there reports a defect that is not one. Walking
 * up to find "an ancestor with a box-shadow" swaps that for the opposite error,
 * since .popup always has one.
 *
 * So this diffs. Snapshot every element in the panel before any tabbing, then
 * after each Tab compare - if nothing anywhere in the panel changed its outline,
 * box-shadow or border, then there is genuinely no focus indicator, wherever it
 * might have been drawn. That is the claim worth making, and it is the only one
 * that survives both designs.
 */
const PANEL_SNAPSHOT = (panelSel) =>
  [
    'const p = document.querySelector(' + JSON.stringify(panelSel) + '); if (!p) return [];',
    "return [...p.querySelectorAll('*')].map((e) => {",
    '  const c = getComputedStyle(e);',
    "  return c.outlineStyle + '|' + c.outlineWidth + '|' + c.outlineColor + '|' +",
    "    c.boxShadow + '|' + c.borderColor + '|' + c.backgroundColor;",
    '});',
  ].join('');

const FOCUS_STATE = (panelSel) =>
  [
    'const panel = document.querySelector(' + JSON.stringify(panelSel) + ');',
    'const el = document.activeElement;',
    "if (!el || el === document.body) return { where: 'BODY', name: '-' };",
    'return {',
    "  where: panel && panel.contains(el) ? 'in'",
    "    : (el.classList.contains('popup-backdrop') ? 'backdrop' : 'OUTSIDE'),",
    "  name: (el.classList[0] ? '.' + el.classList[0] : el.tagName.toLowerCase()),",
    '};',
  ].join('');

/**
 * The panel's own material, for the warm/cool question the audit turns on.
 *
 * `minPainted` is the smallest PAINTED control, which is not the smallest tap
 * target. Two controls deliberately grow their hit area with a transparent
 * ::before and leave the paint small - .switch in popup-advanced.css (44x32
 * around a ~17px track) and .equal-btn on the board - because each glyph was
 * drawn at a size and should stay there. getBoundingClientRect cannot see a
 * pseudo-element, so those read low and are NOT failures. Treat a number under
 * 24 as "check whether this one carries a pad", not as a defect.
 */
const PANEL_STATE = (panelSel) =>
  [
    'const p = document.querySelector(' + JSON.stringify(panelSel) + '); if (!p) return null;',
    'const c = getComputedStyle(p);',
    'const rgb = (v) => (v.match(/[0-9.]+/g) || []).slice(0, 3).map(Number);',
    'const bg = rgb(c.backgroundColor);',
    "const live = [...p.querySelectorAll('button, input, select, textarea, [tabindex]')]",
    '  .filter((e) => !e.disabled);',
    'const boxes = live',
    '  .map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); })',
    '  .filter((n) => n > 0);',
    'return {',
    "  bg: bg.join(','),",
    "  warm: bg.length === 3 ? (bg[0] >= bg[2] ? 'warm' : 'COOL') : '?',",
    '  controls: live.length,',
    '  minTarget: boxes.length ? Math.round(Math.min(...boxes)) : 0,',
    "  tint: c.getPropertyValue('--tint').trim() || '(default)',",
    '};',
  ].join('');

async function shootPanel(page, tag, name, opener, panelSel) {
  if (!(await page.click(opener))) {
    console.log('  ' + name + ': opener ' + opener + ' absent');
    return;
  }
  if (!(await page.waitFor(panelSel, 4000))) {
    console.log('  ' + name + ': never opened');
    return;
  }
  await sleep(420);
  await page.shot('popup-' + name + '-' + tag);

  const p = await page.evaluate(PANEL_STATE(panelSel));
  if (!p) {
    console.log('  ' + name + ': panel vanished');
    return;
  }

  // Walk it with real Tab keys. One stop past the control count, so an escape
  // out of the panel shows up instead of being cut off at the edge.
  const base = await page.evaluate(PANEL_SNAPSHOT(panelSel));
  const stops = [];
  for (let i = 0; i < Math.min(p.controls + 1, 14); i++) {
    await page.tab();
    const at = await page.evaluate(FOCUS_STATE(panelSel));
    const now = await page.evaluate(PANEL_SNAPSHOT(panelSel));
    at.ring = now.some((v, j) => v !== base[j]) ? 'yes' : 'NONE';
    stops.push(at);
  }
  const ringless = [...new Set(stops.filter((x) => x.where === 'in' && x.ring === 'NONE').map((x) => x.name))];
  const escaped = stops.findIndex((x) => x.where === 'OUTSIDE');

  console.log(
    '  ' + name + ': ' + p.warm + ' bg(' + p.bg + ')  tint ' + p.tint +
      '  ' + p.controls + ' controls  min painted ' + p.minTarget + 'px',
  );
  if (ringless.length) console.log('      NOTHING CHANGES ON FOCUS: ' + ringless.join(', '));
  if (escaped >= 0) {
    console.log('      TAB LEFT THE PANEL at stop ' + (escaped + 1) + ' -> ' + stops[escaped].name);
  }

  await page.key('Escape', 'Escape', 27);
  await sleep(200);
  if (await page.evaluate('return !!document.querySelector(' + JSON.stringify(panelSel) + ');')) {
    console.log('      ESCAPE DID NOT CLOSE IT');
    await page.click('.popup-close');
    await sleep(250);
  }
}

async function shootPopups(page, tag) {
  if (!(await openPlain(page, tag))) return;
  if (opts.family && !(await switchFamily(page, opts.family))) {
    console.log('  ' + tag + ': could not switch to ' + opts.family);
    return;
  }
  const fam = opts.family ? opts.family + '-' : '';
  for (const [name, opener, panelSel] of PANELS) {
    await shootPanel(page, fam + tag, name, opener, panelSel);
    await sleep(250);
    // The picker has a second screen the tab walk never reaches: the
    // confirmation a different row opens. Stake's checklist is about exactly
    // that screen (cost stated before a mode is activated), so it is shot on
    // its own - the first row that is not the live family, then Cancel.
    if (name === 'mode') await shootModeConfirm(page, fam + tag);
  }
}

async function shootModeConfirm(page, tag) {
  if (!(await page.click('.cb-mode-btn'))) return;
  if (!(await page.waitFor('.popup-mode', 4000))) return;
  await sleep(300);
  const row = await page.evaluate(
    "const r = document.querySelector('.mode-option:not(.selected)');" +
      "if (!r) return null; r.click(); return r.querySelector('.mode-option-name')?.textContent.trim();",
  );
  if (!row || !(await page.waitFor('.mode-confirm', 3000))) {
    console.log('  mode-confirm: no confirmation appeared');
  } else {
    await sleep(420);
    await page.shot('popup-mode-confirm-' + tag);
    const lines = await page.evaluate(
      "return [...document.querySelectorAll('.mode-confirm p, .mode-confirm-name')]" +
        ".map((n) => n.textContent.trim().replace(/\\s+/g, ' '));",
    );
    console.log('  mode-confirm (' + row + '): ' + lines.join('  |  '));
  }
  await page.key('Escape', 'Escape', 27);
  await sleep(250);
  if (await page.evaluate("return !!document.querySelector('.popup-mode');")) {
    await page.click('.popup-close');
    await sleep(250);
  }
}

/* ---- The error dialog -----------------------------------------------------
 * The one panel no opener reaches, and the only one a player cannot click away
 * from - so its keyboard behaviour is the only way out of it.
 *
 * It is also not ONE screen. ErrorModal maps eight documented RGS codes onto
 * eight sentences, and two of them (ERR_IS, ERR_ATE) swap the dialog's single
 * action from Close to Reload. Shooting "the error modal" therefore means
 * shooting several.
 *
 * GETTING THERE. Pointing rgs_url at a dead port does nothing, which is why an
 * earlier version of this reported "never appeared" and was right to: dev
 * supplies the balance and the limits through game/dev/devSession.ts, so
 * nothing calls /wallet/authenticate and no failure is raised until a round is
 * actually bought. Buying one means four guesses and a press of the spin
 * button, against an RGS that says no - which the local replay server now does
 * on request, see /__force-error in replay-server.mjs.
 */
const ERROR_CASES = [
  // code, what it should prove. All eight ErrorModal maps, then one it does
  // not - four of them used to be all this shot, so half the sentences a
  // player can be shown had never been looked at.
  ['ERR_VAL', 'a rejected bet - mapped message, Close'],
  ['ERR_IPB', 'not enough balance - mapped message, Close'],
  ['ERR_IS', 'dead session - mapped message, RELOAD instead of Close'],
  ['ERR_ATE', 'expired token - the dead-session message, RELOAD instead of Close'],
  ['ERR_GLE', 'a gambling limit reached - mapped message, Close'],
  ['ERR_LOC', 'a blocked location - mapped message, Close'],
  ['ERR_GEN', 'a server fault - mapped message, Close'],
  ['ERR_MAINTENANCE', 'maintenance - mapped message, Close'],
  ['ERR_NOPE', 'an unrecognised code - generic message, raw payload kept'],
];

/** Arm (or clear) a failure on the local replay RGS. */
async function forceError(code) {
  try {
    const r = await fetch(`http://localhost:${REPLAY_PORT}/__force-error/${code ?? 'off'}`);
    return r.ok;
  } catch {
    return false;
  }
}

/** Pick one option in each of the four guess columns. */
const PICK_GUESSES = [
  "const cols = [...document.querySelectorAll('.choice-column')];",
  'let n = 0;',
  'for (const col of cols) {',
  "  const b = col.querySelector('button:not([disabled]):not(.unavailable)');",
  '  if (b) { b.click(); n++; }',
  '}',
  'return n;',
].join('');

/** What the dialog is showing, and whether it honours its own contract. */
const ERROR_STATE = [
  "const m = document.querySelector('.err-modal'); if (!m) return null;",
  'const c = getComputedStyle(m);',
  'const rgb = (v) => (v.match(/[0-9.]+/g) || []).slice(0, 3).map(Number);',
  'const bg = rgb(c.backgroundColor);',
  "const txt = (sel) => { const n = m.querySelector(sel); return n ? n.textContent.trim() : null; };",
  'const labelledby = m.getAttribute(\'aria-labelledby\');',
  'const named = labelledby ? (document.getElementById(labelledby)?.textContent || \'\').trim() : null;',
  'return {',
  "  warm: bg.length === 3 ? (bg[0] >= bg[2] ? 'warm' : 'COOL') : '?',",
  "  title: txt('.err-title'), detail: txt('.err-detail'), code: txt('.err-code'),",
  "  action: txt('.err-actions .action-button'),",
  '  focusInside: m.contains(document.activeElement),',
  "  name: named || m.getAttribute('aria-label') || 'NONE',",
  '};',
].join('');

async function shootErrorModal(page, tag) {
  let any = false;

  for (const [code, why] of ERROR_CASES) {
    if (!(await forceError(code))) {
      console.log('  error: replay RGS is not answering /__force-error - is it running?');
      return;
    }

    // sessionID IS LOAD-BEARING, and leaving it out is why the first version of
    // this reported "the round did not fail" against a server that was armed
    // and waiting. resolveRoundSeed() in roundPlace.svelte.ts only reaches the
    // wallet when a sessionID AND an rgs_url are both present; without both, a
    // dev build falls through to a local client-side round generator that never
    // calls the RGS at all, so nothing can refuse it.
    await page.goto(
      `http://localhost:${GAME_PORT}/?currency=USD&lang=${opts.lang}` +
        `&rgs_url=localhost%3A${REPLAY_PORT}&sessionID=shots-${code}` +
        urlExtra(),
    );
    if (!(await page.waitFor('.ss-continue'))) {
      console.log(`  error/${code}: no intro`);
      continue;
    }
    await page.click('.ss-continue');
    await sleep(1400);
    if (!(await page.waitFor('footer'))) {
      console.log(`  error/${code}: never reached the board`);
      continue;
    }

    // Four guesses, then buy the round that is going to be refused.
    const picked = await page.evaluate(PICK_GUESSES);
    if (picked < 4) {
      console.log(`  error/${code}: only picked ${picked} of 4 guesses`);
      continue;
    }
    await sleep(350);
    await page.click('.cb-spin');

    if (!(await page.waitFor('.err-modal', 15000))) {
      console.log(`  error/${code}: no dialog (the round did not fail)`);
      continue;
    }
    await sleep(450);
    await page.shot(`popup-error-${code}-${tag}`);
    any = true;

    const st = await page.evaluate(ERROR_STATE);
    console.log(
      `  error/${code}: ${st.warm}  "${st.title}"  action "${st.action}"  ` +
        `focus inside: ${st.focusInside}  named: "${st.name}"`,
    );
    if (st.code) console.log(`      code line: ${st.code}`);
    if (st.detail) console.log(`      detail: ${st.detail.slice(0, 90)}`);
    console.log(`      (${why})`);

    // Escape: closes where a Close button exists, deliberately does NOT where
    // Reload is the only way back to a playable session.
    await page.key('Escape', 'Escape', 27);
    await sleep(250);
    const stillUp = await page.evaluate("return !!document.querySelector('.err-modal');");
    const reloadOnly = /reload/i.test(st.action || '');
    const correct = reloadOnly ? stillUp : !stillUp;
    console.log(
      `      escape ${stillUp ? 'kept it open' : 'closed it'} - ` +
        `${correct ? 'correct' : 'WRONG for this variant'}`,
    );
  }

  await forceError(null);
  if (!any) console.log('  error: no variant could be reached');
}

/* ---- The rest of the app ----------------------------------------------------
   Each of these shoots screens the scenarios above never reached. A coverage
   check on 2026-09-27 set every conditional branch in the components against
   every screen this script opened, and these were what nothing captured: the
   loader, a reveal in flight, the held last card, the refusals, a run of
   autoplay, How to Play past its first screen, and a resumed round. Each one
   prints what it saw, so a scenario that reaches nothing says so rather than
   leaving a folder of shots of the wrong screen. */

/** What the card row and its readout are doing, read off the live page. */
const REVEAL_STATE = [
  "const flipped = document.querySelectorAll('.card-row .card-inner.flipped').length;",
  "const held = document.querySelector('.card-slot.is-held');",
  'return {',
  '  flipped,',
  '  held: !!held,',
  "  climb: held ? parseFloat(held.style.getPropertyValue('--hold-climb')) || 0 : 0,",
  "  tunnel: !!document.querySelector('.is-closing'),",
  "  overlay: !!document.querySelector('.wc-overlay'),",
  "  label: document.querySelector('.running-win-label')?.textContent.trim() ?? '',",
  "  amount: document.querySelector('.running-win-amount')?.textContent.trim() ?? '',",
  '};',
].join('');

/** The loading screen - drawn first, held at least 1.4s once the game is ready. */
async function shootLoader(page, tag) {
  await page.goto(plainUrl(), 0);
  if (!(await page.waitFor('.game-loader', 15000))) {
    console.log(`  ${tag}: the loader never showed`);
    return;
  }
  await sleep(450); // its own entrance
  await page.shot(`loader-${tag}`);
  console.log(`  ${tag}: shot`);
  // Let it finish before the next navigation, so the next size starts clean.
  await page.waitFor('.ss-continue', 25000);
}

/**
 * A round in flight: a card turning (its figure not yet down - the rule is
 * that a result lands after the turn), a card landed with its chip and the
 * total, and - on a round with an Equal pick - the held last card rising and
 * then at the top of its hold, where the tunnel closes on a big enough stake.
 * --mode / --event pick the round; the default (the Max win) holds.
 */
async function shootReveal(page, tag) {
  if (!(await startRound(page, opts.mode, opts.event))) {
    console.log(`  ${tag}: round never started`);
    return;
  }
  // NO SLEEPS between noticing a moment and shooting it. Each moment is timed
  // from when the loop first SAW its trigger, and the loop keeps polling in
  // between - a sleep here is how an earlier version shot the takeover and
  // called it the held card. Each note carries the shot's delay after its
  // trigger, so a frame that came late says so.
  const done = new Set();
  const notes = [];
  const seen = {};
  const t0 = Date.now();
  const shoot = async (key, name, trigger) => {
    done.add(key);
    const lag = Date.now() - trigger;
    await page.shot(`reveal-${tag}-${name}`, { fast: true });
    return lag;
  };
  while (Date.now() - t0 < 60000) {
    const s = await page.evaluate(REVEAL_STATE);
    const now = Date.now();
    if (s.overlay) break;
    if (s.flipped >= 1) seen.flip1 ??= now;
    if (s.flipped >= 2) seen.flip2 ??= now;
    if (s.held) seen.held ??= now;
    // Card 1 on its way over: the face is past edge-on within ~60ms of a
    // 500ms turn, and its chip and the total must not be down until ~450ms.
    if (seen.flip1 && !done.has('turning')) {
      const lag = await shoot('turning', '1-card-turning', seen.flip1);
      const after = await page.evaluate(REVEAL_STATE);
      notes.push(`turning +${lag}ms (total then ${after.amount})`);
    }
    // Card 2 down, its chip and the new total with it.
    if (seen.flip2 && !done.has('landed') && now - seen.flip2 >= 650) {
      const lag = await shoot('landed', '2-card-landed', seen.flip2);
      notes.push(`landed +${lag}ms ${s.label} ${s.amount}`);
    }
    // The held last card: part-way up, and then at the top of its climb,
    // where it sits for a breath before the slam.
    if (seen.held && !done.has('rise') && now - seen.held >= 400) {
      const lag = await shoot('rise', '3-hold-rising', seen.held);
      notes.push(`rising +${lag}ms${s.tunnel ? ', tunnel closing' : ''}`);
    }
    if (seen.held && s.climb > 0 && !done.has('top') && now - seen.held >= s.climb + 100) {
      const lag = await shoot('top', '4-hold-top', seen.held);
      notes.push(`top +${lag}ms of a ${Math.round(s.climb)}ms climb${s.tunnel ? ', tunnel closed' : ', NO tunnel'}`);
    }
    await sleep(30);
  }
  if (!seen.held) notes.push('no hold on this round');
  console.log(`  ${tag}: ${notes.join('  |  ') || 'nothing captured'}`);
}

/** The two refusals a player meets first: spin with nothing picked, and Inside
 *  after Equal. Each answers with a tip that says why. */
async function shootTips(page, tag) {
  if (!(await openPlain(page, tag))) return;
  await page.click('.cb-spin');
  await sleep(350);
  const spinTip = await page.evaluate("return !!document.querySelector('.cb-cooldown-tip.is-shown');");
  await page.shot(`tip-spin-blocked-${tag}`);
  await page.click('.hl-square .equal-btn');
  await sleep(250);
  await page.click('.io-square .inside-half');
  await sleep(350);
  const insideTip = await page.evaluate("return !!document.querySelector('.choice-tip');");
  await page.shot(`tip-inside-unavailable-${tag}`);
  console.log(
    `  ${tag}: spin tip ${spinTip ? 'shown' : 'MISSING'}, inside tip ${insideTip ? 'shown' : 'MISSING'}`,
  );
}

/**
 * A run of autoplay: the bar counting down, the panel opened mid-run (it stays
 * openable - the stops live there - with the count locked and Stop offered),
 * and the stake and the mode refusing a press while it runs, each with its tip.
 * Local rounds: no sessionID, so dev deals them itself and no RGS is needed.
 */
async function shootAutoplay(page, tag) {
  if (!(await openPlain(page, tag))) return;
  const picked = await page.evaluate(PICK_GUESSES);
  if (picked < 4) {
    console.log(`  ${tag}: only picked ${picked} of 4 guesses`);
    return;
  }
  await page.click('.cb-autospin');
  if (!(await page.waitFor('.popup-autospin', 4000))) {
    console.log(`  ${tag}: the autoplay panel never opened`);
    return;
  }
  await sleep(300);
  await page.evaluate(
    "const p = [...document.querySelectorAll('.popup-autospin .spin-pill')].find((b) => b.textContent.trim() === '10');" +
      'if (p) p.click(); return !!p;',
  );
  await sleep(200);
  await page.click('.popup-autospin .popup-start');
  await sleep(1800);
  const count = await page.evaluate("return document.querySelector('.cb-spin-count')?.textContent.trim() ?? null;");
  await page.shot(`autoplay-running-${tag}`);

  await page.click('.cb-autospin');
  if (await page.waitFor('.popup-autospin', 4000)) {
    await sleep(450);
    await page.shot(`autoplay-panel-running-${tag}`);
    await page.key('Escape', 'Escape', 27);
    await sleep(300);
  }

  await page.click('.cb-bet-display');
  await sleep(350);
  const betTip = await page.evaluate("return !!document.querySelector('.cb-bet-tip.is-shown');");
  await page.shot(`autoplay-bet-locked-${tag}`);
  await sleep(2600); // let that tip go before raising the next
  await page.click('.cb-mode-btn');
  await sleep(350);
  const modeTip = await page.evaluate("return !!document.querySelector('.cb-mode-tip.is-shown');");
  await page.shot(`autoplay-mode-locked-${tag}`);

  // Stop the run from its own panel, so the next size starts on a quiet board.
  await page.click('.cb-autospin');
  if (await page.waitFor('.popup-autospin', 4000)) {
    await sleep(300);
    await page.click('.popup-autospin .popup-start');
    await sleep(300);
  }
  console.log(
    `  ${tag}: counter ${count ?? 'MISSING'}, bet tip ${betTip ? 'shown' : 'MISSING'}, ` +
      `mode tip ${modeTip ? 'shown' : 'MISSING'}`,
  );
}

/**
 * How to Play, all of it: the longest screen in the game, and the only one
 * whose first screen is a fraction of it. Top to bottom a screen at a time,
 * overlapping by a fifth so no line is only ever seen cut in half - and then
 * each game-mode tab, scrolled to sit just under the pinned header.
 */
async function shootHowTo(page, tag) {
  if (!(await openPlain(page, tag))) return;
  await page.click('.cb-info');
  if (!(await page.waitFor('.popup-info', 4000))) {
    console.log(`  ${tag}: How to Play never opened`);
    return;
  }
  await sleep(450);
  const steps = await page.evaluate(
    "const p = document.querySelector('.popup-info');" +
      'return Math.max(1, Math.ceil((p.scrollHeight - p.clientHeight) / (p.clientHeight * 0.8)) + 1);',
  );
  const n = Math.min(steps, 14);
  for (let i = 0; i < n; i++) {
    await page.evaluate(
      "const p = document.querySelector('.popup-info');" +
        `p.scrollTop = ${i} * p.clientHeight * 0.8; return p.scrollTop;`,
    );
    await sleep(250);
    await page.shot(`howto-${tag}-${String(i + 1).padStart(2, '0')}`);
  }
  const tabs = await page.evaluate("return document.querySelectorAll('.popup-info .mode-tab').length;");
  for (let i = 0; i < tabs; i++) {
    const name = await page.evaluate(
      "const p = document.querySelector('.popup-info');" +
        `const tab = p.querySelectorAll('.mode-tab')[${i}];` +
        "const head = p.querySelector('.popup-head');" +
        'tab.click();' +
        'p.scrollTop = Math.max(0, tab.getBoundingClientRect().top - p.getBoundingClientRect().top' +
        ' + p.scrollTop - (head ? head.offsetHeight : 0) - 8);' +
        `return (tab.firstChild && tab.firstChild.textContent.trim()) || String(${i});`,
    );
    await sleep(300);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || String(i + 1);
    await page.shot(`howto-${tag}-tab-${slug}`);
  }
  console.log(`  ${tag}: ${n} screens${steps > n ? ` (of ${steps})` : ''}, ${tabs} mode tabs`);
  await page.key('Escape', 'Escape', 27);
}

/**
 * A round the RGS hands back as still active - the player closed the game
 * mid-round - finished on load. Armed on the replay server (/__force-resume),
 * which puts it on the next /wallet/authenticate; the sessionID is what makes
 * dev authenticate at all (see --errors). --mode / --event pick the round.
 */
async function shootResume(page, tag) {
  const resumeRgs = (what) => fetch(`http://localhost:${REPLAY_PORT}/__force-resume/${what}`).then((r) => r.ok).catch(() => false);
  if (!(await resumeRgs(`${opts.mode}/${opts.event}`))) {
    console.log(`  ${tag}: the replay RGS would not arm a resume - restart it (it predates /__force-resume)`);
    return;
  }
  try {
    await page.goto(plainUrl(`&rgs_url=localhost%3A${REPLAY_PORT}&sessionID=shots-resume-${tag}`), 0);
    let dealt = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      if (await page.evaluate("return !!document.querySelector('.ss-continue');")) {
        await page.click('.ss-continue');
        await sleep(600);
      }
      const s = await page.evaluate(REVEAL_STATE);
      if (!dealt && s.flipped >= 2) {
        dealt = true;
        await sleep(700);
        await page.shot(`resume-${tag}-1-dealing`);
      }
      const overlay = await page.evaluate(OVERLAY_STATE);
      if (overlay?.settled) {
        await sleep(600);
        await page.shot(`resume-${tag}-2-settled`);
        console.log(`  ${tag}: resumed and settled - ${overlay.title} ${overlay.amount}`);
        return;
      }
      if (dealt && !overlay) {
        const board = await page.evaluate(
          "const bar = document.querySelector('.running-win.is-loss, .running-win.is-win, .running-win.is-partial');" +
            "return bar ? bar.textContent.trim().replace(/\\s+/g, ' ') : null;",
        );
        if (board) {
          await sleep(900);
          await page.shot(`resume-${tag}-2-settled`);
          console.log(`  ${tag}: resumed and settled on the board - ${board}`);
          return;
        }
      }
      await sleep(150);
    }
    console.log(`  ${tag}: ${dealt ? 'resumed but never settled' : 'the round never resumed'}`);
  } finally {
    // Never leave a resume armed for whatever authenticates next.
    await resumeRgs('off');
  }
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

  if (opts.popups) {
    console.log('\nPanels  all eight, opened and tabbed');
    for (const [tag, w, h, mobile] of SIZES) {
      await page.viewport(w, h, mobile);
      console.log('\n  -- ' + tag + ' ' + w + 'x' + h);
      await shootPopups(page, tag);
    }

    // The error dialog runs ONCE, at desktop, because each variant is a whole
    // ROUND rather than a panel open - four guesses and a refused purchase. Its
    // shape does not change with the viewport either; what differs between the
    // four is the sentence and the button, and neither is a size question.
    console.log('');
    console.log('  -- error dialog (desktop, one round per variant)');
    await page.viewport(1200, 675, false);
    await shootErrorModal(page, 'desktop');
  }

  if (opts.errors && !opts.popups) {
    console.log('');
    console.log('Error dialog  one refused round per code');
    await page.viewport(1200, 675, false);
    await shootErrorModal(page, 'desktop');
  }

  if (opts.board) {
    console.log(`
Board + bar  plain game, idle${opts.family ? ' on ' + opts.family : ''}  ${opts.cur}`);
    for (const [tag, w, h, mobile] of SIZES) {
      await page.viewport(w, h, mobile);
      await shootBoard(page, tag, tag === 'desktop');
    }
  }

  const sweep = async (label, sizes, fn) => {
    console.log(`\n${label}`);
    for (const [tag, w, h, mobile] of SIZES) {
      if (sizes && !sizes.includes(tag)) continue;
      await page.viewport(w, h, mobile);
      await fn(page, tag);
    }
  };
  if (opts.loader) await sweep('Loader', null, shootLoader);
  if (opts.reveal) await sweep(`Reveal  ${opts.mode} #${opts.event}`, null, shootReveal);
  if (opts.tips) await sweep('Refusals  spin with nothing picked, Inside after Equal', KEY_SIZES, shootTips);
  if (opts.autoplay) await sweep('Autoplay  a run of 10, mid-run', KEY_SIZES, shootAutoplay);
  if (opts.howto) await sweep('How to Play  every screen, every tab', KEY_SIZES, shootHowTo);
  if (opts.resume) await sweep(`Resume  ${opts.mode} #${opts.event}, active on authenticate`, ['desktop', 'mobile-s'], shootResume);

  // --all ends on the reduced-motion pass, rather than running everything
  // reduced: it is the one scenario that is about that setting.
  if (opts.all) {
    console.log(`\nReduced motion  ${opts.mode} #${opts.event}`);
    await page.viewport(1200, 675, false);
    await page.reducedMotion(true);
    await shootTiers(page, 'tier-reduced');
    await page.reducedMotion(false);
  }

  if (opts.reduced && !opts.tiers && !opts.sizes && !opts.intro && !opts.board) {
    console.log(`\nReduced motion  ${opts.mode} #${opts.event}`);
    await page.viewport(1200, 675, false);
    await shootTiers(page, 'tier-reduced');
  }
} finally {
  page.close();
}
console.log(`\nShots in ${path.relative(ROOT, OUT)}\n`);
