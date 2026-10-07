async page => {
  const out = [];
  for (const [n, w, h] of [['desktop', 1200, 675], ['laptop', 1024, 576], ['popoutL', 800, 450], ['popoutS', 400, 225], ['mobileL', 425, 812], ['mobileM', 375, 667], ['mobileS', 320, 568]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('http://localhost:3002/?currency=USD&lang=en&rgs_url=localhost%3A3011');
    await page.waitForTimeout(4000);
    await page.locator('.ss-continue').click({ force: true }); await page.waitForTimeout(500);
    const row = { n };
    for (const fam of ['base', 'tr']) {
      await page.evaluate(async (f) => { const url = performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/src/game/bet/betState.svelte.ts')).pop(); const mod = await import(url); mod.bet.family = f; }, fam);
      await page.waitForTimeout(500);
      row[fam] = await page.evaluate(() => {
        const b = document.querySelector('.cb-bet-base');
        const bar = document.querySelector('footer.control-bar').getBoundingClientRect();
        const d = document.querySelector('.cb-bet-display').getBoundingClientRect();
        return { base: b ? getComputedStyle(b).fontSize : null, bar: +bar.height.toFixed(1), display: +d.height.toFixed(1) };
      });
    }
    out.push(row);
  }
  return out;
}
