async page => {
  // Social mode on v72: every restricted term, on every surface this session
  // added - the result words, the history panel, the takeover, the SC note, the
  // MODE sign's name, the blocked tip, the error dialog - plus the old ones.
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const BAD = /\b(pay|pays|paid|payer|pay out|payout|bet|bets|betting|stake|stakes|wager|wagers|cash|money|buy|bought|purchase|credit|gamble|gambling|deposit|withdraw|rebet|currency|fund|funds)\b/i;
  const tab = await page.context().newPage();
  await tab.setViewportSize({ width: 1200, height: 675 });
  const hits = new Set(); const seen = {};
  const harvest = () => tab.evaluate(() => { const out = []; const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) { const t = c.textContent.replace(/\s+/g, ' ').trim(); if (t) out.push(t); } else if (c.nodeType === 1) { const cs = getComputedStyle(c); if (cs.display === 'none' || cs.visibility === 'hidden') continue; for (const a of ['aria-label', 'title']) { const v = c.getAttribute(a); if (v) out.push(v.trim()); } walk(c); } } }; walk(document.body); return out; });
  const scan = async (where) => { const ts = await harvest(); seen[where] = ts.length; for (const t of ts) if (BAD.test(t)) hits.add(`${where}: ${t.slice(0, 90)}`); };
  const esc = async () => { for (let i = 0; i < 6 && await tab.locator('.popup').count(); i++) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); } };
  const out = {};
  let armed = false;
  await tab.route(/\/wallet\/play/, async route => {
    if (!armed) return route.continue();
    armed = false;
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'ERR_GEN', message: 'General error.' }) });
  });
  try {
    await tab.goto(f0.url());
    await tab.waitForTimeout(6500);
    await scan('intro');
    out.prompt = await tab.evaluate(() => document.querySelector('.ss-continue')?.textContent.trim());
    await tab.locator('.ss-continue').first().click({ force: true }); await tab.waitForTimeout(900);
    await scan('board');
    // every family: the sign, its picker row, its How to Play tab
    for (let i = 0; i < 5; i++) {
      await tab.locator('.cb-mode-btn').click(); await tab.waitForTimeout(600);
      await scan('picker');
      await tab.locator('.popup .mode-option').nth(i).click(); await tab.waitForTimeout(400);
      await scan('picker-confirm' + i);
      if (await tab.locator('.popup .mode-confirm-go').count()) await tab.locator('.popup .mode-confirm-go').first().click();
      await tab.waitForTimeout(800); await esc();
      await scan('board-fam' + i);
    }
    await tab.locator('.cb-info').click(); await tab.waitForTimeout(700);
    const tabs = tab.locator('.popup .mode-tab'); const n = await tabs.count();
    for (let i = 0; i < n; i++) { await tabs.nth(i).click(); await tab.waitForTimeout(250); await scan('howto-tab' + i); }
    out.scNote = await tab.evaluate(() => [...document.querySelectorAll('.popup p')].map(p => p.textContent.trim()).filter(s => /forgiv/i.test(s)));
    await esc();
    await tab.locator('.cb-autospin').click(); await tab.waitForTimeout(600); await scan('autoplay'); await esc();
    await tab.locator('.cb-sound').click(); await tab.waitForTimeout(600); await scan('sound'); await esc();
    await tab.locator('.cb-turbo').click(); await tab.waitForTimeout(600); await scan('turbo'); await esc();
    // Classic, rounds until a takeover or 12 rounds, scanning the board each time
    await tab.locator('.cb-mode-btn').click(); await tab.waitForTimeout(600);
    await tab.locator('.popup .mode-option').nth(1).click(); await tab.waitForTimeout(400);
    if (await tab.locator('.popup .mode-confirm-go').count()) await tab.locator('.popup .mode-confirm-go').first().click();
    await tab.waitForTimeout(700); await esc();
    const cols = tab.locator('.choice-row .choice-column');
    for (const [i, nm] of [[0, 'Red'], [1, 'Higher'], [2, 'Outside'], [3, 'Heart']]) { const b = cols.nth(i).getByRole('button', { name: nm, exact: true }).first(); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click(); }
    const words = new Set(); let tookOver = false;
    for (let r = 0; r < 12; r++) {
      await tab.locator('.cb-spin').click({ force: true });
      for (let i = 0; i < 80; i++) {
        await tab.waitForTimeout(250);
        const lab = await tab.evaluate(() => document.querySelector('.running-win-label')?.textContent.trim());
        if (lab) words.add(lab);
        if (await tab.locator('.wc-overlay').count()) {
          await scan('takeover'); tookOver = true;
          out.takeoverPrompt = await tab.evaluate(() => document.querySelector('.wc-prompt, .wc-hint')?.textContent.trim());
          const bb = await tab.locator('.wc-overlay').boundingBox(); await tab.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await tab.waitForTimeout(400);
          continue;
        }
        if (i > 8 && await tab.getByRole('button', { name: /Play|Deal|Again/ }).first().isEnabled().catch(() => false) && !(await tab.evaluate(() => [...document.querySelectorAll('[role=tooltip]')].some(e => /in progress/i.test(e.textContent))))) break;
      }
      await tab.waitForTimeout(500);
      await scan('round' + r);
      if (tookOver && r >= 4) break;
    }
    out.words = [...words];
    await tab.locator('.cb-lastwin-btn').click(); await tab.waitForTimeout(700); await scan('history');
    await tab.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/soc72-history.png' });
    await esc();
    // the blocked tip: a typed amount under the minimum
    await tab.locator('.cb-bet-display').click(); await tab.waitForTimeout(500);
    await scan('bet-panel');
    const inp = tab.locator('.bet-entry-input'); await inp.fill(''); await inp.type('0.001'); await tab.keyboard.press('Enter'); await tab.waitForTimeout(400); await esc();
    await tab.locator('.cb-spin').click({ force: true }); await tab.waitForTimeout(400);
    out.tip = await tab.evaluate(() => document.querySelector('.cb-cooldown-tip')?.textContent.trim());
    await scan('blocked');
    await tab.locator('.cb-bet-display').click(); await tab.waitForTimeout(500);
    await tab.locator('.bet-chip').nth(4).click(); await tab.waitForTimeout(400); await esc();
    // the error dialog
    armed = true;
    await tab.locator('.cb-spin').click({ force: true }); await tab.waitForTimeout(2500);
    out.dialog = await tab.evaluate(() => document.querySelector('[role=alertdialog]')?.innerText.replace(/\s+/g, ' ').trim());
    await scan('error');
  } catch (e) { out.err = String(e).slice(0, 300); }
  out.hits = [...hits]; out.seen = seen;
  await tab.close();
  return out;
}
