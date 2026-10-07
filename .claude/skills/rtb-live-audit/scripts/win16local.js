async page => {
  // WIN-16 on the local build: the takeover opens on the board's figure under
  // that figure's tier, and never falls.
  const L = 'http://localhost:3002/';
  const out = [];
  for (const [mode, event] of [['red_equal_equal_heart', 975], ['red_higher_outside_heart', 2484], ['hs_red_higher_inside_heart', 45449]]) {
    await page.setViewportSize({ width: 1200, height: 675 });
    await page.goto(`${L}?replay=true&game=ride-the-bus&version=1&mode=${mode}&event=${event}&rgs_url=localhost%3A3011&currency=USD&amount=1000000&lang=en`);
    await page.waitForTimeout(4000);
    await page.locator('.ss-play-btn').first().click({ timeout: 6000 }).catch(() => page.getByRole('button', { name: /^Play/ }).first().click().catch(() => {}));
    const climb = []; let board = null;
    for (let i = 0; i < 200; i++) {
      await page.waitForTimeout(120);
      const s = await page.evaluate(() => {
        const t = q => (document.querySelector(q)?.textContent || '').replace(/\s+/g, ' ').trim();
        return { ov: !!document.querySelector('.wc-overlay'), title: t('.wc-title'), amount: t('.wc-amount'), board: t('.running-win-amount'), prompt: t('.wc-prompt, .wc-hint'), again: t('.cb-spin-caption') };
      });
      if (!s.ov) { board = s.board; if (s.again && climb.length) break; continue; }
      const last = climb[climb.length - 1];
      if (!last || last.title !== s.title) climb.push({ title: s.title, first: s.amount, boardBefore: board }); else last.last = s.amount;
      if (/continue/i.test(s.prompt)) { await page.mouse.click(600, 300); await page.waitForTimeout(400); }
    }
    out.push({ mode, event, climb });
  }
  return out;
}
