// 01 · Session and launch (and the network/font health a cold launch shows).
import {
  recorder, watchHealth, waitForIntro, dismissIntro, closePopups, board, betChips, authOf, toMicro,
  setMode, playRound, errorDialog, dealUntil, settle, sleep, setBetChip,
} from '../lib/game.mjs';
import { withParams, CDN } from '../lib/studio.mjs';

const PANELS = ['.cb-info', '.cb-autospin', '.cb-mode-btn', '.cb-sound', '.cb-lastwin-btn', '.cb-bet-display', '.cb-turbo'];
const OWN_ORIGINS = /^https:\/\/(takeovercasino\.live\.engine\.io|rgsd\.engine\.io)$/;

export default [
  {
    name: 'cold-launch',
    covers: ['SES-01', 'SES-02', 'PRF-04', 'REG-02'],
    est: 70,
    async run(t) {
      // Every digit significant: a x100 or x1,000,000 slip cannot hide in it.
      const BAL = 987_654_320_000;
      const url = await t.session({ balance: BAL });
      const page = await t.page();
      const rec = t.recorder(page), health = watchHealth(page);
      const t0 = Date.now();
      await t.goto(page, withParams(url, { device: 'desktop' }), { intro: false });
      const introMs = await waitForIntro(page).then(() => Date.now() - t0, () => -1);
      const auth = authOf(rec);
      t.expect('SES-01', auth?.status === 200, `authenticate ${auth?.status ?? 'never sent'}`);
      t.expect('SES-01', introMs > 0, introMs > 0 ? `loader cleared to the start screen in ${(introMs / 1000).toFixed(1)}s` : 'the start screen never appeared');
      await dismissIntro(page);
      const b = await board(page);
      const rgsBal = auth?.res?.balance;
      t.expect('SES-02', rgsBal === BAL && toMicro(b.balance) === BAL, `RGS ${rgsBal} micro, board "${b.balance}"`);
      const cfg = auth?.res?.config || {};
      const chips = await betChips(page); await closePopups(page);
      const levels = (cfg.betLevels || []).map(Number);
      const chipMicros = chips.map(c => c.micro);
      const sameLadder = levels.length ? JSON.stringify(levels) === JSON.stringify(chipMicros) : (chipMicros[0] === cfg.minBet && chipMicros.at(-1) === cfg.maxBet);
      t.expect('SES-01', sameLadder && /^\$/.test(b.bet), `bet ${b.bet}; ${chips.length} chips ${chips[0]?.label}..${chips.at(-1)?.label} vs RGS min ${cfg.minBet} max ${cfg.maxBet} (${levels.length} levels)`);

      const fonts = await page.evaluate(async () => {
        await document.fonts.ready;
        const s = {}; for (const f of document.fonts) { const k = f.family.replace(/"/g, '') + ':' + f.status; s[k] = (s[k] || 0) + 1; }
        return { s, overpass: document.fonts.check('16px Overpass'), body: getComputedStyle(document.querySelector('.cb-balance') || document.body).fontFamily.split(',')[0] };
      });
      const errored = Object.keys(fonts.s).filter(k => k.endsWith(':error'));
      t.expect('REG-02', !errored.length && fonts.overpass && /Overpass/.test(fonts.body), `faces ${JSON.stringify(fonts.s)}, body ${fonts.body}`);

      // PRF-04: two rounds and every panel on top of the launch.
      await setMode(page, 'red_higher_outside_heart');
      for (let i = 0; i < 2; i++) await playRound(page);
      const opened = [];
      for (const sel of PANELS) { await page.locator(sel).first().click({ force: true }).catch(() => {}); await sleep(450); opened.push(await page.locator('.popup').count()); await closePopups(page); }
      await sleep(1000);
      const foreign = Object.keys(health.origins).filter(o => /^https?:/.test(o) && !OWN_ORIGINS.test(o));
      const leak = health.all.filter(c => /payoutMultiplier|sessionID|wallet\/(play|end-round)|"state"\s*:/i.test(c));
      t.expect('PRF-04', !foreign.length, foreign.length ? `foreign origins: ${foreign.join(' ')}` : `only ${Object.entries(health.origins).map(([o, n]) => `${o.replace('https://', '')} x${n}`).join(', ')}`);
      t.expect('PRF-04', !health.bad.length, health.bad.length ? `bad responses: ${health.bad.slice(0, 4).join(' / ')}` : 'no 4xx/5xx or failed request');
      t.expect('PRF-04', !health.console.length && !health.pageErrors.length, health.console.length + health.pageErrors.length ? `console: ${[...health.console, ...health.pageErrors].slice(0, 3).join(' / ')}` : `console clean (${health.all.length} lines in all)`);
      t.expect('PRF-04', !leak.length, leak.length ? `game data logged: ${leak[0]}` : 'no game data logged');
      t.expect('PRF-04', opened.every(n => n === 1), `panels opened ${opened.join('')} of ${PANELS.length}`);
      t.expect('REG-02', !health.console.some(c => /font/i.test(c)), 'no font errors in the console');
    },
  },

  {
    name: 'loader-and-index-path',
    covers: ['SES-06', 'SES-08'],
    est: 40,
    async run(t) {
      const ctx = await t.context();
      const html = await (await ctx.request.get(`${CDN}/v${t.cfg.front}/index.html`)).text();
      const n = (re) => (html.match(re) || []).length;
      const sdk = { '#041721 (the SDK loader background)': n(/#041721/gi), 'LoaderStakeEngine': n(/LoaderStakeEngine|stake-engine-loader|stakeEngineLoader/gi), 'loader media asset': n(/loader[^"']{0,40}\.(json|webm|mp4|gif)/gi) };
      const hits = Object.entries(sdk).filter(([, v]) => v);
      t.expect('SES-06', !hits.length, hits.length ? `SDK loader markup found: ${hits.map(([k, v]) => `${k} x${v}`).join(', ')}` : `no SDK loader markup in ${html.length} bytes`);

      const url = await t.session({ shared: true });
      const page = await ctx.newPage();
      const health = watchHealth(page);
      const seen = [];
      const target = withParams(url, {}).replace(/\/(v\d+)\/\?/, '/$1/index.html?');
      // Sampled until the start screen is up, not for a fixed count: t.goto first
      // waits for its authenticate slot in the gate (up to --auth-gap), and a
      // fixed 6 s of samples ran out on about:blank before the page ever loaded.
      let loaded = false;
      const stopAt = Date.now() + 90_000;
      const poll = (async () => { while (!loaded && Date.now() < stopAt) { try { seen.push(await page.evaluate(() => [document.querySelector('[aria-label^="Loading"], .rtb-loader, .game-loader') ? 'own-loader' : '', document.querySelector('.ss-continue') ? 'intro' : ''].filter(Boolean).join('+') || 'blank')); } catch {} await sleep(150); } })();
      await t.goto(page, target, { intro: false });
      const intro = await waitForIntro(page).then(() => true, () => false);
      await sleep(300); loaded = true;
      await poll;
      t.expect('SES-06', seen.includes('own-loader') || seen.includes('intro'), `load sequence: ${[...new Set(seen)].join(' -> ')}`);
      await dismissIntro(page).catch(() => {});
      const b = await board(page);
      const notFound = [...health.console, ...health.pageErrors].filter(c => /not found/i.test(c));
      t.expect('SES-08', intro && b.slots >= 3 && !notFound.length, `${target.split('?')[0].replace(/^https:\/\/[^/]+/, '')}: start screen ${intro ? 'up' : 'MISSING'}, ${b.slots} card slots, balance "${b.balance}"${notFound.length ? `, console: ${notFound[0]}` : ', no "Not found"'}`);
    },
  },

  {
    name: 'invalid-rgs-url',
    covers: ['SES-05'],
    est: 35,
    async run(t) {
      const url = await t.session({ shared: true });
      for (const [label, host] of [['a host that does not answer', 'rgs.invalid.example'], ['a host that answers with garbage', 'example.com']]) {
        const page = await t.page();
        const t0 = Date.now();
        page.goto(withParams(url, { rgs_url: host })).catch(() => {});
        let d = null, at = 0;
        while (Date.now() - t0 < 12_000) { await sleep(500); d = await errorDialog(page).catch(() => null); if (d && d.visible && d.onTop) { at = Date.now() - t0; break; } }
        await t.shot(page, `ses05-${host}`);
        const readable = d && d.title && !/\[object|undefined|TypeError|at .*\.js|stack/i.test(`${d.title} ${d.detail || ''}`);
        t.expect('SES-05', d && at && d.onTop && readable && d.buttons.some(b => /reload/i.test(b)), d ? `${label}: "${d.title}"${d.detail ? ` / ${d.detail}` : ''}, buttons [${d.buttons.join(', ')}], on top after ${(at / 1000).toFixed(1)}s` : `${label}: no error dialog on top within 12s`);
      }
    },
  },

  {
    name: 'forged-requests',
    covers: ['SES-07', 'SES-03', 'BET-05'],
    est: 60,
    async run(t) {
      const url = await t.session();
      for (const kind of ['session', 'amount']) {
        const page = await t.page();
        const seen = [];
        await page.route(/\/wallet\/play/, async (route) => {
          try {
            const body = JSON.parse(route.request().postData() || '{}');
            if (kind === 'session') body.sessionID = 'forged-session-for-ses07'; else body.amount = 1_234_567;
            const resp = await route.fetch({ postData: JSON.stringify(body) });
            let txt = ''; try { txt = await resp.text(); } catch {}
            seen.push({ status: resp.status(), body: txt.replace(/sessionID[^,}]*/gi, '').slice(0, 160) });
            await route.fulfill({ response: resp, body: txt });
          } catch { await route.continue().catch(() => {}); }
        });
        await t.game(url, { page });
        await setMode(page, 'red_higher_outside_heart');
        const before = (await board(page)).balance;
        await page.locator('.cb-spin').click({ force: true });
        let d = null; for (let i = 0; i < 20 && !d; i++) { await sleep(400); d = await errorDialog(page); }
        await t.shot(page, `forged-${kind}`);
        const rgs = seen[0] ? `RGS ${seen[0].status} ${seen[0].body || '(no body)'}` : 'no play request';
        if (kind === 'session') {
          const ok = d && d.onTop && /something went wrong/i.test(d.title) && d.buttons.length === 2 && d.buttons.some(b => /reload/i.test(b)) && d.buttons.some(b => /close/i.test(b));
          t.expect('SES-07', ok, d ? `${rgs}; dialog "${d.title}" [${d.buttons.join(', ')}], on top ${d.onTop}` : `${rgs}; no dialog`);
          t.sim('SES-03', ok, `forged token: ${d ? `"${d.title}" with [${d.buttons.join(', ')}]` : 'no dialog'} (a genuine ERR_IS lapse is still the owner's)`);
        } else {
          const ok = d && /rejected/i.test(d.title) && d.buttons.length === 1;
          t.expect('BET-05', ok, d ? `${rgs}; dialog "${d.title}" [${d.buttons.join(', ')}]` : `${rgs}; no dialog`);
          if (d) await page.locator('.err-actions button').first().click({ force: true });
          await sleep(1200);
          await page.unroute(/\/wallet\/play/);
          const after = await board(page);
          t.expect('BET-05', after.balance === before && !(await errorDialog(page)), `balance ${before} -> ${after.balance}, dialog ${await errorDialog(page) ? 'still up' : 'gone'}`);
          const r = await playRound(page);
          const play = r.rgs.find(x => x.path.endsWith('/wallet/play'));
          t.expect('BET-05', play?.status === 200, `the next real round: /wallet/play ${play?.status}`);
        }
        await page.close();
      }
    },
  },

  {
    name: 'reload-mid-round',
    covers: ['SES-04', 'BET-11'],
    est: 150,
    timeout: 300_000,
    async run(t) {
      const url = await t.session({ balance: 500_000_000_000 });
      for (const [mode, chip, label] of [['red_higher_outside_heart', 50_000, 'Classic at $0.05'], ['tr_any_equal_equal', 2_500_000, 'Three of a Kind at $0.01 x 250']]) {
        const page = await t.game(url);
        await setMode(page, mode);
        await setBetChip(page, chip);
        const hit = await dealUntil(page, (p) => p?.round?.payoutMultiplier > 0, { max: mode.startsWith('tr_') ? 70 : 12 });
        if (!hit) { t.fail('SES-04', `${label}: no paying round to interrupt`); continue; }
        const staked = hit.play.round.amount;
        const rec = t.recorder(page);
        await sleep(400);
        await t.reload(page, { intro: false });
        await dismissIntro(page).catch(() => {});
        const betTrail = [];
        for (let i = 0; i < 60 && !rec.ends().length; i++) { betTrail.push((await board(page)).bet); await sleep(500); if (await page.locator('.wc-overlay').count()) await page.locator('.wc-overlay').click({ force: true }).catch(() => {}); }
        await settle(page);
        const after = await board(page);
        const resumedBet = after; // nothing has been touched since the reload
        const auth = authOf(rec);
        const ends = rec.ends();
        const final = ends.at(-1)?.res?.balance;
        const d = await errorDialog(page);
        t.expect('SES-04', auth?.res?.round?.active && ends.length === 1 && ends[0].status === 200, `${label}: authenticate returned the active round (pm ${hit.play.round.payoutMultiplier}), end-round ${ends.map(e => e.status).join(',') || 'never sent'}`);
        t.expect('SES-04', final != null && toMicro(after.balance) === final && !d, `${label}: board ${after.balance} vs RGS ${final}${d ? `, dialog "${d.title}"` : ', no dialog'}`);
        if (mode.startsWith('tr_')) t.expect('SES-04', after.slots === 3 && /× 250|x 250/.test(after.betBase || ''), `${label}: came back on its own family - ${after.slots} slots, "${after.betBase}"`);
        const shownBase = mode.startsWith('tr_') ? toMicro(resumedBet.betBase) : toMicro(resumedBet.bet);
        t.expect('BET-11', shownBase === staked, `${label}: staked ${staked} micro, the bet display read "${resumedBet.bet}${resumedBet.betBase ? ' / ' + resumedBet.betBase : ''}" before anything was touched (from the reload on: ${[...new Set(betTrail)].join(' > ')})`);
        rec.stop();
        await page.close();
      }
    },
  },
];
