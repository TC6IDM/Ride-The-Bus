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
 *   npm run shots -- --sizes --lang pl   -- any scenario in another locale
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
  tiers:
    flag('tiers') ||
    (!flag('sizes') && !flag('reduced') && !flag('intro') && !flag('board') && !flag('popups') && !flag('errors')),
  sizes:
    flag('sizes') ||
    (!flag('tiers') && !flag('reduced') && !flag('intro') && !flag('board') && !flag('popups') && !flag('errors')),
  headed: flag('headed'),
};

const replayUrl = (mode, event) =>
  `http://localhost:${GAME_PORT}/?replay=true&game=ride_the_bus&version=1` +
  `&mode=${mode}&event=${event}&rgs_url=localhost%3A${REPLAY_PORT}` +
  `&currency=USD&amount=1000000&lang=${opts.lang}`;

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

  /* setEmulatedMedia REPLACES the whole feature list on every call, so the two
     things that need emulating - reduced motion and a coarse pointer - have to
     be written together or the second silently clears the first. */
  let touch = false;
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
    async shot(name) {
      mkdirSync(OUT, { recursive: true });
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const file = path.join(OUT, `${name}.png`);
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
      console.log(`  ${tag}: ${state.title} ${state.amount}  [${state.titleFace}]`);
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
  // LET IT SETTLE. The intro rises in on a staggered entrance - ten elements at
  // 0.075s apart over a 0.52s animation, so the last lands about 1.2s after the
  // first. Shooting the moment .ss-continue exists caught every one of these
  // mid-flight, panels at different scales and offsets - which is exactly the
  // "staggered" reading a screenshot is supposed to settle.
  await sleep(2000);
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
  `http://localhost:${GAME_PORT}/?currency=USD&lang=${opts.lang}${extra}`;

/**
 * The board and the bar at rest, which no other mode captures.
 *
 * `rg` turns on the three responsible-gambling readouts, because the RG panel
 * is the second importer of readout.css and the only way to see whether that
 * sheet reached it is to render it.
 */
async function shootBoard(page, tag, rg) {
  await page.goto(plainUrl(rg ? '&dev_displayNetPosition=1&dev_displayRTP=1&dev_displaySessionTimer=1' : ''));
  if (!(await page.waitFor('.ss-continue'))) {
    console.log(`  ${tag}: no intro`);
    return;
  }
  await page.click('.ss-continue');
  await sleep(1400);
  if (!(await page.waitFor('footer'))) {
    console.log(`  ${tag}: never reached the board`);
    return;
  }
  await sleep(500);
  await page.shot(`board-${tag}`);
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
  ['advanced', '.cb-advanced', '.popup-advanced'],
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
  await page.goto(plainUrl());
  if (!(await page.waitFor('.ss-continue'))) {
    console.log('  ' + tag + ': no intro');
    return;
  }
  await page.click('.ss-continue');
  await sleep(1400);
  if (!(await page.waitFor('footer'))) {
    console.log('  ' + tag + ': never reached the board');
    return;
  }
  for (const [name, opener, panelSel] of PANELS) {
    await shootPanel(page, tag, name, opener, panelSel);
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
  // code, what it should prove
  ['ERR_VAL', 'a rejected bet - mapped message, Close'],
  ['ERR_IPB', 'not enough balance - mapped message, Close'],
  ['ERR_IS', 'dead session - mapped message, RELOAD instead of Close'],
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
        `&rgs_url=localhost%3A${REPLAY_PORT}&sessionID=shots-${code}`,
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
Board + bar  plain game, idle`);
    for (const [tag, w, h, mobile] of SIZES) {
      await page.viewport(w, h, mobile);
      await shootBoard(page, tag, tag === 'desktop');
    }
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
