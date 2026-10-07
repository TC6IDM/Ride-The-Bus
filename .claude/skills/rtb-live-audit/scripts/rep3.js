async page => {
  // The front version under test, read off the live game frame.
  const FRONT = (page.frames().map(fr => fr.url()).find(u => u.includes('live.engine.io')) || '').match(/\/(v\d+)\//)?.[1] || 'v72';
  const G = '019f7e00-fa38-78fa-9ea7-b4933e75765b';
  const CASES = [
    ['red_higher_outside_heart', 82, 10000, 1200, 675], ['red_higher_outside_heart', 2484, 1000000, 1200, 675],
    ['tr_any_equal_equal', 2, 1000000, 1200, 675], ['ls_red_higher_outside_heart', 9426, 10000, 1200, 675],
    ['sc_red_higher_equal_spade', 128, 1000000, 1200, 675], ['red_higher_outside_heart', 82, 10000, 400, 225]];
  const out = [];
  for (const [mode, event, amount, w, h] of CASES) {
    const tab = await page.context().newPage();
    await tab.setViewportSize({ width: w, height: h });
    const wallet = []; let book = null;
    tab.on('request', r => { if (/\/wallet\//.test(r.url())) wallet.push(r.url().replace(/^https?:\/\/[^\/]+/, '')); });
    tab.on('response', async r => { if (/\/bet\/replay\//.test(r.url())) { try { const j = await r.json(); const st = j.state || []; book = { status: r.status(), pm: j.payoutMultiplier, cost: j.costMultiplier, cards: st.filter(e => e.card).map(e => (e.card.rank || '') + (e.card.suit || '')).join(' '), events: st.map(e => e.type).join(',') }; } catch { book = { status: r.status() }; } } });
    await tab.goto(`https://takeovercasino.live.engine.io/ride-the-bus/${FRONT}/?replay=true&game=${G}&version=13&mode=${mode}&event=${event}&currency=USD&amount=${amount}&lang=en&device=desktop&social=false&rgs_url=rgsd.engine.io`);
    await tab.waitForTimeout(6500);
    const details = await tab.evaluate(() => { const p = [...document.querySelectorAll('.popup, [class*=replay], [role=dialog]')].find(e => /Round details/.test(e.textContent)); return p ? p.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) : null; });
    await tab.getByRole('button', { name: 'Play', exact: true }).first().click({ timeout: 8000 }).catch(e => null);
    let end = null;
    for (let i = 0; i < 50; i++) {
      await tab.waitForTimeout(500);
      const ov = tab.locator('.wc-overlay'); if (await ov.count()) { end = end || {}; end.takeover = await ov.first().innerText().then(t => t.replace(/\s+/g, ' ').slice(0, 80)).catch(() => ''); await tab.waitForTimeout(2500); await ov.first().click({ force: true }).catch(() => {}); }
      const s = await tab.evaluate(() => { const t = q => (document.querySelector(q)?.textContent || '').replace(/\s+/g, ' ').trim(); const again = [...document.querySelectorAll('button')].find(b => /again/i.test((b.getAttribute('aria-label') || '') + b.textContent)); return { again: again ? (again.getAttribute('aria-label') || again.textContent.trim()) : null, againEnabled: again ? !again.disabled : null, readout: t('.running-win'), lastWin: t('.cb-lastwin'), bet: t('.cb-bet-display'), chips: [...document.querySelectorAll('.card-mult')].map(e => e.textContent.trim()).join(' '), ranks: [...document.querySelectorAll('.card-slot [data-rank], .card-face [aria-label]')].map(e => e.getAttribute('data-rank') || e.getAttribute('aria-label')).join(' ').slice(0, 80), betControls: [...document.querySelectorAll('button')].filter(b => /Increase bet|Decrease bet|Autoplay settings|Choose game mode/.test(b.getAttribute('aria-label') || '')).map(b => (b.getAttribute('aria-label')) + (b.disabled ? ':disabled' : ':ENABLED') + (b.offsetParent ? '' : ':hidden')), scroll: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight }; });
      end = { ...(end || {}), ...s };
      if (s.again) break;
    }
    const tag = `${mode}-${event}-${w}`;
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/rep-${tag}.png` });
    // REP-03/06: press Play Again once; still no wallet calls
    if (end && end.again) { await tab.getByRole('button', { name: /again/i }).first().click({ force: true }).catch(() => {}); await tab.waitForTimeout(3000); }
    out.push({ tag, book, details, end, walletCalls: wallet.length ? wallet : 0 });
    await tab.close();
  }
  return out;
}
