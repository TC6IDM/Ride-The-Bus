async page => {
  // v72 on a fresh tab of the live session: SES-08, CMP-20, CMP-18, CMP-19,
  // RND-10, CMP-17, BET-17. Session IDs never leave this script.
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const SHOT = 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/';
  const out = { steps: [] };
  const step = s => out.steps.push(s);
  try {
  // ---- SES-08: the /index.html launch path
  {
    const tab = await page.context().newPage();
    await tab.setViewportSize({ width: 1200, height: 675 });
    const cons = [];
    tab.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') cons.push(m.type() + ': ' + m.text().slice(0, 140)); });
    tab.on('pageerror', e => cons.push('pageerror: ' + String(e).slice(0, 140)));
    const url = f0.url().replace(/\/(v\d+)\/(\?|$)/, '/$1/index.html$2');
    await tab.goto(url);
    await tab.waitForTimeout(6500);
    out.ses08 = { path: url.split('?')[0].replace(/^https?:\/\/[^/]+/, ''), intro: await tab.locator('.ss-continue').count(), cons };
    await tab.locator('.ss-continue').first().click({ force: true }).catch(() => {});
    await tab.waitForTimeout(900);
    out.ses08.board = await tab.evaluate(() => ({ balance: document.querySelector('.cb-balance')?.textContent.replace(/\s+/g, ' ').trim(), slots: document.querySelectorAll('.card-slot').length, notFound: /not found/i.test(document.body.innerText) }));
    await tab.close();
  }
  step('ses08');

  const tab = await page.context().newPage();
  await tab.setViewportSize({ width: 1200, height: 675 });
  const cons = [];
  tab.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') cons.push(m.type() + ': ' + m.text().slice(0, 140)); });
  tab.on('pageerror', e => cons.push('pageerror: ' + String(e).slice(0, 140)));
  await tab.goto(f0.url());
  await tab.waitForTimeout(6500);

  // ---- CMP-20: Tab from the start
  const desc = () => tab.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return 'body'; return (e.className && String(e.className).split(' ').filter(c => !c.startsWith('svelte-'))[0] || e.tagName) + '|' + (e.getAttribute('aria-label') || e.textContent.trim()).slice(0, 40); });
  out.cmp20 = [];
  for (let i = 0; i < 6; i++) { await tab.keyboard.press('Tab'); await tab.waitForTimeout(120); out.cmp20.push(await desc()); }
  out.cmp20prompt = await tab.evaluate(() => document.querySelector('.ss-continue')?.textContent.trim());
  await tab.locator('.ss-continue').first().click({ force: true });
  await tab.waitForTimeout(900);
  step('cmp20');

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

  // ---- CMP-18: the picks and the empty chips before a deal (Classic)
  await toFamily('Classic');
  await setPicks(['Red', 'Higher', 'Outside', 'Heart']);
  out.cmp18 = { picks: await tab.evaluate(() => [...document.querySelectorAll('.choice-row button[aria-pressed]')].map(b => b.getAttribute('aria-label') + '=' + b.getAttribute('aria-pressed'))), before: await boardRead() };
  step('cmp18-pre');

  // ---- RND-10: five rounds across three families
  const plan = [['Classic', ['Red', 'Higher', 'Outside', 'Heart']], ['Classic', ['Red', 'Higher', 'Outside', 'Heart']], ['Second Chance', ['Black', 'Lower', 'Outside', 'Spade']], ['Second Chance', ['Black', 'Lower', 'Outside', 'Spade']], ['Three of a Kind', null]];
  out.rounds = [];
  for (const [fam, picks] of plan) {
    await toFamily(fam);
    if (picks) await setPicks(picks);
    const bal = await tab.evaluate(() => document.querySelector('.cb-balance')?.textContent.replace(/\s+/g, ' ').trim());
    await tab.getByRole('button', { name: 'Deal' }).click();
    const prompts = await settle();
    out.rounds.push({ fam, bal, prompts, ...(await boardRead()) });
  }
  step('rounds');
  await tab.screenshot({ path: SHOT + 'rnd10-board.png' });

  // the panel
  const lw = tab.locator('.cb-lastwin-btn');
  out.rnd10 = { lastWinIsButton: await lw.count() };
  await lw.click(); await tab.waitForTimeout(700);
  out.rnd10.panel = await tab.evaluate(() => {
    const p = document.querySelector('.popup'); if (!p) return null;
    return {
      title: p.querySelector('h2, .popup-title, header')?.textContent.replace(/\s+/g, ' ').trim(),
      rows: [...p.querySelectorAll('.history-row')].map(r => ({
        fam: r.querySelector('.history-family')?.textContent.trim(), famInk: getComputedStyle(r.querySelector('.history-family')).color,
        cost: r.querySelector('.history-cost')?.textContent.replace(/\s+/g, ' ').trim(),
        hand: r.querySelector('.history-hand')?.innerText.replace(/\s+/g, ' ').trim(),
        marks: [...r.querySelectorAll('.history-card')].map(c => (c.className.match(/is-[a-z]+/g) || []).join('+') || '-').join(' '),
        paid: r.querySelector('.history-paid')?.textContent.replace(/\s+/g, ' ').trim(), paidInk: r.querySelector('.history-amount') ? getComputedStyle(r.querySelector('.history-amount')).color : null,
        net: r.classList.contains('is-net'),
        picks: r.querySelector('.history-picks')?.textContent.replace(/\s+/g, ' ').trim(),
      })),
      scroll: p.scrollHeight > p.clientHeight,
    };
  });
  await tab.screenshot({ path: SHOT + 'rnd10-panel.png' });
  await tab.keyboard.press('Escape'); await tab.waitForTimeout(500);
  out.rnd10.closed = !(await tab.locator('.popup').count());
  out.rnd10.focusBack = await desc();
  step('rnd10');

  // ---- CMP-19 + CMP-17: How to Play
  await tab.locator('.cb-info').first().click(); await tab.waitForTimeout(800);
  out.htp = { quickBet: await tab.evaluate(() => [...document.querySelectorAll('.popup li span')].map(s => s.textContent.trim()).filter(s => /quick-bet/.test(s))) , tabs: [] };
  const tabs = tab.locator('.popup .mode-tab');
  const n = await tabs.count();
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click(); await tab.waitForTimeout(400);
    out.htp.tabs.push(await tab.evaluate(() => {
      const sel = document.querySelector('.popup .mode-tab[aria-selected="true"]');
      const note = [...document.querySelectorAll('.popup p')].map(p => p.textContent.trim()).find(s => /forgiveness is unused/.test(s));
      return (sel?.textContent.replace(/\s+/g, ' ').trim() || '?') + ' => ' + (note || 'no note');
    }));
    if (/Second Chance/.test(out.htp.tabs[out.htp.tabs.length - 1])) await tab.screenshot({ path: SHOT + 'cmp17-sc-tab.png' });
  }
  await esc();
  step('htp');

  // ---- BET-17: a typed amount under the minimum
  await toFamily('Classic');
  await tab.locator('.cb-bet-display').first().click(); await tab.waitForTimeout(600);
  const levels = await tab.evaluate(() => [...document.querySelectorAll('.bet-chip')].map(b => b.getAttribute('aria-label')));
  const inp = tab.locator('.bet-entry-input');
  await inp.fill(''); await inp.type('0.004'); await tab.keyboard.press('Enter'); await tab.waitForTimeout(600);
  await esc();
  const bal0 = await tab.evaluate(() => document.querySelector('.cb-balance')?.textContent.replace(/\s+/g, ' ').trim());
  out.bet17 = { levels: levels.slice(0, 4).concat(['...', levels[levels.length - 1]]), shown: await tab.evaluate(() => document.querySelector('.cb-bet-display')?.textContent.replace(/\s+/g, ' ').trim()) };
  const plays = []; const onReq = r => { if (/\/wallet\/play/.test(r.url())) plays.push(r.url()); }; tab.on('request', onReq);
  await tab.locator('.cb-spin').click({ force: true }); await tab.waitForTimeout(400);
  out.bet17.tip = await tab.evaluate(() => { const e = document.querySelector('.cb-cooldown-tip'); return e ? e.textContent.trim() + (e.classList.contains('is-shown') ? ' [shown]' : ' [hidden]') : null; });
  await tab.screenshot({ path: SHOT + 'bet17.png' });
  await tab.waitForTimeout(1200);
  tab.off('request', onReq);
  out.bet17.plays = plays.length;
  out.bet17.balanceUnchanged = bal0 === await tab.evaluate(() => document.querySelector('.cb-balance')?.textContent.replace(/\s+/g, ' ').trim());
  await tab.locator('.cb-bet-display').first().click(); await tab.waitForTimeout(500);
  out.bet17.fieldAfter = await tab.locator('.bet-entry-input').inputValue();
  // back to $1.00
  await tab.locator('.bet-chip[aria-label="$1.00"]').first().click().catch(() => {});
  await tab.waitForTimeout(400); await esc();
  out.bet17.restored = await tab.evaluate(() => document.querySelector('.cb-bet-display')?.textContent.replace(/\s+/g, ' ').trim());
  step('bet17');
  out.cons = cons;
  await tab.close();
  } catch (e) { out.err = String(e).slice(0, 300); }
  return out;
}
