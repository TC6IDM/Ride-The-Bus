// 07 · Win presentation. What a known round looks like is checked on REPLAYS,
// against the ladders the game is built from (game/math/winTiers.ts) and the
// round's own book - so a title is judged by arithmetic, not by eye.
import { watchReplay, setTurbo, sleep, setMode, setFamily, setBetChip, startAutoplay, autoRunning, closePopups, board, ready, deal, settle, spinState } from '../lib/game.mjs';
import { replayEvents, eventFor } from '../lib/events.mjs';
import { deadline } from '../lib/held.mjs';

// winTiers.ts: BAND_FLOORS and each family's ceiling (FAMILY_RULES[f].maxWin).
const LADDER = { base: [10, 40, 120, 300], sc: [11, 28, 60, 130], hs: [12, 55, 145, 500], ls: [8, 40, 170, 350] };
const MAX = { base: 1354.2, sc: 585.2, hs: 2237.3, ls: 4301.9, tr: 4583.3 };
const NAMES = ['Big Win', 'Huge Win', 'Mega Win', 'Epic Win'];
const famOf = (mode) => (mode.match(/^(sc|hs|ls|tr)_/) || [, 'base'])[1];
const clean = (book) => (book?.state || []).filter(e => e.type === 'reveal').every(e => e.correct !== false);

/** The title the ladder owes this round, or null for no takeover. */
function expectedTitle(mode, book) {
  const f = famOf(mode), x = book?.payoutMultiplier || 0;
  if (Math.abs(x - MAX[f]) < 1e-9) return 'Max Win';
  if (f === 'tr') return x > 0 ? 'Max Win' : null;
  const i = LADDER[f].filter(t => x >= t).length;
  if (i > 0) return NAMES[i - 1];
  return x > 0 && clean(book) ? 'Big Win' : null;
}

/** Pick an event in [lo, hi) from any column of a family's table. */
function findEvent(family, lo, hi) {
  for (const [mode, row] of Object.entries(replayEvents())) {
    if (famOf(mode) !== family) continue;
    for (const k of ['big', 'cap', 'bustwin', 'forgiven', 'normal']) { const e = row[k]; if (e && e.x >= lo && e.x < hi) return { mode, ...e }; }
  }
  return null;
}

export default [
  {
    name: 'takeover-titles',
    covers: ['WIN-01', 'WIN-02', 'WIN-07', 'WIN-08', 'WIN-09', 'WIN-10', 'WIN-12'],
    est: 240,
    timeout: 900_000,
    async run(t) {
      const cases = [
        ['WIN-02', 'red_higher_outside_heart', 159], ['WIN-02', 'hs_red_higher_outside_heart', 159],
        ['WIN-07', 'sc_red_higher_outside_heart', 6], ['WIN-07', 'sc_red_higher_outside_heart', 7],
        ['WIN-08', 'sc_red_higher_outside_heart', eventFor('sc_red_higher_outside_heart', 'forgiven').id],
        ['WIN-09', 'red_equal_equal_heart', eventFor('red_equal_equal_heart', 'cap').id],
        ['WIN-09', 'sc_red_equal_equal_heart', eventFor('sc_red_equal_equal_heart', 'cap').id],
        ['WIN-09', 'hs_red_equal_equal_heart', eventFor('hs_red_equal_equal_heart', 'cap').id],
        ['WIN-09', 'hs_red_equal_equal_heart', eventFor('hs_red_equal_equal_heart', 'big').id],
        ['WIN-09', 'ls_red_equal_equal_heart', eventFor('ls_red_equal_equal_heart', 'cap').id],
        ['WIN-09', 'tr_any_equal_equal', eventFor('tr_any_equal_equal', 'cap').id],
        ['WIN-12', 'red_higher_outside_heart', eventFor('red_higher_outside_heart', 'cap').id],
        ['WIN-01', 'red_higher_outside_heart', eventFor('red_higher_outside_heart', 'big').id],
        ['WIN-01', 'red_higher_inside_heart', eventFor('red_higher_inside_heart', 'bustwin').id],
        ['WIN-01', 'red_higher_inside_heart', eventFor('red_higher_inside_heart', 'cap').id],
        ['WIN-01', 'hs_red_higher_inside_heart', eventFor('hs_red_higher_inside_heart', 'cap').id],
        ['WIN-01', 'ls_red_higher_outside_heart', eventFor('ls_red_higher_outside_heart', 't10').id],
        ['WIN-01', 'ls_red_higher_outside_heart', eventFor('ls_red_higher_outside_heart', 'big').id],
      ];
      const sc30 = findEvent('sc', 28, 60), hs30 = findEvent('hs', 28, 55);
      if (sc30) cases.push(['WIN-10', sc30.mode, sc30.id]);
      if (hs30) cases.push(['WIN-10', hs30.mode, hs30.id]);
      for (const [id, mode, event] of cases) {
        const page = await t.replay({ mode, event });
        const w = await watchReplay(page);
        const want = expectedTitle(mode, w.book);
        const got = w.legs.filter(l => l.title && l.title !== '<tap>').at(-1)?.title || null;
        const line = `${mode} #${event} ${w.book?.payoutMultiplier}x${clean(w.book) ? ' (clean sweep)' : ''}: ${got ? `"${got}"` : 'no takeover'}${got === want ? '' : `, the ladder says ${want ? `"${want}"` : 'no takeover'}`}`;
        t.expect(id, got === want, line);
        if (id !== 'WIN-01') t.expect('WIN-01', got === want, line);
        await page.close();
      }
      if (!sc30 || !hs30) t.fail('WIN-10', 'REPLAY_EVENTS.md has no ~30x round for Second Chance or High Stakes');
    },
  },

  {
    name: 'count-up-and-dismiss',
    covers: ['WIN-03', 'WIN-06', 'WIN-16'],
    est: 90,
    async run(t) {
      const cap = eventFor('red_equal_equal_heart', 'cap');
      // let it climb, untouched
      let w = await watchReplay(await t.replay({ mode: 'red_equal_equal_heart', event: cap.id }), { leaveTakeover: true });
      const order = w.legs.map(l => l.title);
      t.expect('WIN-03', order.length >= 2 && order.at(-1) === 'Max Win' && new Set(order).size === order.length && !w.negative, `#${cap.id} climbs ${order.join(' > ')}; each title once, never re-entering`);
      // WIN-16: every leg opens on the board's last figure under its tier
      t.expect('WIN-16', w.legs[0]?.first && !/\$0\.00$/.test(w.legs[0].first) && !w.negative, `#${cap.id} opens on "${w.legs[0]?.title} ${w.legs[0]?.first}"${w.negative ? `, NEGATIVE ${w.negative}` : ''}`);
      const p68 = eventFor('red_higher_outside_heart', 'cap');
      const w68 = await watchReplay(await t.replay({ mode: 'red_higher_outside_heart', event: p68.id }));
      t.expect('WIN-16', w68.legs[0] && !/\$0\.00$/.test(w68.legs[0].first) && !w68.negative, `#${p68.id} opens on "${w68.legs[0]?.title} ${w68.legs[0]?.first}"`);
      t.expect('WIN-16', w.prompts.some(p => /^click/i.test(p)), `prompts with a mouse: ${w.prompts.join(' / ')}`);
      // a tap mid-climb jumps to the next tier's floor; once settled a tap dismisses
      let page = await t.replay({ mode: 'red_equal_equal_heart', event: cap.id });
      w = await watchReplay(page, { tapMid: true, leaveTakeover: true });
      const afterTap = w.legs.slice(w.legs.findIndex(l => l.title === '<tap>') + 1);
      t.expect('WIN-03', afterTap.length && afterTap[0].title !== w.legs[0].title, `a tap during "${w.legs[0]?.title}" moved straight to "${afterTap[0]?.title}" at ${afterTap[0]?.first}`);
      await page.locator('.wc-overlay').click({ force: true }).catch(() => {}); await sleep(900);
      t.expect('WIN-03', !(await page.locator('.wc-overlay').count()), 'once settled, a tap dismissed it');
      await page.close();
      // WIN-06: Enter skips, Space dismisses, the page does not scroll
      page = await t.replay({ mode: 'red_equal_equal_heart', event: cap.id });
      await page.locator('.ss-play-btn').click();
      for (let i = 0; i < 100 && !(await page.locator('.wc-overlay').count()); i++) await sleep(100);
      const title0 = await page.locator('.wc-title').textContent().catch(() => null);
      await page.keyboard.press('Enter'); await sleep(500);
      const title1 = await page.locator('.wc-title').textContent().catch(() => null);
      for (let i = 0; i < 6 && !/continue/i.test(await page.locator('.wc-prompt, .wc-hint').textContent().catch(() => '')); i++) { await page.keyboard.press('Enter'); await sleep(500); }
      await page.keyboard.press('Space'); await sleep(900);
      const gone = !(await page.locator('.wc-overlay').count());
      const scrolled = await page.evaluate(() => window.scrollY || document.scrollingElement.scrollTop);
      t.expect('WIN-06', title1 !== title0 && gone && !scrolled, `Enter moved "${title0?.trim()}" to "${title1?.trim()}", Space then ${gone ? 'dismissed it' : 'did NOT dismiss it'}, page scroll ${scrolled}`);
    },
  },

  {
    name: 'turbo-and-count-up',
    covers: ['WIN-04', 'WIN-13'],
    est: 90,
    async run(t) {
      const tr = eventFor('tr_any_equal_equal', 'cap');
      const times = {};
      for (const speed of [0, 1]) {
        const page = await t.replay({ mode: 'tr_any_equal_equal', event: tr.id });
        await setTurbo(page, speed).catch(() => {});
        await page.locator('.ss-play-btn').click();
        let on = 0, settled = 0; const t0 = Date.now();
        while (Date.now() - t0 < 60_000) {
          const ov = await page.locator('.wc-overlay').count();
          if (ov && !on) on = Date.now();
          if (on && /continue/i.test(await page.locator('.wc-prompt, .wc-hint').textContent().catch(() => ''))) { settled = Date.now(); break; }
          await sleep(50);
        }
        times[speed] = { reveal: on - t0, count: settled - on };
        if (speed === 1) {
          const legible = await page.evaluate(() => [...document.querySelectorAll('.wc-title, .wc-amount')].every(e => e.textContent.trim() && parseFloat(getComputedStyle(e).opacity) > 0.9 && getComputedStyle(e).visibility !== 'hidden'));
          t.expect('WIN-13', legible, `at Instant the takeover's title and amount are ${legible ? 'fully legible' : 'NOT legible'}`);
        }
        await page.close();
      }
      const ratio = times[1].count / times[0].count;
      t.expect('WIN-04', ratio > 0.85 && ratio < 1.15, `the same count took ${times[0].count}ms at Normal and ${times[1].count}ms at Instant, while the reveal before it went ${times[0].reveal}ms -> ${times[1].reveal}ms`);
      // WIN-13 live: slammed rounds keep the settled figures legible
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      const page = await t.game(url);
      await setMode(page, 'red_higher_outside_heart');
      await setBetChip(page, 10_000);
      await setTurbo(page, 1);
      const bad = [];
      for (let i = 0; i < 6; i++) {
        await ready(page); await deal(page); await sleep(200);
        await page.locator('.cb-spin.slammable').click({ force: true, timeout: 1500 }).catch(() => {});
        await settle(page);
        const l = await page.evaluate(() => [...document.querySelectorAll('.running-win-amount, .running-win-label, .card-mult.show')].filter(e => e.textContent.trim()).map(e => ({ t: e.textContent.trim(), o: parseFloat(getComputedStyle(e).opacity) })));
        bad.push(...l.filter(x => x.o < 0.9).map(x => `${x.t}@${x.o}`));
      }
      t.expect('WIN-13', !bad.length, bad.length ? `faded after a slam: ${bad.slice(0, 4).join(', ')}` : 'six slammed rounds: every settled readout and chip fully opaque');
    },
  },

  {
    name: 'autoplay-skip-setting',
    covers: ['WIN-05'],
    est: 240,
    timeout: 900_000,
    async run(t) {
      const url = await t.session({ shared: true, balance: 400_000_000_000 });
      for (const skip of [true, false]) {
        const page = await t.game(url);
        const rec = t.recorder(page);
        await setFamily(page, 'tr');
        await setBetChip(page, 2_500_000);
        await setTurbo(page, 1);
        await startAutoplay(page, { rounds: 'inf', fullWinStop: false, skip });
        // About 19 rounds to a win, each queued at the RGS gate: the clock stops while one is.
        let seen = null;
        for (const late = deadline(page, 300_000); !seen && !late();) {
          if (await page.locator('.wc-overlay').count()) {
            const first = await page.locator('.wc-amount').textContent().catch(() => '');
            const opened = Date.now(); let prompt = ''; let closedBy = 'itself';
            while (await page.locator('.wc-overlay').count() && Date.now() - opened < 20_000) {
              prompt = await page.locator('.wc-prompt, .wc-hint').textContent().catch(() => '');
              if (!skip && /continue/i.test(prompt)) { await sleep(500); await page.locator('.wc-overlay').click({ force: true }).catch(() => {}); closedBy = 'a tap'; }
              await sleep(100);
            }
            const last = await page.evaluate(() => document.querySelector('.cb-lastwin .cb-val')?.textContent.trim());
            seen = { first: first.trim(), last, heldMs: Date.now() - opened, closedBy };
          }
          await sleep(150);
        }
        const p0 = rec.reqs.filter(r => r.path.endsWith('/wallet/play')).length;
        await sleep(6000);
        const dealtOn = rec.reqs.filter(r => r.path.endsWith('/wallet/play')).length - p0;
        if (await autoRunning(page)) { await page.locator('.cb-spin').click({ force: true }); await sleep(4000); }
        if (!seen) { t.fail('WIN-05', `skip ${skip ? 'on' : 'off'}: no takeover in 5 minutes`); continue; }
        if (skip) t.expect('WIN-05', /4,583\.30|45\.83/.test(seen.first) && seen.closedBy === 'itself' && dealtOn > 0, `skip on: the takeover opened on the final ${seen.first}, held ${(seen.heldMs / 1000).toFixed(1)}s, closed ${seen.closedBy}; the run dealt ${dealtOn} more in 6s`);
        else t.expect('WIN-05', seen.closedBy === 'a tap' && dealtOn > 0, `skip off: the count-up played to "continue" (opened on ${seen.first}), closed by ${seen.closedBy}; the run dealt ${dealtOn} more in 6s`);
        await page.close();
      }
    },
  },

  {
    name: 'rules-state-the-ceiling',
    covers: ['WIN-11'],
    est: 40,
    async run(t) {
      const url = await t.session({ shared: true });
      const page = await t.game(url);
      for (const [mode, ownCap] of [['red_higher_outside_heart', eventFor('red_higher_outside_heart', 'cap').x], ['red_equal_equal_heart', eventFor('red_equal_equal_heart', 'cap').x]]) {
        await setMode(page, mode);
        await page.locator('.cb-info').click(); await sleep(700);
        const txt = await page.evaluate(() => document.querySelector('.popup')?.innerText.replace(/\s+/g, ' ') || '');
        await closePopups(page);
        const head = /Max win 1,354\.2× your bet/.test(txt);
        const second = txt.match(/top out at ([\d,.]+)×/);
        const same = Math.abs(ownCap - 1354.2) < 1e-9;
        t.expect('WIN-11', head && (same ? !second : second && Number(second[1].replace(/,/g, '')) === ownCap), `${mode}: headline ${head ? '"Max win 1,354.2x your bet"' : 'MISSING'}; ${second ? `"top out at ${second[1]}x"` : 'no second line'} (its cap in REPLAY_EVENTS.md: ${ownCap}x)`);
      }
    },
  },

  {
    name: 'last-stop-ticket-presentation',
    covers: ['WIN-14', 'WIN-15'],
    est: 90,
    async run(t) {
      const cases = [['ls_red_higher_outside_heart', eventFor('ls_red_higher_outside_heart', 't10').id], ['ls_red_higher_inside_heart', 64]];
      const pauses = [];
      for (const [mode, event] of cases) {
        const page = await t.replay({ mode, event });
        const marks = { card4: 0, ticket: 0 };
        const sampler = (async () => { const t0 = Date.now(); while (Date.now() - t0 < 30_000 && !marks.ticket) { const s = await page.evaluate(() => ({ c4: !!document.querySelectorAll('.card-slot')[3]?.querySelector('.card-inner.flipped'), tk: !!document.querySelector('.ticket-inner.flipped') })).catch(() => ({})); if (s.c4 && !marks.card4) marks.card4 = Date.now(); if (s.tk && !marks.ticket) marks.ticket = Date.now(); await sleep(40); } })();
        const fanSeen = { cards: 0, ticket: false };
        const fanSampler = (async () => { for (let i = 0; i < 300 && !fanSeen.cards; i++) { const f = await page.evaluate(() => { const o = document.querySelector('.wc-overlay'); return o ? { cards: o.querySelectorAll('.wc-fan-card, .wc-card, [class*="fan-card"]').length, ticket: !!o.querySelector('[class*="ticket"]') } : null; }).catch(() => null); if (f) Object.assign(fanSeen, f); await sleep(100); } })();
        const w = await watchReplay(page);
        await sampler; await fanSampler;
        const pause = marks.ticket - marks.card4;
        pauses.push(pause);
        const pm = w.book?.payoutMultiplier;
        t.expect('WIN-14', w.legs.length && fanSeen.ticket && /Ticket ×?\d+/.test(w.end.ticket?.label || '') && Number((w.end.chips[3] || '').replace(/[^\d.]/g, '')) === pm, `${mode} #${event} (${pm}x): ${w.legs.length ? `takeover "${w.legs.at(-1).title}"` : 'NO takeover'}, ${fanSeen.cards} cards fanned${fanSeen.ticket ? ' with the ticket on them' : ', NO ticket'}, "${w.end.ticket?.label}", card 4's chip ${w.end.chips[3]}; the ticket turned ${pause}ms after card 4`);
        await page.close();
      }
      t.expect('WIN-14', pauses.length === 2 && Math.abs(pauses[0] - pauses[1]) < 300, `the pause before the ticket is uniform: ${pauses.join('ms / ')}ms`);
      // WIN-15: the same deal on Classic and Last Stop
      const c = await watchReplay(await t.replay({ mode: 'red_higher_inside_heart', event: 64 }));
      const l = await watchReplay(await t.replay({ mode: 'ls_red_higher_inside_heart', event: 64 }));
      const num = (s) => Number(String(s || '').replace(/[^\d.]/g, ''));
      const lc = l.end.chips.map(num);
      t.expect('WIN-15', JSON.stringify(c.end.chips.slice(0, 3)) === JSON.stringify(l.end.chips.slice(0, 3)) && lc.every((v, i) => i === 0 || v >= lc[i - 1]) && lc.every(v => v >= 1), `deal #64: Classic ${c.end.chips.join(' / ')}, Last Stop ${l.end.chips.join(' / ')} - cards 1-3 identical, nothing under the chip before it`);
    },
  },
];
