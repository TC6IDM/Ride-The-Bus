// 02 · Bets and limits.
import {
  recorder, closePopups, board, betChips, setBetChip, authOf, toMicro, setMode, setFamily, setPicks,
  playRound, checkRound, dealUntil, settle, sleep, errorDialog, currentFamily, dismissIntro, FAMILY_PREFIX,
  startAutoplay, autoRunning,
} from '../lib/game.mjs';
import { STUDIO } from '../lib/studio.mjs';

const plays = (rec) => rec.reqs.filter(r => r.path.endsWith('/wallet/play')).length;
const tipText = (page) => page.evaluate(() => { const e = document.querySelector('.cb-cooldown-tip'); return e ? { text: e.textContent.replace(/\s+/g, ' ').trim(), shown: e.classList.contains('is-shown') } : null; });

export default [
  {
    name: 'bet-ladder',
    covers: ['BET-01', 'BET-17'],
    est: 60,
    async run(t) {
      const url = await t.session({ shared: true });
      const page = await t.page();
      const rec = t.recorder(page);
      await t.game(url, { page });
      const cfg = authOf(rec)?.res?.config || {};
      const levels = (cfg.betLevels || []).map(Number);
      const chips = await betChips(page); await closePopups(page);
      t.expect('BET-01', JSON.stringify(chips.map(c => c.micro)) === JSON.stringify(levels), `the menu offers ${chips.length} chips, the RGS ${levels.length} levels (${cfg.minBet}..${cfg.maxBet}, step ${cfg.stepBet})`);
      t.expect('BET-01', levels.every(l => l >= cfg.minBet && l <= cfg.maxBet && (l - cfg.minBet) % cfg.stepBet === 0), 'every level sits on min + n x step, inside min..max');
      await setBetChip(page, levels[0]);
      const dec = page.locator('.cb-step').nth(1), inc = page.locator('.cb-step').nth(0);
      t.expect('BET-01', await dec.isDisabled(), `at the minimum (${(await board(page)).bet}) minus is ${await dec.isDisabled() ? 'grey' : 'LIVE'}`);
      const seen = [toMicro((await board(page)).bet)];
      for (let i = 0; i < levels.length + 2 && !(await inc.isDisabled()); i++) { await inc.click(); await sleep(60); seen.push(toMicro((await board(page)).bet)); }
      t.expect('BET-01', JSON.stringify(seen) === JSON.stringify(levels) && await inc.isDisabled(), `plus walks ${seen.length} levels to ${(await board(page)).bet} and greys at the top`);
      // BET-17: a typed amount under the minimum stays as typed and blocks the deal.
      await setMode(page, 'red_higher_outside_heart');
      await page.locator('.cb-bet-display').first().click();
      const input = page.locator('.popup .bet-entry-input');
      await input.fill(''); await input.type('0.004'); await input.press('Enter'); await sleep(500);
      await closePopups(page);
      const shown = (await board(page)).bet;
      const n0 = plays(rec);
      await page.locator('.cb-spin').click({ force: true }); await sleep(500);
      const tip = await tipText(page);
      await sleep(1200);
      t.expect('BET-17', /0\.004/.test(shown) && plays(rec) === n0 && tip?.shown && /minimum/i.test(tip.text), `typed 0.004: bet reads "${shown}", tip "${tip?.text}" (${tip?.shown ? 'shown' : 'hidden'}), ${plays(rec) - n0} play requests`);
    },
  },

  {
    name: 'insufficient-balance',
    covers: ['BET-02'],
    est: 40,
    async run(t) {
      const url = await t.session({ balance: 3_000_000 });
      const page = await t.page();
      const rec = t.recorder(page);
      await t.game(url, { page });
      await setMode(page, 'red_higher_outside_heart');
      await setBetChip(page, 5_000_000);
      const n0 = plays(rec);
      await page.locator('.cb-spin').click({ force: true }); await sleep(500);
      const blocked = await page.evaluate(() => document.querySelector('.cb-spin')?.classList.contains('blocked'));
      const tip = await tipText(page);
      await sleep(1200);
      const d = await errorDialog(page);
      t.expect('BET-02', blocked && plays(rec) === n0 && tip?.shown && /insufficient|balance|funds/i.test(tip.text), `$5 bet on a $3 balance: spin ${blocked ? 'blocked' : 'LIVE'}, tip "${tip?.text}", ${plays(rec) - n0} play requests${d ? `, dialog "${d.title}"` : ''}`);
    },
  },

  {
    name: 'equal-then-inside',
    covers: ['BET-03'],
    est: 40,
    async run(t) {
      const url = await t.session({ shared: true });
      for (const touch of [false, true]) {
        const page = await t.game(url, { viewport: touch ? 'mobileM' : 'desktop' });
        await setFamily(page, 'base');
        await page.locator('.hl-square .equal-btn').click(); await sleep(250);
        const inside = page.locator('.io-square .inside-half');
        const state = () => inside.evaluate(b => ({ pressed: b.getAttribute('aria-pressed'), disabled: b.getAttribute('aria-disabled') === 'true' || b.disabled, struck: b.classList.contains('is-unavailable') || b.classList.contains('unavailable') || getComputedStyle(b).opacity < 0.9 }));
        const s0 = await state();
        if (touch) await inside.tap({ force: true }).catch(() => {}); else await inside.click({ force: true }).catch(() => {});
        await sleep(250);
        const s1 = await state();
        await inside.focus().catch(() => {}); await page.keyboard.press('Enter'); await sleep(250);
        const s2 = await state();
        let tip = '';
        if (!touch) { await inside.hover({ force: true }).catch(() => {}); await sleep(900); tip = await page.evaluate(() => [...document.querySelectorAll('[role=tooltip], .choice-tip')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' / ')); }
        t.expect('BET-03', s0.disabled && s1.pressed !== 'true' && s2.pressed !== 'true' && (touch || tip), `${touch ? 'touch' : 'mouse'}: Inside after Equal is ${s0.disabled ? 'unavailable' : 'AVAILABLE'}${s0.struck ? ' and dimmed' : ''}; ${touch ? 'tap' : 'click'} -> pressed ${s1.pressed}, Enter -> ${s2.pressed}${touch ? '' : `; hover says "${tip}"`}`);
      }
    },
  },

  {
    name: 'mode-space',
    covers: ['BET-04', 'BET-06', 'BET-07'],
    est: 90,
    async run(t) {
      const url = await t.session({ balance: 100_000_000_000 });
      const page = await t.game(url);
      const modes = ['red_higher_outside_heart', 'black_equal_outside_club', 'sc_red_lower_equal_diamond', 'hs_black_equal_equal_spade', 'ls_red_higher_inside_heart', 'tr_any_equal_equal'];
      for (const mode of modes) {
        await setMode(page, mode);
        const b = await board(page);
        const r = await playRound(page);
        const c = checkRound(r);
        const sent = r.rgs.find(x => x.path.endsWith('/wallet/play'));
        const fam = mode.startsWith('tr_') ? 'tr' : (mode.match(/^(sc|hs|ls)_/) || [, 'base'])[1];
        t.expect('BET-06', sent?.req?.mode === mode && sent?.status === 200, `${fam}: sent ${sent?.req?.mode} -> ${sent?.status}`);
        if (fam !== 'tr') {
          t.expect('BET-04', sent?.req?.mode === mode && /^((sc|hs|ls)_)?(red|black)_(higher|lower|equal)_(inside|outside|equal)_(heart|spade|club|diamond)$/.test(sent?.req?.mode || ''), `${mode} lit, ${sent?.req?.mode} sent, ${sent?.status}`);
          t.expect('BET-07', c.debit === c.amt && !b.betBase, `${mode}: debited ${c.debit} for a ${c.amt} bet; bet display "${b.bet}"${b.betBase ? ` + "${b.betBase}"` : ', one figure'}`);
        } else {
          t.expect('BET-06', c.debit === c.amt * 250, `Three of a Kind debited ${c.debit} = 250 x ${c.amt}`);
        }
        t.expect('BET-06', c.ok, `${mode}: ${c.ok ? 'round settled exactly' : c.why}`);
      }
    },
  },

  {
    name: 'second-chance-forgiveness',
    covers: ['BET-09'],
    est: 120,
    timeout: 300_000,
    async run(t) {
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      const page = await t.game(url);
      await setMode(page, 'sc_red_higher_outside_heart');
      // The book marks a miss as correct:false and has no "forgiven" field: a
      // forgiven miss is a false followed by true reveals, and a bust lists the
      // dead cards after it as false too. So the cases are picked by that
      // pattern and judged by the board, which marks bust and forgiven cards.
      const ok = (p) => (p?.round?.state || []).filter(e => e.type === 'reveal').map(e => e.correct !== false);
      const cases = [
        ['card 1 wrong', (p) => ok(p)[0] === false, (b, p) => p.round.payoutMultiplier === 0 && b.busted === 0 && b.forgiven < 0],
        ['a later miss forgiven, then the ride finished', (p) => { const o = ok(p); return o.length === 4 && o[0] && o.slice(1).filter(x => !x).length === 1 && o[3] === true && p.round.payoutMultiplier > 0; }, (b) => b.forgiven > 0 && b.busted < 0 && b.cards.filter(Boolean).length === 4],
        ['two misses', (p) => { const o = ok(p); return o[0] && o.slice(1).filter(x => !x).length >= 2; }, (b) => b.forgiven > 0 && b.busted > b.forgiven],
      ];
      for (const [label, want, check] of cases) {
        const hit = await dealUntil(page, want, { max: 60 });
        if (!hit) { t.fail('BET-09', `${label}: not dealt in 60 rounds`); continue; }
        await settle(page);
        await sleep(600);
        const b = await board(page);
        t.expect('BET-09', check(b, hit.play), `${label} (${hit.tries} deals): book ${ok(hit.play).map(x => (x ? 'ok' : 'X')).join(' ')} -> board busted at card ${b.busted + 1}, forgiven at card ${b.forgiven + 1}, ${b.cards.filter(Boolean).length} cards turned, pays ${hit.play.round.payoutMultiplier}x`);
      }
    },
  },

  {
    name: 'autoplay-locks',
    covers: ['BET-10', 'BET-13'],
    est: 90,
    async run(t) {
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      const page = await t.page();
      const rec = t.recorder(page);
      await t.game(url, { page });
      await setMode(page, 'red_higher_outside_heart');
      await setBetChip(page, 10_000);
      const n0 = plays(rec);
      await page.locator('.cb-autospin').click(); await sleep(600);
      const panelUp = await page.locator('.popup-autospin').count();
      const afterOpen = plays(rec) - n0;
      await closePopups(page);
      await startAutoplay(page, { rounds: 8 });
      let running = false;
      for (let i = 0; i < 20 && !running; i++) { running = await autoRunning(page); if (!running) await sleep(250); }
      t.expect('BET-13', panelUp && afterOpen === 0 && running, `the autoplay button opened its panel (${afterOpen} plays), Start began the run (${running ? 'running' : 'NOT running'})`);
      // BET-10: the mode control during the run.
      const modeBtn = page.locator('.cb-mode-btn');
      const disabled = await modeBtn.evaluate(b => b.disabled || b.classList.contains('blocked') || b.getAttribute('aria-disabled') === 'true');
      await modeBtn.click({ force: true }).catch(() => {}); await sleep(500);
      const pickerOpened = await page.locator('.popup .mode-option').count();
      t.expect('BET-10', disabled && !pickerOpened, `during the run MODE is ${disabled ? 'locked' : 'LIVE'}, the picker ${pickerOpened ? 'OPENED' : 'stayed shut'}`);
      await closePopups(page);
      for (let i = 0; i < 80 && await page.evaluate(() => document.querySelector('.cb-spin')?.classList.contains('stopping')); i++) { if (await page.locator('.wc-overlay').count()) await page.locator('.wc-overlay').click({ force: true }).catch(() => {}); await sleep(500); }
      await settle(page);
      // The spacebar-hold path.
      await page.mouse.click(600, 120);
      const p0 = plays(rec);
      await page.keyboard.down('Space'); await sleep(10_000);
      const held = plays(rec) - p0;
      await page.keyboard.up('Space');
      const p1 = plays(rec); await sleep(6000);
      const after = plays(rec) - p1;
      t.expect('BET-13', held >= 2 && after <= 1, `holding Space 10s played ${held} rounds; after release ${after} more`);
    },
  },

  {
    name: 'mode-confirm',
    covers: ['BET-12'],
    est: 40,
    async run(t) {
      const url = await t.session({ shared: true });
      const page = await t.page();
      const rec = t.recorder(page);
      await t.game(url, { page });
      await setFamily(page, 'base');
      const open = async () => { await closePopups(page); await page.locator('.cb-mode-btn').click(); await page.locator('.popup .mode-option').nth(4).click(); await page.locator('.popup .mode-confirm').waitFor({ timeout: 3000 }); };
      await open();
      const conf = await page.evaluate(() => { const c = document.querySelector('.popup .mode-confirm'); const t = s => c.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim(); return { name: t('.mode-confirm-name'), blurb: t('.mode-confirm-blurb'), cost: t('.mode-confirm-cost'), max: t('.mode-confirm-max'), bolts: !!c.querySelector('.bolt-meter') }; });
      t.expect('BET-12', conf.blurb && /250/.test(conf.cost || '') && /4,583\.3/.test(conf.max || '') && conf.bolts, `Three of a Kind's confirmation: "${conf.name}" / ${conf.cost} / ${conf.max} / blurb ${conf.blurb ? 'yes' : 'NO'} / volatility ${conf.bolts ? 'yes' : 'NO'}`);
      const closers = {
        Cancel: () => page.locator('.popup .mode-confirm-cancel').click(),
        X: () => page.locator('.popup .popup-close').click(),
        Escape: () => page.keyboard.press('Escape'),
        'click away': () => page.locator('.popup-backdrop').click({ position: { x: 5, y: 5 }, force: true }),
      };
      const out = [];
      for (const [name, fn] of Object.entries(closers)) {
        await open(); await fn().catch(() => {}); await sleep(400);
        await closePopups(page);
        out.push(`${name}: ${await currentFamily(page)}`);
      }
      t.expect('BET-12', out.every(s => s.endsWith('base')), `every close path kept Classic - ${out.join(', ')}`);
      const n0 = plays(rec);
      await open(); await page.locator('.popup .mode-confirm-go').click(); await sleep(500);
      const fam = await currentFamily(page);
      t.expect('BET-12', fam === 'tr' && plays(rec) === n0, `Switch -> ${fam}, ${plays(rec) - n0} play requests`);
    },
  },

  {
    name: 'trips-max-base-bet',
    covers: ['BET-14'],
    est: 50,
    async run(t) {
      const url = await t.session({ balance: 300_000_000_000 });
      const page = await t.page();
      const rec0 = t.recorder(page);
      await t.game(url, { page });
      const cfg = authOf(rec0)?.res?.config || {};
      await setFamily(page, 'tr');
      await setBetChip(page, cfg.maxBet * 250);
      const r = await playRound(page);
      const c = checkRound(r);
      const play = r.rgs.find(x => x.path.endsWith('/wallet/play'));
      t.expect('BET-14', play?.status === 200 && play.req.amount === cfg.maxBet && play.req.mode === 'tr_any_equal_equal' && c.debit === cfg.maxBet * 250, `sent amount ${play?.req?.amount} (maxBet ${cfg.maxBet}) mode ${play?.req?.mode} -> ${play?.status}; debited ${c.debit} = 250 x base`);
      t.expect('BET-14', c.ok, c.ok ? 'round settled exactly' : c.why);
    },
  },

  {
    name: 'remembered-picks',
    covers: ['BET-16'],
    est: 120,
    timeout: 300_000,
    async run(t) {
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      const ctx = await t.context();
      const page = await ctx.newPage();
      await t.game(url, { page });
      await setMode(page, 'hs_black_lower_inside_spade');
      await page.locator('.cb-step').first().click(); await sleep(300);
      const pressed = () => page.evaluate(() => [...document.querySelectorAll('.choice-row button[aria-pressed="true"]')].map(b => b.className.match(/(black|red)-half|higher|lower|inside|outside|equal|quad-btn/)?.[0] + (b.closest('.suit-square') ? [...b.parentElement.children].indexOf(b) : '')).join(' '));
      const chosen = { fam: await currentFamily(page), picks: await pressed(), bet: (await board(page)).bet };
      await t.reload(page);
      const back = { fam: await currentFamily(page), picks: await pressed(), bet: (await board(page)).bet };
      t.expect('BET-16', back.fam === 'hs' && back.picks === chosen.picks && back.bet !== chosen.bet, `chose ${chosen.fam} [${chosen.picks}] at ${chosen.bet}; after a reload ${back.fam} [${back.picks}] at ${back.bet} (the amount is never remembered)`);
      // A replay in the same browser shows its own round and does not disturb them.
      const rp = await t.replay({ mode: 'red_higher_outside_heart', event: 2484 }, { page: await ctx.newPage() });
      const details = await rp.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      await rp.close();
      await t.reload(page);
      const afterReplay = { fam: await currentFamily(page), picks: await pressed() };
      t.expect('BET-16', /Classic/.test(details) && /Red Higher Outside Heart/i.test(details) && afterReplay.fam === 'hs' && afterReplay.picks === chosen.picks, `the replay showed its own Classic / Red Higher Outside Heart; the game still ${afterReplay.fam} [${afterReplay.picks}]`);
      // A resumed round beats remembered picks that say otherwise.
      const hit = await dealUntil(page, (p) => p?.round?.payoutMultiplier > 0, { max: 30 });
      if (!hit) { t.fail('BET-16', 'no paying round to resume'); return; }
      await page.evaluate(() => localStorage.setItem('ride-the-bus:picks', JSON.stringify({ v: 1, family: 'base', mode: 'red_higher_outside_heart' })));
      const rec = t.recorder(page);
      await t.reload(page);
      for (let i = 0; i < 60 && !rec.ends().length; i++) { await sleep(500); if (await page.locator('.wc-overlay').count()) await page.locator('.wc-overlay').click({ force: true }).catch(() => {}); }
      await settle(page);
      const resumed = { fam: await currentFamily(page), picks: await pressed() };
      t.expect('BET-16', resumed.fam === 'hs' && resumed.picks === chosen.picks && rec.ends().length === 1, `the round resumed on ${resumed.fam} [${resumed.picks}] over storage saying Classic; end-round ${rec.ends().map(e => e.status).join(',')}`);
    },
  },

  {
    name: 'studio-risk-summary',
    covers: ['BET-15'],
    est: 30,
    async run(t) {
      const ctx = await t.context();
      const page = await ctx.newPage();
      await page.goto(`${STUDIO}/math`);
      await page.waitForFunction(() => /2 Star/i.test(document.body.innerText), null, { timeout: 30_000 }).catch(() => {});
      const text = await page.evaluate(() => document.body.innerText);
      const i = text.search(/2 Star/i);
      const block = i >= 0 ? text.slice(Math.max(0, i - 2500), i + 3500) : '';
      const { writeFileSync } = await import('node:fs');
      writeFileSync(`${t.cfg.outDir}/studio-risk-summary.txt`, block || text.slice(0, 6000));
      const flagged = block.split('\n').filter(l => /fail|exceed|violat|✗|×\s*$/i.test(l));
      t.expect('BET-15', block && !flagged.length, block ? (flagged.length ? `flagged rows: ${flagged.slice(0, 3).join(' / ')}` : 'no flagged row in the risk summary (saved as studio-risk-summary.txt)') : 'the Math page showed no risk summary');
    },
  },
];
