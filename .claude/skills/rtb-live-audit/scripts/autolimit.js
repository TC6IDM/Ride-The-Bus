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
const CFG = __CFG__;
const modeNow = () => f.evaluate(() => document.querySelector('.cb-mode-btn')?.getAttribute('title'));
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
if ((await modeNow()) !== CFG.family) {
  await f.getByRole('button', { name: /Choose game mode/ }).click(); await page.waitForTimeout(450);
  await f.locator('.popup').getByRole('button', { name: new RegExp('^' + CFG.family) }).click(); await page.waitForTimeout(450);
  await f.locator('.popup').getByRole('button', { name: /^Switch/ }).click(); await page.waitForTimeout(800);
  while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
}
await f.getByRole('button', { name: 'Choose bet amount' }).click(); await page.waitForTimeout(400);
await f.locator('.popup').getByRole('button', { name: CFG.chip, exact: true }).first().click(); await page.waitForTimeout(400);
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
await f.getByRole('button', { name: 'Turbo speed' }).click(); await page.waitForTimeout(400);
await f.locator('.popup input[type=range]').fill('1'); await page.waitForTimeout(300);
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
const bet = (await boardState(f)).bet;
await f.getByRole('button', { name: 'Autoplay settings' }).click(); await page.waitForTimeout(600);
const pop = f.locator('.popup');
const inf = pop.getByRole('button', { name: 'Unlimited plays' }); if (!/active/.test((await inf.getAttribute('class')) || '')) await inf.click();
const fw = pop.getByRole('switch', { name: 'Stop autoplay on full game win' });
if ((await fw.getAttribute('aria-checked')) === 'true') await fw.click();
const inputs = pop.locator('input.limit-input');
const units = pop.locator('.limit-unit-btn');
const toggles = [pop.getByRole('button', { name: 'Stop on a loss of' }), pop.getByRole('button', { name: 'Stop on a single win of' })];
for (const [i, lim] of [[0, CFG.loss], [1, CFG.win]]) {
  const armed = (await toggles[i].getAttribute('aria-pressed')) === 'true';
  if (!lim) { if (armed) await toggles[i].click(); continue; }
  await inputs.nth(i).fill(String(lim[0]));
  await units.nth(i * 2 + (lim[1] === 'x' ? 0 : 1)).click();
  if (!armed) await toggles[i].click();
}
const panelState = await pop.evaluate(p => [...p.querySelectorAll('input.limit-input, .limit-unit-btn, .limit-toggle')].map(e => (e.value ?? '') + (e.getAttribute('aria-pressed') ?? '') + ':' + (e.getAttribute('aria-label') || e.textContent.trim()).slice(0, 18)));
const rec = recorder(page);
await pop.getByRole('button', { name: /^Start/ }).click();
await page.waitForTimeout(800);
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
const tStart = Date.now();
let stopped = false;
while (Date.now() - tStart < CFG.maxMs) {
  await page.waitForTimeout(700);
  const ov = f.locator('.wc-overlay'); if (await ov.count()) await ov.first().click({ force: true }).catch(() => {});
  const running = await f.evaluate(() => !!document.querySelector('.cb-spin.stopping'));
  if (!running) { stopped = true; break; }
}
if (!stopped) { await f.locator('.cb-spin').click({ force: true }); await page.waitForTimeout(4000); }
rec.stop();
const plays = rec.log.filter(x => x.path.endsWith('/wallet/play') && x.res && x.res.round).map(x => ({ amt: x.req.amount, pm: x.res.round.payoutMultiplier, cost: x.res.round.costMultiplier || 1 }));
let net = 0; const walk = [];
let expectedStop = null;
for (const [i, p] of plays.entries()) {
  const base = p.amt / 1e6;
  const win = p.pm * base, spend = p.cost * base;
  net += win - spend;
  walk.push(`${i}:${p.pm}x net${net.toFixed(2)}`);
  if (expectedStop === null) {
    if (CFG.loss && (CFG.loss[1] === 'x' ? -net >= CFG.loss[0] * base - 1e-9 : -net >= CFG.loss[0] - 1e-9)) expectedStop = i;
    if (CFG.win && (CFG.win[1] === 'x' ? win >= CFG.win[0] * base - 1e-9 : win >= CFG.win[0] - 1e-9)) expectedStop = i;
  }
}
return { cfg: CFG, bet, panelState, stoppedByItself: stopped, rounds: plays.length, expectedStopIndex: expectedStop, lastIndex: plays.length - 1, walk: walk.slice(-6), end: await boardState(f) };
}
