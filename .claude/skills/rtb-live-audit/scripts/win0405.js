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
const tapOverlay = async () => { const b = await f.locator('.wc-overlay').first().boundingBox().catch(() => null); if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.85); };
const esc = async () => { while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };
await esc();
const modeNow = () => f.evaluate(() => document.querySelector('.cb-mode-btn')?.getAttribute('title'));
if ((await modeNow()) !== 'Three of a Kind') {
  await f.getByRole('button', { name: /Choose game mode/ }).click(); await page.waitForTimeout(450);
  await f.locator('.popup').getByRole('button', { name: /^Three of a Kind/ }).click(); await page.waitForTimeout(450);
  await f.locator('.popup').getByRole('button', { name: /^Switch/ }).click(); await page.waitForTimeout(800); await esc();
}
await f.getByRole('button', { name: 'Choose bet amount' }).click(); await page.waitForTimeout(400);
await f.locator('.popup').getByRole('button', { name: '$2.50', exact: true }).first().click(); await page.waitForTimeout(300); await esc();
const setTurbo = async (v) => { await f.getByRole('button', { name: 'Turbo speed' }).click(); await page.waitForTimeout(400); await f.locator('.popup input[type=range]').fill(v); await page.waitForTimeout(300); await esc(); };
const manual = async () => {
  for (let k = 0; k < 60; k++) {
    const t0 = Date.now();
    await f.locator('.cb-spin').click({ force: true });
    let open = null, final = null, firstFlip = null;
    for (let i = 0; i < 300; i++) {
      await page.waitForTimeout(50);
      const s = await f.evaluate(() => ({ ov: !!document.querySelector('.wc-overlay'), amt: document.querySelector('.wc-amount')?.textContent.trim(), prompt: document.querySelector('.wc-prompt, .wc-hint')?.textContent.trim(), flipped: document.querySelectorAll('.card-inner.flipped').length, busy: !!document.querySelector('.cb-spin.slammable') }));
      const now = Date.now() - t0;
      if (firstFlip === null && s.flipped) firstFlip = now;
      if (s.ov && open === null) open = now;
      if (s.ov && /continue/i.test(s.prompt || '')) { final = now; break; }
      if (!s.ov && open === null && i > 20 && !s.busy && !(await f.evaluate(() => document.querySelector('.cb-spin')?.classList.contains('blocked')))) {
        const lab = await f.evaluate(() => document.querySelector('.running-win-label')?.textContent.trim());
        if (/Busted/.test(lab || '')) break;
      }
    }
    if (open !== null) {
      await page.waitForTimeout(300);
      await tapOverlay(); await page.waitForTimeout(800); if (await f.locator('.wc-overlay').count()) { await tapOverlay(); await page.waitForTimeout(800); }
      return { rounds: k + 1, firstFlip, open, countMs: final - open };
    }
    await page.waitForTimeout(400);
  }
  return null;
};
const out = {};
await setTurbo('0'); out.normal = await manual();
await setTurbo('1'); out.instant = await manual();
// WIN-05: autoplay, skip on then off
const auto = async (skip) => {
  await f.getByRole('button', { name: 'Autoplay settings' }).click(); await page.waitForTimeout(600);
  const pop = f.locator('.popup');
  const inf = pop.getByRole('button', { name: 'Unlimited plays' }); if (!/active/.test((await inf.getAttribute('class')) || '')) await inf.click();
  for (const name of ['Stop on a loss of', 'Stop on a single win of']) { const b = pop.getByRole('button', { name }); if ((await b.getAttribute('aria-pressed')) === 'true') await b.click(); }
  const fw = pop.getByRole('switch', { name: 'Stop autoplay on full game win' }); if ((await fw.getAttribute('aria-checked')) === 'true') await fw.click();
  const sk = pop.getByRole('switch', { name: /Skip big win animations/ }); if (((await sk.getAttribute('aria-checked')) === 'true') !== skip) await sk.click();
  const plays = []; const onReq = r => { if (/\/wallet\/play/.test(r.url())) plays.push(Date.now()); };
  page.on('request', onReq);
  await pop.getByRole('button', { name: /^Start/ }).click(); await page.waitForTimeout(500); await esc();
  let open = null, firstAmt = null, finalAt = null, closed = null; const t0 = Date.now(); const amts = [];
  while (Date.now() - t0 < 240000) {
    await page.waitForTimeout(80);
    const s = await f.evaluate(() => ({ ov: !!document.querySelector('.wc-overlay'), amt: document.querySelector('.wc-amount')?.textContent.trim() }));
    const now = Date.now() - t0;
    if (s.ov) { if (open === null) { open = now; firstAmt = s.amt; } amts.push(s.amt); if (/4,583|45\.83/.test(s.amt || '') && finalAt === null) finalAt = now; }
    if (!s.ov && open !== null) { closed = now; break; }
  }
  await page.waitForTimeout(3000);
  const playsAfter = plays.filter(t => t - t0 > (closed || 0)).length;
  await f.locator('.cb-spin').click({ force: true }); await page.waitForTimeout(5000);
  page.off('request', onReq);
  return { skip, firstAmt, distinctAmounts: [...new Set(amts)].length, msToFinal: finalAt - open, heldMs: closed - open, playsAfterTakeover: playsAfter };
};
out.autoSkipOn = await auto(true);
out.autoSkipOff = await auto(false);
await esc();
return out;
}
