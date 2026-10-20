/* The G1/G2 rack: one builder, two looks (the page's CSS decides the head).
   Desktop: five family cards in a row. Phone: five stacked rows. Mock-only. */
(function () {
  const { el, loop, wait, size } = RTB;
  const { F, LIVE, bolts, vignette } = MODES;
  const phone = size() === 'phone';
  // The note the panel already ends on (ModePopup.svelte), word for word.
  const NOTE = 'This mode costs 1× your bet. Every mode returns the same 96.00% over many rounds; what changes is how often a round pays and how much it can pay.';

  function mount(stage) {
    const veil = el('div', 'veil'); stage.appendChild(veil);
    const panel = el('div', 'rack panel');
    panel.innerHTML = `<div class="head"><span>Game mode</span><button class="x" aria-label="Close">×</button></div>
      <div class="opts">${F.map((f, i) => `
        <article class="opt${f.id === LIVE ? ' live' : ''}" data-id="${f.id}" style="--fam:rgb(${f.rgb});--fam-rgb:${f.rgb};--i:${i}">
          <div class="top"><span class="name">${f.name}</span>${bolts(f, phone ? 10 : 12)}</div>
          <div class="vig">${vignette(f)}</div>
          <p class="blurb">${f.blurb}</p>
          <div class="fig"><span>Max win</span><b>${f.max}<small> your bet</small></b>${f.cost ? `<em>Costs ${f.cost} your bet</em>` : ''}</div>
          <div class="act">${f.id === LIVE ? '<span class="now">Playing now</span>' : '<button class="action sw">Switch</button>'}</div>
          <div class="confirm"><p class="q">Switch mode?</p><p class="ceil">Your four guesses top out at 95.4× your bet.</p>
            <div class="row"><button class="cancel">Cancel</button><button class="action go">Switch</button></div></div>
        </article>`).join('')}</div>
      <p class="note">${NOTE}</p>`;
    stage.appendChild(panel);
    return { veil, panel };
  }

  function demo(stage) {
    const { veil, panel } = mount(stage);
    const hs = panel.querySelector('[data-id="hs"]');
    loop(7800, async () => {
      panel.classList.remove('in', 'confirming'); veil.classList.remove('in'); hs.classList.remove('pressing', 'chosen');
      void panel.offsetWidth;
      await wait(500);
      veil.classList.add('in'); panel.classList.add('in');       // 220ms arrival, then the five are dealt up
      await wait(2600);
      hs.classList.add('pressing'); await wait(160); hs.classList.remove('pressing');
      panel.classList.add('confirming'); hs.classList.add('chosen'); // Stake's confirmation, on the card itself
      if (phone) hs.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
  window.RACK = { mount, demo, phone };
})();
