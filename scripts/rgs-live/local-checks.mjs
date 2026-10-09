// The checks the LOCAL runner (local.mjs) decides on the uploaded build's own
// bytes. Each one measures with the live check's own code, imported from
// checks/, so a local verdict means what the live one would - only the
// session is local.
//
// A check belongs here only if it measures LAYOUT: what it reads is the same
// wherever the same bytes are served. Money, the handshake, the CDN's headers
// and the replay endpoint stay in checks/, for `npm run rgs`.
import { signAndTypeAt, signVerdicts } from './checks/11-devices.mjs';
import { fits, moneyTexts } from './checks/06-currency.mjs';
import { SEVEN, watchReplay } from './lib/game.mjs';
import { eventFor } from './lib/events.mjs';

const D = 1_000_000;

// A Studio demo session's authenticate, as the live checks see it: USD, a
// $100,000 balance, a $1.00 bet on a $0.01 .. $1,000 ladder.
export const LIVE_USD = (j) => {
  j.balance = { amount: 100_000 * D, currency: 'USD' };
  j.config = { ...j.config, minBet: 0.01 * D, maxBet: 1000 * D, stepBet: 0.01 * D, defaultBetLevel: D,
    betLevels: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].map(x => Math.round(x * D)) };
};
// An IDR session in the billions, as CUR-04's live session is minted.
const IDR = (bet) => (j) => {
  j.balance = { amount: 2_000_000_000 * D, currency: 'IDR' };
  j.config = { ...j.config, minBet: 100 * D, maxBet: 10_000_000 * D, stepBet: 100 * D, defaultBetLevel: bet * D,
    betLevels: [100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000].map(x => x * D) };
};

// The six languages the live check sweeps, plus the four the F-11 fix was
// tuned against (pt, es, id, pl): free here, so swept by default.
export const LOCAL_SIGN_LANGS = ['en', 'de', 'fi', 'ru', 'ar', 'ja', 'pt', 'es', 'id', 'pl'];

export default [
  {
    name: 'mode-sign-and-phone-type',
    covers: ['DEV-11', 'DEV-12'],
    est: 240,
    async run(t) {
      const langs = t.cfg.langs || LOCAL_SIGN_LANGS;
      const flags11 = [], flags12 = [], least = {};
      const jobs = langs.flatMap(lang => SEVEN.map(s => [lang, s]));
      let done = 0;
      await t.parallel(jobs, async ([lang, s]) => {
        const page = await t.load({ lang, viewport: s, auth: LIVE_USD });
        try {
          // The phones in the two languages F-11 hit hardest, on the longest name.
          const shoot = s.startsWith('mobile') && ['fi', 'ru'].includes(lang);
          const fams = await signAndTypeAt(page, s, lang, flags11, flags12, {
            onFamily: async (fam) => { if (shoot && fam === 'sc') await t.shot(page, `${lang}-${s}-second-chance`); },
          });
          if (s.startsWith('mobile')) for (const f of fams) if (!least[s] || f.fs < least[s].fs) least[s] = { fs: f.fs, name: f.name, lang };
        } finally { await page.context().close(); }
        t.progress(++done / jobs.length);
        t.log(`${lang} ${s} measured (${done}/${jobs.length})`);
      });
      signVerdicts(t, langs, flags11, flags12);
      const order = ['mobileS', 'mobileM', 'mobileL'].filter(s => least[s]);
      t.note('DEV-12', `smallest family name: ${order.map(s => `${s} ${least[s].fs.toFixed(2)}px (${least[s].lang} "${least[s].name}")`).join(', ')}`);
    },
  },

  {
    name: 'large-amounts',
    covers: ['CUR-04'],
    est: 80,
    async run(t) {
      const bad = [], cap = [];
      const jobs = [1000, 10_000_000].flatMap(bet => SEVEN.map(s => [bet, s]));
      let done = 0;
      await t.parallel(jobs, async ([bet, s]) => {
        const page = await t.load({ viewport: s, auth: IDR(bet), params: { currency: 'IDR' } });
        try {
          const f = await fits(page), m = await moneyTexts(page);
          if (!/IDR|Rp/.test(m.balance[0] || '')) bad.push(`${s}: the balance is not in IDR ("${m.balance[0]}")`);
          if (f.bad.length || f.hscroll) bad.push(`IDR ${bet.toLocaleString('en')} bet, ${s}: ${f.bad.join(', ')}${f.hscroll ? ' + horizontal scroll' : ''}`);
          if (s === 'desktop' && !/\d{1,3}([.,\s]\d{3}){3,}/.test(m.balance[0] || '')) bad.push(`no thousands separators in "${m.balance[0]}"`);
          if (bet === 10_000_000 && s.startsWith('mobile')) {
            const px = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.cb-bet-display .cb-val')).fontSize).toFixed(1));
            cap.push(`${s} "${m.bet[0]}" at ${px}px`);
          }
          if (bet === 10_000_000 && s === 'mobileS') await t.shot(page, 'idr-cap-bet-mobileS');
        } finally { await page.context().close(); }
        t.progress(++done / (jobs.length + 2));
      });
      // The takeover in IDR, as the live check does it.
      const tr = eventFor('tr_any_equal_equal', 'cap');
      const rp = await t.replay({ mode: 'tr_any_equal_equal', event: tr.id, currency: 'IDR', amount: 10_000_000_000 });
      let last = '';
      try {
        const w = await watchReplay(rp, { leaveTakeover: true });
        last = w.legs.at(-1)?.last || '';
        const f = await fits(rp);
        if (f.bad.length) bad.push(`takeover: ${f.bad.join(', ')}`);
        await t.shot(rp, 'idr-takeover-desktop');
      } finally { await rp.context().close(); }
      t.progress(1);
      t.expect('CUR-04', !bad.length, bad.length ? bad.join('; ') : `IDR 2,000,000,000 and the IDR 10,000,000 cap fit at all seven sizes with no horizontal scroll; the cap bet on the phones: ${cap.sort().join(', ')}; the takeover reads "${last}"`);
    },
  },
];
