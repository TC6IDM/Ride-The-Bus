async page => {
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const SIZES = [['desktop',1200,675,false],['laptop',1024,576,false],['popoutL',800,450,false],['popoutS',400,225,false],['mobileL',425,812,true],['mobileM',375,667,true],['mobileS',320,568,true]];
  const out = {};
  for (const [name, w, h, phone] of SIZES) {
    const tab = await page.context().newPage();
    const cdp = await page.context().newCDPSession(tab);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
    if (phone) { await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' }); }
    await tab.goto(f0.url().replace(/device=[^&]+/, 'device=' + (phone ? 'mobile' : 'desktop')));
    await tab.waitForTimeout(6500);
    const tap = tab.getByRole('button', { name: 'Tap to continue' }); if (await tap.count()) { await tap.first().click({ force: true }).catch(() => {}); await tab.waitForTimeout(1200); }
    const scroll = () => tab.evaluate(() => { const d = document.documentElement, b = document.body; return { x: Math.max(d.scrollWidth, b.scrollWidth) > innerWidth + 1, y: Math.max(d.scrollHeight, b.scrollHeight) > innerHeight + 1, pointer: matchMedia('(pointer: coarse)').matches ? 'coarse' : 'fine' }; });
    const r = { idle: await scroll() };
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/size-${name}-idle.png` });
    await tab.getByRole('button', { name: 'Choose bet amount' }).click({ force: true }).catch(() => {}); await tab.waitForTimeout(700);
    r.betMenu = await scroll(); r.betPanelScrolls = await tab.evaluate(() => { const p = document.querySelector('.popup'); return p ? p.scrollHeight > p.clientHeight : null; });
    await tab.keyboard.press('Escape'); await tab.waitForTimeout(400);
    await tab.getByRole('button', { name: 'How to play' }).click({ force: true }).catch(() => {}); await tab.waitForTimeout(700);
    r.howTo = await scroll();
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/size-${name}-howto.png` });
    await tab.keyboard.press('Escape'); await tab.waitForTimeout(400);
    r.barRows = await tab.evaluate(() => { const items = [...document.querySelectorAll('footer > *')].filter(e => e.getBoundingClientRect().height > 0); return new Set(items.map(e => Math.round(e.getBoundingClientRect().top / 8))).size; });
    if (name === 'mobileM') {
      const cols = tab.locator('.choice-row .choice-column');
      for (const [i, n] of [[0,'Red'],[1,'Higher'],[2,'Outside'],[3,'Heart']]) { await cols.nth(i).getByRole('button', { name: n, exact: true }).first().tap().catch(e => r.tapErr = String(e).slice(0, 80)); await tab.waitForTimeout(200); }
      await tab.getByRole('button', { name: 'Choose bet amount' }).tap().catch(() => {}); await tab.waitForTimeout(500);
      await tab.getByRole('button', { name: '$0.01', exact: true }).tap().catch(() => {}); await tab.waitForTimeout(400);
      if (await tab.locator('.popup').count()) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(300); }
      const wait = tab.waitForResponse(x => x.url().includes('/wallet/play'), { timeout: 10000 }).catch(() => null);
      await tab.getByRole('button', { name: 'Deal' }).tap().catch(e => r.dealErr = String(e).slice(0, 80));
      const resp = await wait; r.roundPlayed = resp ? resp.status() : 'no play request';
      await tab.waitForTimeout(6000);
      r.afterRound = await tab.evaluate(() => (document.querySelector('.running-win')?.textContent || '').replace(/\s+/g, ' ').trim());
      await tab.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/size-mobileM-round.png' });
    }
    out[name] = r;
    await tab.close();
  }
  return out;
}
