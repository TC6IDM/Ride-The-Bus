async page => {
  // SES-01 + PRF-04 on a fresh tab of the live session: the handshake, every
  // origin and status, console errors, fonts, two rounds and every panel.
  // Session IDs never leave this script.
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const out = {};
  const tab = await page.context().newPage();
  await tab.setViewportSize({ width: 1200, height: 675 });
  const reqs = [], bad = [], cons = [];
  const org = u => (u.match(/^[a-z-]+:\/\/[^\/?#]+/i) || [u.slice(0, 30)])[0];
  const pth = u => u.replace(/^[a-z-]+:\/\/[^\/?#]+/i, '').split('?')[0].slice(0, 80);
  tab.on('response', r => { try {
    reqs.push(org(r.url()) + ' ' + r.status());
    if (r.status() >= 400) bad.push(r.status() + ' ' + org(r.url()) + pth(r.url()));
  } catch {} });
  tab.on('requestfailed', r => { try { bad.push('FAILED ' + org(r.url()) + pth(r.url())); } catch {} });
  tab.on('console', m => { try { cons.push(m.type() + ': ' + m.text().slice(0, 160)); } catch {} });
  tab.on('pageerror', e => { try { cons.push('pageerror: ' + String(e).slice(0, 160)); } catch {} });
  let auth = null;
  tab.on('response', async r => { try {
    if (!/\/wallet\/authenticate/.test(r.url())) return;
    try {
      const j = await r.json();
      auth = { status: r.status(), balance: j.balance, config: j.config && { minBet: j.config.minBet, maxBet: j.config.maxBet, stepBet: j.config.stepBet, defaultBetLevel: j.config.defaultBetLevel, betLevels: (j.config.betLevels || []).length, jurisdiction: j.config.jurisdiction ? Object.keys(j.config.jurisdiction) : null }, round: j.round ? 'present' : null };
    } catch { auth = { status: r.status() }; }
  } catch {} });
  await tab.goto(f0.url());
  await tab.waitForTimeout(7000);
  out.auth = auth;
  out.fonts = await tab.evaluate(async () => {
    await document.fonts.ready;
    const counts = {};
    for (const ff of document.fonts) { const k = ff.family.replace(/"/g, '') + ':' + ff.status; counts[k] = (counts[k] || 0) + 1; }
    return { counts, body: getComputedStyle(document.querySelector('.cb-balance') || document.body).fontFamily.slice(0, 60), overpass: document.fonts.check('16px Overpass') };
  });
  await tab.locator('.ss-continue').first().click({ force: true }).catch(() => {});
  await tab.waitForTimeout(900);
  const esc = async () => { for (let i = 0; i < 6 && await tab.locator('.popup').count(); i++) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); } };
  // to Classic, set picks, two rounds
  await esc();
  await tab.locator('.cb-mode-btn').click(); await tab.waitForTimeout(600);
  await tab.locator('.popup .mode-option').nth(1).click(); await tab.waitForTimeout(400);
  const go = tab.locator('.popup .mode-confirm-go'); if (await go.count()) await go.first().click();
  await tab.waitForTimeout(800); await esc();
  const cols = tab.locator('.choice-row .choice-column');
  for (const [i, n] of [[0, 'Red'], [1, 'Higher'], [2, 'Outside'], [3, 'Heart']]) { const b = cols.nth(i).getByRole('button', { name: n, exact: true }).first(); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click(); }
  for (let k = 0; k < 2; k++) {
    await tab.getByRole('button', { name: 'Deal' }).click();
    const t0 = Date.now();
    await tab.waitForTimeout(800);
    while (Date.now() - t0 < 40000) {
      if (await tab.locator('.wc-overlay').count()) { await tab.locator('.wc-overlay').click({ force: true }).catch(() => {}); await tab.waitForTimeout(400); continue; }
      const ready = await tab.getByRole('button', { name: 'Deal' }).isEnabled().catch(() => false);
      if (ready) break;
      await tab.waitForTimeout(300);
    }
    await tab.waitForTimeout(800);
  }
  const panels = [];
  for (const sel of ['.cb-info', '.cb-autospin', '.cb-mode-btn', '.cb-sound', '.cb-lastwin-btn', '.cb-bet-display', '.cb-turbo']) {
    await tab.locator(sel).first().click({ force: true }).catch(() => {});
    await tab.waitForTimeout(600);
    panels.push(sel + ':' + (await tab.locator('.popup').count()));
    await esc();
  }
  out.panels = panels;
  out.board = await tab.evaluate(() => ({ balance: document.querySelector('.cb-balance')?.textContent.replace(/\s+/g, ' ').trim(), bet: document.querySelector('.cb-bet-display')?.textContent.replace(/\s+/g, ' ').trim() }));
  const origins = {};
  for (const r of reqs) { const i = r.lastIndexOf(' '); const k = r.slice(0, i) + ' ' + r.slice(i + 1, i + 2) + 'xx'; origins[k] = (origins[k] || 0) + 1; }
  out.origins = origins; out.bad = bad; out.cons = cons.filter(c => !/^(log|debug|info): /.test(c)).slice(0, 20); out.consAll = cons.length;
  out.gameDataLogged = cons.some(c => /wallet\/play|payoutMultiplier|"state"|sessionID/i.test(c));
  await tab.close();
  return out;
}
