# Design — Ride The Bus

The locked design system for this app, written by the second Hallmark pass
(2026-09-12; the type decision amended 2026-09-13). Every later visual change
reads this first. It is deliberately
short and carries **no values**: the numbers live in `src/styles/tokens.css`,
the rules in the repo-root `CLAUDE.md`, and the arguments in
`.claude/skills/rtb-invariants/`. A hex restated here would be a hex that
could drift.

## Genre

**Atmospheric.** The game is a lit room — a hand-sampled table under one
light from the upper right (`styles/scene/table.css` measured it). Everything
drawn over the table is lit by that light: a lit top edge, a shaded bottom
edge, a shadow that falls down and left. A uniform 1px hairline all the way
round a box is the tell that it was drawn rather than lit.

## The material

One panel. Three tokens — `--panel-face`, `--panel-elevation`,
`--panel-elevation-low` — over `--panel`, edged with `--panel-edge`. The
popups, the error dialog and the replay panel wear the full elevation; the
control bar's pills, its floating discs and the RG plate wear the low one, over
their translucent `--panel-light` / `--panel-dark` / `--panel-float` fills. No
sheet spells its own shadow.

## Ink

**One ramp, warm:** `--ink-strong` / `--ink-body` / `--ink-dim`, with `--ink`
for headline white and `--ink-cream` for a figure sitting in a warm glow.
`--ink-warm*` are aliases of the same three. Every step was re-pointed at
parity of contrast against the three panel grounds (the table is in
`tokens.css`); nothing cool is printed on a warm panel.

## Colour

- **One accent for anything chosen; a fixed identity colour per control that
  opens something.** Turbo amber, autoplay green, sound cream, info blue, and
  MODE in the live family's own colour. These are wayfinding, not decoration
  (`--ctl-*`).
- **Purple is Three of a Kind's**, and the Epic tier's: a dusty amethyst, not
  the saturated screen violet every generated palette reaches for.
- **Every menu wears the colour of the control that opened it** — the
  `--tint` / `--tint-rgb` / `--tint-strong` / `--tint-ink` contract in
  `popup-base.css`. Nothing inside a panel names a colour.
- **The volatility ruler** (`--vol-*`, seven stops) is the one scale both the
  bet display and the mode picker read; the bet and mode panels tint with it.
- **Colour that is data is not art-directed**: the choice-row fills, the chip
  denominations, the card reds and blacks. The fills are the owner's; the
  LIGHT on them is the table's - the squares take the lit top edge, the shaded
  bottom and the two-part shadow like every other object on it. Higher, Inside
  and Outside were softened on 2026-09-27 - same hue and lightness, less
  chroma - on the owner's call; the fills that shipped before are kept in
  `tokens.css` as the `-original` tokens, one edit away.
- Two files are exempt from tokens: `table.css` (sampled measurements) and
  `win-celebration.css`'s tier palette (a closed one-screen set). The deal
  button's `--spin-*` palette was a third until the controls guide drew the same
  button; it is in `tokens.css` now.
- Stacking is named too: the page's layers (`--z-popup` … `--z-takeover`) are
  tokens, so a new overlay is placed by what it is. Stacking inside one
  component stays local and numeric.

## Type

- Display: **Big Shoulders** 700/900 — the wordmark, the card ranks, the win
  title. Latin only; never on a translated string without reading
  `game/ui/displayFace.ts`.
- Body and UI: **Geist**, variable (one file per subset covers every weight),
  self-hosted in latin, latin-ext, vietnamese and cyrillic. The game sets it
  at 400/700/800/900. Chosen after measuring three faces with fontTools:
  Poppins (no tabular figures, a banned default) and Barlow (kin to Big
  Shoulders, but static, no Cyrillic, no rupee) — the argument is at the top
  of `components/app.css`. Geist's neutrality is the point: the wordmark and
  the table carry the character, the type stays out of the way.
- Small caps: `--track-label`, uppercase, only on a two-word caption over a
  figure (the bar's BALANCE, BET, LAST WIN). Never on a sentence, never on a
  field's label and never on a section heading - those are sentence case at
  body size or above. Six spaced-caps headings down one page is the eyebrow
  tell, and How to Play had them until the third audit. The board's four guess
  labels and the takeover's "Tap to continue" were the last two in small caps
  (the fourth review, 2026-09-27); a guess is named one way everywhere,
  "Higher / Lower". Panel titles are sentence case too: "Game mode", "How to
  play".
- **A multiplier prints one way**: one decimal, grouped like money, then ×
  (`formatMultiplier`). Payouts are floored to 0.1, so a second place is always
  a false 0. A guess's PRICE (How to Play's pay table) is the one exception,
  and keeps two places because it is not floored. A round that paid nothing
  prints no multiplier at all - "$0.00 0.0×" said zero twice.
- **The result is said as well as shown**: one polite status line per settled
  round ("Banked, $1.20, 1.2×"), off the same latched readout as the bar, so a
  screen reader hears it when the card has turned and not before.
- **Before the first deal, the readout's empty slot says the one thing to do**
  ("Pick all 4 guesses"), in sentence case at body size, laid over the slot so
  nothing moves - and goes the moment the four are picked.
- **The type stops at a floor.** Everything scales with `--ui`, and Popout S is
  Popout L at half size - so at half size the balance was 5.9px. Type now takes
  `max(its own size, --type-floor | --type-floor-figure)`: 6px for a label, 9px
  for money, a win and the one action on screen. The arrangement still halves.
- **Figures are tabular** — Geist ships `tnum`, so `font-variant-numeric:
  tabular-nums` is live and a figure keeps its width as its digits change.
  `typeFit.labelEms()` is measured against Geist 800 (every digit 0.65 em);
  its test table is the record. If the face ever changes, that table, the
  `unicode-range` transcription in `displayFace.ts` and the two fitting
  contracts are what must be re-measured — not guessed.

## Cards

A casino deck, printed once and dealt everywhere: `CardFace.svelte` draws every
face the game deals (the board, the takeover's fan). Paper, edge and shadow are
the container's; the face is what is printed on it.

- **Numbers** carry their value in pips on the standard grid; a pip below the
  middle is printed upside down. Pips are a fifth of the card wide.
- **Aces** are one large pip in a gold ring with a gold engraved line. The
  **Ace of Spades is the house card** - larger, engraved, the house name under
  it, as a casino deck prints its maker's mark there. It echoes the backs.
- **Courts** are the English pattern (CC0), in its own cut-corner frame with a
  suit pip beside each head, restyled into the card tokens.
- **The lobby tile is photographed from the game, never painted**:
  `scripts/tile-art.mjs` renders the hand (`?dev_tile=fg`) and the live table.
  The generated pair it replaced was the most visibly machine-made thing
  submitted.
- **The Takeover crown** - the logo's crown, flat, in gold - sits over each
  court's pip and over the house spade, where crown-over-spade is the logo's own
  mark. Gold only: it never carries a suit colour.
- **One colour family per card**: red, maroon, rose - or ink, slate, stone -
  plus gold and paper. Never both families: card 1's guess is Red or Black and
  the courts must not blur it.
- **Small**: under 46px on screen a number card is one large pip and a larger
  index - the two marks that survive being small.
- The corner index is Big Shoulders 700, top-left and turned bottom-right; in
  Arabic the whole face mirrors and its text is turned back.

## Icons

**Controls are lines, gauges are fills.** A pressable mark is stroked, round
caps and joins, ~2.2 on a 24 grid — `MarkIcon.svelte`'s voice. A mark that is
read (the bolt meter) is filled. The spin button is the stated exception: its
marks are shapes (two cards, a stop square, two chevrons) and it is the hero
control. Glyphs are drawn only where the font does not own them; card ranks
stay ASCII.

## The primary action

One voice, everywhere: the `.action-button` recipe — a shallow two-stop fill
in the panel's tint, the lit top edge, the table's contact shadow, dark ink on
a light fill, weight 800, sentence case. The mode confirmation, autoplay's
Start, the error dialog's Reload, the replay's Play and the intro's Tap to
continue are all this. The way out (Cancel) is a hairline outline, quiet.

## Motion

Three curves and one duration token (`--ease-out`, `--ease-in-out`,
`--ease-pop`; `--dur-control`). A panel **arrives** — 220ms from 0.96 scale,
its backdrop 200ms ahead of it — and leaves instantly. Hover lifts a control's
light; a press pushes it in. Reduced motion collapses arrivals to 120ms of
opacity and keeps every state change. A focus ring is never transitioned.
**Lit, not haloed:** a coloured bloom around a coloured control is the one
effect this system refuses by name.

The reveal has two beats of its own. When a lot rides on the last card of a
round with an Equal pick it is **held** - for longer the more it would land, decided from
the stake and never from the outcome. The card slides up off the table in a
straight line, its shadow lengthening, while the music steps back and muffles,
a crowd's "ohhhh" climbs with it - a few voices for a Big win, the whole crowd
above - and, when the card could land a Huge win or bigger, the room closes in
on it: tunnel vision, a vignette of the table's own shadow narrowing onto the
card and rising with it, the card lifted clear of it; all of it sits at the
top for a breath; then the card slams down as it turns, on a lightning strike
sized to the stake, and the room opens again. Card, voices and tunnel run on
one clock (`holdClimbMs`). The control
bar is outside the tunnel on purpose: the balance and the skip stay lit.
A bust **knocks** once
as its cross lands, the cards it never reached step back, and the guess that
failed takes a ring - after the card has turned, never during. **A result of
any kind lands after the turn**: the card's multiplier chip and the running
total wait for the flip too (0.9 of `--flip-dur`), where they used to print the
answer while the card still showed its back.

## Focus

`--focus-ring` over `--focus-halo`. A control takes the 2px offset ring. A
panel that receives focus on opening puts the ring on the part that names it —
the header's rule thickens in the panel's tint — never a rectangle around the
dialog, and never the browser's default.

## What every panel shares

The material, the ink, the tint contract, the header voice (strong ink, 700, a
rule beneath, the close disc), the arrival, the focus device, and the touch
floors — 44px for a control alone or primary, 36px in a dense row, 32px where
the paint must stay small. The header STAYS: a panel that scrolls scrolls
under it, so its title and its way out are never a scroll away.

## What may differ

The tint; the content's shape — a list (mode), a chip rack (bet), pills,
fields and switches (autoplay), prose (How to Play); and the
width, where prose needs the measure.

## Known deviations, recorded

- Geist is the 2025 scaffold default, and on a warm table a neutral grotesque
  can read as dashboard chrome. Accepted with eyes open: it was chosen for
  coverage (Vietnamese, Cyrillic, the rupee, the peso, the sheqel) and for
  tabular figures, and the rest of the system — the sampled table, the
  drawn glyphs, the material, the wordmark — is what carries the character.
- Neither face ships the won (U+20A9) or the dong (U+20AB); KRW and VND
  print those from the OS font beside Geist digits, as they did under Poppins.
- Arabic, Hindi, Japanese, Korean and Chinese fall back to the OS sans-serif
  wholesale; neither face has a cut for those scripts and the inlined bundle
  will not take one.
- The win takeover glows nowhere. Its title is LETTERED - a hard block shadow
  in the tier's deep colour, cast down and left - and its cards carry a thin
  tier-coloured rim, not a bloom. The two-layer glow atmospheric once allowed
  here was the stock slot "BIG WIN" look, and went in the third audit.
- The intro's four step panels are dealt (fanned, lifted) rather than gridded;
  they flatten to a 2×2 on portrait phones by design.
