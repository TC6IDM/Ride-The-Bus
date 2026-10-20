/* Shared by the D (card face) mock-ups: four faces dealt on the real board (two
   courts, two numbers), and on desktop today's faces beside the proposal at
   detail size: a court and a number card each. Mock-only. */
(function () {
  const { g, el, place, face, size } = RTB;
  const HAND = [['K', 'heart'], ['7', 'club'], ['Q', 'diamond'], ['J', 'spade']];
  async function mount(stage, opts, todayOnly) {
    await RTB.courts();
    const board = el('div', 'layer bg'); board.style.backgroundImage = `url('kit/board-${size()}.webp')`; stage.appendChild(board);
    HAND.forEach(([r, s], i) => { const f = el('div', 'face', face(r, s, opts)); place(f, g.slots[i]); stage.appendChild(f); });
    if (size() === 'desk') {
      (todayOnly ? [['Today', {}]] : [['Today', {}], ['Proposed', opts]]).forEach(([label, o], k) => {
        const box = el('div', 'detail');
        box.innerHTML = `<div class="pair"><div class="face" style="position:relative;width:118px;height:176px">${face('K', 'heart', o)}</div>` +
          `<div class="face" style="position:relative;width:118px;height:176px">${face('7', 'club', o)}</div></div><span>${label}</span>`;
        Object.assign(box.style, { position: 'absolute', top: '150px', [k === 0 ? 'left' : 'right']: '10px' });
        stage.appendChild(box);
      });
      const css = document.createElement('style');
      css.textContent = `.detail { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 10px; border-radius: 12px; background: rgba(4,9,6,0.78); box-shadow: 0 10px 24px rgba(0,0,0,0.5); }
        .detail .pair { display: flex; flex-direction: column; gap: 10px; }
        .detail span { font: 700 12px/1 var(--font-body); color: var(--ink-body); }`;
      document.head.appendChild(css);
    }
  }
  window.FACES = { mount };
})();
