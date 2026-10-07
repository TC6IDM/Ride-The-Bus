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
await f.getByRole('button', { name: 'Choose bet amount' }).click(); await page.waitForTimeout(400);
await f.getByRole('button', { name: '$0.01', exact: true }).click(); await page.waitForTimeout(400);
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
const out = { bet: (await boardState(f)).bet };
let plays = 0; const onReq = r => { if (/wallet\/play/.test(r.url())) plays++; }; page.on('request', onReq);
await f.getByRole('button', { name: 'Autoplay settings' }).click(); await page.waitForTimeout(800);
out.panel = await f.evaluate(() => { const p = document.querySelector('.popup'); return p ? { title: p.querySelector('h2,h3')?.textContent.trim(), buttons: [...p.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.textContent).replace(/\s+/g,' ').trim()).filter(Boolean).slice(0, 30) } : null; });
out.playsAfterOpeningPanel = plays;
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
// Space hold
await f.locator('body').click({ position: { x: 600, y: 120 } }).catch(() => {});
const p0 = plays;
await page.keyboard.down('Space'); await page.waitForTimeout(6000);
out.playsWhileHeld6s = plays - p0;
await page.keyboard.up('Space');
const p1 = plays; await page.waitForTimeout(5000);
out.playsAfterRelease5s = plays - p1;
page.off('request', onReq);
out.board = await boardState(f);
return out;
}
