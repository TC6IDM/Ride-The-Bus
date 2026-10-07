async page => {
for (const ev of ['response','request']) for (const fn of page.listeners(ev)) { const src = String(fn); if (src.includes('strip(') || src.includes('new URL') || src.includes('plays.push') || src.includes('plays++')) page.off(ev, fn); }
// Shared body, concatenated in front of a per-check tail by mk.sh.
const strip = (o) => { if (o && typeof o === 'object') { for (const k of Object.keys(o)) { if (/session/i.test(k)) o[k] = '<redacted>'; else strip(o[k]); } } return o; };
const frameOf = (page) => page.frames().find(fr => fr.url().includes('live.engine.io'));
const boardState = (f) => f.evaluate(() => {
  const t = s => (document.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim();
  return { balance: t('.cb-balance'), bet: t('.cb-bet-display'), lastWin: t('.cb-lastwin'), readout: t('.running-win'),
    inProgress: [...document.querySelectorAll('[role=tooltip]')].some(e => /Round in progress/.test(e.textContent)),
    error: t('.error-dialog, [role=alertdialog]') || null };
});
function recorder(page) {
  const log = [];
  const onResp = async (resp) => {
    const u = resp.url();
    if (!/\/(wallet|bet)\//.test(u)) return;
    const req = resp.request();
    let body = null, res = null;
    try { body = strip(JSON.parse(req.postData() || 'null')); } catch {}
    try { res = strip(await resp.json()); } catch {}
    const r = res && res.round ? res.round : null;
    log.push({ path: u.replace(/^https?:\/\/[^\/]+/, '').split('?')[0], status: resp.status(),
      req: body && { mode: body.mode, amount: body.amount, currency: body.currency },
      res: res && { balance: res.balance && res.balance.amount, error: res.error || res.code || res.message,
        round: r && { mode: r.mode, amount: r.amount, payoutMultiplier: r.payoutMultiplier, costMultiplier: r.costMultiplier, active: r.active,
          events: Array.isArray(r.state) ? r.state.map(e => e.type + (e.payout !== undefined ? ':' + e.payout : '') + (e.ticket !== undefined ? ':t' + e.ticket : '') + (e.card ? ':' + (e.card.rank || '') + (e.card.suit || '') : '')).join(' ') : undefined } } });
  };
  page.on('response', onResp);
  return { log, stop: () => page.off('response', onResp) };
}
async function waitSettled(page, f, ms = 30000) {
  const t0 = Date.now();
  await page.waitForTimeout(600);
  while (Date.now() - t0 < ms) {
    const s = await boardState(f);
    const dealReady = await f.getByRole('button', { name: 'Deal' }).isEnabled().catch(() => false);
    if (!s.inProgress && dealReady) return Date.now() - t0;
    // dismiss a takeover if one is up
    const tap = f.locator('.wc-overlay');
    if (await tap.count()) await tap.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
  return -1;
}

{ const f = frameOf(page); const tap = f && f.getByRole('button', { name: 'Tap to continue' }); if (tap && await tap.count()) { await tap.first().click().catch(() => {}); await page.waitForTimeout(900); } }
const f = frameOf(page);
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
// instrument (observe only)
await f.evaluate(() => {
  if (window.__rtb) return;
  const t = window.__rtb = { play: 0, end: 0, auth: 0, non200: [], rateLimited: 0, logs: [], startBal: null, lastBal: null, t0: Date.now() };
  const of = window.fetch;
  window.fetch = async (...a) => {
    const url = String(a[0] && a[0].url || a[0]);
    const r = await of(...a);
    if (/\/wallet\//.test(url)) {
      const kind = /play$/.test(url) ? 'play' : /end-round$/.test(url) ? 'end' : /authenticate$/.test(url) ? 'auth' : 'other';
      if (kind in t) t[kind]++;
      if (r.status !== 200) t.non200.push(kind + ':' + r.status + '@' + Math.round((Date.now() - t.t0) / 1000) + 's');
      if (r.status === 429) t.rateLimited++;
      r.clone().json().then(j => { if (j && j.balance) { if (t.startBal === null) t.startBal = j.balance.amount; t.lastBal = j.balance.amount; } }).catch(() => {});
    }
    return r;
  };
  for (const lvl of ['warn', 'error', 'log']) { const o = console[lvl]; console[lvl] = (...a) => { const s = a.map(String).join(' '); if (/RideTheBus|rate limit|Unhandled/i.test(s)) t.logs.push(lvl + ': ' + s.slice(0, 160)); return o.apply(console, a); }; }
  window.addEventListener('unhandledrejection', e => t.logs.push('unhandledrejection: ' + String(e.reason).slice(0, 160)));
});
// mode, picks, bet
const modeNow = () => f.evaluate(() => document.querySelector('.cb-mode-btn')?.getAttribute('title'));
if ((await modeNow()) !== 'Classic') {
  await f.getByRole('button', { name: /Choose game mode/ }).click(); await page.waitForTimeout(450);
  await f.locator('.popup').getByRole('button', { name: /^Classic/ }).click(); await page.waitForTimeout(450);
  await f.locator('.popup').getByRole('button', { name: /^Switch/ }).click(); await page.waitForTimeout(700);
}
await f.getByRole('button', { name: 'Choose bet amount' }).click(); await page.waitForTimeout(400);
await f.getByRole('button', { name: '$0.01', exact: true }).click(); await page.waitForTimeout(400);
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
// turbo instant
await f.getByRole('button', { name: 'Turbo speed' }).click(); await page.waitForTimeout(500);
await f.locator('.popup input[type=range]').fill('1'); await page.waitForTimeout(300);
const turbo = await f.locator('.popup input[type=range]').inputValue();
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
// autoplay 500, full-win stop OFF, skip animations ON
await f.getByRole('button', { name: 'Autoplay settings' }).click(); await page.waitForTimeout(600);
const pop = f.locator('.popup');
await pop.getByRole('button', { name: '500', exact: true }).click();
const fw = pop.getByRole('switch', { name: 'Stop autoplay on full game win' });
if ((await fw.getAttribute('aria-checked')) === 'true') await fw.click();
const sk = pop.getByRole('switch', { name: 'Skip big win animations during autoplay' });
if ((await sk.getAttribute('aria-checked')) !== 'true') await sk.click();
const settings = { turbo, fullWinStop: await fw.getAttribute('aria-checked'), skip: await sk.getAttribute('aria-checked'), mode: await modeNow(), bet: (await boardState(f)).bet };
const heap0 = await f.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : null);
await pop.getByRole('button', { name: /^Start/ }).click();
await page.waitForTimeout(2000);
return { settings, heap0MB: heap0 && Math.round(heap0 / 1e5) / 10, started: await f.evaluate(() => window.__rtb) };
}
