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
const texts = async () => f.evaluate(() => { const t = q => [...document.querySelectorAll(q)].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean); return { balance: t('.cb-balance'), lastWin: t('.cb-lastwin'), bet: t('.cb-bet-display'), readout: t('.running-win'), wc: t('.wc-amount') }; });
const out = { start: await texts() };
// bet chips
await f.getByRole('button', { name: 'Choose bet amount' }).click(); await page.waitForTimeout(500);
out.chips = await f.locator('.popup').evaluate(p => [...p.querySelectorAll('button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 30));
await page.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/cur01-chips.png' });
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
// play rounds until a paying one (max 25), Equal-heavy picks for bigger payouts
const cols = f.locator('.choice-row .choice-column');
for (const [i, n] of [[0, 'Red'], [1, 'Higher'], [2, 'Outside'], [3, 'Heart']].entries ? [[0, 'Red'], [1, 'Higher'], [2, 'Outside'], [3, 'Heart']] : []) { const b = cols.nth(i).getByRole('button', { name: n, exact: true }).first(); if (!/selected/.test((await b.getAttribute('class')) || '')) await b.click(); }
const rounds = [];
for (let k = 0; k < 25; k++) {
  const rec = recorder(page);
  await f.getByRole('button', { name: 'Deal' }).click({ force: true });
  await waitSettled(page, f, 45000);
  await page.waitForTimeout(700);
  rec.stop();
  const play = rec.log.find(x => x.path.endsWith('/wallet/play'));
  const tx = await texts();
  rounds.push({ pm: play?.res?.round?.payoutMultiplier, amt: play?.req?.amount, ...tx });
  if (play?.res?.round?.payoutMultiplier > 1) break;
}
await page.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/cur01-board.png' });
const all = JSON.stringify([out, rounds]);
return { decimalsFound: (all.match(/\d[.,]\d{1,2}(?!\d)\s*(?:¥|JPY|円)|(?:¥|JPY)\s*[\d,]+\.\d/g) || []).slice(0, 10), out, last: rounds.slice(-3), n: rounds.length };
}
