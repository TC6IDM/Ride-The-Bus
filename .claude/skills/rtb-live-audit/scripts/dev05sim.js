async page => {
  // DEV-05 proxy (SIMULATED, not a cellular network): a fresh tab of the live
  // session on Mobile M with touch, its network throttled to a slow, high-latency
  // link through CDP. Plays rounds, double-taps Deal and presses Space while a
  // play is in flight, and checks every round: one /wallet/play, at most one
  // /wallet/end-round, the board balance equal to the RGS's, Deal usable after.
  // Listeners are wrapped in try/catch - a throwing listener kills the daemon.
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const tab = await page.context().newPage();
  const cdp = await page.context().newCDPSession(tab);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const calls = [];
  const onResp = async r => { try {
    const u = r.url();
    if (!/\/wallet\/(play|end-round|balance)/.test(u)) return;
    let bal = null; try { const j = await r.json(); bal = j && j.balance ? j.balance.amount : null; } catch {}
    calls.push({ t: Date.now(), path: u.replace(/^[a-z]+:\/\/[^\/]+/i, '').split('?')[0], status: r.status(), bal });
  } catch {} };
  tab.on('response', onResp);
  const out = { rounds: [] };
  try {
    await tab.goto(f0.url().replace(/device=[^&]+/, 'device=mobile'));
    await tab.waitForTimeout(7000);
    await tab.locator('.ss-continue').first().dispatchEvent('click').catch(() => {});
    await tab.waitForTimeout(900);
    const esc = async () => { for (let i = 0; i < 6 && await tab.locator('.popup').count(); i++) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); } };
    await esc();
    await tab.locator('.cb-mode-btn').dispatchEvent('click'); await tab.waitForTimeout(600);
    await tab.locator('.popup .mode-option').nth(1).dispatchEvent('click'); await tab.waitForTimeout(400);
    const go = tab.locator('.popup .mode-confirm-go'); if (await go.count()) await go.first().dispatchEvent('click');
    await tab.waitForTimeout(800); await esc();
    const cols = tab.locator('.choice-row .choice-column');
    for (const [i, n] of [[0, 'Red'], [1, 'Higher'], [2, 'Outside'], [3, 'Heart']]) { const b = cols.nth(i).getByRole('button', { name: n, exact: true }).first(); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.dispatchEvent('click'); await tab.waitForTimeout(120); }
    // throttle AFTER the launch: ~Slow 3G, 800 ms extra round trip
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 800, downloadThroughput: 50000, uploadThroughput: 25000 });
    const board = () => tab.evaluate(() => (document.querySelector('.cb-balance')?.textContent || '').replace(/\s+/g, ' ').trim());
    const money = t => Math.round(parseFloat((t || '').replace(/[^0-9.]/g, '')) * 1e6);
    const spin = tab.locator('.cb-spin');
    for (let k = 0; k < 8; k++) {
      const before = await board();
      const c0 = calls.length; const t0 = Date.now();
      if (k % 3 === 1) { await spin.dispatchEvent('click'); await tab.waitForTimeout(60); await spin.dispatchEvent('click'); }
      else if (k % 3 === 2) { await spin.dispatchEvent('click'); await tab.waitForTimeout(300); await tab.keyboard.press('Space'); await tab.waitForTimeout(400); await tab.keyboard.press('Space'); }
      else await spin.dispatchEvent('click');
      // settle: deal usable again and no round in progress
      let ready = false;
      while (Date.now() - t0 < 60000) {
        await tab.waitForTimeout(400);
        if (await tab.locator('.wc-overlay').count()) { await tab.locator('.wc-overlay').dispatchEvent('click').catch(() => {}); continue; }
        const st = await tab.evaluate(() => ({ dis: document.querySelector('.cb-spin')?.disabled, busy: [...document.querySelectorAll('[role=tooltip]')].some(e => /Round in progress/.test(e.textContent)), cap: (document.querySelector('.cb-spin')?.getAttribute('aria-label') || '') }));
        if (!st.dis && !st.busy && /deal/i.test(st.cap) && calls.length > c0 && Date.now() - t0 > 2500) { ready = true; break; }
      }
      await tab.waitForTimeout(2500); // let a late end-round land
      const mine = calls.slice(c0);
      const plays = mine.filter(c => c.path.endsWith('/wallet/play'));
      const ends = mine.filter(c => c.path.endsWith('/wallet/end-round'));
      const lastBal = [...mine].reverse().find(c => c.bal != null)?.bal;
      const after = await board();
      const err = await tab.evaluate(() => (document.querySelector('.error-dialog, [role=alertdialog]')?.textContent || '').replace(/\s+/g, ' ').trim() || null);
      out.rounds.push({ k, how: ['tap', 'double-tap', 'tap+Space x2'][k % 3], ms: Date.now() - t0, plays: plays.length, playStatus: plays.map(p => p.status), ends: ends.length, before, after,
        boardMatchesRgs: lastBal != null ? Math.abs(money(after) - lastBal) < 5000 : null, ready, err });
    }
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  } catch (e) { out.err = String(e).slice(0, 300); }
  tab.off('response', onResp);
  await tab.close();
  return out;
}
