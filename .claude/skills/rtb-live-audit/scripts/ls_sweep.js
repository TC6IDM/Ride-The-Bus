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
const f = frameOf(page);
const modeNow = () => f.evaluate(() => document.querySelector('.cb-mode-btn')?.getAttribute('title'));

if ((await modeNow()) !== 'Last Stop') {
  await f.getByRole('button', { name: /Choose game mode/ }).click(); await page.waitForTimeout(450);
  await f.locator('.popup').getByRole('button', { name: /^Last Stop/ }).click(); await page.waitForTimeout(450);
  await f.locator('.popup').getByRole('button', { name: /^Switch/ }).click(); await page.waitForTimeout(800);
}
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
const cols = f.locator('.choice-row .choice-column');
const want = ['Red','Higher','Outside','Heart'];
for (let i = 0; i < 4; i++) { const b = cols.nth(i).getByRole('button', { name: want[i], exact: true }).first(); if (!/selected/.test((await b.getAttribute('class')) || '')) { await b.click(); await page.waitForTimeout(150); } }
const out = { mode: await modeNow(), betDisplay: (await boardState(f)).bet };
if (!(await f.locator('.popup').count())) { await f.getByRole('button', { name: 'Autoplay settings' }).click(); await page.waitForTimeout(600); }
const pop = f.locator('.popup');
await pop.getByRole('button', { name: '250', exact: true }).click();
const fw = pop.getByRole('switch', { name: 'Stop autoplay on full game win' });
const st = async () => fw.getAttribute('aria-checked');
if ((await st()) !== 'true') await fw.click();
out.fullWinStop = await st();
const rec = recorder(page);
await pop.getByRole('button', { name: /^Start/ }).click();
const t0 = Date.now();
await page.waitForTimeout(3000);
// wait for the run to end: autoplay button no longer shows a running state and Deal is enabled for >3s
let idle = 0;
while (Date.now() - t0 < 400000) {
  const running = await f.evaluate(() => !!document.querySelector('.cb-auto-running, .autoplay-running, [aria-label*="Stop autoplay"]'));
  const tap = f.locator('.wc-overlay'); if (await tap.count()) { out.takeover = true; await page.waitForTimeout(2500); await tap.first().click({ force: true }).catch(() => {}); }
  const s = await boardState(f);
  const dealReady = await f.getByRole('button', { name: 'Deal' }).isEnabled().catch(() => false);
  idle = (!running && !s.inProgress && dealReady) ? idle + 1 : 0;
  if (idle >= 3) break;
  await page.waitForTimeout(1000);
}
rec.stop();
out.seconds = Math.round((Date.now() - t0) / 1000);
out.board = await boardState(f);
const plays = rec.log.filter(x => x.path.endsWith('/wallet/play'));
const ends = rec.log.filter(x => x.path.endsWith('/wallet/end-round'));
out.counts = { plays: plays.length, ends: ends.length, non200: rec.log.filter(x => x.status !== 200).map(x => x.path + ':' + x.status + ':' + JSON.stringify(x.res)) };
out.sample = plays.slice(0, 2).map(p => ({ req: p.req, cost: p.res.round.costMultiplier, pm: p.res.round.payoutMultiplier, events: p.res.round.events, bal: p.res.balance }));
const sweep = plays[plays.length-1]; out.last = { req: sweep.req, pm: sweep.res.round.payoutMultiplier, events: sweep.res.round.events, raw: null, bal: sweep.res.balance }; out.wins = plays.filter(p => p.res.round.payoutMultiplier > 0).length;
out.endBalances = ends.map(e => e.res.balance);
out.reveals = [...new Set(plays.map(p => (p.res.round.events.match(/reveal/g) || []).length))];
return out;
}
