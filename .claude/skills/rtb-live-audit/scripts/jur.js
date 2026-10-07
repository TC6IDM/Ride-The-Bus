async page => {
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const run = async (label, mutate) => {
    const tab = await page.context().newPage();
    await tab.setViewportSize({ width: 1200, height: 675 });
    await tab.route('**/wallet/authenticate', async route => { const resp = await route.fetch(); const j = await resp.json(); mutate(j.config); await route.fulfill({ response: resp, json: j }); });
    let plays = []; tab.on('request', r => { if (/wallet\/play/.test(r.url())) plays.push(Date.now()); });
    const errs = []; tab.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    await tab.goto(f0.url()); await tab.waitForTimeout(6500);
    const tap = tab.getByRole('button', { name: 'Tap to continue' }); if (await tap.count()) { await tap.first().click({ force: true }).catch(() => {}); await tab.waitForTimeout(1000); }
    const r = { label };
    r.controls = await tab.evaluate(() => { const b = n => { const e = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '') === n); return e ? (e.disabled || e.getAttribute('aria-disabled') === 'true' ? 'disabled' : (e.offsetParent ? 'shown' : 'hidden')) : 'absent'; }; return { turbo: b('Turbo speed'), autoplay: b('Autoplay settings'), fullscreen: [...document.querySelectorAll('button')].some(x => /full ?screen/i.test(x.getAttribute('aria-label') || '')) ? 'present' : 'absent', rg: (document.querySelector('.rg-panel, [class*=session-readout], .rg-item')?.closest('[class*=rg]')?.innerText || '').replace(/\s+/g, ' ').slice(0, 120) }; });
    if (r.controls.turbo === 'shown') { await tab.getByRole('button', { name: 'Turbo speed' }).click(); await tab.waitForTimeout(400); r.turboMax = await tab.evaluate(() => document.querySelector('.popup input[type=range]')?.max); await tab.keyboard.press('Escape'); await tab.waitForTimeout(300); }
    const cols = tab.locator('.choice-row .choice-column');
    for (const [i, n] of [[0,'Red'],[1,'Higher'],[2,'Outside'],[3,'Heart']]) { const b = cols.nth(i).getByRole('button', { name: n, exact: true }).first(); if (!/selected/.test((await b.getAttribute('class')) || '')) { await b.click({ force: true }); await tab.waitForTimeout(120); } }
    await tab.getByRole('button', { name: 'Choose bet amount' }).click(); await tab.waitForTimeout(400); await tab.getByRole('button', { name: '$0.01', exact: true }).click(); await tab.waitForTimeout(300);
    if (await tab.locator('.popup').count()) { await tab.keyboard.press('Escape'); await tab.waitForTimeout(300); }
    // Space tap
    let p0 = plays.length; await tab.locator('main, .play-area').first().click({ position: { x: 15, y: 15 }, force: true }).catch(() => {}); await tab.keyboard.press('Space'); await tab.waitForTimeout(1200); r.spaceTapPlays = plays.length - p0;
    // wait settle, then deal by click and try to slam (press the spin again mid-reveal), then immediately try another deal
    await tab.waitForTimeout(5000);
    p0 = plays.length; const t0 = Date.now();
    await tab.getByRole('button', { name: 'Deal' }).click({ force: true });
    await tab.waitForTimeout(400);
    r.midRevealButton = await tab.evaluate(() => { const b = document.querySelector('footer button[aria-label="Deal"], footer button[aria-label*="Skip"], footer button[aria-label*="Stop"]'); return b ? b.getAttribute('aria-label') + (b.disabled ? ':disabled' : '') : 'none'; });
    await tab.getByRole('button', { name: /Skip|Deal/ }).last().click({ force: true }).catch(() => {});
    for (let i = 0; i < 20 && plays.length - p0 < 2; i++) { await tab.waitForTimeout(250); await tab.getByRole('button', { name: 'Deal' }).click({ force: true, timeout: 500 }).catch(() => {}); }
    r.secondsBetweenPlays = plays.length - p0 >= 2 ? Math.round((plays[p0 + 1] - plays[p0]) / 100) / 10 : 'only ' + (plays.length - p0) + ' play(s) within 5s';
    r.cooldownTip = await tab.evaluate(() => [...document.querySelectorAll('[role=tooltip]')].map(e => e.textContent.trim()).filter(t => /second|wait/i.test(t)).slice(0, 2));
    r.pageErrors = errs;
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/jur-${label}.png` });
    await tab.close();
    return r;
  };
  const allOn = await run('flags-on', c => { c.jurisdiction = { ...c.jurisdiction, disabledTurbo: false, disabledSuperTurbo: true, disabledAutoplay: true, disabledSlamstop: true, disabledSpacebar: true, disabledFullscreen: true, displayRTP: true, displayNetPosition: true, displaySessionTimer: true, minimumRoundDuration: 2500 }; });
  const turboOff = await run('turbo-off', c => { c.jurisdiction = { ...c.jurisdiction, disabledTurbo: true }; });
  const absent = await run('block-absent', c => { delete c.jurisdiction; });
  return { allOn, turboOff, absent };
}
