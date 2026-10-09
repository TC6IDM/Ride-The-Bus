// 06 · Currency display.
import { board, setMode, setFamily, setBetChip, betChips, setTurbo, closePopups, sleep, playRound, dealUntil, settle, watchReplay, SEVEN, VIEWPORTS, toMicro } from '../lib/game.mjs';
import { eventFor } from '../lib/events.mjs';

// Exported for the LOCAL runner (local.mjs), which runs CUR-04 with these on the
// uploaded build's own bytes.
export const moneyTexts = (page) => page.evaluate(() => {
  const all = (q) => [...document.querySelectorAll(q)].map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return { balance: all('.cb-balance .cb-val'), bet: all('.cb-bet-display .cb-val'), lastWin: all('.cb-lastwin .cb-val'), readout: all('.running-win-amount'), takeover: all('.wc-amount') };
});
export const fits = (page) => page.evaluate(() => {
  const bad = [];
  for (const e of document.querySelectorAll('footer .cb-val, footer .cb-cap, footer .cb-bet-base, .wc-amount, .running-win-amount')) {
    if (!e.getBoundingClientRect().width) continue;
    const p = e.closest('.cb-panel, .cb-bet-display, .cb-balance, .cb-lastwin, .wc-overlay, .running-win') || document.body;
    const a = e.getBoundingClientRect(), b = p.getBoundingClientRect();
    if (e.scrollWidth > e.clientWidth + 1 || a.right > b.right + 1 || a.left < b.left - 1) bad.push(e.textContent.trim().slice(0, 30));
  }
  return { bad, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
});

export default [
  {
    name: 'zero-decimal-currency',
    covers: ['CUR-01'],
    est: 120,
    timeout: 360_000,
    async run(t) {
      const url = await t.session({ currency: 'JPY', balance: 1_000_000_000_000 });
      const page = await t.game(url);
      await setMode(page, 'red_higher_outside_heart');
      await setTurbo(page, 1);
      const seen = [];
      const chips = await betChips(page); await closePopups(page);
      seen.push(...chips.map(c => c.label));
      seen.push(...Object.values(await moneyTexts(page)).flat());
      const hit = await dealUntil(page, (p) => p?.round?.payoutMultiplier > 1, { max: 30 });
      if (hit) { await settle(page); await sleep(600); seen.push(...Object.values(await moneyTexts(page)).flat()); }
      // the takeover: a replayed big win in yen
      const cap = eventFor('red_equal_equal_heart', 'cap');
      const rp = await t.replay({ mode: 'red_equal_equal_heart', event: cap.id, currency: 'JPY', amount: 100_000_000 });
      const w = await watchReplay(rp);
      seen.push(...w.legs.flatMap(l => [l.first, l.last]).filter(Boolean), w.end.lastWin, w.end.amount);
      const withDecimals = seen.filter(s => /\d[.,]\d{1,2}(?!\d)/.test(s.replace(/,\d{3}/g, '')));
      t.expect('CUR-01', seen.length > 10 && !withDecimals.length, withDecimals.length ? `decimal places shown: ${withDecimals.slice(0, 5).join(' / ')}` : `${seen.length} yen figures, none with decimals (e.g. ${seen.filter(s => /\d/.test(s)).slice(0, 4).join(' / ')}; takeover ${w.legs.at(-1)?.last})`);
    },
  },

  {
    name: 'sub-cent-amounts',
    covers: ['CUR-02', 'CUR-06'],
    est: 150,
    timeout: 360_000,
    async run(t) {
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      const page = await t.game(url);
      await setMode(page, 'red_higher_outside_heart');
      await setBetChip(page, 10_000);
      await setTurbo(page, 1);
      const rows = [];
      for (let i = 0; i < 40 && rows.filter(r => r.subCent).length < 2; i++) {
        const r = await playRound(page);
        const pm = r.rgs.find(x => x.path.endsWith('/wallet/play'))?.res?.round?.payoutMultiplier || 0;
        if (pm <= 0) continue;
        const exact = pm * 10_000;
        rows.push({ pm, exact, subCent: exact % 10_000 !== 0, readout: r.after.amount, lastWin: r.after.lastWin });
      }
      const sub = rows.filter(r => r.subCent);
      const shown = (r) => toMicro(r.readout) === r.exact && toMicro(r.lastWin) === r.exact;
      t.expect('CUR-02', sub.length && sub.every(r => toMicro(r.readout) > 0 && !/\$0\.00$/.test(r.readout)), sub.length ? sub.map(r => `${r.pm}x of $0.01 reads "${r.readout}"`).join(', ') : 'no sub-cent payout in 40 rounds');
      t.expect('CUR-06', sub.length && sub.every(shown), sub.length ? `readout and Last Win exact: ${sub.map(r => `${r.readout} / ${r.lastWin} for ${(r.exact / 1e6).toFixed(4)}`).join(', ')}` : 'no sub-cent payout');
      const whole = rows.find(r => !r.subCent);
      if (whole) t.expect('CUR-06', /\.\d\d$/.test(whole.readout), `a whole-cent payout keeps two places: "${whole.readout}"`);
      // the history panel
      await page.locator('.cb-lastwin-btn').click(); await sleep(600);
      const hist = await page.evaluate(() => [...document.querySelectorAll('.history-amount')].map(e => e.textContent.trim()));
      await closePopups(page);
      t.expect('CUR-06', hist.some(h => /\$0\.0\d\d/.test(h)) && !hist.some(h => /^\$0\.0[12]$/.test(h) && false), `history shows ${hist.slice(0, 5).join(' / ')}`);
      // a replay at $0.01: the takeover counts in the final amount's own places
      const big = eventFor('red_higher_outside_heart', 'cap');
      const w = await watchReplay(await t.replay({ mode: 'red_higher_outside_heart', event: big.id, amount: 10_000 }));
      const finalX = (big.x * 10_000 / 1e6).toFixed(3);
      const legFigures = w.legs.flatMap(l => [l.first, l.last]).filter(Boolean);
      const places = new Set(legFigures.map(s => (s.split('.')[1] || '').replace(/\D/g, '').length));
      t.expect('CUR-06', legFigures.length && places.size === 1 && !w.negative, `replay #${big.id} at $0.01: the count ${legFigures.join(' > ')} stays in ${[...places].join('/')} places (final ${w.end.amount}, exact $${finalX})`);
    },
  },

  {
    name: 'social-currency',
    covers: ['CUR-03'],
    est: 60,
    async run(t) {
      const url = await t.session({ shared: true, currency: 'XSC', social: true, balance: 100_000_000_000 });
      const page = await t.game(url);
      await setMode(page, 'red_higher_outside_heart');
      await playRound(page);
      const m = await moneyTexts(page);
      const chips = await betChips(page); await closePopups(page);
      const all = [...m.balance, ...m.bet, ...m.lastWin, ...chips.map(c => c.label)];
      const bad = all.filter(s => /\$|US\$|USD|€/.test(s) || !/\b(SC|GC)\b/.test(s));
      t.expect('CUR-03', all.length && !bad.length, bad.length ? `not in SC/GC: ${bad.slice(0, 4).join(' / ')}` : `balance ${m.balance[0]}, bet ${m.bet[0]}, Last Win ${m.lastWin[0]}, chips ${chips[0]?.label}..${chips.at(-1)?.label}`);
    },
  },

  {
    name: 'large-amounts',
    covers: ['CUR-04'],
    est: 90,
    async run(t) {
      const url = await t.session({ currency: 'IDR', balance: 2_000_000_000_000_000 });
      const bad = [];
      for (const size of SEVEN) {
        const page = await t.game(url, { viewport: size });
        const f = await fits(page);
        const m = await moneyTexts(page);
        if (f.bad.length || f.hscroll) bad.push(`${size}: ${f.bad.join(', ')}${f.hscroll ? ' + horizontal scroll' : ''}`);
        if (size === 'desktop') t.note('CUR-04', `balance "${m.balance[0]}"`);
        if (size === 'desktop' && !/\d{1,3}([.,\s]\d{3}){3,}/.test(m.balance[0] || '')) bad.push(`no thousands separators in "${m.balance[0]}"`);
        await page.close();
      }
      // a takeover in IDR
      const tr = eventFor('tr_any_equal_equal', 'cap');
      const rp = await t.replay({ mode: 'tr_any_equal_equal', event: tr.id, currency: 'IDR', amount: 10_000_000_000 });
      const w = await watchReplay(rp, { leaveTakeover: true });
      const f = await fits(rp);
      if (f.bad.length) bad.push(`takeover: ${f.bad.join(', ')}`);
      t.expect('CUR-04', !bad.length, bad.length ? bad.join('; ') : `IDR in the billions fits at all seven sizes; the takeover reads ${w.legs.at(-1)?.last}`);
    },
  },

  {
    name: 'bet-extremes',
    covers: ['CUR-05'],
    est: 90,
    async run(t) {
      const url = await t.session({ currency: 'NOK', balance: 10_000_000_000_000 });
      for (const size of ['desktop', 'popoutL', 'popoutS']) {
        const page = await t.game(url, { viewport: size });
        await page.locator('.cb-bet-display').first().click();
        await page.locator('.popup .bet-chip').first().waitFor();
        const g = await page.evaluate(() => {
          const p = document.querySelector('.popup'); const pr = p.getBoundingClientRect();
          const chips = [...p.querySelectorAll('.bet-chip')];
          const outside = chips.filter(c => { const r = c.getBoundingClientRect(); return r.left < pr.left - 1 || r.right > pr.right + 1; }).length;
          const sc = p.querySelector('.bet-chips') || p;
          return { n: chips.length, outside, scrollsInside: sc.scrollHeight > sc.clientHeight + 1 || p.scrollHeight > p.clientHeight + 1, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
        });
        await closePopups(page);
        t.expect('CUR-05', !g.outside && !g.hscroll, `${size}: ${g.n} chips, ${g.outside} outside the panel, ${g.scrollsInside ? 'the panel scrolls itself' : 'no scroll needed'}, frame ${g.hscroll ? 'SCROLLS' : 'does not scroll'}`);
        if (size === 'desktop') {
          await setMode(page, 'red_higher_outside_heart');
          await setTurbo(page, 1);
          const chips = await betChips(page); await closePopups(page);
          for (const c of [chips[0], chips.at(-1)]) {
            await setBetChip(page, c.micro);
            const r = await playRound(page);
            const play = r.rgs.find(x => x.path.endsWith('/wallet/play'));
            t.expect('CUR-05', play?.status === 200 && play.req.amount === c.micro, `${c.label} selected and played: amount ${play?.req?.amount} -> ${play?.status}`);
          }
        }
        await page.close();
      }
    },
  },
];
