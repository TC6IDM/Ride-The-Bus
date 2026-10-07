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
await f.getByRole('button', { name: 'Choose bet amount' }).click(); await page.waitForTimeout(450);
await f.locator('.popup button').filter({ hasText: /^\s*\$1\s*$/ }).first().click({ force: true });
await page.waitForTimeout(400);
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
await f.getByRole('button', { name: 'Turbo speed' }).click(); await page.waitForTimeout(400);
await f.locator('.popup input[type=range]').fill('1'); await page.waitForTimeout(300);
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
await f.getByRole('button', { name: 'Autoplay settings' }).click(); await page.waitForTimeout(600);
const pop = f.locator('.popup');
const inf = pop.getByRole('button', { name: 'Unlimited plays' }); if (!/active/.test((await inf.getAttribute('class')) || '')) await inf.click();
for (const name of ['Stop on a loss of', 'Stop on a single win of']) { const b = pop.getByRole('button', { name }); if ((await b.getAttribute('aria-pressed')) === 'true') await b.click(); }
const rec = recorder(page);
await pop.getByRole('button', { name: /^Start/ }).click();
await page.waitForTimeout(800);
const t0 = Date.now();
while (Date.now() - t0 < 240000) {
  await page.waitForTimeout(700);
  const ov = f.locator('.wc-overlay'); if (await ov.count()) await ov.first().click({ force: true }).catch(() => {});
  if (!(await f.evaluate(() => !!document.querySelector('.cb-spin.stopping')))) break;
}
await page.waitForTimeout(2500);
rec.stop();
const plays = rec.log.filter(x => x.path.endsWith('/wallet/play'));
const lastBal = [...rec.log].reverse().find(x => x.res && x.res.balance !== undefined);
// operator's figure, fetched in-frame from the RGS
const opBal = await f.evaluate(async () => { const q = new URLSearchParams(location.search); const r = await fetch(`https://${q.get('rgs_url')}/wallet/balance`, { method: 'POST', body: JSON.stringify({ sessionID: q.get('sessionID') }) }); const j = await r.json(); return j.balance; });
const spin = await f.evaluate(() => ({ blocked: document.querySelector('.cb-spin').classList.contains('blocked'), tip: document.querySelector('.cb-cooldown-tip')?.textContent.trim(), error: document.querySelector('[role=alertdialog], .error-dialog')?.textContent.trim() }));
return { plays: plays.length, playStatuses: [...new Set(plays.map(p => p.status + ':' + (p.res?.error || '')))], lastLoggedBalance: lastBal?.res?.balance, operator: opBal, board: await boardState(f), spin };
}
