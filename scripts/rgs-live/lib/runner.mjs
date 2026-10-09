// The task pool and the API every check is written against.
//
// A TASK covers one or more check IDs and owns its browser contexts; nothing
// is shared between tasks but the browser and the saved sign-in, so tasks run
// side by side. Two things are rationed across the whole run:
//   - Studio launches (each mints a demo session through the play modal);
//   - replay pages - the live replay endpoint refuses for minutes after ~300
//     rapid fetches (rtb-live-audit, Pitfalls).
// A task that plays rounds mints its OWN session: one session has one round
// in flight at a time, and a shared balance would make every money check
// depend on what else happened to run.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { mintSession, replayUrl, withParams, redact } from './studio.mjs';
import { VIEWPORTS, dismissIntro, sleep, recorder } from './game.mjs';
import { held, taskHeldMs, deadline } from './held.mjs';

export class Semaphore {
  constructor(n) { this.n = n; this.waiting = []; }
  async acquire() { if (this.n > 0) { this.n--; return; } await new Promise(r => this.waiting.push(r)); }
  release() { const next = this.waiting.shift(); if (next) next(); else this.n++; }
  async use(fn) { await this.acquire(); try { return await fn(); } finally { this.release(); } }
}

/**
 * THE RGS GATE. The live RGS rate-limits per client, not per session - one
 * machine's parallel sessions share one budget - and a refusal carries no CORS
 * headers, so the browser sees a failed request rather than a 429, and the
 * client then refuses EVERY call (authenticate included) for minutes
 * (measured 2026-10-08). So every request any task makes to the RGS waits its
 * turn here: one global minimum gap, however many tasks run. A refused request
 * pauses the gate for a cooldown, and the task that saw it is re-run once.
 */
//
// It also holds THE ACCOUNT'S ROUND SLOT. Every demo session one Studio account
// mints shares one "active round": a fresh session's authenticate hands back
// another session's open round, and its page resumes and ENDS it (measured
// 2026-10-08 - session B, minted in its own context, resumed session A's
// 0.5x round). Parallel tasks therefore stole each other's rounds: "player has
// active round" on a first play, "player does not have active round" on an
// end-round. Balances are per session; only the open round is shared. So:
//   - a play waits for the slot and keeps it while its round is open (a loss
//     closes at once, a win at its end-round);
//   - an authenticate never waits (the game's loader gives up after 8s); if it
//     carries ANOTHER live page's open round, the gate strips the round, so
//     the page starts clean instead of resuming it. A page reloading its own
//     round (the resume checks) still gets it;
//   - a page that closes with its round still open has it ended for it, so a
//     crashed task cannot leave the account stuck on "player has active round".
export class RgsGate {
  constructor(gapMs, cooldownMs, authGapMs = 4000) { this.gap = gapMs; this.cooldown = cooldownMs; this.authGap = authGapMs; this.next = 0; this.nextAuth = 0; this.pausedUntil = 0; this.refusals = 0; this.calls = 0; this.auths = 0; this.open = null; this.waitedMs = 0; }
  /**
   * An authenticate's turn: the wider authenticate gap, then an ordinary call
   * slot. t.game / t.reload / t.goto take it BEFORE the page navigates, and the
   * authenticate itself then passes the gate without waiting again - so a page
   * is never left on its loader while the gate makes it wait.
   * Authenticates are what the RGS rations hardest: 74 in 136s was its limit (2026-10-08).
   */
  async authSlot() {
    const now = Date.now(); const at = Math.max(now, this.nextAuth, this.pausedUntil);
    this.nextAuth = at + this.authGap; this.auths++;
    if (at > now) await sleep(at - now);
    await this.slot(true);
  }
  held(by) { return this.open && this.open.owner !== by && Date.now() - this.open.since < 45_000; }
  async take(by, label) {
    const t0 = Date.now(); let told = false;
    while (this.held(by)) {
      if (!told && Date.now() - t0 > 5000) { told = true; this.log?.(`    ${label}: waiting for the account's round slot, held by ${this.open.label} for ${Math.round((Date.now() - this.open.since) / 1000)}s`); }
      await sleep(100);
    }
    this.waitedMs += Date.now() - t0;
    if (this.open && this.open.owner !== by) { this.log?.(`    ${this.open.label}: its round was open ${Math.round((Date.now() - this.open.since) / 1000)}s - ended it so ${label} can play`); await this.abandon(); }
  }
  /** Wait until no OTHER page holds an open round - before a page loads, so its authenticate cannot land mid-round. */
  async waitFree(by, label) { const t0 = Date.now(); let told = false; while (this.held(by)) { if (!told && Date.now() - t0 > 5000) { told = true; this.log?.(`    ${label}: holding a page load until ${this.open.label}'s round closes`); } await sleep(100); } }
  hold(by, sessionID, request, label) { this.open = { owner: by, sessionID, request, label, since: Date.now() }; }
  release(by) { if (this.open && this.open.owner === by) this.open = null; }
  /** End a round whose page is gone, straight on the RGS. */
  async abandon() {
    const o = this.open; this.open = null;
    if (!o?.sessionID || !o.request) return;
    try { await o.request.post('https://rgsd.engine.io/wallet/end-round', { data: { sessionID: o.sessionID }, timeout: 15_000 }); } catch {}
  }
  /** Calls and authenticates in the last 10 minutes - the window the RGS's refusals have tracked. */
  recent() { const cut = Date.now() - 600_000; this.stamps = (this.stamps || []).filter(x => x.t > cut); return { calls: this.stamps.length, auths: this.stamps.filter(x => x.auth).length }; }
  async slot(auth = false) {
    // The window cap: never more than windowCap calls in any 10 minutes. The
    // RGS's refusals tracked that window (60-110 calls, 2026-10-08/09), and a
    // refusal costs far more time - growing lockouts - than waiting does.
    //
    // The calls are PACED to it, not burst into it: one every 600s / windowCap
    // (7.5s at 80), with a small burst allowance (GCRA - a reservation per call,
    // taken in arrival order). A cap enforced only by counting let four tasks
    // spend all 80 calls in 150s and then held every request for seven
    // minutes - the same throughput, in stalls that outlasted every timeout.
    // The count below is the backstop, and with even spacing it only ever
    // waits a few seconds.
    const now = Date.now();
    let at = Math.max(now, this.next, this.pausedUntil);
    if (this.windowCap) {
      const T = 600_000 / this.windowCap, tau = ((this.burst ?? 8) - 1) * T;
      const tat = Math.max(this.tat || 0, now);
      at = Math.max(at, tat - tau);
      this.tat = tat + T;
    }
    this.next = at + this.gap;
    this.calls++;
    if (at > now) await sleep(at - now);
    for (let told = false; ;) {
      if (Date.now() < this.pausedUntil) { await sleep(Math.min(this.pausedUntil - Date.now(), 5000)); continue; }
      if (!this.windowCap) break;
      const r = this.recent();
      if (r.calls < this.windowCap) break;
      const wait = this.stamps[0].t + 600_000 - Date.now() + 50;
      if (!told) { told = true; this.windowWaits = (this.windowWaits || 0) + 1; if (wait > 15_000) this.log?.(`    the RGS window is full (${r.calls} calls in 10 minutes) - waiting ${Math.ceil(wait / 1000)}s`); }
      await sleep(Math.min(Math.max(wait, 200), 5000));
    }
    (this.stamps ||= []).push({ t: Date.now(), auth });
  }
  /** A refusal: pause everyone for the cooldown, and widen both spacings for the rest of the run (once per episode). */
  refused() {
    this.refusals++;
    if (Date.now() < this.pausedUntil) return;
    this.pausedUntil = Date.now() + this.cooldown;
    this.gap = Math.min(2000, Math.round(this.gap * 1.5));
    this.authGap = Math.min(15_000, Math.round(this.authGap * 1.5));
    this.episodes = (this.episodes || 0) + 1;
  }
}
const RGS_HOST = /^https:\/\/rgsd\.engine\.io\//;

const watched = new WeakSet();
/** Shared demo sessions, one per configuration, for the whole run (t.session({ shared: true })). */
const sharedSessions = new Map();
/** page -> fn(authenticate JSON): a simulated operator block, applied inside the gate (see t.rewriteAuth). */
const authRewrites = new WeakMap();
/** Pages whose next authenticate already waited its turn (t.game / t.reload reserve it BEFORE navigating, so the game's 8s loader never sees the wait). */
const authReserved = new WeakSet();
/**
 * Pages whose next /bet/replay fetch already took its call slot (t.replay).
 * The game races its two LAUNCH requests - authenticate and the replay fetch -
 * against a 10 s timeout (components-shared Authenticate.svelte), so neither
 * may wait at the gate once the page is loading: a replay queued 30 s behind
 * other tasks' plays showed "Could not reach the game server" (2026-10-09).
 */
const replayReserved = new WeakSet();
async function gateRoute(route, gate, ctx) {
  const req = route.request();
  const u = req.url();
  let owner = ctx;
  try { owner = req.frame().page(); } catch {}
  if (owner !== ctx && !watched.has(owner)) {
    watched.add(owner);
    owner.once('close', () => { if (gate.open && gate.open.owner === owner) gate.abandon(); });
  }
  const isPlay = /\/wallet\/play/.test(u), isEnd = /\/wallet\/end-round/.test(u), isAuth = /\/wallet\/authenticate/.test(u), isReplay = /\/bet\/replay\//.test(u);
  const label = ctx.__task || 'a task';
  const tIn = Date.now();
  // The time this request spends queued here stretches its page's and its
  // task's time limits (held.mjs): waiting a turn is not the game being slow.
  const release = held(owner, label);
  let tTaken = tIn;
  try {
    if (isPlay) await gate.take(owner, label);
    tTaken = Date.now();
    // A reserved authenticate already took its call slot, before its page navigated.
    if (isAuth) { if (authReserved.has(owner)) authReserved.delete(owner); else await gate.authSlot(); }
    else if (isReplay && replayReserved.has(owner)) replayReserved.delete(owner);
    else await gate.slot();
  } finally { release(); }
  const tSlot = Date.now();
  if (!isPlay && !isEnd && !isAuth) { await route.continue().catch(() => {}); return; }
  let sessionID = null; try { sessionID = JSON.parse(req.postData() || '{}').sessionID; } catch {}
  try {
    const resp = await route.fetch();
    const body = await resp.text();
    const tGot = Date.now();
    // Waiting for a call slot is the pacing working; only a slow RGS or a long
    // wait for another task's round is worth a line.
    if (isPlay && (tGot - tSlot > 3000 || tTaken - tIn > 20_000)) gate.log?.(`    ${label}: a play took ${((tGot - tIn) / 1000).toFixed(1)}s - round slot ${((tTaken - tIn) / 1000).toFixed(1)}s, call gap ${((tSlot - tTaken) / 1000).toFixed(1)}s, the RGS ${((tGot - tSlot) / 1000).toFixed(1)}s`);
    let j = null; try { j = JSON.parse(body); } catch {}
    if (resp.status() === 429) {
      // The gate fetches on the page's behalf, so it sees the real status even
      // when the browser would only see a CORS failure. Say exactly what was
      // refused: which call, after how much traffic, and what the RGS said.
      const h = resp.headers();
      const r = gate.recent();
      gate.log?.(`    ${label}: the RGS answered 429 to ${u.replace(/^https:\/\/[^/]+/, '').replace(/\?.*$/, '')} (${r.calls} calls / ${r.auths} authenticates in the last 10 minutes; retry-after ${h['retry-after'] ?? 'none'}; CORS ${h['access-control-allow-origin'] ? 'present' : 'absent'}): ${redact(body).slice(0, 200)} - pausing every task's RGS traffic ${Math.round(gate.cooldown / 1000)}s`);
      gate.refused();
    }
    if (isPlay) { if (resp.status() === 200 && j?.round?.active) gate.hold(owner, sessionID, ctx.request, label); else gate.release(owner); }
    if (isEnd) gate.release(owner);
    let out = j;
    if (isAuth && j?.round?.active) {
      if (gate.open && gate.open.owner !== owner && Date.now() - gate.open.since < 45_000) { out = { ...j }; delete out.round; }
      else gate.hold(owner, sessionID, ctx.request, label); // its own round, or a stray one it will resume and end
    }
    if (isAuth && out && authRewrites.has(owner)) { out = out === j ? { ...j } : out; authRewrites.get(owner)(out); }
    await route.fulfill({ response: resp, body: out && out !== j ? JSON.stringify(out) : body });
  } catch {
    if (isPlay || isEnd) gate.release(owner);
    await route.abort('aborted').catch(() => {});
  }
}

export function makeContext({ browser, statePath, cfg, task, sems, log, counters, gate }) {
  const contexts = [];
  const entries = {};      // id -> [{ ok: true|false|null, msg }]
  const simulated = new Set();
  const shotDir = path.join(cfg.outDir, 'shots');
  mkdirSync(shotDir, { recursive: true });
  const push = (id, ok, msg) => { (entries[id] ||= []).push({ ok, msg: redact(msg ?? '') }); };

  // A page load's turn at the gate, taken before it navigates: the account's
  // round slot, then the authenticate's slot. The wait counts as the task's
  // time at the gate, not its own.
  const turn = async (p) => {
    const release = held(null, task.name);
    try { await gate.waitFree(p, task.name); await gate.authSlot(); } finally { release(); }
    authReserved.add(p);
  };

  const t = {
    cfg, task: task.name,
    log: (m) => log(`    ${task.name}: ${redact(m)}`),
    async context({ viewport = 'desktop', touch, locale } = {}) {
      const v = typeof viewport === 'string' ? VIEWPORTS[viewport] : viewport;
      const isTouch = touch ?? !!v.touch;
      const ctx = await browser.newContext({
        storageState: statePath, viewport: { width: v.width, height: v.height }, locale,
        ...(isTouch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}),
      });
      contexts.push(ctx);
      ctx.__task = task.name;
      await ctx.route(RGS_HOST, (route) => gateRoute(route, gate, ctx));
      ctx.on('requestfailed', (r) => {
        try {
          if (RGS_HOST.test(r.url()) && /ERR_FAILED/.test(r.failure()?.errorText || '') && !t.offline) {
            gate.refused(); t.rateLimited = true;
            log(`    ${task.name}: the RGS refused ${r.url().replace(/\?.*$/, '').replace(/^https:\/\/[^/]+/, '')} - pausing every task's RGS traffic ${Math.round(gate.cooldown / 1000)}s`);
          }
        } catch {}
      });
      return ctx;
    },
    async page(opts) { return (await t.context(opts)).newPage(); },
    /**
     * A demo session. opts: currency, balance (micro), social, lang, device.
     * shared: true reuses one session per configuration across the whole run -
     * for tasks that look at the UI or play rounds whose money they do not
     * audit. Every mint costs RGS budget, so only money checks mint their own.
     */
    async session(opts = {}) {
      const { shared, ...rest } = opts;
      const o = { currency: 'USD', balance: 100_000_000_000, social: false, ...rest };
      const mint = async () => { counters.sessions++; const ctx = await browser.newContext({ storageState: statePath }); try { return await sems.launch.use(() => mintSession(ctx, { front: cfg.front, math: cfg.math, ...o })); } finally { await ctx.close().catch(() => {}); } };
      if (!shared) return mint();
      const key = JSON.stringify(o);
      if (!sharedSessions.has(key)) sharedSessions.set(key, mint().catch((e) => { sharedSessions.delete(key); throw e; }));
      return sharedSessions.get(key);
    },
    /** Open the game on a session URL. opts: viewport, touch, lang, params, intro (default true). */
    async game(url, { viewport = 'desktop', touch, lang, params = {}, intro = true, page } = {}) {
      const v = typeof viewport === 'string' ? VIEWPORTS[viewport] : viewport;
      const isTouch = touch ?? !!v.touch;
      const p = page || await t.page({ viewport, touch: isTouch });
      const target = withParams(url, { ...(lang ? { lang } : {}), device: isTouch ? 'mobile' : 'desktop', ...params });
      await turn(p);
      await p.goto(target);
      if (intro) await dismissIntro(p);
      return p;
    },
    /**
     * Visit sizes on as few page loads as possible - one mouse page and one
     * touch page, resized - because every load is an authenticate, and those
     * are what the RGS rations. fn(page, sizeName) runs at each size.
     */
    async sweep(url, sizes, fn, { lang, params } = {}) {
      for (const touch of [false, true]) {
        const list = sizes.filter(s => !!VIEWPORTS[s].touch === touch);
        if (!list.length) continue;
        const page = await t.game(url, { viewport: list[0], lang, params });
        for (const s of list) {
          await page.setViewportSize({ width: VIEWPORTS[s].width, height: VIEWPORTS[s].height });
          await sleep(350);
          await fn(page, s);
        }
        await page.close();
      }
    },
    /** Reload a game page, its authenticate's turn reserved first. */
    async reload(page, { intro = true } = {}) { await turn(page); await page.reload(); if (intro) await dismissIntro(page).catch(() => {}); return page; },
    /** Navigate a game page to a URL, its authenticate's turn reserved first. */
    async goto(page, url, { intro = true } = {}) { await turn(page); await page.goto(url); if (intro) await dismissIntro(page).catch(() => {}); return page; },
    replayUrl: (o) => replayUrl({ front: cfg.front, math: cfg.math, ...o }),
    /** Open a replay. Holds a replay slot only while the page loads (that is when it fetches). */
    async replay(o, { viewport = 'desktop', touch, page } = {}) {
      counters.replays++;
      if (counters.replays > cfg.replayBudget) throw new Error(`replay budget (${cfg.replayBudget}) spent - the live endpoint rate-limits`);
      const p = page || await t.page({ viewport, touch });
      await sems.replay.use(async () => {
        const release = held(null, task.name);
        try { await gate.slot(); } finally { release(); }
        replayReserved.add(p);
        await p.goto(t.replayUrl(o));
        const loaded = p.locator('.ss-play-btn, .replay-details, .ss-continue').first();
        for (const late = deadline(p, 25_000); !late();) if (await loaded.isVisible().catch(() => false)) break; else await sleep(200);
        await sleep(800);
      });
      return p;
    },
    async shot(page, name) {
      const file = path.join(shotDir, `${task.name}-${name}.png`.replace(/[^a-zA-Z0-9_.-]/g, '_'));
      await page.screenshot({ path: file }).catch(() => {});
      return file;
    },
    /** Rewrite this page's authenticate response (e.g. the jurisdiction block) - SIMULATED operator flags. */
    rewriteAuth: (page, fn) => authRewrites.set(page, fn),
    expect: (id, ok, msg) => push(id, !!ok, msg),
    pass: (id, msg) => push(id, true, msg),
    fail: (id, msg) => push(id, false, msg),
    note: (id, msg) => push(id, null, msg),
    /** A simulated result: recorded, never ticks the box. */
    sim: (id, ok, msg) => { simulated.add(id); push(id, !!ok, msg); },
    sleep,
  };

  // On a failure every page the task still has open is photographed, and any
  // RGS log it registered is written out, before the contexts close.
  const debugLogs = {};
  t.debug = (name, value) => { debugLogs[name] = value; };
  let recN = 0;
  /** recorder(page), with its log dumped on a failure. */
  t.recorder = (page) => { const r = recorder(page); debugLogs[`rgs-${++recN}`] = r.log; return r; };
  const finish = async (err) => {
    const failed = err || Object.values(entries).some(e => e.some(x => x.ok === false));
    if (failed) {
      let n = 0;
      for (const c of contexts) for (const p of c.pages()) await p.screenshot({ path: path.join(shotDir, `${task.name}-FAIL-${++n}.png`) }).catch(() => {});
      if (Object.keys(debugLogs).length) {
        const { writeFileSync } = await import('node:fs');
        writeFileSync(path.join(cfg.outDir, `${task.name}-debug.json`), redact(JSON.stringify(debugLogs, null, 1)));
      }
    }
    for (const c of contexts) await c.close().catch(() => {});
  };
  const verdicts = () => {
    const out = {};
    for (const id of task.covers) {
      const e = entries[id] || [];
      const fails = e.filter(x => x.ok === false), oks = e.filter(x => x.ok === true), notes = e.filter(x => x.ok === null);
      let status = fails.length ? 'FAIL' : oks.length ? 'PASS' : 'ERROR';
      if (status !== 'ERROR' && simulated.has(id)) status = fails.length ? 'FAIL' : 'SIM';
      const evidence = [...fails, ...oks, ...notes].map(x => x.msg).filter(Boolean).join('; ') || (status === 'ERROR' ? 'the task gave no verdict for this check' : '');
      out[id] = { status, evidence, task: task.name };
    }
    return out;
  };
  return { t, finish, verdicts, entries };
}

export async function runPool(tasks, pool, { concurrency, runOne }) {
  pool.queue = [...tasks];
  const workers = Array.from({ length: Math.min(concurrency, pool.queue.length) }, async () => {
    while (pool.queue.length) await runOne(pool.queue.shift());
  });
  await Promise.all(workers);
}

/** A task's time limit. `what` is the task's name: the limit stretches by its requests' time queued at the gate. */
export function withTimeout(promise, ms, what) {
  let timer;
  const t0 = Date.now();
  return Promise.race([
    promise.finally(() => clearInterval(timer)),
    new Promise((_, rej) => {
      timer = setInterval(() => {
        const queued = taskHeldMs(what);
        if (Date.now() - t0 - queued > ms) { clearInterval(timer); rej(new Error(`${what} timed out after ${Math.round(ms / 1000)}s of its own (and ${Math.round(queued / 1000)}s queued at the RGS gate)`)); }
      }, 1000);
    }),
  ]);
}
