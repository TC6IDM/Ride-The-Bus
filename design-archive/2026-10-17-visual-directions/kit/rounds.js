/* Recent rounds for the R mock-ups: the five rounds played on the dev build
   (2026-10-17), newest first, plus one marked example win. Mock-only. */
(function () {
  const ROUNDS = [
    { fam: 'Classic', rgb: '255, 201, 60', bet: '$1.00', cards: [['2', 'club'], ['6', 'spade']], marks: ['ok', 'no'], word: 'Kept', amt: '$0.50', mult: '0.5×', picks: 'Black · Lower · Equal · Diamond' },
    { fam: 'Second Chance', rgb: '61, 220, 132', bet: '$1.00', cards: [['9', 'heart'], ['J', 'spade'], ['5', 'diamond'], ['8', 'heart']], marks: ['ok', 'ok', 'fg', 'ok'], word: 'Won', amt: '$3.20', mult: '3.2×', picks: 'Red · Higher · Inside · Heart', example: true },
    { fam: 'Classic', rgb: '255, 201, 60', bet: '$1.00', cards: [['6', 'club']], marks: ['no'], word: 'Busted', picks: 'Red · Lower · Outside · Club' },
    { fam: 'Classic', rgb: '255, 201, 60', bet: '$1.00', cards: [['K', 'club']], marks: ['no'], word: 'Busted', picks: 'Red · Equal · Outside · Spade' },
    { fam: 'Classic', rgb: '255, 201, 60', bet: '$1.00', cards: [['Q', 'club'], ['3', 'heart']], marks: ['ok', 'no'], word: 'Kept', amt: '$0.50', mult: '0.5×', picks: 'Black · Higher · Equal · Club' },
  ];
  window.ROUNDS = ROUNDS;
})();
