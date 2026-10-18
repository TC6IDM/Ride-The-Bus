/* The control bar's controls, MEASURED off the live game (2026-10-17), and the
   "bump": a pop-over in the panel material that grows out of the control that
   opened it (origin-aware), with a pointer at that control. Mock-only. */
(function () {
  const BAR = {
    desk: { turbo: [105, 598, 46, 46], sound: [173, 603, 36, 36], info: [219, 603, 36, 36], lastwin: [431, 605, 187, 32],
      bet: [654, 600, 128, 41], plus: [790, 594, 30, 25], minus: [790, 623, 30, 25], auto: [858, 599, 44, 44], deal: [914, 589, 64, 64], mode: [1003, 593, 93, 55] },
    phone: { turbo: [22, 606, 36, 36], sound: [18, 546, 36, 36], info: [61, 546, 36, 36], lastwin: [242, 551, 130, 25],
      bet: [73, 608, 88, 32], auto: [186, 606, 36, 36], deal: [230, 601, 47, 47], mode: [292, 605, 75, 40] },
  };
  const b = BAR[RTB.size()];
  const R = (k) => { const [x, y, w, h] = b[k]; return { x, y, w, h }; };

  const css = document.createElement('style');
  css.textContent = `
    .bump { position: absolute; z-index: 20; padding: 14px 16px; border-radius: 14px; background: var(--panel-face), var(--panel);
      box-shadow: var(--panel-elevation); border: 1px solid var(--panel-edge); color: var(--ink-strong);
      transform-origin: var(--ox) 100%; transform: scale(0.92) translateY(6px); opacity: 0;
      transition: transform 180ms var(--ease-out), opacity 140ms var(--ease-out); }
    .bump.in { transform: none; opacity: 1; }
    .bump::after { content: ''; position: absolute; left: var(--ox); bottom: -7px; width: 14px; height: 14px; margin-left: -7px; transform: rotate(45deg);
      background: var(--panel); border-right: 1px solid var(--panel-edge); border-bottom: 1px solid var(--panel-edge); }
    .ring { position: absolute; z-index: 21; border-radius: 50%; box-shadow: 0 0 0 2px rgba(var(--tint-rgb, 255,206,58), 0.95); pointer-events: none; opacity: 0; transition: opacity 120ms; }
    .ring.on { opacity: 1; }
    .tap { position: absolute; z-index: 30; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; background: rgba(255,255,255,0.35); border: 2px solid rgba(255,255,255,0.8);
      pointer-events: none; opacity: 0; transform: scale(0.6); transition: opacity 120ms, transform 160ms var(--ease-out), left 500ms var(--ease-in-out), top 500ms var(--ease-in-out); }
    .tap.on { opacity: 1; transform: scale(1); }
    .veil2 { position: absolute; inset: 0; background: rgba(4,9,6,0.55); opacity: 0; transition: opacity 200ms; z-index: 15; }
    .veil2.in { opacity: 1; }
    .slider { position: relative; height: 26px; }
    .slider .track { position: absolute; left: 0; right: 0; top: 11px; height: 4px; border-radius: 4px; background: rgba(255,255,255,0.14); }
    .slider .fill { position: absolute; left: 0; top: 11px; height: 4px; border-radius: 4px; background: rgb(var(--tint-rgb)); transition: width 500ms var(--ease-in-out); }
    .slider .knob { position: absolute; top: 3px; width: 20px; height: 20px; margin-left: -10px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.5); transition: left 500ms var(--ease-in-out); }
  `;
  document.head.appendChild(css);

  /* A bump over control `key`, `w` wide, holding `html`. Kept on screen; the
     pointer stays over the control even when the bump has to shift. */
  function bump(stage, key, w, html, tintRgb) {
    const a = R(key), n = RTB.el('div', 'bump', html);
    n.style.width = w + 'px';
    if (tintRgb) n.style.setProperty('--tint-rgb', tintRgb);
    stage.appendChild(n);
    const h = n.offsetHeight, cx = a.x + a.w / 2;
    const left = Math.max(10, Math.min(cx - w / 2, innerWidth - w - 10));
    Object.assign(n.style, { left: left + 'px', top: (a.y - h - 14) + 'px' });
    n.style.setProperty('--ox', (cx - left) + 'px');
    return n;
  }
  function ring(stage, key, tintRgb) {
    const a = R(key), n = RTB.el('div', 'ring'); const pad = 4;
    Object.assign(n.style, { left: a.x - pad + 'px', top: a.y - pad + 'px', width: a.w + pad * 2 + 'px', height: a.h + pad * 2 + 'px', borderRadius: key === 'bet' || key === 'lastwin' || key === 'mode' ? '12px' : '50%' });
    if (tintRgb) n.style.setProperty('--tint-rgb', tintRgb);
    stage.appendChild(n); return n;
  }
  /* A pretend finger: lands on a point, so a viewer sees what was pressed. */
  function finger(stage) { const n = RTB.el('div', 'tap'); stage.appendChild(n);
    return { at(x, y) { n.style.left = x + 'px'; n.style.top = y + 'px'; }, on() { n.classList.add('on'); }, off() { n.classList.remove('on'); },
      press: async (x, y) => { n.style.left = x + 'px'; n.style.top = y + 'px'; n.classList.add('on'); await RTB.wait(380); n.classList.remove('on'); } };
  }
  const centre = (key) => { const a = R(key); return [a.x + a.w / 2, a.y + a.h / 2]; };
  window.BAR = { R, bump, ring, finger, centre, BAR: b };
})();
