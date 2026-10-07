async page => {
  // Bar sweep: every 4px from 320 to 620 (portrait) in every language, plus
  // the seven target sizes. One load per language; the widths are resizes.
  const langs = globalThis.__langs || ['en', 'ar', 'de', 'es', 'fi', 'fr', 'hi', 'id', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'vi', 'zh', 'social'];
  const measure = () => page.evaluate(() => {
    const f = document.querySelector('footer');
    const kids = [...f.children].filter(c => c.getBoundingClientRect().width > 0);
    const centres = kids.map(c => { const r = c.getBoundingClientRect(); return (r.top + r.bottom) / 2; }).sort((a, b) => a - b);
    let rows = 0, last = -1e9;
    for (const c of centres) { if (c - last > 14) rows++; last = c; }
    const bad = [];
    for (const k of kids) { const r = k.getBoundingClientRect(); if (r.left < -0.5 || r.right > innerWidth + 0.5) bad.push('offscreen:' + [...k.classList].filter(x => !x.startsWith('s-'))[1]); }
    for (const s of ['.cb-cap', '.cb-val', '.cb-blind-name', '.cb-spin-caption', '.choice-label', '.running-win-label', '.running-win-hint']) {
      for (const e of document.querySelectorAll(s)) {
        if (!e.getBoundingClientRect().width) continue;
        if (e.scrollWidth > e.clientWidth + 1 || (s === '.cb-blind-name' && e.scrollHeight > e.clientHeight + 1)) bad.push('clip:' + s + ':' + e.textContent.trim().slice(0, 18));
        const p = e.closest('.cb-panel, .cb-mode-btn, .choice-column');
        if (p) { const a = e.getBoundingClientRect(), b = p.getBoundingClientRect(); if (a.right > b.right + 1 || a.left < b.left - 1) bad.push('out:' + s + ':' + e.textContent.trim().slice(0, 18)); }
      }
    }
    const fs = (s) => { const e = document.querySelector(s); return e ? parseFloat(getComputedStyle(e).fontSize) : null; };
    return { rows, bad, cap: fs('.cb-cap'), label: fs('.choice-label'), sign: fs('.cb-blind-name') };
  });
  const out = {};
  for (const lang of langs) {
    const q = lang === 'social' ? 'lang=en&social=true' : `lang=${lang}`;
    await page.setViewportSize({ width: 620, height: 1100 });
    await page.goto(`http://localhost:3002/?currency=USD&${q}&rgs_url=localhost%3A3011`);
    await page.waitForTimeout(5500);
    await page.getByRole('button', { name: /continue/i }).first().click({ force: true, timeout: 3000 }).catch(() => {});
    await page.locator('.ss-continue, .intro-continue').first().click({ force: true, timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(700);
    const fails = [];
    let minCap = 99, minLabel = 99, minSign = 99;
    for (let w = 320; w <= 620; w += 4) {
      await page.setViewportSize({ width: w, height: Math.round(w * 1.9) });
      await page.waitForTimeout(40);
      const m = await measure();
      minCap = Math.min(minCap, m.cap ?? 99); minLabel = Math.min(minLabel, m.label ?? 99); minSign = Math.min(minSign, m.sign ?? 99);
      if (m.rows !== 2 || m.bad.length) fails.push(`${w}:${m.rows}r ${m.bad.join(',')}`);
    }
    for (const [w, h, rowsWanted] of [[1200, 675, 1], [1024, 576, 1], [800, 450, 1], [400, 225, 1], [425, 812, 2], [375, 667, 2], [320, 568, 2]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(60);
      const m = await measure();
      if (m.rows !== rowsWanted || m.bad.length) fails.push(`T${w}x${h}:${m.rows}r ${m.bad.join(',')}`);
    }
    out[lang] = { fails: fails.slice(0, 8), n: fails.length, minCap, minLabel, minSign: +minSign.toFixed(1) };
  }
  return out;
}
