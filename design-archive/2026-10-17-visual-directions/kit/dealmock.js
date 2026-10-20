/* The DL (deal button) mock-ups: a drawn deal button laid over the real one on
   the live bar, pressed on a loop, plus (desktop) a 3x detail. Mock-only. */
(function () {
  const css = document.createElement('style');
  css.textContent = `
    .dlwell { position: absolute; z-index: 10; border-radius: 50%; background: radial-gradient(circle, #14100c 60%, rgba(20,16,12,0) 72%); }
    .dlbtn { position: absolute; z-index: 11; }
    .zoom { position: absolute; z-index: 12; right: 26px; top: 110px; width: 230px; height: 230px; border-radius: 16px; display: grid; place-items: center;
      background: radial-gradient(circle at 50% 40%, #2b241e, #120e0b); box-shadow: 0 14px 30px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,240,220,0.1); }
    .zoom .cap { position: absolute; bottom: 10px; font: 700 12px/1 var(--font-body); color: var(--ink-dim); }
    .zoom .dlbtn { position: relative; transform: scale(2.6); }`;
  document.head.appendChild(css);
  /* `draw(size)` returns the button's markup; `press(node, down)` animates it. */
  function mount(stage, draw, press, label) {
    const a = BAR.R('deal'), pad = 8;
    const well = RTB.el('div', 'dlwell'); Object.assign(well.style, { left: a.x - pad + 'px', top: a.y - pad + 'px', width: a.w + pad * 2 + 'px', height: a.h + pad * 2 + 'px' }); stage.appendChild(well);
    const btn = RTB.el('div', 'dlbtn', draw(a.w)); Object.assign(btn.style, { left: a.x + 'px', top: a.y + 'px', width: a.w + 'px', height: a.h + 'px' }); stage.appendChild(btn);
    const nodes = [btn];
    if (RTB.size() === 'desk') {
      const z = RTB.el('div', 'zoom', `<div class="dlbtn" style="width:${a.w}px;height:${a.h}px">${draw(a.w)}</div><span class="cap">${label} · 3× detail</span>`);
      stage.appendChild(z); nodes.push(z.querySelector('.dlbtn'));
    }
    const f = BAR.finger(stage);
    RTB.loop(2600, async () => {
      await RTB.wait(900);
      const [x, y] = BAR.centre('deal'); f.at(x, y); f.on();
      nodes.forEach((n) => press(n, true)); await RTB.wait(180);
      nodes.forEach((n) => press(n, false)); f.off();
    });
  }
  window.DEALMOCK = { mount };
})();
