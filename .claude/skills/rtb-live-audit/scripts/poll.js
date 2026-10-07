async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  return await f.evaluate(() => {
    const t = window.__rtb || {}; const txt = s => (document.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim();
    return { secs: Math.round((Date.now() - t.t0) / 1000), play: t.play, end: t.end, auth: t.auth, non200: t.non200, rateLimited: t.rateLimited, logs: (t.logs || []).slice(-6), startBal: t.startBal, lastBal: t.lastBal,
      balance: txt('.cb-balance'), auto: txt('.cb-auto, .autoplay-count, [class*=auto-count]').slice(0, 40), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e5) / 10 : null,
      error: txt('[role=alertdialog], .error-dialog') || null };
  });
}
