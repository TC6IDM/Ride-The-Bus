async page => {
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const tab = await page.context().newPage();
  await tab.setViewportSize({ width: 1200, height: 675 });
  await tab.route('**/wallet/authenticate', async route => { const resp = await route.fetch(); const j = await resp.json(); j.config.jurisdiction = { ...j.config.jurisdiction, minimumRoundDuration: 2500 }; await route.fulfill({ response: resp, json: j }); });
  const plays = []; tab.on('request', r => { if (/wallet\/play/.test(r.url())) plays.push(Date.now()); });
  await tab.goto(f0.url()); await tab.waitForTimeout(6500);
  const tap = tab.getByRole('button', { name: 'Tap to continue' }); if (await tap.count()) { await tap.first().click({ force: true }).catch(() => {}); await tab.waitForTimeout(1000); }
  await tab.getByRole('button', { name: 'Turbo speed' }).click(); await tab.waitForTimeout(300); await tab.locator('.popup input[type=range]').fill('1'); await tab.keyboard.press('Escape'); await tab.waitForTimeout(300);
  const cols = tab.locator('.choice-row .choice-column');
  for (const [i, n] of [[0,'Red'],[1,'Higher'],[2,'Outside'],[3,'Heart']]) { const b = cols.nth(i).getByRole('button', { name: n, exact: true }).first(); if (!/selected/.test((await b.getAttribute('class')) || '')) { await b.click({ force: true }); await tab.waitForTimeout(120); } }
  await tab.getByRole('button', { name: 'Choose bet amount' }).click(); await tab.waitForTimeout(400); await tab.getByRole('button', { name: '$0.01', exact: true }).click(); await tab.waitForTimeout(300);
  if (await tab.locator('.popup').count()) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(300); }
  const intervals = []; let tip = null;
  for (let k = 0; k < 4; k++) {
    const p0 = plays.length;
    await tab.getByRole('button', { name: 'Deal' }).click({ force: true });
    await tab.waitForTimeout(150);
    await tab.getByRole('button', { name: /Skip/ }).click({ force: true, timeout: 400 }).catch(() => {});
    for (let i = 0; i < 40 && plays.length === p0 + 1; i++) {
      await tab.getByRole('button', { name: 'Deal' }).click({ force: true, timeout: 300 }).catch(() => {});
      await tab.keyboard.press('Space');
      if (!tip) tip = await tab.evaluate(() => [...document.querySelectorAll('[role=tooltip], .cb-cooldown-tip')].map(e => e.textContent.trim()).find(t => /\d/.test(t) && /sec|s\b|wait/i.test(t)) || null);
      await tab.waitForTimeout(100);
    }
    if (plays.length >= p0 + 2) intervals.push(Math.round((plays[p0 + 1] - plays[p0]) / 10) / 100);
    else break;
  }
  await tab.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/jur03.png' });
  await tab.close();
  return { intervalsSeconds: intervals, tip };
}
