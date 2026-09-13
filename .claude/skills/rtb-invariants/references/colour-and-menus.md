# Colour, menus and the chip palettes

The tint contract every panel wears, the bet menu's chips, the choice-icon
keylines, and the rule that colour lives in tokens.css.

Moved verbatim out of CLAUDE.md so it is loaded on demand
rather than on every turn. Nothing here is reworded.

---

- **Every menu wears the colour of the control that opened it.** Turbo's panel
  is amber, autoplay's green, Advanced's purple, How to Play's the accent blue
  its icon lights, and the bet and mode panels take the volatility colour their
  two controls burn. One contract — `--tint` / `--tint-rgb` / `--tint-strong` /
  `--tint-ink`, defaulted to accent blue on `.popup` in `popup-base.css` and
  overridden per panel in `popups.css`; nothing inside a panel names a colour.
  This is the same wayfinding argument as `--ctl-*` below: a menu that
  highlights in blue whichever button you pressed to reach it throws away the
  one thing the bar spends five hues saying. `--tint-ink` is **dark**
  (`--on-vol-ink`) on every panel but the blue ones — white on the amber
  measures 1.8:1.
  - Each `--ctl-*` colour and its `-rgb` triplet **must be the same colour**.
    `--ctl-turbo-rgb` was a different amber from `--ctl-turbo` and went unseen
    while the triplet only ever painted a blur; it is derived from the triplet
    now.
- **The bet menu is CHIPS, and the chip palettes are tokens.** The felt is laid
  with five sampled denominations and the bet picker used to be a 4-across grid
  of grey rectangles sharing one rule with the autoplay picker
  (`.bet-grid, .spin-grid` — the stylesheet said out loud that the two menus
  were one artefact). The values moved from `table.css` to `tokens.css` because
  they are used twice now; `table.css` keeps the sampling notes, which are a
  measurement record about that scene.
  - **A wrapping row, never a grid.** `betLevels()` is whatever the RGS sent.
    A real one is not the tidy ten of the dev fallback: NOK ships ~40 levels
    labelled `NOK 12,500.00`, and an earlier build's fixed four columns pushed
    the fourth off the panel behind a horizontal scrollbar — so the highest
    bets were unreachable, failing both "the main frame must not be scrollable"
    and "min and max levels must be selectable". Verified at 40 levels on
    Desktop, Mobile M and Popout S: no horizontal scroll, no text overflow,
    every chip inside the panel. At 40 levels the row is ten deep and the
    **panel** scrolls internally on Desktop, Popout L and Popout S — the main
    frame never does, and the highest chip is reachable — so "min and max
    selectable" holds by scrolling the panel, not by everything being in view
    at once. That is height, which the original check did not measure.
  - **A symbol rides with the figure; a code takes its own line.** `$1,000` is
    what a chip in that currency says, so `splitChipLabel` keeps a
    single-character symbol inline. `NOK 12,500.00` is thirteen characters and
    has no legible size on a disc, so a multi-character CODE goes above the
    number instead. Either way an all-zero fraction is dropped, and the disc is
    what grows to fit — a chip you cannot read the value on is not a chip.
    Nothing is hidden: the bet display, the entry field and each chip's
    `aria-label` all keep the full formatted amount.
  - **Telling a decimal separator from a grouping one is the hard part**, and
    getting it wrong is not cosmetic: reading the comma in yen's `¥1,000` as a
    decimal point saw three zeros and rendered a thousand-yen chip as **`1`**.
    A trailing run of exactly three digits is a thousand, not a fraction.
    `betChips.test.ts` pins every currency shape.
  - **Colour by rank, not by amount** — sort, spread over the five chips.
    A fixed $1-white table would be wrong the moment the currency changes.
  - **The figure is fitted to the disc, not set at a constant.** The old flat
    `0.87 × --ui-bar` claimed in its own comment to be "sized for the longest
    level" and was not: measured in the running game it printed at **9.6 px on
    desktop and 3.4 px at Popout S** — smaller, at every one of the seven target
    sizes, than the "Quick Bets" caption above it — while leaving the longest
    label at 67% of the face and the shortest at 24%. `labelEms()` publishes
    each label's own width as `--ems` and the CSS solves the size from it, so
    desktop now runs 13.3–21 px. **Weighted, not a character count**: Poppins
    ships no `tnum`, so `font-variant-numeric: tabular-nums` is a no-op here and
    the figures are proportional — `1` measures 0.387 em against `0` at 0.657 —
    and counting characters would size `$1,111` and `$4,444` alike and overflow
    one. The constants are the measured widths rounded **up**, so the estimate
    runs 5–9% heavy and errs toward a smaller figure rather than one that spills
    into the spot ring. The per-chip variation is the idiom, not a compromise: a
    real chip sets its denomination to fill its printed centre.
  - `--fit` is a fraction of the **disc**, and 0.74 is too big however natural it
    looks — the face is inset 13% so it spans 0.74 of the disc, and the spot
    ring's mask opens at 0.72 of the radius. A fit of 0.74 therefore runs the
    figure exactly to the face edge and into the spots. 0.68, and 0.60 when a
    currency code takes the upper line.
- **The choice icons carry a keyline, and the fills do not move.** Two failed
  WCAG 1.4.11 badly (Higher 2.10:1, Inside 2.30:1) and the pair that must read
  as *opposites* was legible at wildly different levels. The repaint was tried
  and rejected on the look — `tokens.css` records that as the owner's call — so
  the fix is the one that note already named: a hard dark
  `--choice-icon-keyline` under every icon, four zero-blur `drop-shadow`s in
  `ChoiceIcon.svelte`. Four shadows rather than a stroke because half these
  icons are stroked paths and half are filled shapes; zero blur because a soft
  halo cannot be measured. All four now pass at 8.97 / 8.21 / 4.63 / 3.47.
  - **Not on the equals badge** (`svg:not(.eq-icon)`). That glyph is two short
    bars totalling 0.585 `--ui`, so a keyline sized for the arrows was a large
    fraction of the gap between them — it closed up and the pair read as one
    thick line. It never needed one: it sits on its own gold badge rather than
    directly on a choice fill, so it has none of the contrast problem.
- **The bet button deals, it does not reload.** Two circular arrows is the
  universal refresh mark and it was the resting glyph on the primary action of
  a game where nothing spins. Its other two states were already right — a
  fast-forward for skip, a square for stop — so the icon family was three
  metaphors deep. Two cards, the front one tilted off the deck.
- **Colour lives in `styles/tokens.css`.** Any colour used in more than one
  place is named there and referenced by name; 193 literals across 357
  occurrences is what the absence of that rule produced (four unrelated felt
  greens, three card reds, three golds, two blues). Two deliberate exemptions:
  `table.css`, whose colours are sampled measurements with the sampling recorded
  beside them, and closed one-screen palettes (the win-celebration tiers' cool
  falloffs; their hot colours are `--vol-*` by reference).
  - **The replay-info badges left that exemption**, and they are the argument
    for keeping it narrow. Eleven hand-picked darks — `#1a5c1a` for Higher
    against the board's `#2ecc71`, a brown for Outside against its magenta, an
    olive for Equal against its gold — meant the one screen whose whole job is to
    restate the bet restated it in colours the player had never seen. They are
    `--choice-*` now, with `--on-choice-ink` for the three light fills. A palette
    may be closed only when it is genuinely local; these were a second spelling
    of the game's own data.
  - The exemption covers the palette, **not the derivation**. `--wc-ray` was a
    hand-copied `rgba()` of `--wc-hot` four lines below it — the same drift that
    made `--ctl-turbo-rgb` a different amber from `--ctl-turbo`. Each tier is a
    triplet now with both the fill and the wash derived from it. Colours that are
    *not* tier colours have left the file: the amount's warm white and the
    prompt's warm dim are `--ink-cream` and `--ink-warm-dim`, and the running-win
    readout's three literals are `--ink-felt`, `--ink-spent` and `--loss-soft`
    (`cards.css` was never one of the two exempt files).
  - Colours that need an alpha are declared as **rgb triplets** with the hex
    derived from them (`--gold`, `--vol-*`, `--ctl-turbo`), so a wash and a fill
    cannot drift apart. `volatilityColorRgbVar` is the sibling of `volatilityColorVar` and a
    test pins the two to the same family name.
- **The accent rule is narrower than "one accent".** One accent (`--accent`,
  blue) for anything **chosen** — a bet, a mode, a tab. A fixed identity colour
  per control that **opens** something (`--ctl-turbo` amber, `--ctl-autospin`
  green, `--ctl-advanced` purple) — and its menu wears that colour too. The live
  difficulty for the bet group. The MODE button is the exception that proves the
  rule: it was a fifth identity colour (gold), and it now carries the selected
  family's **state** instead, with its pill **shape** carrying the identity no
  other control in the bar has. These
  are **wayfinding, not drift**: a pass collapsed all five into one gold accent
  on general colour-theory grounds and it was rejected — five near-identical
  round icons in a 40 px strip are found by colour, not by re-reading glyphs.
  Do not collapse them again.
- **One ink ramp, warm — the second Hallmark pass's headline.** The first pass
  re-hued every panel to the table and left the *ink* where it was: a cool
  blue-grey ramp (`#dfe8f2` / `#cfe0f0` / `#93a4b5`) printing on graphite panels
  that had been warmed precisely so they would stop reading as web chrome. The
  intro drew the identical material with a warm ramp, so the two screens a
  player moves between in one tap were one panel with two inks — visible as
  icy "Second Chance" and How to Play copy in the 2026-09-10 shots. `readout.css`
  had made the argument for one caption and stopped. The ramp was re-pointed
  **at parity of contrast** against the three panel grounds (the table is in
  `tokens.css` beside the values; dim comes out at 6.92 / 5.80 / 7.38 against
  6.84 / 5.73 / 7.31) and the intro's three names became aliases of the same
  three values. Nothing moved in the hierarchy; only the temperature.
- **One panel material, as three tokens.** `popup-base.css` had built the lit
  face, the two-part shadow and the inset edge pair — and argued each — and the
  argument stayed in that one sheet. The bar's pills and discs, the RG plate and
  the error dialog each carried the single blurred blob `table.css` calls "a
  sticker, not an object", and the error dialog swapped the edge for a red
  hairline all round; the replay panel was a flat green box on black with no
  edge at all. `--panel-face` / `--panel-elevation` / `--panel-elevation-low`
  are what every panel reads now. The **low** variant exists because a pill an
  inch off the felt does not cast a popup's shadow — same shape, scaled.
- **Lit, not haloed, everywhere.** `control-bar.css` removed fourteen coloured
  blooms and then shipped two more on the MODE button, one on the stop square
  and one on the cooldown ring; `popup-autospin.css` and `popup-bet.css` put a
  bloom on focus and hover in the sheets that refuse it by name. All gone. The
  bolt meter's 3px separation bloom on a 12px glyph stays — it is argued and
  measured to do a job the hue alone did not.
- **The replay details panel is a panel.** It rendered its own opaque
  `.ss-overlay` on top of the shell's — the one `StartScreen.svelte` mounts a
  `TableScene` into "so the first thing a player sees is the place" — so the
  table was dead paint on every replay and the screen Stake's Fairness view
  opens on was a green box on pure black, with "Guesses" running into its
  badges. The wrapper is gone, the panel wears the material and the tint
  contract (gold), the header speaks the popup-head voice, and the row has a
  gap. **The lockup behind it stays dimmed on purpose.**
- **Controls are lines, gauges are fills.** Three Material glyphs — the turbo
  bolt, the autoplay sync, the advanced "tune" — sat beside an info mark,
  steppers and a lemniscate drawn by hand: three icon sets on a 40px strip.
  Worse, the turbo bolt was the *same fill* as the volatility meter's, so one
  glyph meant speed at one end of the bar and risk under the bet amount. The
  three are stroked now, in `MarkIcon`'s voice (round caps, ~2.2 on a 24 grid);
  the meter keeps the fill. One silhouette keeps the two bolts kin; the
  treatment tells them apart. The spin button's marks are shapes, and it is
  the hero — the stated exception.
- **The slider is the game's.** `<input type="range">` with `accent-color`
  hands the whole control to the browser — three different sliders across
  Chrome, Firefox and Safari inside a hand-built panel, the last UA-chrome
  widgets in the game. `components/popups/RangeSlider.svelte` keeps the real
  input (keyboard, name, `disabled`) and paints the track and thumb itself,
  taking `--tint` from whichever panel it is in. One child component rather
  than two copied rule sets, for `readout.css`'s reason.
- **Panels arrive.** Every panel was mounted by an `{#if}` with no animation
  in a game whose takeover has a tuned arrival. 220ms from 0.96 scale, the
  backdrop 200ms ahead, reduced motion 120ms of opacity. **No exit,
  deliberately** — it would need an `out:` directive in seven components plus
  a reduced-motion-aware JS transition, for a menu every OS closes instantly.
- **A panel's own focus ring.** `Game.svelte` focuses `.popup` on open and no
  rule said what that looks like, so a keyboard-opened panel wore Chrome's
  default double ring around the whole dialog — measured off a screenshot as
  2px of `#fff` over 4px of `#101010`, the one focus indicator in the game
  that was not `--focus-ring`. The device is `win-celebration.css`'s: the ring
  goes on the part that names the panel — the header's rule thickens to 2px in
  `--tint`. The error dialog, which has no header rule, takes the standard
  ring. The sound panel had **no** focus indicator on any of its four controls;
  the shots probe found it by tabbing.
- **The primary action has one voice.** `.action-button` — the tint's two-stop
  fill, the lit top edge, the contact shadow, dark ink, 800, sentence case —
  was every popup's; the intro's continue was an outline in tracked uppercase
  and the replay's Play a flat slab. Both take the recipe now (copied per
  sheet, for the scoping reason every panel copies it).
- **Figures hold still through `Figure.svelte`, not through the face.** Neither
  self-hosted face ships `tnum` (fontTools: the Poppins subset has no GSUB
  features at all; digits run 0.387–0.691em at 800). Every `tabular-nums` in
  the app is inert and two comments claimed otherwise. The takeover count-up
  wobbled under a centred headline and the session clock breathed its plate
  every second; both render through `Figure`, which boxes each digit one "0"
  wide, and the takeover sizes its type from `evenDigitEms()` so the boxed
  string is the one the font is fitted to. A test pins the two widths together.
  Everything else is width-reserved and changes per round. The body face
  itself — a Hallmark banned default — was kept deliberately; a swap is a
  candidate follow-up pass, recorded in `design.md`.
