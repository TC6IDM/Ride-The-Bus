async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const st = await f.evaluate(() => {
    const t = window.__rtb || {}; const txt = s => (document.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim();
    return { secs: Math.round((Date.now() - t.t0) / 1000), play: t.play, end: t.end, non200: t.non200, rateLimited: t.rateLimited, logs: t.logs, startBal: t.startBal, lastBal: t.lastBal,
      balanceShown: txt('.cb-balance'), lastWin: txt('.cb-lastwin'), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e5) / 10 : null,
      autoBtn: document.querySelector('[aria-label*="utoplay"]')?.getAttribute('aria-label'), dealEnabled: !document.querySelector('button[aria-label="Deal"]')?.disabled,
      error: txt('[role=alertdialog], .err-modal') || null };
  });
  return st;
}
