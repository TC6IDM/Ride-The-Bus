/* How to Play content for the H mock-ups: the game's own sentences (HowToPlayPopup
   strings, en.ts), arranged as sections. Mock-only. */
(function () {
  const { face } = RTB;
  const sq = (a, b, dir) => `<span class="msq" style="background:linear-gradient(${dir}, ${a} 50%, ${b} 50%)"></span>`;
  const GUESSES = [
    [sq('#16181c', '#c0392b', '90deg'), 'Color: is card 1 red or black?', [['K', 'spade']]],
    [sq('#4fae72', '#b3263a', '180deg'), 'Higher or Lower: is card 2 above or below card 1, or Equal to it?', [['7', 'diamond'], ['J', 'spade']]],
    [sq('#2f9d9a', '#9b4f9a', '90deg'), 'Inside or Outside: is card 3 between cards 1 and 2 or outside them, or Equal to one of them?', [['4', 'club'], ['10', 'heart'], ['7', 'spade']]],
    ['<span class="msq" style="background:#16181c"></span>', 'Suit: which suit is card 4?', [['A', 'heart']]],
  ];
  const MODES = [['Second Chance', '61, 220, 132', '585.2×'], ['Classic', '255, 201, 60', '1,354.2×'], ['Last Stop', '255, 146, 64', '4,301.9×'], ['High Stakes', '255, 92, 92', '2,237.3×'], ['Three of a Kind', '178, 124, 200', '4,583.3×']];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const mini = ([r, s]) => `<span class="mface face">${face(r, s)}</span>`;
  const SECTIONS = [
    { id: 'guesses', tab: 'Guesses', title: 'Guess your way through four cards:', html: `<ol class="glist">${GUESSES.map(([q, t, c]) => `<li>${q}<span class="gt">${t}</span><span class="gc">${c.map(mini).join('')}</span></li>`).join('')}</ol>
        <p>Pick all four, set your bet and deal. Each right guess multiplies your win, and four right is a full game win. What a wrong guess costs depends on the game mode; see Game modes below.</p>` },
    { id: 'order', tab: 'Card order', title: 'Card order', html: `<p>Ace is low and King is high. Suits have no rank: only the card’s value counts for Higher, Lower, Inside and Outside.</p>
        <div class="ranks">${RANKS.map((r) => `<span>${r}</span>`).join('')}</div><div class="ranks-ends"><span>Lowest</span><span>Highest</span></div>` },
    { id: 'payouts', tab: 'Payouts', title: 'Payouts follow the odds', html: `<p>Each right guess is priced on the cards still in the deck: the less likely it is, the more it pays. So the same guess can pay differently from one round to the next.</p>` },
    { id: 'modes', tab: 'Modes', title: 'Game modes', html: `<p>There are 257 ways to play: every set of picks is its own bet, priced on its own odds.</p>
        <div class="mrows">${MODES.map(([n, rgb, m]) => `<div class="mrow" style="--fam:rgb(${rgb})"><b>${n}</b><span>Max win ${m} your bet</span></div>`).join('')}</div>` },
    { id: 'rules', tab: 'Rules', title: 'Game information', html: `<p>Return to player (RTP) is 96.00% on every game mode. The most this game can pay is 4,583.3× your bet, on Three of a Kind.</p>
        <p class="small">Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays…</p>` },
  ];
  const CSS = `
    .msq { display: inline-block; width: 22px; height: 22px; border-radius: 6px; flex: 0 0 auto; box-shadow: inset 0 1px 0 rgba(255,255,255,0.25); }
    .glist { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 10px; }
    .glist li { display: grid; grid-template-columns: 22px 1fr auto; gap: 10px; align-items: center; }
    .gt { font: 400 13.5px/1.4 var(--font-body); color: var(--ink-body); }
    .gc { display: flex; gap: 3px; }
    .mface { position: relative; display: block; width: 24px; height: 36px; }
    .ranks { display: grid; grid-template-columns: repeat(13, 1fr); gap: 3px; margin-top: 8px; }
    .ranks span { padding: 6px 0; text-align: center; border-radius: 5px; background: var(--card-paper); color: var(--card-ink); font: 700 13px/1 var(--font-display); }
    .ranks-ends { display: flex; justify-content: space-between; margin-top: 4px; font: 600 11px/1 var(--font-body); color: var(--ink-dim); }
    .mrows { display: grid; gap: 6px; margin-top: 8px; }
    .mrow { display: flex; justify-content: space-between; gap: 10px; padding: 9px 12px; border-radius: 8px; background: rgba(0,0,0,0.25); box-shadow: inset 3px 0 0 var(--fam); }
    .mrow b { font: 900 17px/1 var(--font-display); color: var(--fam); }
    .mrow span { font: 600 12.5px/1.3 var(--font-body); color: var(--ink-body); text-align: right; }
    .small { font-size: 11.5px !important; color: var(--ink-dim) !important; }`;
  window.HOWTO = { SECTIONS, CSS };
})();
