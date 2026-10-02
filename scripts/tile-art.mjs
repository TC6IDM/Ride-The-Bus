/**
 * Render Stake's lobby tile from the game itself.
 *
 *   node scripts/tile-art.mjs                 -- writes submission/RideTheBus-FG.png and -BG.jpg
 *   node scripts/tile-art.mjs --out <dir>     -- somewhere else, to look before replacing
 *   node scripts/tile-art.mjs --cups          -- keep the party cups on the table
 *
 * Needs the game and the replay RGS running (npm run dev:replay; GAME_PORT
 * picks the port, as for scripts/shoot.mjs).
 *
 * WHY RENDERED. The tile this replaced was generated art - a Jack with a
 * garbled lower half, a droplet for a spade, sparks and cut-out debris, over a
 * backyard party the game never shows - and Stake names "generic AI-generated
 * assets" as a cause of a low rating. Both layers are now photographs of the
 * game: the foreground is ?dev_tile=fg (components/dev/DevTile.svelte), the
 * real CardFace hand on a transparent ground; the background is the live
 * table with the board's furniture hidden. Change the cards or the table and
 * this regenerates a tile that still matches.
 *
 * THE CUPS ARE LEFT OFF by default. The tile is the one image a player sees
 * before choosing the game, and drinking props on it sit closest to Stake's
 * "appeal to underage persons" line; whether the table keeps them in the game
 * is the owner's open decision (status.md). --cups puts them back.
 *
 * Stake's limits (stake-approval, "Game tile visual assets"): the foreground a
 * transparent PNG, the background PNG or JPG, the two under 3 MB together.
 * This checks the sum and fails rather than writing an oversized pair.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const OUT = path.resolve(args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(ROOT, 'submission'));
const CUPS = args.includes('--cups');
const GAME = `http://localhost:${Number(process.env.GAME_PORT || 3001)}`;
const CHROME = process.env.CHROME_PATH || path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1234/chrome-win64/chrome.exe');
const MAX_PAIR_BYTES = 3 * 1024 * 1024;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(path.join(tmpdir(), 'rtb-tile-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });

let target;
for (let i = 0; i < 100 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
if (!target) throw new Error('Chrome did not start; set CHROME_PATH');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }).then((m) => { if (m.error) throw new Error(`${method}: ${m.error.message}`); return m.result; });
const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const waitFor = async (expr, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await evalJs(expr)) return; await sleep(150); } throw new Error(`timed out waiting for ${expr}`); };
const addStyle = (css) => evalJs(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(css)}; document.head.append(s); })()`);
await send('Page.enable');

try {
  mkdirSync(OUT, { recursive: true });

  // ---- Foreground: the hand, on nothing ------------------------------------
  // 800 CSS px at 2x = 1600 px square. Everything but the composition is
  // hidden rather than removed, so no layout under it moves - EXCEPT the court
  // sprite: a <use> instance takes the styles its original matched, so hiding
  // the sprite's host (a zero-size <svg> under <body>, courtArt.svelte.ts) blanks
  // every court figure while leaving their frames drawn.
  await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 800, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: `${GAME}/?dev_tile=fg&currency=USD&lang=en` });
  await waitFor(`document.querySelector('.dev-tile')?.dataset.courtsReady === 'true'`);
  await addStyle(`html, body { background: transparent !important; }
    body * { visibility: hidden !important; animation: none !important; }
    .dev-tile, .dev-tile * { visibility: visible !important; }
    body > svg[aria-hidden='true'] * { visibility: visible !important; }`);
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await evalJs('document.fonts.ready.then(() => true)');
  await sleep(600);
  const fg = Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64');
  await send('Emulation.setDefaultBackgroundColorOverride', {});

  // ---- Background: the room, the table, the chips, the deck ----------------
  // 1536 x 1024 (the old background's 3:2) at 1.25x = 1920 x 1280.
  await send('Emulation.setDeviceMetricsOverride', { width: 1536, height: 1024, deviceScaleFactor: 1.25, mobile: false });
  await send('Page.navigate', { url: `${GAME}/?currency=USD&lang=en` });
  await waitFor(`!!document.querySelector('.ss-continue')`);
  await sleep(800);
  for (let k = 0; k < 40 && (await evalJs(`!!document.querySelector('.ss-continue')`)); k++) {
    await evalJs(`document.querySelector('.ss-continue')?.click()`);
    await sleep(300);
  }
  await waitFor(`!!document.querySelector('.scene .table')`);
  await addStyle(`.game-layout * { visibility: hidden !important; }
    .scene, .scene * { visibility: visible !important; }
    ${CUPS ? '' : '.scene .cup, .scene .cup * { visibility: hidden !important; }'}`);
  await sleep(800);
  const bg = Buffer.from((await send('Page.captureScreenshot', { format: 'jpeg', quality: 90 })).data, 'base64');

  const total = fg.length + bg.length;
  if (total > MAX_PAIR_BYTES) throw new Error(`foreground + background is ${(total / 1048576).toFixed(2)} MB; Stake's limit is 3 MB`);
  writeFileSync(path.join(OUT, 'RideTheBus-FG.png'), fg);
  writeFileSync(path.join(OUT, 'RideTheBus-BG.jpg'), bg);
  console.log(`RideTheBus-FG.png  1600 x 1600  ${(fg.length / 1024).toFixed(0)} KB`);
  console.log(`RideTheBus-BG.jpg  1920 x 1280  ${(bg.length / 1024).toFixed(0)} KB`);
  console.log(`together ${(total / 1048576).toFixed(2)} MB of 3 MB  ->  ${OUT}`);
} finally {
  ws.close();
  chrome.kill();
  await sleep(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
