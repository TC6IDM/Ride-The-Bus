/* A scripted round for the RW (running total) mock-ups: four cards turn over in
   their slots, the total climbing, ending on a full game win. Mock-only. */
(function () {
  const { g, el, face } = RTB;
  const CARDS = [['8', 'spade'], ['9', 'heart'], ['4', 'club'], ['2', 'diamond']];
  const TOTALS = ['$1.90', '$5.40', '$12.40', '$41.20'];
  const css = document.createElement('style');
  css.textContent = `.rface { z-index: 4; transform: rotateY(90deg); transition: transform 260ms var(--ease-out); }
    .rface.on { transform: none; }`;
  document.head.appendChild(css);
  const faces = CARDS.map(([r, s], i) => { const f = el('div', 'face rface', face(r, s)); RTB.place(f, g.slots[i]); document.getElementById('s').appendChild(f); return f; });
  /* Run the round; `onCard(i, total)` fires as card i lands, `onStart` first. */
  function play(onStart, onCard, onEnd) {
    return RTB.loop(8200, async () => {
      faces.forEach((f) => f.classList.remove('on')); onStart();
      await RTB.wait(900);
      for (let i = 0; i < 4; i++) { faces[i].classList.add('on'); await RTB.wait(240); onCard(i, TOTALS[i]); await RTB.wait(i === 3 ? 400 : 900); }
      onEnd && onEnd(); await RTB.wait(2400);
    });
  }
  // Each stop on the route sits under its card's centre.
  const stops = g.slots.map((r) => r.x + r.w / 2);
  window.ROUNDMOCK = { play, stops, TOTALS };
})();
