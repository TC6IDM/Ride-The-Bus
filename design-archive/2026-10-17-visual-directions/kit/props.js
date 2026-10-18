/* Table props for the TB mock-ups, drawn over the board with its own props
   removed. Positions follow the live prop rects (2026-10-17). Mock-only. */
(function () {
  const { el } = RTB;
  const css = document.createElement('style');
  css.textContent = `
    .pr { position: absolute; z-index: 3; }
    .pdeck .back { position: absolute; inset: 0; --wm: 4px; }
    .pdeck .back:nth-child(1) { transform: translate(3px, 4px); filter: brightness(0.6); }
    .pdeck .back:nth-child(2) { transform: translate(1.5px, 2px); filter: brightness(0.8); }
    .pstack i { position: absolute; left: 0; right: 0; height: 26%; border-radius: 50%;
      background: radial-gradient(circle, var(--c) 0 38%, #f4efe6 39% 44%, var(--c) 45% 60%, transparent 61%), repeating-conic-gradient(from 10deg, #f4efe6 0 12deg, var(--c) 12deg 45deg);
      box-shadow: 0 2px 0 var(--d), 0 3px 4px rgba(0,0,0,0.4); }
    .pdie { border-radius: 18%; background: linear-gradient(150deg, #e0485c, #a8142a); box-shadow: inset 0 2px 0 rgba(255,255,255,0.35), inset -3px -3px 0 rgba(0,0,0,0.2), 0 6px 10px rgba(0,0,0,0.5); transform: rotate(-12deg); }
    .pdie::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle, #fff 0 9%, transparent 10%) 25% 25% / 50% 50%, radial-gradient(circle, #fff 0 9%, transparent 10%) center / 100% 100% no-repeat; }`;
  document.head.appendChild(css);
  const P = RTB.size() === 'phone'
    ? { deck: [78, 92, 40, 44], die: [64, 475, 44, 44], stacksA: [[296, 104, 26], [320, 112, 26]], stacksB: [[196, 484, 24], [222, 492, 24], [248, 500, 24]], cup: [134, 470, 46, 64] }
    : { deck: [291, 155, 73, 80], die: [833, 470, 54, 54], stacksA: [[840, 120, 40], [872, 152, 40], [904, 188, 40]], stacksB: [[230, 400, 42], [262, 444, 42], [298, 478, 42], [336, 508, 42]], cup: [228, 270, 80, 115] };
  const at = (n, [x, y, w, h]) => { Object.assign(n.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: (h || w) + 'px' }); return n; };
  const deck = (stage, r = P.deck) => stage.appendChild(at(el('div', 'pr pdeck', '<div class="back"></div><div class="back"></div><div class="back"></div>'), r));
  const stack = (stage, [x, y, w], n, c, d) => { const s = el('div', 'pr pstack', Array.from({ length: n }, (_, i) => `<i style="bottom:${i * 8}%;--c:${c};--d:${d}"></i>`).join('')); return stage.appendChild(at(s, [x, y - w * 0.6, w, w * 1.4])); };
  const die = (stage, r = P.die) => stage.appendChild(at(el('div', 'pr pdie'), r));
  window.PROPS = { P, deck, stack, die, at };
})();
