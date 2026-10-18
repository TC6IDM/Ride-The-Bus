/* The bet menu's chips (mock of the game's chip rack: colour by rank, the value
   on the face, edge inserts). Mock-only. */
(function () {
  const CHIPS = [
    ['$1', '#f2ede2', '#2f6fb3', '#1a2a3a'], ['$5', '#f2ede2', '#b3202f', '#3a1018'], ['$25', '#2a5ea8', '#f2ede2', '#fff'],
    ['$50', '#2f8a4a', '#f2ede2', '#fff'], ['$75', '#1f6b3c', '#f2d27a', '#fff'], ['$100', '#b3202f', '#f2ede2', '#fff'], ['$200', '#1b1b1d', '#f2ede2', '#fff'],
  ];
  const css = document.createElement('style');
  css.textContent = `
    .chip { position: relative; width: var(--d, 54px); aspect-ratio: 1; border-radius: 50%; border: 0; padding: 0; display: grid; place-items: center; cursor: pointer;
      background: radial-gradient(circle, var(--face) 0 56%, var(--edge) 57% 60%, var(--face) 61% 66%, transparent 67%), repeating-conic-gradient(from 6deg, var(--edge) 0 16deg, var(--face) 16deg 45deg);
      box-shadow: 0 3px 0 rgba(0,0,0,0.45), 0 6px 10px rgba(0,0,0,0.4); transition: transform 180ms var(--ease-out); }
    .chip b { font: 900 calc(var(--d, 54px) * 0.3)/1 var(--font-display); color: var(--ink2); letter-spacing: -0.01em; }
    .chip.on { transform: translateY(-8px); box-shadow: 0 3px 0 rgba(0,0,0,0.45), 0 14px 16px rgba(0,0,0,0.45), 0 0 0 2px #f2d27a; }`;
  document.head.appendChild(css);
  const chip = (c, d) => `<button class="chip" style="--face:${c[1]};--edge:${c[2]};--ink2:${c[3]};--d:${d}px"><b>${c[0]}</b></button>`;
  window.CHIPS = { CHIPS, chip };
})();
