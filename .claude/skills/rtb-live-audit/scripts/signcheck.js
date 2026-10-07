async page => {
  // Every family's name on the MODE sign, in every language, at the sizes that
  // bind: the narrowest phone, the Russian-tight 404, Popout S and Desktop.
  const langs = ['en', 'ar', 'de', 'es', 'fi', 'fr', 'hi', 'id', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'vi', 'zh'];
  const sizes = globalThis.__sizes || [[320, 608], [404, 768], [400, 225], [1200, 675]];
  const out = {};
  let worst = [];
  for (const lang of langs) {
    await page.setViewportSize({ width: 620, height: 1100 });
    await page.goto(`http://localhost:3002/?currency=USD&lang=${lang}&rgs_url=localhost%3A3011`);
    await page.waitForTimeout(5000);
    await page.getByRole('button', { name: /continue/i }).first().click({ force: true, timeout: 3000 }).catch(() => {});
    await page.locator('.ss-continue, .intro-continue').first().click({ force: true, timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(500);
    const rows = [];
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      for (const fam of ['base', 'sc', 'hs', 'ls', 'tr']) {
        await page.evaluate(async (f) => { const url = performance.getEntriesByType('resource').map(e => e.name).filter(n => n.includes('/src/game/bet/betState.svelte.ts')).pop() || '/src/game/bet/betState.svelte.ts'; const mod = await import(url); mod.bet.family = f; }, fam);
        await page.waitForTimeout(450);
        const r = await page.evaluate(() => {
          const ns = [...document.querySelectorAll('.cb-blind-name')];
          const n = ns[ns.length - 1];
          return { t: n.textContent.trim(), fs: parseFloat(getComputedStyle(n).fontSize), over: n.scrollWidth > n.clientWidth + 0.5 || n.scrollHeight > n.clientHeight + 0.5 };
        });
        rows.push(`${w}:${fam}:${r.fs.toFixed(1)}${r.over ? '!OVER' : ''}`);
        worst.push([r.fs, `${lang} ${w}x${h} ${r.t}`, r.over]);
      }
    }
    out[lang] = rows.filter(x => x.includes('OVER') || parseFloat(x.split(':')[2]) < 7).join(' ');
  }
  worst.sort((a, b) => a[0] - b[0]);
  return { flagged: out, smallest: worst.slice(0, 12).map(x => `${x[0].toFixed(1)} ${x[1]}${x[2] ? ' OVER' : ''}`) };
}
