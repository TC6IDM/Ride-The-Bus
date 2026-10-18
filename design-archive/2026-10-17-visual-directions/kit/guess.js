/* Shared by the E (guess square) mock-ups: the four guesses, their segments and
   redrawn pictograms. Fills are the game's "Felt & brass" tokens. Mock-only. */
(function () {
  const ARROW_UP = '<path d="M12 5 20 18H4Z"/>';
  const ARROW_DOWN = '<path d="M12 19 4 6h16Z"/>';
  // Inside: a card BETWEEN two card outlines. Outside: a card BEYOND the pair.
  const INSIDE = '<rect x="2" y="5" width="6" height="14" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="16" y="5" width="6" height="14" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="9.5" y="7" width="5" height="10" rx="1"/>';
  const OUTSIDE = '<rect x="6" y="5" width="5" height="14" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="12.5" y="5" width="5" height="14" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="19" y="7" width="4" height="10" rx="1"/><rect x="1" y="7" width="4" height="10" rx="1" opacity="0.35"/>';
  const svg = (inner, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor">${inner}</svg>`;
  const suit = (name) => svg(RTB.SUIT[name].map((d) => `<path d="${d}"/>`).join(''));

  /* Each guess: its segments (name, fill, glyph, layout) and whether "=" sits on its seam. */
  const GUESSES = [
    { key: 'color', label: 'Color', split: 'v', eq: false, segs: [
      { id: 'black', fill: 'var(--choice-black)', glyph: '' }, { id: 'red', fill: 'var(--choice-red)', glyph: '' }] },
    { key: 'hl', label: 'Higher / Lower', split: 'h', eq: true, segs: [
      { id: 'higher', fill: 'var(--choice-higher)', glyph: svg(ARROW_UP) }, { id: 'lower', fill: 'var(--choice-lower)', glyph: svg(ARROW_DOWN) }] },
    { key: 'io', label: 'Inside / Outside', split: 'v', eq: true, segs: [
      { id: 'inside', fill: 'var(--choice-inside)', glyph: svg(INSIDE) }, { id: 'outside', fill: 'var(--choice-outside)', glyph: svg(OUTSIDE) }] },
    { key: 'suit', label: 'Suit', split: 'q', eq: false, segs: [
      { id: 'heart', fill: 'var(--choice-black)', glyph: suit('heart'), ink: 'var(--card-red)' }, { id: 'spade', fill: 'var(--choice-black)', glyph: suit('spade') },
      { id: 'club', fill: 'var(--choice-black)', glyph: suit('club') }, { id: 'diamond', fill: 'var(--choice-black)', glyph: suit('diamond'), ink: 'var(--card-red)' }] },
  ];
  const PICKS = ['black', 'higher', 'outside', 'heart'];
  const EQ = '<svg viewBox="0 0 24 24"><rect x="5" y="8" width="14" height="2.6" rx="1.3" fill="#3a2a06"/><rect x="5" y="13.4" width="14" height="2.6" rx="1.3" fill="#3a2a06"/></svg>';

  /* Build one square's markup with the given class prefix; the mock's own CSS styles it. */
  function square(G) {
    const segs = G.segs.map((s) => `<button class="seg seg-${s.id}" data-id="${s.id}" style="--fill:${s.fill};--ink:${s.ink || 'var(--ink-cream)'}"><span class="gl">${s.glyph}</span></button>`).join('');
    return `<div class="sq split-${G.split}" data-key="${G.key}">${segs}${G.eq ? `<span class="eq">${EQ}</span>` : ''}</div>`;
  }

  /* Pick the demo's four guesses one by one, then clear: the same rhythm in every E mock. */
  function demo(root, onPick) {
    return RTB.loop(5200, async () => {
      root.querySelectorAll('.seg.on').forEach((b) => b.classList.remove('on'));
      root.querySelectorAll('.punch-dot, .chipmark').forEach((n) => n.remove());
      await RTB.wait(700);
      for (const id of PICKS) {
        const b = root.querySelector(`.seg-${id}`); b.classList.add('on'); onPick && onPick(b);
        await RTB.wait(650);
      }
    });
  }
  window.GUESS = { GUESSES, PICKS, square, demo, svg };
})();
