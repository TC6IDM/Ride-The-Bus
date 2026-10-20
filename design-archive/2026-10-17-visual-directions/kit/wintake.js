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
  function hand(layer, { cx, cy, w }) {
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
    let spread = TIERS[0].spread;
    return {
      cards,
      dealIn() {
        return Promise.all(cards.map((c, i) => {
          c.style.transform = fanT(i, spread);
          if (reduced()) return c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }).finished;
          return c.animate([{ transform: slotT(i) }, { transform: fanT(i, spread) }],
            { duration: 560, delay: i * 55, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'backwards' }).finished;
        }));
      },
      tier(t) {
        spread = t.spread;
        cards.forEach((c, i) => { c.classList.add('settling'); c.style.transform = fanT(i, spread); c.style.setProperty('--rim', t.rgb); });
      },
      exit() {
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

  /* The chip burst: the table's own chips thrown out from BEHIND the hand, one
     moment per rung (keyed on the tier, never a loop). Each tier throws more and
     further - intensity, never presence: Big still gets a burst. The chips are
     the rack's colours seen from above, tumbling edge-on as they fly. */
  const CHIP_SET = [['#1b1b1d', '#f2ede2'], ['#2f8a4a', '#f2ede2'], ['#2a5ea8', '#f2ede2'], ['#b3202f', '#f2ede2'], ['#f2ede2', '#2f6fb3']];
  const BURST = [{ n: 6, throw: 1 }, { n: 8, throw: 1.15 }, { n: 10, throw: 1.32 }, { n: 12, throw: 1.5 }, { n: 16, throw: 1.75 }];
  css.textContent += `
    .wt-chip { position: absolute; z-index: 3; width: var(--d); height: var(--d); margin: calc(var(--d) / -2) 0 0 calc(var(--d) / -2); border-radius: 50%; pointer-events: none;
      background: radial-gradient(circle, var(--face) 0 52%, var(--edge) 53% 58%, var(--face) 59% 66%, transparent 67%), repeating-conic-gradient(from 6deg, var(--edge) 0 16deg, var(--face) 16deg 45deg);
      box-shadow: 0 2px 0 rgba(0,0,0,0.45), 0 6px 10px rgba(0,0,0,0.35); }`;
  function burst(layer, { cx, cy, w }, tierIndex) {
    if (reduced()) return;
    const B = BURST[tierIndex], d = phone ? 24 : 32;
    const reach = (phone ? 175 : 360) * B.throw, drop = phone ? 300 : 360;
    for (let k = 0; k < B.n; k++) {
      const [face, edge] = CHIP_SET[k % CHIP_SET.length];
      const c = el('span', 'wt-chip'); c.style.cssText = `--d:${d}px;--face:${face};--edge:${edge};left:${cx + (Math.random() - 0.5) * w * 1.6}px;top:${cy + (Math.random() - 0.3) * w * 0.6}px`;
      layer.appendChild(c);
      const side = k % 2 ? 1 : -1, R = side * reach * (0.35 + Math.random() * 0.65), Hp = (50 + Math.random() * 90) * B.throw;
      const spin = (Math.random() * 2 + 1) * 360 * side, tumble = (Math.random() * 2 + 1) * 360;
      const frames = Array.from({ length: 13 }, (_, i) => {
        const t = i / 12, x = R * (1 - Math.pow(1 - t, 1.5)), y = -4 * Hp * t * (1 - t) + drop * t * t;
        return { transform: `translate(${x}px, ${y}px) rotate(${spin * t}deg) rotateX(${tumble * t}deg) scale(${Math.min(1, 0.55 + t * 3)})`, opacity: t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28 };
      });
      c.animate(frames, { duration: 1150 + Math.random() * 350, delay: Math.random() * 140, easing: 'linear', fill: 'both' }).finished.then(() => c.remove());
    }
  }

  window.WT = { TIERS, HAND, phone, money, mult, stage, hand, count, cycle, burst };
})();
