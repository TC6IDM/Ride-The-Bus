/* Shared by the G (mode picker) mock-ups. Every figure and sentence below is the
   game's own: FAMILY_RULES (maxWin, cost), FAMILY_BLURB, FAMILY_BOLTS, in
   FAMILIES_BY_VOLATILITY order. Mock-only. */
(function () {
  const F = [
    { id: 'sc', name: 'Second Chance', rgb: '61, 220, 132', bolts: 1, max: '585.2×', cost: null,
      blurb: 'A wrong first card ends the round. After that your first miss is forgiven and play continues.' },
    { id: 'base', name: 'Classic', rgb: '255, 201, 60', bolts: 3, max: '1,354.2×', cost: null,
      blurb: 'A wrong first card ends the round. Later misses keep 30% of your running total.' },
    { id: 'ls', name: 'Last Stop', rgb: '255, 146, 64', bolts: 4, max: '4,301.9×', cost: null,
      blurb: 'A wrong first card ends the round. Later misses keep 30% of your running total. A right suit draws a ticket that multiplies it by 2 to 10.' },
    { id: 'hs', name: 'High Stakes', rgb: '255, 92, 92', bolts: 5, max: '2,237.3×', cost: null,
      blurb: 'A wrong first card ends the round. Later misses keep only 15%, so every correct guess is worth more.' },
    { id: 'tr', name: 'Three of a Kind', rgb: '178, 124, 200', bolts: 7, max: '4,583.3×', cost: '250×',
      blurb: 'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.' },
  ];
  const LIVE = 'base';

  const BOLT = 'M13.5 2 4 13.5h6.2L9 22l10-12.5h-6.4L13.5 2Z';
  function bolts(f, size = 12) {
    return `<span class="bolts" aria-label="Volatility ${f.bolts} of 7">${Array.from({ length: 7 }, (_, i) =>
      `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="fill:${i < f.bolts ? `rgb(${f.rgb})` : 'rgba(255,240,220,0.18)'}"><path d="${BOLT}"/></svg>`).join('')}</span>`;
  }

  /* Small scenes made of the game's own pieces, one per family. */
  function vignette(f) {
    const card = (rank, suit, x, y, r, w = 34) =>
      `<div class="face" style="left:${x}%;top:${y}%;width:${w}%;aspect-ratio:200/298;transform:translate(-50%,-50%) rotate(${r}deg)">${RTB.face(rank, suit)}</div>`;
    const back = (x, y, r, w = 34) => `<div class="back" style="left:${x}%;top:${y}%;width:${w}%;aspect-ratio:200/298;transform:translate(-50%,-50%) rotate(${r}deg);--wm:3.4px"></div>`;
    if (f.id === 'base') return card('7', 'heart', 26, 54, -12, 30) + card('9', 'club', 42, 48, -4, 30) + card('3', 'diamond', 58, 48, 4, 30) + back(74, 54, 12, 30);
    if (f.id === 'sc') return card('8', 'spade', 36, 52, -6) + card('5', 'heart', 62, 52, 6) +
      `<svg class="forgive" viewBox="0 0 24 24" style="left:62%;top:22%"><path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="rgb(${f.rgb})" stroke-width="2.6" stroke-linecap="round"/><path d="M3.5 3.8 7.4 7.3l-4.8 1.3Z" fill="rgb(${f.rgb})"/></svg>`;
    if (f.id === 'ls') return `<div class="ticket" style="--fam:rgb(${f.rgb})">${ticket()}</div>`;
    if (f.id === 'hs') return `<div class="stack">${Array.from({ length: 9 }, (_, i) => `<i style="bottom:${i * 9}%"></i>`).join('')}</div>`;
    return card('K', 'spade', 30, 54, -10, 30) + card('K', 'heart', 50, 48, 0, 30) + card('K', 'club', 70, 54, 10, 30);
  }
  /* TicketFace.svelte's own geometry (120 x 200), face down: the range is printed. */
  function ticket() {
    return `<svg viewBox="0 0 120 200"><defs><mask id="tk" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="200"><rect width="120" height="200" fill="#fff"/><circle cx="0" cy="128" r="9"/><circle cx="120" cy="128" r="9"/></mask></defs>
      <g mask="url(#tk)"><rect width="120" height="200" rx="9" fill="var(--card-paper)"/><rect width="120" height="44" fill="var(--fam)"/><rect y="41.5" width="120" height="2.5" fill="rgba(0,0,0,0.18)"/>
      <line x1="12" y1="128" x2="108" y2="128" stroke="rgba(22,19,15,0.35)" stroke-width="1.6" stroke-dasharray="3.2 3.2"/></g>
      <text x="60" y="27.5" text-anchor="middle" textLength="98" lengthAdjust="spacingAndGlyphs" font-family="Overpass" font-weight="800" font-size="15" letter-spacing="1.2" fill="#14110a">LAST STOP</text>
      <text x="60" y="92" text-anchor="middle" font-family="Overpass" font-weight="700" font-size="20" fill="rgba(22,19,15,0.72)">×2 – ×10</text>
      <g stroke="rgba(22,19,15,0.5)" stroke-width="1.6"><line x1="20" y1="170" x2="100" y2="170"/>${[0, 1, 2, 3].map((i) => `<circle cx="${20 + i * 20}" cy="170" r="3" fill="var(--card-paper)"/>`).join('')}</g><circle cx="100" cy="170" r="5" fill="var(--fam)"/></svg>`;
  }

  const CSS = `
    .vig { position: relative; }
    .vig .face, .vig .back { position: absolute; box-shadow: 0 3px 8px rgba(0,0,0,0.45); }
    .vig .forgive { position: absolute; width: 28%; transform: translate(-50%, -50%); filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); }
    .vig .ticket { position: absolute; left: 50%; top: 50%; height: 88%; aspect-ratio: 120/200; transform: translate(-50%, -50%) rotate(-6deg); filter: drop-shadow(0 4px 6px rgba(0,0,0,0.45)); }
    .vig .ticket svg { width: 100%; height: 100%; display: block; }
    .vig .stack { position: absolute; left: 50%; bottom: 10%; width: 34%; height: 76%; transform: translateX(-50%); }
    .vig .stack i { position: absolute; left: 0; right: 0; height: 22%; border-radius: 50%;
      background: repeating-conic-gradient(from 10deg, #f4efe6 0 12deg, var(--brand-red) 12deg 45deg);
      box-shadow: 0 2px 0 #5a0414, 0 3px 4px rgba(0,0,0,0.4); }
    .vig .stack i::after { content: ''; position: absolute; inset: 18%; border-radius: 50%; background: var(--brand-red); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.6); }
    .bolts { display: inline-flex; gap: 1px; }
  `;
  window.MODES = { F, LIVE, bolts, vignette, CSS };
})();
