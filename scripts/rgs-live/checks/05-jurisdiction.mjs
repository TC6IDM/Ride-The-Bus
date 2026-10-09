// 05 · Jurisdiction flags. A demo account carries no operator flags, so the
// authenticate response's jurisdiction block is rewritten in the browser
// (t.rewriteAuth); the UPLOADED build's own code reads it. Evidence says so.
import { setMode, setBetChip, setTurbo, closePopups, sleep, spinState, deal, settle, ready, watchHealth } from '../lib/game.mjs';

const SIM = '(simulated operator block)';
const plays = (rec) => rec.reqs.filter(r => r.path.endsWith('/wallet/play'));

async function controls(page) {
  return page.evaluate(() => {
    const has = (s) => { const e = document.querySelector(s); return !e ? 'absent' : (e.disabled || e.getAttribute('aria-disabled') === 'true') ? 'disabled' : (e.offsetParent ? 'shown' : 'hidden'); };
    return {
      turbo: has('.cb-turbo'), autoplay: has('.cb-autospin'),
      fullscreen: [...document.querySelectorAll('button')].some(b => /full ?screen/i.test(b.getAttribute('aria-label') || '')),
      rg: (document.querySelector('.rg-panel')?.innerText || '').replace(/\s+/g, ' ').trim(),
    };
  });
}
async function turboMax(page) {
  if ((await controls(page)).turbo !== 'shown') return null;
  await page.locator('.cb-turbo').click(); await sleep(300);
  const max = await page.locator('.popup input[type=range]').getAttribute('max').catch(() => null);
  await closePopups(page);
  return max === null ? null : Number(max);
}
/** Deal one round at normal speed and report whether the spin ever offered a slam. */
async function slamOffered(page) {
  await ready(page);
  await deal(page);
  let offered = false;
  for (let i = 0; i < 30; i++) { const s = await spinState(page); if (s?.slam) offered = true; await sleep(100); }
  await settle(page);
  return offered;
}
async function spaceTap(page, rec) {
  await ready(page);
  await page.mouse.click(600, 100);
  const n0 = plays(rec).length;
  await page.keyboard.press('Space'); await sleep(1500);
  const n = plays(rec).length - n0;
  await settle(page);
  return n;
}
async function spaceHold(page, rec, ms = 5000) {
  await ready(page);
  await page.mouse.click(600, 100);
  const n0 = plays(rec).length;
  await page.keyboard.down('Space'); await sleep(ms); await page.keyboard.up('Space');
  await sleep(1500);
  const n = plays(rec).length - n0;
  await settle(page);
  return n;
}

export default [
  {
    name: 'jurisdiction-flags',
    covers: ['JUR-01', 'JUR-02'],
    est: 150,
    timeout: 420_000,
    async run(t) {
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      const open = async (mutate) => {
        const page = await t.page();
        const health = watchHealth(page);
        const rec = t.recorder(page);
        t.rewriteAuth(page, (j) => mutate(j.config || (j.config = {})));
        await t.game(url, { page });
        await setMode(page, 'red_higher_outside_heart');
        await setBetChip(page, 10_000);
        return { page, rec, health };
      };
      const on = { disabledTurbo: false, disabledSuperTurbo: false, disabledAutoplay: false, disabledSlamstop: false, disabledSpacebar: false, disabledFullscreen: false, displayRTP: false, displayNetPosition: false, displaySessionTimer: false, minimumRoundDuration: 0 };

      // A: autoplay, super-turbo and slam-stop off; the three readouts on.
      let { page, rec } = await open((c) => { c.jurisdiction = { ...c.jurisdiction, ...on, disabledSuperTurbo: true, disabledAutoplay: true, disabledSlamstop: true, displayRTP: true, displayNetPosition: true, displaySessionTimer: true }; });
      let c = await controls(page);
      const maxA = await turboMax(page);
      t.expect('JUR-01', c.autoplay !== 'shown', `disabledAutoplay: the autoplay control is ${c.autoplay} ${SIM}`);
      t.expect('JUR-01', maxA !== null && maxA <= 0.8, `disabledSuperTurbo: the turbo slider tops out at ${maxA}`);
      t.expect('JUR-01', /Net Position/i.test(c.rg) && /RTP\s*96\.00%/.test(c.rg) && /Session/i.test(c.rg), `displayRTP / NetPosition / SessionTimer: the panel reads "${c.rg}"`);
      const held = await spaceHold(page, rec);
      t.expect('JUR-01', held <= 1, `disabledAutoplay: holding Space 5s played ${held} round(s) - no run`);
      const slamA = await slamOffered(page);
      t.expect('JUR-01', !slamA, `disabledSlamstop: the spin ${slamA ? 'OFFERED' : 'never offered'} a skip mid-reveal`);
      await page.close();

      // B: spacebar, turbo and fullscreen off.
      ({ page, rec } = await open((cfg) => { cfg.jurisdiction = { ...cfg.jurisdiction, ...on, disabledSpacebar: true, disabledTurbo: true, disabledFullscreen: true }; }));
      c = await controls(page);
      const tapB = await spaceTap(page, rec);
      t.expect('JUR-01', tapB === 0, `disabledSpacebar: a Space tap played ${tapB} rounds`);
      t.expect('JUR-01', c.turbo !== 'shown', `disabledTurbo: the turbo control is ${c.turbo}`);
      t.expect('JUR-01', !c.fullscreen, `disabledFullscreen: ${c.fullscreen ? 'a fullscreen control IS shown' : 'no fullscreen control'}`);
      await page.close();

      // C: every flag off - each feature comes back.
      ({ page, rec } = await open((cfg) => { cfg.jurisdiction = { ...cfg.jurisdiction, ...on }; }));
      c = await controls(page);
      const maxC = await turboMax(page);
      const tapC = await spaceTap(page, rec);
      const slamC = await slamOffered(page);
      t.expect('JUR-01', c.turbo === 'shown' && maxC === 1 && c.autoplay === 'shown' && tapC === 1 && slamC && !c.rg, `flags off restore everything: turbo ${c.turbo} to ${maxC}, autoplay ${c.autoplay}, Space dealt ${tapC}, slam ${slamC ? 'offered' : 'NOT offered'}, readouts ${c.rg ? 'STILL SHOWN' : 'gone'}`);
      await page.close();

      // D: no jurisdiction block at all.
      let health;
      ({ page, rec, health } = await open((cfg) => { delete cfg.jurisdiction; }));
      c = await controls(page);
      const maxD = await turboMax(page);
      await ready(page); await deal(page); await settle(page);
      const played = plays(rec).length;
      t.expect('JUR-02', played === 1 && c.turbo === 'shown' && maxD === 1 && c.autoplay === 'shown' && !health.pageErrors.length, `block absent ${SIM}: a round played (${played}), turbo ${c.turbo} to ${maxD}, autoplay ${c.autoplay}, ${health.pageErrors.length ? `page errors: ${health.pageErrors[0]}` : 'no page errors'}`);
    },
  },

  {
    name: 'min-round-duration',
    covers: ['JUR-03'],
    est: 60,
    async run(t) {
      const url = await t.session({ shared: true, balance: 100_000_000_000 });
      const page = await t.page();
      const rec = t.recorder(page);
      t.rewriteAuth(page, (j) => { j.config.jurisdiction = { ...j.config.jurisdiction, minimumRoundDuration: 2500 }; });
      await t.game(url, { page });
      await setMode(page, 'red_higher_outside_heart');
      await setBetChip(page, 10_000);
      await setTurbo(page, 1);
      let tip = null;
      for (let k = 0; k < 4; k++) {
        const n0 = plays(rec).length;
        await page.locator('.cb-spin').click({ force: true });
        await sleep(150);
        await page.locator('.cb-spin.slammable').click({ force: true, timeout: 300 }).catch(() => {});
        for (let i = 0; i < 40 && plays(rec).length === n0 + 1; i++) {
          await page.locator('.cb-spin').click({ force: true, timeout: 300 }).catch(() => {});
          await page.keyboard.press('Space');
          if (!tip) tip = await page.evaluate(() => { const e = document.querySelector('.cb-cooldown-tip'); return e && e.classList.contains('is-shown') ? e.textContent.trim() : null; });
          await sleep(100);
        }
        if (await page.locator('.wc-overlay').count()) await page.locator('.wc-overlay').click({ force: true }).catch(() => {});
      }
      const times = plays(rec).map(p => p.t);
      const gaps = times.slice(1).map((v, i) => v - times[i]);
      t.expect('JUR-03', gaps.length >= 2 && gaps.every(g => g >= 2450) && /2\.5/.test(tip || ''), `minimumRoundDuration 2500 at Instant turbo, slamming and hammering deal/Space: plays ${gaps.map(g => (g / 1000).toFixed(2) + 's').join(', ')} apart; tip "${tip}" (simulated operator block)`);
    },
  },
];
