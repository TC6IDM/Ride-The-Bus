# Visual directions, 2026-10-17: what the owner picked and what was set aside

Every mock-up from the Phase 2 study is kept here, **the originals included**,
so that any direction can be reopened later. Open `index.html` over HTTP: from
this folder, run `python -m http.server 8770` and browse to
http://127.0.0.1:8770/. `courts.svg` will not load over `file://`. The comparison
page has one tab per area, and the first pane in each tab is the game as it was
on 2026-10-16. The same page was published as the artifact
https://claude.ai/artifact/Diuihq1RAKoS6weYD9ABDs (v5).

`phase1/` contains the Phase 1 audit (artifact
https://claude.ai/artifact/4gZ5YUw5BGaRwnhaCbvmkx) and the motion audit.
`001-003*.md` are the plans that came out of Phase 1. 002 and 003 have since
been superseded by C and A.

`today.html?f=<name>` shows a capture of the original. The captures are
`kit/today-*-{desk,phone}.webp`.

| Area | Picked | Owner's notes | Set aside (still here) |
|---|---|---|---|
| Loader | **A2** `a2-blind.html` | The first stop should be "Red/Black", not "Colour", and the suit stop should show the four suit marks | A1 `a1-deal`, A3 `a3-chip`, original `today.html?f=loader` |
| Hand-offs | **C1** `c1-panels-to-slots.html`, *modified* | The intro panels should become the GUESS SQUARES, not the card slots. Keep **C2** `c2-board-narrates` for a walk-through tutorial opened from the help menu | Original `today.html?f=intro:1800,board:2200` |
| Guess squares | **E3** `e3-chip-on-box.html`, *modified* | Keep the square-ish "=" badges. A chip's placement must never be ambiguous, for example a chip on "=" must not cover everything. Restyle the intro/hand-off theme to match | E1 `e1-brass`, E2 `e2-tickets`, E4 `e4-plaques`, E5 `e5-signs`, E6 `e6-enamel`, original `today.html?f=board` |
| Mode picker | **G3** `g3-hand.html` | none | G1 `g1-blinds`, G2 `g2-flood`, original `today.html?f=mode` |
| Room | **B1** `b1-backroom.html` | none | B2 `b2-depot`, B3 `b3-lit-felt`, original `today.html?f=board` |
| Card faces | **D1** `d1-house-print.html` | none | D2 `d2-back-print`, D3 `d3-bold-index`, original `d0-faces-today` |
| Turbo | **T1** `t1-turbo-bump.html` | none | T2 `t2-turbo-cycle`, original `today.html?f=turbo` |
| Sound | **S1** `s1-sound-bump.html` | none | S2 `s2-sound-tap`, original `today.html?f=sound` |
| Bet | **B1** `b1-bet-tray.html` | It must still look good with many chips in the menu. **The player can still type a custom amount** | B2 `b2-bet-rack`, original `today.html?f=bet` |
| Recent rounds | **R1** `r1-history-stubs.html` | Dim the paper rows, or make them more cream or darker | R2 `r2-history-drawer`, original `today.html?f=history` |
| Autoplay | **P1** `p1-autoplay-steps.html` | **Custom numbers stay typeable**: the round count and both limits | P2 `p2-autoplay-bump`, original `today.html?f=autospin` |
| How to Play | **H1** `h1-howto-guide.html` | Every Stake requirement stays: the pay table, RTP, max win, disclaimer, etc. | H2 `h2-howto-deck`, original `today.html?f=info` |
| Control bar | **X1** `x1-bar-rail.html` | Arrange it properly so it does not look like buttons scattered everywhere, especially on mobile. This reopens the old "leave the two-row phone bar alone" call | X2 `x2-bar-dash`, X3 `x3-bar-quiet`, original `today.html?f=board` |
| Deal button | **Original** (`dl1-deal-today.html`) | none | DL2 `dl2-deal-bell`, DL3 `dl3-deal-shoe`, DL4 `dl4-deal-puck` |
| Table props | **Original** | none | TB1 `tb1-fewer-props`, TB2 `tb2-casino-layout`, TB3 `tb3-fare-route` |
| Running total | **RW1** `rw1-splitflap.html` | none | RW2 `rw2-bus-carries`, original `today.html?f=midround` |

The mock-ups are scratch HTML on a copy of the tokens and photographs of the
game. None of them is shipping code, and none was ever imported by the app.

## Answers given during the build (2026-10-17)

- **E3: chip placement.** The chip may sit anywhere on the chosen section
  except on its symbol (it must never cover the |-> <-| marks, for example),
  and **the section the chip is on is highlighted**. Four "=" options were
  mocked (`e3-eq1`..`e3-eq4`). The owner then specified a fifth, **`e3-eq5`, which
  is CHOSEN**:
  - **"=" on Higher/Lower:** the chip goes HALF ONTO the badge, on the seam
    at the badge's side.
  - **"=" on Inside/Outside:** the chip goes half onto the badge, on the seam
    above or below it.
  - **The badge:** it lights up and grows slightly as the chip lands. It is
    smaller than today: 34% of the square, down from 50% (revised the same
    day from 40%).
  - **Every other pick:** keeps E3's original placement, with the chip INSIDE
    the section, covering as little of the mark as possible.
  - **Randomness:** Red/Black, Higher/Lower and Inside/Outside chips are set
    down by hand. Each pick jitters the position, spins the chip at random,
    and picks a random side of the mark where both sides have room, always
    clear of the mark.
  - **Suits:** the chip is smaller (18% of the square) and sits in the outer
    corner.
- **X1 on a phone: deal centred and symmetric.** Row 1 is the balance and
  last-win plaque, with sound and info as studs at its left end. Row 2 has bet
  and autoplay, then the deal disc in the centre, then turbo and MODE.
