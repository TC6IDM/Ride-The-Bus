// 04 · Autoplay endurance - and the long-session checks that ride on the same
// run (balance drift, memory, a clean console).
import {
  board, setMode, setFamily, setBetChip, setTurbo, closePopups, sleep, toMicro, watchHealth,
  startAutoplay, autoRunning, waitAutoplay, operatorBalance, errorDialog, settle, dismissIntro,
} from '../lib/game.mjs';
import { withParams } from '../lib/studio.mjs';

const PANELS = ['.cb-info', '.cb-autospin', '.cb-mode-btn', '.cb-sound', '.cb-lastwin-btn', '.cb-bet-display', '.cb-turbo'];
const heap = (page) => page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : null).catch(() => null);
const gaps = (times) => times.slice(1).map((v, i) => v - times[i]);

export default [
  {
    name: 'endurance',
    covers: ['END-01', 'END-02', 'END-03', 'RND-03', 'PRF-02', 'REG-01'],
    est: 720,
    timeout: 40 * 60_000,
    async run(t) {
      const N = t.cfg.endurance;
      const url = await t.session({ balance: 100_000_000_000 });
      const page = await t.page();
      const health = watchHealth(page);
      const rec = t.recorder(page);
      await t.game(url, { page });
      await setMode(page, 'red_higher_outside_heart');
      await setBetChip(page, 10_000);
      await setTurbo(page, 1);
      const startBal = await operatorBalance(page);
      const heap0 = await heap(page);
      await startAutoplay(page, { rounds: N, fullWinStop: false, skip: true });
      const t0 = Date.now();
      const ended = await waitAutoplay(page, N * 3000 + 120_000);
      await settle(page);
      await sleep(2000);
      const secs = Math.round((Date.now() - t0) / 1000);
      const plays = rec.log.filter(x => x.path.endsWith('/wallet/play'));
      const ends = rec.log.filter(x => x.path.endsWith('/wallet/end-round'));
      const non200 = rec.log.filter(x => x.status !== 200).map(x => `${x.path} ${x.status}`);
      const d = await errorDialog(page);
      const rateLines = health.all.filter(l => /rate limited by the RGS/.test(l));
      const unhandled = [...health.pageErrors, ...health.all.filter(l => /unhandled/i.test(l))];
      t.expect('END-01', ended && plays.length === N && !d && !non200.length && !unhandled.length, `${plays.length} of ${N} rounds in ${secs}s, ${ended ? 'stopped by its counter' : 'STILL RUNNING or stuck'}${d ? `; dialog "${d.title}"` : ''}${non200.length ? `; non-200: ${non200.slice(0, 3).join(', ')}` : '; every call 200'}${unhandled.length ? `; ${unhandled[0]}` : ''}`);
      // END-02: the gaps the GAME left between its own calls (request events fire before the runner's gate holds them).
      const callTimes = rec.reqs.filter(r => /\/wallet\/(play|end-round)$/.test(r.path)).map(r => r.t);
      const playTimes = rec.reqs.filter(r => r.path.endsWith('/wallet/play')).map(r => r.t);
      const cg = gaps(callTimes), pg = gaps(playTimes);
      const minCall = Math.min(...cg), minPlay = Math.min(...pg);
      const p5 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.05)];
      // Recorded, never ticked: the game spaces calls from when it SENT the last
      // one (400 ms any call, 900 ms play to play - rgsPacingMath.ts, pinned by
      // its tests), and under the runner's pacing every answer arrives seconds
      // later, so the game's own floor never decides a gap here. A game with no
      // pacing at all would read the same. What this does show is that nothing
      // reached the RGS closer together than below.
      t.sim('END-02', minCall >= 380 && minPlay >= 880, `closest calls ${minCall}ms apart (5th percentile ${p5(cg)}ms), closest plays ${minPlay}ms (5th percentile ${p5(pg)}ms), over ${callTimes.length} calls - spaced by the runner's RGS pacing, which hides the game's own 400/900 ms floors (pinned by rgsPacingMath's tests)`);
      t.expect('END-03', !rateLines.length || (plays.length === N), rateLines.length ? `${rateLines.length} "rate limited" lines, the run ${plays.length === N ? 'carried on to the end' : 'STOPPED'}: ${rateLines[0]}` : 'no "rate limited by the RGS" line');
      // RND-03: the books against the operator's figure.
      const spent = plays.reduce((a, p) => a + (p.req?.amount || 0) * (p.res?.round?.costMultiplier || 1), 0);
      const won = plays.reduce((a, p) => a + Math.round((p.res?.round?.payoutMultiplier || 0) * (p.req?.amount || 0)), 0);
      const opBal = await operatorBalance(page);
      const shown = toMicro((await board(page)).balance);
      const noUsable = health.all.filter(l => /no usable balance/i.test(l));
      t.expect('RND-03', opBal === startBal - spent + won && Math.abs(shown - opBal) < 5000 && !noUsable.length, `start ${startBal}, staked ${spent}, won ${won}: expected ${startBal - spent + won}, operator ${opBal}, board ${shown}${noUsable.length ? `; ${noUsable[0]}` : ''} (${ends.length} end-rounds)`);
      const heap1 = await heap(page);
      if (heap0 && heap1) t.expect('PRF-02', heap1 < heap0 * 1.5 + 10e6, `JS heap ${(heap0 / 1e6).toFixed(1)} MB before, ${(heap1 / 1e6).toFixed(1)} MB after ${plays.length} rounds`);
      else t.note('PRF-02', 'performance.memory unavailable');
      // REG-01: every panel, then a reload in German, on top of the long run.
      for (const sel of PANELS) { await page.locator(sel).first().click({ force: true }).catch(() => {}); await sleep(400); await closePopups(page); }
      await t.goto(page, withParams(page.url(), { lang: 'de' }), { intro: false });
      await dismissIntro(page);
      await page.locator('.cb-info').click(); await sleep(500);
      const de = await page.evaluate(() => document.querySelector('.popup')?.innerText.slice(0, 60).replace(/\s+/g, ' '));
      await closePopups(page);
      const errs = [...health.console, ...health.pageErrors];
      t.expect('REG-01', !errs.length && /Spielanleitung|Regeln|So wird/i.test(de || ''), `${errs.length ? `console: ${errs.slice(0, 3).join(' / ')}` : `console clean across ${plays.length} rounds, every panel and a reload in de`} ("${de}")`);
    },
  },

  {
    name: 'autoplay-stop',
    covers: ['END-04'],
    est: 60,
    async run(t) {
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      const page = await t.game(url);
      const rec = t.recorder(page);
      await setMode(page, 'red_higher_outside_heart');
      await setBetChip(page, 10_000);
      await setTurbo(page, 0);
      await startAutoplay(page, { rounds: 50 });
      // wait for a reveal in flight (the third round, to be sure the run is going), then Stop
      let pressedAt = 0;
      for (let i = 0; i < 400 && !pressedAt; i++) {
        const plays = rec.log.filter(x => x.path.endsWith('/wallet/play')).length;
        const revealing = await page.evaluate(() => [...document.querySelectorAll('.card-inner.flipped')].length >= 1 && [...document.querySelectorAll('.card-inner.flipped')].length < 4);
        if (plays >= 2 && revealing) { await page.locator('.cb-spin').click({ force: true }); pressedAt = Date.now(); }
        await sleep(60);
      }
      const playsAtStop = rec.reqs.filter(r => r.path.endsWith('/wallet/play')).length;
      await sleep(9000);
      const playsAfter = rec.reqs.filter(r => r.path.endsWith('/wallet/play')).length;
      const last = rec.log.filter(x => x.path.endsWith('/wallet/play')).at(-1);
      const pm = last?.res?.round?.payoutMultiplier || 0;
      const settledOk = pm > 0 ? rec.log.some(x => x.path.endsWith('/wallet/end-round') && x.t > last.t && x.status === 200) : true;
      const b = await board(page);
      t.expect('END-04', pressedAt && playsAfter === playsAtStop && !(await autoRunning(page)) && settledOk && b.cards.filter(Boolean).length >= 1, `Stop pressed mid-reveal on round ${playsAtStop}; ${playsAfter - playsAtStop} rounds after it; the round in flight (${pm}x) ${settledOk ? 'settled' : 'did NOT settle'} and stays on the board ("${b.label}" ${b.amount})`);
    },
  },

  {
    name: 'autoplay-full-win-stop',
    covers: ['END-05'],
    est: 240,
    timeout: 900_000,
    async run(t) {
      const url = await t.session({ shared: true, balance: 400_000_000_000 });
      // Classic: partial wins must not stop it.
      let page = await t.game(url);
      let rec = t.recorder(page);
      await setMode(page, 'red_higher_outside_heart');
      await setBetChip(page, 10_000);
      await setTurbo(page, 1);
      await startAutoplay(page, { rounds: 25, fullWinStop: true });
      await waitAutoplay(page, 25 * 3000 + 60_000);
      let plays = rec.log.filter(x => x.path.endsWith('/wallet/play'));
      const sweepAt = plays.findIndex(p => (p.res?.round?.state || []).filter(e => e.type === 'reveal').length === 4 && !(p.res.round.state.some(e => e.correct === false)));
      const partials = plays.filter(p => p.res?.round?.payoutMultiplier > 0).length;
      t.expect('END-05', sweepAt >= 0 ? plays.length === sweepAt + 1 : plays.length === 25, sweepAt >= 0 ? `Classic stopped on round ${plays.length}, the sweep (round ${sweepAt + 1}), after ${partials - 1} partial wins` : `Classic ran all 25 rounds through ${partials} partial wins without stopping`);
      await page.close();
      // Three of a Kind: every win is a full game win - the run ends on the first.
      page = await t.game(url);
      rec = t.recorder(page);
      await setFamily(page, 'tr');
      await setBetChip(page, 2_500_000);
      await setTurbo(page, 1);
      await startAutoplay(page, { rounds: 'inf', fullWinStop: true });
      await waitAutoplay(page, 150 * 3000);
      if (await autoRunning(page)) { await page.locator('.cb-spin').click({ force: true }); await sleep(5000); }
      plays = rec.log.filter(x => x.path.endsWith('/wallet/play'));
      const first = plays.findIndex(p => p.res?.round?.payoutMultiplier > 0);
      t.expect('END-05', first >= 0 && plays.length === first + 1, `Three of a Kind stopped after ${plays.length} rounds; its first win was round ${first + 1}`);
    },
  },

  {
    name: 'autoplay-limits',
    covers: ['END-07', 'END-08'],
    est: 300,
    timeout: 900_000,
    async run(t) {
      const url = await t.session({ shared: true, balance: 400_000_000_000 });
      const cases = [
        ['END-07', 'Classic, loss 5x', 'red_higher_outside_heart', 1_000_000, { loss: [5, 'x'] }],
        ['END-07', 'Three of a Kind, loss 5x', 'tr_any_equal_equal', 250_000_000, { loss: [5, 'x'] }],
        ['END-07', 'Classic, loss $5', 'red_higher_outside_heart', 1_000_000, { loss: [5, 'cash'] }],
        ['END-08', 'Classic, single win 5x', 'red_higher_inside_heart', 1_000_000, { win: [5, 'x'] }],
        ['END-08', 'Three of a Kind, single win 100x', 'tr_any_equal_equal', 250_000_000, { win: [100, 'x'] }],
      ];
      for (const [id, label, mode, chip, lim] of cases) {
        const page = await t.game(url);
        const rec = t.recorder(page);
        await setMode(page, mode);
        await setBetChip(page, chip);
        await setTurbo(page, 1);
        await startAutoplay(page, { rounds: 'inf', fullWinStop: false, loss: lim.loss || null, win: lim.win || null });
        const ended = await waitAutoplay(page, 200 * 3000);
        if (!ended) { await page.locator('.cb-spin').click({ force: true }); await sleep(5000); }
        const plays = rec.log.filter(x => x.path.endsWith('/wallet/play') && x.res?.round);
        let net = 0, expected = null;
        plays.forEach((p, i) => {
          const base = p.req.amount; const cost = p.res.round.costMultiplier || (/^tr_/.test(p.req.mode) ? 250 : 1);
          const won = Math.round(p.res.round.payoutMultiplier * base);
          net += won - cost * base;
          if (expected !== null) return;
          if (lim.loss && (lim.loss[1] === 'x' ? -net >= lim.loss[0] * base : -net >= lim.loss[0] * 1e6)) expected = i;
          if (lim.win && (lim.win[1] === 'x' ? won >= lim.win[0] * base : won >= lim.win[0] * 1e6)) expected = i;
        });
        const stakes = new Set(plays.map(p => p.req.amount));
        t.expect(id, ended && expected === plays.length - 1 && stakes.size === 1, `${label}: stopped ${ended ? 'by itself' : 'NOT AT ALL'} after ${plays.length} rounds; the limit was reached on round ${expected === null ? 'never' : expected + 1}; net ${(net / 1e6).toFixed(2)}; stake ${stakes.size === 1 ? 'never changed' : 'CHANGED'}`);
        await page.close();
      }
    },
  },

  {
    name: 'autoplay-runs-dry',
    covers: ['END-06'],
    est: 90,
    async run(t) {
      const url = await t.session({ balance: 3_000_000 });
      const page = await t.game(url);
      const rec = t.recorder(page);
      await setMode(page, 'red_higher_outside_heart');
      await setBetChip(page, 1_000_000);
      await setTurbo(page, 1);
      await startAutoplay(page, { rounds: 'inf' });
      const ended = await waitAutoplay(page, 200 * 3000);
      await sleep(1500);
      const op = await operatorBalance(page);
      const b = await board(page);
      const plays = rec.log.filter(x => x.path.endsWith('/wallet/play'));
      const bad = plays.filter(p => p.status !== 200).map(p => `${p.status} ${p.res?.error || ''}`);
      const spin = await page.evaluate(() => ({ blocked: document.querySelector('.cb-spin')?.classList.contains('blocked'), tip: document.querySelector('.cb-cooldown-tip')?.textContent.trim() }));
      const d = await errorDialog(page);
      t.expect('END-06', ended && op < 1_000_000 && Math.abs(toMicro(b.balance) - op) < 5000 && !bad.length && !d, `${plays.length} rounds, then stopped ${ended ? 'by itself' : 'NOT'} with ${b.balance} left (operator ${op}); ${bad.length ? `refused: ${bad.join(', ')}` : 'no refused bet'}; spin ${spin.blocked ? `blocked ("${spin.tip}")` : 'live'}${d ? `; dialog "${d.title}"` : ''}`);
    },
  },
];
