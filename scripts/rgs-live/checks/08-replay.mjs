// 08 · Replay.
import { watchReplay, replayDetails, sleep, board, setMode, setBetChip, setTurbo, dealUntil, settle, errorDialog } from '../lib/game.mjs';
import { eventFor } from '../lib/events.mjs';

const num = (s) => Number(String(s || '').replace(/[^\d.]/g, ''));
const walletCalls = (page) => { const n = { v: 0 }; page.on('request', r => { try { if (/\/wallet\//.test(r.url())) n.v++; } catch {} }); return n; };

export default [
  {
    name: 'replay-renders-the-round',
    covers: ['REP-01', 'REP-02', 'REP-05'],
    est: 90,
    async run(t) {
      // A round from a real session, opened in replay by its own ID.
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      const live = await t.game(url);
      await setMode(live, 'sc_red_higher_outside_heart');
      await setBetChip(live, 1_000_000);
      await setTurbo(live, 1);
      const hit = await dealUntil(live, (p) => p?.round?.payoutMultiplier > 0, { max: 20 });
      await settle(live);
      const played = await board(live);
      const r = hit?.play?.round || {};
      const id = r.id ?? r.betID ?? r.eventId ?? r.event;
      await live.close();
      if (id !== undefined) {
        const page = await t.replay({ mode: r.mode, event: id });
        const d = await replayDetails(page);
        const w = await watchReplay(page);
        const same = JSON.stringify(w.end.cards) === JSON.stringify(played.cards) && w.book?.payoutMultiplier === r.payoutMultiplier && JSON.stringify(w.end.chips) === JSON.stringify(played.chips);
        t.expect('REP-01', same, `live round ${r.mode} (${r.payoutMultiplier}x, id ${id}) replayed: cards ${same ? 'identical' : `DIFFER (${played.cards.join(', ')} vs ${w.end.cards.join(', ')})`}, chips ${w.end.chips.join(' ')}`);
        t.note('REP-05', `details: ${JSON.stringify(d?.rows)}`);
      } else t.note('REP-01', 'the play response carries no round id to replay; checked on published IDs only');
      // Published IDs: the board against the book.
      for (const [mode, sc] of [['red_higher_outside_heart', 'cap'], ['hs_red_higher_inside_heart', 'cap'], ['sc_red_higher_outside_heart', 'forgiven'], ['ls_red_higher_outside_heart', 't10']]) {
        const ev = eventFor(mode, sc);
        const page = await t.replay({ mode, event: ev.id, amount: 10_000 });
        const d = await replayDetails(page);
        const w = await watchReplay(page);
        const reveals = (w.book?.state || []).filter(e => e.type === 'reveal');
        const cardsOk = reveals.every((e, i) => (w.end.cards[i] || '').includes(e.card.rank === 'A' ? 'Ace' : e.card.rank === 'K' ? 'King' : e.card.rank === 'Q' ? 'Queen' : e.card.rank === 'J' ? 'Jack' : e.card.rank));
        t.expect('REP-01', cardsOk && w.book?.payoutMultiplier === ev.x && num(w.end.mult) === ev.x, `${mode} #${ev.id}: ${reveals.length} cards match the book, payout ${w.end.mult} = ${ev.x}x`);
        if (sc === 'cap') t.expect('REP-02', /\$0\.01$/.test(d?.rows['Play amount'] || ''), `amount=10000 reads "Play amount ${d?.rows['Play amount']}"`);
        if (/^(sc|hs)_/.test(mode)) {
          const fam = d?.rows['Game mode'];
          t.expect('REP-05', /Second Chance|High Stakes/.test(fam || '') && d.choices.length === 4 && !/_/.test(d.text), `${mode}: Game mode "${fam}", guesses [${d?.choices.join(', ')}]${/_/.test(d?.text || '') ? ' - a RAW SLUG is printed' : ''}`);
        }
        await page.close();
      }
    },
  },

  {
    name: 'replay-controls',
    covers: ['REP-03', 'REP-06', 'REP-07'],
    est: 90,
    async run(t) {
      const ev = eventFor('red_higher_outside_heart', 'big');
      for (const viewport of ['desktop', 'popoutS', 'mobileM']) {
        const page = await t.page({ viewport });
        const calls = walletCalls(page);
        await t.replay({ mode: 'red_higher_outside_heart', event: ev.id }, { page });
        const before = await board(page);
        const w = await watchReplay(page);
        // every control there is
        const states = await page.evaluate(() => ['.cb-autospin', '.cb-mode-btn', '.cb-step'].map(s => { const e = document.querySelector(s); return `${s}:${!e ? 'absent' : e.disabled || e.getAttribute('aria-disabled') === 'true' ? 'off' : 'LIVE'}`; }));
        for (const s of ['.cb-autospin', '.cb-mode-btn', '.cb-step', '.cb-bet-display']) await page.locator(s).first().click({ force: true, timeout: 1500 }).catch(() => {});
        await page.keyboard.press('Escape');
        const spin = await page.evaluate(() => { const b = document.querySelector('.cb-spin'); const r = b.getBoundingClientRect(); return { label: b.getAttribute('aria-label'), disabled: b.disabled, onScreen: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth }; });
        const kept = await board(page);
        // Play Again re-runs the same round
        await page.locator('.cb-spin').click({ force: true });
        await sleep(600);
        const restarted = await page.evaluate(() => [...document.querySelectorAll('.card-inner.flipped')].length);
        const w2 = await watchReplay(page).catch(() => null);
        const layout = await page.evaluate(() => {
          const f = document.querySelector('footer'); const kids = [...f.children].filter(c => c.getBoundingClientRect().width > 0);
          const cs = kids.map(c => { const r = c.getBoundingClientRect(); return (r.top + r.bottom) / 2; }).sort((a, b) => a - b); let rows = 0, last = -1e9; for (const c of cs) { if (c - last > 14) rows++; last = c; }
          return { rows, scroll: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1 };
        });
        await t.shot(page, `replay-${viewport}`);
        if (viewport === 'desktop') {
          t.expect('REP-03', calls.v === 0 && kept.balance === before.balance && !states.some(s => s.endsWith('LIVE')), `${calls.v} /wallet calls across the replay, every control pressed and Play Again; ${states.join(' ')}; balance ${kept.balance === before.balance ? 'never moved' : 'MOVED'}`);
          t.expect('REP-06', /play again/i.test(spin.label) && !spin.disabled && kept.amount === w.end.amount && w2 && w2.end.mult === w.end.mult, `finished: "${spin.label}" ${spin.disabled ? 'DISABLED' : 'enabled'}, the result (${kept.label} ${kept.amount}) stayed; Play Again re-ran the same round (${w2?.end.mult})`);
        }
        if (viewport === 'popoutS') t.expect('REP-07', layout.rows === 1 && !layout.scroll && spin.onScreen && /play again/i.test(spin.label), `400 x 225: bar ${layout.rows} row, frame ${layout.scroll ? 'SCROLLS' : 'still'}, Play Again ${spin.onScreen ? 'on screen' : 'OFF screen'}`);
        if (viewport === 'mobileM') t.expect('REP-06', /play again/i.test(spin.label) && !layout.scroll, `Mobile M: "${spin.label}", frame ${layout.scroll ? 'SCROLLS' : 'still'}`);
        await page.close();
      }
    },
  },

  {
    name: 'replay-currency-and-lang',
    covers: ['REP-04', 'REP-08'],
    est: 90,
    async run(t) {
      const ev = eventFor('red_higher_outside_heart', 'cap');
      for (const [cur, amount, re] of [['JPY', 100_000_000, /^[^.]*$/], ['EUR', 1_000_000, /€|EUR/], ['USD', 2_500_000, /\$2\.50/]]) {
        const page = await t.replay({ mode: 'red_higher_outside_heart', event: ev.id, currency: cur, amount });
        const d = await replayDetails(page);
        const w = await watchReplay(page);
        const figures = [d?.rows['Play amount'], w.end.amount, w.end.lastWin].filter(Boolean);
        const ok = cur === 'JPY' ? figures.every(f => !/\d[.,]\d{1,2}(?!\d)/.test(f.replace(/,\d{3}/g, ''))) : figures.some(f => re.test(f));
        t.expect('REP-04', ok, `${cur}: ${figures.join(' / ')}`);
        await page.close();
      }
      const base = await watchReplay(await t.replay({ mode: 'red_higher_outside_heart', event: ev.id }));
      for (const lang of ['de', 'ar', 'ja']) {
        const page = await t.replay({ mode: 'red_higher_outside_heart', event: ev.id, lang });
        const d = await replayDetails(page);
        const w = await watchReplay(page);
        const english = /Play amount|Game mode|Guesses|Payout/.test(Object.keys(d?.rows || {}).join(' '));
        const dir = await page.evaluate(() => document.documentElement.dir);
        t.expect('REP-08', d && !english && w.book?.payoutMultiplier === base.book?.payoutMultiplier && (lang !== 'ar' || dir === 'rtl'), `lang=${lang}: details captions ${english ? 'still ENGLISH' : `"${Object.keys(d?.rows || {}).slice(0, 2).join('", "')}"`}, the round unchanged (${w.book?.payoutMultiplier}x)${lang === 'ar' ? `, dir=${dir}` : ''}`);
        await page.close();
      }
    },
  },

  {
    name: 'replay-trips-and-last-stop',
    covers: ['REP-09', 'REP-10', 'REP-11'],
    est: 120,
    async run(t) {
      const tr = eventFor('tr_any_equal_equal', 'cap');
      for (const viewport of ['desktop', 'popoutS']) {
        const page = await t.page({ viewport });
        await t.replay({ mode: 'tr_any_equal_equal', event: tr.id }, { page });
        const d = await replayDetails(page);
        let fan = 0;
        const fanSampler = (async () => { for (let i = 0; i < 300 && !fan; i++) { fan = await page.evaluate(() => document.querySelector('.wc-overlay')?.querySelectorAll('.wc-fan-card, .wc-card, [class*="fan-card"]').length || 0).catch(() => 0); await sleep(100); } })();
        const w = await watchReplay(page);
        await fanSampler;
        t.expect('REP-09', d?.rows['Game mode'] === 'Three of a Kind' && /\$250\.00 \(×250\)/.test(d?.rows['Round cost'] || '') && d.choices.length === 3 && w.end.slots === 3 && fan === 3, `${viewport}: "${d?.rows['Game mode']}", Round cost "${d?.rows['Round cost']}", cards [${d?.choices.join(', ')}], payout ${d?.rows['Payout']}; ${w.end.slots} cards dealt, ${fan} fanned`);
        await page.close();
      }
      for (const col of ['t2', 't3', 't5', 't10']) {
        const ev = eventFor('ls_red_higher_outside_heart', col);
        const page = await t.replay({ mode: 'ls_red_higher_outside_heart', event: ev.id });
        const d = await replayDetails(page);
        const w = await watchReplay(page);
        const n = col.slice(1);
        t.expect('REP-10', new RegExp(`×\\s?${n}\\b`).test(d?.rows['Ticket'] || '') && w.end.ticket?.flipped && num(w.end.mult) === ev.x, `#${ev.id}: details ticket "${d?.rows['Ticket']}", the reveal turned "${w.end.ticket?.label}", pays ${w.end.mult} = ${ev.x}x`);
        await page.close();
      }
      const bust = eventFor('ls_red_higher_inside_heart', 'bustwin');
      const page = await t.replay({ mode: 'ls_red_higher_inside_heart', event: bust.id });
      const d = await replayDetails(page);
      const w = await watchReplay(page);
      t.expect('REP-11', !('Ticket' in (d?.rows || {})) && !w.end.ticket?.flipped, `bust + win #${bust.id}: ${'Ticket' in (d?.rows || {}) ? 'a TICKET row' : 'no ticket row'}, the ticket ${w.end.ticket?.flipped ? 'TURNED' : 'stays face down'}`);
    },
  },

  {
    name: 'replay-that-cannot-load',
    covers: ['REP-12'],
    est: 40,
    async run(t) {
      for (const [label, prep, o] of [['an unpublished event', null, { mode: 'red_higher_outside_heart', event: 987654321 }], ['a dropped replay fetch', (p) => p.route(/\/bet\/replay\//, r => r.abort('connectionfailed')), { mode: 'red_higher_outside_heart', event: eventFor('red_higher_outside_heart', 'cap').id }]]) {
        const page = await t.page();
        if (prep) await prep(page);
        await t.replay(o, { page });
        let d = null; for (let i = 0; i < 20 && !d; i++) { await sleep(400); d = await errorDialog(page); }
        t.expect('REP-12', d && d.onTop && d.buttons.some(b => /reload/i.test(b)) && d.title, d ? `${label}: "${d.title}" [${d.buttons.join(', ')}], on top ${d.onTop}` : `${label}: no error dialog`);
        await page.close();
      }
    },
  },
];
