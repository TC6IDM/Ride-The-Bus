// 03 · Round settlement. Money is checked on LIVE rounds (the RGS's debit and
// credit are the point); what the screen does with a known round is checked
// on REPLAYS, which are deterministic.
import {
  recorder, board, setMode, setFamily, setBetChip, playRound, checkRound, dealUntil, settle, sleep,
  toMicro, setTurbo, closePopups, watchReplay, errorDialog, dismissIntro,
} from '../lib/game.mjs';
import { eventFor } from '../lib/events.mjs';

const WIN_GREEN = 'rgb(124, 255, 178)';
const reveals = (p) => (p?.round?.state || []).filter(e => e.type === 'reveal');
// Where a round busted: the first miss that is not a Second Chance forgiveness.
const bustIndex = (p, sc) => { const o = reveals(p).map(e => e.correct !== false); let forgave = !sc; for (let i = 0; i < o.length; i++) if (!o[i]) { if (!forgave && i > 0) { forgave = true; continue; } return i; } return -1; };
const mult = (s) => { const m = String(s || '').match(/([\d.,]+)\s*[×x]/); return m ? Number(m[1].replace(/,/g, '')) : null; };

export default [
  {
    name: 'settlement-money',
    covers: ['RND-01', 'RND-02', 'RND-04'],
    est: 150,
    timeout: 360_000,
    async run(t) {
      const url = await t.session({ balance: 100_000_000_000 });
      const page = await t.game(url);
      await setTurbo(page, 1);
      await setMode(page, 'red_higher_outside_heart');
      const seen = { card1: 0, partial: new Set(), win: 0 };
      for (let i = 0; i < 45 && !(seen.card1 && seen.partial.size >= 2 && seen.win); i++) {
        const r = await playRound(page);
        const c = checkRound(r);
        const play = r.rgs.find(x => x.path.endsWith('/wallet/play'));
        const bustAt = bustIndex(play?.res, false);
        const pm = c.pm;
        const non200 = r.rgs.filter(x => x.status !== 200).map(x => `${x.path} ${x.status}`);
        if (pm > 0) {
          seen.win++;
          if (seen.win <= 3) t.expect('RND-01', c.ok && !non200.length, `${pm}x: ${c.ok ? `one play + one end-round, credited ${c.credit} micro, board ${r.after.balance}` : c.why}`);
          else if (!c.ok) t.fail('RND-01', `${pm}x: ${c.why}`);
        } else {
          t.expect('RND-02', c.ends === 0 && !non200.length, `bust at card ${bustAt + 1}: ${c.ends} end-round calls${non200.length ? `, ${non200.join(', ')}` : ', no 400'}`);
        }
        if (bustAt === 0) { seen.card1++; t.expect('RND-04', pm === 0, `card 1 wrong paid ${pm}x`); }
        if (bustAt > 0 && !seen.partial.has(bustAt)) {
          seen.partial.add(bustAt);
          const shownX = mult(r.after.mult), shownAmt = toMicro(r.after.amount);
          t.expect('RND-04', shownX === pm && shownAmt === Math.round(pm * c.amt) && c.ok, `bust at card ${bustAt + 1}: book ${pm}x, screen "${r.after.amount} ${r.after.mult}", credit ${c.credit}`);
        }
      }
      if (!seen.card1) t.fail('RND-02', 'no card-1 bust in 45 rounds');
      if (!seen.partial.size) t.fail('RND-04', 'no partial bust in 45 rounds');
    },
  },

  {
    name: 'replay-presentation',
    covers: ['RND-06', 'RND-11'],
    est: 90,
    async run(t) {
      // A full sweep: the readout and the chips build stage by stage.
      const full = eventFor('red_higher_outside_heart', 'cap');
      let w = await watchReplay(await t.replay({ mode: 'red_higher_outside_heart', event: full.id }));
      // The running total is hidden while a takeover counts (by design), so the
      // last figure sampled off it can be a stage short; the landed one ends the climb.
      const amounts = [...w.readout.map(r => toMicro(r.amt)), toMicro(w.end.amount)].filter(v => v != null);
      const climbs = amounts.every((v, i) => i === 0 || v >= amounts[i - 1]);
      const distinct = new Set(amounts.filter(v => v > 0)).size;
      const finalX = mult(w.end.mult);
      t.expect('RND-06', climbs && distinct >= 3 && finalX === full.x && Math.max(...amounts) === Math.round(full.x * 1e6), `#${full.id}: ${distinct} rising figures (${[...new Set(w.readout.map(r => r.amt))].slice(0, 8).join(' > ')}), lands on ${w.end.amount} ${w.end.mult} = book ${full.x}x`);
      const chipOrder = w.readout.map(r => r.chips.split(' ').filter(c => c && !c.startsWith('~')).length);
      t.expect('RND-06', chipOrder.every((n, i) => i === 0 || n >= chipOrder[i - 1]) && Math.max(...chipOrder) === 4, `chips appear one card at a time (${[...new Set(chipOrder)].join(',')}) and end ${w.end.chips.join(' ')}`);
      t.expect('RND-11', w.end.label === 'Full game win', `four right reads "${w.end.label}"`);

      const ink = (p) => p.evaluate(() => [...document.querySelectorAll('.card-mult')].map(e => ({ miss: e.classList.contains('is-miss'), color: getComputedStyle(e).color, shown: e.classList.contains('show') && e.textContent.trim() !== '' && e.getAttribute('aria-hidden') !== 'true' })));
      // A bust that kept a share.
      const kept = eventFor('red_higher_inside_heart', 'bustwin');
      let p = await t.replay({ mode: 'red_higher_inside_heart', event: kept.id });
      w = await watchReplay(p);
      let chips = await ink(p);
      const missChip = chips[w.end.busted];
      t.expect('RND-11', w.end.label === 'Kept' && !/%/.test(`${w.end.label} ${w.end.amount}`) && missChip && missChip.color !== WIN_GREEN, `a kept bust (#${kept.id}, ${kept.x}x) reads "${w.end.label}" ${w.end.amount}; the missed card's chip is ${missChip?.color}`);
      // A bust that kept nothing.
      const lost = eventFor('red_higher_outside_heart', 'loss');
      p = await t.replay({ mode: 'red_higher_outside_heart', event: lost.id });
      w = await watchReplay(p);
      chips = await ink(p);
      t.expect('RND-11', w.end.label === 'Busted' && w.end.busted >= 0 && !chips[w.end.busted]?.shown, `nothing kept (#${lost.id}) reads "${w.end.label}", the bust card (${w.end.busted + 1}) shows ${chips[w.end.busted]?.shown ? 'A CHIP' : 'no chip'}`);
      // A Second Chance ride that finished with a miss forgiven.
      const fg = eventFor('sc_red_higher_outside_heart', 'forgiven');
      w = await watchReplay(await t.replay({ mode: 'sc_red_higher_outside_heart', event: fg.id }));
      t.expect('RND-11', w.end.label === 'Won' && w.end.forgiven >= 0, `a forgiven ride (#${fg.id}) reads "${w.end.label}", forgiven at card ${w.end.forgiven + 1}`);
      // Three of a Kind's live total.
      const tr = eventFor('tr_any_equal_equal', 'cap');
      p = await t.replay({ mode: 'tr_any_equal_equal', event: tr.id });
      const stakeInk = [];
      const sampler = (async () => { for (let i = 0; i < 60; i++) { const s = await p.evaluate(() => { const rw = document.querySelector('.running-win'); const am = document.querySelector('.running-win-amount'); return rw && rw.classList.contains('is-at-stake') ? `${document.querySelector('.running-win-label')?.textContent.trim()}@${am ? getComputedStyle(am).color : ''}` : null; }).catch(() => null); if (s) stakeInk.push(s); await sleep(100); } })();
      w = await watchReplay(p);
      await sampler;
      const atStake = [...new Set(stakeInk)];
      t.expect('RND-11', atStake.length && atStake.every(s => /^(At stake|Last card)@/.test(s) && !s.endsWith(WIN_GREEN)), `Three of a Kind's live total read ${atStake.join(', ') || 'NOTHING'} before it paid`);
    },
  },

  {
    name: 'trips-settle',
    covers: ['RND-07'],
    est: 150,
    timeout: 420_000,
    async run(t) {
      const url = await t.session({ balance: 400_000_000_000 });
      const page = await t.game(url);
      await setTurbo(page, 1);
      await setFamily(page, 'tr');
      await setBetChip(page, 2_500_000);
      // a bust, settled normally
      let r = await playRound(page);
      for (let i = 0; i < 10 && checkRound(r).pm > 0; i++) r = await playRound(page);
      let c = checkRound(r);
      t.expect('RND-07', c.pm === 0 && c.ends === 0 && c.debit === 250 * c.amt && r.after.slots === 3 && r.after.cards.filter(Boolean).length <= 3, `a bust: ${c.ends} end-round, debited ${c.debit} = 250 x ${c.amt}, ${r.after.cards.filter(Boolean).length} of ${r.after.slots} cards turned`);
      // a win
      const hit = await dealUntil(page, (p) => p?.round?.payoutMultiplier > 0, { max: 110 });
      if (!hit) { t.fail('RND-07', 'no Three of a Kind win in 110 deals'); return; }
      const rec = t.recorder(page);
      const before = toMicro((await board(page)).balance);
      await settle(page);
      await sleep(800);
      rec.stop();
      const b = await board(page);
      const ends = rec.ends();
      const credit = ends[0]?.res?.balance - hit.play.balance?.amount;
      t.expect('RND-07', ends.length === 1 && ends[0].status === 200 && credit === Math.round(4583.3 * hit.play.round.amount), `a win after ${hit.tries} deals: end-round ${ends.map(e => e.status).join(',')}, credited ${credit} = 4583.3 x ${hit.play.round.amount}`);
      t.expect('RND-07', b.slots === 3 && b.chips.length === 3 && b.chips[0].startsWith('~') && /916\.6/.test(b.chips[1]) && /4,583\.3/.test(b.chips[2]) && /4,583\.3/.test(b.lastWin), `three cards; chips ${b.chips.join(' ')}; Last Win ${b.lastWin}`);
      t.note('RND-07', `balance ${before} before the settle`);
    },
  },

  {
    name: 'last-stop-sweep',
    covers: ['RND-08'],
    est: 240,
    timeout: 540_000,
    async run(t) {
      const url = await t.session({ balance: 100_000_000_000 });
      const page = await t.game(url);
      await setTurbo(page, 1);
      await setMode(page, 'ls_red_higher_outside_heart');
      const hit = await dealUntil(page, (p) => (p?.round?.state || []).some(e => e.type === 'ticket'), { max: 220 });
      if (!hit) { t.fail('RND-08', 'no Last Stop sweep in 220 deals'); return; }
      const rec = t.recorder(page);
      await settle(page);
      await sleep(800);
      rec.stop();
      const st = hit.play.round.state;
      const types = st.map(e => e.type);
      const rv = st.filter(e => e.type === 'reveal');
      const ticket = st.find(e => e.type === 'ticket');
      const pm = hit.play.round.payoutMultiplier;
      const ends = rec.ends();
      const credit = ends[0]?.res?.balance - hit.play.balance?.amount;
      const b = await board(page);
      t.expect('RND-08', rv.length === 4 && rv[3].payout === 1 && types.indexOf('ticket') > types.lastIndexOf('reveal') && types.indexOf('ticket') < types.indexOf('finalWin') && types.filter(x => x === 'ticket').length === 1, `book after ${hit.tries} deals: ${types.join(' ')}; card 4 payout ${rv[3]?.payout}; ticket x${ticket?.value ?? '?'}`);
      t.expect('RND-08', ends.length === 1 && credit === Math.round(pm * hit.play.round.amount), `pays ${pm}x: end-round ${ends.map(e => e.status).join(',')}, credited ${credit}`);
      t.expect('RND-08', mult(b.chips[3]) === pm && mult(b.mult) === pm && b.ticket?.flipped, `card 4's chip ${b.chips[3]}, the readout ${b.mult}, the ticket ${b.ticket?.label} turned`);
    },
  },

  {
    name: 'last-stop-miss',
    covers: ['RND-09'],
    est: 40,
    async run(t) {
      const ev = eventFor('red_higher_inside_heart', 'bustwin');
      const classic = await watchReplay(await t.replay({ mode: 'red_higher_inside_heart', event: ev.id }));
      const lsPage = await t.replay({ mode: 'ls_red_higher_inside_heart', event: ev.id });
      const ls = await watchReplay(lsPage);
      const dead = await lsPage.evaluate(() => { const k = document.querySelector('.ticket-slot'); return k ? { flipped: !!k.querySelector('.ticket-inner.flipped'), dead: k.classList.contains('is-dead') } : null; });
      const ticketEvents = (ls.book?.state || []).filter(e => e.type === 'ticket').length;
      const cChip = classic.end.chips[classic.end.busted], lChip = ls.end.chips[ls.end.busted];
      t.expect('RND-09', ls.end.busted >= 1 && cChip === lChip && ls.book?.payoutMultiplier === classic.book?.payoutMultiplier, `#${ev.id} busts at card ${ls.end.busted + 1}: the bust chip reads ${lChip} on Last Stop and ${cChip} on Classic; both pay ${ls.book?.payoutMultiplier}x`);
      t.expect('RND-09', ticketEvents === 0 && dead && !dead.flipped && dead.dead, `the Last Stop book has ${ticketEvents} ticket events; the ticket is ${dead?.flipped ? 'TURNED' : 'face down'}${dead?.dead ? ' and dimmed' : ''}`);
    },
  },

  {
    name: 'offline-mid-round',
    covers: ['RND-05'],
    est: 60,
    async run(t) {
      const url = await t.session({ balance: 100_000_000_000 });
      const ctx = await t.context();
      const page = await t.game(url, { page: await ctx.newPage() });
      await setMode(page, 'red_higher_outside_heart');
      await setBetChip(page, 10_000);
      const hit = await dealUntil(page, (p) => p?.round?.payoutMultiplier > 0, { max: 15 });
      if (!hit) { t.fail('RND-05', 'no paying round to interrupt'); return; }
      await ctx.setOffline(true);
      await sleep(7000);
      const whileOff = await board(page);
      await ctx.setOffline(false);
      await sleep(1000);
      const rec = t.recorder(page);
      await t.reload(page);
      for (let i = 0; i < 40 && !rec.ends().length; i++) { await sleep(500); if (await page.locator('.wc-overlay').count()) await page.locator('.wc-overlay').click({ force: true }).catch(() => {}); }
      await settle(page);
      const r = await playRound(page);
      rec.stop();
      const c = checkRound(r);
      const errs = rec.log.filter(x => x.status !== 200).map(x => `${x.path} ${x.status} ${x.res?.error || ''}`);
      const d = await errorDialog(page);
      t.expect('RND-05', rec.ends().length >= 1 && c.ok && !errs.length && !d, `offline mid-reveal (pm ${hit.play.round.payoutMultiplier}, board then "${whileOff.label}"); back online the open round settled (end-round ${rec.ends().map(e => e.status).join(',')}) and the next round ${c.ok ? 'played clean' : c.why}${errs.length ? `; errors ${errs.join(', ')}` : ''}${d ? `; dialog "${d.title}"` : ''}`);
    },
  },

  {
    name: 'recent-rounds',
    covers: ['RND-10'],
    est: 90,
    async run(t) {
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      const page = await t.game(url);
      await setTurbo(page, 1);
      const plan = ['red_higher_outside_heart', 'red_higher_outside_heart', 'sc_black_lower_outside_spade', 'sc_black_lower_outside_spade', 'tr_any_equal_equal'];
      for (const m of plan) { await setMode(page, m); await playRound(page); }
      const lw = page.locator('.cb-lastwin-btn');
      await lw.click(); await sleep(700);
      const panel = await page.evaluate(() => {
        const p = document.querySelector('.popup'); if (!p) return null;
        return [...p.querySelectorAll('.history-row')].map(r => ({
          fam: r.querySelector('.history-family')?.textContent.trim(), famInk: getComputedStyle(r.querySelector('.history-family')).color,
          cost: r.querySelector('.history-cost')?.textContent.replace(/\s+/g, ' ').trim(),
          cards: r.querySelectorAll('.history-card').length, marks: [...r.querySelectorAll('.history-card')].map(c => (c.className.match(/is-(bust|forgiven)/) || [])[1]).filter(Boolean),
          paid: r.querySelector('.history-paid')?.textContent.replace(/\s+/g, ' ').trim(),
          paidInk: r.querySelector('.history-amount') ? getComputedStyle(r.querySelector('.history-amount')).color : null,
          picks: r.querySelector('.history-picks')?.textContent.replace(/\s+/g, ' ').trim() || null,
        }));
      });
      await t.shot(page, 'history');
      const fams = panel ? panel.map(r => r.fam) : [];
      t.expect('RND-10', panel && panel.length === 5 && fams[0] === 'Three of a Kind' && fams[4] === 'Classic', `${panel?.length ?? 0} rows, newest first: ${fams.join(' / ')}`);
      t.expect('RND-10', panel && /\$250\.00 \(\$1\.00 × 250\)/.test(panel[0].cost) && panel.slice(1).every(r => /\$1\.00/.test(r.cost)), `costs ${panel?.map(r => r.cost).join(' / ')}`);
      t.expect('RND-10', panel && new Set(panel.map(r => r.famInk)).size >= 3 && panel.slice(1).every(r => r.picks), `family inks ${[...new Set(panel?.map(r => r.famInk))].length}, picks on every guess row`);
      const partial = panel?.find(r => r.paidInk && /×/.test(r.paid) && mult(r.paid) < 1);
      if (partial) t.expect('RND-10', partial.paidInk !== WIN_GREEN, `a partial return "${partial.paid}" in ${partial.paidInk}`);
      await page.keyboard.press('Escape'); await sleep(400);
      const focus = await page.evaluate(() => document.activeElement?.className || '');
      t.expect('RND-10', !(await page.locator('.popup').count()) && /cb-lastwin/.test(focus), `Escape closed it; focus on ${focus.split(' ')[0]}`);
      const rp = await t.replay({ mode: 'red_higher_outside_heart', event: eventFor('red_higher_outside_heart', 'normal').id });
      t.expect('RND-10', !(await rp.locator('.cb-lastwin-btn').count()), 'in a replay Last Win is a plain readout');
    },
  },
];
