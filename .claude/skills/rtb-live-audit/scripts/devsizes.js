async page => {
  // The front version under test, read off the live game frame.
  const FRONT = (page.frames().map(fr => fr.url()).find(u => u.includes('live.engine.io')) || '').match(/\/(v\d+)\//)?.[1] || 'v72';
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const G = '019f7e00-fa38-78fa-9ea7-b4933e75765b';
  const SIZES = __SIZES__;
  const out = {};
  for (const [name, w, h, phone] of SIZES) {
    const tab = await page.context().newPage();
    const cdp = await page.context().newCDPSession(tab);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
    if (phone) { await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' }); }
    const r = {};
    try {
    const scroll = () => tab.evaluate(() => { const d = document.documentElement, b = document.body; return (Math.max(d.scrollWidth, b.scrollWidth) > innerWidth + 1 ? 'X' : '') + (Math.max(d.scrollHeight, b.scrollHeight) > innerHeight + 1 ? 'Y' : '') || 'none'; });
    const esc = async () => { while (await tab.locator('.popup').count()) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); } };
    const toFamily = async (fam) => {
      if ((await tab.evaluate(() => document.querySelector('.cb-mode-btn')?.getAttribute('title'))) === fam) return;
      await esc();
      await tab.locator('.cb-mode-btn').dispatchEvent('click'); await tab.waitForTimeout(600);
      await tab.locator('.popup button').filter({ hasText: new RegExp('^\s*' + fam) }).first().dispatchEvent('click'); await tab.waitForTimeout(500);
      const sw = tab.locator('.popup button').filter({ hasText: /^\s*Switch/ }).first();
      if (await sw.count()) { await sw.dispatchEvent('click'); await tab.waitForTimeout(900); }
      await esc();
    };
    await tab.goto(f0.url().replace(/device=[^&]+/, 'device=' + (phone ? 'mobile' : 'desktop')));
    await tab.waitForTimeout(6500);
    // DEV-03: the start screen
    r.intro = await tab.evaluate(() => {
      const steps = [...document.querySelectorAll('.ss-step')].filter(e => e.getBoundingClientRect().width);
      const cy = steps.map(e => { const b = e.getBoundingClientRect(); return [(b.top + b.bottom) / 2, b.height]; }); const tops = { size: cy.every(([y]) => Math.abs(y - cy[0][0]) < cy[0][1] / 2) ? 1 : 2 };
      const cont = document.querySelector('.ss-continue')?.getBoundingClientRect();
      return { steps: steps.length, rows: tops.size, continueOnScreen: cont ? cont.bottom <= innerHeight + 1 && cont.top >= 0 : null };
    });
    r.intro.scroll = await scroll();
    const q = tab.locator('.ss-step button, .ss-step [role=button]').filter({ hasText: /^\s*\?\s*$/ }).first();
    if (await q.count()) { await q.click({ force: true }).catch(() => {}); await tab.waitForTimeout(400); r.intro.helpOpens = await tab.evaluate(() => [...document.querySelectorAll('[role=tooltip], .ss-tip, [class*=tip]')].some(e => e.getBoundingClientRect().width && getComputedStyle(e).opacity !== '0' && e.textContent.trim().length > 10)); }
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/sz-${name}-intro.png` });
    await tab.locator('.ss-continue').first().dispatchEvent('click', {}, { timeout: 5000 }).catch(() => {});
    await tab.waitForTimeout(1000);
    r.idleScroll = await scroll();
    r.barRows = await tab.evaluate(() => { const items = [...document.querySelectorAll('footer > *')].filter(e => e.getBoundingClientRect().height > 0); const c = items.map(e => { const b = e.getBoundingClientRect(); return (b.top + b.bottom) / 2; }).sort((a, b) => a - b); let n = 0, last = -1e9; for (const x of c) { if (x - last > 14) n++; last = x; } return n; });
    // DEV-07 + DEV-08 on Last Stop
    await toFamily('Last Stop');
    await tab.getByRole('button', { name: 'Choose bet amount' }).dispatchEvent('click'); await tab.waitForTimeout(400);
    await tab.locator('.popup button').filter({ hasText: /^\s*\$0\.10\s*$/ }).first().dispatchEvent('click').catch(() => {}); await tab.waitForTimeout(300); await esc();
    const overlap = (a, b) => a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    r.ticket = await tab.evaluate(() => {
      const R = e => e && e.getBoundingClientRect();
      const tk = R(document.querySelector('.ticket-slot'));
      const c4 = R([...document.querySelectorAll('.card-slot')][3]);
      const hits = [];
      const ov = (a, b) => a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
      for (const [n, el] of [['readout', document.querySelector('.running-win-amount')], ['suitLabel', [...document.querySelectorAll('.choice-label')][3]], ...[...document.querySelectorAll('.prop')].map((p, i) => ['prop' + i + ':' + [...p.classList].find(c => c.startsWith('p-')), p])]) {
        if (ov(tk, R(el))) hits.push(n);
      }
      return tk ? { whole: tk.left >= 0 && tk.top >= 0 && tk.right <= innerWidth && tk.bottom <= innerHeight, underCard4: c4 ? Math.abs((tk.left + tk.right) / 2 - (c4.left + c4.right) / 2) < c4.width * 0.6 && tk.top > c4.top : null, overlaps: hits } : null;
    });
    // picks, then deal and sample the deal path
    const cols = tab.locator('.choice-row .choice-column');
    for (let i = 0; i < 4; i++) { const b = cols.nth(i).locator('button').first(); if (!/selected/.test((await b.getAttribute('class')) || '')) await b.dispatchEvent('click').catch(() => {}); }
    await tab.getByRole('button', { name: 'Turbo speed' }).dispatchEvent('click'); await tab.waitForTimeout(300);
    await tab.locator('.popup input[type=range]').fill('0'); await tab.waitForTimeout(200); await esc();
    // one round first, so the deal gathers dealt cards back
    await tab.locator('.cb-spin').dispatchEvent('click'); await tab.waitForTimeout(5500);
    if (await tab.locator('.wc-overlay').count()) { await tab.locator('.wc-overlay').first().dispatchEvent('click').catch(() => {}); await tab.waitForTimeout(600); await tab.locator('.wc-overlay').first().dispatchEvent('click').catch(() => {}); await tab.waitForTimeout(600); }
    await tab.locator('.cb-spin').dispatchEvent('click');
    const samples = await tab.evaluate(async () => {
      const deck = document.querySelector('.p-deck .deck-face')?.getBoundingClientRect();
      const res = { minDistRel: 99, hidden: 0 };
      const t0 = performance.now();
      while (performance.now() - t0 < 900) {
        await new Promise(r => requestAnimationFrame(r));
        for (const b of document.querySelectorAll('.card-block')) {
          const r = b.getBoundingClientRect();
          const d = Math.hypot((r.left + r.right) / 2 - (deck.left + deck.right) / 2, (r.top + r.bottom) / 2 - (deck.top + deck.bottom) / 2) / deck.width;
          res.minDistRel = Math.min(res.minDistRel, d);
          if (getComputedStyle(b).opacity < 0.05) res.hidden++;
        }
      }
      return res;
    });
    r.deal = { minDistToDeck: +samples.minDistRel.toFixed(2), hiddenFrames: samples.hidden };
    await tab.waitForTimeout(5000);
    if (await tab.locator('.wc-overlay').count()) { await tab.locator('.wc-overlay').first().dispatchEvent('click').catch(() => {}); await tab.waitForTimeout(600); await tab.locator('.wc-overlay').first().dispatchEvent('click').catch(() => {}); await tab.waitForTimeout(600); }
    r.afterDealScroll = await scroll();
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/sz-${name}-ls.png` });
    // DEV-06 on the two small sizes
    if (['popoutS', 'mobileS'].includes(name)) {
      await toFamily('Three of a Kind');
      r.trips = await tab.evaluate(() => ({ slots: document.querySelectorAll('.card-slot').length, equalBadges: document.querySelectorAll('.equal-slot').length, multiplied: !!document.querySelector('.cb-val-multiplied'), base: document.querySelector('.cb-bet-base')?.textContent.trim() }));
      r.trips.barRows = await tab.evaluate(() => { const items = [...document.querySelectorAll('footer > *')].filter(e => e.getBoundingClientRect().height > 0); const c = items.map(e => { const b = e.getBoundingClientRect(); return (b.top + b.bottom) / 2; }).sort((a, b) => a - b); let n = 0, last = -1e9; for (const x of c) { if (x - last > 14) n++; last = x; } return n; });
      r.trips.scroll = await scroll();
      await tab.locator('.cb-mode-btn').dispatchEvent('click'); await tab.waitForTimeout(600);
      r.trips.pickerScrollsInside = await tab.evaluate(() => { const p = document.querySelector('.popup'); return p ? { panel: p.scrollHeight > p.clientHeight + 1, page: document.documentElement.scrollHeight > innerHeight + 1 } : null; });
      await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/sz-${name}-trips-picker.png` });
      await esc();
      await tab.getByRole('button', { name: 'Choose bet amount' }).click({ force: true }); await tab.waitForTimeout(400);
      await tab.locator('.popup button').first().click({ force: true }).catch(() => {}); await tab.waitForTimeout(300); await esc();
      await tab.locator('.cb-spin').dispatchEvent('click'); await tab.waitForTimeout(6000);
      if (await tab.locator('.wc-overlay').count()) { await tab.locator('.wc-overlay').first().dispatchEvent('click').catch(() => {}); await tab.waitForTimeout(600); await tab.locator('.wc-overlay').first().dispatchEvent('click').catch(() => {}); await tab.waitForTimeout(600); }
      await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/sz-${name}-trips-played.png` });
      await toFamily('Classic');
      r.trips.back = await tab.evaluate(() => ({ slots: document.querySelectorAll('.card-slot').length, squares: document.querySelectorAll('.choice-row .choice-square').length, faceUp: document.querySelectorAll('.card-inner.flipped').length }));
    }
    // DEV-02: a landscape phone's takeover fits the short axis
    if (name.startsWith('land')) {
      await tab.goto(`https://takeovercasino.live.engine.io/ride-the-bus/${FRONT}/?replay=true&game=${G}&version=13&mode=red_equal_equal_heart&event=975&currency=USD&amount=1000000&lang=en&device=mobile&social=false&rgs_url=rgsd.engine.io`);
      await tab.waitForTimeout(6000);
      await tab.locator('.ss-play-btn').first().dispatchEvent('click').catch(() => {});
      for (let i = 0; i < 60 && !(await tab.locator('.wc-overlay').count()); i++) await tab.waitForTimeout(250);
      await tab.waitForTimeout(2500);
      r.takeover = await tab.evaluate(() => { const parts = ['.wc-title', '.wc-amount', '.wc-mult', '.wc-prompt'].map(s => document.querySelector(s)?.getBoundingClientRect()).filter(Boolean); const fan = [...document.querySelectorAll('.wc-overlay [class*=fan] > *')].map(e => e.getBoundingClientRect()); return { inside: [...parts, ...fan].every(b => b.top >= -1 && b.bottom <= innerHeight + 1 && b.left >= -1 && b.right <= innerWidth + 1), n: parts.length + fan.length }; });
      await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/sz-${name}-takeover.png` });
    }
    } catch (e) { r.error = String(e).slice(0, 160); await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/sz-${name}-ERROR.png` }).catch(() => {}); }
    out[name] = r;
    await tab.close();
  }
  return out;
}
