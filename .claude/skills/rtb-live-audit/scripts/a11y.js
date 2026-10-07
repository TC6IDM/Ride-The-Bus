async page => {
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const out = {};
  // keyboard pass at desktop in a fresh tab
  const tab = await page.context().newPage(); await tab.setViewportSize({ width: 1200, height: 675 });
  await tab.goto(f0.url()); await tab.waitForTimeout(6500);
  const tap = tab.getByRole('button', { name: /continue/i }); if (await tap.count()) { await tap.first().click({ force: true }).catch(() => {}); await tab.waitForTimeout(900); }
  const order = [];
  for (let i = 0; i < 26; i++) {
    await tab.keyboard.press('Tab'); await tab.waitForTimeout(80);
    order.push(await tab.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return 'body'; const cs = getComputedStyle(e); const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || /rgb/.test(cs.boxShadow) ; return (e.getAttribute('aria-label') || e.textContent.trim()).slice(0, 22) + (ring ? '' : ' [NO RING]'); }));
  }
  out.tabOrder = order;
  out.images = await tab.evaluate(() => [...document.querySelectorAll('img')].map(i => (i.getAttribute('src') || '').slice(-24) + ' alt=' + JSON.stringify(i.getAttribute('alt'))));
  out.headings = await tab.evaluate(() => [...document.querySelectorAll('h1,h2,h3')].map(h => h.tagName + ':' + h.textContent.trim().slice(0, 30)));
  out.landmarks = await tab.evaluate(() => ['main','footer','header','nav','[role=dialog]'].map(s => s + '=' + document.querySelectorAll(s).length));
  await tab.close();
  // touch targets at Mobile S (touch-emulated)
  const ph = await page.context().newPage();
  const cdp = await page.context().newCDPSession(ph);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 2, mobile: true });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await ph.goto(f0.url().replace(/device=[^&]+/, 'device=mobile')); await ph.waitForTimeout(6500);
  const tap2 = ph.getByRole('button', { name: /continue/i }); if (await tap2.count()) { await tap2.first().click({ force: true }).catch(() => {}); await ph.waitForTimeout(900); }
  out.smallTargetsMobileS = await ph.evaluate(() => [...document.querySelectorAll('button, [role=button], input, [role=switch]')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { n: (e.getAttribute('aria-label') || e.textContent.trim()).slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => Math.min(x.w, x.h) < 44).map(x => `${x.n} ${x.w}x${x.h}`));
  await ph.close();
  return out;
}
