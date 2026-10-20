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
| Mode picker | **G1** `g1-blinds.html` (switched from G3 on 2026-10-18) | Built exactly as the mock-up, at two-thirds of a desktop window, centred on the page | G3 `g3-hand` (built first, then replaced), G2 `g2-flood`, original `today.html?f=mode` |
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
| Close-call hold (2026-10-19) | **CL3, the squeeze**, *modified* and **built 2026-10-20**: `cl3b-squeeze-peel.html` is the latest mock | The peel shows the real card. The squeeze waits until the card is in front. Auto turn by default, peeling from the bottom-left. A setting in the autoplay menu lets the player peel it from any corner: past the line it turns, shows the face, and goes home | CL1 `cl1-last-stop`, CL2 `cl2-house-lights`, original `today.html?f=hold0:640,hold1:450,hold2:470,hold3:460,hold4:520,hold5:1900` |
| Win takeover (2026-10-18) | **W1 + chips**, *modified* (`w1d-chips-flat.html` is the last mock) | See "The win takeover" below: four rounds of notes | W1 without chips `w1-departures`, W2 `w2-payout`, W3 `w3-ticket`, the earlier chip passes `w1b-chips` and `w1c-chips-stream`, original `today.html?ext=png&f=tk-epic:1500,tk-max:2600` |

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

## The win takeover (2026-10-18)

Audited the same way as the rest (Hallmark, impeccable, the motion skills,
`npm run shots`, `npm run audio`); the evidence is in `takeover-phase1/`. The
directions were published as the "Win takeover" tab of the same artifact
(v9-v13).

**Picked: W1, the departures board, with chips.** The loader's destination
blind rolls the tier words, a route of five stops ends at Max, and the amount
runs on a hero split-flap. The owner's notes came in four rounds, and the spec
being built is the sum of them:

1. Add chips flying out from behind the cards (`w1b-chips`).
2. Double them, make them 3D and styled like the table's chips, make them
   stream continuously and thicken at every tier, let the cards breathe
   slowly, tone the cards down by bringing the fade back or letting the tier
   words cover their bottoms, and always start at Big and climb through every
   tier (`w1c-chips-stream`).
3. Halve the chips, keep them flat, fade less and cover less
   (`w1d-chips-flat`).
4. "No cover": the sign sits below the hand and does not overlap it at all.
   This is the build's spec; no mock shows it exactly.

### Alternatives offered and passed on

Kept so any of them can be reopened. Each is still playable from this folder.

- **W1 without chips** (`w1-departures`): my recommendation before the owner's
  first note.
- **W2, paid out on the felt** (`w2-payout`): five stacks of the table's chips
  pushed across from the rack, growing taller at every rung, with the amount
  engraved on a brass plaque whose enamel band carried the tier. Sound would
  have been a chip clack per rung. Its risk was the most money imagery in the
  game, which needed a social-mode check.
- **W3, the ticket** (`w3-ticket`): a ticket issued from the rail, its five
  fare stages punched as the count passed each, then stamped with the tier, and
  sunk back into the rail toward Last Win on Continue. Sound would have been a
  punch click per rung and a stamp thump. Its risk was two tickets on screen on
  a Last Stop win.
- **The suit-mark burst kept alongside the chips.** I read the chips as
  REPLACING today's suit marks (the audit called them debris) and asked; the
  owner went ahead with chips only.
- **One burst per tier only** (`w1b-chips`: 6 chips on Big up to 16 on Max, a
  moment rather than a loop). Passed on for a continuous stream.
- **3D chips, and twice as many** (`w1c-chips-stream`: solid cylinders
  tumbling in depth, a stream of 6-28 a second plus bursts of 12-32). Passed
  on as too many, and flat preferred.
- **The tier sign covering the bottom of the cards on a heavy fade band**
  (`w1c-chips-stream`), then a lighter overlap (`w1d-chips-flat`). Passed on
  for no overlap at all.
- **Counting from the board's last figure** (the rule since 2026-10-05, which
  skipped the tiers the board had already passed). Passed on: every win climbs
  from Big.
- **A still hand.** The audit recommended no idle motion on the takeover;
  the owner asked for the cards to breathe.
- **The audit's own recommendation against loops.** It removed the beam's and
  the prompt's endless pulses, which the build does. The owner then chose a
  continuous chip stream and a breathing hand, which are loops by request.

## Answers given during the build (2026-10-18)

- **The guess chip.**
  - **Placement:** a pointer pick lands the chip near the click, inside the
    rules (off the mark, inside the section).
  - **On "=":** it sits further out: right of the badge on Higher/Lower,
    below it on Inside/Outside.
  - **Suit chips:** they may overhang the square's border, never cut off.
  - **Colour:** the bet's own chip from the bet menu, rounding a typed amount
    down. **On the intro it is always the plain red chip.**
- **The table's chips** now wear the guess chip's face (the cream ring and
  eight narrow spots). The takeover's flying chips and the High Stakes stack
  were changed to match.
- **The High Stakes stack** is a real stack: walls touching, the face on top.
  It no longer reads as floating discs.
- **The intro's picks are the game's.** Continue hands them to the board, and
  the four squares fly down carrying their picks and chips.
- **The running total never moves.** The bust's half-unit "settle" was
  removed.
- **The turbo bolt fills in at Instant.**
- **The mode picker:**
  - **G1 replaced G3** the same day G3 was built.
  - **Its size:** no longer filling a desktop or laptop window (about
    two-thirds).
  - **Its look and position:** centred on the page, and matched to the G1
    mock-up's look.
  - **G3's turn, back on G1's cards (2026-10-19):** Switch turns the card
    over where it stands and its back is the confirmation. Nothing dims when
    a card is picked, and the "Bolts show each mode before your Equal picks"
    note is gone.

Passed on in this round:
- **G3, the dealt hand:** it was built and committed, then replaced by G1.
- **G1 on the hand's paper cards:** my first G1 build was passed on for the
  mock-up's dark panel cards.
- **The picker pinned near the top of the window:** passed on for centred.
- **G3's turn to the middle of the table:** passed on for turning in place.
- **The confirmation laid over the foot of a G1 card, the other four
  dimmed:** passed on for the turn.
- **The bet-coloured chip on the intro:** passed on for plain red.
- **A future idea (not to be built yet):** a cigar-smoking mobster character
  in a chair on the right, with idle smoke and a puff on big rounds.

## The close-call hold (2026-10-19 to 2026-10-20)

The held last card, studied the way the overhaul's directions were: today's
hold captured frame by frame and measured with `npm run audio`, then three
playable mock-ups in the comparison page's "Close-call hold" tab, then a
refinement round, then a sound audition (`hum-audition.html`, published as
https://claude.ai/artifact/U6wF182WQ6SQzY1Zmpv54W).

**Picked:**
- **CL3, the squeeze**, *modified* (`cl3b-squeeze-peel.html`): the card comes
  out in front, and only once it has arrived does its bottom-left corner peel
  to show the real face, then it turns and goes home. Built 2026-10-20.
- **Auto by default, with a setting** in the autoplay menu to peel it by hand
  from any corner.
- **The win chime lands on the turn**, with the strike, not when the card is
  home again.
- **The sound: the crowd** (today's "ohhh", unchanged).
- **While a player peels it: "Follows your hand"**, modified: SILENT until the
  corner first lifts (never playing quietly before), its level follows the
  peel, and putting the card back down STOPS it; it starts afresh on the next
  peel.

**Passed on (all still playable in the archive):**
- **CL1, the last stop** (`cl1-last-stop.html`): the readout turns over to
  "Next stop ♥ $1,354.20" and the bus pulls toward a lit terminus.
- **CL2, house lights down** (`cl2-house-lights.html`): the room goes dark but
  for a beam on the card and a pool on the needed pick.
- **CL3 as first drawn** (`cl3-squeeze.html`): the peel showed blank paper
  rather than the face, and the corner began lifting while the card was still
  travelling.
- **The original hold**: the card rising 1.5 units in its slot under the
  tunnel (`today.html?f=hold0:640,...`). Kept for reduced motion only.
- **The other five suspense sounds** (`hum-audition.html`): held breath
  (breath only through the "oh"), drum roll, heartbeat, rising strings, and
  the endless Shepard rise.
- **The other four ways to wait during a manual peel**: holds at the top
  (what shipped first, and what the owner found annoying), settles to a
  hush, fades into a heartbeat, and goes quiet.
- **The first "Follows your hand"** in the audition: the hum was started on
  the deal and only gated to silence until touched; the owner wants it not
  started at all until the peel begins, and stopped (not faded to quiet) when
  the card is put back.
- **Where the setting lives:** I first proposed the Turbo bump; passed on for
  the autoplay menu.
