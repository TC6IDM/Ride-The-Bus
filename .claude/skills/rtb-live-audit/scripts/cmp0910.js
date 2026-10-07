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
let f = frameOf(page);
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
let plays = 0; const onReq = r => { if (/wallet\/play/.test(r.url())) plays++; }; page.on('request', onReq);
const out = {};
// one tap = one round
await f.locator('.play-area, main').first().click({ position: { x: 20, y: 20 }, force: true }).catch(() => {});
let p0 = plays; await page.keyboard.press('Space'); await page.waitForTimeout(400); await waitSettled(page, f, 20000); out.singleTapPlays = plays - p0;
// bet field focused
await f.getByRole('button', { name: 'Choose bet amount' }).click(); await page.waitForTimeout(400);
await f.locator('input[name="bet-amount"]').focus();
p0 = plays; await page.keyboard.press('Space'); await page.waitForTimeout(1500); out.spaceInBetField = plays - p0;
out.betFieldValue = await f.locator('input[name="bet-amount"]').inputValue();
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
// How to Play open
await f.getByRole('button', { name: 'How to play' }).click(); await page.waitForTimeout(500);
p0 = plays; await page.keyboard.press('Space'); await page.waitForTimeout(1500); out.spaceWithPanelOpen = plays - p0;
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
page.off('request', onReq);
// CMP-09 sound panel
await f.getByRole('button', { name: 'Sound settings' }).click(); await page.waitForTimeout(600);
const soundState = () => f.evaluate(() => { const p = document.querySelector('.popup'); return { rows: [...p.querySelectorAll('button, input[type=range]')].map(e => e.tagName === 'INPUT' ? `${e.getAttribute('aria-label') || e.name}=${e.value}` : `${e.getAttribute('aria-label') || e.textContent.trim()}:${e.getAttribute('aria-pressed') ?? e.getAttribute('aria-checked') ?? ''}`).filter(s => !/^Close/.test(s)), barIcon: document.querySelector('button[aria-label="Sound settings"]')?.innerHTML.match(/class="[^"]*(mute|off|cross)[^"]*"/i)?.[0] || 'no-mute-class' }; });
out.sound0 = await soundState();
const buttons = f.locator('.popup button:not([aria-label="Close"])');
const n = await buttons.count();
out.soundButtons = n;
if (n >= 2) {
  await buttons.nth(0).click(); await page.waitForTimeout(300); out.soundAfterFirstMute = await soundState();
  await buttons.nth(1).click(); await page.waitForTimeout(300); out.soundBothMuted = await soundState();
}
out.storage = await f.evaluate(() => { try { return Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('ride-the-bus:')).map(k => [k, localStorage.getItem(k)])); } catch (e) { return 'storage error: ' + e; } });
// reload persistence
await f.goto(f.url()); await page.waitForTimeout(6500); f = frameOf(page);
const tap = f.getByRole('button', { name: 'Tap to continue' }); if (await tap.count()) { await tap.first().click().catch(() => {}); await page.waitForTimeout(900); }
await f.getByRole('button', { name: 'Sound settings' }).click(); await page.waitForTimeout(600);
out.afterReload = await soundState();
// restore: unmute both
const b2 = f.locator('.popup button:not([aria-label="Close"])');
if (await b2.count() >= 2) { await b2.nth(0).click(); await page.waitForTimeout(200); await b2.nth(1).click(); await page.waitForTimeout(200); }
out.restored = await soundState();
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
return out;
}
