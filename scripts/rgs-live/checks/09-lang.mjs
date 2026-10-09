// 09 · Localisation. Every language's board, panels, How to Play tabs, a real
// round, the history panel and an error dialog, checked for English that
// should have been translated (lib/leaks.mjs builds the lists from the game's
// own catalogues).
import { closePopups, setFamily, setPicks, sleep, ready, deal, settle, errorDialog, board, betChips, toMicro } from '../lib/game.mjs';
import { leakSets, visibleTexts } from '../lib/leaks.mjs';
import { withParams } from '../lib/studio.mjs';

const GROUPS = [['ar', 'de', 'es', 'fi'], ['fr', 'hi', 'id', 'ja'], ['ko', 'pl', 'pt', 'ru'], ['tr', 'vi', 'zh']];

async function sweep(t, url, lang, leaks) {
  const page = await t.page();
  const consoleLines = [];
  page.on('console', m => { try { const x = m.text(); if (/uncompiled|lingui/i.test(x)) consoleLines.push(x.slice(0, 140)); } catch {} });
  // the next deal answers like the RGS rejecting a bet - for the error dialog
  let armed = false;
  await page.route(/\/wallet\/play/, async (route) => {
    if (!armed) { await route.fallback(); return; }
    armed = false;
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'ERR_VAL', message: 'invalid amount' }) });
  });
  await t.game(url, { page, lang });
  const found = new Map();
  const harvest = async (where) => { for (const s of await visibleTexts(page)) if (leaks.has(s) && !found.has(s)) found.set(s, where); };
  const clipped = [];
  const clip = async (where) => { clipped.push(...(await page.evaluate(() => [...document.querySelectorAll('footer .cb-cap, footer .cb-val, .cb-blind-name, .choice-label, .running-win-label, .popup-head span, .mode-tab')].filter(e => e.getBoundingClientRect().width && (e.scrollWidth > e.clientWidth + 1)).map(e => e.textContent.trim().slice(0, 24)))).map(x => `${where}: ${x}`)); };
  await setFamily(page, 'base');
  await harvest('board'); await clip('board');
  // How to Play, every family tab
  await page.locator('.cb-info').click(); await sleep(600);
  await clip('how to play');
  const tabs = page.locator('.popup .mode-tab');
  const n = await tabs.count();
  for (let i = 0; i < n; i++) { await tabs.nth(i).click({ force: true }).catch(() => {}); await sleep(200); await harvest(`how-to-play tab ${i + 1}`); }
  await closePopups(page);
  for (const [sel, tag] of [['.cb-autospin', 'autoplay'], ['.cb-mode-btn', 'mode panel'], ['.cb-sound', 'sound'], ['.cb-turbo', 'turbo']]) {
    await page.locator(sel).first().click({ force: true }).catch(() => {}); await sleep(500);
    await harvest(tag); await clip(tag);
    await closePopups(page);
  }
  // Three of a Kind's confirmation and Last Stop's board
  await page.locator('.cb-mode-btn').click(); await page.locator('.popup .mode-option').nth(4).click(); await sleep(400);
  await harvest('Three of a Kind confirmation'); await closePopups(page);
  await setFamily(page, 'ls'); await harvest('Last Stop board'); await clip('Last Stop board');
  await setFamily(page, 'base');
  // a real round, its words, and the history panel
  await setPicks(page, 'red_higher_outside_heart');
  await ready(page); await deal(page);
  for (let i = 0; i < 60; i++) { await sleep(300); if (await page.locator('.wc-overlay').count()) { await harvest('takeover'); await page.locator('.wc-overlay').click({ force: true }).catch(() => {}); } else if ((await board(page)).announce) break; }
  await settle(page); await harvest('settled round');
  await page.locator('.cb-lastwin-btn').click({ force: true }).catch(() => {}); await sleep(500);
  await harvest('history'); await closePopups(page);
  // the error dialog
  armed = true;
  await ready(page); await page.locator('.cb-spin').click({ force: true });
  let d = null; for (let i = 0; i < 15 && !d; i++) { await sleep(300); d = await errorDialog(page); }
  await harvest('error dialog');
  const dir = await page.evaluate(() => ({ dir: document.documentElement.dir, hscroll: document.documentElement.scrollWidth > innerWidth + 1 }));
  if (['ar', 'de', 'fi', 'ja'].includes(lang)) await t.shot(page, `lang-${lang}`);
  await page.close();
  return { found: [...found].map(([s, w]) => `${w}: "${s.slice(0, 50)}"`), clipped: [...new Set(clipped)], d, dir, consoleLines };
}

export default [
  ...GROUPS.map((langs, gi) => ({
    name: `languages-${gi + 1}`,
    covers: ['LNG-01', 'LNG-02', 'LNG-03', 'LNG-04', 'LNG-06', 'LNG-07', 'LNG-08'],
    est: 70 * langs.length,
    timeout: 240_000 * langs.length,
    async run(t) {
      const sets = await leakSets();
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      for (const lang of langs) {
        const r = await sweep(t, url, lang, sets[lang]);
        t.expect('LNG-01', !r.found.length, r.found.length ? `${lang}: English on screen - ${r.found.slice(0, 4).join('; ')}` : `${lang}: no English left on the board, every panel, every How to Play tab, a round, history and the error dialog`);
        t.expect('LNG-02', !r.consoleLines.length, r.consoleLines.length ? `${lang}: ${r.consoleLines[0]}` : `${lang}: no Lingui warnings`);
        if (lang === 'ar') t.expect('LNG-03', r.dir.dir === 'rtl' && !r.dir.hscroll && !r.clipped.length && !r.found.length, `ar: dir=${r.dir.dir}, ${r.clipped.length ? `clipped ${r.clipped.slice(0, 3).join(', ')}` : 'nothing clipped'}, ${r.dir.hscroll ? 'SCROLLS' : 'no scroll'}`);
        if (lang === 'de' || lang === 'fi') t.expect('LNG-04', !r.clipped.length, `${lang}: ${r.clipped.length ? `clipped ${r.clipped.slice(0, 4).join(', ')}` : 'no clipped label on the bar or any panel title'}`);
        if (['pl', 'ar', 'ja'].includes(lang)) t.expect('LNG-06', !r.found.some(f => /Three of a Kind/.test(f)), `${lang}: Three of a Kind's confirmation and tab ${r.found.some(f => /Three of a Kind/.test(f)) ? 'LEAK English' : 'are translated'}`);
        if (['de', 'ar', 'ja'].includes(lang)) {
          t.expect('LNG-07', !r.found.some(f => /Last Stop|tab 3/.test(f)), `${lang}: Last Stop's tab and board ${r.found.some(f => /Last Stop|tab 3/.test(f)) ? 'LEAK English' : 'are translated'}`);
          t.expect('LNG-08', r.d && /ERR_VAL/.test(r.d.code || '') && !/bet was rejected|adjust the amount|try again/i.test(`${r.d.title} ${r.d.detail || ''}`), `${lang}: "${r.d?.title}"${r.d?.detail ? ` / "${r.d.detail}"` : ''} code ${r.d?.code}`);
        }
      }
    },
  })),

  {
    name: 'malformed-lang',
    covers: ['LNG-05'],
    est: 60,
    async run(t) {
      const url = await t.session({ shared: true });
      for (const [value, expectLang] of [['en_US', 'en'], ['zz!!', 'en'], ['en;a', 'en'], ['', 'en'], [null, 'en'], ['po', 'pl']]) {
        const page = await t.page();
        const errs = [];
        page.on('pageerror', e => { try { errs.push(String(e).slice(0, 120)); } catch {} });
        page.on('console', m => { try { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); } catch {} });
        const u = new URL(url);
        if (value === null) u.searchParams.delete('lang'); else u.searchParams.set('lang', value);
        await t.goto(page, u.toString());
        const b = await board(page);
        const chips = await betChips(page).catch(() => []); await closePopups(page);
        const lang = await page.evaluate(() => document.documentElement.lang);
        const money = [b.balance, b.bet, b.lastWin].every(s => toMicro(s) !== null);
        t.expect('LNG-05', lang.startsWith(expectLang) && money && chips.length && !errs.length, `lang=${value === null ? '(absent)' : JSON.stringify(value)}: renders ${lang}, balance "${b.balance}", bet "${b.bet}", ${chips.length} chips${errs.length ? `; ${errs[0]}` : ', console clean'}`);
        await page.close();
      }
    },
  },
];
