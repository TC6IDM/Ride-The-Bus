async page => {
  // The front version under test, read off the live game frame.
  const FRONT = (page.frames().map(fr => fr.url()).find(u => u.includes('live.engine.io')) || '').match(/\/(v\d+)\//)?.[1] || 'v72';
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
const hitsIn = (t) => [...new Set([...t.matchAll(RE)].map(x => t.slice(Math.max(0, x.index - 30), x.index + 30).replace(/\s+/g, ' ')))].slice(0, 6);
const f = frameOf(page);
const out = {};
await f.getByRole('button', { name: 'Auto Play settings' }).click(); await page.waitForTimeout(600);
out.autoplayPanel = hitsIn(await f.evaluate(() => document.querySelector('.popup')?.innerText || ''));
out.autoplayLimitUnits = await f.evaluate(() => [...document.querySelectorAll('.popup button')].map(b => b.textContent.trim()).filter(t => /SC|USD|\$|×|x/.test(t)).slice(0, 6));
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
// SOC-03: lang=de in social stays English
const tab = await page.context().newPage(); await tab.setViewportSize({ width: 1200, height: 675 });
await tab.goto(f.url().replace(/lang=[^&]*/, 'lang=de')); await tab.waitForTimeout(6500);
out.socialDe = await tab.evaluate(() => ({ htmlLang: document.documentElement.lang, dir: document.documentElement.dir, sample: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120) }));
await tab.close();
// SOC-05: replay window in social mode
const G = '019f7e00-fa38-78fa-9ea7-b4933e75765b';
const rt = await page.context().newPage(); await rt.setViewportSize({ width: 1200, height: 675 });
await rt.goto(`https://takeovercasino.live.engine.io/ride-the-bus/${FRONT}/?replay=true&game=${G}&version=13&mode=tr_any_equal_equal&event=2&currency=XSC&amount=1000000&lang=en&device=desktop&social=true&rgs_url=rgsd.engine.io`);
await rt.waitForTimeout(6500);
const details = await rt.evaluate(() => document.body.innerText);
out.replayDetails = details.replace(/\s+/g, ' ').match(/Round details.{0,220}/)?.[0];
out.replayHits = hitsIn(details);
await rt.getByRole('button', { name: 'Play', exact: true }).first().click({ timeout: 8000 }).catch(() => {});
await rt.waitForTimeout(9000);
const ov = rt.locator('.wc-overlay'); if (await ov.count()) { out.takeoverText = (await ov.first().innerText()).replace(/\s+/g, ' ').slice(0, 120); await rt.waitForTimeout(4000); out.takeoverHits = hitsIn(await ov.first().innerText().catch(() => '')); await ov.first().click({ force: true }).catch(() => {}); }
await rt.waitForTimeout(1500);
out.replayAfterHits = hitsIn(await rt.evaluate(() => document.body.innerText));
await rt.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/soc05-replay.png' });
await rt.close();
return out;
}
