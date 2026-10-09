async page => {
  // PRF-03 proxy (SIMULATED, not a real phone): Mobile M with touch and a coarse
  // pointer, CPU throttled, replaying the Classic max win #975 on the uploaded
  // build. Records every rAF interval while the takeover is up. Run once
  // unthrottled as a baseline. No listeners, so nothing can outlive the run.
  const f0 = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const FRONT = (f0 ? f0.url() : '').match(/\/(v\d+)\//)?.[1] || 'v73';
  const G = '019f7e00-fa38-78fa-9ea7-b4933e75765b';
  const url = `https://takeovercasino.live.engine.io/ride-the-bus/${FRONT}/?replay=true&game=${G}&version=13&mode=red_equal_equal_heart&event=975&currency=USD&amount=1000000&lang=en&device=mobile&social=false&rgs_url=rgsd.engine.io`;
  const out = [];
  for (const rate of [1, 4, 6]) {
    const tab = await page.context().newPage();
    const cdp = await page.context().newCDPSession(tab);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await tab.goto(url);
    await tab.waitForTimeout(6500);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await tab.evaluate(() => {
      window.__fr = { d: [], on: false, last: 0 };
      const loop = t => { const s = window.__fr; if (s.on) { if (s.last) s.d.push(t - s.last); s.last = t; } else s.last = 0; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      new MutationObserver(() => { window.__fr.on = !!document.querySelector('.wc-overlay'); }).observe(document.body, { childList: true, subtree: true });
    });
    await tab.locator('.ss-play-btn, button:has-text("Play")').first().dispatchEvent('click').catch(() => {});
    let seen = false; const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      await tab.waitForTimeout(500);
      const on = await tab.evaluate(() => !!document.querySelector('.wc-overlay'));
      if (on) seen = true;
      const prompt = await tab.evaluate(() => document.querySelector('.wc-prompt, .wc-hint')?.textContent || '');
      if (seen && /continue/i.test(prompt)) { await tab.waitForTimeout(1500); break; }
    }
    const d = await tab.evaluate(() => window.__fr.d);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const s = [...d].sort((a, b) => a - b);
    const q = p => s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1) : null;
    let run = 0, worstRun = 0; for (const x of d) { if (x > 34) { run++; worstRun = Math.max(worstRun, run); } else run = 0; }
    out.push({ rate, takeover: seen, frames: d.length, secs: +(d.reduce((a, b) => a + b, 0) / 1000).toFixed(1),
      fps: d.length ? +(1000 * d.length / d.reduce((a, b) => a + b, 0)).toFixed(1) : null,
      p50: q(0.5), p95: q(0.95), p99: q(0.99), max: s.length ? +s[s.length - 1].toFixed(1) : null,
      over34: d.filter(x => x > 34).length, over50: d.filter(x => x > 50).length, worstConsecutiveOver34: worstRun,
      coarse: await tab.evaluate(() => matchMedia('(pointer: coarse)').matches) });
    await tab.close();
  }
  return out;
}
