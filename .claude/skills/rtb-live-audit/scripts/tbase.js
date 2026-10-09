async page => {
  // DEV-12's Three of a Kind line ("$1.00 x 250") on the uploaded build.
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const SIZES = [['desktop', 1200, 675, false], ['popoutS', 400, 225, false], ['mobileL', 425, 812, true], ['mobileM', 375, 667, true], ['mobileS', 320, 568, true]];
  const out = [];
  for (const lang of ['en', 'de', 'ar']) for (const [name, w, h, phone] of SIZES) {
    const tab = await page.context().newPage();
    const cdp = await page.context().newCDPSession(tab);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: phone ? 2 : 1, mobile: phone });
    if (phone) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    try {
      await tab.goto(f0.url().replace(/([?&])lang=[^&]*/, `$1lang=${lang}`).replace(/device=[^&]+/, 'device=' + (phone ? 'mobile' : 'desktop')));
      await tab.waitForTimeout(6500);
      await tab.locator('.ss-continue').first().dispatchEvent('click').catch(() => {});
      await tab.waitForTimeout(900);
      const esc = async () => { for (let i = 0; i < 6 && await tab.locator('.popup').count(); i++) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); } };
      await esc();
      await tab.locator('.cb-mode-btn').dispatchEvent('click'); await tab.waitForTimeout(600);
      await tab.locator('.popup .mode-option').nth(4).dispatchEvent('click'); await tab.waitForTimeout(400);
      const go = tab.locator('.popup .mode-confirm-go'); if (await go.count()) await go.first().dispatchEvent('click');
      await tab.waitForTimeout(1000); await esc();
      out.push({ lang, name, ...(await tab.evaluate(() => {
        const b = document.querySelector('.cb-bet-base'); const d = document.querySelector('.cb-bet-display');
        if (!b) return { base: null };
        const bb = b.getBoundingClientRect(), db = d.getBoundingClientRect();
        return { base: b.textContent.trim(), fs: +parseFloat(getComputedStyle(b).fontSize).toFixed(1),
          clipped: b.scrollWidth > b.clientWidth + 0.5 || bb.left < db.left - 0.5 || bb.right > db.right + 0.5 || bb.bottom > db.bottom + 0.5,
          bar: Math.round(document.querySelector('footer.control-bar').getBoundingClientRect().height) };
      })) });
    } catch (e) { out.push({ lang, name, err: String(e).slice(0, 160) }); }
    await tab.close();
  }
  return out;
}
