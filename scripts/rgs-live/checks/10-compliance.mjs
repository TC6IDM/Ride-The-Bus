// 10 · Compliance surface.
import { readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closePopups, setMode, setFamily, setBetChip, setTurbo, sleep, ready, settle, board, watchReplay, watchHealth, SEVEN, dealUntil } from '../lib/game.mjs';
import { eventFor, replayEvents } from '../lib/events.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SRC = path.join(ROOT, 'web-sdk', 'apps', 'Ride-The-Bus', 'src');
const plays = (rec) => rec.reqs.filter(r => r.path.endsWith('/wallet/play')).length;

/** The game's own rules, imported - the figures How to Play is meant to print. */
async function gameRules() {
  const modes = await import(pathToFileURL(path.join(SRC, 'game', 'math', 'modes.ts')).href);
  const table = await import(pathToFileURL(path.join(SRC, 'game', 'math', 'payoutTable.ts')).href);
  return { FAMILY_RULES: modes.FAMILY_RULES, parseModeName: modes.parseModeName, payoutRowsFor: table.payoutRowsFor };
}

export default [
  {
    name: 'how-to-play',
    covers: ['CMP-01', 'CMP-02', 'CMP-03', 'CMP-04', 'CMP-05', 'CMP-06', 'CMP-07', 'CMP-08', 'CMP-17'],
    est: 60,
    async run(t) {
      const { FAMILY_RULES } = await gameRules();
      const url = await t.session({ shared: true });
      const page = await t.game(url);
      await setMode(page, 'red_higher_outside_heart');
      await page.locator('.cb-info').click(); await sleep(700);
      const grab = () => page.evaluate(() => (document.querySelector('.popup')?.innerText || '').replace(/[ \t]+/g, ' '));
      const tabs = page.locator('.popup .mode-tab');
      const n = await tabs.count();
      const perTab = [];
      for (let i = 0; i < n; i++) { await tabs.nth(i).click(); await sleep(300); perTab.push({ name: (await tabs.nth(i).textContent()).replace(/\s+/g, ' ').trim(), text: await grab() }); }
      const all = perTab.map(p => p.text).join('\n');
      t.expect('CMP-01', perTab.every(p => /96\.00\s?%/.test(p.text)), `RTP 96.00% on ${perTab.filter(p => /96\.00\s?%/.test(p.text)).length} of ${perTab.length} tabs`);
      const fams = Object.entries(FAMILY_RULES);
      const missingMax = fams.filter(([, r]) => !all.includes(`Max win ${Number(r.maxWin).toLocaleString('en-US', { minimumFractionDigits: 1 })}× your bet`));
      t.expect('CMP-02', !missingMax.length, missingMax.length ? `no "Max win ...x your bet" for ${missingMax.map(([f]) => f).join(', ')}` : `every family's ceiling stated, from the game's own rules: ${fams.map(([f, r]) => `${f} ${r.maxWin}x`).join(', ')}`);
      const disc = { malfunction: /malfunction/i, voids: /void/i, connection: /connection|internet/i, return: /expected return|over many (plays|rounds)|long run/i, server: /Remote Game Server|server/i };
      const missingDisc = Object.entries(disc).filter(([, re]) => !re.test(all)).map(([k]) => k);
      t.expect('CMP-03', !missingDisc.length, missingDisc.length ? `the disclaimer lacks: ${missingDisc.join(', ')}` : 'malfunction voids, connection, expected return over many plays, settled by the Remote Game Server');
      t.expect('CMP-04', /no free spins, bonus rounds, jackpots, or re-trigger/i.test(all), `"${(all.match(/[^.\n]*no free spins[^.\n]*/i) || ['NOT FOUND'])[0].trim()}"`);
      const cfg = readFileSync(path.join(SRC, 'game', 'platform', 'config.ts'), 'utf8');
      const provider = (cfg.match(/providerName:\s*['"]([^'"]+)/) || [])[1];
      t.expect('CMP-05', provider && !/template|example|stake engine/i.test(provider), `providerName "${provider}" (game/platform/config.ts)`);
      const rows = (all.match(/\d+\.\d{2}\s?×\s?[–-]\s?\d/g) || []).length;
      t.expect('CMP-06', rows >= 6 && /figures are exact/i.test(all), `${rows} pay-range rows; "${(all.match(/[^.\n]*figures are exact[^.\n]*/i) || ['exactness line NOT FOUND'])[0].trim()}"`);
      const costLines = perTab.map(p => (p.text.match(/This mode costs (\d+)× your bet/) || [, '?'])[1]);
      t.expect('CMP-07', n === fams.length && costLines.filter(c => c === '1').length === fams.length - 1 && costLines.includes('250'), `${n} tabs (${perTab.map(p => p.name).join(' / ')}), costs ${costLines.join(' / ')}x`);
      const ctrl = all.slice(all.search(/Controls/i));
      const needs = { 'deal / Space': /Space/i, MODE: /mode/i, 'plus and minus': /plus and minus|\+.*−|minus/i, Turbo: /turbo/i, Autoplay: /autoplay/i, sound: /speaker|sound/i, 'i (How to Play)': /\bi\b|how to play/i, 'the die': /die|dice/i, 'keys 1-4': /1.{0,3}4|keys/i };
      const missingCtl = Object.entries(needs).filter(([, re]) => !re.test(ctrl)).map(([k]) => k);
      t.expect('CMP-08', ctrl.length > 50 && !missingCtl.length, missingCtl.length ? `the Controls section does not mention: ${missingCtl.join(', ')}` : 'the Controls section covers every bar control, Space, the die and keys 1-4');
      const forgive = perTab.filter(p => /forgiveness is unused/i.test(p.text)).map(p => p.name);
      t.expect('CMP-17', forgive.length === 1 && /Second Chance/.test(forgive[0]), `the forgiven-miss sentence is on: ${forgive.join(', ') || 'NO tab'}`);
    },
  },

  {
    name: 'sound-panel',
    covers: ['CMP-09', 'CMP-16'],
    est: 60,
    async run(t) {
      const url = await t.session({ shared: true });
      const page = await t.page();
      const music = [];
      page.on('request', r => { try { if (/\/music\/.*\.(mp3|ogg|m4a|wav)/i.test(r.url())) music.push(r.url().split('/').pop().split('?')[0]); } catch {} });
      await t.game(url, { page });
      const state = () => page.evaluate(() => ({
        rows: [...document.querySelectorAll('.popup .sound-row')].map(r => ({ muted: r.querySelector('.sound-mute')?.getAttribute('aria-pressed') === 'true', level: r.querySelector('input[type=range]')?.value })),
        barMuted: !!document.querySelector('.cb-sound .is-muted'),
      }));
      await page.locator('.cb-sound').click(); await sleep(500);
      const s0 = await state();
      await page.locator('.popup .sound-row').nth(0).locator('.sound-mute').click(); await sleep(250);
      const s1 = await state();
      await page.locator('.popup .sound-row').nth(1).locator('.sound-mute').click(); await sleep(250);
      const s2 = await state();
      await closePopups(page);
      await t.reload(page);
      await page.locator('.cb-sound').click(); await sleep(500);
      const s3 = await state();
      // restore
      for (const i of [0, 1]) if (s3.rows[i]?.muted) await page.locator('.popup .sound-row').nth(i).locator('.sound-mute').click();
      await closePopups(page);
      t.expect('CMP-09', s0.rows.length === 2 && s1.rows[0].muted && !s1.rows[1].muted && s1.rows[0].level === s0.rows[0].level && !s1.barMuted && s2.barMuted, `music mute silences music alone (level stays ${s1.rows[0].level}), the bar's speaker crosses only when both are muted (${s1.barMuted} -> ${s2.barMuted})`);
      t.expect('CMP-09', s3.rows.every(r => r.muted) && s3.barMuted, `both mutes survive a reload (${JSON.stringify(s3.rows)}); a listen on real speakers is still the owner's`);
      const lic = readFileSync(path.join(ROOT, 'ASSET_LICENCES.md'), 'utf8');
      const files = [...new Set(music)];
      t.expect('CMP-16', files.length === 1 && lic.includes(files[0]) && /paid|Pro/i.test(lic), `${files.length} music file requested (${files.join(', ')}), ${files[0] && lic.includes(files[0]) ? 'with its row in ASSET_LICENCES.md' : 'NOT in ASSET_LICENCES.md'}; ears still the owner's`);
    },
  },

  {
    name: 'spacebar',
    covers: ['CMP-10'],
    est: 150,
    timeout: 600_000,
    async run(t) {
      const url = await t.session({ shared: true, balance: 400_000_000_000 });
      const page = await t.page();
      const rec = t.recorder(page);
      await t.game(url, { page });
      await setMode(page, 'red_higher_outside_heart');
      await setBetChip(page, 10_000);
      await page.mouse.click(600, 100);
      let n0 = plays(rec); await ready(page); await page.keyboard.press('Space'); await sleep(800); await settle(page);
      const tap = plays(rec) - n0;
      n0 = plays(rec); await ready(page); await page.keyboard.down('Space'); await sleep(5000); await page.keyboard.up('Space'); await sleep(1500); await settle(page);
      const hold = plays(rec) - n0;
      await page.locator('.cb-bet-display').first().click(); await sleep(300);
      await page.locator('.popup .bet-entry-input').focus();
      n0 = plays(rec); await page.keyboard.press('Space'); await sleep(1500);
      const inField = plays(rec) - n0; await closePopups(page);
      await page.locator('.cb-info').click(); await sleep(400);
      n0 = plays(rec); await page.keyboard.press('Space'); await sleep(1500);
      const inPanel = plays(rec) - n0; await closePopups(page);
      // during a takeover: Three of a Kind wins take the screen
      await setFamily(page, 'tr'); await setBetChip(page, 2_500_000); await setTurbo(page, 1);
      const hit = await dealUntil(page, (p) => p?.round?.payoutMultiplier > 0, { max: 120 });
      let duringTakeover = null;
      if (hit) {
        for (let i = 0; i < 80 && !(await page.locator('.wc-overlay').count()); i++) await sleep(100);
        n0 = plays(rec);
        await page.keyboard.press('Space'); await sleep(700);
        const still = await page.locator('.wc-overlay').count();
        await page.keyboard.press('Space'); await sleep(900);
        duringTakeover = { dealt: plays(rec) - n0, still, gone: !(await page.locator('.wc-overlay').count()) };
      }
      t.expect('CMP-10', tap === 1 && hold >= 2 && inField === 0 && inPanel === 0 && duringTakeover && duringTakeover.dealt === 0, `a tap played ${tap}; a 5s hold ${hold}; Space in the bet field ${inField}; with How to Play open ${inPanel}; during a takeover ${duringTakeover ? `${duringTakeover.dealt} (first press ${duringTakeover.still ? 'skipped' : 'closed'}, second ${duringTakeover.gone ? 'dismissed' : 'did not dismiss'})` : 'no takeover reached'}`);
    },
  },

  {
    name: 'frame-never-scrolls',
    covers: ['CMP-11'],
    est: 90,
    async run(t) {
      const url = await t.session({ currency: 'TZS', balance: 9_000_000_000_000_000 });
      const bad = [];
      for (const size of SEVEN) {
        const page = await t.game(url, { viewport: size });
        const scroll = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1);
        if (await scroll()) bad.push(`${size} idle`);
        await page.locator('.cb-bet-display').first().click(); await sleep(400);
        if (await scroll()) bad.push(`${size} bet menu`);
        await closePopups(page);
        await page.locator('.cb-info').click(); await sleep(400);
        if (await scroll()) bad.push(`${size} How to Play`);
        await closePopups(page);
        await page.close();
      }
      t.expect('CMP-11', !bad.length, bad.length ? `the frame scrolls: ${bad.join(', ')}` : 'no frame scroll at all seven sizes - idle, bet menu open, How to Play open - in TZS with a balance in the quadrillions');
    },
  },

  {
    name: 'wins-agree-with-the-rules',
    covers: ['CMP-13'],
    est: 150,
    timeout: 600_000,
    async run(t) {
      const { FAMILY_RULES, parseModeName, payoutRowsFor } = await gameRules();
      const LABEL = { 1: { red: 'Red or Black', black: 'Red or Black' }, 2: { higher: 'Higher', lower: 'Lower', equal: 'Equal' }, 3: { inside: 'Inside', outside: 'Outside', equal: 'Equal' }, 4: { heart: 'Any suit', diamond: 'Any suit', club: 'Any suit', spade: 'Any suit' } };
      const per = {};
      const ev = replayEvents();
      const picks = { base: [], sc: [], hs: [], ls: [], tr: [] };
      for (const [mode, row] of Object.entries(ev)) {
        const fam = (mode.match(/^(sc|hs|ls|tr)_/) || [, 'base'])[1];
        for (const k of ['normal', 'big', 'cap', 'bustwin', 'forgiven']) if (row[k] && row[k].x > 0 && picks[fam].length < 5 && !picks[fam].some(p => p.mode === mode)) picks[fam].push({ mode, id: row[k].id });
      }
      for (const [fam, list] of Object.entries(picks)) {
        const rules = FAMILY_RULES[fam]; const rows = payoutRowsFor(rules); const bad = [];
        for (const { mode, id } of list) {
          const w = await watchReplay(await t.replay({ mode, event: id }));
          const parsed = parseModeName(mode);
          const reveals = (w.book?.state || []).filter(e => e.type === 'reveal');
          const choices = [parsed.color, parsed.higherLower, parsed.insideOutside, parsed.suit];
          let running = 1;
          reveals.forEach((e, i) => {
            const stage = i + 1;
            if (rules.fixedChoices) {
              running *= e.payout;
              const row = rows.find(x => x.stage === stage);
              const total = Math.floor(running * rules.cost * 10 + 1e-9) / 10;
              if (row && Math.abs(row.min - total) > 0.11) bad.push(`${mode} #${id} stage ${stage}: ${total} vs table ${row.min}`);
              return;
            }
            if (e.correct === false) return; // a miss is priced by the bust rule, not the table
            if (rules.ticket && stage === 4) { if (e.payout !== 1) bad.push(`${mode} #${id} suit card priced ${e.payout}`); return; }
            const label = LABEL[stage][String(choices[i])];
            const row = rows.find(x => x.stage === stage && x.label === label);
            if (!row) bad.push(`${mode} #${id} stage ${stage}: no table row for ${label}`);
            else if (e.payout < row.min - 0.006 || e.payout > row.max + 0.006) bad.push(`${mode} #${id} stage ${stage} ${label}: ${e.payout.toFixed(3)} outside ${row.min}-${row.max}`);
          });
        }
        per[fam] = { n: list.length, bad };
      }
      const bad = Object.values(per).flatMap(p => p.bad);
      t.expect('CMP-13', !bad.length && Object.values(per).every(p => p.n >= 1), bad.length ? bad.slice(0, 4).join('; ') : `every stage price inside How to Play's table: ${Object.entries(per).map(([f, p]) => `${f} ${p.n} rounds`).join(', ')}`);
    },
  },

  {
    name: 'accessibility-and-prompts',
    covers: ['CMP-18', 'CMP-19', 'CMP-20', 'CMP-12'],
    est: 90,
    async run(t) {
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      // CMP-20: Tab from the start of the intro
      let page = await t.game(url, { intro: false });
      await page.locator('.ss-continue').first().waitFor({ timeout: 30_000 });
      const order = [];
      for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); await sleep(120); order.push(await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return 'body'; const c = [...e.classList].find(x => !x.startsWith('svelte-')) || e.tagName; return c; })); }
      const firstCont = order.indexOf('ss-continue');
      const strayed = order.some(c => /half-btn|third-btn|quad-btn|equal-btn|cb-/.test(c));
      t.expect('CMP-20', firstCont >= 1 && order.slice(0, firstCont).every(c => /ss-help|help/.test(c)) && !strayed, `Tab visits ${order.join(' > ')}`);
      // CMP-19, mouse
      const promptMouse = await page.locator('.ss-continue').first().textContent();
      await page.locator('.ss-continue').first().click();
      await page.locator('.cb-info').click(); await sleep(500);
      const quickMouse = await page.evaluate(() => [...document.querySelectorAll('.popup li, .popup p')].map(e => e.textContent.trim()).find(s => /quick-bet/.test(s)) || '');
      await closePopups(page);
      // CMP-18: what a screen reader is handed
      await setMode(page, 'red_higher_outside_heart');
      const before = await page.evaluate(() => ({ picks: [...document.querySelectorAll('.choice-row button[aria-pressed]')].length, pressed: [...document.querySelectorAll('.choice-row button[aria-pressed="true"]')].length, chipsHidden: [...document.querySelectorAll('.card-mult')].every(e => e.getAttribute('aria-hidden') === 'true'), named: [...document.querySelectorAll('.card-block')].filter(e => e.getAttribute('aria-label')).length }));
      await ready(page);
      await page.locator('.cb-spin').click({ force: true });
      const announced = new Set();
      for (let i = 0; i < 80; i++) { const a = await page.evaluate(() => document.querySelector('.round-announcer')?.textContent.trim()); if (a) announced.add(a); if (await page.locator('.wc-overlay').count()) await page.locator('.wc-overlay').click({ force: true }).catch(() => {}); await sleep(150); }
      await settle(page);
      const after = await page.evaluate(() => ({ cards: [...document.querySelectorAll('.card-block')].map(e => e.getAttribute('aria-label')).filter(Boolean), announce: document.querySelector('.round-announcer')?.textContent.trim() }));
      t.sim('CMP-18', before.picks === 12 && before.pressed === 4 && before.chipsHidden && before.named === 0 && after.cards.every(c => /^Card \d: .+/.test(c)) && after.announce && announced.size === 1, `accessibility tree: ${before.picks} picks with aria-pressed (${before.pressed} pressed), chips ${before.chipsHidden ? 'aria-hidden' : 'EXPOSED'} and ${before.named} cards named before the deal; after it "${after.cards.join('" / "')}", announced once: "${after.announce}" (the NVDA / VoiceOver listen is the owner's)`);
      await page.close();
      // CMP-19, touch
      page = await t.game(url, { viewport: 'mobileM', intro: false });
      await page.locator('.ss-continue').first().waitFor({ timeout: 30_000 });
      const promptTouch = await page.locator('.ss-continue').first().textContent();
      await page.locator('.ss-continue').first().dispatchEvent('click');
      await page.locator('footer .cb-mode-btn').waitFor();
      await page.locator('.cb-info').dispatchEvent('click'); await sleep(500);
      const quickTouch = await page.evaluate(() => [...document.querySelectorAll('.popup li, .popup p')].map(e => e.textContent.trim()).find(s => /quick-bet/.test(s)) || '');
      await closePopups(page);
      t.expect('CMP-19', /^click/i.test(promptMouse.trim()) && /^tap/i.test(promptTouch.trim()) && /Click the amount/.test(quickMouse) && /Tap the amount/.test(quickTouch), `mouse: "${promptMouse.trim()}" / "${quickMouse}"; touch: "${promptTouch.trim()}" / "${quickTouch}"`);
      // CMP-12 evidence
      const z = await page.evaluate(() => {
        const all = [...document.querySelectorAll('body *')];
        return { viewport: document.querySelector('meta[name=viewport]')?.content, elements: all.length, notManip: all.filter(e => !['manipulation', 'none'].includes(getComputedStyle(e).touchAction)).length, none: all.filter(e => getComputedStyle(e).touchAction === 'none').length };
      });
      t.sim('CMP-12', !/user-scalable=no|maximum-scale=1/.test(z.viewport || '') && z.notManip === 0 && z.none === 0, `viewport "${z.viewport}"; ${z.elements} elements, ${z.notManip} without touch-action: manipulation, ${z.none} with none - double-tap zoom off, pinch not blocked (the real-phone gesture is the owner's)`);
    },
  },

  {
    name: 'tile-assets',
    covers: ['CMP-15'],
    est: 2,
    async run(t) {
      const dir = path.join(ROOT, 'submission');
      const png = (f) => { const b = readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), colorType: b[25] }; };
      const jpg = (f) => { const b = readFileSync(f); for (let i = 2; i < b.length;) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]; const len = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }; i += 2 + len; } return null; };
      const fg = path.join(dir, 'RideTheBus-FG.png'), bg = path.join(dir, 'RideTheBus-BG.jpg'), logo = path.join(dir, 'TakeoverCasino-Logo.png');
      if (![fg, bg, logo].every(existsSync)) { t.fail('CMP-15', `missing from submission/: ${[fg, bg, logo].filter(f => !existsSync(f)).map(f => path.basename(f)).join(', ')}`); return; }
      const F = png(fg), B = jpg(bg), L = png(logo);
      const mb = (statSync(fg).size + statSync(bg).size) / 1e6;
      t.expect('CMP-15', mb < 3 && (F.colorType === 6 || F.colorType === 4), `FG ${F.w} x ${F.h} ${F.colorType === 6 ? 'RGBA (transparent)' : 'NO alpha'}, BG ${B?.w} x ${B?.h}, ${mb.toFixed(2)} MB together; logo ${L.w} x ${L.h}. Text, edges and legibility are a look for the owner`);
    },
  },
];
