// 11 · Devices. Emulated: phones are touch contexts (coarse pointer, isMobile),
// which is what earlier passes recorded as EMULATED; real hardware stays the
// owner's (DEV-04, DEV-05; see manual.mjs).
import { setFamily, setMode, setBetChip, setTurbo, closePopups, sleep, ready, deal, settle, board, watchReplay, SEVEN, VIEWPORTS, FAMILY_ORDER } from '../lib/game.mjs';
import { eventFor } from '../lib/events.mjs';

const rows = (page) => page.evaluate(() => { const items = [...document.querySelectorAll('footer > *')].filter(e => e.getBoundingClientRect().height > 0); const c = items.map(e => { const b = e.getBoundingClientRect(); return (b.top + b.bottom) / 2; }).sort((a, b) => a - b); let n = 0, last = -1e9; for (const x of c) { if (x - last > 14) n++; last = x; } return n; });
const scrolls = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1);

export default [
  {
    name: 'phones-and-the-start-screen',
    covers: ['DEV-01', 'DEV-02', 'DEV-03'],
    est: 120,
    async run(t) {
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      // DEV-03: the start screen at every size
      const intro = [];
      for (const touch of [false, true]) {
        const list = SEVEN.filter(s => !!VIEWPORTS[s].touch === touch);
        const page = await t.game(url, { viewport: list[0], intro: false });
        await page.locator('.ss-continue').first().waitFor({ timeout: 30_000 });
        for (const s of list) {
          const { width, height } = VIEWPORTS[s];
          await page.setViewportSize({ width, height }); await sleep(400);
          const r = await page.evaluate(() => {
            const steps = [...document.querySelectorAll('.ss-step')].filter(e => e.getBoundingClientRect().width);
            const ys = steps.map(e => { const b = e.getBoundingClientRect(); return Math.round((b.top + b.bottom) / 2); });
            const rowsN = new Set(ys.map(y => Math.round(y / 20))).size;
            const c = document.querySelector('.ss-continue')?.getBoundingClientRect();
            return { steps: steps.length, rows: rowsN, cont: c ? c.top >= 0 && c.bottom <= innerHeight + 1 : false, scroll: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1 };
          });
          const want = touch ? 2 : 1;
          intro.push({ s, ok: r.steps === 4 && r.rows === want && r.cont && !r.scroll, r });
        }
        // the ? badges open by click and by tap
        const q = page.locator('.ss-help').first();
        if (touch) await q.tap({ force: true }).catch(() => q.dispatchEvent('click')); else await q.click({ force: true });
        await sleep(400);
        const opens = await page.evaluate(() => [...document.querySelectorAll('[role=tooltip], .ss-tip, [class*="tip"]')].some(e => e.getBoundingClientRect().width && getComputedStyle(e).opacity !== '0' && e.textContent.trim().length > 10));
        intro.push({ s: touch ? 'the ? badge by tap' : 'the ? badge by click', ok: opens });
        await page.close();
      }
      const badIntro = intro.filter(x => !x.ok);
      t.expect('DEV-03', !badIntro.length, badIntro.length ? `start screen problems: ${badIntro.map(x => `${x.s} ${JSON.stringify(x.r || {})}`).join('; ')}` : 'four steps on one row at every 16:9 size and 2x2 on the portrait phones, Continue on screen, nothing scrolls; the ? badges open by click and by tap');
      // DEV-01: a full round on an emulated Mobile M
      let page = await t.game(url, { viewport: 'mobileM' });
      await setMode(page, 'red_higher_outside_heart');
      const pressed = await page.evaluate(() => document.querySelectorAll('.choice-row button[aria-pressed="true"]').length);
      await ready(page); await page.locator('.cb-spin').tap({ force: true }).catch(() => page.locator('.cb-spin').dispatchEvent('click'));
      await settle(page);
      const b = await board(page);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('footer .cb-val, .choice-label, .running-win-amount')].filter(e => e.getBoundingClientRect().width && e.scrollWidth > e.clientWidth + 1).length);
      t.expect('DEV-01', pressed === 4 && b.label && !clipped && !(await scrolls(page)), `EMULATED Mobile M (touch, coarse pointer): four picks set, the round played to "${b.label} ${b.amount}", ${clipped} clipped, no scroll (a real phone is still worth a look)`);
      await page.close();
      // DEV-02: a phone on its side, and a takeover on the short axis
      page = await t.game(url, { viewport: { width: 812, height: 375, touch: true } });
      t.expect('DEV-02', !(await scrolls(page)), `812 x 375 landscape: board and bar ${await scrolls(page) ? 'SCROLL' : 'fit without scrolling'}, bar ${await rows(page)} rows`);
      await page.close();
      const rp = await t.page({ viewport: { width: 812, height: 375, touch: true } });
      await t.replay({ mode: 'red_equal_equal_heart', event: eventFor('red_equal_equal_heart', 'cap').id, device: 'mobile' }, { page: rp });
      await watchReplay(rp, { leaveTakeover: true });
      const fits = await rp.evaluate(() => { const parts = [...document.querySelectorAll('.wc-title, .wc-amount, .wc-mult, .wc-prompt')].map(e => e.getBoundingClientRect()); return parts.length && parts.every(b => b.top >= -1 && b.bottom <= innerHeight + 1 && b.left >= -1 && b.right <= innerWidth + 1); });
      t.expect('DEV-02', fits, `the max-win takeover ${fits ? 'fits' : 'does NOT fit'} 375px of height`);
    },
  },

  {
    name: 'small-sizes-trips-ticket-deal',
    covers: ['DEV-06', 'DEV-07', 'DEV-08'],
    est: 180,
    timeout: 600_000,
    async run(t) {
      const url = await t.session({ shared: true, balance: 400_000_000_000 });
      const ticketBad = [], dealBad = [], tripsNotes = [];
      await t.sweep(url, SEVEN, async (page, s) => {
        await setMode(page, 'ls_red_higher_outside_heart');
        await setTurbo(page, 0);
        await setBetChip(page, 100_000);
        if (['popoutS', 'mobileS', 'mobileM', 'mobileL'].includes(s)) {
          const tk = await page.evaluate(() => {
            const R = (e) => e && e.getBoundingClientRect();
            const ov = (a, b) => a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
            const k = R(document.querySelector('.ticket-slot')); const c4 = R([...document.querySelectorAll('.card-slot')][3]);
            const hits = [['readout', document.querySelector('.running-win-amount')], ['Suit label', [...document.querySelectorAll('.choice-label')][3]], ...[...document.querySelectorAll('.prop')].map(p => ['a prop', p])].filter(([, e]) => ov(k, R(e))).map(([n]) => n);
            return k ? { whole: k.left >= 0 && k.top >= 0 && k.right <= innerWidth && k.bottom <= innerHeight, under4: c4 ? Math.abs((k.left + k.right) / 2 - (c4.left + c4.right) / 2) < c4.width * 0.6 && k.top > c4.top : false, hits } : null;
          });
          if (!tk || !tk.whole || !tk.under4 || tk.hits.length) ticketBad.push(`${s}: ${JSON.stringify(tk)}`);
        }
        // one round, then the next deal must go INTO the deck
        await ready(page); await deal(page); await settle(page);
        await ready(page);
        const sample = page.evaluate(async () => {
          const deck = document.querySelector('.p-deck .deck-face, .p-deck')?.getBoundingClientRect();
          const res = { min: 99, hidden: 0 };
          const t0 = performance.now();
          while (performance.now() - t0 < 900) {
            await new Promise(r => requestAnimationFrame(r));
            for (const b of document.querySelectorAll('.card-block')) {
              const r = b.getBoundingClientRect();
              res.min = Math.min(res.min, Math.hypot((r.left + r.right) / 2 - (deck.left + deck.right) / 2, (r.top + r.bottom) / 2 - (deck.top + deck.bottom) / 2) / deck.width);
              if (parseFloat(getComputedStyle(b).opacity) < 0.05) res.hidden++;
            }
          }
          return res;
        });
        await page.locator('.cb-spin').click({ force: true });
        const d = await sample;
        if (!(d.min < 0.3 && d.hidden > 0)) dealBad.push(`${s}: nearest ${d.min.toFixed(2)} deck-widths, ${d.hidden} hidden frames`);
        await settle(page);
        if (['popoutS', 'mobileS'].includes(s)) {
          await setFamily(page, 'tr');
          const tr = await page.evaluate(() => ({ slots: document.querySelectorAll('.card-slot').length, badges: document.querySelectorAll('.equal-slot').length, base: document.querySelector('.cb-bet-base')?.textContent.trim(), scroll: document.documentElement.scrollWidth > innerWidth + 1 }));
          const barRows = await rows(page);
          await page.locator('.cb-mode-btn').click(); await sleep(500);
          const picker = await page.evaluate(() => { const p = document.querySelector('.popup'); return { inside: p.scrollHeight >= p.clientHeight, page: document.documentElement.scrollHeight > innerHeight + 1 }; });
          await closePopups(page);
          await ready(page); await deal(page); await settle(page);
          await setFamily(page, 'base');
          const back = await page.evaluate(() => ({ slots: document.querySelectorAll('.card-slot').length, squares: document.querySelectorAll('.choice-row .choice-square').length, up: document.querySelectorAll('.card-inner.flipped').length }));
          const ok = tr.slots === 3 && tr.badges === 2 && /× 250/.test(tr.base || '') && !tr.scroll && (s !== 'popoutS' || barRows === 1) && !picker.page && back.slots === 4 && back.squares === 4 && back.up === 0;
          tripsNotes.push({ s, ok, msg: `${s}: ${tr.slots} slots, ${tr.badges} Equal badges, "${tr.base}", bar ${barRows} row(s), picker ${picker.page ? 'SCROLLS THE PAGE' : 'scrolls inside'}; back on Classic ${back.slots} face-down slots (${back.up} up), ${back.squares} squares` });
        }
      });
      for (const n of tripsNotes) t.expect('DEV-06', n.ok, n.msg);
      t.expect('DEV-07', !ticketBad.length, ticketBad.length ? ticketBad.join('; ') : 'the ticket is whole, under card 4, touching nothing, at Popout S and the three phones');
      t.expect('DEV-08', !dealBad.length, dealBad.length ? dealBad.join('; ') : 'at all seven sizes the dealt cards reach the deck and fade into it before dealing back');
    },
  },

  {
    name: 'slams-and-the-die',
    covers: ['DEV-09', 'DEV-10'],
    est: 120,
    timeout: 480_000,
    async run(t) {
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      const page = await t.page();
      const rec = t.recorder(page);
      await t.game(url, { page });
      await setFamily(page, 'tr');
      const dieOnTrips = await page.locator('.table-die').count();
      await setFamily(page, 'base');
      await setBetChip(page, 10_000);
      const picks = () => page.evaluate(() => [...document.querySelectorAll('.choice-row button[aria-pressed="true"]')].map(b => b.className.match(/(black|red)-half|higher|lower|inside|outside|equal|quad-btn/)?.[0] + (b.closest('.suit-square') ? [...b.parentElement.children].indexOf(b) : '')));
      const rolls = [];
      for (let i = 0; i < 6; i++) { await page.locator('.table-die').click({ force: true }); await sleep(1300); rolls.push((await picks()).join(',')); }
      const playable = rolls.every(r => { const p = r.split(','); return p.length === 4 && !(p[1] === 'equal' && p[2] === 'inside'); });
      const distinct = rolls.every((r, i) => i === 0 || r !== rolls[i - 1]);
      await page.locator('.table-die').click({ force: true }); await sleep(1300);
      const shown = await page.evaluate(() => { const g = (s) => document.querySelector(`${s} button[aria-pressed="true"]`); const name = (b) => b?.getAttribute('aria-label')?.toLowerCase(); return [name(g('.color-square')), name(g('.hl-square')), name(g('.io-square')), name(g('.suit-square'))].join('_'); });
      const n0 = rec.reqs.filter(r => r.path.endsWith('/wallet/play')).length;
      const sentMode = page.waitForRequest(r => /\/wallet\/play/.test(r.url()), { timeout: 15_000 }).then(r => JSON.parse(r.postData() || '{}').mode).catch(() => null);
      await page.keyboard.press('Space');
      const mode = await sentMode;
      await sleep(300);
      const before = (await picks()).join(',');
      await page.locator('.table-die').click({ force: true }).catch(() => {}); await sleep(500);
      const inert = (await picks()).join(',') === before;
      await settle(page);
      t.expect('DEV-10', !dieOnTrips && playable && distinct && mode === shown && inert, `${dieOnTrips ? 'a die on Three of a Kind' : 'no die on Three of a Kind'}; 6 rolls ${playable ? 'all playable' : 'NOT all playable'}${distinct ? ', each a change' : ''}; die then Space dealt ${mode} = shown ${shown}; mid-round the die ${inert ? 'is inert' : 'CHANGED the picks'}`);
      // DEV-09: slams early in the deal
      await setTurbo(page, 0);
      let worst = 0, running = 0;
      for (let k = 0; k < 12; k++) {
        await ready(page); await deal(page);
        await sleep(250 + (k % 3) * 120);
        await page.locator('.cb-spin.slammable').click({ force: true, timeout: 800 }).catch(() => {});
        await settle(page);
        const d = await page.evaluate(() => {
          let w = 0;
          for (const slot of document.querySelectorAll('.card-slot')) { const b = slot.querySelector('.card-block'); if (!b) continue; const s = slot.getBoundingClientRect(), r = b.getBoundingClientRect(); w = Math.max(w, Math.abs((s.left + s.width / 2) - (r.left + r.width / 2))); }
          return { w, running: document.getAnimations().filter(a => a.playState === 'running' && a.effect?.target?.closest?.('.card-block, .ticket-slot')).length };
        });
        worst = Math.max(worst, d.w); running += d.running;
      }
      t.expect('DEV-09', worst < 1.5 && running === 0, `12 rounds slammed early: worst card displacement ${worst.toFixed(1)}px, ${running} deal animations left running`);
    },
  },

  {
    name: 'mode-sign-and-phone-type',
    covers: ['DEV-11', 'DEV-12'],
    est: 300,
    timeout: 1_200_000,
    async run(t) {
      const url = await t.session({ shared: true });
      const flags11 = [], flags12 = [];
      for (const lang of SIGN_LANGS) await t.sweep(url, SEVEN, (page, s) => signAndTypeAt(page, s, lang, flags11, flags12), { lang });
      signVerdicts(t, SIGN_LANGS, flags11, flags12);
    },
  },
];

// DEV-11 / DEV-12's measurement, exported so the LOCAL runner (local.mjs) runs
// exactly this code on the uploaded build's own bytes - a local verdict then
// means what a live one would.
export const SIGN_LANGS = ['en', 'de', 'fi', 'ru', 'ar', 'ja'];

/** Every family's sign at one size, and on a phone the 9px floor and the bar's rows. Returns the per-family facts. */
export async function signAndTypeAt(page, s, lang, flags11, flags12, { onFamily } = {}) {
  const fams = [];
  for (const fam of FAMILY_ORDER) {
    await setFamily(page, fam);
    fams.push(await page.evaluate(() => {
      const ns = [...document.querySelectorAll('.cb-blind-name')]; const n = ns[ns.length - 1];
      const btn = document.querySelector('.cb-mode-btn').getBoundingClientRect(), bar = document.querySelector('footer.control-bar').getBoundingClientRect(), nb = n.getBoundingClientRect();
      const meter = document.querySelector('.cb-mode-btn .bolt-meter');
      return { name: n.textContent.trim(), fs: parseFloat(getComputedStyle(n).fontSize), over: n.scrollWidth > n.clientWidth + 0.5 || n.scrollHeight > n.clientHeight + 0.5, outside: nb.left < btn.left - 0.5 || nb.right > btn.right + 0.5, bolts: meter && meter.getBoundingClientRect().width > 0 && getComputedStyle(meter).display !== 'none' ? document.querySelectorAll('.cb-mode-btn .bolt').length : 0, btn: [Math.round(btn.width), Math.round(btn.height)], bar: [Math.round(bar.width), Math.round(bar.height)], base: document.querySelector('.cb-bet-base') ? parseFloat(getComputedStyle(document.querySelector('.cb-bet-base')).fontSize) : null };
    }));
    if (onFamily) await onFamily(fam);
  }
  const phone = s.startsWith('mobile');
  for (const f of fams) {
    if (f.over || f.outside) flags11.push(`${lang} ${s} ${f.name}: overflows its sign`);
    if (s !== 'popoutS' && f.bolts !== 7) flags11.push(`${lang} ${s} ${f.name}: ${f.bolts} bolts`);
    if (s === 'popoutS' && f.bolts) flags11.push(`${lang} ${s}: bolts on Popout S`);
    if (phone && f.fs < 8.95) flags12.push(`${lang} ${s} "${f.name}" ${f.fs.toFixed(1)}px`);
    if (phone && f.base !== null && f.base < 8.95) flags12.push(`${lang} ${s} Three of a Kind's base line ${f.base}px`);
  }
  const bars = new Set(fams.map(f => f.bar.join('x'))), btns = new Set(fams.map(f => f.btn.join('x')));
  if (bars.size > 1 || btns.size > 1) flags11.push(`${lang} ${s}: bar ${[...bars].join(' / ')}, MODE ${[...btns].join(' / ')} across the families`);
  if (phone) {
    const small = await page.evaluate(() => [...document.querySelectorAll('.cb-cap, .choice-label, .running-win-label, .board-hint, .choice-hint')].filter(e => e.getBoundingClientRect().width && e.textContent.trim() && parseFloat(getComputedStyle(e).fontSize) < 8.95).map(e => `${e.textContent.trim().slice(0, 14)} ${parseFloat(getComputedStyle(e).fontSize).toFixed(1)}px`));
    flags12.push(...small.map(x => `${lang} ${s} ${x}`));
    const n = await rows(page);
    if (n !== 2) flags12.push(`${lang} ${s}: bar on ${n} rows`);
  }
  return fams;
}

export function signVerdicts(t, langs, flags11, flags12) {
  t.expect('DEV-11', !flags11.length, flags11.length ? `${flags11.length} issues: ${flags11.slice(0, 6).join('; ')}` : `the sign fits and colours every family at all seven sizes in ${langs.join('/')}; MODE and the bar keep one size across families`);
  t.expect('DEV-12', !flags12.length, flags12.length ? `${flags12.length} under 9px or off two rows: ${flags12.slice(0, 6).join('; ')}` : 'on the three phones every caption, label, hint, family name and Three of a Kind line is 9px or more, the bar on two rows');
}
