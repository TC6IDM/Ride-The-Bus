async page => {
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
    log.push({ path: new URL(u).pathname, status: resp.status(),
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
const pop = () => f.evaluate(() => { const p = document.querySelector('.popup'); return p ? p.textContent.replace(/\s+/g,' ').trim() : null; });
const open = async () => { while (await f.locator(".popup").count()) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); } { await f.getByRole('button', { name: /Choose game mode/ }).click(); await page.waitForTimeout(450); } };
const pick = async () => { await f.locator('.popup').getByRole('button', { name: /^Second Chance/ }).click(); await page.waitForTimeout(450); };
const out = { start: await modeNow() };
await open(); await pick();
const conf = await pop();
out.confirmation = conf && conf.slice(0, 420);
out.confirmButtons = await f.evaluate(() => [...document.querySelectorAll('.popup button')].map(b => (b.getAttribute('aria-label') || b.textContent).trim()).filter(Boolean));
const closers = {
  cancel: async () => f.locator('.popup').getByRole('button', { name: /^Cancel$/ }).click(),
  x: async () => f.locator('.popup').getByRole('button', { name: 'Close' }).first().click(),
  escape: async () => page.keyboard.press('Escape'),
  clickAway: async () => f.locator('.popup-backdrop, .backdrop').first().click({ position: { x: 5, y: 5 }, force: true }),
};
for (const [name, fn] of Object.entries(closers)) {
  await open(); await pick();
  await fn().catch(e => (out[name + 'Err'] = String(e).slice(0, 80)));
  await page.waitForTimeout(450);
  out[name] = { mode: await modeNow(), popupOpen: !!(await f.locator('.popup').count()) };
  if (out[name].popupOpen) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
}
const plays = [];
const onReq = r => { if (/wallet\/play/.test(r.url())) plays.push(1); };
page.on('request', onReq);
await open(); await pick();
await f.locator('.popup').getByRole('button', { name: /^Switch/ }).click();
await page.waitForTimeout(600);
page.off('request', onReq);
out.afterSwitch = { mode: await modeNow(), popupOpen: !!(await f.locator('.popup').count()), playRequests: plays.length, bet: (await boardState(f)).bet };
return out;
}
