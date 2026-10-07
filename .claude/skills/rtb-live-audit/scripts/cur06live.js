async page => {
  // v72 on a fresh tab of the live session: SES-08, CMP-20, CMP-18, CMP-19,
  // RND-10, CMP-17, BET-17. Session IDs never leave this script.
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const SHOT = 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/';
  const out = { steps: [] };
  const step = s => out.steps.push(s);
  try {


  const tab = await page.context().newPage();
  await tab.setViewportSize({ width: 1200, height: 675 });
  const cons = [];
  tab.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') cons.push(m.type() + ': ' + m.text().slice(0, 140)); });
  tab.on('pageerror', e => cons.push('pageerror: ' + String(e).slice(0, 140)));
  await tab.goto(f0.url());
  await tab.waitForTimeout(6500);
  const esc = async () => { for (let i = 0; i < 6 && await tab.locator('.popup').count(); i++) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(250); } };
  const family = () => tab.evaluate(() => document.querySelector('.cb-mode-btn')?.getAttribute('title'));
  const toFamily = async (fam) => {
    if ((await family()) === fam) return;
    await esc();
    await tab.locator('.cb-mode-btn').click(); await tab.waitForTimeout(600);
    await tab.locator('.popup').getByRole('button', { name: new RegExp('^' + fam) }).first().click(); await tab.waitForTimeout(450);
    const sw = tab.locator('.popup').getByRole('button', { name: /^Switch/ });
    if (await sw.count()) { await sw.first().click(); await tab.waitForTimeout(800); }
    await esc();
  };
  const setPicks = async (names) => {
    const cols = tab.locator('.choice-row .choice-column');
    for (let i = 0; i < names.length; i++) {
      const b = cols.nth(i).getByRole('button', { name: names[i], exact: true }).first();
      if ((await b.getAttribute('aria-pressed')) !== 'true') { await b.click(); await tab.waitForTimeout(150); }
    }
  };
  const settle = async () => {
    const t0 = Date.now(); const prompts = [];
    await tab.waitForTimeout(700);
    while (Date.now() - t0 < 45000) {
      if (await tab.locator('.wc-overlay').count()) {
        const p = await tab.evaluate(() => document.querySelector('.wc-prompt, .wc-hint')?.textContent.trim());
        if (p && !prompts.includes(p)) prompts.push(p);
        if (/continue/i.test(p || '')) { const b = await tab.locator('.wc-overlay').boundingBox(); await tab.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await tab.waitForTimeout(500); }
        await tab.waitForTimeout(250);
        continue;
      }
      const ready = await tab.getByRole('button', { name: 'Deal' }).isEnabled().catch(() => false);
      const busy = await tab.evaluate(() => [...document.querySelectorAll('[role=tooltip]')].some(e => /Round in progress/.test(e.textContent)));
      if (ready && !busy) break;
      await tab.waitForTimeout(300);
    }
    await tab.waitForTimeout(900);
    return prompts;
  };
  const boardRead = () => tab.evaluate(() => ({
    announce: document.querySelector('.round-announcer')?.textContent.trim(),
    cards: [...document.querySelectorAll('.card-block')].map(e => e.getAttribute('aria-label')),
    chipsHidden: [...document.querySelectorAll('.card-mult')].map(e => e.getAttribute('aria-hidden')),
    readout: [...document.querySelectorAll('.running-win-label, .running-win-amount, .running-win-mult')].map(e => e.textContent.trim()).join(' | '),
  }));



  await tab.locator('.ss-continue').first().click({ force: true }); await tab.waitForTimeout(900);
  await toFamily('Classic');
  await setPicks(['Red', 'Higher', 'Outside', 'Heart']);
  await tab.locator('.cb-bet-display').first().click(); await tab.waitForTimeout(500);
  await tab.locator('.bet-chip[aria-label="$0.01"]').first().click(); await tab.waitForTimeout(400); await esc();
  out.bet = await tab.evaluate(() => document.querySelector('.cb-bet-display')?.textContent.replace(/\s+/g, ' ').trim());
  out.rounds = [];
  for (let i = 0; i < 8; i++) {
    await tab.getByRole('button', { name: 'Deal' }).click();
    const prompts = await settle();
    const r = await boardRead();
    out.rounds.push({ readout: r.readout, lastWin: await tab.evaluate(() => document.querySelector('.cb-lastwin')?.textContent.replace(/\s+/g, ' ').trim()), balance: await tab.evaluate(() => document.querySelector('.cb-balance')?.textContent.replace(/\s+/g, ' ').trim()), prompts });
  }
  await tab.locator('.cb-lastwin-btn').click(); await tab.waitForTimeout(700);
  out.history = await tab.evaluate(() => [...document.querySelectorAll('.history-row')].map(r => r.querySelector('.history-cost')?.textContent.replace(/\s+/g, ' ').trim() + ' -> ' + r.querySelector('.history-paid')?.textContent.replace(/\s+/g, ' ').trim()));
  await tab.screenshot({ path: SHOT + 'cur06-history.png' });
  await esc();
  await tab.locator('.cb-bet-display').first().click(); await tab.waitForTimeout(500);
  await tab.locator('.bet-chip[aria-label="$1.00"]').first().click(); await tab.waitForTimeout(400); await esc();
  out.cons = cons;
  await tab.close();
  } catch (e) { out.err = String(e).slice(0, 300); }
  return out;
}
