async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const base = f.url();
  const out = {};
  for (const kind of ['ses03', 'bet05']) {
    const tab = await page.context().newPage();
    await tab.setViewportSize({ width: 1200, height: 675 });
    const log = [];
    await tab.route(/\/wallet\/play/, async route => {
      const req = route.request();
      const body = JSON.parse(req.postData() || '{}');
      if (kind === 'ses03') body.sessionID = 'expired-session-for-ses03';
      else body.amount = 1234567;
      const resp = await route.fetch({ postData: JSON.stringify(body) });
      let j = null; try { j = await resp.json(); } catch {}
      log.push({ status: resp.status(), body: j && JSON.stringify(j).replace(/sessionID[^,}]*/g, '').slice(0, 200) });
      await route.fulfill({ response: resp, body: j ? JSON.stringify(j) : undefined });
    });
    await tab.goto(base);
    await tab.waitForTimeout(6500);
    await tab.locator('.ss-continue').first().click({ force: true, timeout: 5000 }).catch(() => {});
    await tab.waitForTimeout(800);
    const cols = tab.locator('.choice-row .choice-column');
    for (let i = 0; i < 4; i++) { const b = cols.nth(i).locator('button').first(); if (!/selected/.test((await b.getAttribute('class')) || '')) await b.click({ force: true }).catch(() => {}); }
    const before = await tab.evaluate(() => document.querySelector('.cb-balance')?.textContent.trim());
    await tab.locator('.cb-spin').click({ force: true });
    await tab.waitForTimeout(3000);
    const dlg = await tab.evaluate(() => { const d = document.querySelector('[role=alertdialog]'); if (!d) return null; const r = d.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + 12); return { text: d.innerText.replace(/\s+/g, ' ').trim(), onTop: d.contains(top), buttons: [...d.querySelectorAll('button')].map(b => b.textContent.trim()) }; });
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/${kind}.png` });
    let after = null;
    if (kind === 'bet05' && dlg) {
      await tab.locator('[role=alertdialog] button').first().click({ force: true });
      await tab.waitForTimeout(1500);
      await tab.unroute(/\/wallet\/play/);
      after = { balance: await tab.evaluate(() => document.querySelector('.cb-balance')?.textContent.trim()), dialogGone: !(await tab.locator('[role=alertdialog]').count()) };
      // playable again: deal one real round
      const rq = [];
      tab.on('response', r => { if (/\/wallet\/play/.test(r.url())) rq.push(r.status()); });
      await tab.locator('.cb-spin').click({ force: true });
      await tab.waitForTimeout(6000);
      after.nextPlay = rq;
      after.balanceAfterNext = await tab.evaluate(() => document.querySelector('.cb-balance')?.textContent.trim());
    }
    out[kind] = { before, rgs: log, dlg, after };
    await tab.close();
  }
  return out;
}
