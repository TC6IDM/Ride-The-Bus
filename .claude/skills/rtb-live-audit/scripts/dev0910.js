async page => {
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const tab = await page.context().newPage();
  await tab.setViewportSize({ width: 1200, height: 675 });
  await tab.goto(f0.url());
  await tab.waitForTimeout(6500);
  await tab.locator('.ss-continue').first().click({ force: true, timeout: 5000 }).catch(() => {});
  await tab.waitForTimeout(800);
  const esc = async () => { while (await tab.locator('.popup').count()) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); } };
  const modeNow = () => tab.evaluate(() => document.querySelector('.cb-mode-btn')?.getAttribute('title'));
  const toFamily = async (name) => {
    if ((await modeNow()) === name) return;
    await tab.locator('.cb-mode-btn').click({ force: true }); await tab.waitForTimeout(500);
    await tab.locator('.popup button').filter({ hasText: new RegExp('^' + name) }).first().click({ force: true }); await tab.waitForTimeout(400);
    await tab.locator('.popup').getByRole('button', { name: /^Switch/ }).click({ force: true }).catch(() => {}); await tab.waitForTimeout(800); await esc();
  };
  const out = {};
  // ---- DEV-10 on Three of a Kind: no die
  await toFamily('Three of a Kind');
  out.dieOnTrips = await tab.locator('.table-die, [class*="die-btn"], button[aria-label*="die" i], button[aria-label*="Roll" i]').count();
  await toFamily('Classic');
  await tab.getByRole('button', { name: 'Choose bet amount' }).click(); await tab.waitForTimeout(400);
  await tab.locator('.popup button').filter({ hasText: /^\s*\$0\.10\s*$/ }).first().click({ force: true }); await tab.waitForTimeout(300); await esc();
  const die = tab.locator('button[aria-label*="Roll" i], button[aria-label*="die" i]').first();
  out.dieLabel = await die.getAttribute('aria-label').catch(() => null);
  const picks = () => tab.evaluate(() => [...document.querySelectorAll('.choice-row .choice-column')].map(c => [...c.querySelectorAll('button')].filter(b => /selected/.test(b.className)).map(b => b.getAttribute('aria-label')).join('+')));
  const rolls = [];
  for (let i = 0; i < 6; i++) { await die.click({ force: true }); await tab.waitForTimeout(1300); rolls.push((await picks()).join(',')); }
  out.rolls = rolls;
  out.rollsPlayable = rolls.every(r => { const p = r.split(','); return p.length === 4 && p.every(Boolean) && !(p[1] === 'Equal' && p[2] === 'Inside'); });
  // click the die, then Space: must DEAL with the shown picks
  await die.click({ force: true }); await tab.waitForTimeout(1300);
  const shown = (await picks()).map(s => s.toLowerCase());
  const plays = []; tab.on('request', r => { if (/\/wallet\/play/.test(r.url())) { try { plays.push(JSON.parse(r.postData()).mode); } catch {} } });
  await tab.keyboard.press('Space');
  await tab.waitForTimeout(400);
  // mid-round: the die must be inert
  const before = (await picks()).join(',');
  await die.click({ force: true }).catch(() => {});
  await tab.waitForTimeout(500);
  out.midRoundDieInert = (await picks()).join(',') === before;
  await tab.waitForTimeout(4000);
  out.spaceDealtMode = plays[0] || null;
  out.shownPicks = shown.join('_');
  out.modeMatches = plays[0] === shown.join('_').replace(/heart|diamond|club|spade/, m => m);
  // ---- DEV-09 + WIN-13: instant turbo, slam early, 15 rounds
  await tab.getByRole('button', { name: 'Turbo speed' }).click(); await tab.waitForTimeout(400);
  await tab.locator('.popup input[type=range]').fill('0'); await tab.waitForTimeout(300); await esc();
  let worst = 0; const legible = [];
  for (let k = 0; k < 15; k++) {
    await tab.locator('.cb-spin').click({ force: true });
    await tab.waitForTimeout(250 + (k % 3) * 120);
    if (await tab.locator('.cb-spin.slammable').count()) await tab.locator('.cb-spin').click({ force: true });
    await tab.waitForTimeout(1500);
    if (await tab.locator('.wc-overlay').count()) { const b = await tab.locator('.wc-overlay').first().boundingBox(); await tab.mouse.click(b.x + b.width / 2, b.y + b.height * 0.85); await tab.waitForTimeout(500); await tab.mouse.click(b.x + b.width / 2, b.y + b.height * 0.85); await tab.waitForTimeout(800); }
    const d = await tab.evaluate(() => {
      let worst = 0;
      for (const slot of document.querySelectorAll('.card-slot')) {
        const block = slot.querySelector('.card-block'); if (!block) continue;
        const s = slot.getBoundingClientRect(), b = block.getBoundingClientRect();
        worst = Math.max(worst, Math.abs((s.left + s.width / 2) - (b.left + b.width / 2)));
      }
      const running = document.getAnimations().filter(a => a.playState === 'running' && a.effect?.target?.closest?.('.card-block, .ticket-slot')).length;
      const t = q => document.querySelector(q);
      const vis = e => e && getComputedStyle(e).opacity !== '0' && e.textContent.trim();
      return { worst, running, readout: vis(t('.running-win-amount')) ? t('.running-win-amount').textContent.trim() : null, chips: [...document.querySelectorAll('.card-mult.show')].map(e => getComputedStyle(e).opacity + ':' + e.textContent.trim()).join(' ') };
    });
    worst = Math.max(worst, d.worst);
    legible.push(`${d.readout}|${d.chips}|anim${d.running}`);
  }
  out.dev09WorstPx = +worst.toFixed(2);
  out.win13 = legible.slice(0, 6);
  await tab.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/dev09-end.png' });
  await tab.close();
  return out;
}
