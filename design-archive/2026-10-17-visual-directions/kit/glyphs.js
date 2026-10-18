/* Control glyphs in MarkIcon's voice (stroked, round caps, ~2.2 on a 24 grid),
   for the bar and deal mock-ups. Mock-only. */
(function () {
  const S = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const G = {
    turbo: S('<path d="M13.5 2.5 4.5 13.5h6.5L10 21.5l9-11.5h-6.5l1-7.5Z"/>'),
    sound: S('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
    info: S('<circle cx="12" cy="12" r="9.2"/><path d="M12 11v6"/><path d="M12 7.4v.1"/>'),
    auto: S('<path d="M19.5 9A8 8 0 0 0 5 7.5"/><path d="M5 3.5v4h4"/><path d="M4.5 15A8 8 0 0 0 19 16.5"/><path d="M19 20.5v-4h-4"/>'),
    plus: S('<path d="M12 5v14M5 12h14"/>'),
    minus: S('<path d="M5 12h14"/>'),
    history: S('<path d="M4 7h16M4 12h16M4 17h10"/>'),
    // The deal mark: two cards, as the deal disc draws it.
    deal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="10" height="14" rx="2" transform="rotate(-12 8.5 12)" fill="#c9d3df"/><rect x="10" y="6" width="10" height="14" rx="2" transform="rotate(10 15 13)" fill="#f2f5f8"/></svg>',
  };
  const BOLT = 'M13.5 2 4 13.5h6.2L9 22l10-12.5h-6.4L13.5 2Z';
  const bolts = (n, rgb) => `<span style="display:inline-flex;gap:1px">${Array.from({ length: 7 }, (_, i) => `<svg viewBox="0 0 24 24" width="9" height="9" style="fill:${i < n ? `rgb(${rgb})` : 'rgba(255,240,220,0.2)'}"><path d="${BOLT}"/></svg>`).join('')}</span>`;
  window.GLYPHS = { G, bolts };
})();
