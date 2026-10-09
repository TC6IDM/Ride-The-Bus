// A live dashboard for a run: http://127.0.0.1:<port>, opened in the browser.
// The page polls /state once a second; the run keeps that object current.
// At the end the same page is written to the run's folder as dashboard.html,
// with the final state baked in, so it survives the process.
import http from 'node:http';
import { exec } from 'node:child_process';
import { writeFileSync, existsSync, createReadStream } from 'node:fs';
import path from 'node:path';

// shotsDir: the run's screenshots, served under /shots/ - the same relative
// path the snapshot uses, since dashboard.html is written beside that folder.
export function startDashboard({ port, state, open = true, shotsDir = null }) {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/state')) { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(state())); return; }
    if (req.url.startsWith('/shots/') && shotsDir) {
      const f = path.join(shotsDir, path.basename(decodeURIComponent(req.url.slice(7).split('?')[0])));
      if (/\.png$/i.test(f) && existsSync(f)) { res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }); createReadStream(f).pipe(res); return; }
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(page(null));
  });
  return new Promise((resolve) => {
    server.once('error', () => resolve(null)); // port taken: run without a dashboard
    server.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${port}`;
      if (open) exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`);
      // The open page polls on keep-alive sockets, and server.close() waits for
      // them forever - the run printed its summary and never exited.
      resolve({ url, close: () => { server.close(); server.closeAllConnections(); }, snapshot: (file) => writeFileSync(file, page(state())) });
    });
  });
}

function page(baked) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>RGS live run</title>
<style>
:root { --bg:#16120f; --panel:#221c17; --line:#3a3029; --ink:#efe6da; --dim:#a8998a; --faint:#6f6358;
  --pass:#5fbf7f; --fail:#e5604f; --error:#e8a33a; --sim:#8fa6e0; --owner:#b47cc8; --skip:#4a4038; --run:#e8c66a; }
* { box-sizing:border-box } body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
header { padding:18px 24px 14px; border-bottom:1px solid var(--line); display:flex; flex-wrap:wrap; gap:8px 28px; align-items:baseline }
h1 { margin:0; font-size:19px; letter-spacing:-.01em } .meta { color:var(--dim) } .meta b { color:var(--ink); font-weight:600 }
main { padding:16px 24px 40px; display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:18px }
@media (max-width:980px){ main { grid-template-columns:1fr } }
.card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px }
.card h2 { margin:0 0 10px; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--dim); font-weight:600 }
.bar { height:10px; border-radius:6px; background:#120e0b; overflow:hidden; display:flex }
.bar span { height:100% } .big { font-size:28px; font-weight:650; font-variant-numeric:tabular-nums }
.counts { display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:10px; font-variant-numeric:tabular-nums }
.dot { display:inline-block; width:9px; height:9px; border-radius:3px; margin-right:6px; vertical-align:0 }
.sec { margin:14px 0 4px; font-size:12px; color:var(--dim) } .grid { display:flex; flex-wrap:wrap; gap:5px }
.chk { width:62px; padding:4px 0 3px; text-align:center; border-radius:6px; font-size:11px; font-weight:600; font-variant-numeric:tabular-nums; cursor:default; border:1px solid transparent; color:#130f0c }
.s-PASS{background:var(--pass)} .s-FAIL{background:var(--fail)} .s-ERROR{background:var(--error)} .s-SIM{background:var(--sim)} .s-OWNER{background:var(--owner)}
.s-SKIP{background:var(--skip); color:var(--dim)} .s-PENDING{background:transparent; border-color:var(--line); color:var(--faint)} .s-RUNNING{background:transparent; border-color:var(--run); color:var(--run)}
.shots { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:12px }
.shots a { display:block; color:var(--dim); font-size:11px; text-decoration:none; word-break:break-word } .shots a:hover { color:var(--ink) }
.shots img { display:block; width:100%; margin-bottom:4px; border-radius:6px; border:1px solid var(--line); background:#0e0b09 }
.task { display:grid; grid-template-columns:1fr auto; gap:2px 10px; padding:7px 0; border-top:1px solid var(--line) } .task:first-of-type{border-top:0}
.task .n { font-weight:600 } .task .c { color:var(--dim); font-size:12px; grid-column:1/-1 } .task .bar { grid-column:1/-1; height:4px }
.kv { display:grid; grid-template-columns:1fr auto; gap:4px 12px; font-variant-numeric:tabular-nums } .kv span:nth-child(odd){color:var(--dim)}
.warn { color:var(--error) } pre { margin:0; max-height:340px; overflow:auto; font:12px/1.5 ui-monospace, Consolas, monospace; color:var(--dim); white-space:pre-wrap; word-break:break-word }
#tip { position:fixed; pointer-events:none; max-width:460px; background:#0e0b09; border:1px solid var(--line); border-radius:8px; padding:9px 11px; font-size:12px; display:none; z-index:9 }
#tip b { display:block; margin-bottom:3px; color:var(--ink) } .done-note { color:var(--pass) }
</style></head><body>
<header><h1 id="title">RGS live run</h1><div class="meta" id="meta">connecting...</div></header>
<main>
  <section>
    <div class="card"><h2>Progress</h2>
      <div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap">
        <div class="big" id="pct">-</div><div class="meta" id="eta"></div></div>
      <div class="bar" id="pbar" style="margin-top:8px"></div>
      <div class="counts" id="counts"></div></div>
    <div class="card" style="margin-top:18px"><h2>Every check <span style="text-transform:none; letter-spacing:0">- hover for the evidence</span></h2><div id="checks"></div></div>
    <div class="card" id="shotcard" style="margin-top:18px; display:none"><h2>Screenshots <span style="text-transform:none; letter-spacing:0">- click for full size</span></h2><div class="shots" id="shots"></div></div>
  </section>
  <aside>
    <div class="card"><h2>Running now</h2><div id="tasks"></div></div>
    <div class="card" style="margin-top:18px"><h2 id="sidehead">RGS gate</h2><div class="kv" id="gate"></div></div>
    <div class="card" style="margin-top:18px"><h2>Log</h2><pre id="log"></pre></div>
  </aside>
</main>
<div id="tip"></div>
<script>
const BAKED = ${baked ? JSON.stringify(baked).replace(/</g, '\\u003c') : 'null'};
const COL = { PASS:'var(--pass)', FAIL:'var(--fail)', ERROR:'var(--error)', SIM:'var(--sim)', OWNER:'var(--owner)', SKIP:'var(--skip)', RUNNING:'var(--run)', PENDING:'#3a3029' };
const NAME = { PASS:'pass', FAIL:'fail', ERROR:"couldn't run", SIM:'simulated', OWNER:"the owner's", SKIP:'not selected', RUNNING:'running', PENDING:'waiting' };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const dur = (ms) => { if (ms == null || !isFinite(ms) || ms < 0) return '-'; const s = Math.round(ms / 1000); return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; };
let last = null, shotsShown = -1;
function render(st) {
  last = st;
  const now = st.finishedAt || Date.now();
  const title = st.title || 'RGS live run';
  if (document.title !== title) { document.title = title; document.getElementById('title').textContent = title; }
  document.getElementById('meta').innerHTML = (st.local ? '<b>local</b> - no live RGS traffic' : 'front <b>v' + st.front + '</b> &middot; math <b>v' + st.math + '</b>') + ' &middot; started ' + new Date(st.startedAt).toLocaleTimeString() + ' &middot; elapsed <b>' + dur(now - st.startedAt) + '</b>' + (st.build ? ' &middot; index.html <b>' + esc(st.build) + '</b>' : '') + (st.finishedAt ? ' &middot; <span class="done-note">finished</span>' : '');
  const checks = Object.values(st.checks);
  const sel = checks.filter(c => c.selected);
  const decided = sel.filter(c => !['PENDING', 'RUNNING'].includes(c.status));
  const pct = st.progress != null ? st.progress : (sel.length ? decided.length / sel.length : 1);
  document.getElementById('pct').textContent = Math.round(pct * 100) + '%  (' + decided.length + ' of ' + sel.length + ' checks decided)';
  document.getElementById('eta').innerHTML = st.finishedAt ? 'done in ' + dur(st.finishedAt - st.startedAt) + (st.report ? ' &middot; report: ' + esc(st.report) : '') : (st.etaMs != null ? 'about <b>' + dur(st.etaMs) + '</b> left' : 'estimating...');
  const order = ['PASS', 'SIM', 'FAIL', 'ERROR', 'RUNNING', 'PENDING'];
  const n = (s) => sel.filter(c => c.status === s).length;
  document.getElementById('pbar').innerHTML = order.map(s => n(s) ? '<span style="width:' + (100 * n(s) / sel.length) + '%; background:' + COL[s] + '"></span>' : '').join('');
  document.getElementById('counts').innerHTML = ['PASS', 'FAIL', 'ERROR', 'SIM', 'RUNNING', 'PENDING', 'OWNER', 'SKIP'].map(s => { const k = checks.filter(c => c.status === s).length; return k ? '<span><i class="dot" style="background:' + COL[s] + '"></i>' + k + ' ' + NAME[s] + '</span>' : ''; }).join('');
  const bySec = {};
  for (const c of checks) (bySec[c.section] ||= []).push(c);
  document.getElementById('checks').innerHTML = Object.entries(bySec).map(([sec, list]) => '<div class="sec">' + esc(sec) + '</div><div class="grid">' + list.map(c => '<div class="chk s-' + c.status + '" data-id="' + c.id + '">' + c.id + '</div>').join('') + '</div>').join('');
  document.getElementById('tasks').innerHTML = (st.running.map(t => { const el = now - t.startedAt; const f = Math.min(1, el / (t.est * 1000)); return '<div class="task"><span class="n">' + esc(t.name) + '</span><span class="meta">' + dur(el) + ' / ~' + dur(t.est * 1000) + '</span><span class="c">' + t.covers.join(' ') + '</span><div class="bar"><span style="width:' + (100 * f) + '%; background:' + (el > t.est * 1500 ? 'var(--error)' : 'var(--run)') + '"></span></div></div>'; }).join('') || '<div class="meta">' + (st.finishedAt ? 'nothing - the run is over' : 'between tasks') + '</div>') + '<div class="meta" style="margin-top:8px">' + st.queued + ' tasks queued &middot; ' + st.doneTasks + ' of ' + st.totalTasks + ' done</div>';
  const shots = st.shots || [];
  if (shots.length !== shotsShown) {
    shotsShown = shots.length;
    document.getElementById('shotcard').style.display = shots.length ? '' : 'none';
    document.getElementById('shots').innerHTML = shots.map(f => '<a href="shots/' + encodeURIComponent(f) + '" target="_blank" rel="noopener"><img loading="lazy" src="shots/' + encodeURIComponent(f) + '" alt="">' + esc(f.replace(/\\.png$/i, '')) + '</a>').join('');
  }
  if (st.side) {
    document.getElementById('sidehead').textContent = st.side.title;
    document.getElementById('gate').innerHTML = st.side.rows.map(([k, v]) => '<span>' + esc(k) + '</span><span>' + esc(v) + '</span>').join('');
  } else {
  const g = st.gate || {};
  const paused = g.pausedUntil && g.pausedUntil > now;
  document.getElementById('gate').innerHTML = [
    ['last 10 minutes', g.recent ? '<span class="' + (g.windowCap && g.recent.calls >= g.windowCap * 0.9 ? 'warn' : '') + '">' + g.recent.calls + (g.windowCap ? ' of ' + g.windowCap : '') + ' calls</span>, ' + g.recent.auths + ' authenticates' : '-'], ['RGS calls', g.calls], ['authenticates', g.auths], ['refused by the RGS', '<span class="' + (g.refusals ? 'warn' : '') + '">' + (g.refusals || 0) + '</span>'],
    ['spacing', g.gap + ' ms / ' + g.authGap + ' ms per authenticate'], ['round slot', g.slot ? esc(g.slot) : 'free'],
    ['paused', paused ? '<span class="warn">' + dur(g.pausedUntil - now) + ' left</span>' : 'no'], ['demo sessions', st.sessions], ['replays', st.replays],
  ].map(([k, v]) => '<span>' + k + '</span><span>' + (v ?? '-') + '</span>').join('');
  }
  const log = document.getElementById('log'); const atEnd = log.scrollTop + log.clientHeight >= log.scrollHeight - 8;
  log.textContent = st.log.join('\\n'); if (atEnd) log.scrollTop = log.scrollHeight;
}
const tip = document.getElementById('tip');
document.addEventListener('mousemove', (e) => {
  const el = e.target.closest('.chk'); if (!el || !last) { tip.style.display = 'none'; return; }
  const c = last.checks[el.dataset.id];
  tip.innerHTML = '<b>' + c.id + ' &middot; ' + esc(c.title) + '</b><span style="color:' + COL[c.status] + '">' + NAME[c.status] + '</span> &middot; ' + esc(c.severity) + (c.task ? ' &middot; ' + esc(c.task) : '') + (c.evidence ? '<div style="margin-top:6px; color:var(--dim)">' + esc(c.evidence).slice(0, 900) + '</div>' : '');
  tip.style.display = 'block';
  tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px';
  tip.style.top = Math.min(e.clientY + 14, innerHeight - tip.offsetHeight - 8) + 'px';
});
if (BAKED) render(BAKED);
else { const tick = () => fetch('/state', { cache: 'no-store' }).then(r => r.json()).then(st => { render(st); if (st.finishedAt) clearInterval(timer); }).catch(() => { if (last && !last.finishedAt) document.getElementById('meta').innerHTML += ' &middot; <span class="warn">run ended or unreachable</span>'; clearInterval(timer); }); const timer = setInterval(tick, 1000); tick(); }
</script></body></html>`;
}
