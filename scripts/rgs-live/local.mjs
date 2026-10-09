#!/usr/bin/env node
// RGS_TEST_PLAN.md's LAYOUT checks on the local copy of the uploaded build -
// no live RGS traffic, the same dashboard as the live runner.
//
//   npm run rgs:local                          DEV-11, DEV-12 and CUR-04
//   npm run rgs:local -- --only DEV-12 --langs fi,ru
//   npm run rgs:local -- --front 74            also compare build/ with the live index.html
//   npm run rgs:local -- --record              write "Local ... NOT run on Stake" lines into the plan
//
// Why it exists: on 2026-10-09 the live RGS refused this machine at 12 page
// loads in about five minutes, and the owner's rule since is that a check that
// is fully valid locally runs locally. A check that only MEASURES LAYOUT gives
// the same answer wherever the same bytes are served, so this serves build/
// itself - its index.html must hash identical to the live one; --front checks
// that with one request to the CDN (never the RGS) - and lets the local replay
// server answer authenticate, rewritten into the live session's shape. Money,
// the handshake, the CDN's headers and the replay endpoint still need Stake:
// `npm run rgs`. See scripts/rgs-live/README.md.
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, statSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, CHANNEL } from './lib/pw.mjs';
import { CDN, STATE_FILE } from './lib/studio.mjs';
import { readPlan, recordResults } from './lib/plan.mjs';
import { withTimeout } from './lib/runner.mjs';
import { startDashboard } from './lib/dashboard.mjs';
import { VIEWPORTS, dismissIntro } from './lib/game.mjs';
import TASKS from './local-checks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PLAN = path.join(ROOT, 'RGS_TEST_PLAN.md');
const BUILD = path.join(ROOT, 'web-sdk', 'apps', 'Ride-The-Bus', 'build');
const REPLAY_SERVER = path.join(ROOT, 'scripts', 'replay-server.mjs');

function parseArgs(argv) {
  // Ports clear of the owner's dev pair (3001 / 3010) and the shots pair (3002 / 3011).
  const a = { ui: true, port: 8767, buildPort: 3013, replayPort: 3021, concurrency: 4, headed: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--only') a.only = v().split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    else if (k === '--langs') a.langs = v().split(',').map(s => s.trim()).filter(Boolean);
    else if (k === '--front') a.front = Number(v());
    else if (k === '--record') a.record = true;
    else if (k === '--concurrency' || k === '-j') a.concurrency = Number(v());
    else if (k === '--headed') a.headed = true;
    else if (k === '--no-ui') a.ui = false;
    else if (k === '--port') a.port = Number(v());
    else if (k === '--build-port') a.buildPort = Number(v());
    else if (k === '--replay-port') a.replayPort = Number(v());
    else if (k === '--out') a.out = v();
    else if (k === '--help' || k === '-h') a.help = true;
    else throw new Error(`unknown option ${k}`);
  }
  return a;
}

const matches = (id, pats) => pats.some(p => id === p || (/^[A-Z]+$/.test(p) && id.startsWith(p + '-')));
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

const portFree = (port) => new Promise((resolve) => {
  const s = net.createServer().once('error', () => resolve(false)).once('listening', () => s.close(() => resolve(true)));
  s.listen(port, '127.0.0.1');
});
async function waitHttp(url, ms) {
  for (const end = Date.now() + ms; Date.now() < end;) {
    const ok = await new Promise((resolve) => { http.get(url, (r) => { r.resume(); resolve(true); }).on('error', () => resolve(false)); });
    if (ok) return;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`${url} did not answer within ${ms / 1000}s`);
}

// build/ as the CDN serves it: static files, index.html at the root.
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.txt': 'text/plain' };
function serveBuild(port) {
  const root = path.resolve(BUILD);
  const server = http.createServer((req, res) => {
    let p = '/';
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch {}
    if (p.endsWith('/')) p += 'index.html';
    const f = path.resolve(root, '.' + p);
    if (!f.startsWith(root + path.sep) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(f).pipe(res);
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server)); });
}

async function startReplay(port, gamePort) {
  const child = spawn(process.execPath, [REPLAY_SERVER], { cwd: ROOT, env: { ...process.env, REPLAY_PORT: String(port), GAME_PORT: String(gamePort) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', d => { out = (out + d).slice(-2000); });
  child.stderr.on('data', d => { out = (out + d).slice(-2000); });
  try { await waitHttp(`http://127.0.0.1:${port}/`, 20_000); }
  catch (e) { child.kill(); throw new Error(`the replay server did not start on :${port}: ${out.slice(-300) || e.message}`); }
  return child;
}

/** The live index.html, fetched from the CDN with the saved Studio sign-in - one CDN request, no RGS call. */
async function liveIndex(chromium, front) {
  if (!existsSync(STATE_FILE)) return { error: 'no saved Studio sign-in (run `npm run rgs` once) - compare by hand with the hash a live run prints' };
  const browser = await chromium.launch({ channel: CHANNEL, headless: true });
  try {
    const ctx = await browser.newContext({ storageState: STATE_FILE });
    const res = await ctx.request.get(`${CDN}/v${front}/index.html`, { headers: { 'cache-control': 'no-store' } });
    if (!res.ok()) return { error: `the CDN answered ${res.status()} for v${front}/index.html - is it uploaded, and is the sign-in current?` };
    return { sha: sha(await res.body()) };
  } finally { await browser.close(); }
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  if (cfg.help) { console.log(readFileSync(path.join(HERE, 'README.md'), 'utf8')); return; }
  if (!existsSync(path.join(BUILD, 'index.html'))) throw new Error('web-sdk/apps/Ride-The-Bus/build/index.html is missing - this serves the build that was uploaded, so it needs one (the owner runs the build)');
  const plan = readPlan(PLAN);
  for (const t of TASKS) for (const id of t.covers) if (!plan.some(c => c.id === id)) throw new Error(`a local task covers ${id}, which RGS_TEST_PLAN.md does not have`);
  const selected = TASKS.filter(t => !cfg.only || t.covers.some(id => matches(id, cfg.only)));
  if (!selected.length) throw new Error(`nothing local covers ${cfg.only.join(', ')} - the local checks are ${TASKS.flatMap(t => t.covers).join(', ')}; the rest need \`npm run rgs\``);

  const stamp = new Date();
  const day = stamp.toISOString().slice(0, 10);
  cfg.outDir = cfg.out || path.join(ROOT, 'scripts', '.shots', 'rgs', `${day}-local-${stamp.toTimeString().slice(0, 5).replace(':', '')}`);
  const shotsDir = path.join(cfg.outDir, 'shots');
  mkdirSync(shotsDir, { recursive: true });

  const localSha = sha(readFileSync(path.join(BUILD, 'index.html')));
  const builtAt = statSync(path.join(BUILD, 'index.html')).mtime;
  const t0 = Date.now();
  const localIds = new Set(TASKS.flatMap(t => t.covers));
  const selectedIds = new Set(selected.flatMap(t => t.covers));
  const ui = { title: 'RGS layout checks - local', local: true, startedAt: t0, build: `${localSha.slice(0, 12)} (local build/)`, checks: {}, running: [], log: [], finishedAt: null, report: null };
  for (const c of plan) ui.checks[c.id] = { ...c, selected: selectedIds.has(c.id), status: selectedIds.has(c.id) ? 'PENDING' : 'SKIP', evidence: selectedIds.has(c.id) ? '' : localIds.has(c.id) ? 'not selected this run' : 'needs the live RGS or CDN - `npm run rgs`' };
  const side = { title: 'Served locally', rows: [] };
  const setSide = (k, v) => { const r = side.rows.find(x => x[0] === k); if (r) r[1] = v; else side.rows.push([k, v]); };
  setSide('build/', `index.html ${localSha.slice(0, 12)}, built ${builtAt.toLocaleString()}`);
  setSide('live comparison', cfg.front ? 'checking...' : 'not asked (--front N)');
  setSide('the game', `http://localhost:${cfg.buildPort}`);
  setSide('the RGS', `local replay server, :${cfg.replayPort}`);
  setSide('live RGS calls', '0');
  const log = (m) => { const line = `[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s] ${m}`; console.log(line); ui.log.push(line); if (ui.log.length > 400) ui.log.shift(); };
  log(`local: ${selected.length} tasks covering ${selectedIds.size} checks on build/ (index.html ${localSha.slice(0, 12)}) - no live RGS traffic`);

  let dash = null;
  if (cfg.ui) {
    dash = await startDashboard({ port: cfg.port, shotsDir, state: () => {
      const now = Date.now();
      const totalEst = selected.reduce((a, t) => a + t.est, 0) || 1;
      const doneEst = selected.filter(t => t.__done).reduce((a, t) => a + t.est, 0);
      const partial = ui.running.reduce((a, r) => a + Math.min(0.99, r.frac ?? (now - r.startedAt) / (r.est * 1000)) * r.est, 0);
      const progress = Math.min(1, (doneEst + partial) / totalEst);
      return { ...ui, side, progress: ui.finishedAt ? 1 : progress, etaMs: progress > 0.03 && !ui.finishedAt ? (now - t0) * (1 - progress) / progress : null,
        queued: selected.filter(t => !t.__done && !ui.running.some(r => r.name === t.name)).length, doneTasks: selected.filter(t => t.__done).length, totalTasks: selected.length,
        sessions: 0, replays: 0, shots: existsSync(shotsDir) ? readdirSync(shotsDir).filter(f => /\.png$/i.test(f)).sort() : [] };
    } });
    if (dash) log(`dashboard: ${dash.url}`); else log(`the dashboard's port ${cfg.port} is taken - running without it (--port to pick another)`);
  }

  const { chromium } = loadPlaywright();
  let live = null;
  if (cfg.front) {
    live = await liveIndex(chromium, cfg.front).catch(e => ({ error: String(e.message || e) }));
    const same = live.sha === localSha;
    setSide('live comparison', live.sha ? (same ? `identical to the live v${cfg.front}` : `DIFFERS from the live v${cfg.front} (${live.sha.slice(0, 12)})`) : live.error);
    log(live.sha ? `live v${cfg.front}/index.html ${live.sha.slice(0, 12)} - ${same ? 'identical to build/: the results describe the upload' : 'NOT build/: the results describe this tree, not the upload'}` : `live comparison: ${live.error}`);
  }

  for (const [port, what] of [[cfg.buildPort, '--build-port'], [cfg.replayPort, '--replay-port']]) if (!(await portFree(port))) throw new Error(`port ${port} is in use - pick another with ${what}`);
  const staticServer = await serveBuild(cfg.buildPort);
  let replay = null;
  const browser = await chromium.launch({ channel: CHANNEL, headless: !cfg.headed });
  const results = {};
  try {
    replay = await startReplay(cfg.replayPort, cfg.buildPort);
    log(`serving build/ on :${cfg.buildPort}, the local replay server on :${cfg.replayPort}`);

    for (const task of selected) {
      const s0 = Date.now();
      log(`start  ${task.name} (${task.covers.join(' ')})`);
      const runRow = { name: task.name, covers: task.covers, est: task.est, startedAt: s0, frac: 0 };
      ui.running.push(runRow);
      for (const id of task.covers) if (ui.checks[id].status === 'PENDING') ui.checks[id].status = 'RUNNING';
      const entries = {};
      const push = (id, ok, msg) => (entries[id] ||= []).push({ ok, msg });
      const contexts = [];
      const t = {
        cfg,
        log: (m) => log(`    ${task.name}: ${m}`),
        expect: (id, ok, msg) => push(id, !!ok, msg),
        note: (id, msg) => push(id, null, msg),
        progress: (f) => { runRow.frac = f; },
        async shot(page, name) { await page.screenshot({ path: path.join(shotsDir, `${name}.png`) }).catch(() => {}); },
        async parallel(items, fn, n = cfg.concurrency) {
          let i = 0; const errors = [];
          await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
            while (i < items.length) { const it = items[i++]; try { await fn(it); } catch (e) { errors.push(`${[].concat(it).join(' ')}: ${String(e.message || e).split('\n')[0]}`); } }
          }));
          if (errors.length) throw new Error(`${errors.length} of ${items.length} could not be measured - ${errors.slice(0, 3).join(' | ')}`);
        },
        /** The game on build/, authenticated by the local replay server; auth(json) reshapes its answer. */
        async load({ lang = 'en', viewport = 'desktop', auth, params = {} } = {}) {
          const v = VIEWPORTS[viewport];
          const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, ...(v.touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
          contexts.push(ctx);
          if (auth) await ctx.route(new RegExp(`:${cfg.replayPort}/wallet/authenticate`), async (route) => {
            const r = await route.fetch(); const j = await r.json(); auth(j);
            await route.fulfill({ response: r, body: JSON.stringify(j) });
          });
          const page = await ctx.newPage();
          const q = new URLSearchParams({ sessionID: `local-${task.name}`, rgs_url: `localhost:${cfg.replayPort}`, lang, currency: 'USD', device: v.touch ? 'mobile' : 'desktop', social: 'false', ...params });
          await page.goto(`http://localhost:${cfg.buildPort}/?${q}`);
          await dismissIntro(page);
          return page;
        },
        /** A replay on build/, its book served by the local replay server (the same books as the published ones). */
        async replay({ mode, event, currency = 'USD', amount = 1_000_000, lang = 'en', viewport = 'desktop' }) {
          const v = VIEWPORTS[viewport];
          const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, ...(v.touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
          contexts.push(ctx);
          const page = await ctx.newPage();
          const q = new URLSearchParams({ replay: 'true', game: 'ride_the_bus', version: '1', mode, event: String(event), rgs_url: `localhost:${cfg.replayPort}`, currency, amount: String(amount), lang, device: v.touch ? 'mobile' : 'desktop', social: 'false' });
          await page.goto(`http://localhost:${cfg.buildPort}/?${q}`);
          return page;
        },
      };
      let err = null;
      try { await withTimeout(Promise.resolve().then(() => task.run(t)), (task.est * 5 + 120) * 1000, task.name); }
      catch (e) { err = e; }
      for (const c of contexts) await c.close().catch(() => {});
      for (const id of task.covers) {
        const list = entries[id] || [];
        const msgs = list.map(e => e.msg).filter(Boolean);
        let status = list.some(e => e.ok === false) ? 'FAIL' : list.some(e => e.ok === true) ? 'PASS' : 'ERROR';
        if (err && status !== 'FAIL') status = 'ERROR';
        const evidence = [...msgs, ...(err ? [`the task failed: ${String(err.message || err).split('\n')[0]}`] : [])].join('; ');
        results[id] = { status, evidence, task: task.name };
        ui.checks[id] = { ...ui.checks[id], status, evidence, task: task.name };
      }
      task.__done = true;
      ui.running = ui.running.filter(r => r !== runRow);
      log(`${err ? 'ERROR' : 'done '}  ${task.name} in ${Math.round((Date.now() - s0) / 1000)}s: ${task.covers.map(id => `${id} ${results[id].status}`).join(', ')}`);
    }
  } finally {
    await browser.close().catch(() => {});
    if (replay) replay.kill();
    staticServer.close(); staticServer.closeAllConnections?.();
  }

  const secs = Math.round((Date.now() - t0) / 1000);
  const count = (s) => Object.values(results).filter(r => r.status === s).length;
  const liveText = live?.sha ? (live.sha === localSha ? `, identical to the live v${cfg.front}` : `, NOT the live v${cfg.front}`) : '';
  writeFileSync(path.join(cfg.outDir, 'results.json'), JSON.stringify({ local: true, build: { sha: localSha, builtAt, live: live || null }, secs, results }, null, 2));
  writeFileSync(path.join(cfg.outDir, 'report.md'), report(plan, results, localSha, liveText, secs));
  log(`finished in ${Math.floor(secs / 60)}m${secs % 60}s: ${count('PASS')} pass, ${count('FAIL')} FAIL, ${count('ERROR')} error - 0 live RGS calls`);
  for (const [id, r] of Object.entries(results)) if (r.status !== 'PASS') console.log(`  ${r.status.padEnd(5)} ${id}: ${r.evidence.slice(0, 400)}`);
  console.log(`  report: ${path.relative(ROOT, path.join(cfg.outDir, 'report.md'))}`);
  if (cfg.record) {
    if (live && live.sha && live.sha !== localSha) console.log('  NOT recorded: build/ is not the uploaded build, so these results do not describe it');
    else {
      const tag = `**Local ${day} - NOT run on Stake** (rgs-local: the build/ folder, index.html ${localSha.slice(0, 12)}${liveText}, served from localhost with the local replay server answering authenticate; no live RGS traffic):`;
      console.log(`  recorded ${recordResults(PLAN, results, tag, 'rgs-local')} checks in RGS_TEST_PLAN.md`);
    }
  }
  ui.finishedAt = Date.now();
  ui.report = path.relative(ROOT, path.join(cfg.outDir, 'report.md'));
  if (dash) { dash.snapshot(path.join(cfg.outDir, 'dashboard.html')); console.log(`  dashboard snapshot: ${path.relative(ROOT, path.join(cfg.outDir, 'dashboard.html'))}`); setTimeout(() => dash.close(), 4000); }
  process.exitCode = count('FAIL') + count('ERROR') ? 1 : 0;
}

function report(plan, results, localSha, liveText, secs) {
  const icon = { PASS: '✅', FAIL: '❌', ERROR: '⚠️' };
  const out = [`# RGS layout checks - LOCAL, not run on Stake`, '',
    `${new Date().toISOString()} · ${Math.floor(secs / 60)}m${secs % 60}s · build/ index.html \`${localSha}\`${liveText} · 0 live RGS calls`, '',
    'Served from localhost: build/ itself, with the local replay server answering authenticate in the live session\'s shape. Layout only - see RGS_TEST_PLAN.md, "Layout checks run locally".', '',
    '| | ID | Check | Severity | Evidence |', '|---|---|---|---|---|'];
  for (const c of plan) { const r = results[c.id]; if (r) out.push(`| ${icon[r.status] || r.status} | ${c.id} | ${c.title} | ${c.severity} | ${String(r.evidence).replace(/\|/g, '/').slice(0, 600)} |`); }
  return out.join('\n') + '\n';
}

process.on('unhandledRejection', (e) => { console.error('[ignored] a task left an unhandled rejection: ' + String(e?.message || e).split('\n')[0]); });
main().catch(e => { console.error(String(e.stack || e)); process.exitCode = 2; });
