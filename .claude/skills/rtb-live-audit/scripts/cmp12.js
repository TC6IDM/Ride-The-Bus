async page => {
  // CMP-12 supporting evidence (not the real-phone gesture): what the uploaded
  // build tells a touch browser about zoom.
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const tab = await page.context().newPage();
  const cdp = await page.context().newCDPSession(tab);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await tab.goto(f0.url().replace(/device=[^&]+/, 'device=mobile'));
  await tab.waitForTimeout(7000);
  const intro = await tab.evaluate(() => ({ viewport: document.querySelector('meta[name=viewport]')?.content }));
  await tab.locator('.ss-continue').first().dispatchEvent('click').catch(() => {});
  await tab.waitForTimeout(900);
  const r = await tab.evaluate(() => {
    const ta = sel => { const e = document.querySelector(sel); return e ? getComputedStyle(e).touchAction : 'absent'; };
    const all = [...document.querySelectorAll('body *')];
    const notManip = all.filter(e => !['manipulation', 'none', 'pan-x pan-y pinch-zoom'].includes(getComputedStyle(e).touchAction)).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + '=' + getComputedStyle(e).touchAction).slice(0, 8);
    const none = all.filter(e => getComputedStyle(e).touchAction === 'none').map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]).slice(0, 8);
    return { html: ta('html'), body: ta('body'), board: ta('.card-slot'), square: ta('.choice-square'), spin: ta('.cb-spin'), bar: ta('footer.control-bar'), elements: all.length, notManipulation: notManip, touchActionNone: none };
  });
  await tab.close();
  return { ...intro, ...r };
}
