/* E3, revised (2026-10-17): the owner's rule for a chip, and four ways to mark "=".
   A pick lights its section and the chip sits on the section's OUTER corner,
   half over the frame - never on the symbol. The "=" badge is the board's own
   rounded square, half a guess square, on the seam. Mock-only. */
(function () {
  const { g, place, el, size } = RTB;
  const css = `
  .baize { position: absolute; border-radius: 14px;
    background: radial-gradient(rgba(255,255,255,0.035) 0.6px, transparent 0.8px) 0 0 / 3px 3px, radial-gradient(120% 140% at 70% 0%, var(--felt-lit), var(--felt-mid) 55%, var(--felt-deep));
    box-shadow: inset 0 0 0 2px #b88a25, inset 0 0 0 3px rgba(0,0,0,0.5), inset 0 4px 12px rgba(0,0,0,0.6), 0 1px 0 rgba(255,230,180,0.25); }
  .label { position: absolute; text-align: center; font: 700 var(--lab, 14px)/1 var(--font-body); color: rgba(var(--gold-rgb), 0.9); white-space: nowrap; }
  .sq { position: absolute; display: grid; border: 1.5px solid rgba(var(--gold-rgb), 0.75); border-radius: 6px; }
  .split-v { grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
  .split-h { grid-template-rows: minmax(0,1fr) minmax(0,1fr); }
  .split-q { grid-template-columns: minmax(0,1fr) minmax(0,1fr); grid-template-rows: minmax(0,1fr) minmax(0,1fr); }
  .seg { position: relative; border: 0; padding: 0; display: grid; place-items: center; min-width: 0; min-height: 0; font: inherit; color: inherit;
    background: color-mix(in srgb, var(--fill) 82%, transparent); transition: filter 160ms var(--ease-out), box-shadow 160ms var(--ease-out); }
  .split-v .seg:first-of-type { border-right: 1.5px solid rgba(var(--gold-rgb), 0.75); }
  .split-h .seg:first-of-type { border-bottom: 1.5px solid rgba(var(--gold-rgb), 0.75); }
  .split-q .seg:nth-of-type(odd) { border-right: 1.5px solid rgba(var(--gold-rgb), 0.75); }
  .split-q .seg:nth-of-type(-n+2) { border-bottom: 1.5px solid rgba(var(--gold-rgb), 0.75); }
  .gl { width: 46%; aspect-ratio: 1; max-height: 70%; color: var(--ink); opacity: 0.92; display: grid; }
  .split-q .gl { width: 54%; }
  .gl svg { display: block; width: 100%; height: 100%; }
  .split-v .seg:first-of-type .gl { transform: translateX(-16%); }
  .split-v .seg:nth-of-type(2) .gl { transform: translateX(16%); }
  .split-h .seg:first-of-type .gl { transform: translateY(-14%); }
  .split-h .seg:nth-of-type(2) .gl { transform: translateY(14%); }
  /* The chosen section: lit from within and ringed in gold. Nothing else changes. */
  .seg.on { filter: brightness(1.22) saturate(1.08); box-shadow: inset 0 0 0 2px var(--gold-bright), inset 0 0 14px rgba(255,224,138,0.35); z-index: 1; }
  /* The badge: the board's rounded square, on the seam. */
  .eq { position: absolute; left: 50%; top: 50%; width: 50%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 22%; display: grid; place-items: center; z-index: 2;
    background: linear-gradient(180deg, var(--choice-equal-lit, #f2d27a), var(--choice-equal, #d6a733) 55%, var(--choice-equal-deep, #a87b16));
    box-shadow: 0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.45); transition: transform 180ms var(--ease-out), box-shadow 180ms var(--ease-out); }
  .eq svg { width: 62%; }
  /* The chip, set down once. Its position is set per pick. */
  .chipmark { position: absolute; width: var(--chip); height: calc(var(--chip) * 0.92); pointer-events: none; z-index: 3;
    transform: translate(-50%, -50%); animation: setdown 300ms var(--ease-out) both; }
  .chipmark::before { content: ''; position: absolute; inset: 0; border-radius: 50%; transform: translateY(3px); background: #5a0414; box-shadow: 0 4px 6px rgba(0,0,0,0.5); }
  .chipmark::after { content: ''; position: absolute; inset: 0; border-radius: 50%;
    background: radial-gradient(circle, var(--brand-red) 0 38%, #fff 39% 42%, var(--brand-red) 43% 60%, transparent 61%),
                repeating-conic-gradient(from 10deg, #f4efe6 0 14deg, var(--brand-red) 14deg 45deg); transform: rotate(var(--spin, 0deg)); }
  @keyframes setdown { 0% { transform: translate(-50%, -50%) translateY(-24px) scale(1.35); opacity: 0; } 55% { opacity: 1; } 80% { transform: translate(-50%, -50%) scale(0.97); } 100% { transform: translate(-50%, -50%); } }
  /* Variant 2: the seam's own spot, a ring printed at the seam's end. */
  .seamspot { position: absolute; width: var(--chip); height: var(--chip); border-radius: 50%; border: 1.5px dashed rgba(var(--gold-rgb), 0.55); transform: translate(-50%, -50%); z-index: 1; }
  /* Variant 3: the gold lid. */
  .lid { position: absolute; inset: -1.5px; border-radius: 6px; z-index: 2; display: grid; place-items: center; pointer-events: none;
    background: linear-gradient(180deg, rgba(242,210,122,0.92), rgba(214,167,51,0.92) 55%, rgba(168,123,22,0.92)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 5px rgba(0,0,0,0.45);
    clip-path: inset(var(--from, 50%) 0 var(--from, 50%) 0); transition: clip-path 220ms var(--ease-out); }
  .lid.v { clip-path: inset(0 var(--from, 50%) 0 var(--from, 50%)); }
  .lid.open { --from: 0%; }
  .lid svg { width: 46%; }
  /* Variant 4: the badge rides ON the chip - its rim shows round the badge. */
  .eq.riding { transform: translate(-50%, -58%); box-shadow: 0 4px 6px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.45); }
  .note { position: absolute; left: 50%; transform: translateX(-50%); top: var(--nb); width: min(92%, 640px); text-align: center; font: 600 13px/1.35 var(--font-body); color: var(--ink-body); background: rgba(4,9,6,0.82); border-radius: 10px; padding: 8px 12px; z-index: 9; }
  .note b { color: var(--gold-bright); }
  .phone .note { font-size: 11px; }`;
  const EQ = '<svg viewBox="0 0 24 24"><rect x="4" y="7.4" width="16" height="3" rx="1.5" fill="#3a2a06"/><rect x="4" y="13.6" width="16" height="3" rx="1.5" fill="#3a2a06"/></svg>';
  const NOTES = {
    1: '<b>Corner of the badge.</b> "=" lights and lifts; the chip sits on its outer corner, off the mark - the same rule as every half.',
    2: '<b>The seam\'s own spot.</b> A ring is printed where the seam meets the frame; "=" puts the chip there and lights the badge.',
    3: '<b>A gold lid.</b> "=" closes both halves under one gold band with the mark on it; the chip sits on the lid\'s outer corner.',
    5: '<b>Your spec.</b> "=" sets the chip half onto the badge, along the seam; the badge, smaller, lights and grows. Every other chip is set down by hand inside its section, off its mark.',
    4: '<b>The badge rides the chip.</b> The chip goes UNDER the badge, so its rim shows all round it and the mark stays on top.',
  };
  // Demo picks: Red, then "=" on Higher/Lower, then Outside, then Spade; a second
  // pass shows "=" on Inside/Outside too (Equal then Equal is a published mode).
  const PASSES = [['red', 'eq-hl', 'outside', 'spade'], ['black', 'higher', 'eq-io', 'heart']];
  // Outer corner of each section, as a fraction of the SQUARE: half over the frame.
  const CORNER = { black: [0.06, 0.94], red: [0.94, 0.94], higher: [0.94, 0.06], lower: [0.94, 0.94],
    inside: [0.06, 0.94], outside: [0.94, 0.94], heart: [0.06, 0.06], spade: [0.94, 0.06], club: [0.06, 0.94], diamond: [0.94, 0.94] };

  // Variant 5: INSIDE the section, in the largest space its mark leaves (a
  // fraction of the square, and a chip size as a fraction of it). The suits'
  // quarters are small, so their chip is smaller and tucked in the outer corner.
  const INSIDE = { black: [0.25, 0.5, 0.3], red: [0.75, 0.5, 0.3], higher: [0.83, 0.21, 0.28], lower: [0.83, 0.79, 0.28],
    inside: [0.36, 0.16, 0.26], outside: [0.64, 0.16, 0.26], heart: [0.1, 0.1, 0.18], spade: [0.9, 0.1, 0.18], club: [0.1, 0.9, 0.18], diamond: [0.9, 0.9, 0.18] };

  function mount(variant) {
    const s = document.getElementById('s'), phone = size() === 'phone';
    if (phone) document.body.classList.add('phone');
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    s.appendChild(Object.assign(el('div', 'layer bg'), { style: `background-image:url('kit/board-${size()}.webp')` }));
    const a = g.squares[0], z = g.squares[3], pad = phone ? 10 : 14;
    s.appendChild(place(el('div', 'baize'), { x: a.x - pad - 4, y: g.labelsY - pad, w: (z.x + z.w) - a.x + pad * 2 + 8, h: (a.y + a.h) - g.labelsY + pad * 2 }));
    const squares = GUESS.GUESSES.map((G, i) => {
      const r = g.squares[i];
      const lab = el('div', 'label', G.key === 'color' ? 'Red / Black' : G.label); lab.style.setProperty('--lab', phone ? '10px' : '13px');
      place(lab, { x: r.x - 20, y: g.labelsY + (phone ? 4 : 6), w: r.w + 40, h: 16 }); s.appendChild(lab);
      const n = el('div', '', GUESS.square(G)).firstElementChild; place(n, r); s.appendChild(n);
      const eq = n.querySelector('.eq'); if (eq) eq.innerHTML = EQ;
      if (eq && variant === 5) eq.style.width = '34%';
      if (variant === 2 && G.eq) {
        const spot = el('span', 'seamspot'); spot.style.setProperty('--chip', `${r.w * 0.3}px`);
        Object.assign(spot.style, G.split === 'h' ? { left: '100%', top: '50%' } : { left: '50%', top: '100%' }); n.appendChild(spot);
      }
      if (variant === 3 && G.eq) { const lid = el('span', `lid ${G.split === 'v' ? 'v' : ''}`, EQ); n.appendChild(lid); }
      return { n, r, G };
    });
    const chipAt = (host, fx, fy, w) => {
      const c = el('div', 'chipmark'); c.style.setProperty('--chip', `${w * 0.3}px`);
      Object.assign(c.style, { left: `${fx * 100}%`, top: `${fy * 100}%` }); host.appendChild(c); return c;
    };
    const reset = () => {
      s.querySelectorAll('.seg.on').forEach((b) => b.classList.remove('on'));
      s.querySelectorAll('.chipmark').forEach((c) => c.remove());
      s.querySelectorAll('.eq').forEach((e) => { e.classList.remove('riding'); e.style.transform = ''; e.style.boxShadow = ''; });
      s.querySelectorAll('.lid').forEach((l) => l.classList.remove('open'));
    };
    const pick = (id) => {
      if (id.startsWith('eq-')) {
        const { n, r, G } = squares[id === 'eq-hl' ? 1 : 2]; const eq = n.querySelector('.eq');
        if (variant === 1) {
          eq.style.transform = 'translate(-50%, -50%) scale(1.08)';
          eq.style.boxShadow = '0 0 0 2px var(--gold-bright), 0 4px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.5)';
          // The badge's outer corner: the side away from the board's centre line.
          chipAt(n, 0.5 + 0.25 + 0.02, 0.5 - 0.25 - 0.02, r.w);
        } else if (variant === 2) {
          eq.style.boxShadow = '0 0 0 2px var(--gold-bright), 0 3px 6px rgba(0,0,0,0.5)';
          G.split === 'h' ? chipAt(n, 1, 0.5, r.w) : chipAt(n, 0.5, 1, r.w);
        } else if (variant === 5) {
          eq.style.transform = 'translate(-50%, -50%) scale(1.1)';
          eq.style.boxShadow = '0 0 0 2px var(--gold-bright), 0 0 12px rgba(255,224,138,0.45), 0 4px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.5)';
          // HALF ONTO the badge, on the seam: its centre on the grown badge's
          // edge, 0.5 + 0.187 (half of 34% x 1.1).
          const edge = 0.5 + 0.187;
          const c = G.split === 'h' ? chipAt(n, edge, 0.5, r.w) : chipAt(n, 0.5, edge, r.w);
          c.style.setProperty('--chip', `${r.w * 0.26}px`);
          c.style.setProperty('--spin', `${Math.round(Math.random() * 90)}deg`);
        } else if (variant === 3) {
          n.querySelector('.lid').classList.add('open');
          chipAt(n, 0.94, 0.06, r.w);
        } else {
          const c = chipAt(n, 0.5, 0.5, r.w); c.style.setProperty('--chip', `${r.w * 0.62}px`); c.style.zIndex = 1;
          eq.classList.add('riding');
        }
        return;
      }
      const b = s.querySelector(`.seg-${id}`); b.classList.add('on');
      const sq = b.closest('.sq'), { w } = squares.find((q) => q.n === sq).r;
      if (variant === 5) {
        // Set down by hand, not on a grid: a little jitter, a random spin, and
        // on the halves with room either side of their mark, a random side.
        // Every position stays clear of the mark and of the badge.
        let [fx, fy, k] = INSIDE[id];
        const j = (a) => (Math.random() - 0.5) * 2 * a;
        if (id === 'black' || id === 'red') { fx += j(0.07); fy += j(0.2); }
        if (id === 'higher' || id === 'lower') { if (Math.random() < 0.5) fx = 1 - fx; fx += j(0.04); fy += j(0.04); }
        if (id === 'inside' || id === 'outside') { if (Math.random() < 0.5) fy = 1 - fy; fx += j(0.04); fy += j(0.03); }
        const c = chipAt(sq, fx, fy, w); c.style.setProperty('--chip', `${w * k}px`);
        c.style.setProperty('--spin', `${Math.round(Math.random() * 90)}deg`);
        return;
      }
      const [fx, fy] = CORNER[id]; chipAt(sq, fx, fy, w);
    };
    const note = el('div', 'note', NOTES[variant]); note.style.setProperty('--nb', phone ? '476px' : '84px'); s.appendChild(note);
    let pass = 0;
    RTB.loop(5600, async () => {
      reset(); await RTB.wait(600);
      for (const id of PASSES[pass % 2]) { pick(id); await RTB.wait(700); }
      pass++;
    });
  }
  window.E3EQ = { mount };
})();
