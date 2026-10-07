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
const RESTRICTED = ['win feature','pay out','paid out','pays out','payout','payouts','betting','total bet','bet','bets','rebet','cash','money','currency','credit','fund','funds','pay','pays','paid','payer','buy','bought','purchase','bonus buy','buy bonus','gamble','gambling','wager','deposit','withdraw','at the cost of','cost of','stake'];
const RE = new RegExp('\b(' + RESTRICTED.map(t => t.replace(/ /g, '\s+')).join('|') + ')\b', 'gi');
await page.goto('https://studio.engine.io/teams/takeovercasino/games/ride-the-bus/math?launch=true&team=takeovercasino&game=ride-the-bus&currency=XSC&language=en&deviceType=desktop&balance=1000000000&social=true&math=13&front=71&checklist=false&replay=false&amount=1000000');
await page.waitForTimeout(8000);
let f = frameOf(page);
const params = Object.fromEntries([...f.url().matchAll(/[?&]([^=&]+)=([^&]*)/g)].filter(m => m[1] !== 'sessionID').map(m => [m[1], decodeURIComponent(m[2])]));
const hits = {};
const sweep = async (label) => { const t = await f.evaluate(() => document.body.innerText); const m = [...t.matchAll(RE)].map(x => t.slice(Math.max(0, x.index - 30), x.index + 30).replace(/\s+/g, ' ')); if (m.length) hits[label] = [...new Set(m)].slice(0, 6); return t; };
await sweep('intro');
const tap = f.getByRole('button', { name: /Tap to continue|continue/i }); if (await tap.count()) { await tap.first().click().catch(() => {}); await page.waitForTimeout(1000); }
const out = { params };
out.board = await boardState(f);
await sweep('board');
const close = async () => { while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); } };
for (const [label, name] of [['bet menu', /bet amount|amount|Choose/i], ['autoplay', /Autoplay/i], ['sound', /Sound/i]]) {
  const b = f.locator('footer button').filter({ has: f.locator('svg') }).and(f.locator(`[aria-label]`));
  const btn = (await f.getByRole('button', { name }).count()) ? f.getByRole('button', { name }).first() : null;
  if (btn) { await btn.click().catch(() => {}); await page.waitForTimeout(600); await sweep(label); await close(); }
}
out.footerButtons = await f.evaluate(() => [...document.querySelectorAll('footer button')].map(b => b.getAttribute('aria-label')).filter(Boolean));
await f.getByRole('button', { name: /mode/i }).first().click().catch(() => {}); await page.waitForTimeout(600);
out.modeRows = await f.evaluate(() => [...document.querySelectorAll('.popup button')].map(b => b.textContent.replace(/\s+/g, ' ').trim().slice(0, 30)).filter(Boolean));
await sweep('mode picker');
await f.locator('.popup button').filter({ hasText: /Second Chance/ }).first().click().catch(() => {}); await page.waitForTimeout(500);
await sweep('mode confirmation'); await close();
await f.getByRole('button', { name: /How to play|Info|rules/i }).first().click().catch(() => {}); await page.waitForTimeout(700);
const tabs = await f.locator('.popup').getByRole('tab').allTextContents().catch(() => []);
await sweep('how to play');
for (const tname of tabs) { await f.locator('.popup').getByRole('tab', { name: tname }).click().catch(() => {}); await page.waitForTimeout(300); await sweep('how to play / ' + tname.trim()); }
out.tabs = tabs.map(t => t.trim()); await close();
// play one round so result wording appears
const cols = f.locator('.choice-row .choice-column');
for (const [i, n] of [[0, 1], [1, 0], [2, 1], [3, 0]]) { await cols.nth(i).locator('button').nth(n).click({ force: true }).catch(() => {}); await page.waitForTimeout(120); }
await f.locator('footer button').filter({ hasText: '' }).count();
await page.keyboard.press('Space'); await waitSettled(page, f, 20000); await page.waitForTimeout(800);
out.afterRound = await boardState(f);
await sweep('after round');
out.restrictedHits = hits;
return out;
}
