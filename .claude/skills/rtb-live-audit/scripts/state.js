async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  if (!f) return 'no game frame';
  const tap = f.getByRole('button', { name: 'Tap to continue' });
  if (await tap.count()) { await tap.first().click(); await page.waitForTimeout(1200); }
  return await f.evaluate(() => {
    const q = s => document.querySelector(s);
    const txt = s => (q(s)?.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      balance: txt('.cb-balance'), bet: txt('.cb-bet-display'), lastWin: txt('.cb-lastwin'),
      mode: q('.cb-mode-btn')?.getAttribute('title'), readout: txt('.running-win'),
      deal: q('button[aria-label="Deal"]') ? { disabled: q('button[aria-label="Deal"]').disabled } : 'no deal btn',
      scroll: { x: document.documentElement.scrollWidth > innerWidth, y: document.documentElement.scrollHeight > innerHeight },
      vw: innerWidth, vh: innerHeight,
    };
  });
}
