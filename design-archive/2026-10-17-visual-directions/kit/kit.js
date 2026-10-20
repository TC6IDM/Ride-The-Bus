/* Phase 2 mock-up kit. The geometry is MEASURED off the live game (3002, 2026-10-17),
   the card art follows suitPaths.ts and cardFaceLayout.ts exactly. Mock-only. */
(function () {
  const GEO = {
    desk: {
      w: 1200, h: 675, lockup: { x: 464.7, y: 9.4, w: 270.6, h: 80.2, size: 50 },
      slots: [371.8, 491.6, 611.4, 731.2].map((x) => ({ x, y: 159.9, w: 97, h: 144.4 })),
      squares: [390.9, 501.1, 611.4, 721.6].map((x) => ({ x, y: 453.6, w: 87.5, h: 87.5 })),
      labelsY: 419.6, deck: { x: 291.5, y: 155, w: 72.9, h: 80.2 }, die: { x: 833.6, y: 470.3, w: 54.2, h: 54.2 },
      table: { x: 161.3, y: 40.9, w: 877.5, h: 593.3 }, route: { x: 420.3, y: 315.7, w: 359.4 }, bar: { y: 581, h: 94 },
    },
    phone: {
      w: 390, h: 664, lockup: { x: 84, y: 7.7, w: 222, h: 66.6, size: 40 },
      slots: [24.4, 111.6, 198.9, 286.1].map((x) => ({ x, y: 173.7, w: 79.5, h: 118.4 })),
      squares: [40, 119.4, 198.9, 278.3].map((x) => ({ x, y: 393.5, w: 71.7, h: 71.7 })),
      labelsY: 365.6, deck: { x: 78.2, y: 91.9, w: 40.2, h: 44.2 }, die: { x: 64.4, y: 475.2, w: 44.5, h: 44.5 },
      table: { x: -46.8, y: 50.9, w: 483.6, h: 509 }, route: { x: 64.1, y: 296, w: 261.8 }, bar: { y: 539.6, h: 124.4 },
    },
  };
  const size = () => (innerWidth < 600 ? 'phone' : 'desk');
  const g = GEO[size()];

  const SUIT = {
    heart: ['M12 21.4C12 21.4 2.6 15.1 2.6 9C2.6 5.7 5.1 3.2 8.2 3.2C10 3.2 11.3 4.1 12 5.3C12.7 4.1 14 3.2 15.8 3.2C18.9 3.2 21.4 5.7 21.4 9C21.4 15.1 12 21.4 12 21.4Z'],
    diamond: ['M12 2.2C12 2.2 14.4 6.6 19.3 12C14.4 17.4 12 21.8 12 21.8C12 21.8 9.6 17.4 4.7 12C9.6 6.6 12 2.2 12 2.2Z'],
    club: [circle(12, 7.1, 4.05), circle(6.85, 14.3, 4.05), circle(17.15, 14.3, 4.05), 'M12 12.3C13 16 13.3 18.9 15.2 21.7H8.8C10.7 18.9 11 16 12 12.3Z'],
    spade: ['M12 2.3C12 2.3 3.4 9 3.4 14C3.4 16.7 5.5 18.6 8 18.6C9.6 18.6 10.9 17.8 11.6 16.7C11.4 18.9 10.6 20.5 9 21.7H15C13.4 20.5 12.6 18.9 12.4 16.7C13.1 17.8 14.4 18.6 16 18.6C18.5 18.6 20.6 16.7 20.6 14C20.6 9 12 2.3 12 2.3Z'],
  };
  function circle(cx, cy, r) { return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`; }
  const CROWN = '<path d="M2.5 16.5 4 7l4.2 4.6L12 4.5l3.8 7.1L20 7l1.5 9.5Z"/><rect x="2.5" y="17.6" width="19" height="2.6" rx="0.6"/><circle cx="4" cy="6.2" r="1.3"/><circle cx="12" cy="3.6" r="1.3"/><circle cx="20" cy="6.2" r="1.3"/>';
  const W = 200, H = 298, CX = 100, CY = 149, TOP = 58, BOTTOM = H - 58;
  const at = (f) => TOP + (BOTTOM - TOP) * f;
  const COL = { l: 57, c: CX, r: W - 57 };
  const LAYOUT = {
    2: { s: [], c: [0, 1] }, 3: { s: [], c: [0, 0.5, 1] }, 4: { s: [0, 1], c: [] }, 5: { s: [0, 1], c: [0.5] },
    6: { s: [0, 0.5, 1], c: [] }, 7: { s: [0, 0.5, 1], c: [0.25] }, 8: { s: [0, 0.5, 1], c: [0.25, 0.75] },
    9: { s: [0, 1 / 3, 2 / 3, 1], c: [0.5] }, 10: { s: [0, 1 / 3, 2 / 3, 1], c: [1 / 6, 5 / 6] },
  };
  const isRed = (s) => s === 'heart' || s === 'diamond';
  const pip = (suit, x, y, size, inv, cls = '') =>
    `<g class="pip ${cls}" transform="translate(${x} ${y})${inv ? ' rotate(180)' : ''} scale(${size / 24}) translate(-12 -12)">${SUIT[suit].map((d) => `<path d="${d}"/>`).join('')}</g>`;
  const crown = (x, y, size, inv, cls = 'crown') =>
    `<g class="${cls}" fill="var(--court-gold)" transform="translate(${x} ${y})${inv ? ' rotate(180)' : ''} scale(${size / 24}) translate(-12 -12)">${CROWN}</g>`;

  /* One face. opts.under = SVG drawn beneath the pips (a frame, a watermark);
     opts.over = SVG drawn above. Ink follows the one-colour-family rule. */
  function face(rank, suit, opts = {}) {
    const ink = isRed(suit) ? 'var(--card-red)' : 'var(--card-ink)';
    const deep = isRed(suit) ? 'var(--court-red-deep)' : 'var(--court-ink-tone)';
    let body = '';
    if (rank === 'A') {
      body = `<circle cx="${CX}" cy="${CY}" r="58" fill="none" stroke="var(--court-gold)" stroke-width="1.2"/>` + pip(suit, CX, CY, 92, false);
    } else if (!LAYOUT[rank]) {
      // A court, exactly as CardFace draws one: the English-pattern figure from
      // courts.svg (COURT_PANEL), the two frame strokes, a pip and a crown each end.
      const S = { spade: 'S', heart: 'H', diamond: 'D', club: 'C' }[suit];
      const art = courtsReady
        ? `<use href="#court-${rank}${S}" x="16.667" y="16.556" width="166.667" height="264.889"/>`
        : `<text x="${CX}" y="${CY + 40}" text-anchor="middle" font-family="Big Shoulders, sans-serif" font-weight="900" font-size="112" fill="${deep}">${rank}</text>`;
      body = art +
        `<path d="M33.333 16.556H183.333V215.222M16.667 82.778V281.444H166.667" fill="none" stroke="${isRed(suit) ? 'var(--court-red-deep)' : 'var(--card-ink)'}" stroke-width="1.1"/>` +
        pip(suit, 50, 55.667, 26, false) + crown(50, 34.667, 22, false) + pip(suit, W - 50, H - 55.667, 26, true) + crown(W - 50, H - 34.667, 22, true);
    } else {
      const L = LAYOUT[rank];
      const pips = [...L.s.flatMap((f) => [[COL.l, f], [COL.r, f]]), ...L.c.map((f) => [COL.c, f])];
      body = pips.map(([x, f]) => { const y = at(f); return pip(suit, x, y, 42 * (opts.pipScale || 1), y > CY + 0.01); }).join('');
    }
    // INDEX from cardFaceLayout.ts: rank and pip centred on x = 17.
    const index = (inv) => `<g transform="${inv ? `rotate(180 ${CX} ${CY})` : ''}"><text x="17" y="45.4" text-anchor="middle" font-family="Big Shoulders, sans-serif" font-weight="700" font-size="36" fill="${ink}">${rank}</text>${pip(suit, 17, 60.4, 20, false)}</g>`;
    const red = isRed(suit);
    // The six roles the court sprite is painted in (CardFace.svelte), per colour family.
    const roles = `--cf-p:var(--card-paper);--cf-g:var(--court-gold);--cf-t:${red ? 'var(--card-red)' : 'var(--court-ink-tone)'};--cf-d:${red ? 'var(--court-red-deep)' : 'var(--card-ink)'};--cf-l:${red ? 'var(--court-red-deep)' : 'var(--card-ink)'};--cf-b:${red ? 'var(--court-red-tint)' : 'var(--court-ink-tint)'}`;
    return `<svg viewBox="0 0 ${W} ${H}" style="--ink:${ink};--deep:${deep};${roles}"><g fill="${ink}">${opts.under ? opts.under(ink, deep, rank, suit) : ''}${body}${opts.noIndex ? '' : index(false) + index(true)}${opts.over ? opts.over(ink, deep, rank, suit) : ''}</g></svg>`;
  }

  /* The court figures: fetched once and put in the page, drawn by <use> (courtArt.svelte.ts). */
  let courtsReady = false;
  const courts = () => fetch('kit/courts.svg').then((r) => r.text()).then((t) => {
    const doc = new DOMParser().parseFromString(t, 'image/svg+xml');
    const host = document.importNode(doc.documentElement, true);
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    document.body.appendChild(host); courtsReady = true;
  }).catch(() => {});

  /* Absolutely place a node over a measured rect. */
  function place(el, r) { Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' }); return el; }
  function el(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function lockup(parent) {
    const L = el('div', 'lockup', '<span class="main">Ride The Bus</span><span class="sub">by Takeover Casino</span>');
    place(L, g.lockup); L.style.setProperty('--lockup-size', g.lockup.size + 'px'); parent.appendChild(L); return L;
  }
  function backdrop(node, which) { node.style.backgroundImage = `url('kit/${which}-${size()}.${which.startsWith('table') ? 'webp' : (size() === 'phone' ? 'jpg' : 'jpg')}')`; }
  function scene(node, props = true) { node.style.backgroundImage = `url('kit/${props ? 'scene' : 'scene-bare'}-${size()}${size() === 'phone' ? '-2x' : ''}.jpg')`; }
  function table(node, props = true) { node.style.backgroundImage = `url('kit/${props ? 'table' : 'table-bare'}-${size()}.webp')`; }
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Run a demo, then reset and run it again every `ms` (mock-up only). */
  function loop(ms, run) {
    let t;
    const go = () => { run(); if (!reduced()) t = setTimeout(go, ms); };
    go();
    return () => clearTimeout(t);
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));

  window.RTB = { GEO, g, size, face, pip, crown, isRed, place, el, lockup, scene, table, loop, wait, reduced, SUIT, courts };
})();
