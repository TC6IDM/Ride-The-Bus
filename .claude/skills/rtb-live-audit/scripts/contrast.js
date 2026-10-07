async page => {
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const tab = await page.context().newPage(); await tab.setViewportSize({ width: 1200, height: 675 });
  await tab.goto(f0.url().replace(/social=true/, 'social=false').replace(/currency=XSC/, 'currency=USD')); await tab.waitForTimeout(6500);
  const tap = tab.getByRole('button', { name: /continue/i }); if (await tap.count()) { await tap.first().click({ force: true }).catch(() => {}); await tab.waitForTimeout(1200); }
  const targets = [['hint', '.running-win'], ['credit line', '.board-title .sub, .wordmark-sub, [class*=credit], [class*=lockup-sub]'], ['guess label', '.choice-label'], ['bar caption', '.cb-cap'], ['bar value', '.cb-val'], ['bet family line', '.cb-bet-mode, [class*=bet-family], [class*=bet-mode]']];
  const blank = await page.context().newPage();
  const out = {};
  for (const [label, sel] of targets) {
    const el = tab.locator(sel).filter({ visible: true }).first();
    if (!(await el.count())) { out[label] = 'not found'; continue; }
    const color = await el.evaluate(e => { let n = e; while (n && n.children.length && !n.childNodes[0]?.nodeValue?.trim()) n = n.children[0]; return getComputedStyle(n || e).color; });
    const txt = (await el.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 30);
    let png; try { png = (await el.screenshot({ timeout: 4000 })).toString('base64'); } catch (e) { out[label] = 'screenshot failed'; continue; }
    out[label] = await blank.evaluate(async ({ png, color }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const tc = color.match(/[\d.]+/g).map(Number);
      const lum = ([r, gg, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
      const px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
      const dist = p => Math.hypot(p[0] - tc[0], p[1] - tc[1], p[2] - tc[2]);
      px.sort((a, b) => dist(b) - dist(a));
      const far = px.slice(0, Math.max(1, Math.floor(px.length * 0.4)));
      const med = k => far.map(p => p[k]).sort((a, b) => a - b)[Math.floor(far.length / 2)];
      const bg = [med(0), med(1), med(2)];
      const L1 = lum(tc), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      return { text: color, bg: 'rgb(' + bg.join(',') + ')', ratio: Math.round(ratio * 100) / 100 };
    }, { png, color });
    out[label].sample = txt;
  }
  await blank.close(); await tab.close();
  return out;
}
