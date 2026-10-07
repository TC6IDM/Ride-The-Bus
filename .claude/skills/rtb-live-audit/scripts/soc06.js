async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const tab = page;
  const BAD = /\b(pay|pays|paid|payer|pay out|payout|bet|bets|betting|stake|stakes|wager|wagers|cash|money|buy|bought|purchase|credit|gamble|gambling|deposit|withdraw|rebet|currency|fund|funds)\b/i;
  await f.locator('.ss-continue').first().click({ force: true, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  const harvest = async () => f.evaluate(() => { const out = []; const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) { const t = c.textContent.replace(/\s+/g, ' ').trim(); if (t) out.push(t); } else if (c.nodeType === 1) { const cs = getComputedStyle(c); if (cs.display === 'none' || cs.visibility === 'hidden') continue; for (const a of ['aria-label', 'title']) { const v = c.getAttribute(a); if (v) out.push(v.trim()); } walk(c); } } }; walk(document.body); return out; });
  const hits = new Set();
  const scan = async (where) => { for (const t of await harvest()) if (BAD.test(t)) hits.add(`${where}: ${t.slice(0, 90)}`); };
  await scan('board');
  // picker
  await f.locator('.cb-mode-btn').click({ force: true }); await page.waitForTimeout(600);
  await scan('picker');
  await f.locator('.popup button').filter({ hasText: 'Last Stop' }).first().click({ force: true }); await page.waitForTimeout(500);
  await scan('picker-ls-selected');
  await f.locator('.popup .action-button, .popup .popup-start').first().click({ force: true }).catch(() => {}); await page.waitForTimeout(900);
  while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  await scan('board-ls');
  await f.locator('.cb-info').click({ force: true }); await page.waitForTimeout(700);
  const tabs = f.locator('.popup [role=tab], .popup .mode-tab');
  const n = await tabs.count();
  for (let i = 0; i < n; i++) { await tabs.nth(i).click({ force: true }); await page.waitForTimeout(250); await scan(`howto-tab${i}`); }
  while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  await f.locator('.cb-autospin').click({ force: true }); await page.waitForTimeout(600);
  await scan('autoplay');
  const unit = await f.evaluate(() => [...document.querySelectorAll('.popup .limit-unit-btn')].map(b => b.textContent.trim() + '|' + b.getAttribute('aria-label')));
  while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  await page.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/soc06.png' });
  return { mode: await f.evaluate(() => document.querySelector('.cb-mode-btn')?.getAttribute('title')), hits: [...hits], unit, balance: await f.evaluate(() => document.querySelector('.cb-balance')?.textContent.trim()) };
}
