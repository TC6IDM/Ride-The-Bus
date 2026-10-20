/* Win takeover mock kit (W1-W3). The board under it is photographed off the live
   build with today's takeover hidden (kit/tk-under-*.png); the hand is the round's
   own four cards drawn by kit.js's face(), dealt OUT of their board slots and sent
   back INTO them on exit - the spatial story today's takeover lacks. Classic's
   ladder (winTiers.ts: 10 / 40 / 120 / 300, Max 1354.2) and the takeover's own
   tier colours (win-celebration.css .tier-*). Mock-only. */
(function () {
  const { g, size, face, el, reduced } = RTB;
  const phone = size() === 'phone';
  const TIERS = [
    { id: 'big', word: 'Big Win', at: 10, rgb: '61, 220, 132', deep: '#17663a', spread: 0.82 },
    { id: 'huge', word: 'Huge Win', at: 40, rgb: '255, 201, 60', deep: '#a1730c', spread: 0.98 },
    { id: 'mega', word: 'Mega Win', at: 120, rgb: '255, 92, 92', deep: '#8f1f1f', spread: 1.14 },
    { id: 'epic', word: 'Epic Win', at: 300, rgb: '178, 124, 200', deep: '#472853', spread: 1.3 },
    { id: 'max', word: 'Max Win', at: 1354.2, rgb: '255, 233, 168', deep: '#a80828', spread: 1.48 },
  ];
  const HAND = [['2', 'heart'], ['2', 'spade'], ['2', 'diamond'], ['3', 'heart']];

  const css = document.createElement('style');
  css.textContent = `
    .wt-veil { position: absolute; inset: 0; z-index: 2; background: rgba(10, 6, 3, 0.74); opacity: 0; transition: opacity 260ms var(--ease-out); }
    .wt-veil.on { opacity: 1; }
    /* One beam from the upper right, still: today's breathes on a 7.2s loop forever. */
    .wt-veil::after { content: ''; position: absolute; inset: 0; background: radial-gradient(70% 90% at 88% -12%, rgba(255, 236, 200, 0.11), transparent 62%); }
    .wt-layer { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
    .wt-card { position: absolute; transform-origin: 50% 50%; z-index: 4; }
    .wt-card.settling { transition: transform 520ms var(--ease-out); }
    .wt-card .face { position: absolute; inset: 0; box-shadow: inset 0 0 0 1.5px var(--card-edge), 0 0 0 1.5px rgba(var(--rim), 0.9), 0 10px 22px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.5); transition: box-shadow 300ms var(--ease-out); }
    .wt-prompt { position: absolute; left: 0; right: 0; text-align: center; font: 700 ${phone ? 15 : 15}px/1 var(--font-body); color: var(--ink-strong); opacity: 0; transition: opacity 200ms var(--ease-out); }
    .wt-prompt.on { opacity: 0.86; }
    .wt-mult { position: absolute; left: 0; right: 0; text-align: center; font: 800 ${phone ? 15 : 17}px/1 var(--font-body); font-variant-numeric: tabular-nums; color: var(--gold); }
    .wt-fade { transition: opacity 220ms var(--ease-out), transform 260ms var(--ease-out); }
    .wt-gone { opacity: 0 !important; transform: translateY(10px); }`;
  document.head.appendChild(css);

  const money = (m) => '$' + m.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mult = (m) => m.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '×';

  /* The stage: the board, the veil, and a layer the direction draws on. */
  function stage(root) {
    root.innerHTML = '';
    const bg = el('div', 'layer bg'); bg.style.backgroundImage = `url('kit/tk-under-${size()}.png')`;
    const veil = el('div', 'wt-veil'), layer = el('div', 'wt-layer');
    root.append(bg, veil, layer);
    return { root, veil, layer };
  }

  /* The hand. Each card's resting transform is the fan; it is dealt from, and
     returned to, the board slot it was turned over in. */
  function hand(layer, { cx, cy, w }, opts = {}) {
    const h = w * 1.49;
    const cards = HAND.map(([r, s], i) => {
      const c = el('div', 'wt-card', `<div class="face">${face(r, s)}</div>`);
      Object.assign(c.style, { left: cx - w / 2 + 'px', top: cy - h / 2 + 'px', width: w + 'px', height: h + 'px' });
      c.style.setProperty('--rim', TIERS[0].rgb);
      layer.appendChild(c); return c;
    });
    const fanT = (i, sp) => {
      const k = i - 1.5;
      return `translate(${k * w * 0.64 * sp}px, ${k * k * w * 0.05 * sp}px) rotate(${k * 6.5 * sp}deg)`;
    };
    const slotT = (i) => {
      const s = g.slots[i];
      return `translate(${s.x + s.w / 2 - cx}px, ${s.y + s.h / 2 - cy}px) scale(${s.w / w})`;
    };
    let spread = TIERS[0].spread, breaths = [];
    // A slow breath, layered ON the fan with composite 'add' (hopFan's method),
    // so a rung's re-spread and the breath never fight over one transform.
    const breathe = () => {
      if (!opts.breathe || reduced()) return;
      breaths = cards.map((c, i) => c.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-w * 0.05}px)` }],
        { duration: 1700, delay: i * 210, direction: 'alternate', iterations: Infinity, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', composite: 'add' }));
    };
    return {
      cards,
      dealIn() {
        return Promise.all(cards.map((c, i) => {
          c.style.transform = fanT(i, spread);
          if (reduced()) return c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }).finished;
          return c.animate([{ transform: slotT(i) }, { transform: fanT(i, spread) }],
            { duration: 560, delay: i * 55, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'backwards' }).finished;
        })).then(breathe);
      },
      tier(t) {
        spread = t.spread;
        cards.forEach((c, i) => { c.classList.add('settling'); c.style.transform = fanT(i, spread); c.style.setProperty('--rim', t.rgb); });
      },
      exit() {
        breaths.forEach((b) => b.cancel());
        return Promise.all(cards.map((c, i) => {
          c.classList.remove('settling');
          if (reduced()) return c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' }).finished;
          return c.animate([{ transform: fanT(i, spread) }, { transform: slotT(i) }],
            { duration: 460, delay: (3 - i) * 40, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' }).finished;
        }));
      },
    };
  }

  /* The count, leg by leg through the ladder. onTier(i) fires as the count
     reaches a rung; Big is up from the start, as in the game. */
  function count(gen, onValue, onTier) {
    return new Promise((resolve) => {
      const legs = TIERS.map((t, i) => ({ from: i ? TIERS[i - 1].at : 0, to: t.at, ms: reduced() ? 1 : i === 4 ? 1500 : 820 }));
      let leg = 0, t0 = performance.now();
      onTier(0);
      const ease = (x) => 1 - Math.pow(1 - x, 3);
      const step = (now) => {
        if (gen()) return resolve(false);
        const L = legs[leg], p = Math.min(1, (now - t0) / L.ms);
        onValue(L.from + (L.to - L.from) * ease(p));
        if (p < 1) return requestAnimationFrame(step);
        if (leg > 0) onTier(leg);
        leg += 1;
        if (leg >= legs.length) return resolve(true);
        setTimeout(() => { t0 = performance.now(); requestAnimationFrame(step); }, reduced() ? 380 : 300);
      };
      requestAnimationFrame(step);
    });
  }

  /* Play a takeover in a loop: run(gen) builds and plays; a new cycle bumps gen. */
  function cycle(root, run, ms = 15500) {
    let n = 0;
    const go = () => { const mine = ++n; run(() => mine !== n); };
    go(); setInterval(go, ms);
  }

  /* The chip burst: the table's own chips, flat and seen from above, thrown out
     from BEHIND the hand. A steady stream that thickens at every rung, plus a
     burst as each rung lands. Colours are tokens.css's --chip-* sets (table.css
     .chip-red etc.): rim colour, face, dark ring and the eight cream spots. */
  const CHIP_SET = [
    ['#931228', '#a80828', '#6c0619', '#e0dad0'], ['#235c26', '#2a682c', '#113611', '#dcd6cb'],
    ['#211d1c', '#2a2624', '#100e0d', '#e8e4dc'], ['#17457a', '#1c4f8a', '#0d2b4f', '#dedbd4'],
    ['#cfc8bb', '#ece8e0', '#cec6b9', '#077dd0'],
  ];
  const THROW = [1, 1.15, 1.32, 1.5, 1.75];
  const RATE = [3, 5, 8, 11, 14];       // chips a second in the stream
  const BURST = [6, 8, 10, 12, 16];     // thrown at once as a rung lands
  css.textContent += `
    .wt-chips { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
    .wt-chip { position: absolute; width: var(--d); height: var(--d); margin: calc(var(--d) / -2) 0 0 calc(var(--d) / -2); }
    .wt-chip i { position: absolute; inset: 0; border-radius: 50%; }
    /* The face, seen square-on: cream spots round the rim, a hard dark ring, the flat centre. */
    .wt-chip .f { background:
      linear-gradient(56deg, rgba(0,0,0,0.2) 0%, transparent 34%, rgba(255,255,255,0.14) 100%),
      radial-gradient(closest-side, transparent 0 40%, rgba(0,0,0,0.16) 40% 43%, transparent 43%),
      radial-gradient(closest-side, transparent 0 64%, rgba(0,0,0,0.42) 64% 68%, transparent 68%),
      radial-gradient(closest-side, var(--cf) 0 71%, transparent 71%),
      repeating-conic-gradient(from -11.25deg, var(--cc) 0 22.5deg, var(--c) 22.5deg 45deg);
      box-shadow: inset 0 0 0 1px rgba(0,0,0,0.3), 0 2px 0 var(--ck), 0 5px 9px rgba(0,0,0,0.4); }`;
  function chip(host, x, y, d, set) {
    const [c, cf, ck, cc] = set;
    // Flat (owner's call): the face only, seen from above, spinning in the plane.
    const n = el('span', 'wt-chip', '<i class="f"></i>');
    n.style.cssText = `--d:${d}px;--c:${c};--cf:${cf};--ck:${ck};--cc:${cc};left:${x}px;top:${y}px`;
    host.appendChild(n); return n;
  }
  function throwChip(host, { cx, cy, w }, tier, k) {
    const d = (phone ? 22 : 30) * (0.85 + Math.random() * 0.3);
    const n = chip(host, cx + (Math.random() - 0.5) * w * 1.7, cy + (Math.random() - 0.5) * w * 0.5, d, CHIP_SET[Math.floor(Math.random() * CHIP_SET.length)]);
    const side = Math.random() < 0.5 ? -1 : 1, reach = (phone ? 170 : 360) * THROW[tier], drop = phone ? 320 : 380;
    const R = side * reach * (0.3 + Math.random() * 0.7), Hp = (60 + Math.random() * 100) * THROW[tier];
    const rz = (Math.random() - 0.5) * 360, spin = (0.6 + Math.random() * 1.2) * 360 * side;
    const frames = Array.from({ length: 15 }, (_, i) => {
      const t = i / 14, x = R * (1 - Math.pow(1 - t, 1.5)), y = -4 * Hp * t * (1 - t) + drop * t * t;
      return { transform: `translate(${x}px, ${y}px) rotate(${rz + spin * t}deg) scale(${Math.min(1, 0.6 + t * 3)})`, opacity: t < 0.74 ? 1 : 1 - (t - 0.74) / 0.26 };
    });
    n.animate(frames, { duration: 1250 + Math.random() * 450, delay: k * 9, easing: 'linear', fill: 'both' }).finished.then(() => n.remove());
  }
  /* The emitter: start() once the hand is down, level(i) at every rung (which
     also throws that rung's burst), stop() on Continue - chips in the air finish. */
  function chips(layer, handGeo, stale) {
    const host = el('div', 'wt-chips'); layer.appendChild(host);
    let tier = 0, on = false, acc = 0, last = 0;
    const scale = phone ? 0.6 : 1;
    const tick = (now) => {
      if (!on || stale()) return;
      acc += RATE[tier] * scale * Math.min(0.05, (now - last) / 1000); last = now;
      while (acc >= 1) { acc -= 1; throwChip(host, handGeo, tier, 0); }
      requestAnimationFrame(tick);
    };
    return {
      start() { if (reduced()) return; on = true; last = performance.now(); requestAnimationFrame(tick); },
      level(i) { tier = i; if (reduced() || !on) return; for (let k = 0; k < Math.round(BURST[i] * scale); k++) throwChip(host, handGeo, i, k); },
      stop() { on = false; },
    };
  }

  window.WT = { TIERS, HAND, phone, money, mult, stage, hand, count, cycle, chips };
})();
