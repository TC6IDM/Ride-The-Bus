# Design — Ride The Bus

The design system for this app, written by the second Hallmark pass
(2026-09-12; amended since, most recently 2026-10-06). Every later visual
change reads this first. It is a LIVING record, not a locked spec (the owner,
2026-10-05): a better design is proposed against it and, when the owner agrees,
written into it - an audit finding is never dismissed because this file says
otherwise. It is deliberately
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
  opens something.** Turbo amber, autoplay green, sound cream, info blue, the
  recent-rounds panel brass, and MODE's lettering in the live family's own
  colour. These are wayfinding, not decoration
  (`--ctl-*`).
- **Purple is Three of a Kind's**, and the Epic tier's: a dusty amethyst, not
  the saturated screen violet every generated palette reaches for.
- **Every menu wears the colour of the control that opened it** — the
  `--tint` / `--tint-rgb` / `--tint-strong` / `--tint-ink` contract in
  `popup-base.css`. Nothing inside a panel names a colour.
- **The volatility ruler** (`--vol-*`, seven stops) is the one scale both the
  bet display and the mode picker read; the bet and mode panels tint with it.
- **The guess squares are art-directed from the table** ("Felt & brass", the
  owner's pick from a compare sheet, 2026-10-05): Higher a felt green, Lower the
  card crimson, Inside a deep teal, Outside a plum, Equal the brass the chips'
  inlay uses - where they were stock Flat-UI fills. The pairs keep their
  brightness gaps and their arrow and shape cues, so they hold under simulated
  deuteranopia and protanopia. Earlier fills are kept in `tokens.css` as the
  `-soft` and `-original` tokens, one edit away. The chip denominations and the
  card reds and blacks stay data, not art. The LIGHT on the squares is the
  table's - lit top edge, shaded bottom, two-part shadow.
- **A pick is shown by the picked segment alone.** Selecting one never dims the
  others, and the Equal badge stays on the seam at every size (owner's calls,
  2026-10-06).
- **The guesses are a betting layout** (the owner's pick E3, 2026-10-17): the
  four squares are boxes printed in gold ink - edge and seams - on a strip of
  baize edged in brass, their labels in the same gold. The section picked is
  lit and ringed in gold, and the house's plain red chip is set down in it -
  no value on it: it marks the pick, the one bet is the bar's. The chip lies
  inside its section and off its mark, thrown by hand each time (jitter, spin,
  and a side where the mark leaves room either side); on "=" it lies half onto
  the badge along the seam, and the badge grows and keeps its warm-white ring
  (gold on gold does not read). The intro's demo squares sit on the same
  baize, in a brass-edged inlay each.
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
- Body and UI: **Overpass**, variable (one file per subset covers every
  weight), self-hosted in latin, latin-ext, vietnamese and cyrillic, as FILES in
  `static/fonts/` declared in `app.html` - the Stake CDN's
  `font-src 'self' https://fonts.gstatic.com` blocks inlined `data:` fonts. The
  game sets it at 400/700/800/900. It replaced Geist on 2026-10-05, the owner's
  pick from a side-by-side compare: Highway Gothic's descendant, so it sits with
  the bus and the transit-sign wordmark where Geist read as dashboard chrome, and
  it covers the won and the dong Geist lacked. The argument is at the top of
  `components/app.css`.
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
- **The result has four words**: "Full game win" (every guess right), "Won"
  (a Second Chance ride that finished with a miss forgiven), "Kept" (a bust that
  kept a share - the share is NOT printed as a percentage: after the decay and
  the floor it does not add up, and it would be a second unit beside the
  multiplier) and "Busted". A missed card's chip is neutral ink, never win green;
  a bust that kept nothing has no chip; Three of a Kind's live total reads "At
  stake" in neutral ink until it is paid. Win colour means the ROUND came out
  ahead (`isNetWin`).
- **The result is said as well as shown**: one polite status line per settled
  round ("Kept, Card 4: 2 of Clubs, $1.10, 1.1×"), off the same latched readout
  as the bar, so a screen reader hears it when the card has turned and not
  before; the picks report `aria-pressed` and every dealt card is named.
- **Before the first deal, the readout's empty slot says the one thing to do**
  ("Pick all 4 guesses"), in sentence case at body size, laid over the slot so
  nothing moves - and goes the moment the four are picked.
- **The type stops at a floor.** Everything scales with `--ui`, and Popout S is
  Popout L at half size - so at half size the balance was 5.9px. Type now takes
  `max(its own size, --type-floor | --type-floor-figure)`: 6px for a label, 9px
  for money, a win and the one action on screen. The arrangement still halves.
  A portrait PHONE floors at 9 / 11 px - it is the device most players hold and
  has height to spare - and a desktop caption is never under 10px.
- **Prompts name the pointer**: "Click to continue" with a mouse, "Tap to
  continue" on touch (`pointerWords.ts`).
- **Figures are tabular** — Overpass ships `tnum`, so `font-variant-numeric:
  tabular-nums` is live and a figure keeps its width as its digits change.
  `typeFit.labelEms()` is measured against Overpass 800 (every digit 0.62 em);
  its test table is the record. If the face ever changes, that table, the
  `unicode-range` transcription in `displayFace.ts` and the two fitting
  contracts are what must be re-measured — not guessed.

## Cards

A casino deck, printed once and dealt everywhere: `CardFace.svelte` draws every
face the game deals (the board, the takeover's fan). Paper, edge and shadow are
the container's; the face is what is printed on it.

- **Numbers** carry their value in pips on the standard grid; a pip below the
  middle is printed upside down. Pips are a fifth of the card wide. They carry
  the **house print** (2026-10-17): the court frame's two open L-shapes,
  doubled - a line and a hairline - in the card's own ink, and the crown as a
  gold watermark under the pips. Clear of every index and pip.
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
  index - the two marks that survive being small - and no print.

**The running total is a split-flap board** (`SplitFlap.svelte`, 2026-10-17):
each character on its own flap of warm dark stock set into a well, a flap
flipping when its character changes, keyed from the right so the units stay
the units. A flip is half the card's turn, so turbo and a slam shorten it; the
flaps share out their room in a long currency, and the row keeps its height
so the board never moves. The digits take the bar's own state colours.
- The corner index is Big Shoulders 700, top-left and turned bottom-right; in
  Arabic the whole face mirrors and its text is turned back.

## Icons

**Controls are lines, gauges are fills.** A pressable mark is stroked, round
caps and joins, ~2.2 on a 24 grid — `MarkIcon.svelte`'s voice. A mark that is
read (the bolt meter) is filled. The spin button is the stated exception: its
marks are shapes (two cards, a stop square, two chevrons) and it is the hero
control. The table die is the other: it is not a mark but an OBJECT on the
table, drawn as one - the card back's reds, the scene's camera, the room's
light catching the top's far edge and the table's two-part shadow under it.
The turbo bolt is the third, and only at the top of its scale: at Instant
its outline fills in, so the button reads the setting at a glance (the
owner's call, 2026-10-18). Glyphs are drawn only where the font does not own them; card ranks
stay ASCII.

## The primary action

One voice, everywhere: the `.action-button` recipe — a shallow two-stop fill
in the panel's tint, the lit top edge, the table's contact shadow, dark ink on
a light fill, weight 800, sentence case. The mode confirmation, autoplay's
Start, the error dialog's Reload, the replay's Play and the intro's Tap to
continue are all this. The way out (Cancel) is a hairline outline, quiet -
and the error dialog's Close beside Reload, on a failure it cannot name, is
that same hairline.

**The deal button is the stated exception**: the blue disc with its two-card
mark, no caption, its states (Skip amber, Stop red) changing the fill. An armed
gold state and a "Deal" caption were tried on 2026-10-06 and taken out the same
day on the owner's call - "the deal button was fine as is". On the rail it
sits in a brass bezel; the disc itself is unchanged.

## The bar is the table's front rail

(The owner's pick X1, 2026-10-17.) Walnut, a brass inlay along its top edge,
rounded where it meets the room; the money in wells sunk into the wood - the
balance and last win, the bet - and the MODE sign likewise; turbo, sound, info
and autoplay as bare glyphs on the rail, their open state a wash in their
identity colour, never a disc or a ring; the deal disc in its bezel. A layer of
material over the layout: every measured width the bar budgets is unchanged.
On a phone it is two rows that read as groups: the money well with sound and
info set into its start, then a row centred on the deal - bet and autoplay to
one side, turbo and MODE to the other - a grid, so the deal is on the middle
whatever the bet or the sign measure. A phone sets its bet from the chip tray;
it has no +/- pair. Popout S keeps its one row.

## MODE, the destination sign

MODE names the round's FAMILY the way a bus's blind names its route: the
family's name, lettered in its colour (Big Shoulders where the string is Latin,
`titleFaceFor` otherwise, and no capitals in the fallback faces), on a recessed
dark sign in the bar's own material, with the seven volatility bolts under it.
Lettered, not lit: no coloured outline and no bloom. Hover lifts the well's
light, an open picker washes it in the family colour, a press pushes the bezel
in. The width is fixed and the name is fitted into it; a family change rolls
the name.

## Motion

Three curves and one duration token (`--ease-out`, `--ease-in-out`,
`--ease-pop`; `--dur-control`). A panel **arrives** — 220ms from 0.96 scale,
its backdrop 200ms ahead of it — and leaves instantly. A **bump** grows out
of its control instead: 180ms from 0.92 scale and 6px low, from the pointer's
foot (origin-aware), with no dimmer behind it. Hover lifts a control's
light; a press pushes it in. Reduced motion collapses arrivals to 120ms of
opacity and keeps every state change. A focus ring is never transitioned.
**Lit, not haloed:** a coloured bloom around a coloured control is the one
effect this system refuses by name.

**The game loads on a destination blind** (the owner's pick A2, 2026-10-17):
the MODE sign's recipe at hero size over the room and the empty table, its
blind rolling through Red / Black, Higher / Lower, Inside / Outside and the
four suit marks to the game's name, which drops its frame and stands as the
lockup. A stop is a milestone - the art decoded, the game mounted, the floor
passed - never a timer; a route of five stops under it lights from the reading
start, the bus riding along. Reduced motion swaps the stops instead of rolling.

**The intro becomes the board** (the owner's pick C1, as they changed it): on
Continue the intro fades over 240ms while its four squares fly down, one after
another, and land as the board's guess squares - the controls the panels taught
are the ones the player then uses. They fly unpicked, so a demo pick never
lands on a square showing another. Reduced motion and Three of a Kind (no four
squares to land on) get the fade alone.

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
dialog, and never the browser's default. A bump has no header, so its own edge
takes the ring: an inset 2px line in the tint.

## Two kinds of panel: a full panel and a bump

**A menu that holds one control is a bump; a menu people read is a full
panel** (the owner's picks T1 / S1 / B1, 2026-10-17). A bump - turbo's slider,
the two sound levels, the bet chips - opens OVER the control that opened it,
with a pointer at that control, and the board stays in view: the backdrop
behind it is clear and only catches the tap that closes it. It has no header
and no close disc; its name is the dialog's label, and a tap anywhere else or
Escape closes it. The pointer stays on its control even when the bump shifts
to stay on screen (`bumpAnchor.ts`). A bump that can outgrow its room (the chip
tray) scrolls inside, never the slab, because the pointer hangs below it. On a
phone held upright a bump floors its own unit so its smallest label clears the
phone type floor. How to Play, the mode picker, autoplay and recent rounds stay
full panels, because they are read.

## What every panel shares

The material, the ink, the tint contract, the header voice (strong ink, 700, a
rule beneath, the close disc - full panels only), the arrival, the focus device, and the touch
floors — 44px for a control alone or primary, 36px in a dense row, 32px where
the paint must stay small. The header STAYS: a panel that scrolls scrolls
under it, so its title and its way out are never a scroll away.

## What may differ

The tint; the content's shape — a rack of five family cards with no slab
around them, each headed by the MODE sign, the confirmation laid over the foot
of the one chosen, five rows on a phone (mode), a chip tray on felt with a
brass lip (bet), five count keys over a folded limits well and two switches
(autoplay: what a run needs first, first), ticket stubs of dimmed card stock
(recent rounds), prose with section links that stay under the title and the
game's own cards drawn beside what they illustrate (How to Play); and the
width, where prose needs the measure.

## Known deviations, recorded

- Big Shoulders is Latin only, so a Cyrillic, Vietnamese or Turkish family
  name on the MODE sign and a translated win title set in Overpass instead; the
  longest single words (Finnish "mahdollisuus", Portuguese "Oportunidade") fit
  the sign at about 4.3px on Popout S and 6.4px on a 320px phone - fitted, never
  clipped. Russian's Classic is "Классика" so it fits at all.
- Arabic, Hindi, Japanese, Korean and Chinese fall back to the OS sans-serif
  wholesale; neither face has a cut for those scripts and the inlined bundle
  will not take one.
- The win takeover glows nowhere. Its title is LETTERED - a hard block shadow
  in the tier's deep colour, cast down and left - and its cards carry a thin
  tier-coloured rim, not a bloom. The two-layer glow atmospheric once allowed
  here was the stock slot "BIG WIN" look, and went in the third audit.
- The takeover's hand is the board's own cards: dealt out of their slots when
  it opens, flown back into them on Continue (2026-10-18). It stands clear of
  the words, and the count always climbs from Big.
- The takeover's tier is the loader's destination blind, the game's one sign
  seen a third time (loader, MODE, takeover): it rolls a stop per tier, the
  route under it rides the bus to the stop reached, and Max is the end of the
  line in crimson. The amount under it is the running total's split-flap board
  at hero size, so the figure the player watched climb is the figure handed
  over. The table's own chips stream out from behind the hand, thicker each
  tier, and the hand breathes - the takeover's only loops, the owner's call.
- The intro's four step panels are dealt (fanned, lifted) rather than gridded;
  they flatten to a 2×2 on portrait phones by design.
