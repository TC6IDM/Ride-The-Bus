// 14 · Performance - and the SIMULATED stand-ins for the checks that need the
// owner's hardware (a real cellular link, a mid-range Android). Those are
// recorded as SIMULATED and never tick a box (manual.mjs says why).
import { setMode, setBetChip, setTurbo, sleep, ready, settle, board, toMicro, errorDialog, watchReplay } from '../lib/game.mjs';
import { eventFor } from '../lib/events.mjs';
import { withParams } from '../lib/studio.mjs';

export default [
  {
    name: 'fast-3g-cold-load',
    covers: ['PRF-01'],
    est: 40,
    async run(t) {
      const url = await t.session({ shared: true });
      const ctx = await t.context();
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 562.5, downloadThroughput: (1.44 * 1024 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 }); // DevTools "Fast 3G"
      let total = 0; cdp.on('Network.loadingFinished', (e) => { total += e.encodedDataLength; });
      const t0 = Date.now();
      await t.goto(page, withParams(url, { device: 'desktop' }), { intro: false });
      let ready = null;
      for (let i = 0; i < 600 && ready === null; i++) { await sleep(100); if (await page.evaluate(() => { const b = document.querySelector('.ss-continue'); return !!b && b.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(b).opacity) > 0.9; }).catch(() => false)) ready = Date.now() - t0; }
      await sleep(2500);
      const kb = Math.round(total / 1024);
      t.expect('PRF-01', ready !== null && ready < 15_000 && kb < 3000, `Fast 3G, cache off: ${kb} KB transferred, the start screen ready at ${ready === null ? 'NEVER' : (ready / 1000).toFixed(1) + 's'}`);
    },
  },

  {
    name: 'simulated-cellular',
    covers: ['DEV-05'],
    est: 90,
    async run(t) {
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      const ctx = await t.context({ viewport: 'mobileM' });
      const page = await ctx.newPage();
      const rec = t.recorder(page);
      await t.game(url, { page, viewport: 'mobileM' });
      await setMode(page, 'red_higher_outside_heart');
      await setBetChip(page, 10_000);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 800, downloadThroughput: 50_000, uploadThroughput: 25_000 });
      // The gate fetches RGS calls outside the browser's network stack, which the
      // emulation above never touches - so the RGS's latency is added here,
      // on the page, before the call reaches the gate.
      await page.route(/^https:\/\/rgsd\.engine\.io\//, async (r) => { await sleep(800 + Math.random() * 400); await r.fallback(); });
      const rounds = [];
      for (let k = 0; k < 6; k++) {
        await ready(page, 60_000);
        const n0 = rec.reqs.filter(r => r.path.endsWith('/wallet/play')).length;
        const spin = page.locator('.cb-spin');
        if (k % 3 === 1) { await spin.dispatchEvent('click'); await sleep(60); await spin.dispatchEvent('click'); }
        else if (k % 3 === 2) { await spin.dispatchEvent('click'); await sleep(300); await page.keyboard.press('Space'); await sleep(300); await page.keyboard.press('Space'); }
        else await spin.dispatchEvent('click');
        await settle(page, { timeout: 90_000 });
        await sleep(1500);
        const plays = rec.reqs.filter(r => r.path.endsWith('/wallet/play')).length - n0;
        const last = [...rec.log].reverse().find(x => x.res?.balance !== undefined);
        const b = await board(page);
        rounds.push({ plays, match: last ? Math.abs(toMicro(b.balance) - last.res.balance) < 5000 : false, err: await errorDialog(page) });
      }
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      const ok = rounds.every(r => r.plays === 1 && r.match && !r.err);
      t.sim('DEV-05', ok, `+800 ms latency, 50 KB/s down on an emulated Mobile M: six rounds by tap, double-tap and Space mid-play - ${rounds.map(r => `${r.plays} play${r.match ? '' : ' BALANCE OFF'}${r.err ? ` "${r.err.title}"` : ''}`).join(', ')} (a real cellular link is the owner's)`);
    },
  },

  {
    name: 'simulated-phone-frame-rate',
    covers: ['PRF-03'],
    est: 90,
    async run(t) {
      const cap = eventFor('red_equal_equal_heart', 'cap');
      const out = [];
      for (const rate of [1, 4, 6]) {
        const ctx = await t.context({ viewport: 'mobileM' });
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        await t.replay({ mode: 'red_equal_equal_heart', event: cap.id, device: 'mobile' }, { page });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        await page.evaluate(() => {
          window.__fr = { d: [], on: false, last: 0 };
          const loop = (ts) => { const s = window.__fr; if (s.on) { if (s.last) s.d.push(ts - s.last); s.last = ts; } else s.last = 0; requestAnimationFrame(loop); };
          requestAnimationFrame(loop);
          new MutationObserver(() => { window.__fr.on = !!document.querySelector('.wc-overlay'); }).observe(document.body, { childList: true, subtree: true });
        });
        await watchReplay(page, { leaveTakeover: true, timeout: 90_000 });
        const d = await page.evaluate(() => window.__fr.d);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
        const s = [...d].sort((a, b) => a - b);
        const q = (p) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0);
        let run = 0, worst = 0; for (const x of d) { if (x > 34) { run++; worst = Math.max(worst, run); } else run = 0; }
        out.push({ rate, fps: d.length ? 1000 * d.length / d.reduce((a, b) => a + b, 0) : 0, p95: q(0.95), worst });
        await page.close();
      }
      const ok = out.every(o => o.worst <= 3) && out[2].fps > 30;
      t.sim('PRF-03', ok, `the #${cap.id} takeover on an emulated phone: ${out.map(o => `${o.rate}x CPU ${o.fps.toFixed(0)} fps (p95 ${o.p95.toFixed(0)} ms, ${o.worst} dropped in a row)`).join('; ')} - a trace on a mid-range Android is the owner's`);
    },
  },
];
