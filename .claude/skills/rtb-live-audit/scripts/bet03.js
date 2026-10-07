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
await f.getByRole('button', { name: '$1.00', exact: true }).count();
const row = f.locator('.choice-row');
const eqHL = row.locator('.choice-column').nth(1).getByRole('button', { name: 'Equal', exact: true });
await eqHL.click();
await page.waitForTimeout(300);
const inside = row.getByRole('button', { name: 'Inside', exact: true }).first();
const attrs = async () => ({ ariaDisabled: await inside.getAttribute('aria-disabled'), disabled: await inside.isDisabled(), cls: (await inside.getAttribute('class')) || '', pressed: await inside.getAttribute('aria-pressed') });
const before = await attrs();
await inside.click({ force: true }).catch(e => 'click refused');
await page.waitForTimeout(300);
const afterClick = await attrs();
await inside.focus().catch(() => {});
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
const afterEnter = await attrs();
await inside.hover().catch(() => {});
await page.waitForTimeout(1200);
const hoverTip = await f.evaluate(() => [...document.querySelectorAll('[role=tooltip], .choice-tip')].map(e => e.textContent.replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,3));
const mode = await f.evaluate(() => document.querySelector('.choice-row')?.getAttribute('data-mode') || null);
return { before, afterClick, afterEnter, hoverTip, mode };
}
