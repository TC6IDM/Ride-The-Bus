async page => {
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const out = {};
  for (const [label, param] of [['en_US', 'lang=en_US'], ['zz!!', 'lang=zz!!'], ['en;a', 'lang=en;a'], ['empty', 'lang='], ['absent', null], ['po', 'lang=po']]) {
    const tab = await page.context().newPage();
    await tab.setViewportSize({ width: 1200, height: 675 });
    const errs = []; tab.on('console', m => { if (m.type() === 'error' && !/Loading the font/.test(m.text())) errs.push(m.text().slice(0, 140)); });
    tab.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 140)));
    let url = f0.url().replace(/[?&]lang=[^&]*/, '');
    if (param) url += (url.includes('?') ? '&' : '?') + param;
    await tab.goto(url); await tab.waitForTimeout(6500);
    const tap = tab.getByRole('button', { name: /Tap to continue|Weiter|Dotknij|continu/i }); if (await tap.count()) { await tap.first().click({ force: true }).catch(() => {}); await tab.waitForTimeout(1000); }
    out[label] = await tab.evaluate(() => { const t = s => (document.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim(); return { htmlLang: document.documentElement.lang, balance: t('.cb-balance'), bet: t('.cb-bet-display'), lastWin: t('.cb-lastwin'), hint: t('.running-win') }; });
    out[label].consoleErrors = errs.slice(0, 3);
    await tab.close();
  }
  return out;
}
