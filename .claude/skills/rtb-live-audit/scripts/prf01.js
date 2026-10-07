async page => {
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const tab = await page.context().newPage();
  await tab.setViewportSize({ width: 1200, height: 675 });
  const cdp = await page.context().newCDPSession(tab);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  // Chrome DevTools' "Fast 3G" preset
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: (1.44 * 1024 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 });
  const sizes = {}; let total = 0;
  cdp.on('Network.loadingFinished', e => { total += e.encodedDataLength; });
  cdp.on('Network.responseReceived', e => { const u = e.response.url.replace(/sessionID=[^&]+/, 'sessionID=<r>'); sizes[e.requestId] = { u: u.replace(/^https?:\/\/[^/]+/, '').slice(0, 70), type: e.type }; });
  const per = {}; cdp.on('Network.loadingFinished', e => { if (sizes[e.requestId]) per[sizes[e.requestId].u] = Math.round(e.encodedDataLength / 1024); });
  const t0 = Date.now();
  await tab.goto(f0.url(), { waitUntil: 'commit' });
  let introAt = null;
  for (let i = 0; i < 600; i++) {
    await tab.waitForTimeout(100);
    const ready = await tab.evaluate(() => { const b = document.querySelector('.ss-continue'); return !!b && b.getBoundingClientRect().width > 0 && getComputedStyle(b).opacity > 0.9; }).catch(() => false);
    if (ready) { introAt = Date.now() - t0; break; }
  }
  await tab.waitForTimeout(3000);
  await tab.close();
  const top = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([u, k]) => `${k} KB ${u}`);
  return { introInteractiveMs: introAt, totalKB: Math.round(total / 1024), top };
}
