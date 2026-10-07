async page => {
  // BET-16 live: (1) a reload restores the family and picks the player chose;
  // (2) a round the RGS resumes wins over remembered picks that say otherwise.
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const tab = await page.context().newPage();
  await tab.setViewportSize({ width: 1200, height: 675 });
  const out = { tries: [] };
  const esc = async () => { for (let i = 0; i < 6 && await tab.locator('.popup').count(); i++) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); } };
  const boardPicks = () => tab.evaluate(() => ({ family: document.querySelector('.cb-mode-btn')?.getAttribute('title'), pressed: [...document.querySelectorAll('.choice-row button[aria-pressed="true"]')].map(b => b.getAttribute('aria-label')), bet: document.querySelector('.cb-bet-display')?.textContent.replace(/\s+/g, ' ').trim() }));
  try {
    await tab.goto(f0.url()); await tab.waitForTimeout(6500);
    await tab.locator('.ss-continue').first().click({ force: true }); await tab.waitForTimeout(800);
    await tab.locator('.cb-mode-btn').click(); await tab.waitForTimeout(600);
    await tab.locator('.popup .mode-option').nth(3).click(); await tab.waitForTimeout(400);
    if (await tab.locator('.popup .mode-confirm-go').count()) await tab.locator('.popup .mode-confirm-go').first().click();
    await tab.waitForTimeout(700); await esc();
    const cols = tab.locator('.choice-row .choice-column');
    for (const [i, n] of [[0, 'Black'], [1, 'Lower'], [2, 'Inside'], [3, 'Spade']]) { const b = cols.nth(i).getByRole('button', { name: n, exact: true }).first(); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click(); await tab.waitForTimeout(150); }
    // a bet that is not the default, to show the amount is never remembered
    await tab.locator('.cb-step').first().click(); await tab.waitForTimeout(300);
    out.chosen = await boardPicks();
    out.stored = await tab.evaluate(() => localStorage.getItem('ride-the-bus:picks'));
    await tab.reload(); await tab.waitForTimeout(6500);
    await tab.locator('.ss-continue').first().click({ force: true }).catch(() => {}); await tab.waitForTimeout(800);
    out.afterReload = await boardPicks();
    // (2) deal until the RGS answers with a paying (still active) round, then reload mid-reveal
    for (let k = 0; k < 8; k++) {
      const resp = tab.waitForResponse(r => /\/wallet\/play/.test(r.url()), { timeout: 15000 });
      await tab.locator('.cb-spin').click({ force: true });
      const r = await resp; let j = null; try { j = await r.json(); } catch {}
      const pm = j?.round?.payoutMultiplier ?? null;
      out.tries.push({ status: r.status(), mode: j?.round?.mode, pm });
      if (pm > 0) {
        await tab.waitForTimeout(700);
        await tab.evaluate(() => localStorage.setItem('ride-the-bus:picks', JSON.stringify({ v: 1, family: 'base', mode: 'red_higher_outside_heart' })));
        const ends = []; tab.on('response', x => { if (/\/wallet\/end-round/.test(x.url())) ends.push(x.status()); });
        await tab.reload(); await tab.waitForTimeout(6500);
        out.introUp = await tab.locator('.ss-continue').count();
        await tab.locator('.ss-continue').first().click({ force: true }).catch(() => {});
        for (let i = 0; i < 40 && !ends.length; i++) { await tab.waitForTimeout(500); if (await tab.locator('.wc-overlay').count()) { const bb = await tab.locator('.wc-overlay').boundingBox(); await tab.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); } }
        await tab.waitForTimeout(2500);
        out.resumed = { ...(await boardPicks()), ends, readout: await tab.evaluate(() => document.querySelector('.round-announcer')?.textContent.trim()), dialog: await tab.evaluate(() => document.querySelector('[role=alertdialog]')?.innerText.slice(0, 80) || null) };
        await tab.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/bet16-resumed.png' });
        break;
      }
      for (let i = 0; i < 40; i++) { await tab.waitForTimeout(400); if (await tab.getByRole('button', { name: /Play|Deal/ }).first().isEnabled().catch(() => false) && !(await tab.evaluate(() => [...document.querySelectorAll('[role=tooltip]')].some(e => /in progress/i.test(e.textContent))))) break; }
      await tab.waitForTimeout(600);
    }
  } catch (e) { out.err = String(e).slice(0, 300); }
  await tab.close();
  return out;
}
