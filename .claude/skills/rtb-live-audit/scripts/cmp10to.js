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
const modeNow = () => f.evaluate(() => document.querySelector('.cb-mode-btn')?.getAttribute('title'));
if ((await modeNow()) !== 'Three of a Kind') { await f.getByRole('button', { name: /Choose game mode/ }).click(); await page.waitForTimeout(450); await f.locator('.popup button').filter({ hasText: /^Three of a Kind/ }).first().click(); await page.waitForTimeout(450); await f.locator('.popup').getByRole('button', { name: /^Switch/ }).click(); await page.waitForTimeout(700); }
await f.getByRole('button', { name: /Choose (bet|play) amount/ }).click(); await page.waitForTimeout(400);
await f.locator('.popup button').filter({ hasText: /^\s*2\.50\s*SC/ }).first().click().catch(() => {}); await page.waitForTimeout(400);
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
const out = { bet: (await boardState(f)).bet };
await f.getByRole('button', { name: /Auto ?Play settings/i }).click(); await page.waitForTimeout(600);
const pop = f.locator('.popup');
await pop.getByRole('button', { name: '250', exact: true }).click();
const fw = pop.getByRole('switch').filter({ hasText: '' }).first();
const sw = async (re) => pop.getByRole('switch', { name: re });
const fullWin = await sw(/full game (win|won)/i), skip = await sw(/Skip big win/i);
if ((await fullWin.getAttribute('aria-checked')) !== 'true') await fullWin.click();
if ((await skip.getAttribute('aria-checked')) === 'true') await skip.click();
let plays = 0, playsDuringTakeover = 0, takeoverSeen = false;
const onReq = r => { if (/wallet\/play/.test(r.url())) { plays++; if (takeoverSeen) playsDuringTakeover++; } };
page.on('request', onReq);
await pop.getByRole('button', { name: /^Start/ }).click();
for (let i = 0; i < 400; i++) {
  await page.waitForTimeout(1000);
  if (await f.locator('.wc-overlay').count()) {
    takeoverSeen = true; out.roundsToWin = plays;
    await page.waitForTimeout(1500);
    const p0 = plays;
    await page.keyboard.press('Space');
    await page.waitForTimeout(1200);
    out.afterOneSpace = { takeoverUp: !!(await f.locator('.wc-overlay').count()), newPlays: plays - p0 };
    const p1 = plays;
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);
    out.afterSecondSpace = { takeoverUp: !!(await f.locator('.wc-overlay').count()), newPlays: plays - p1 };
    break;
  }
}
await page.waitForTimeout(1500);
out.playsDuringTakeover = playsDuringTakeover;
page.off('request', onReq);
if (await f.locator('.wc-overlay').count()) { await f.locator('.wc-overlay').first().click({ force: true }).catch(() => {}); await page.waitForTimeout(1500); }
out.after = await boardState(f);
return out;
}
