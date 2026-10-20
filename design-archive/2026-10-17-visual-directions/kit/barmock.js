/* The X (control bar) mock-ups' shared parts: one bar's worth of controls, laid
   out as a row on desktop and two rows on phones. Each page skins it. Mock-only. */
(function () {
  const { G, bolts } = GLYPHS;
  const css = document.createElement('style');
  css.textContent = `
    .xbar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 10; display: flex; align-items: center; gap: 14px; padding: 0 22px; }
    .xbar .grp { display: flex; align-items: center; gap: 6px; }
    .xbar .g { width: 44px; height: 44px; display: grid; place-items: center; border: 0; padding: 0; background: none; color: var(--ink-strong); border-radius: 50%; }
    .xbar .g svg { width: 24px; height: 24px; }
    .xbar .g.turbo { color: rgb(255, 206, 58); }
    .xbar .g.auto { color: rgb(87, 217, 138); }
    .xbar .read { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .xbar .cap { font: 600 10px/1 var(--font-body); letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-dim); }
    .xbar .val { font: 800 19px/1 var(--font-body); color: var(--ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .xbar .grow { flex: 1; }
    .xbar .deal { width: 62px; height: 62px; border-radius: 50%; border: 0; display: grid; place-items: center;
      background: radial-gradient(circle at 40% 30%, #2a4d74, #12233a); box-shadow: inset 0 0 0 3px #3d6b9e, 0 6px 14px rgba(0,0,0,0.5); }
    .xbar .deal svg { width: 34px; height: 34px; }
    .xbar .sign { width: 96px; height: 50px; border-radius: 9px; background: #0b0907; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
      box-shadow: inset 0 3px 8px rgba(0,0,0,0.85), 0 1px 0 rgba(255,240,220,0.1); }
    .xbar .sign b { font: 900 21px/1 var(--font-display); color: rgb(255, 201, 60); }
    @media (max-width: 600px) {
      .xbar { flex-wrap: wrap; padding: 8px 12px; gap: 6px 8px; }
      .xbar .row1 { order: 0; width: 100%; display: flex; align-items: center; gap: 8px; }
      .xbar .val { font-size: 16px; }
      .xbar .deal { width: 52px; height: 52px; }
      .xbar .sign { width: 78px; height: 42px; }
      .xbar .sign b { font-size: 18px; }
    }`;
  document.head.appendChild(css);
  function mount(stage, skin) {
    const phone = RTB.size() === 'phone';
    const money = `<div class="read"><span class="cap">Balance</span><span class="val">$1,000,000.00</span></div><span class="grow"></span>
      <div class="read" style="align-items:flex-end"><span class="cap">Last win</span><span class="val">$0.00</span></div>`;
    const bet = `<div class="grp bet"><div class="read" style="align-items:flex-end"><span class="cap">Bet</span><span class="val">$1.00</span></div>
      ${phone ? '' : `<button class="g step">${G.minus}</button><button class="g step">${G.plus}</button>`}</div>`;
    const sign = `<div class="sign"><b>Classic</b>${bolts(3, '255, 201, 60')}</div>`;
    const bar = RTB.el('div', 'xbar ' + skin);
    bar.innerHTML = phone
      ? `<div class="row1"><button class="g">${G.sound}</button><button class="g">${G.info}</button><div class="money" style="flex:1;display:flex;align-items:center;gap:8px">${money}</div></div>
         <button class="g turbo">${G.turbo}</button>${bet}<span class="grow"></span><button class="g auto">${G.auto}</button><button class="deal">${G.deal}</button>${sign}`
      : `<button class="g turbo">${G.turbo}</button><button class="g">${G.sound}</button><button class="g">${G.info}</button>
         <div class="money" style="flex:1;display:flex;align-items:center;gap:14px;max-width:440px">${money}</div><span class="grow"></span>${bet}
         <button class="g auto">${G.auto}</button><button class="deal">${G.deal}</button>${sign}`;
    stage.appendChild(bar);
    return bar;
  }
  window.BARMOCK = { mount };
})();
