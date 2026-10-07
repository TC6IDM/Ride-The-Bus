async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const base = f.url();
  const out = {};
  for (const lang of ['de', 'ar', 'ja']) {
    const tab = await page.context().newPage();
    await tab.setViewportSize({ width: 1200, height: 675 });
    await tab.goto(base.replace(/([?&])lang=[^&]*/, `$1lang=${lang}`));
    await tab.waitForTimeout(6500);
    await tab.locator('.ss-continue').first().click({ force: true, timeout: 5000 }).catch(() => {});
    await tab.waitForTimeout(800);
    // switch to Last Stop: the picker's rows are in volatility order; pick the row whose text matches the LS label
    await tab.locator('.cb-mode-btn').click({ force: true }); await tab.waitForTimeout(600);
    const lsLabel = { de: 'Letzter Halt', ar: 'المحطة الأخيرة', ja: 'ラストストップ' }[lang];
    await tab.locator('.popup button').filter({ hasText: lsLabel }).first().click({ force: true }); await tab.waitForTimeout(500);
    const confirm = tab.locator('.popup .action-button, .popup .popup-start').first();
    await confirm.click({ force: true }).catch(() => {}); await tab.waitForTimeout(900);
    while (await tab.locator('.popup').count()) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); }
    const board = await tab.evaluate(() => {
      const tk = document.querySelector('.ticket-slot');
      const stack = document.querySelector('.p-tickets');
      return { mode: document.querySelector('.cb-mode-btn')?.getAttribute('title'), ticket: tk ? { label: tk.getAttribute('aria-label'), text: tk.innerText.replace(/\s+/g, ' ').trim() } : null, stack: stack ? stack.innerText.replace(/\s+/g, ' ').trim().slice(0, 80) : null, routeDir: getComputedStyle(document.querySelector('.route-line') || document.body).direction };
    });
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/lng07-${lang}-board.png` });
    await tab.locator('.cb-info').click({ force: true }); await tab.waitForTimeout(700);
    const tabs = tab.locator('.popup [role=tab], .popup .mode-tab');
    const n = await tabs.count();
    for (let i = 0; i < n; i++) { if ((await tabs.nth(i).innerText()).includes(lsLabel)) { await tabs.nth(i).click({ force: true }); break; } }
    await tab.waitForTimeout(500);
    await tab.locator('.popup .pay-table, .popup table').first().scrollIntoViewIfNeeded().catch(() => {});
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/lng07-${lang}-howto.png` });
    const payCells = await tab.evaluate(() => [...document.querySelectorAll('.popup .pay-amount')].slice(0, 3).map(e => ({ text: e.textContent.trim(), dir: getComputedStyle(e).direction, bidi: getComputedStyle(e).unicodeBidi })));
    out[lang] = { board, payCells };
    await tab.close();
  }
  return out;
}
