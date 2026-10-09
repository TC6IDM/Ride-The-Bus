#!/usr/bin/env node
// Run RGS_TEST_PLAN.md's checks against the UPLOADED build on Stake Engine, in
// parallel, and write the results down.
//
//   npm run rgs -- --front 74 --math 13            every automated check
//   npm run rgs -- --front 74 --math 13 --quick    the smoke set (~2 min)
//   npm run rgs -- --front 74 --math 13 --only WIN,REP-01 --record
//   npm run rgs -- --list                          what is automated, what is the owner's
//   ... --headless                                  no windows (they are shown by default, to watch)
//
// See scripts/rgs-live/README.md. The first run opens a Chrome window for the
// Studio sign-in; later runs reuse it until it expires.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadPlaywright, CHANNEL } from './lib/pw.mjs';
import { ensureSignedIn, CDN } from './lib/studio.mjs';
import { readPlan, recordResults } from './lib/plan.mjs';
import { Semaphore, RgsGate, makeContext, runPool, withTimeout } from './lib/runner.mjs';
import { MANUAL } from './checks/manual.mjs';
import { startDashboard } from './lib/dashboard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PLAN = path.join(ROOT, 'RGS_TEST_PLAN.md');
const LOCAL_BUILD = path.join(ROOT, 'web-sdk', 'apps', 'Ride-The-Bus', 'build', 'index.html');
const QUICK = ['SES-01', 'SES-06', 'BET-06', 'RND-01', 'REP-01', 'PRF-04', 'REG-02'];

function parseArgs(argv) {
  const a = { headed: true, ui: true, port: 8766, concurrency: 4, endurance: 500, replayBudget: 220, rgsGap: 1000, authGap: 8000, cooldown: 900_000, windowCap: 80 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => argv[++i];
    if (k === '--front') a.front = Number(v());
    else if (k === '--math') a.math = Number(v());
    else if (k === '--only') a.only = v().split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    else if (k === '--skip') a.skip = v().split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    else if (k === '--quick') a.quick = true;
    else if (k === '--concurrency' || k === '-j') a.concurrency = Number(v());
    else if (k === '--endurance') a.endurance = Number(v());
    else if (k === '--rgs-gap') a.rgsGap = Number(v());
    else if (k === '--auth-gap') a.authGap = Number(v());
    else if (k === '--window-cap') a.windowCap = Number(v());
    else if (k === '--cooldown') a.cooldown = Number(v()) * 1000;
    else if (k === '--record') a.record = true;
    else if (k === '--headed') a.headed = true;
    else if (k === '--headless') a.headed = false;
    else if (k === '--no-ui') a.ui = false;
    else if (k === '--port') a.port = Number(v());
    else if (k === '--signin') a.signin = true;
    else if (k === '--list') a.list = true;
    else if (k === '--out') a.out = v();
    else if (k === '--help' || k === '-h') a.help = true;
    else throw new Error(`unknown option ${k}`);
  }
  return a;
}

// "WIN-16" is one check; a bare section name ("WIN") is all of that section.
const matches = (id, pats) => pats.some(p => id === p || (/^[A-Z]+$/.test(p) && id.startsWith(p + '-')));

async function loadTasks() {
  const dir = path.join(HERE, 'checks');
  const tasks = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith('.mjs') && f !== 'manual.mjs').sort()) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    for (const task of mod.default || []) tasks.push({ file: f, est: 60, timeout: 180_000, ...task });
  }
  return tasks;
}

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  if (cfg.help) { console.log(readFileSync(path.join(HERE, 'README.md'), 'utf8')); return; }
  const plan = readPlan(PLAN);
  const tasks = await loadTasks();
  const covered = new Map();
  for (const t of tasks) for (const id of t.covers) (covered.get(id) || covered.set(id, []).get(id)).push(t.name);
  for (const id of covered.keys()) if (!plan.some(c => c.id === id)) throw new Error(`a task covers ${id}, which RGS_TEST_PLAN.md does not have`);

  if (cfg.list) {
    let auto = 0;
    for (const c of plan) {
      const by = covered.get(c.id);
      if (by) auto++;
      console.log(`${pad(c.id, 7)} ${pad(c.severity, 7)} ${by ? pad('auto', 7) : pad('OWNER', 7)} ${pad(c.title.slice(0, 58), 59)} ${by ? by.join(', ') : (MANUAL[c.id] || 'not automated yet')}`);
    }
    console.log(`\n${auto} of ${plan.length} checks automated; ${plan.length - auto} need the owner.`);
    return;
  }
  if (!cfg.front || !cfg.math) throw new Error('--front and --math are required (the versions uploaded to Studio), e.g. --front 74 --math 13');

  let pats = cfg.quick ? QUICK : cfg.only;
  let selected = tasks.filter(t => (!pats || t.covers.some(id => matches(id, pats))) && !(cfg.skip && t.covers.every(id => matches(id, cfg.skip))));
  selected.sort((a, b) => b.est - a.est); // longest first: the run ends when its longest task does
  const stamp = new Date();
  const day = stamp.toISOString().slice(0, 10);
  cfg.outDir = cfg.out || path.join(ROOT, 'scripts', '.shots', 'rgs', `${day}-v${cfg.front}-${stamp.toTimeString().slice(0, 5).replace(':', '')}`);
  mkdirSync(cfg.outDir, { recursive: true });

  const t0 = Date.now();
  // The dashboard's view of the run, kept current as it goes.
  const ui = { startedAt: t0, front: cfg.front, math: cfg.math, build: null, checks: {}, running: [], log: [], finishedAt: null, report: null };
  const selectedIds = new Set(selected.flatMap(t => t.covers));
  for (const c of plan) ui.checks[c.id] = { ...c, selected: selectedIds.has(c.id), status: selectedIds.has(c.id) ? 'PENDING' : covered.get(c.id) ? 'SKIP' : 'OWNER', evidence: selectedIds.has(c.id) ? '' : covered.get(c.id) ? 'not selected this run' : (MANUAL[c.id] || 'not automated yet') };
  const log = (m) => { const line = `[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s] ${m}`; console.log(line); ui.log.push(line); if (ui.log.length > 400) ui.log.shift(); };
  log(`front v${cfg.front}, math v${cfg.math}: ${selected.length} tasks covering ${new Set(selected.flatMap(t => t.covers)).size} checks, ${cfg.concurrency} at a time`);

  let dash = null, gateRef = null, countersRef = null, doneRef = { n: 0 }, queueRef = { q: null };
  if (cfg.ui) {
    const shotsDir = path.join(cfg.outDir, 'shots');
    dash = await startDashboard({ port: cfg.port, shotsDir, state: () => {
      const now = Date.now();
      const totalEst = selected.reduce((a, t) => a + t.est, 0) || 1;
      const doneEst = selected.filter(t => t.__done).reduce((a, t) => a + t.est, 0);
      const partial = ui.running.reduce((a, r) => a + Math.min(0.9, (now - r.startedAt) / (r.est * 1000)) * r.est, 0);
      const progress = Math.min(1, (doneEst + partial) / totalEst);
      const elapsed = now - t0;
      return { ...ui, progress: ui.finishedAt ? 1 : progress, etaMs: progress > 0.03 && !ui.finishedAt ? elapsed * (1 - progress) / progress : null,
        queued: queueRef.q ? queueRef.q.length : selected.length, doneTasks: doneRef.n, totalTasks: selected.length,
        gate: gateRef ? { windowCap: gateRef.windowCap, recent: gateRef.recent(), calls: gateRef.calls, auths: gateRef.auths, refusals: gateRef.refusals, pausedUntil: gateRef.pausedUntil, gap: gateRef.gap, authGap: gateRef.authGap, slot: gateRef.open && now - gateRef.open.since < 45_000 ? `${gateRef.open.label}, ${Math.round((now - gateRef.open.since) / 1000)}s` : null } : null,
        sessions: countersRef?.sessions || 0, replays: countersRef?.replays || 0,
        shots: existsSync(shotsDir) ? readdirSync(shotsDir).filter(f => /\.png$/i.test(f)).sort() : [] };
    } });
    if (dash) log(`dashboard: ${dash.url}`); else log(`the dashboard's port ${cfg.port} is taken - running without it (--port to pick another)`);
  }
  const { chromium } = loadPlaywright();
  const statePath = await ensureSignedIn(chromium, cfg, log);
  const browser = await chromium.launch({ channel: CHANNEL, headless: !cfg.headed });
  const build = await buildIdentity(browser, statePath, cfg).catch(e => ({ error: String(e.message || e) }));
  ui.build = build.sha ? `${build.sha.slice(0, 12)}${build.local ? (build.local === build.sha ? ' = local build/' : ' (differs from local build/)') : ''}` : null;
  log(build.error ? `build check failed: ${build.error}` : `live index.html ${build.bytes} bytes, sha256 ${build.sha.slice(0, 12)}…${build.local ? (build.local === build.sha ? ' = local build/' : ' DIFFERS from local build/ (results describe the upload, not this tree)') : ''}`);

  const sems = { launch: new Semaphore(3), replay: new Semaphore(3) };
  const gate = new RgsGate(cfg.rgsGap, cfg.cooldown, cfg.authGap);
  gate.windowCap = cfg.windowCap;
  gate.log = log;
  gateRef = gate;
  const retried = new Set();
  const counters = { sessions: 0, replays: 0 };
  countersRef = counters;
  const results = {};
  let done = 0;
  const pool = { queue: null };
  queueRef = { get q() { return pool.queue; } };
  const queueAgain = (task) => pool.queue.push(task);
  await runPool(selected, pool, {
    concurrency: cfg.concurrency,
    runOne: async (task) => {
      const s0 = Date.now();
      log(`start  ${task.name} (${task.covers.join(' ')})`);
      const runRow = { name: task.name, covers: task.covers, est: task.est, startedAt: s0 };
      ui.running.push(runRow);
      for (const id of task.covers) if (ui.checks[id].status === 'PENDING') ui.checks[id].status = 'RUNNING';
      const ctx = makeContext({ browser, statePath, cfg, task, sems, log, counters, gate });
      let err = null;
      try { await withTimeout(Promise.resolve().then(() => task.run(ctx.t)), task.timeout, task.name); }
      catch (e) { err = e; }
      await ctx.finish(err);
      const v = ctx.verdicts();
      // Throttled by the RGS: the verdict says nothing about the game, so run it once more.
      if (ctx.t.rateLimited && !retried.has(task.name) && Object.values(v).some(r => r.status !== 'PASS' && r.status !== 'SIM')) {
        retried.add(task.name);
        log(`retry  ${task.name} after the RGS cooldown (it was throttled, not failed)`);
        ui.running = ui.running.filter(r => r !== runRow);
        queueAgain(task);
        return;
      }
      for (const [id, r] of Object.entries(v)) {
        if (err && r.status === 'ERROR') r.evidence = `${String(err.message || err).split('\n')[0]}`;
        else if (err) { r.status = r.status === 'PASS' ? 'ERROR' : r.status; r.evidence += `; then the task failed: ${String(err.message || err).split('\n')[0]}`; }
        merge(results, id, r);
      }
      done++;
      doneRef.n = done; task.__done = true;
      ui.running = ui.running.filter(r => r !== runRow);
      for (const id of task.covers) { const r = results[id]; ui.checks[id] = { ...ui.checks[id], status: r.status, evidence: r.evidence, task: r.task }; }
      const summary = Object.entries(v).map(([id, r]) => `${id} ${r.status}`).join(', ');
      log(`${err ? 'ERROR' : 'done '}  ${task.name} in ${Math.round((Date.now() - s0) / 1000)}s [${done}/${selected.length}]: ${summary}`);
    },
  });
  await browser.close();

  // Everything the plan has that this run did not decide.
  for (const c of plan) {
    if (results[c.id]) continue;
    const by = covered.get(c.id);
    results[c.id] = by ? { status: 'SKIP', evidence: 'not selected this run' } : { status: 'OWNER', evidence: MANUAL[c.id] || 'not automated yet' };
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  const tag = `**Live ${day}** (rgs-live: front v${cfg.front}, math v${cfg.math}${build.sha ? `, index.html ${build.sha.slice(0, 12)}` : ''}):`;
  writeFileSync(path.join(cfg.outDir, 'results.json'), JSON.stringify({ front: cfg.front, math: cfg.math, build, secs, counters, rgs: { calls: gate.calls, refusals: gate.refusals, gapMs: cfg.rgsGap }, results }, null, 2));
  writeFileSync(path.join(cfg.outDir, 'report.md'), report(plan, results, cfg, build, secs, counters));
  const count = (s) => Object.values(results).filter(r => r.status === s).length;
  log(`finished in ${Math.floor(secs / 60)}m${secs % 60}s: ${count('PASS')} pass, ${count('FAIL')} FAIL, ${count('ERROR')} error, ${count('SIM')} simulated, ${count('OWNER')} the owner's, ${count('SKIP')} not run - ${counters.sessions} sessions, ${counters.replays} replays, ${gate.calls} RGS calls (${gate.auths} authenticates), ${gate.refusals} refused by the RGS${gate.episodes ? ` in ${gate.episodes} episode(s) - spacing ended at ${gate.gap}ms / ${gate.authGap}ms per authenticate` : ''}`);
  for (const [id, r] of Object.entries(results)) if (r.status === 'FAIL' || r.status === 'ERROR') console.log(`  ${r.status.padEnd(5)} ${id}: ${r.evidence.slice(0, 300)}`);
  console.log(`  report: ${path.relative(ROOT, path.join(cfg.outDir, 'report.md'))}`);
  if (cfg.record) console.log(`  recorded ${recordResults(PLAN, results, tag)} checks in RGS_TEST_PLAN.md`);
  ui.finishedAt = Date.now();
  ui.report = path.relative(ROOT, path.join(cfg.outDir, 'report.md'));
  for (const [id, r] of Object.entries(results)) ui.checks[id] = { ...ui.checks[id], status: r.status, evidence: r.evidence, task: r.task };
  if (dash) { dash.snapshot(path.join(cfg.outDir, 'dashboard.html')); console.log(`  dashboard snapshot: ${path.relative(ROOT, path.join(cfg.outDir, 'dashboard.html'))}`); setTimeout(() => dash.close(), 4000); }
  process.exitCode = count('FAIL') + count('ERROR') ? 1 : 0;
}

const RANK = { FAIL: 4, ERROR: 3, SIM: 2, PASS: 1 };
function merge(results, id, r) {
  const prev = results[id];
  if (!prev) { results[id] = { ...r }; return; }
  const worse = RANK[r.status] > RANK[prev.status] ? r : prev;
  results[id] = { status: worse.status, evidence: [prev.evidence, r.evidence].filter(Boolean).join(' | '), task: `${prev.task}, ${r.task}` };
}

async function buildIdentity(browser, statePath, cfg) {
  const ctx = await browser.newContext({ storageState: statePath });
  try {
    const res = await ctx.request.get(`${CDN}/v${cfg.front}/index.html`, { headers: { 'cache-control': 'no-store' } });
    if (!res.ok()) throw new Error(`index.html answered ${res.status()} - is front v${cfg.front} uploaded?`);
    const buf = await res.body();
    const sha = createHash('sha256').update(buf).digest('hex');
    const local = existsSync(LOCAL_BUILD) ? createHash('sha256').update(readFileSync(LOCAL_BUILD)).digest('hex') : null;
    return { bytes: buf.length, sha, local };
  } finally { await ctx.close(); }
}

function report(plan, results, cfg, build, secs, counters) {
  const icon = { PASS: '✅', FAIL: '❌', ERROR: '⚠️', SIM: '🧪', OWNER: '👤', SKIP: '·' };
  const out = [`# RGS live run - front v${cfg.front}, math v${cfg.math}`, '',
    `${new Date().toISOString()} · ${Math.floor(secs / 60)}m${secs % 60}s · ${counters.sessions} demo sessions · ${counters.replays} replays`,
    build.sha ? `\nLive \`index.html\`: ${build.bytes} bytes, sha256 \`${build.sha}\`${build.local ? (build.local === build.sha ? ' - identical to the local `build/`.' : ' - **differs from the local `build/`**.') : ''}` : `\nBuild check: ${build.error}`, ''];
  const by = (s) => plan.filter(c => results[c.id]?.status === s);
  for (const [s, head] of [['FAIL', 'Failed'], ['ERROR', 'Could not run'], ['SIM', 'Simulated (recorded, never ticked)'], ['OWNER', 'Still the owner\'s (hardware, judgement or a real lapse)']]) {
    const list = by(s); if (!list.length) continue;
    out.push(`## ${head} (${list.length})`, '');
    for (const c of list) out.push(`- **${c.id}** ${c.title} *(${c.severity})* - ${results[c.id].evidence}`);
    out.push('');
  }
  out.push('## Every check', '', '| | ID | Check | Severity | Evidence |', '|---|---|---|---|---|');
  for (const c of plan) { const r = results[c.id]; out.push(`| ${icon[r.status] || r.status} | ${c.id} | ${c.title} | ${c.severity} | ${String(r.evidence).replace(/\|/g, '/').slice(0, 400)} |`); }
  return out.join('\n') + '\n';
}

// A promise a task left behind (a wait it no longer needs) must not end the run.
process.on('unhandledRejection', (e) => { console.error('[ignored] a task left an unhandled rejection: ' + String(e?.message || e).split('\n')[0]); });
main().catch(e => { console.error(String(e.stack || e)); process.exitCode = 2; });
