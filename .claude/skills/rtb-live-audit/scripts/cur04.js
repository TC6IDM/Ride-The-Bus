async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const url = f.url();
  const tab = await page.context().newPage();
  const out = [];
  for (const [w, h, touch] of [[1200, 675], [1024, 576], [800, 450], [400, 225], [425, 812, 1], [375, 667, 1], [320, 568, 1]]) {
    await tab.setViewportSize({ width: w, height: h });
    if (out.length === 0) { await tab.goto(url); await tab.waitForTimeout(7000); await tab.getByRole('button', { name: /continue/i }).first().click({ force: true, timeout: 4000 }).catch(() => {}); await tab.waitForTimeout(800); }
    await tab.waitForTimeout(500);
    const m = await tab.evaluate(() => {
      const bad = [];
      for (const e of document.querySelectorAll('footer .cb-val, footer .cb-cap, footer .cb-bet-base')) {
        const p = e.closest('.cb-panel, .cb-bet-display, .cb-balance, .cb-lastwin'); if (!p) continue;
        const a = e.getBoundingClientRect(), b = p.getBoundingClientRect();
        if (e.scrollWidth > e.clientWidth + 1 || a.right > b.right + 1 || a.left < b.left - 1) bad.push(e.textContent.trim().slice(0, 30));
      }
      const t = q => document.querySelector(q)?.textContent.replace(/\s+/g, ' ').trim();
      return { balance: t('.cb-balance'), bet: t('.cb-bet-display'), lastWin: t('.cb-lastwin'), balFont: getComputedStyle(document.querySelector('.cb-balance .cb-val')).fontSize, bad, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    out.push({ size: `${w}x${h}`, ...m });
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/cur04-${w}x${h}.png` });
  }
  // bet chips in IDR
  await tab.setViewportSize({ width: 1200, height: 675 });
  await tab.getByRole('button', { name: 'Choose bet amount' }).click(); await tab.waitForTimeout(500);
  const chips = await tab.locator('.popup').evaluate(p => { const r = p.getBoundingClientRect(); return { n: p.querySelectorAll('button').length, sample: [...p.querySelectorAll('button')].map(b => b.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(-6), overflow: [...p.querySelectorAll('.bet-chip-face, [class*=chip]')].filter(c => c.scrollWidth > c.clientWidth + 1).length }; });
  await tab.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/cur04-chips.png' });
  await tab.close();
  return { out, chips };
}
