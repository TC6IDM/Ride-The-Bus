async page => {
  const out = {};
  const L = 'http://localhost:3002/';
  await page.setViewportSize({ width: 1200, height: 675 });
  // 1. count-up from the board's figure, no negative, Click wording (mouse)
  await page.goto(`${L}?replay=true&game=ride-the-bus&version=1&mode=red_higher_outside_heart&event=2484&rgs_url=localhost%3A3011&currency=USD&amount=1000000&lang=en`);
  await page.waitForTimeout(6000);
  await page.locator('.ss-play-btn').first().click({ timeout: 5000 }).catch(() => {});
  const climb = []; let prompt = null;
  for (let i = 0; i < 300; i++) {
    await page.waitForTimeout(40);
    const s = await page.evaluate(() => ({ ov: !!document.querySelector('.wc-overlay'), t: document.querySelector('.wc-title')?.textContent.trim(), a: document.querySelector('.wc-amount')?.textContent.trim(), p: document.querySelector('.wc-prompt')?.textContent.trim() }));
    if (s.ov) { if (!climb.length || climb[climb.length - 1].a !== s.a) climb.push(s); prompt = s.p; if (/continue/i.test(s.p || '')) break; }
  }
  out.countup = { first: climb.slice(0, 3).map(x => `${x.t} ${x.a}`), negative: climb.some(x => /^-/.test(x.a || '')), last: climb.length ? climb[climb.length - 1].a : null, prompt };
  // 2. replay fetch failure: an event the server does not have
  await page.goto(`${L}?replay=true&game=ride-the-bus&version=1&mode=red_higher_outside_heart&event=99999999&rgs_url=localhost%3A3011&currency=USD&amount=1000000&lang=en`);
  await page.waitForTimeout(6000);
  out.replayFailure = await page.evaluate(() => { const d = document.querySelector('[role=alertdialog]'); if (!d) return { dialog: false }; const r = d.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width / 2, r.y + 14); return { dialog: true, onTop: d.contains(top), text: d.innerText.replace(/\s+/g, ' ').trim().slice(0, 160) }; });
  await page.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/local-replayfail.png' });
  // 3. How to Play: Second Chance note; intro Click wording
  await page.goto(`${L}?currency=USD&lang=en&rgs_url=localhost%3A3011`);
  await page.waitForTimeout(6000);
  out.introButton = await page.locator('.ss-continue').first().textContent().catch(() => null);
  out.introTabOrder = await page.evaluate(() => { const f = [...document.querySelectorAll('button, [tabindex]')].filter(e => e.tabIndex >= 0 && e.getBoundingClientRect().width && !e.disabled); return f.slice(0, 6).map(e => e.className.split(' ')[0] + ':' + (e.getAttribute('aria-label') || e.textContent.trim()).slice(0, 24)); });
  await page.locator('.ss-continue').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('.cb-info').click({ force: true }); await page.waitForTimeout(700);
  const tabs = page.locator('.popup [role=tab], .popup .mode-tab');
  let scNote = null;
  for (let i = 0; i < await tabs.count(); i++) { if (/Second Chance/.test(await tabs.nth(i).innerText())) { await tabs.nth(i).click(); await page.waitForTimeout(300); scNote = await page.evaluate(() => [...document.querySelectorAll('.popup p')].map(p => p.textContent.trim()).find(t => t.startsWith('These prices assume'))); } }
  out.scNote = scNote;
  out.quickBetLine = await page.evaluate(() => [...document.querySelectorAll('.popup li span')].map(s => s.textContent.trim()).find(t => /amount for the quick/.test(t)));
  out.infoSub = await page.evaluate(() => { const h = document.querySelector('.popup .info-sub'); const b = document.querySelector('.popup .info-body'); return h && b ? [getComputedStyle(h).fontSize, getComputedStyle(b).fontSize] : null; });
  while (await page.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  // 4. mode panel bolt note with an Equal pick
  const cols = page.locator('.choice-row .choice-column');
  const eq = cols.nth(1).getByRole('button', { name: 'Equal', exact: true }).first();
  if ((await eq.getAttribute('aria-pressed')) !== 'true') await eq.click({ force: true });
  await page.locator('.cb-mode-btn').click({ force: true }); await page.waitForTimeout(600);
  out.boltNote = await page.evaluate(() => [...document.querySelectorAll('.popup .mode-note')].map(p => p.textContent.trim()).find(t => t.startsWith('Bolts show')) || null);
  out.signLabel = await page.locator('.cb-mode-btn').getAttribute('aria-label');
  await page.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/local-modepanel.png' });
  while (await page.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
  // 5. Arabic Three of a Kind table cell
  await page.goto(`${L}?currency=USD&lang=ar&rgs_url=localhost%3A3011`);
  await page.waitForTimeout(6000);
  await page.locator('.ss-continue').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('.cb-info').click({ force: true }); await page.waitForTimeout(700);
  const n = await tabs.count();
  if (n) { await tabs.nth(n - 1).click(); await page.waitForTimeout(400); }
  out.arTrips = await page.evaluate(() => [...document.querySelectorAll('.popup .pay-amount')].map(e => { const r = document.createRange(); r.selectNodeContents(e); const rects = [...r.getClientRects()]; return { text: e.textContent.trim(), dir: getComputedStyle(e).direction }; }));
  await page.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/local-ar-trips.png' });
  return out;
}
