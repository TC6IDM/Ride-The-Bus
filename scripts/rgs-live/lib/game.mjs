// Driving the game on a page. Everything here is LANGUAGE-NEUTRAL where it can
// be - classes and attributes, never English labels - so the same helpers
// work in all 17 locales and in social mode.
//
// Every page listener is wrapped in try/catch: a listener that throws inside
// Playwright's event dispatch takes the whole browser down (it did, twice, on
// 2026-10-07).
import { deadline } from './held.mjs';

export const VIEWPORTS = {
  desktop: { width: 1200, height: 675 },
  laptop: { width: 1024, height: 576 },
  popoutL: { width: 800, height: 450 },
  popoutS: { width: 400, height: 225 },
  mobileL: { width: 425, height: 812, touch: true },
  mobileM: { width: 375, height: 667, touch: true },
  mobileS: { width: 320, height: 568, touch: true },
};
export const SEVEN = ['desktop', 'laptop', 'popoutL', 'popoutS', 'mobileL', 'mobileM', 'mobileS'];

// FAMILIES_BY_VOLATILITY - the mode panel's row order (game/math/volatility.ts).
export const FAMILY_ORDER = ['sc', 'base', 'ls', 'hs', 'tr'];
export const FAMILY_PREFIX = { base: '', sc: 'sc_', hs: 'hs_', ls: 'ls_', tr: 'tr_' };
export const LANGS = ['en', 'ar', 'de', 'es', 'fi', 'fr', 'hi', 'id', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'vi', 'zh'];

const PICK = {
  color: { black: '.color-square .black-half', red: '.color-square .red-half' },
  hl: { higher: '.hl-square .higher-third', lower: '.hl-square .lower-third', equal: '.hl-square .equal-btn' },
  io: { inside: '.io-square .inside-half', outside: '.io-square .outside-half', equal: '.io-square .equal-btn' },
  suit: { heart: '.suit-square .quad-btn:nth-child(1)', spade: '.suit-square .quad-btn:nth-child(2)', club: '.suit-square .quad-btn:nth-child(3)', diamond: '.suit-square .quad-btn:nth-child(4)' },
};

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Every wait below that can span an RGS call runs on deadline(): a clock that
// stops while the page has a request queued at the runner's gate (held.mjs).

/** "red_higher_outside_heart" or {color, hl, io, suit} -> the four picks. */
export function parsePicks(p) {
  if (typeof p !== 'string') return p;
  const [color, hl, io, suit] = p.replace(/^(sc|hs|ls|tr)_/, '').split('_');
  return { color, hl, io, suit };
}

/** A displayed amount -> micro-units. Handles "$1,234.50", "1 234,50 $", "1.234,50 US$", "JPY 1,234". */
export function toMicro(text, places = 2) {
  const s = String(text || '').replace(/[‏‎  ]/g, ' ');
  const m = s.match(/-?\d[\d.,\s']*/);
  if (!m) return null;
  const n = m[0].trim().replace(/[\s']/g, '');
  // Which separator is the decimal one: with both present, the last; with one
  // kind used once, it is decimal unless exactly three digits follow it (then
  // it groups thousands - "1,234" - except in a three-place currency); used
  // more than once, it groups.
  const seps = n.match(/[.,]/g) || [];
  const last = Math.max(n.lastIndexOf('.'), n.lastIndexOf(','));
  let decimal = -1;
  if (seps.length && new Set(seps).size === 2) decimal = last;
  else if (seps.length === 1 && (n.length - last - 1 !== 3 || places === 3)) decimal = last;
  const int = (decimal >= 0 ? n.slice(0, decimal) : n).replace(/[.,]/g, '');
  const frac = decimal >= 0 ? n.slice(decimal + 1).replace(/[.,]/g, '') : '';
  return Math.round(parseFloat(`${int}.${frac || '0'}`) * 1e6);
}

/** Records every /wallet/* and /bet/* exchange, with session keys stripped. */
export function recorder(page) {
  const log = [];
  const strip = (o) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (/session/i.test(k)) o[k] = '<redacted>'; else strip(o[k]); } return o; };
  const onResp = async (resp) => {
    try {
      const u = resp.url();
      if (!/\/(wallet|bet)\//.test(u)) return;
      const req = resp.request();
      let body = null, res = null;
      try { body = strip(JSON.parse(req.postData() || 'null')); } catch {}
      try { res = strip(await resp.json()); } catch {}
      const r = res && res.round ? res.round : null;
      log.push({
        t: Date.now(), path: u.replace(/^[a-z]+:\/\/[^/]+/i, '').split('?')[0], status: resp.status(),
        req: body && { mode: body.mode, amount: body.amount, currency: body.currency },
        res: res && {
          balance: res.balance ? res.balance.amount : undefined, error: res.error || res.code, message: res.message,
          config: res.config, round: r && { id: r.betID ?? r.id, mode: r.mode, amount: r.amount, payoutMultiplier: r.payoutMultiplier, costMultiplier: r.costMultiplier, active: r.active, state: r.state },
        },
      });
    } catch {}
  };
  const reqs = [];
  const onReq = (req) => { try { const u = req.url(); if (/\/(wallet|bet)\//.test(u)) reqs.push({ t: Date.now(), path: u.replace(/^[a-z]+:\/\/[^/]+/i, '').split('?')[0], method: req.method() }); } catch {} };
  page.on('response', onResp);
  page.on('request', onReq);
  return {
    log, reqs,
    plays: () => log.filter(x => x.path.endsWith('/wallet/play')),
    ends: () => log.filter(x => x.path.endsWith('/wallet/end-round')),
    since: (n) => log.slice(n),
    stop: () => { page.off('response', onResp); page.off('request', onReq); },
  };
}

/** Console errors, page errors and failed or 4xx/5xx requests on a page. */
export function watchHealth(page) {
  const h = { console: [], all: [], pageErrors: [], bad: [], origins: {} };
  page.on('console', m => { try { const line = m.type() + ': ' + m.text().slice(0, 200); h.all.push(line); if (m.type() === 'error' || m.type() === 'warning') h.console.push(line); } catch {} });
  page.on('pageerror', e => { try { h.pageErrors.push(String(e).slice(0, 200)); } catch {} });
  page.on('response', r => { try { const o = (r.url().match(/^[a-z-]+:\/\/[^/?#]+/i) || ['other'])[0]; h.origins[o] = (h.origins[o] || 0) + 1; if (r.status() >= 400) h.bad.push(r.status() + ' ' + r.url().replace(/\?.*$/, '').slice(0, 120)); } catch {} });
  page.on('requestfailed', r => { try { h.bad.push('FAILED ' + r.url().replace(/\?.*$/, '').slice(0, 120) + ' ' + (r.failure()?.errorText || '')); } catch {} });
  return h;
}

export async function waitForIntro(page, ms = 30_000) {
  await page.locator('.ss-continue').first().waitFor({ state: 'visible', timeout: ms });
}

export async function dismissIntro(page) {
  const c = page.locator('.ss-continue').first();
  for (const late = deadline(page, 30_000); !late();) if (await c.isVisible().catch(() => false)) break; else await sleep(200);
  await c.click({ force: true }).catch(() => {});
  await page.locator('footer .cb-mode-btn').waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => !document.querySelector('.ss-continue'), null, { timeout: 10_000 }).catch(() => {});
  await sleep(400);
}

export async function closePopups(page) {
  for (let i = 0; i < 6 && await page.locator('.popup').count(); i++) { await page.keyboard.press('Escape'); await sleep(200); }
}

export async function currentFamily(page) {
  await closePopups(page);
  await page.locator('.cb-mode-btn').click();
  await page.locator('.popup .mode-option').first().waitFor({ timeout: 5000 });
  const i = await page.evaluate(() => [...document.querySelectorAll('.popup .mode-option')].findIndex(b => b.getAttribute('aria-current') === 'true'));
  await closePopups(page);
  return FAMILY_ORDER[i];
}

/** Switch family through the picker and its confirmation (language-neutral). */
export async function setFamily(page, fam) {
  await closePopups(page);
  await page.locator('.cb-mode-btn').click();
  const opt = page.locator('.popup .mode-option').nth(FAMILY_ORDER.indexOf(fam));
  await opt.waitFor({ timeout: 5000 });
  await opt.click();
  const go = page.locator('.popup .mode-confirm-go');
  await go.first().waitFor({ timeout: 1500 }).catch(() => {});
  if (await go.count()) await go.first().click();
  await sleep(500);
  await closePopups(page);
}

export async function setPicks(page, picks) {
  const p = parsePicks(picks);
  for (const k of ['color', 'hl', 'io', 'suit']) {
    if (!p[k] || p[k] === 'any') continue;
    const b = page.locator(PICK[k][p[k]]).first();
    if ((await b.getAttribute('aria-pressed')) !== 'true') { await b.click(); await sleep(120); }
  }
}

export async function setMode(page, mode) {
  const fam = (mode.match(/^(sc|hs|ls|tr)_/) || [, 'base'])[1];
  await setFamily(page, fam);
  if (fam !== 'tr') await setPicks(page, mode);
}

/** The bet menu's chips: [{ label, micro, el index }]. Opens the menu; leaves it open. */
export async function betChips(page) {
  await closePopups(page);
  await page.locator('.cb-bet-display').first().click();
  await page.locator('.popup .bet-chip').first().waitFor({ timeout: 5000 });
  const labels = await page.evaluate(() => [...document.querySelectorAll('.popup .bet-chip')].map(b => b.getAttribute('aria-label')));
  return labels.map((label, i) => ({ label, micro: toMicroBrowser(label), i }));
}
const toMicroBrowser = (s) => toMicro(s);

/** Pick the bet chip whose figure is `micro` (the ROUND COST on Three of a Kind). */
export async function setBetChip(page, micro) {
  const chips = await betChips(page);
  const c = chips.find(x => x.micro === micro);
  if (!c) { await closePopups(page); throw new Error(`no bet chip for ${micro / 1e6} (have ${chips.map(x => x.label).join(' ')})`); }
  await page.locator('.popup .bet-chip').nth(c.i).click();
  await sleep(300);
  await closePopups(page);
  return c.label;
}

/** The error dialog, if one is up: its words, its buttons, and whether it is the top layer. */
export const errorDialog = (page) => page.evaluate(() => {
  const d = document.querySelector('.err-modal');
  if (!d) return null;
  const r = d.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(20, r.height / 2));
  const t = (s) => d.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim() || null;
  return { title: t('.err-title'), detail: t('.err-detail'), code: t('.err-code'), buttons: [...d.querySelectorAll('.err-actions button')].map(b => b.textContent.trim()), onTop: d.contains(top), visible: r.width > 0 && getComputedStyle(d).visibility !== 'hidden' };
});

/** The authenticate exchange a recorder saw. */
export const authOf = (rec) => rec.log.find(x => x.path.endsWith('/wallet/authenticate'));

export const spinState = (page) => page.evaluate(() => {
  const b = document.querySelector('.cb-spin');
  return b ? { disabled: b.disabled, blocked: b.classList.contains('blocked'), slam: b.classList.contains('slammable'), auto: b.classList.contains('stopping'), label: b.getAttribute('aria-label'), overlay: !!document.querySelector('.wc-overlay') } : null;
});

/**
 * Start autoplay through its panel (language-neutral). rounds: a number or
 * 'inf'. loss / win: [amount, 'x' | 'cash'] to arm that stop, null to disarm.
 */
export async function startAutoplay(page, { rounds = 10, fullWinStop = false, skip = true, loss = null, win = null } = {}) {
  await closePopups(page);
  await page.locator('.cb-autospin').click();
  const pop = page.locator('.popup-autospin');
  await pop.waitFor({ timeout: 5000 });
  const inf = pop.locator('.spin-pill-inf');
  const infOn = await inf.evaluate(b => b.classList.contains('active'));
  if (rounds === 'inf') { if (!infOn) await inf.click(); }
  else { if (infOn) await inf.click(); const r = pop.locator('.rounds-input'); await r.fill(String(rounds)); await r.press('Tab').catch(() => {}); }
  const sw = pop.locator('.stop-switches .switch');
  for (const [i, want] of [[0, fullWinStop], [1, skip]]) {
    if ((await sw.nth(i).getAttribute('aria-checked') === 'true') !== want) await sw.nth(i).click();
  }
  for (const [i, lim] of [[0, loss], [1, win]]) {
    const toggle = pop.locator('.limit-toggle').nth(i);
    const armed = (await toggle.getAttribute('aria-pressed')) === 'true';
    if (!lim) { if (armed) await toggle.click(); continue; }
    await pop.locator('.limit-input').nth(i).fill(String(lim[0]));
    await pop.locator('.limit-unit-btn').nth(i * 2 + (lim[1] === 'x' ? 0 : 1)).click();
    if (!armed) await toggle.click();
  }
  await sleep(200);
  await pop.locator('.popup-start').click();
  await sleep(600);
  await closePopups(page);
}

export const autoRunning = (page) => page.evaluate(() => !!document.querySelector('.cb-spin.stopping'));

/** Wait for an autoplay run to end by itself, dismissing takeovers. Returns true if it did. */
export async function waitAutoplay(page, maxMs, onTick) {
  for (const late = deadline(page, maxMs); !late();) {
    await sleep(700);
    if (await page.locator('.wc-overlay').count()) await page.locator('.wc-overlay').first().click({ force: true }).catch(() => {});
    if (onTick) await onTick();
    if (!(await autoRunning(page))) { await sleep(1500); if (!(await autoRunning(page))) return true; }
  }
  return false;
}

/** The operator's figure: /wallet/balance asked from inside the game page (the session ID never leaves it). */
export const operatorBalance = (page) => page.evaluate(async () => {
  const q = new URLSearchParams(location.search);
  const r = await fetch(`https://${q.get('rgs_url')}/wallet/balance`, { method: 'POST', body: JSON.stringify({ sessionID: q.get('sessionID') }) });
  const j = await r.json();
  return j?.balance?.amount ?? null;
});

/** Wait until the deal button can deal: enabled, not a slam, no takeover, not mid-autoplay. */
export async function ready(page, ms = 20_000) {
  for (const late = deadline(page, ms); !late();) {
    const s = await spinState(page);
    if (s && !s.overlay && !s.slam && !s.auto && !s.disabled && !s.blocked) return true;
    await sleep(150);
  }
  return false;
}

/**
 * Deal: waits until the button can, presses it, and makes sure the round
 * started - a /wallet/play request or response, or the button turning into
 * a slam. (A play can sit a while in the runner's gate before it is sent.)
 */
export async function deal(page) {
  await ready(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Promise.race([
      page.waitForRequest(r => /\/wallet\/play/.test(r.url()), { timeout: 20_000 }),
      page.waitForResponse(r => /\/wallet\/play/.test(r.url()), { timeout: 20_000 }),
      page.waitForFunction(() => { const b = document.querySelector('.cb-spin'); return b && (b.classList.contains('slammable') || b.disabled); }, null, { timeout: 20_000 }),
    ]).then(() => true, () => false);
    await page.locator('.cb-spin').click({ force: true });
    if (await started) return true;
    await ready(page, 5000);
  }
  return false;
}

/** Turbo: 0 is normal speed, 1 Instant (the slider's own range). */
export async function setTurbo(page, value) {
  await closePopups(page);
  await page.locator('.cb-turbo').click();
  const r = page.locator('.popup input[type=range]');
  await r.waitFor({ timeout: 5000 });
  await r.fill(String(value));
  await sleep(200);
  await closePopups(page);
}

/**
 * Wait until the round in flight has settled: no takeover, the spin button
 * neither slammable nor stopping, and enabled (or steadily blocked - a
 * balance too low to deal again is a settled state too). Takeovers are
 * dismissed on the way unless `keepTakeover`; their titles and prompts are
 * collected.
 */
export async function settle(page, { timeout = 180_000, keepTakeover = false } = {}) {
  const t0 = Date.now(); const takeovers = []; let stableBlocked = 0;
  await sleep(500);
  for (const late = deadline(page, timeout); !late();) {
    const s = await spinState(page);
    if (s && s.overlay) {
      const tk = await page.evaluate(() => ({ title: document.querySelector('.wc-title')?.textContent.trim(), amount: document.querySelector('.wc-amount')?.textContent.trim(), prompt: document.querySelector('.wc-prompt, .wc-hint')?.textContent.trim() }));
      if (!takeovers.length || takeovers[takeovers.length - 1].title !== tk.title) takeovers.push(tk);
      if (keepTakeover) return { ms: Date.now() - t0, takeovers, overlay: true };
      if (/./.test(tk.prompt || '') && Date.now() - t0 > 800) await page.locator('.wc-overlay').first().click({ force: true }).catch(() => {});
      await sleep(250); continue;
    }
    if (s && !s.slam && !s.auto && !s.disabled) {
      if (!s.blocked) return { ms: Date.now() - t0, takeovers };
      if (++stableBlocked > 6) return { ms: Date.now() - t0, takeovers, blocked: true };
    } else stableBlocked = 0;
    await sleep(250);
  }
  return { ms: -1, takeovers, timedOut: true };
}

/** What the board and the bar say right now. */
export const board = (page) => page.evaluate(() => {
  const t = (s) => (document.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    balance: t('.cb-balance .cb-val') || t('.cb-balance'), bet: t('.cb-bet-display .cb-val') || t('.cb-bet-display'), betBase: t('.cb-bet-base') || null,
    lastWin: t('.cb-lastwin .cb-val') || t('.cb-lastwin'),
    label: t('.running-win-label'), amount: t('.running-win-amount'), mult: t('.running-win-mult'),
    chips: [...document.querySelectorAll('.card-mult')].map(e => (e.classList.contains('show') ? '' : '~') + e.textContent.trim()),
    cards: [...document.querySelectorAll('.card-block')].map(e => e.getAttribute('aria-label')),
    slots: document.querySelectorAll('.card-slot').length,
    busted: [...document.querySelectorAll('.card-slot')].findIndex(s => s.classList.contains('is-bust')),
    forgiven: [...document.querySelectorAll('.card-slot')].findIndex(s => !!s.querySelector('.forgiven-mark')),
    ticket: (() => { const k = document.querySelector('.ticket-slot'); return k ? { flipped: !!k.querySelector('.ticket-inner.flipped'), label: k.getAttribute('aria-label') } : null; })(),
    announce: t('.round-announcer'),
    error: t('.err-modal, [role=alertdialog]') || null,
    popup: !!document.querySelector('.popup'),
  };
});

/** Deal one round and let it settle. Returns the RGS exchanges it made and the board after. */
export async function playRound(page, { timeout = 60_000, keepTakeover = false } = {}) {
  const rec = recorder(page);
  const before = await board(page);
  // Wait for the play's own response before settling: a play can sit in the
  // runner's gate for seconds, and meanwhile the
  // deal button looks "blocked" - which settle() otherwise reads as over.
  if (await deal(page)) for (const late = deadline(page, 60_000); !rec.plays().length && !late();) await sleep(100);
  const st = await settle(page, { timeout, keepTakeover });
  await sleep(700);
  rec.stop();
  return { before, after: await board(page), rgs: rec.log, settle: st };
}

/**
 * Deal until the RGS answers with a round `pred(play)` accepts, and return as
 * soon as it does - mid-reveal, so the caller can reload, watch or slam it.
 * Rounds that do not match are slammed and settled. `play` is the parsed
 * /wallet/play body ({ round, balance }).
 */
export async function dealUntil(page, pred, { max = 25 } = {}) {
  for (let i = 0; i < max; i++) {
    let r = null;
    const on = (x) => { try { if (!r && /\/wallet\/play/.test(x.url())) r = x; } catch {} };
    page.on('response', on);
    try {
      await deal(page);
      for (const late = deadline(page, 60_000); !r && !late();) await sleep(100);
    } finally { page.off('response', on); }
    if (!r) throw new Error('no /wallet/play response within 60s (not counting its time queued at the RGS gate)');
    let play = null; try { play = await r.json(); } catch {}
    if (r.status() === 200 && pred(play)) return { tries: i + 1, play };
    await sleep(250);
    await page.locator('.cb-spin.slammable').click({ force: true, timeout: 2000 }).catch(() => {});
    await settle(page);
  }
  return null;
}

/** The replay's Round details panel: { rows: {caption: value}, choices: [badge text], dialog: bool }. */
export const replayDetails = (page) => page.evaluate(() => {
  const pop = document.querySelector('.ss-popup');
  if (!pop) return null;
  const rows = {};
  for (const r of pop.querySelectorAll('.ss-detail-row')) {
    const cap = r.querySelector('.ss-detail-cap')?.textContent.trim();
    const val = (r.querySelector('.ss-detail-val, .ss-choices')?.textContent || '').replace(/\s+/g, ' ').trim();
    if (cap) rows[cap] = val;
  }
  const choices = [...pop.querySelectorAll('.ss-choices > *')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
  return { rows, choices, text: pop.innerText.replace(/\s+/g, ' ').trim() };
});

/**
 * Press Play on a loaded replay and watch it to the end. Records every change
 * of the running readout and the chips, each takeover leg's first and last
 * figure, and the prompts. `tapMid` clicks the takeover as soon as it opens.
 * `leaveTakeover` stops at the takeover's continue prompt without dismissing.
 */
export async function watchReplay(page, { tapMid = false, timeout = 60_000, leaveTakeover = false } = {}) {
  const book = { value: null };
  const onResp = async (r) => { try { if (/\/bet\/replay\//.test(r.url())) book.value = await r.json(); } catch {} };
  page.on('response', onResp);
  const details = await page.evaluate(() => { const p = document.querySelector('.ss-play-btn')?.closest('div, section'); const root = document.querySelector('.replay-details') || p?.parentElement; return (root || document.body).innerText.replace(/\s+/g, ' ').trim().slice(0, 500); });
  const play = page.locator('.ss-play-btn').first();
  for (const late = deadline(page, 10_000); !late();) if (await play.isVisible().catch(() => false)) break; else await sleep(150);
  await play.click({ timeout: 5000 });
  const t0 = Date.now(); const readout = []; const legs = []; const prompts = new Set(); let tapped = false; let negative = null;
  while (Date.now() - t0 < timeout) {
    await sleep(80);
    const s = await page.evaluate(() => {
      const q = (x) => document.querySelector(x);
      const t = (x) => (q(x)?.textContent || '').replace(/\s+/g, ' ').trim();
      const spin = q('.cb-spin');
      return {
        ov: !!q('.wc-overlay'), title: t('.wc-title'), amount: t('.wc-amount'), mult: t('.wc-mult'), prompt: t('.wc-prompt, .wc-hint'),
        label: t('.running-win-label'), amt: t('.running-win-amount'), rmult: t('.running-win-mult'),
        chips: [...document.querySelectorAll('.card-mult')].map(e => (e.classList.contains('show') ? '' : '~') + e.textContent.trim()).join(' '),
        again: !!spin && !spin.disabled && !spin.classList.contains('slammable') && !q('.wc-overlay') && /again/i.test(spin.getAttribute('aria-label') || ''),
        idle: !!spin && !spin.disabled && !spin.classList.contains('slammable') && !q('.wc-overlay'),
      };
    });
    if (s.idle && readout.length && Date.now() - t0 - readout[readout.length - 1].ms > 3000 && Date.now() - t0 > 4000) break;
    if (s.ov) {
      const last = legs[legs.length - 1];
      if (!last || last.title !== s.title) legs.push({ ms: Date.now() - t0, title: s.title, first: s.amount, firstMult: s.mult, last: s.amount });
      else { last.last = s.amount; last.lastMult = s.mult; }
      if (/^-/.test(s.amount)) negative = s.amount;
      if (s.prompt) prompts.add(s.prompt);
      if (tapMid && !tapped && Date.now() - t0 > 300) { await page.locator('.wc-overlay').click({ force: true }).catch(() => {}); tapped = true; legs.push({ title: '<tap>' }); }
      if (/continue|weiter|jatka|продолж|متابعة|続行|계속|继续/i.test(s.prompt)) {
        if (leaveTakeover) break;
        await sleep(400);
        await page.locator('.wc-overlay').click({ force: true }).catch(() => {});
      }
      continue;
    }
    const key = `${s.label}|${s.amt}|${s.rmult}|${s.chips}`;
    if (!readout.length || readout[readout.length - 1].key !== key) readout.push({ ms: Date.now() - t0, key, label: s.label, amt: s.amt, mult: s.rmult, chips: s.chips });
    if (s.again) break;
  }
  page.off('response', onResp);
  await sleep(500);
  return { details, book: book.value, readout, legs, prompts: [...prompts], negative, end: await board(page) };
}

/** A round's arithmetic checked in micro-units against what the RGS said. */
export function checkRound(r) {
  const play = r.rgs.find(x => x.path.endsWith('/wallet/play'));
  const ends = r.rgs.filter(x => x.path.endsWith('/wallet/end-round'));
  if (!play) return { ok: false, why: 'no /wallet/play was sent' };
  if (play.status !== 200) return { ok: false, why: `/wallet/play answered ${play.status}`, play };
  const round = play.res.round || {};
  const amt = play.req.amount, pm = round.payoutMultiplier || 0;
  const cost = round.costMultiplier || (/^tr_/.test(round.mode || play.req.mode) ? 250 : 1);
  const before = toMicro(r.before.balance);
  const debit = before != null ? before - play.res.balance : null;
  const expectedCredit = Math.round(pm * amt);
  const credit = ends.length ? ends[ends.length - 1].res.balance - play.res.balance : 0;
  const shown = toMicro(r.after.balance);
  const finalBal = ends.length ? ends[ends.length - 1].res.balance : play.res.balance;
  const problems = [];
  if (debit != null && Math.abs(debit - amt * cost) >= 5000) problems.push(`debited ${debit} for a ${amt * cost} round`);
  if (pm > 0 && (ends.length !== 1 || ends[0].status !== 200)) problems.push(`${ends.length} end-round calls on a paying round`);
  if (pm > 0 && credit !== expectedCredit) problems.push(`credited ${credit}, expected ${expectedCredit}`);
  if (pm === 0 && ends.length) problems.push('end-round sent on a losing round');
  if (shown != null && Math.abs(shown - finalBal) >= 5000) problems.push(`board shows ${r.after.balance}, RGS says ${finalBal}`);
  return { ok: !problems.length, why: problems.join('; '), mode: play.req.mode, amt, cost, pm, debit, credit, ends: ends.length, finalBal };
}
