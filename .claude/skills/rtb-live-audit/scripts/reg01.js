async page => {
  // REG-01 on a fresh tab: cold launch, a 100-round autoplay at full turbo
  // (takeovers included), every panel, then a language switch (a reload in de).
  // Records every console error/warning, page error, failed request and >=400.
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const tab = await page.context().newPage();
  await tab.setViewportSize({ width: 1200, height: 675 });
  const errs = [], bad = [], failed = []; let plays = 0, ends = 0, takeovers = 0;
  tab.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 160)); });
  tab.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 160)));
  tab.on('requestfailed', r => failed.push(r.url().replace(/\?.*$/, '').slice(-60) + ' ' + (r.failure()?.errorText || '')));
  tab.on('response', r => { const u = r.url(); if (/\/wallet\/play/.test(u)) plays++; if (/\/wallet\/end-round/.test(u)) ends++; if (r.status() >= 400) bad.push(r.status() + ' ' + u.replace(/\?.*$/, '').slice(-60)); });
  const out = {};
  const esc = async () => { for (let i = 0; i < 6 && await tab.locator('.popup').count(); i++) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); } };
  try {
    await tab.goto(f0.url());
    await tab.waitForTimeout(6500);
    await tab.locator('.ss-continue').first().click({ force: true });
    await tab.waitForTimeout(900);
    // Classic, picks set
    await tab.locator('.cb-mode-btn').click(); await tab.waitForTimeout(600);
    await tab.locator('.popup .mode-option').nth(1).click(); await tab.waitForTimeout(400);
    if (await tab.locator('.popup .mode-confirm-go').count()) await tab.locator('.popup .mode-confirm-go').first().click();
    await tab.waitForTimeout(700); await esc();
    const cols = tab.locator('.choice-row .choice-column');
    for (const [i, n] of [[0, 'Red'], [1, 'Higher'], [2, 'Outside'], [3, 'Heart']]) { const b = cols.nth(i).getByRole('button', { name: n, exact: true }).first(); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click(); }
    // turbo to the top
    await tab.getByRole('button', { name: 'Turbo speed' }).click(); await tab.waitForTimeout(500);
    const range = tab.locator('.popup input[type=range]');
    await range.fill(await range.getAttribute('max') || '2'); await tab.waitForTimeout(300); await esc();
    // autoplay 100, no stop on a full game win
    await tab.getByRole('button', { name: 'Autoplay settings' }).click(); await tab.waitForTimeout(600);
    const pop = tab.locator('.popup');
    await pop.getByRole('button', { name: '100', exact: true }).click();
    const fw = pop.getByRole('switch', { name: 'Stop autoplay on full game win' });
    if ((await fw.getAttribute('aria-checked')) === 'true') await fw.click();
    await pop.getByRole('button', { name: /^Start/ }).click();
    await tab.waitForTimeout(500); await esc();
    const t0 = Date.now(); let seenOverlay = false;
    while (Date.now() - t0 < 480000) {
      await tab.waitForTimeout(1000);
      const ov = await tab.locator('.wc-overlay').count();
      if (ov && !seenOverlay) takeovers++;
      seenOverlay = !!ov;
      const running = await tab.evaluate(() => !!document.querySelector('.cb-spin.stopping, .cb-spin.auto') || /Stop/i.test(document.querySelector('.cb-spin')?.getAttribute('aria-label') || ''));
      if (!running && plays >= 100 && !ov) break;
    }
    out.autoplay = { ms: Date.now() - t0, plays, ends, takeovers, balance: await tab.evaluate(() => document.querySelector('.cb-balance')?.textContent.replace(/\s+/g, ' ').trim()) };
    await tab.waitForTimeout(1500);
    // turbo back to normal
    await tab.getByRole('button', { name: 'Turbo speed' }).click(); await tab.waitForTimeout(500);
    await tab.locator('.popup input[type=range]').fill('0'); await tab.waitForTimeout(300); await esc();
    // every panel
    const panels = [];
    for (const sel of ['.cb-info', '.cb-autospin', '.cb-mode-btn', '.cb-sound', '.cb-lastwin-btn', '.cb-bet-display', '.cb-turbo']) {
      await tab.locator(sel).first().click({ force: true }).catch(() => {});
      await tab.waitForTimeout(600);
      panels.push(sel + ':' + (await tab.locator('.popup').count()));
      await esc();
    }
    out.panels = panels;
    // language switch
    await tab.goto(f0.url().replace(/([?&])lang=[^&]*/, '$1lang=de'));
    await tab.waitForTimeout(6500);
    await tab.locator('.ss-continue').first().click({ force: true }).catch(() => {});
    await tab.waitForTimeout(900);
    await tab.locator('.cb-info').first().click({ force: true }); await tab.waitForTimeout(600);
    out.de = await tab.evaluate(() => document.querySelector('.popup')?.innerText.slice(0, 40).replace(/\s+/g, ' '));
    await esc();
  } catch (e) { out.err = String(e).slice(0, 300); }
  out.errs = errs.slice(0, 20); out.errCount = errs.length; out.bad = bad.slice(0, 20); out.failed = failed.slice(0, 20);
  await tab.close();
  return out;
}
