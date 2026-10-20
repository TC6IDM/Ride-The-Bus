/* The close-call hold, scripted for the CL mock-ups (2026-10-19). The backdrop is
   the live board photographed mid-round (red_equal_equal_heart, the Max book:
   2 of hearts, 2 of spades, 2 of diamonds, then Hearts for 1,354.2x) with card 4,
   the readout and the bus taken out, so each mock draws its own. The loop
   alternates a hit (3 of hearts) and a miss (7 of clubs): the hold is decided by
   the stake alone and must look the same either way. Mock-only.

   Timings are the game's at normal speed for a Max hold: a 1,400ms hold plus
   the 650ms beat, of which 1,650ms is the climb and 400ms the top
   (winTiers.ts holdClimbMs), then the turn. */
(function () {
  const { el, face, size } = RTB;
  const phone = size() === 'phone';
  const GEO = {
    desk: {
      slot: { x: 731.2, y: 153.4, w: 97, h: 144.4 },
      amount: { x: 529.5, y: 336.1, w: 141, h: 38.5 }, label: { y: 320.6 },
      stops: [420.3, 540.1, 659.9, 779.8], routeY: 309.3,
      heart: { x: 721.7, y: 450.9, w: 43.7, h: 43.7 }, suit: { x: 721.7, y: 450.9, w: 87.5, h: 87.5 },
      readout: { x: 529.5, y: 320.6, w: 141, h: 73.4 }, playBottom: 571.7, cw: 19, u: 10.8,
    },
    phone: {
      slot: { x: 286.4, y: 175.6, w: 79.6, h: 118.5 },
      amount: { x: 127.3, y: 314.6, w: 135.9, h: 31.6 }, label: { y: 301.9 },
      stops: [64.2, 151.5, 238.9, 326.2], routeY: 298,
      heart: { x: 278.6, y: 396.9, w: 35.9, h: 35.9 }, suit: { x: 278.6, y: 396.9, w: 71.8, h: 71.8 },
      readout: { x: 127.3, y: 301.9, w: 135.9, h: 59.4 }, playBottom: 545, cw: 14.5, u: 8,
    },
  };
  const G = GEO[size()];
  const CLIMB = 1650, TOP = 400, FLIP = 440;
  const HIT = ['3', 'heart'], MISS = ['7', 'club'];
  const s = document.getElementById('s');

  const css = document.createElement('style');
  css.textContent = `
    .hm-bar { clip-path: ${phone ? 'inset(545px 0 64px 0)' : 'inset(571.7px 340px 0 0)'}; }
    .hm-card { position: absolute; z-index: 6; transform-origin: 50% 50%; }
    .hm-card > .side { position: absolute; inset: 0; transition: transform ${FLIP / 2}ms linear; }
    .hm-card > .face { transform: scaleX(0); }
    .hm-card.turning > .back { transform: scaleX(0); transition-timing-function: ease-in; }
    .hm-card.turned > .back { transform: scaleX(0); }
    .hm-card.turned > .face { transform: none; transition-timing-function: ease-out; }
    .hm-card.dead .face { filter: saturate(0.5) brightness(0.86); transition: filter 300ms; }
    .hm-x { position: absolute; inset: 22% 18%; opacity: 0; transition: opacity 160ms; }
    .hm-card.dead .hm-x { opacity: 1; }
    .hm-mult { position: absolute; z-index: 6; transform: translateX(-50%); font: 700 ${phone ? 13 : 15}px/1 var(--font-display); color: #63e39c; letter-spacing: 0.02em; opacity: 0; transition: opacity 200ms; text-shadow: 0 1px 3px rgba(0,0,0,0.7); }
    .hm-mult.on { opacity: 1; }
    .hm-read { position: absolute; z-index: 5; display: flex; flex-direction: column; align-items: center; gap: ${phone ? 4 : 5}px; transform: translateX(-50%); }
    .hm-read .lab { display: flex; align-items: center; gap: 0.35em; height: ${phone ? 11 : 13}px; font: 700 ${phone ? 9.5 : 11}px/1 var(--font-body); letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-dim); white-space: nowrap; }
    .hm-read .lab svg { width: 1.2em; height: 1.2em; fill: #e0524f; }
    .hm-read .lab.win { color: #63e39c; } .hm-read .lab.loss { color: #e8a0a0; }
    .hm-flap { display: flex; gap: 2px; padding: 4px; border-radius: 7px; background: #0b0907; box-shadow: inset 0 2px 6px rgba(0,0,0,0.9), 0 1px 0 rgba(255,240,220,0.12); perspective: 300px; }
    .hm-cell { position: relative; width: var(--cw); height: calc(var(--cw) * 1.45); border-radius: 3px; display: grid; place-items: center; overflow: hidden;
      background: linear-gradient(180deg, #2a2622 0 49%, #000 49% 51%, #1f1c19 51%); font: 900 calc(var(--cw) * 1.05)/1 var(--font-display); color: #9fe6bf; }
    .hm-cell.flip { animation: hmflip 240ms var(--ease-in-out); }
    @keyframes hmflip { 50% { transform: rotateX(-90deg); filter: brightness(0.6); } }
    .hm-bus { position: absolute; z-index: 5; width: ${phone ? 17 : 21}px; height: ${phone ? 10 : 12}px; transform: translate(-50%, -100%); fill: var(--gold); }
    .hm-bus .gl { fill: #2a2016; }
    .hm-stop { position: absolute; z-index: 5; width: ${phone ? 7 : 8}px; height: ${phone ? 7 : 8}px; border-radius: 50%; transform: translate(-50%, -50%); background: #63e39c; opacity: 0; transition: opacity 200ms; }
    .hm-stop.on { opacity: 1; }
  `;
  document.head.appendChild(css);

  // The backdrop, and the ordinary bar's balance laid over the replay's.
  const bg = el('div', 'layer bg'); bg.style.backgroundImage = `url('kit/hold-bg-${size()}.webp')`; s.appendChild(bg);
  const bar = el('div', 'layer bg hm-bar'); bar.style.backgroundImage = `url('kit/hold-normal-${size()}.webp')`; s.appendChild(bar);

  // Card 4: the house back, turning to its face.
  const card = el('div', 'hm-card'); RTB.place(card, G.slot);
  const back = el('div', 'side back'); back.style.setProperty('--wm', (phone ? 6.5 : 8) + 'px');
  const faceEl = el('div', 'side face');
  const cross = '<svg class="hm-x" viewBox="0 0 24 24" fill="none" stroke="#e5484d" stroke-width="3.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>';
  card.append(back, faceEl); s.appendChild(card);
  const mult = el('div', 'hm-mult', '1,354.2×'); Object.assign(mult.style, { left: G.slot.x + G.slot.w / 2 + 'px', top: G.slot.y - (phone ? 23 : 22) + 'px' }); s.appendChild(mult);

  // The readout: its label over the split-flap total.
  const W = 9;
  const read = el('div', 'hm-read', `<span class="lab"></span><div class="hm-flap">${'<span class="hm-cell"></span>'.repeat(W)}</div>`);
  read.style.setProperty('--cw', G.cw + 'px');
  Object.assign(read.style, { left: G.amount.x + G.amount.w / 2 + 'px', top: G.label.y + 'px' }); s.appendChild(read);
  const lab = read.querySelector('.lab'), cells = [...read.querySelectorAll('.hm-cell')];
  const heartSvg = `<svg viewBox="0 0 24 24"><path d="${RTB.SUIT.heart[0]}"/></svg>`;
  function label(text, cls = '') { lab.className = 'lab ' + cls; lab.innerHTML = text.replace('♥', heartSvg); }
  function flaps(text, instant) {
    const t = text.padStart(W, ' ');
    cells.forEach((c, i) => {
      const ch = t[i] === ' ' ? '' : t[i];
      c.style.display = i < W - text.length ? 'none' : '';
      if (c.textContent === ch) return;
      if (instant) { c.textContent = ch; return; }
      c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip'); setTimeout(() => (c.textContent = ch), 120);
    });
  }

  // The bus, at stop 3, and stop 4's lamp.
  const bus = el('div', '', `<svg class="hm-bus" viewBox="0 0 24 14"><rect x="1" y="1" width="22" height="9.5" rx="2.4"/><rect class="gl" x="3.4" y="3" width="4.2" height="3.2" rx="0.6"/><rect class="gl" x="9" y="3" width="4.2" height="3.2" rx="0.6"/><rect class="gl" x="14.6" y="3" width="6" height="3.2" rx="0.6"/><circle cx="6.5" cy="11" r="2.2"/><circle cx="17.5" cy="11" r="2.2"/></svg>`).firstChild;
  Object.assign(bus.style, { left: G.stops[2] + 'px', top: G.routeY - 3 + 'px' }); s.appendChild(bus);
  const stop4 = el('div', 'hm-stop'); Object.assign(stop4.style, { left: G.stops[3] + 'px', top: G.routeY + 'px' }); s.appendChild(stop4);

  const parts = { G, phone, card, back, faceEl, mult, read, bus, stop4, label, flaps, CLIMB, TOP, FLIP, s };

  /* hooks: reset(r), hold(r), strike(r) (as the card is let go, before the
     turn), land(r) (once the face is up). r = { win, card }. holdUntil(r), if
     given, is awaited in place of the hold's fixed wait - a player peeling the
     card ends the hold when they finish. The loop waits for each round to end
     before the next, so a round can take as long as it needs. */
  let round = 0;
  function play(hooks = {}) {
    const once = async () => {
      const r = { win: round % 2 === 0, card: round % 2 === 0 ? HIT : MISS }; round++;
      card.classList.remove('turning', 'turned', 'dead');
      faceEl.innerHTML = face(...r.card) + cross;
      mult.classList.remove('on'); stop4.classList.remove('on');
      bus.style.transition = 'none'; bus.style.left = G.stops[2] + 'px';
      label('Last card'); flaps('$430.10', true);
      hooks.reset && hooks.reset(r);
      await RTB.wait(1100);
      hooks.hold && hooks.hold(r);
      if (hooks.holdUntil) await hooks.holdUntil(r);
      else await RTB.wait(CLIMB + TOP);
      if (hooks.strike) await hooks.strike(r);
      if (!hooks.ownTurn) await turn();
      if (r.win) {
        label('Full game win', 'win'); flaps('$1,354.20'); mult.classList.add('on'); stop4.classList.add('on');
        bus.style.transition = 'left 260ms var(--ease-out)'; bus.style.left = G.stops[3] + 'px';
      } else {
        label('Kept', 'loss'); flaps('$129.00'); card.classList.add('dead');
      }
      hooks.land && hooks.land(r);
      await RTB.wait(2300);
    };
    const go = async () => { await once(); if (!RTB.reduced()) setTimeout(go, 200); };
    go();
  }
  async function turn() {
    card.classList.add('turning');
    await RTB.wait(FLIP / 2);
    card.classList.add('turned');
    await RTB.wait(FLIP / 2);
  }

  window.HOLDMOCK = { play, turn, ...parts, heartSvg };
})();
