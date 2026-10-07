async page => {
  // DEV-11 (the MODE sign), DEV-12 (phone type) and CMP-19's touch half, on the
  // uploaded build: every family at the seven sizes in the given languages.
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const LANGS = __LANGS__;
  const SIZES = [['desktop', 1200, 675, false], ['laptop', 1024, 576, false], ['popoutL', 800, 450, false], ['popoutS', 400, 225, false], ['mobileL', 425, 812, true], ['mobileM', 375, 667, true], ['mobileS', 320, 568, true]];
  const out = [];
  for (const lang of LANGS) for (const [name, w, h, phone] of SIZES) {
    const tab = await page.context().newPage();
    const cdp = await page.context().newCDPSession(tab);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
    if (phone) { await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' }); }
    const r = { lang, name, fams: [] };
    try {
      await tab.goto(f0.url().replace(/([?&])lang=[^&]*/, `$1lang=${lang}`).replace(/device=[^&]+/, 'device=' + (phone ? 'mobile' : 'desktop')));
      await tab.waitForTimeout(6500);
      r.prompt = await tab.evaluate(() => document.querySelector('.ss-continue')?.textContent.trim());
      await tab.locator('.ss-continue').first().dispatchEvent('click').catch(() => {});
      await tab.waitForTimeout(900);
      const esc = async () => { for (let i = 0; i < 6 && await tab.locator('.popup').count(); i++) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); } };
      for (let i = 0; i < 5; i++) {
        await esc();
        await tab.locator('.cb-mode-btn').dispatchEvent('click'); await tab.waitForTimeout(600);
        await tab.locator('.popup .mode-option').nth(i).dispatchEvent('click'); await tab.waitForTimeout(400);
        const go = tab.locator('.popup .mode-confirm-go');
        if (await go.count()) await go.first().dispatchEvent('click');
        await tab.waitForTimeout(1000);
        await esc();
        r.fams.push(await tab.evaluate(() => {
          const ns = [...document.querySelectorAll('.cb-blind-name')]; const n = ns[ns.length - 1];
          const meter = document.querySelector('.cb-mode-btn .bolt-meter');
          const mb = meter ? meter.getBoundingClientRect() : null;
          const btn = document.querySelector('.cb-mode-btn').getBoundingClientRect();
          const bar = document.querySelector('footer.control-bar').getBoundingClientRect();
          const items = [...document.querySelectorAll('footer > *')].filter(e => e.getBoundingClientRect().height > 0);
          const c = items.map(e => { const b = e.getBoundingClientRect(); return (b.top + b.bottom) / 2; }).sort((a, b) => a - b); let rows = 0, last = -1e9; for (const x of c) { if (x - last > 14) rows++; last = x; }
          const nb = n.getBoundingClientRect();
          return {
            t: n.textContent.trim(), fs: +parseFloat(getComputedStyle(n).fontSize).toFixed(1), ink: getComputedStyle(n).color,
            over: n.scrollWidth > n.clientWidth + 0.5 || n.scrollHeight > n.clientHeight + 0.5,
            outside: nb.left < btn.left - 0.5 || nb.right > btn.right + 0.5 || nb.top < btn.top - 0.5 || nb.bottom > btn.bottom + 0.5,
            bolts: mb && mb.width > 0 && getComputedStyle(meter).display !== 'none' && getComputedStyle(meter).visibility !== 'hidden' ? document.querySelectorAll('.cb-mode-btn .bolt').length : 0,
            btn: [Math.round(btn.width), Math.round(btn.height)], bar: [Math.round(bar.width), Math.round(bar.height)], rows,
            bet: document.querySelector('.cb-bet-display')?.textContent.replace(/\s+/g, ' ').trim(),
            label: document.querySelector('.cb-mode-btn').getAttribute('aria-label'),
            scroll: document.documentElement.scrollWidth > innerWidth + 1,
          };
        }));
      }
      // DEV-12: the smallest piece of type on the board and the bar, by kind.
      r.type = await tab.evaluate(() => {
        const kinds = { caption: '.cb-cap', guess: '.choice-label', hint: '.running-win-label, .board-hint, .choice-hint', family: '.cb-blind-name', figure: '.cb-val' };
        const res = {};
        for (const [k, sel] of Object.entries(kinds)) {
          const els = [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width > 0 && e.textContent.trim());
          if (!els.length) continue;
          const sizes = els.map(e => [parseFloat(getComputedStyle(e).fontSize), e.textContent.trim().slice(0, 18)]).sort((a, b) => a[0] - b[0]);
          res[k] = sizes[0][0].toFixed(1) + ' ' + sizes[0][1];
        }
        return res;
      });
      if (phone || name === 'popoutS') {
        await tab.locator('.cb-info').first().dispatchEvent('click'); await tab.waitForTimeout(700);
        r.quickBet = await tab.evaluate(() => [...document.querySelectorAll('.popup li span')].map(s => s.textContent.trim()).filter(s => /amount|Betrag|summa|сумм|المبلغ|金額|額/.test(s)).slice(0, 2));
        await esc();
      }
      await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/dev11-${lang}-${name}.png` });
    } catch (e) { r.err = String(e).slice(0, 200); }
    out.push(r);
    await tab.close();
  }
  return out;
}
