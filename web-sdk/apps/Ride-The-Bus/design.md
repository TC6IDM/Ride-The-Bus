# Design — Ride The Bus

The locked design system for this app, written by the second Hallmark pass
(2026-09-12). Every later visual change reads this first. It is deliberately
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
  opens something.** Turbo amber, autoplay green, advanced purple, sound cream,
  info blue. These are wayfinding, not decoration (`--ctl-*`).
- **Every menu wears the colour of the control that opened it** — the
  `--tint` / `--tint-rgb` / `--tint-strong` / `--tint-ink` contract in
  `popup-base.css`. Nothing inside a panel names a colour.
- **The volatility ruler** (`--vol-*`, seven stops) is the one scale both the
  bet display and the mode picker read; the bet and mode panels tint with it.
- **Colour that is data is not art-directed**: the choice-row fills, the chip
  denominations, the card reds and blacks.
- Two files are exempt from tokens: `table.css` (sampled measurements) and
  `win-celebration.css`'s tier palette (a closed one-screen set).

## Type

- Display: **Big Shoulders** 700/900 — the wordmark, the card ranks, the win
  title. Latin only; never on a translated string without reading
  `game/ui/displayFace.ts`.
- Body and UI: **Poppins** 400/700/800/900, self-hosted, latin + latin-ext.
- Small caps: `--track-label`, uppercase, only on a two-word caption over a
  figure. Never on a sentence.
- **No tabular figures exist in either face** (measured: no `tnum`). A figure
  that changes while the player watches — the takeover count-up, the session
  clock — renders through `components/board/Figure.svelte`, which boxes each
  digit one "0" wide; its width and `typeFit.evenDigitEms()` are pinned
  together by a test. Every other figure is width-reserved by its container.

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

## Focus

`--focus-ring` over `--focus-halo`. A control takes the 2px offset ring. A
panel that receives focus on opening puts the ring on the part that names it —
the header's rule thickens in the panel's tint — never a rectangle around the
dialog, and never the browser's default.

## What every panel shares

The material, the ink, the tint contract, the header voice (strong ink, 700, a
rule beneath, the close disc), the arrival, the focus device, and the touch
floors — 44px for a control alone or primary, 36px in a dense row, 32px where
the paint must stay small.

## What may differ

The tint; the content's shape — a list (mode), a chip rack (bet), pills and a
field (autoplay), rows and switches (advanced), prose (How to Play); and the
width, where prose needs the measure.

## Known deviations, recorded

- Poppins is on Hallmark's banned-defaults list for body type. Kept
  deliberately: the money-fitting contract (`typeFit.ts`, `use:fitValue`) is
  measured against it, and it covers all 17 locales. Swapping to a face with
  real tabular figures is a candidate follow-up pass, not a per-page override.
- The win takeover's title carries a two-layer glow. Atmospheric allows it;
  it is stamped as such at the top of `win-celebration.css`.
- The intro's four step panels are dealt (fanned, lifted) rather than gridded;
  they flatten to a 2×2 on portrait phones by design.
