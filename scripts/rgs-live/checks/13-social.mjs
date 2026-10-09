// 13 · Stake.US and social mode. The restricted-term list is the unit test's
// own (i18n/tests/socialMessages.test.ts), read at run time, so the live sweep
// and the catalogue scan cannot disagree about what is forbidden.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePopups, setFamily, setPicks, sleep, ready, deal, settle, errorDialog, watchReplay, replayDetails, board } from '../lib/game.mjs';
import { visibleTexts } from '../lib/leaks.mjs';
import { eventFor } from '../lib/events.mjs';

const TEST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'web-sdk', 'apps', 'Ride-The-Bus', 'src', 'i18n', 'tests', 'socialMessages.test.ts');
function restricted() {
  const src = readFileSync(TEST, 'utf8');
  const list = [...src.slice(src.indexOf('const RESTRICTED = ['), src.indexOf('];', src.indexOf('const RESTRICTED = ['))).matchAll(/'([^']+)'/g)].map(m => m[1]);
  return new RegExp(`\\b(${list.map(x => x.replace(/ /g, '\\s+')).join('|')})\\b`, 'gi');
}
const hitsIn = (texts, re) => [...new Set(texts.flatMap(s => [...s.matchAll(re)].map(m => `"${m[0]}" in "${s.slice(0, 50)}"`)))];

export default [
  {
    name: 'social-mode',
    covers: ['SOC-01', 'SOC-02', 'SOC-04', 'SOC-06'],
    est: 120,
    async run(t) {
      const RE = restricted();
      const url = await t.session({ shared: true, currency: 'XSC', social: true, balance: 100_000_000_000 });
      const page = await t.page();
      let armed = false;
      await page.route(/\/wallet\/play/, async (route) => { if (!armed) { await route.fallback(); return; } armed = false; await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'ERR_VAL', message: 'invalid amount' }) }); });
      await t.game(url, { page });
      const seen = [];
      const grab = async (where) => { for (const s of await visibleTexts(page)) seen.push({ where, s }); };
      await setFamily(page, 'base'); await grab('board');
      for (const sel of ['.cb-bet-display', '.cb-autospin', '.cb-sound', '.cb-turbo']) { await page.locator(sel).first().click({ force: true }); await sleep(450); await grab(sel); await closePopups(page); }
      await page.locator('.cb-mode-btn').click(); await sleep(400); await grab('mode picker');
      const pickerNames = await page.evaluate(() => [...document.querySelectorAll('.popup .mode-option-name')].map(e => e.textContent.trim()));
      await page.locator('.popup .mode-option').nth(3).click(); await sleep(300); await grab('mode confirmation');
      const confirmName = await page.locator('.popup .mode-confirm-name').textContent().catch(() => '');
      await page.locator('.popup .mode-confirm-go').click(); await sleep(500);
      const sign = await page.evaluate(() => [...document.querySelectorAll('.cb-blind-name')].at(-1)?.textContent.trim());
      await page.locator('.cb-info').click(); await sleep(500);
      const tabs = page.locator('.popup .mode-tab');
      const tabNames = [];
      for (let i = 0; i < await tabs.count(); i++) { await tabs.nth(i).click(); await sleep(200); tabNames.push((await tabs.nth(i).textContent()).trim()); await grab(`How to Play tab ${i + 1}`); }
      await closePopups(page);
      await setFamily(page, 'ls'); await grab('Last Stop board');
      await page.locator('.cb-info').click(); await sleep(400);
      const lsIdx = tabNames.findIndex(n => /Last Stop/.test(n));
      if (lsIdx >= 0) { await tabs.nth(lsIdx).click(); await sleep(250); }
      const lsCopy = await page.evaluate(() => document.querySelector('.popup')?.innerText || '');
      await closePopups(page);
      await setFamily(page, 'base');
      await setPicks(page, 'red_higher_outside_heart');
      await ready(page); await deal(page); await settle(page); await grab('settled round');
      await page.locator('.cb-lastwin-btn').click({ force: true }).catch(() => {}); await sleep(400); await grab('history'); await closePopups(page);
      armed = true; await ready(page); await page.locator('.cb-spin').click({ force: true });
      for (let i = 0; i < 12 && !(await errorDialog(page)); i++) await sleep(300);
      await grab('error dialog');
      const hits = [...new Set(seen.flatMap(({ where, s }) => [...s.matchAll(RE)].map(m => `${where}: "${m[0]}" in "${s.slice(0, 50)}"`)))];
      t.expect('SOC-01', !hits.length, hits.length ? `${hits.length} restricted terms: ${hits.slice(0, 5).join('; ')}` : `${seen.length} strings across the bar, bet menu, autoplay, sound, turbo, mode picker and confirmation, every How to Play tab, a round, history and an error dialog - none restricted`);
      const hsSpots = [pickerNames[3], confirmName, sign, tabNames.find(n => /High/.test(n))];
      t.expect('SOC-02', hsSpots.every(n => /High Risk/.test(n || '')) && !seen.some(x => /High Stakes/.test(x.s)), `picker "${pickerNames[3]}", confirmation "${confirmName?.trim()}", MODE sign "${sign}", tab "${hsSpots[3]}"`);
      const b = await board(page);
      t.expect('SOC-04', [b.balance, b.bet, b.lastWin].every(x => /\b(SC|GC)\b/.test(x || '') && !/^\$|US\$|\$\d/.test(x || '')), `balance "${b.balance}", bet "${b.bet}", Last Win "${b.lastWin}"`);
      const lsHits = [...lsCopy.matchAll(/\b(pay|pays|paid|bet|bets|fund|funds|buy)\b/gi)].map(m => m[0]);
      t.expect('SOC-06', lsIdx >= 0 && !lsHits.length && !hits.some(h => /Last Stop/.test(h)), lsHits.length ? `Last Stop's tab says: ${lsHits.join(', ')}` : 'Last Stop\'s board, picker row and How to Play tab carry no pay / bet / fund / buy');
      t.note('SOC-06', `tab ${tabNames[lsIdx] || 'MISSING'}`);
    },
  },

  {
    name: 'social-english-only',
    covers: ['SOC-03'],
    est: 40,
    async run(t) {
      const url = await t.session({ shared: true, currency: 'XSC', social: true });
      for (const lang of ['de', 'ar']) {
        const page = await t.game(url, { lang });
        const info = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir || 'ltr', caption: document.querySelector('.cb-balance .cb-cap')?.textContent.trim() }));
        t.expect('SOC-03', info.lang.startsWith('en') && info.dir !== 'rtl' && /balance/i.test(info.caption || ''), `social + lang=${lang}: renders ${info.lang}, dir ${info.dir}, caption "${info.caption}"`);
        await page.close();
      }
    },
  },

  {
    name: 'social-replay',
    covers: ['SOC-05'],
    est: 40,
    async run(t) {
      const RE = restricted();
      const found = [];
      for (const [mode, sc] of [['hs_red_equal_equal_heart', 'cap'], ['tr_any_equal_equal', 'cap'], ['ls_red_higher_outside_heart', 't10']]) {
        const page = await t.replay({ mode, event: eventFor(mode, sc).id, social: true, currency: 'XSC' });
        const d = await replayDetails(page);
        const texts = [...await visibleTexts(page)];
        const w = await watchReplay(page);
        texts.push(...w.legs.flatMap(l => [l.title, l.first]).filter(Boolean), ...await visibleTexts(page));
        found.push(...hitsIn(texts, RE).map(h => `${mode}: ${h}`));
        if (mode.startsWith('hs_') && !/High Risk/.test(d?.rows ? Object.values(d.rows).join(' ') : '')) found.push(`${mode}: the details do not read High Risk (${JSON.stringify(d?.rows)})`);
        await page.close();
      }
      t.expect('SOC-05', !found.length, found.length ? found.slice(0, 5).join('; ') : 'three social replays (High Risk max, Three of a Kind, a Last Stop ticket): details, bar and takeover carry no restricted word');
    },
  },
];
