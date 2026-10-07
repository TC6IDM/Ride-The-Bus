async page => {
  const LEAK = __LEAK__;
  const LANGS = __LANGS__;
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const base = f.url();
  const results = {};
  for (const lang of LANGS) {
    const tab = await page.context().newPage();
    await tab.setViewportSize({ width: 1200, height: 675 });
    const consoleMsgs = [];
    tab.on('console', m => { const t = m.text(); if (/uncompiled|lingui|error/i.test(t) && !/fonts\.gstatic|font/i.test(t)) consoleMsgs.push(m.type() + ': ' + t.slice(0, 120)); });
    tab.on('pageerror', e => consoleMsgs.push('pageerror: ' + String(e).slice(0, 120)));
    // simulated failure for the error dialog: the next /wallet/play answers ERR_GEN
    let armed = false;
    await tab.route(/\/wallet\/play/, async route => {
      if (!armed) return route.continue();
      armed = false;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: { statusCode: 'ERR_GEN', statusMessage: 'General error.' } }) });
    });
    await tab.goto(base.replace(/([?&])lang=[^&]*/, `$1lang=${lang}`));
    await tab.waitForTimeout(6500);
    await tab.locator('.ss-continue').first().click({ force: true, timeout: 5000 }).catch(() => {});
    await tab.waitForTimeout(900);
    const leaks = new Set();
    const harvest = async (where) => {
      const texts = await tab.evaluate(() => {
        const out = [];
        const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) { const t = c.textContent.replace(/\s+/g, ' ').trim(); if (t) out.push(t); } else if (c.nodeType === 1) { const cs = getComputedStyle(c); if (cs.display === 'none' || cs.visibility === 'hidden') continue; const al = c.getAttribute('aria-label'); if (al) out.push(al.trim()); walk(c); } } };
        walk(document.body);
        return out;
      });
      for (const t of texts) if (LEAK[lang].includes(t)) leaks.add(`${where}: ${t.slice(0, 60)}`);
    };
    // a remembered family can be Three of a Kind, which has no guess buttons: play Classic
    await tab.locator('.cb-mode-btn').dispatchEvent('click'); await tab.waitForTimeout(600);
    await tab.locator('.popup .mode-option').nth(1).dispatchEvent('click'); await tab.waitForTimeout(400);
    if (await tab.locator('.popup .mode-confirm-go').count()) await tab.locator('.popup .mode-confirm-go').first().dispatchEvent('click');
    await tab.waitForTimeout(800);
    while (await tab.locator('.popup').count()) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); }
    await harvest('board');
    const clipped = await tab.evaluate(() => [...document.querySelectorAll('footer .cb-cap, footer .cb-val, footer .cb-mode-word, footer .cb-bet-mode, .choice-label, .running-win-label')].filter(e => e.getBoundingClientRect().width && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0, 30)));
    const shot = (n) => tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/lng-${lang}-${n}.png` });
    if (['ar', 'de', 'fi', 'ja'].includes(lang)) await shot('board');
    // panels: How to Play, autoplay, mode
    const titles = [];
    for (const [btnSel, tag] of [['.cb-info', 'howto'], ['.cb-autospin', 'autoplay'], ['.cb-mode-btn', 'mode']]) {
      await tab.locator(btnSel).first().click({ force: true }).catch(() => {});
      await tab.waitForTimeout(700);
      await harvest(tag);
      titles.push(await tab.evaluate(() => { const h = document.querySelector('.popup .popup-head span, .popup h2, .popup-head'); return h ? { t: h.textContent.trim().slice(0, 40), clip: h.scrollWidth > h.clientWidth + 1 } : null; }));
      if (['ar', 'de', 'fi'].includes(lang)) await shot(tag);
      if (tag === 'howto') {
        // every family tab
        const tabs = tab.locator('.popup [role=tab], .popup .mode-tab');
        const n = await tabs.count();
        for (let i = 0; i < n; i++) { await tabs.nth(i).click({ force: true }).catch(() => {}); await tab.waitForTimeout(250); await harvest(`howto-tab${i}`); }
        if (['ar', 'ja', 'pl', 'de'].includes(lang) && n) { await tabs.nth(n - 1).click({ force: true }).catch(() => {}); await tab.waitForTimeout(300); await shot('howto-lasttab'); }
      }
      while (await tab.locator('.popup').count()) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); }
    }
    // one real round: the result words, the card names, the takeover and the history panel
    {
      const cols0 = tab.locator('.choice-row .choice-column');
      if (await cols0.count()) for (let i = 0; i < 4; i++) { const b = cols0.nth(i).locator('button').first(); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click({ force: true }).catch(() => {}); }
      await tab.locator('.cb-spin').click({ force: true }).catch(() => {});
      for (let i = 0; i < 60; i++) {
        await tab.waitForTimeout(500);
        if (await tab.locator('.wc-overlay').count()) { await harvest('takeover'); const bb = await tab.locator('.wc-overlay').boundingBox(); await tab.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); continue; }
        if (await tab.evaluate(() => !!document.querySelector('.round-announcer')?.textContent.trim())) break;
      }
      await tab.waitForTimeout(800);
      await harvest('round');
      await tab.locator('.cb-lastwin-btn').first().click({ force: true }).catch(() => {});
      await tab.waitForTimeout(700);
      await harvest('history');
      if (['ar', 'de', 'ja'].includes(lang)) await shot('history');
      while (await tab.locator('.popup').count()) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); }
    }
    // error dialog (simulated ERR_GEN on the next deal)
    const cols = tab.locator('.choice-row .choice-column');
    if (await cols.count()) {
      for (let i = 0; i < 4; i++) { const b = cols.nth(i).locator('button').first(); if (!/selected/.test((await b.getAttribute('class')) || '')) await b.click({ force: true }).catch(() => {}); }
      armed = true;
      await tab.locator('.cb-spin').click({ force: true }).catch(() => {});
      await tab.waitForTimeout(2500);
      const dlg = await tab.evaluate(() => { const d = document.querySelector('[role=alertdialog], .error-dialog, .error-modal'); return d ? d.innerText.replace(/\s+/g, ' ').trim().slice(0, 160) : null; });
      await harvest('error');
      results[lang] = { dlg };
      if (['ar', 'de', 'ja'].includes(lang)) await shot('error');
    }
    const layout = await tab.evaluate(() => ({ dir: document.documentElement.dir, hscroll: document.documentElement.scrollWidth > innerWidth + 1 }));
    results[lang] = { ...(results[lang] || {}), leaks: [...leaks].slice(0, 12), leakCount: leaks.size, clipped, titles, layout, console: consoleMsgs.slice(0, 6) };
    await tab.close();
  }
  return results;
}
