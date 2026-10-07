async page => {
  // The front version under test, read off the live game frame.
  const FRONT = (page.frames().map(fr => fr.url()).find(u => u.includes('live.engine.io')) || '').match(/\/(v\d+)\//)?.[1] || 'v72';
  const G = '019f7e00-fa38-78fa-9ea7-b4933e75765b';
  const tab = await page.context().newPage();
  await tab.setViewportSize({ width: 1200, height: 675 });
  let wallet = 0; tab.on('request', r => { if (/\/wallet\//.test(r.url())) wallet++; });
  await tab.goto(`https://takeovercasino.live.engine.io/ride-the-bus/${FRONT}/?replay=true&game=${G}&version=13&mode=red_higher_outside_heart&event=2484&currency=USD&amount=1000000&lang=en&device=desktop&social=false&rgs_url=rgsd.engine.io`);
  await tab.waitForTimeout(6500);
  await tab.getByRole('button', { name: 'Play', exact: true }).first().click({ timeout: 8000 });
  const marks = [];
  for (let i = 0; i < 40; i++) {
    await tab.waitForTimeout(1000);
    const s = await tab.evaluate(() => { const again = [...document.querySelectorAll('button')].find(b => /again/i.test((b.getAttribute('aria-label') || '') + b.textContent)); return { t: Math.round(performance.now() / 1000), takeover: !!document.querySelector('.wc-overlay'), again: !!again, enabled: again ? !again.disabled && again.getAttribute('aria-disabled') !== 'true' : null }; });
    marks.push(`${i + 1}s:${s.takeover ? 'TO' : '--'}:${s.again ? (s.enabled ? 'AGAIN-on' : 'AGAIN-off') : 'no-again'}`);
    if (i === 12 && s.takeover) await tab.locator('.wc-overlay').first().click({ force: true }).catch(() => {});
    if (s.again && s.enabled && !s.takeover) break;
  }
  const before = wallet;
  await tab.getByRole('button', { name: /again/i }).first().click({ force: true }).catch(() => {});
  await tab.waitForTimeout(4000);
  const replayed = await tab.evaluate(() => (document.querySelector('.running-win')?.textContent || '').replace(/\s+/g, ' ').trim());
  await tab.close();
  return { marks: marks.join(' '), walletCalls: wallet, afterPlayAgain: replayed };
}
