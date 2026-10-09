#!/usr/bin/env node
// The four cheap gates CLAUDE.md names - tests, tsc, svelte-check, lint - in
// one command, watched live on a page.
//
//   npm run verify                  all four, at once; a dashboard opens on :8768
//   npm run verify -- --only test,lint
//   npm run verify -- --serial      one after another (slower, quieter machine)
//   npm run verify -- --no-ui       terminal only
//
// Each gate runs through its OWN npm script in web-sdk/apps/Ride-The-Bus, so a
// pass here is exactly a pass there. One rule is stricter than its script:
// check:svelte must come back with 0 errors AND 0 warnings in the game's own
// source (CLAUDE.md), and scripts/svelte-check.mjs exits 0 on warnings - so a
// warning fails the svelte gate here.
//
// Every run writes its four logs and a dashboard.html (the final page, baked)
// to scripts/.shots/verify/<date>-<time>/ (gitignored). Never a build: those
// are the owner's (CLAUDE.md, standing rule 2).
import http from 'node:http';
import { spawn, exec, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'web-sdk', 'apps', 'Ride-The-Bus');
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

const STEPS = [
  { id: 'test', label: 'Tests', script: 'test', what: 'node --test, every *.test.ts' },
  { id: 'check', label: 'Types', script: 'check', what: "tsc over the game's own .ts" },
  { id: 'svelte', label: 'Svelte', script: 'check:svelte', what: 'svelte-check: 0 errors and 0 warnings' },
  { id: 'lint', label: 'Lint', script: 'lint', what: 'eslint src' },
];

// What each gate's output says, read as it streams. Returns { summary, details, failed }.
const READ = {
  test(out, done) {
    const n = (k) => { const m = out.match(new RegExp(`^ℹ ${k} (\\d+)`, 'm')); return m ? Number(m[1]) : null; };
    const failing = [...new Set([...out.matchAll(/^\s*✖ (.+?)(?: \(\d[\d.]*ms\))?$/gm)].map(m => m[1].trim()))].filter(s => !/^failing tests:?$/.test(s));
    if (!done) {
      const passed = (out.match(/^\s*✔ /gm) || []).length;
      return { summary: `${passed} passed so far${failing.length ? `, ${failing.length} failing` : ''}`, details: failing.slice(0, 30) };
    }
    const tests = n('tests'), pass = n('pass'), fail = n('fail'), skipped = n('skipped'), cancelled = n('cancelled'), todo = n('todo');
    const extra = [skipped && `${skipped} skipped`, cancelled && `${cancelled} cancelled`, todo && `${todo} todo`].filter(Boolean);
    return {
      summary: tests == null ? 'no summary - see the output' : `${pass} of ${tests} pass${fail ? `, ${fail} FAIL` : ''}${extra.length ? ` (${extra.join(', ')})` : ''}`,
      details: failing.slice(0, 30),
      failed: !!fail || !!cancelled,
    };
  },
  check(out, done) {
    const own = /No type errors in this game's own source/.test(out);
    const errs = out.split('\n').filter(l => /error TS\d+/.test(l) && !/web-sdk[\\/]packages/.test(l));
    const vendored = out.match(/(\d+) pre-existing error\(s\) in web-sdk\/packages/);
    if (!done && !own) return { summary: 'running...', details: errs.slice(0, 30) };
    return { summary: own ? `no type errors in the game's source${vendored ? ` (${vendored[1]} in the vendored SDK, not ours)` : ''}` : `${errs.length || 'some'} type error(s)`, details: errs.slice(0, 30) };
  },
  svelte(out) {
    const w = out.match(/(\d+) warning\(s\) in this game's source:/);
    const e = out.match(/(\d+) error\(s\) in this game's source:/);
    const list = (head) => { const i = out.indexOf(head); if (i < 0) return []; return out.slice(i + head.length).split('\n').slice(1).filter(l => /^\s{2}\S/.test(l)).map(l => l.trim()).slice(0, 20); };
    const warnings = w ? Number(w[1]) : 0, errors = e ? Number(e[1]) : 0;
    return {
      summary: errors || warnings ? `${errors} error(s), ${warnings} warning(s) in the game's source` : /No \.svelte type errors/.test(out) ? '0 errors, 0 warnings in the game\'s source' : 'running...',
      details: [...(e ? list(e[0]) : []), ...(w ? list(w[0]) : [])],
      failed: warnings > 0,
    };
  },
  lint(out, done) {
    const m = out.match(/✖ (\d+) problems? \((\d+) errors?, (\d+) warnings?\)/);
    const files = out.split('\n').filter(l => /^\s*\d+:\d+\s+(error|warning)/.test(l)).map(l => l.trim()).slice(0, 30);
    return { summary: m ? `${m[2]} error(s), ${m[3]} warning(s)` : done ? 'clean' : 'running...', details: files, failed: !!m && Number(m[3]) > 0 };
  },
};

function parseArgs(argv) {
  const a = { ui: true, open: true, port: 8768, serial: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--only') a.only = argv[++i].split(',').map(s => s.trim());
    else if (k === '--serial') a.serial = true;
    else if (k === '--no-ui') a.ui = false;
    else if (k === '--no-open') a.open = false;
    else if (k === '--port') a.port = Number(argv[++i]);
    else throw new Error(`unknown option ${k}`);
  }
  return a;
}

function git() {
  const run = (c) => { try { return execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
  const dirty = run('git status --porcelain').split('\n').filter(Boolean).length;
  return { branch: run('git rev-parse --abbrev-ref HEAD'), head: run('git rev-parse --short HEAD'), dirty };
}

function runStep(step, state, onLine) {
  return new Promise((resolve) => {
    step.status = 'RUNNING'; step.startedAt = Date.now(); step.out = '';
    const child = spawn(`npm run ${step.script}`, { cwd: APP, shell: true, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } });
    const take = (d) => { const s = String(d).replace(ANSI, '').replace(/\r\n/g, '\n'); step.out += s; Object.assign(step, READ[step.id](step.out, false)); onLine(); };
    child.stdout.on('data', take); child.stderr.on('data', take);
    child.on('close', (code) => {
      step.endedAt = Date.now(); step.code = code;
      const r = READ[step.id](step.out, true);
      Object.assign(step, r);
      step.status = code === 0 && !r.failed ? 'PASS' : 'FAIL';
      resolve();
    });
  });
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const steps = STEPS.filter(s => !cfg.only || cfg.only.includes(s.id) || cfg.only.includes(s.script)).map(s => ({ ...s, status: 'PENDING', summary: 'waiting', details: [], out: '' }));
  if (!steps.length) throw new Error(`--only matched nothing; the gates are ${STEPS.map(s => s.id).join(', ')}`);
  const stamp = new Date();
  const outDir = path.join(ROOT, 'scripts', '.shots', 'verify', `${stamp.toISOString().slice(0, 10)}-${stamp.toTimeString().slice(0, 8).replace(/:/g, '')}`);
  mkdirSync(outDir, { recursive: true });
  const state = { startedAt: Date.now(), finishedAt: null, git: git(), steps, outDir: path.relative(ROOT, outDir) };
  const view = () => ({ ...state, steps: steps.map(({ out, ...s }) => ({ ...s, tail: out.split('\n').slice(-400).join('\n') })) });

  let server = null;
  if (cfg.ui) {
    server = http.createServer((req, res) => {
      if (req.url.startsWith('/state')) { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(view())); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page(null));
    });
    await new Promise((resolve) => { server.once('error', () => { server = null; resolve(); }); server.listen(cfg.port, '127.0.0.1', resolve); });
    if (server) {
      const url = `http://127.0.0.1:${cfg.port}`;
      console.log(`dashboard: ${url}`);
      if (cfg.open) exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`);
    } else console.log(`port ${cfg.port} is taken - running without the dashboard (--port to pick another)`);
  }

  const say = (s) => console.log(`${s.status === 'PASS' ? 'PASS' : s.status === 'FAIL' ? 'FAIL' : '    '}  ${s.label.padEnd(7)} ${((s.endedAt - s.startedAt) / 1000).toFixed(1).padStart(5)}s  ${s.summary}`);
  const go = async (s) => { await runStep(s, state, () => {}); say(s); writeFileSync(path.join(outDir, `${s.id}.log`), s.out); };
  if (cfg.serial) for (const s of steps) await go(s);
  else await Promise.all(steps.map(go));

  state.finishedAt = Date.now();
  const failed = steps.filter(s => s.status === 'FAIL');
  for (const s of failed) for (const d of s.details.slice(0, 10)) console.log(`        ${s.id}: ${d}`);
  writeFileSync(path.join(outDir, 'dashboard.html'), page(view()));
  console.log(`${failed.length ? `${failed.length} of ${steps.length} gates FAIL` : `all ${steps.length} gates pass`} in ${((state.finishedAt - state.startedAt) / 1000).toFixed(0)}s - logs and dashboard.html in ${state.outDir}`);
  if (server) setTimeout(() => { server.close(); server.closeAllConnections?.(); }, 4000);
  process.exitCode = failed.length ? 1 : 0;
}

function page(baked) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verify - Ride The Bus</title>
<style>
:root { --bg:#16120f; --panel:#221c17; --line:#3a3029; --ink:#efe6da; --dim:#a8998a; --faint:#6f6358;
  --pass:#5fbf7f; --fail:#e5604f; --run:#e8c66a; }
* { box-sizing:border-box } body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
header { padding:18px 24px 14px; border-bottom:1px solid var(--line); display:flex; flex-wrap:wrap; gap:8px 28px; align-items:baseline }
h1 { margin:0; font-size:19px; letter-spacing:-.01em } .meta { color:var(--dim) } .meta b { color:var(--ink); font-weight:600 }
main { padding:16px 24px 40px; max-width:1280px }
.banner { font-size:26px; font-weight:650; margin:4px 0 16px } .banner.ok { color:var(--pass) } .banner.bad { color:var(--fail) } .banner.run { color:var(--run) }
.grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(270px, 1fr)); gap:16px }
.card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; border-top:4px solid var(--line) }
.card.PASS { border-top-color:var(--pass) } .card.FAIL { border-top-color:var(--fail) } .card.RUNNING { border-top-color:var(--run) }
.top { display:flex; justify-content:space-between; align-items:baseline; gap:10px }
.card h2 { margin:0; font-size:16px } .what { color:var(--faint); font-size:12px; margin-top:2px }
.pill { font-size:11px; font-weight:700; letter-spacing:.06em; padding:3px 8px; border-radius:999px; color:#130f0c; background:var(--line) }
.pill.PASS { background:var(--pass) } .pill.FAIL { background:var(--fail) } .pill.RUNNING { background:var(--run) } .pill.PENDING { color:var(--dim) }
.sum { margin:12px 0 4px; font-size:15px; font-weight:600; font-variant-numeric:tabular-nums } .time { color:var(--dim); font-size:12px; font-variant-numeric:tabular-nums }
ul { margin:10px 0 0; padding-left:18px; color:var(--fail); font-size:12px; max-height:220px; overflow:auto } li { margin:2px 0; word-break:break-word }
details { margin-top:12px } summary { cursor:pointer; color:var(--dim); font-size:12px }
pre { margin:8px 0 0; max-height:360px; overflow:auto; font:12px/1.5 ui-monospace, Consolas, monospace; color:var(--dim); white-space:pre-wrap; word-break:break-word; background:#120e0b; border-radius:6px; padding:8px 10px }
</style></head><body>
<header><h1>Verify</h1><div class="meta" id="meta">connecting...</div></header>
<main><div class="banner run" id="banner">running...</div><div class="grid" id="grid"></div></main>
<script>
const BAKED = ${baked ? JSON.stringify(baked).replace(/</g, '\\u003c') : 'null'};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const dur = (ms) => ms == null || ms < 0 ? '-' : (ms / 1000).toFixed(1) + 's';
const open = new Set();
function render(st) {
  const now = st.finishedAt || Date.now();
  const g = st.git || {};
  document.getElementById('meta').innerHTML = (g.branch ? '<b>' + esc(g.branch) + '</b> @ <b>' + esc(g.head) + '</b>' + (g.dirty ? ' &middot; ' + g.dirty + ' uncommitted file(s)' : ' &middot; clean tree') + ' &middot; ' : '') + 'started ' + new Date(st.startedAt).toLocaleTimeString() + ' &middot; ' + (st.finishedAt ? 'finished in <b>' + dur(st.finishedAt - st.startedAt) + '</b> &middot; logs in ' + esc(st.outDir) : 'elapsed <b>' + dur(now - st.startedAt) + '</b>');
  const fail = st.steps.filter(s => s.status === 'FAIL').length, pass = st.steps.filter(s => s.status === 'PASS').length;
  const b = document.getElementById('banner');
  b.className = 'banner ' + (fail ? 'bad' : st.finishedAt ? 'ok' : 'run');
  b.textContent = st.finishedAt ? (fail ? fail + ' of ' + st.steps.length + ' gates fail' : 'All ' + st.steps.length + ' gates pass') : pass + ' of ' + st.steps.length + ' passed so far' + (fail ? ', ' + fail + ' failed' : '');
  for (const d of document.querySelectorAll('details[data-id]')) if (d.open) open.add(d.dataset.id); else open.delete(d.dataset.id);
  document.getElementById('grid').innerHTML = st.steps.map(s => '<div class="card ' + s.status + '"><div class="top"><div><h2>' + esc(s.label) + '</h2><div class="what">npm run ' + esc(s.script) + ' &middot; ' + esc(s.what) + '</div></div><span class="pill ' + s.status + '">' + s.status + '</span></div>'
    + '<div class="sum">' + esc(s.summary) + '</div><div class="time">' + (s.startedAt ? dur((s.endedAt || now) - s.startedAt) : 'not started') + (s.code != null && s.code !== 0 ? ' &middot; exit ' + s.code : '') + '</div>'
    + (s.details && s.details.length ? '<ul>' + s.details.map(d => '<li>' + esc(d) + '</li>').join('') + '</ul>' : '')
    + '<details data-id="' + s.id + '"' + (open.has(s.id) ? ' open' : '') + '><summary>output</summary><pre>' + esc(s.tail || '') + '</pre></details></div>').join('');
}
if (BAKED) render(BAKED);
else { const tick = () => fetch('/state', { cache: 'no-store' }).then(r => r.json()).then(st => { render(st); if (st.finishedAt) clearInterval(timer); }).catch(() => clearInterval(timer)); const timer = setInterval(tick, 700); tick(); }
</script></body></html>`;
}

main().catch(e => { console.error(String(e.stack || e)); process.exitCode = 2; });
