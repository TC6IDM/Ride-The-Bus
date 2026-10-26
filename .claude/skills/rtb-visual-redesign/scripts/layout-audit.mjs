// Layout sweep for Ride The Bus: the intro, the board, every panel, the held
// last card and a Max takeover, measured at the seven target sizes (the three
// phones as real phones: isMobile + hasTouch, never a narrow desktop window).
// Each state is opened once and the window resized through its sizes.
//
// Finds: the frame scrolling (a hard Stake failure); a control or text off the
// screen; a control cut by an overflow-hidden box; two controls on top of each
// other; text spilling out of its box; text printed on top of other text; type
// under the floors (6px anywhere, 9px on an upright phone - fitValue may shrink
// money below them on purpose, so that one is a question, not a verdict).
//
// It measures; it does not judge. Every finding is a lead to reproduce and look
// at - the rtb-visual-qa agent does exactly that.
//
// usage (the spare pair must be running: game on 3002, replay RGS on 3011):
//   node .claude/skills/rtb-visual-redesign/scripts/layout-audit.mjs
//   OUT=<dir>          where findings (and shots) go; default <tmp>/rtb-layout
//   ONLY=<regex>       only the matching states, e.g. ONLY="popup|hold"
//   SIZES=desk|phone   one device class only
//   FAMILY=tr          the board and panels on another family (base sc hs tr ls)
//   RTB_LANG=ru        another locale (long words: ru fi de; RTL: ar)
//   SHOTS=1            also save a viewport PNG per state and size
//   SHOW_ALL=1         include the known by-design findings (NOISE below)
//   CSS="<rules>"      inject a stylesheet into every page: try a fix before
//                      writing it, or break something on purpose to prove the
//                      sweep still sees it (the bar's Last Win pushed onto
//                      Balance: CSS=".cb-lastwin{transform:translateX(-80px)}")
//   GAME=http://localhost:3002  RGS=localhost:3011   other servers
// Needs the global Playwright CLI (npm i -g @playwright/cli). Never point it at
// the owner's 3001/3010: it forces a resume on the RGS it is given.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(`${execSync('npm root -g').toString().trim()}/@playwright/cli/node_modules/playwright`);

const GAME = process.env.GAME || 'http://localhost:3002';
const RGS = process.env.RGS || 'localhost:3011';
const OUT = process.env.OUT || join(tmpdir(), 'rtb-layout');
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const FAMILY = process.env.FAMILY || null;
const LANG = process.env.RTB_LANG || 'en';
const SHOTS = !!process.env.SHOTS;
const CLASSES = {
  desk: { sizes: [[1200, 675], [1024, 576], [800, 450], [400, 225]], ctx: {} },
  phone: { sizes: [[425, 812], [375, 667], [320, 568]], ctx: { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
};
// True by design, learned by looking: the cast and the room's props run off
// the screen's edges behind the table on purpose; screen-reader-only text is a
// 1px box; the Equal button sits ON the seam between Higher and Lower (and
// Inside and Outside) by the owner's call, so it overlaps both halves.
const NOISE = /\.cast|\.room-|visually-hidden|\.floor-cast|\.wall-|equal-btn/;
const findings = [];
mkdirSync(OUT, { recursive: true });

const base = `${GAME}/?currency=USD&lang=${LANG}&rgs_url=${encodeURIComponent(RGS)}`;
const replayUrl = (mode, event) => `${GAME}/?replay=true&game=ride_the_bus&version=1&mode=${mode}&event=${event}&currency=USD&amount=1000000&lang=${LANG}&rgs_url=${encodeURIComponent(RGS)}`;

function measure(scopeSel) {
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const phone = matchMedia('(orientation: portrait) and (max-width: 620px)').matches;
  const out = [];
  const shown = el => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (el.closest('[inert]')) return false;
    let op = 1;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      op *= Number(cs.opacity);
    }
    return op > 0.05;
  };
  const path = el => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 3; e = e.parentElement)
      parts.unshift(e.id ? '#' + e.id : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).filter(c => !c.startsWith('svelte-')).slice(0, 2).join('.') : ''));
    const text = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 24);
    return parts.join(' > ') + (text ? ` "${text}"` : '');
  };
  const scroller = el => { for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY)) return e; } return null; };
  const clipper = el => { for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY)) return null; if (/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) return e; } return null; };
  // Own text only: an element whose own child nodes carry the words.
  const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
  // Rendered size: computed font-size times any scale the element is drawn at.
  const drawnSize = el => { const fs = parseFloat(getComputedStyle(el).fontSize); const k = el.offsetHeight ? el.getBoundingClientRect().height / el.offsetHeight : 1; return fs * (k > 0.05 ? k : 1); };

  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) out.push(['frame-scrolls-x', `by ${de.scrollWidth - de.clientWidth}px`]);
  if (de.scrollHeight > de.clientHeight + 1) out.push(['frame-scrolls-y', `by ${de.scrollHeight - de.clientHeight}px`]);

  const scope = (scopeSel && document.querySelector(scopeSel)) || document.body;
  const all = [...scope.querySelectorAll('*')].filter(e => !(e instanceof SVGElement) || e.tagName === 'svg');
  const controls = all.filter(e => /^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(e.tagName) || e.getAttribute('role') === 'button').filter(shown);
  const texts = all.filter(e => !(e instanceof SVGElement) && ownText(e) && !e.closest('[aria-hidden="true"]')).filter(shown);

  for (const el of [...controls, ...texts]) {
    const r = el.getBoundingClientRect();
    const sc = scroller(el);
    const box = sc ? sc.getBoundingClientRect() : { left: 0, top: 0, right: vw, bottom: vh };
    if (!sc && (r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1)) out.push(['off-screen', `${path(el)} [${Math.round(r.left)},${Math.round(r.top)}..${Math.round(r.right)},${Math.round(r.bottom)} of ${vw}x${vh}]`]);
    if (sc && (r.left < box.left - 1 || r.right > box.right + 1) && getComputedStyle(sc).overflowX !== 'auto') out.push(['off-scroller', `${path(el)} outside ${path(sc).split(' "')[0]}`]);
  }
  for (const el of controls) {
    const c = clipper(el);
    if (!c) continue;
    const r = el.getBoundingClientRect(), cr = c.getBoundingClientRect();
    const cut = Math.max(cr.left - r.left, r.right - cr.right, cr.top - r.top, r.bottom - cr.bottom);
    if (cut > 2) out.push(['clipped', `${path(el)} cut ${Math.round(cut)}px by ${path(c).split(' "')[0]}`]);
  }
  for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
    const a = controls[i], b = controls[j];
    if (a.contains(b) || b.contains(a)) continue;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 4 && h > 4) out.push(['controls-overlap', `${path(a)} / ${path(b)}`]);
  }
  // The floor is read off the page (--type-floor: 6px, 9px on an upright
  // phone), and reported once per screen: the smallest text and what sits
  // under the floor. A panel takes the floor as one unit at Popout S, so text
  // under it there is the panel's design, not a defect - look before calling it.
  const floor = parseFloat(getComputedStyle(de).getPropertyValue('--type-floor')) || (phone ? 9 : 6);
  // The words' own boxes, never the element's: a button's tap area or a
  // pseudo-element widens scrollWidth without any text leaving its box.
  const boxes = texts.map(el => {
    const rg = document.createRange(); const rects = [];
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { rg.selectNodeContents(n); rects.push(...[...rg.getClientRects()].filter(x => x.width > 1)); }
    return { el, rects };
  });
  const under = [];
  let smallest = Infinity;
  for (const { el, rects } of boxes) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!cs.display.startsWith('inline') && /visible/.test(cs.overflowX) && r.width > 0) {
      const spill = Math.max(0, ...rects.map(t => Math.max(r.left - t.left, t.right - r.right)));
      if (spill > 2) out.push(['text-spills', `${path(el)} (${Math.round(spill)}px out)`]);
    }
    const px = drawnSize(el);
    smallest = Math.min(smallest, px);
    if (px < floor - 0.05) under.push(`${path(el).split(' > ').pop()} ${px.toFixed(1)}px`);
  }
  if (under.length) out.push(['type-below-floor', `${under.length} under ${floor}px, smallest ${smallest.toFixed(1)}px: ${under.slice(0, 3).join('; ')}`]);
  // Text on text: the takeover once printed the guess captions on the line of
  // the win's multiplier. Words from one control are left alone, and so is a
  // pair where something opaque lies between them (the intro's scrim over the
  // board's title): that one is covered, not overprinted.
  const covered = (x, y, A, B) => {
    const stack = document.elementsFromPoint(x, y);
    // Text with pointer-events: none is not in the stack; its nearest
    // ancestor that is stands in for it.
    const at = el => { const i = stack.findIndex(e => e === el || el.contains(e)); return i >= 0 ? i : stack.findIndex(e => e.contains(el)); };
    const ia = at(A), ib = at(B);
    if (ia < 0 || ib < 0) return false;
    for (const e of stack.slice(Math.min(ia, ib) + 1, Math.max(ia, ib))) {
      // A layer holding the LOWER text is its own background; one holding
      // only the upper text (the intro's scrim, behind its title) still covers.
      if (e.contains(ia > ib ? A : B)) continue;
      const cs = getComputedStyle(e);
      const alpha = (cs.backgroundColor.match(/[\d.]+/g) || []).map(Number);
      if ((alpha.length === 4 ? alpha[3] : alpha.length === 3 ? 1 : 0) >= 0.5 || cs.backgroundImage !== 'none' || cs.backdropFilter !== 'none') return true;
    }
    return false;
  };
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const A = boxes[i], B = boxes[j];
    if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
    pair: for (const ra of A.rects) for (const rb of B.rects) {
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w <= 3 || h <= 3) continue;
      const x = Math.max(ra.left, rb.left) + w / 2, y = Math.max(ra.top, rb.top) + h / 2;
      if (!covered(x, y, A.el, B.el)) out.push(['text-on-text', `${path(A.el)} / ${path(B.el)}`]);
      break pair;
    }
  }
  return out;
}

// Measure the page as it stands. Every state is loaded fresh at each size,
// never resized into: the deal, the title hand-off, the squeeze and the
// takeover's hand all measure the board once when they start, so a window
// resized under them reports defects no player can see.
async function sweep(page, label, size, cls, scopeSel = null, settle = 350) {
  if (ONLY && !ONLY.test(label)) return;
  await page.waitForTimeout(settle);
  let res;
  try { res = await page.evaluate(measure, scopeSel); } catch (e) { res = [['audit-error', String(e.message).slice(0, 120)]]; }
  for (const [kind, detail] of res) findings.push({ label, size: size.join('x'), cls, kind, detail });
  if (SHOTS) await page.screenshot({ path: join(OUT, `${label.replace(/\//g, '-')}-${size.join('x')}.png`) }).catch(() => {});
  process.stdout.write('.');
}

async function fresh(browser, cls, size, { peelMyself = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, ...cls.ctx });
  await ctx.addInitScript(([family, peel]) => {
    try {
      if (family) localStorage.setItem('ride-the-bus:picks', JSON.stringify({ family, mode: null }));
      else localStorage.removeItem('ride-the-bus:picks');
      localStorage.setItem('ride-the-bus:peel-myself', peel ? '1' : '0');
    } catch {}
  }, [FAMILY, peelMyself]);
  if (process.env.CSS) await ctx.addInitScript(css => addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style'); s.textContent = css; document.head.append(s);
  }), process.env.CSS);
  const page = await ctx.newPage();
  page.on('pageerror', e => findings.push({ label: 'page', size: '-', cls: '-', kind: 'page-error', detail: String(e.message).slice(0, 160) }));
  return { ctx, page };
}

const POPUPS = [['bet', '.cb-bet-display'], ['mode', '.cb-mode-btn'], ['turbo', '.cb-turbo'], ['sound', '.cb-sound'], ['info', '.cb-info'], ['autospin', '.cb-autospin']];
const tag = FAMILY ? `${FAMILY}/` : '';

// The CLI's own headless shell is not always downloaded; installed Chrome is.
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const failed = (label, size, cls, detail) => findings.push({ label, size: size.join('x'), cls, kind: 'audit-error', detail });
for (const [name, cls] of Object.entries(CLASSES)) {
  if (process.env.SIZES && process.env.SIZES !== name) continue;
  for (const size of cls.sizes) {
    // The intro, the board, the board with four picks, every panel.
    {
      const { ctx, page } = await fresh(browser, cls, size);
      await page.goto(base);
      await page.waitForSelector('.ss-continue', { timeout: 30000 });
      await sweep(page, `${tag}intro`, size, name, null, 900);
      await page.click('.ss-continue');
      await sweep(page, `${tag}board`, size, name, null, 1600);
      for (const k of ['1', '2', '3', '4']) { await page.keyboard.press(k); await page.waitForTimeout(120); }
      await sweep(page, `${tag}board-picked`, size, name);
      for (const [popup, sel] of POPUPS) {
        if (ONLY && !ONLY.test(`${tag}popup-${popup}`)) continue;
        const ok = await page.locator(sel).first().click({ timeout: 3000 }).then(() => true, () => false);
        if (!ok) { failed(`${tag}popup-${popup}`, size, name, `could not open ${sel}`); continue; }
        await page.waitForSelector('.popup', { timeout: 3000 }).catch(() => {});
        await sweep(page, `${tag}popup-${popup}`, size, name, '.popup');
        await page.keyboard.press('Escape');
        await page.locator('.popup-close').first().click({ timeout: 800 }).catch(() => {});
        await page.waitForTimeout(250);
      }
      await ctx.close();
    }

    // The held last card, waiting for the player's hand (the peel switch on),
    // so it holds still while it is measured.
    if (!ONLY || ONLY.test('hold')) {
      const { ctx, page } = await fresh(browser, cls, size, { peelMyself: true });
      const ok = await fetch(`http://${RGS}/__force-resume/red_equal_equal_heart/max`).then(r => r.ok, () => false);
      if (!ok) failed('hold', size, name, `no forced resume on ${RGS}`);
      else {
        await page.goto(`${base}&sessionID=audit-${Date.now()}`);
        await page.waitForSelector('.ss-continue', { timeout: 30000 });
        await page.click('.ss-continue');
        const held = await page.waitForSelector('.squeeze.out', { timeout: 20000 }).then(() => true, () => false);
        if (held) await sweep(page, 'hold', size, name, null, 900);
        else failed('hold', size, name, 'the held card never went out (.squeeze.out)');
      }
      await ctx.close();
    }

    // A Max takeover, once its count has landed.
    if (!ONLY || ONLY.test('takeover')) {
      const { ctx, page } = await fresh(browser, cls, size);
      await page.goto(replayUrl('red_equal_equal_heart', 'max'));
      await page.waitForSelector('.ss-play-btn', { timeout: 30000 });
      await page.click('.ss-play-btn');
      const up = await page.waitForSelector('.wc-prompt.is-ready', { timeout: 45000 }).then(() => true, () => false);
      if (up) await sweep(page, 'takeover', size, name, '.wc-overlay', 500);
      else failed('takeover', size, name, 'the takeover never settled (.wc-prompt.is-ready)');
      await ctx.close();
    }
  }
}
await browser.close();

writeFileSync(join(OUT, 'layout-findings.json'), JSON.stringify(findings, null, 1));
const shown = process.env.SHOW_ALL ? findings : findings.filter(f => !NOISE.test(f.detail));
const groups = new Map();
for (const f of shown) {
  // The type summary differs at every size, so it groups by state and keeps
  // its detail; everything else groups by what was found.
  const typeRow = f.kind === 'type-below-floor';
  const k = typeRow ? `${f.kind} | ${f.label}` : `${f.kind} | ${f.label} | ${f.detail.replace(/\[[^\]]*\]|\(\d+ in \d+\)|by \d+px|cut \d+px/g, '…')}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(typeRow ? `\n    ${f.size}: ${f.detail}` : f.size);
}
console.log(`\n${findings.length} findings (${findings.length - shown.length} known by-design hidden), ${groups.size} distinct. Raw: ${join(OUT, 'layout-findings.json')}`);
for (const [k, s] of [...groups].sort()) console.log(`${k}  @ ${s.join(', ')}`);
