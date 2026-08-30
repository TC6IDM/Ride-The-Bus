# Ride The Bus — Stake Engine game

A four-guess card game built for Stake Engine: a Python math package that
generates the published books, and a Svelte 5 client that replays them.

---

## Standing rules

These override default behaviour. Follow them every time.

1. **Never commit or push without asking first, every single time.** Approval
   for one batch never carries to the next.
2. **Never run math builds or web/production builds.** They take 40+ minutes and
   10+ minutes respectively. If one is needed, stop and ask — the user runs it
   and pastes the output back.
3. **Cheap verification, run freely**, from `web-sdk/apps/Ride-The-Bus/`:
   ```
   npm run test          # node --test
   npm run check         # tsc; ignore the ~258 vendored-SDK errors
   npm run check:svelte  # must be 0 errors AND 0 CSS warnings
   ```
   ```
   npm run lint          # now a gate; must be clean
   ```
   `npm run lint` used to be dead — ESLint 9 reads `eslint.config.js` and every
   app in the vendored SDK still ships only `.eslintrc.cjs`. This app now has a
   flat config, so lint runs and must pass. The dead `.eslintrc.cjs` beside it
   is ignored by ESLint 9 and kept only so the app still matches its siblings.

---

## Where things are

Work **only** in `Ride-The-Bus-monorepo`. There is a stale
`Desktop/Ride The Bus` directory — never read from or copy out of it.

Two halves that **must mirror each other**:

| Half | Path |
|---|---|
| Math (Python) — generates the published books | `math-sdk/games/ride_the_bus/` |
| Client (Svelte 5 + runes) | `web-sdk/apps/Ride-The-Bus/src/` |

If the client's arithmetic drifts from the Python, the game shows a player one
number while the RGS credits another. That is the worst bug this project can
have, and `payout.test.ts` guards it by replaying every published book.

Everything below is on **`main`** as of the `ui-art-pass` merge — the three
bet families, the 192-mode math build and the UI pass all landed together.
Note that local `main` tracks `origin/monorepo-restructure`, not `origin/main`,
so a bare `git push` from it goes somewhere unexpected; push `main:main`
explicitly or re-point the upstream.

---

## The game

Guess four cards: **colour → higher/lower/equal → inside/outside/equal → suit**.

All four guesses are picked *before* the round, so **each guess combination is
its own RGS bet mode**.

**192 published modes = 3 families × 64 playable combinations.**
(`equal` then `inside` is impossible — nothing falls strictly between two cards
of the same rank — so 64, not the 72 the four lists multiply out to. A mode that
loses 100% of the time also has zero variance, which the RGS rejects outright.)

| Family | Prefix | Retention on a miss | Max win | Forgiveness |
|---|---|---|---|---|
| Classic | *(none)* | card 1 nothing, then 30% | 1354.2× | none |
| Second Chance | `sc_` | card 1 nothing, then 30% | 585.2× | first miss from card 2 keeps 50%, play continues |
| High Stakes | `hs_` | card 1 nothing, then 20% | 1910.2× | none |

**All three cost 1.0×.** That is forced, not chosen: `etl40b` is an absolute sum
against a fixed 0.9 limit and is *not* divided by cost, so a 2× mode's figure
doubles for the same shape. Even Classic's shape fails at 2×.

---

## How the maths works

Every stage's win multiplier is solved from

```
p·m + (1−p)·retention = decay     →     m = (decay − (1−p)·retention) / p
```

so the expected multiplicative change is a constant regardless of how likely the
guess was. That martingale property pulls every mode's raw RTP toward
`decay⁴ = target_rtp` (0.99). `reweight_luts.py` then pins each mode's *recorded*
RTP to exactly 0.96 by adjusting only the loss weight.

A bust keeps `retention × decay^(3−stage)` — the decay term stands in for the
stages never played, so busting at stage *i* is worth the same in expectation as
playing on would have been.

Final payout **floors** to 0.1× and never rounds: a fair 50/50 is 1.96×, and
rounding it to 2.0× would wipe out the house edge.

---

## Invariants that must not drift

- `math game_calculations.py:MODE_FAMILIES` ↔ `web game/modes.ts:FAMILY_RULES`
- `FAMILY_RULES[f].maxWin` is **data**, pinned by `payout.test.ts` to what the
  payout maths actually reaches.
- Win-tier ladders are **per family** (`winTiers.ts:winTiersFor(family)`) — every
  band, not just Max. Each is solved to hit Classic's rarities
  (~1 in 70 / 305 / 3,093 / 15,561) with Max = that family's own ceiling.
- **The Max band is matched on equality; every band below it on `>=`.** "Max Win"
  is a claim about hitting a single reachable figure (1354.2 / 585.2 / 1910.2),
  not about clearing the bottom of an open range — so a payout *above* a family's
  ceiling falls to Epic rather than claiming the rarest screen in the game. The
  published `max_win` bound is 1400 against a true Classic ceiling of 1354.2, so
  the two are not the same number and the ladder must not treat them as one.
  Understating is the safe direction; `winTiers.test.ts` pins both directions.
- **The win takeover is made of the round, not of gradients.** Its centrepiece
  is the four cards the player just played, fanned — the same warm paper,
  crimson crosshatch and chrome edge as every other card in the game, drawn from
  the shared tokens rather than by importing `cards.css` (a stylesheet imported
  into a second component gets a second scope class). `revealedCards` is
  **snapshotted** into `celebration` at `showWinCelebration`, not referenced: the
  round-start resets would empty the fan under a still-open overlay during an
  auto run. All four slots come out as faces in practice — the reveal loop deals
  every card whether the round busted or not — so the face-down branch is a
  fallback for a null slot, **not a behaviour to promise in copy or tests**.
  What this replaced was a scrim gradient, a conic gradient, a radial gradient
  and a text stack, which is item for item the list Stake's rating notes give
  for a 1-star release. Gradients may light a celebration; they cannot be what
  it is made of.
  - **The fan marks what actually happened**, using the board's own two marks
    rather than new ones — a red `--loss` cross on the card that ended the round,
    an amber `--forgiven` return arrow on the one a Second Chance let off.
    `cards.css` is careful that those differ ("a red cross says the round ended
    here, and this one carried on") and the celebration must not undo it. The
    busted card is desaturated and dimmed; **the forgiven card is not**, because
    dimming it would read as a second bust. Showing only the winning cards was
    the alternative and loses the round: which guess failed, and on what card.
  - **Exactly three shapes reach the takeover**, at most one mark each: a clean
    sweep (no marks), a bust (one cross — Classic and High Stakes only, since a
    card-1 miss keeps nothing and pays zero), and a forgiven-then-finished Second
    Chance round (one arrow). A fourth exists in the books and **cannot get
    here**: forgiven *and then* busted takes both haircuts on one round — half
    the multiplier, then 30% of the remainder — and never clears the entry tier.
    Measured across every drawable round of `sc_red_equal_equal_heart`, the
    family's highest-ceiling mode: 382,729 of them, best payout **2.6×** against
    an 11× floor. The `{:else if}` is therefore defensive, not load-bearing.
    A Max Win is always a clean sweep for the same arithmetic.
- **One veil for the whole ladder.** `--wc-veil` is set on `.wc-overlay`, not
  per tier. It used to climb 0.46 → 0.70, so the room got darker on every
  promotion — the rarest screen was the murkiest, and the scene visibly
  re-dimmed four times inside a single count-up. The takeover establishes a
  place once and stays in it; what escalates is the light, the colour, the hand
  and the burst.
- **Every win tier draws the whole celebration. Escalation is intensity, never
  presence.** All five tiers are full-bleed and draw every layer — veil, beam,
  fan and suit burst; the `.tier-*` rules only turn them up (`--wc-beam-op`,
  `--wc-fan-spread`, `--wc-throw`) and `winCelebration.test.ts`
  fails if one of them sets anything that is not a custom property. Max alone
  adds a layer: the deck's own crosshatch, sweeping once. **A tier that
  withholds a layer was tried and rejected** — Big/Huge got a bounded "plate" and
  rendered as a grey rectangle while the higher tiers looked untouched, so the
  ladder read as two unfinished screens. If a tier should feel smaller, turn it
  down; do not take the scene away.
  - **`--wc-fan-spread` is the rung, because it is the only one anyone could
    see.** The ladder used to move sheen opacity and bloom diameter by 30–60% on
    layers already sitting at 34–72% behind a blur — under the just-noticeable
    threshold, so the only real difference between Big and Epic was the word and
    the hue. The hand opening wider reads at a glance and is still intensity: a
    test pins it monotonic across the five.
- **The burst is suit marks, not sparks, and it is a moment rather than a
  loop.** Hearts, diamonds, clubs and spades through `SuitIcon`, thrown once per
  promotion — `WinCelebration` keys the container on `activeTier.id` to re-fire
  it. Sixteen marks on *independent infinite* loops with delays to 2.1s never
  shared a `t=0`, so at any frame they sat at sixteen unrelated radii and read as
  dust on the lens; several also ended up in the frame corners and over the
  control bar. Ten larger marks, one origin, one instant, thrown off the fan
  rather than the viewport centre, fading before they reach an edge. **Keying is
  right here and wrong for `.wc-title`** — that is the bug `promoteTitle` exists
  to replace, and both are now pinned by tests.
- **The light is one beam, not a spinning cone**, aimed from the upper right
  because that is where `table.css` puts the light for the whole game. Two
  counter-rotating conic sweeps plus a radial bloom plus an elliptical vignette
  under the text all centred on one point, and on screen they composed into a
  soft-edged grey-brown disc that read as a smudge or a half-loaded asset.
  **Three ambient circles on one centre is not depth.** The text's ground is an
  **edge-to-edge shadow band** now — full viewport width, so it has no side edge
  to read as the rejected "plate", and it reaches up over the bottom of the fan
  so the title is never cream type on white card faces.
- **The board's numeric readouts are hidden while the takeover counts.**
  `.running-win`, the four `.card-mult` chips and `.cb-lastwin` all print the
  *settled* figure, and the overlay is semi-transparent: the segmented count-up
  ran from $0.00 with "Full Game Win! $1,354.20" legible behind it for the whole
  climb. `Game.svelte` sets `takeover-open` on `.game-layout`; `cards.css`
  consumes it. The **card row goes entirely** — the fan is those same four cards
  brought forward, and dimming it to 0.16 was tried first and left a ghost row
  reading through the veil, which is worse than either showing it or not. One
  hand on screen at a time. The choice row only dims: nothing in the overlay
  duplicates it, but the squares encode the bet and are the loudest thing in the
  game. The table, rail, chips and cups stay lit: the scene stays, the interface
  recedes. A fourth readout added later must join that list —
  `winCelebration.test.ts` names all three individually for that reason.
- **The win ramp IS the volatility ramp.** Big is `--vol-sc` green, Huge
  `--vol-base` yellow, Mega `--vol-hs` red, Epic `--vol-overflow` purple — the
  four stops the bolt meter already spends on the control bar, referenced from
  the same triplets so the two ladders cannot drift. Max alone stays off the
  scale and keeps its *inversion*: a cream core on brand crimson, the only tier
  lighter in the middle than at the edge.
  - This replaced a bespoke gold→amber→orange→ember heat climb, and it
    deliberately reverses the old "no purple here" rule. That rule existed
    because `--vol-overflow` already means *this bet passed its family's
    volatility ceiling*; the call now is that both readings are the same idea —
    near the top of a scale — rather than two meanings competing for one hue,
    and that a player who has already learned green→yellow→red→purple on the bet
    display should not be made to learn a second ramp for wins.
  - **The cards carry it too**: a tier-coloured rim and bloom on every card in
    the fan, plus a specular glint at the beam's own 118°, so the escalation
    reaches the thing the eye is already on rather than only the word above it.
  - **The hand hops on every promotion** (`hopFan`), driven through
    `element.animate()` with `composite: 'add'`. Both halves of that matter: a
    CSS class would replace the `wc-fan-deal` fill and drop each card back to its
    undealt transform, and without `add` the keyframes would overwrite
    `transform` outright and snap every card to the centre of the fan, because
    the tilt and offset live in that same property.
- **Which wins open the takeover**: `winTierFor`'s `fullGameWin` floor puts a
  **clean sweep** on the ladder at the entry tier however little it pays, so a
  6.6× opens it. Gating those to a board-level beat instead was tried and
  reverted — the progression is the one players already learned. The cost is a
  known cosmetic wart: a sub-10× full win is titled "Big Win" below the Big Win
  floor. Fixing that needs its own label, which is a 17-locale change.
  - **A clean sweep is `isCleanSweep(bustedIndex, forgivenIndex)`** — four right,
    nothing forgiven — not "did not bust". That distinction exists only because
    Second Chance survives a wrong guess, and it replaces a per-family
    `celebrateEveryFullWin: false` on `sc` that was too blunt. The old flag was
    half right: forgiveness makes "reached card 4" the ordinary case, and
    flooring those fired the takeover on most rounds. But suppressing the whole
    family also swallowed the case the floor exists for — a genuine 4/4 in Second
    Chance, the same 1-in-70 event that takes the screen over in Classic, which
    paid in silence below 11×. Classic and High Stakes have no forgiveness, so
    `forgivenIndex` is structurally always null there and they are untouched.
- **`FAMILY_RULES[f].maxWin` and `MODE_CEILINGS[mode]` are different numbers
  and both are needed.** The family figure is the most that FAMILY can reach and
  is the right headline for a mode a player is choosing between — some
  combination in it really does pay that. But every four-guess combination is
  its own published bet mode, and only **8 of each family's 64** reach the family
  figure: Classic runs 68.2× to 1354.2× with a median of 268.8×, so the headline
  alone overstated the typical bet about fivefold. Stake asks for the maximum win
  to be stated per bet mode and to be realistically obtainable, so How to Play
  and the mode-switch confirmation state both, the second suppressed when the two
  are equal.
  - **The ceilings come from the build, never from enumeration.** The
    theoretical maximum of a combination IS derivable from `payout.ts`, and it is
    the wrong number: the RGS can only pay what its lookup table holds, and the
    published tables are *sampled*. That is measurable rather than assumed —
    heart and diamond are both red, so for a fixed colour + higher/lower +
    inside/outside they must share a theoretical ceiling, and **24 of the 48
    groups disagree** (`base/red/higher/inside` is
    `{heart: 290.9, diamond: 268.8, club: 268.8, spade: 268.8}`). An enumeration
    would therefore print a figure ABOVE what the mode can pay on about half of
    them, which is the exact overstatement being fixed.
  - `scripts/mode-ceilings.js` writes `game/modeCeilings.ts` from
    `stats_summary.json`; `run.py` calls it beside `replay-events.js` at the end
    of every build. The generated `.ts` is **committed**, because the library is
    not. `modeCeilings.test.ts` pins it against the build when one is present.
  - **The win-tier ladder is deliberately NOT wired to it.** Max Win stays pinned
    to `FAMILY_RULES[f].maxWin`, so it fires only on a round that reaches the
    family's stated figure. A mode reaching its own lower ceiling is not a max
    win — the claim is about one reachable number per family, and softening it
    would make the rarest screen in the game routine.
- **A `?lang=` value is resolved against the shipped locales BEFORE it is
  activated.** An unknown-but-well-formed tag is harmless — `t()` falls back to
  English and then to the key, which IS the English text. A **malformed** one is
  not: `LoadI18n` activates whatever it is handed, Lingui passes that to
  `Intl.NumberFormat` on every `i18n.number()`, and Intl throws a RangeError
  rather than degrading. `numberToCurrencyString` draws the balance, the last
  win, the bet display, the running win, the takeover amount and every bet chip,
  so `?lang=en_US` emptied the whole board. `?lang=xx` is fine; `?lang=en_US`,
  `?lang=zz!!` and `?lang=en;a` all throw. Stake's PreChecks name it directly.
  - `utils-shared/language.ts` holds the resolver, beside `currency.ts` and for
    the same reason: a node test can reach it without dragging state-shared and
    SvelteKit's `$app/*` virtuals in behind it. `stateUrl.svelte.ts` imports it
    by **relative path**, because utils-shared already depends on state-shared
    and importing back by package name would put a cycle in the manifests.
  - It also aliases **`po` → `pl`**. `po` is Stake's own code for Polish in its
    supported-languages list; every catalogue in this repo is named `pl`, so
    without the alias a Polish session silently got English number formatting.
  - `numberToCurrencyString` keeps a `try`/`catch` around the format call
    regardless. A formatter that throws must never be able to empty the board.
- **Anything restoring a mode from a slug must apply `parsed.family`, not just
  the four guesses.** `parseModeName` returns five fields; the replay and resume
  effects in `Game.svelte` consumed four and dropped the family, which left a
  High Stakes round on Classic's ladder — measuring a 1400× win against
  Classic's 1354.2 ceiling and announcing MAX WIN over a round nowhere near High
  Stakes' real 1910.2 max. The family also drives the MODE button, the bolts,
  the rules popup and the printed retention rule. `modes.test.ts` greps both
  call sites, because the failure is silent and has now happened twice.
- The volatility rating (`game/volatility.ts`) is a **ranking of published
  figures, not a marketing claim**. `volatility.test.ts` re-derives it from
  `math-sdk/.../library/stats_summary.json` and fails if the bolts disagree.
  Both rules it encodes hold in their *strict* form, not on average:
  - `sc < base < hs` for every one of the 64 guess combinations individually.
  - Grouping a family's 64 modes by Equal-pick count gives three bands with
    **no overlap at all** — the calmest 1-Equal mode is wilder than the wildest
    0-Equal mode, in every family. That is what licenses "one bolt per Equal".
- **One ruler.** Every meter draws `VOLATILITY_BOLTS` (7) stops. The mode picker
  lights the family's own rating (1/3/5); the bet display adds one per Equal
  pick. A second meter counting to a different maximum would be bug class 1.
- **The bar is coloured by the rating, not by the accent** — and by *two*
  ratings, which are different numbers and must not be collapsed:
  - `--mode-ink` / `--mode-rgb` — the **live** rating (family + one stop per
    Equal pick), worn by the mode name, the `+/−` steppers and the bet button:
    green / yellow / red, and `--vol-overflow-ink` purple once the guesses pass
    `FAMILY_BOLT_CEILING`. In practice that is **High Stakes with one or two
    Equals and nothing else**, because the families sit at 1/3/5 against a
    ceiling of 5; `volatility.test.ts` asserts `hs` is the only family any guess
    combination can push over.
  - `--vol-color` / `--vol-rgb` — the **family's own** rating, worn by the MODE
    button and the mode picker. Never purple: the Equal picks that overflow a
    ceiling are a property of the bet, not of the mode being chosen.

  All four are published on the `<footer class="control-bar">`, not on a panel
  inside it. They have to reach three groups sitting in different panels — the
  bet display, its sibling steppers, and the MODE button over in the light pill
  — so the bar is the nearest element that can carry them.
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
- **Money is fitted to its box, everywhere.** Three surfaces size type from the
  string rather than from a constant, because no constant is right for both
  `$1.00` and `NGN 11,461,200,000.00`: the bet chips and the win takeover's
  amount solve a font-size from `labelEms()` (`game/typeFit.ts`), and the
  control bar's three readouts use `use:fitValue`, which measures the real box.
  - **Estimate vs. measure is a deliberate split.** A chip or the takeover
    amount holds one run of text, so an em estimate is exact enough and needs no
    reflow. A control-bar readout can hold a value AND an inline multiplier chip
    at a different size; summing two estimates at two scales is a ratio nobody
    would maintain, so that one measures `scrollWidth` against `clientWidth`.
  - **The reservations became ceilings.** `.cb-balance` and `.cb-lastwin` had
    `min-width` measured from *dollar* strings (`$99,999,999.00`,
    `$5,000,000.00`). They now carry `max-width` at the same figure, and that
    half is load-bearing: without it a flex child simply widens, there is no
    overflow for the fit to detect, and the bar wraps exactly as before.
  - **`.cb-val` must be `white-space: nowrap`** for the same reason - a wrapped
    line has no horizontal overflow to measure, so the fit sees nothing to do
    while the readout silently doubles in height.
  - **All THREE readouts need the cap, and `.cb-bet-display` was the one
    missed.** With the balance and last win capped but the bet display still
    free to widen, a weak-unit currency pushed the bar 2-14px over its row
    budget and broke the Advanced button onto a second line at *every* landscape
    width from 660 to 1100. Invisible in dollars, because the reservation was
    measured in them. `currencies.test.ts` names all three.
  - **`.cb-val` needs `max-width: 100%`, and that line is load-bearing.**
    `.cb-lastwin` is a flex column with `align-items: flex-end`, and a flex
    child under anything but `stretch` sizes to its own CONTENT - so the value
    box grew straight past the readout's `max-width`. Two things then failed
    silently at once: `overflow: hidden` clipped nothing, because the box was
    never smaller than the text; and `fitToBox` saw `scrollWidth ===
    clientWidth` and concluded there was nothing to shrink. The last-win figure
    therefore never fitted and never clipped - it painted across the balance
    beside it, 17-42px of overlap at every size. `.cb-balance` was fine
    throughout, because it uses the default `stretch`: one readout worked and
    its neighbour did not, for a reason nothing in either rule mentioned.
  - **Re-fit on a MutationObserver, not on the framework calling back.** The
    action's own `update` was the only trigger at first and the fit simply never
    re-ran: the readout kept its mount-time size, and a settled figure long
    enough to overflow painted leftward (it is `text-align: right`) straight
    across the MODE and info buttons. Watch `characterData` + `childList` -
    never `attributes`, or the `style.fontSize` the fit writes re-triggers it.
    `.cb-val` also carries `overflow: hidden` as a hard guard: if the floor is
    ever hit, clipping inside its own readout beats painting over a control.
  - **On a phone the light pill is ONE line**: sound, info, MODE, Balance, Last
    Win. The pill takes a bar row of its own (that wrap is by design and is the
    only one on a phone); its own contents do not wrap, and
    `.cb-panel-light` is pinned `flex-wrap: nowrap` to say so.
    - This reverses an earlier pass that gave the two readouts a **second line
      inside the pill**. That pass reserved them 16 units each, which is more
      than three icon buttons leave, and let the existing `flex-wrap` drop them
      down - buying the widest possible box for the worst currency and paying a
      whole extra line of bar for it on every phone, in every currency, on
      every round. A balance sitting under the buttons rather than beside them
      reads as a layout that wrapped, not one that was drawn. **The owner's
      call is the single row**; small type in the worst case is the accepted
      cost, and shrinking a long figure is already what this bar does
      everywhere else.
    - **A share of the row, not a reservation.** `flex: 1 1 0` + `min-width: 0`
      on `.cb-readouts` and on both readouts splits whatever the icons leave.
      That matters because neither neighbour is a fixed width: the MODE button
      is a translated word, and `.cb-icon` carries a flat **36px** floor under
      `pointer: coarse` that does not scale with `--ui-bar`. The box is still
      **bounded**, which is the property `use:fitValue` depends on - a
      zero-basis flex item cannot grow past its share, so `scrollWidth` against
      `clientWidth` stays meaningful. `max-width: none` alone would not be, and
      `currencies.test.ts` fails if the cap is lifted without the flex bound.
    - Measured at all seven sizes with the worst case in the supported set
      (`TZS 2,578,770,000,000.00`) and with the widest `Mode` translations (ru,
      vi): one pill row on all three phones, **nothing clipped anywhere**, no
      horizontal scroll, and the four landscape sizes untouched at one bar row.
      The balance bottoms at 6.02px on Mobile S against a 5.52px floor.
    - **Popout S still opts out**, and must name `.cb-balance` and
      `.cb-lastwin` - and now `.cb-readouts.solo .cb-lastwin` as well - setting
      `max-width` as well as `min-width` each time. Left unrestated, the 620px
      block's reset reaches into a window that has the room for the measured
      widths and does not need the phone treatment.
  - **Replay hides the balance, and that is a different layout.** `.cb-readouts`
    is `space-between`, and one child under that sits at the START - so Last Win
    ended up mid-pill with the balance's width doing nothing. `.solo` pushes it
    right and hands it the freed width (26 units against 17).
    - That 26-unit floor is **cleared on phones**, at `.cb-readouts.solo`'s own
      specificity or it does not land. Once three 36px icons are paid for, 26
      units is wider than a phone row has left: at Mobile S it pushed the pill
      4.7px past the bar's padding on each side - the "hangs off both edges"
      failure - through the one selector specific enough to outrank the reset.
  - The floor is **relative** (0.55 of the breakpoint's own size), never an
    absolute pixel count. An absolute 9px was tried and sat *above* the unfitted
    5.9px size at Popout S, so the viewport that most needed the fit was the one
    it refused to touch.
  - **Shrinking, not abbreviating.** `NGN 11.46B` would fit easily; Stake's
    checklist asks for final win amounts to be clearly shown, and an exact
    figure in small type is a figure where a rounded one is not.
- **High-denomination currencies are the stress case, and they are not exotic.**
  The RGS supports units worth a thousandth of a dollar, and an operator sets
  `maxBet` in those units. High Stakes' 1910.2x cap on a 2,000,000 NGN maximum
  settles at `NGN 3,820,400,000.00`. The worst three across the supported set are
  **TZS, UGX and XOF**, tied at 24 characters - `TZS 2,578,770,000,000.00`, and
  XOF with a five-character `F CFA ` prefix. NGN is fourth; VND and IDR have
  weaker units still but no minor unit, which saves them three characters.
  (An earlier note here named COP as the worst. **COP is not a Stake currency** -
  that figure came from a scratch list written before `currencies.ts` existed,
  which also wrongly carried GBP, AUD, CHF, SEK and THB. `currencies.test.ts`
  derives the worst three from the real list now, so the claim cannot drift
  again.) Before this pass that figure ran off both
  edges of a 375px viewport on the win screen, spilled the balance readout on
  every phone, and broke the Advanced button onto a second bar row at Laptop and
  Popout L. `game/currencies.ts` holds the full list and `currencies.test.ts`
  walks it - **31 of 46 render as a bare code** in an English locale, so the
  chip's two-line "CODE over number" layout is the common path, not the
  exception.
- **The bet is locked while autoplay runs, and the control says so rather than
  going grey.** Autoplay stakes the same amount every round - that is the
  contract the player confirmed - so the chips, the entry field and the steppers
  cannot move it. The display button is **not disabled and not dimmed**: a
  greyed primary control reads as "this is broken", where a live one that
  answers back reads as "not right now, and here is why". The click is refused
  and flashes `.cb-bet-tip`; hover shows it on a pointer device, and the flash
  is the only route a phone has to it. Replay still disables the button
  outright, where Stake's guidance asks for inert bet controls.
  - `setBetLevel` and `formatBetInput` both check `betLockedReason()` too. The
    menu is unreachable while locked, but a run can *start* with it already open
    (the spacebar hold does not go through the popup at all), and those two
    lines are what actually make the bet safe.
- **Local dev now supplies bet limits** (`minBet`/`maxBet`/`stepBet`) in
  `Game.svelte`'s dev bootstrap, beside the dev balance. Without them
  `stateConfig.betLimits` is `{0,0,0}`, which every helper in `betLimits.ts`
  correctly reads as *unconstrained* - so the clamp, the step snapping and the
  spin button's range check were all no-ops locally and none of them could be
  seen to work until the game was on a real session.
- **A typed bet clamps DOWN to the maximum and never UP to the minimum.** The
  asymmetry has been argued both ways and this is the settled form. Clamping
  down stakes a player less than they asked and makes the maximum selectable,
  which Stake's checklist requires. Clamping up stakes them **more** than the
  figure they typed - the one thing the frontend must not do to a player's own
  number - so a below-minimum bet stands exactly as typed and the spin button
  explains it instead.
  - **The step snap has to be guarded for the same reason.** `snapToStep` floors
    onto the grid, so anything under one step floors to *zero*: with a 1,000
    step, typing 500 came back as `0.00` and the button said "Enter a valid bet"
    - true of zero, and silent about the 500 the player typed. If the snap
    produces nothing, keep what they typed; it is unplayable either way, and a
    figure snapped out of existence cannot be described.
- **One reason per failure, not one boolean.** `betBlockedReason()` replaces a
  `betIsValid()` that printed "Enter a valid bet" for a zero bet, a bet the
  player cannot afford and a bet under the operator's floor alike - and only the
  first of the three is something a player can act on by reading it. Now
  "Insufficient funds", "Bet is below the minimum of %s" and "Bet is above the
  maximum of %s", with the figure named. Affordability is checked BEFORE the
  range: someone who cannot afford the round needs to hear that first, even if
  the amount also sits under the minimum.
- **A round in flight locks the bet and the mode, not just the guesses.**
  `choicesLocked()` had covered the guess squares since the engine-flow window
  was found, but the MODE button and the whole bet group were on
  `autoRunning || replay` only - so the family and the amount could both still
  be changed while a round was on the wire. Same failure class as the guesses,
  for the same reason: you end up looking at a board that no longer describes
  the round being settled. `roundInProgress()` is the shared predicate now, and
  an `$effect` closes the bet or mode panel if one is open when a round starts -
  a panel already up would otherwise stay there showing controls that silently
  refuse, which reads worse than a greyed button.
- **The card slot is pinned to the card's width**, not to the multiplier chip
  above it. Without that the slot is as wide as its widest child, and the chip
  becomes that child once the figure gets long: on a High Stakes maximum the
  four slots measured 97 / 97 / 99 / 100px, so the cards sat at four different
  pitches and shifted as each chip appeared.
- **A `<button>` does not inherit `font-family`.** The UA stylesheet sets its
  own `font: 400 13.333px Arial` on `button`, `input`, `select` and `textarea`,
  and that beats inheritance — so `html body { font-family }` in `app.css`
  reached every element in the game *except the ones the player clicks*. This
  game self-hosts Poppins and then printed its most-read numbers in the system
  sans, for the whole life of the code. Measured in the running page before the
  fix: the control bar's bet display and mode name (`.cb-val`, `.cb-cap`,
  `.cb-mode-word`, `.cb-bet-mode` — on screen at all times), all three
  mode-picker rows, How to Play's tabs, the autoplay pills, the panel action
  button and every bet chip's value. `start-screen.css:408` had already worked
  this out for one button and said so; it was never generalised. It is a global
  reset in `app.css` now, **family only** — the UA shorthand also sets size and
  weight, and every control here declares its own.
  - Invisible in the source and invisible in a stylesheet: it only shows in the
    *computed* style of a running page, which is how it survived a full art
    pass. `betChips.test.ts` pins the reset, and the way to check it is to walk
    the live DOM for anything not drawing in Poppins — not to read CSS.
  - Stake names "standard fonts" as a top cause of a 1-star rating.
- **The logo is WebP, with the PNG as a real fallback, and the choice is made
  in JS rather than in CSS.** `logo.webp` is 81 KB against the PNG's 743 KB and
  is indistinguishable at the 310 CSS px the loader draws it at — the largest
  size anywhere in the game. The obvious CSS spelling does not work here twice
  over: the six call sites pass the URL through a custom property, and a `var()`
  resolving to something unusable is invalid *at computed-value time*, which
  resets the property to `none` instead of falling back to the declaration above
  it — the logo would simply vanish. Wrapping it in `@supports` fixes that and
  tests the wrong thing: **Safari 14–16 read WebP and do not support
  `image-set()` with `type()`**, so three major versions would be handed the
  743 KB file for nothing. `game/logoAsset.svelte.ts` probes a 34-byte WebP data
  URI instead, defaults to the WebP so the saving is real, and only ever moves
  downwards. **Not** a `canvas.toDataURL('image/webp')` probe, which is the usual
  one-liner and is wrong for exactly the browsers it exists to protect: Safari
  could decode WebP from 14 but could not encode it until 17.
- **Glyphs are drawn when, and only when, the font does not own them.** Poppins
  is self-hosted latin-only, and `✕` U+2715, `✓` U+2713, `→` U+2192 and the four
  suits fall outside every declared `unicode-range` — they dropped to the system
  font, which on Android and iOS means a colour emoji. `SuitIcon.svelte` and
  `MarkIcon.svelte` draw those. The card **ranks are ASCII, inside U+0000–00FF,
  and deliberately NOT drawn**: there is no fallback to fix, and hand-cutting
  thirteen glyph outlines would trade a real typeface for a worse one.

- **The audio is synthesised, and there are no audio assets.** `audioGraph.ts`
  owns one `AudioContext`, one bus chain with a limiter on the end, and a
  generated impulse response for the room; `sound.ts` is the cue book;
  `music.ts` is the bed. **One context, deliberately** — music and cues share
  the bus, because a second context is a second limiter that cannot see the
  first, so a fanfare and a bed would each stay clean on their own meter and
  clip against each other on the speakers. Browsers also cap contexts per page.
  Nothing is downloaded: `bundleStrategy: "inline"` would base64 any Vite-processed
  asset straight into `index.html`, which makes shipped audio disproportionately
  expensive. If produced audio is ever commissioned it goes in `static/` behind
  `${base}/…`, and only the bodies of `sound.ts`'s `play*` functions change —
  `Game.svelte` touches nothing but that module's public API.
  - **Muting returns before anything is scheduled**, rather than turning a gain
    to zero, so a muted game builds no nodes at all. `sound.test.ts` pins that,
    because it is a CPU claim as much as an audio one.
  - **Two buses with `volume` and `muted` kept separate**, never collapsed into
    "volume 0 means muted". That is what lets the speaker button and the slider
    agree: the button toggles `muted` and leaves `volume` where it was, and
    `setBusMuted` restores `lastAudible` when un-muting a bus parked at zero —
    without which a slider dragged to 0 becomes a dead end with no way back up.
  - **The bed has no foreground, and that took three attempts to accept.** A
    sparkle and then a plucked arpeggio were both built and both removed:
    anything with an attack and a pitch stops being background the moment the
    player notices it once. Movement comes from re-voiced pad chords and from
    room noise (chips settling, cards on felt) — never from another melodic
    layer. Every cue is jittered per trigger, and every noise burst is a fresh
    buffer, so four card flips in a round are not one sample four times.
- **The jurisdiction block is the operator's, and every read must survive it
  being absent.** `Authenticate.svelte` assigns
  `stateConfig.jurisdiction = authenticateData?.config?.jurisdiction`
  *unconditionally*, so a response without the block replaces the defaults
  object with `undefined` and a bare property access throws. Every read goes
  through `readFlag` in `jurisdictionRules.ts` (pure, unit-tested), and **the
  fallback is always the permissive value** — a missing block never disables the
  game, and never enables a restriction the regulator did not ask for.
  `jurisdiction.svelte.ts` only wires that to `stateConfig`.
  - Consumed: `disabledTurbo`, `disabledSuperTurbo` (caps the slider at
    `TURBO_CAP_WITHOUT_SUPER` and relabels its end "Fast" rather than
    "Instant"), `disabledAutoplay`, `disabledSpacebar`, `disabledSlamstop`,
    `minimumRoundDuration` (gates the NEXT play rather than slowing the current
    animation), the three responsible-gambling readouts, and `socialCasino`.
    `disabledFullscreen` and `disabledBuyFeature` are declared and unconsumed
    because this game has neither control — that is correct, not a gap.
  - **Social mode is read from BOTH signals.** `?social=true` is the documented
    one, and the jurisdiction block's `socialCasino` is the same fact by the
    other route. `isSocialMode()` in `i18nDerived.ts` ORs them, and
    `+layout.svelte` uses the same predicate to force English. The redundancy is
    deliberate and one-directional: the cost of missing it is showing US players
    the restricted gambling terms `socialMessages.ts` exists to remove.
  - `devOverrides.ts` drives all of it from the address bar
    (`?dev_disabledTurbo=1`, `?dev_displayRTP=1`, `?dev_minimumRoundDuration=2500`,
    `?dev_minBet=1&dev_maxBet=100`), because localhost has no
    `/wallet/authenticate` and none of this behaviour can otherwise be seen. It
    is behind an `import.meta.env.DEV` literal, so Vite drops the module from a
    production build.

---

## Two bug classes that keep recurring

Check for both in any change.

### 1. Two units on one screen

"30% of the running multiplier" and "0.5× your bet" are the same rule in
different units. Showing both reads as a contradiction — this has already caused
three separately reported bugs. `payoutTable.test.ts` fails if any rules row
contains a bet multiple.

The same hazard generalises to any two scales shown at once (e.g. a 3-stop meter
beside a 5-stop meter). If two rulers must coexist, they need different labels,
different lengths, and no printed numbers to invite comparison.

### 2. Single-family assumptions

Anything hardcoding `1354.2`, `0.3`, or `"30%"` is probably Classic leaking into
all three modes. This caused the win-tier bug (High Stakes announcing a false
Max Win, Second Chance unable to announce a real one) and the replay screen
printing raw mode slugs (`parseModeName` must strip the family prefix *before*
splitting on `_` — `sc_red_higher_equal_spade` has five parts, not four).

---

## Client conventions worth knowing

- **Svelte scoping bites child components.** A stylesheet is scoped to the
  component that imports it, and a child's elements never carry the parent's
  scope class — so a `.bolt` rule in `popups.css` compiles to
  `.bolt.svelte-<parent>` and matches nothing. Child components style themselves
  and take **custom properties** from the parent, which inherit through the DOM
  normally. See the notes atop `ChoiceIcon.svelte` and `BoltMeter.svelte`.
- **One wordmark, three screens.** The loader, the intro and the board all draw
  "Ride The Bus", and a player sees all three inside ten seconds, so they are one
  lockup: `--font-display` at 4.2 units (3.9 on the board), **negative** tracking,
  title case, `--gold-bright`, with the credit line under it at a quarter the
  size in wide-tracked small caps (`--ink-lockup-sub`). The intro was the odd one
  out — body face, uppercase, positive tracking, a different gold. Change one,
  change all three.
- **Sizing is fluid, not stepped.** Everything is a multiple of `--ui` /
  `--ui-bar` in `base.css`. `responsive.css` holds structural changes only.
  Vertical space is budgeted: cards + win readout + guess squares ≈ 30× `--ui`.

### The seven target screen sizes

Every layout change is checked at all seven. The first four are **exactly
16:9**, which is what makes one arrangement work across the whole range.

| Size | Viewport |
|---|---|
| Desktop | 1200 × 675 |
| Laptop | 1024 × 576 |
| Popout L | 800 × 450 |
| Popout S | 400 × 225 |
| Mobile L | 425 × 812 |
| Mobile M | 375 × 667 |
| Mobile S | 320 × 568 |

**Mobile is the only place anything may be rearranged.** A phone is portrait,
so a row of four that fits a 16:9 window cannot be assumed to fit, and the
control bar breaks onto extra rows there by design. From Popout S up to
Desktop the arrangement must be **identical** and only the scale changes —
Popout S is Popout L at exactly half size, and is laid out that way.

That is a constraint on the *clamp floors*, not on the media queries: whenever
`--ui` or `--ui-bar` bottoms out, the layout stops scaling and starts
restructuring, and every Popout S defect so far has been downstream of one of
those floors. `--ui-bar` is solved from the bar's real width budget —
`(100vw − 30px) / 96`, being ~95.5 units plus ~26px of 1px borders that cannot
scale — rather than from a `vw` coefficient, because a coefficient ignores the
fixed term and so is 4% too generous at 400px, which is exactly the difference
between a one-row bar and a two-row one.
- **Two colour worlds, now joined.** The table, chips, cups and card backs are
  sampled warm measurements; the chrome over them was a generic cool
  dark-SaaS palette, and the two never met. That was the audit's headline
  finding. The join is `tokens.css` plus the popup/panel material borrowing the
  table's own lighting — one light from the upper right, a lit top edge, a
  shaded bottom edge, and the table's **two-part shadow** (a tight contact patch
  plus a wide soft one; `table.css` explains that a single blurred blob "reads
  as a sticker, not an object").
- **i18n:** the English string *is* the key. `en.ts` is the source of truth, and
  all 16 other locales must cover every key with a genuinely different value —
  `locales.test.ts` fails on missing keys, stale keys, and values left identical
  to English.
- **Test modules use explicit `.ts` extensions** on relative imports. `node --test`
  uses Node's ESM resolver, which will not resolve one without it.
- Tests that read the math tree **skip rather than fail** when it is absent
  (`existsSync` guard) — that is the expected state between a client change and
  the next math build, and a permanently-red gate gets ignored.

---

## Current state

680/680 tests, 0 type errors, 0 CSS warnings, lint clean, and the
client reproduces all 76,800 published books exactly. The published math build
(192 modes, RTP 96.0000% everywhere, spread 0.000000%, zero volatility
violations) is generated.

**It is NOT committed**, and the note here used to say it was. `math-sdk/.gitignore`
line 9 is `**/library/**`, so `git ls-files` on the library returns nothing: the
1.6 GB of books, lookup tables and `stats_summary.json` exist only on the machine
that built them. Two things follow. A fresh clone cannot reproduce the books
without a 40-minute rebuild, and every test that reads the math tree
(`payout.test.ts`, `volatility.test.ts`, `modeCeilings.test.ts`) silently skips
there rather than failing — which is deliberate, but only safe while it is
written down.

`npm run lint` works again — `eslint.config.js` (flat) was added because ESLint 9
ignores the `.eslintrc.cjs` every app in the vendored SDK still ships. The old
`.eslintrc.cjs` is now dead and only kept so the app still matches its siblings.

The math clears the **2-star** risk limits, not merely the 3-star ones: worst
std 32.938 (limit 0.6–50.0), worst ETL 0.695 (limit 0.8), worst CVaR 568.8
(limit 700), worst non-zero hit rate 1 in 2.03 (limit 1 in 20), P(≥5000×) zero.

### Seeing the game, rather than reasoning about it

Two things landed together and are worth knowing about before touching anything
visual, because between them they turn "this should look right" into "this does".

**A local replay RGS** (`scripts/replay-server.mjs`) serves any of the 192 modes
out of the real published books.

`npm run dev` / `pnpm run dev` is now the whole thing: it **reclaims ports 3001
and 3010 first** (so a second run is a restart, not a second pair — vite used to
slide to 3002 while the browser tab kept showing an hour-old build on 3001,
which looks exactly like everything working), starts both, and opens the link
builder. `--no-open` skips the tab; `dev:game` is raw vite if you want only that.

**The dev port travels by environment variable, never on the command line**, and
that is not a style preference. dev-all used to append `-- --port N
--strictPort` to the inner script; npm *strips* the `--` separator before
handing the rest to the script, pnpm passes it through as a literal argument. So
under pnpm vite received `--host "--" "--port" "3021"`, ignored an argument list
it could not parse, and came up on its own default 5173 while the builder went
on linking to 3021 — silently, which is the same failure the port reclamation
exists to prevent, arriving by a different route. `vite.config.js` reads
`GAME_PORT` and sets `server.port` + `strictPort` from it. dev-all also spawns
the inner script with whatever package manager started it, read off
`npm_config_user_agent`.

Six scenario aliases, not four — and **the server does no scanning of any kind.
It reads every one of them out of `REPLAY_EVENTS.md`.**

`max`/`big`/`win`/`loss` were read from the 192 lookup CSVs at boot, which cost
**33 seconds** on the first landing-page load. `bustwin` and `forgiven` describe
the SHAPE of a round rather than its size — whether it busted, whether it spent
a Second Chance — which lives in the book events, and those were resolved by
streaming a 215k-round book file on demand. Both are gone: the generator writes
all six into `REPLAY_EVENTS.md` and the server parses that. First load is
**0.11 s**, and the four table-derived figures were checked against the old
CSV-derived ones mode for mode.

- `bustwin` — busted and still paid enough to take the screen over. A round does
  not have to be a full game win to celebrate.
- `forgiven` — Second Chance only: spent its forgiveness, survived, finished big
  enough to celebrate. The case `isCleanSweep` deliberately does not floor.

**Regenerate after a math build** — `run.py` already calls
`scripts/replay-events.js` at the end of every one, and that script now scans
the books for those two columns. It can also be run on its own against an
existing build: `node scripts/replay-events.js` (a few minutes, almost all of it
the book scan).

Three states on a round button, and they are different problems:

| Shows | Means |
|---|---|
| `129.00x #1393` | resolved |
| `none` | scanned, and this mode has no such round — **button greyed out** |
| `rebuild` | the table predates these columns — run the generator |
| `sc only` | `forgiven` off Second Chance — **button greyed out** |

A greyed-out button is the point. `sc_red_lower_outside_heart` has zero drawable
bust-win rounds (0 of 1110 eligible), and the page used to let you build that
link anyway — the game then opened an error modal reading `RGS responded 404`.
Showing the answer is not the same as refusing the pick, which is the lesson
Equal-then-Inside already taught this page. Switching mode also repairs a
now-impossible selection.

**The round-details panel shows the ID the RGS served, not the URL parameter.**
The server returns `bookId` (a local extension Stake does not send) and
`replayEventId()` in `Game.svelte` prefers it, falling back to `?event=` — which
is the production path, since a real replay URL always carries the ID. Without
that, `event=bustwin` printed "Event #bustwin".

The builder also has a **game-port field**, defaulting to 3001 and remembered in
`localStorage`, because vite does not always land there.

It carries **all 49 currencies** with their dashboard names (it had fourteen),
and its guess buttons wear **the game's own choice colours** - Higher green,
Lower red, Inside cyan, Outside magenta, Equal gold, hearts/diamonds red - copied
by name from `tokens.css`. Red and Black were already painted that way and the
other three rows were not, so half the picker spoke the game's language and half
spoke the page's generic green. The ink there stays **light**, unlike the app:
these fills are a 26% wash over near-black, not the app's full-strength colour,
so `--on-choice-ink` dark-on-dark was unreadable. Same colour, different ground,
opposite answer.

**Headless browser driving over CDP** — `scripts/shoot.mjs`, `npm run shots`.
Node 22+ ships a `WebSocket` client and Playwright's chromium is already on disk
under `%LOCALAPPDATA%\ms-playwright`, so it can launch Chrome, open a replay
URL, click through the round details, poll for each tier promotion and
screenshot at any viewport — with **no new dependency in the project**, which
matters because the bundle is inlined and bundle size is a 3-star criterion.

```
npm run shots              # five tiers, desktop
npm run shots -- --sizes   # a max win at each of the seven target sizes
npm run shots -- --intro   # the intro fan and the replay details panel
npm run shots -- --reduced # prefers-reduced-motion
npm run shots -- --mode sc_red_equal_equal_heart --event forgiven
```

**Shots are a working surface, not an archive.** `scripts/.shots/` is
git-ignored and every run overwrites what it finds. Re-shoot after a visual
change rather than reasoning about a stale image, and delete anything that no
longer shows what it claims to - a screenshot of a screen that has since moved
on is worse than none, because it looks like evidence. Nothing outside that
directory should link to a file inside it.

**The repo-root `scripts/.shots/` is the only place they go.** `shoot.mjs`
anchors there correctly; an ad-hoc capture script run from inside
`web-sdk/apps/Ride-The-Bus/` once wrote 18 PNGs into *that* app's `scripts/`
directory, where the anchored ignore pattern did not reach them and `git status`
offered them for commit. `.gitignore` now carries a bare `.shots/` as well, so a
stray one at any depth is still ignored — but a capture script must resolve the
directory from the repo root, never from `pwd`.

This is how the win takeover was actually looked at, and every defect fixed in
that pass was invisible in the source and obvious in a screenshot: three ambient
circles that composed into a lens smudge, sixteen suit marks that never shared a
start, the settled payout legible behind the blur, a fan that covered its own
headline on a phone, and an intro fan that split into two half-fans leaning off
opposite sides when it wrapped 2-per-row. **If a change is visual, drive it and
look.**

## Outstanding

- **Win takeover: still wants real hardware, but the perf risk is mostly
  spent.** The blur is `blur(2px) saturate(0.86)` and is dropped entirely under
  `@media (pointer: coarse)` — that was the pre-emptive fix this list used to
  defer, and it is free now that the text sits on its own shadow band rather
  than depending on the blur for legibility. The burst is ten one-shot marks
  instead of sixteen on infinite loops. What remains for a device: the fan's
  four `box-shadow`ed cards and the `drop-shadow` on the marks. If it still
  drops frames, take the marks' `filter` first; do not go back to blacking out
  the table.
  - All five tiers **have** now been eyeballed at Desktop, Laptop, Popout L,
    Popout S, Mobile M and Mobile L, on Classic and High Stakes, including a
    busted-but-paying round and `prefers-reduced-motion`. Driven headless over
    CDP against the local replay RGS, not by hand — see the note on browser
    automation below. Mobile S (320×568) and a real device are still open.
  - Two responsive traps are recorded in the CSS because both cost a pass:
    `.wc-fan` is a **child of `.wc-body`**, not a viewport-anchored sibling —
    anchored to the viewport it sized in `--ui` while the title is capped in
    `vw`, so on a 375px phone (title 41px, `--ui` 7.5px) the word landed across
    the middle of the cards. And the deck sweep's mask percentages are measured
    against an element inset `-60%`, i.e. 220% of the viewport, so every value
    there lands 2.2× wider on screen than it reads.
- **B2 — art pass. Half done; the remaining half is assets, not treatment.**
  Stake names "over-reliance on generic AI-generated assets — standard fonts,
  gradients, emoji icons and border effects" as a top cause of a 1-star rating,
  and 1 star is **not published**.

  **Done** (branch `ui-art-pass`): the emoji-substitution risk is gone (drawn
  marks); the gradient-plus-border-plus-glow title plate is gone, replaced by a
  two-stop scrim; the four-equal-panels intro grid is now a dealt fan on the
  real table; the popup shell is a lit material rather than the default dark
  modal; the 999 px multiplier badges are gone; the card face has warm paper,
  the back's own edge and a real corner index. The audit that drove it found
  5 critical / 10 major / 5 minor.

  **Assets, done:** `static/` holds `logo.webp` (81 KB) with `logo.png`
  (743 KB) kept only as the fallback, plus `favicon.png` at 10 KB. A cold load
  now fetches **90 KB of images against 743 KB before** — the favicon used to be
  the full 710×710 logo, three quarters of a megabyte for a 16 px tab icon,
  fetched before anything a player can see. Whether the game needs any
  *bitmap* art at all is still a judgement call: the table scene is hand-sampled
  CSS and is the best work in the repo, so the honest risk is not "no assets" but
  "does a reviewer read CSS art as art". Note the tension before adding any:
  `config-svelte` sets `bundleStrategy: "inline"`, so anything Vite processes is
  base64'd into `index.html`, and bundle size is itself a 3-star criterion —
  ship art from `static/` via `${base}/…` like `logo.png` does, not through Vite.
- **REP-02 — deliberately deferred, not forgotten.** A replay on the Stake site
  showed bet amount 1000 where the game rendered 1 — an exact 1000× gap pointing at a units convention. Stake documents
  `?amount=` as "bet amount in units" and the RGS speaks micro-units, which is
  what `Authenticate.svelte:121-122` assumes. Capturing the answer is now one
  console line: paste a Stake replay query string onto `localhost:3001` (replay
  needs no session) and read `[RideTheBus] REP-02 replay amount chain`.
- **Volatility, next step:** the meter rates Inside and Outside identically,
  which the published figures say is a real (if secondary) simplification —
  Classic's `inside` band is 4.34–5.22 against `outside` at 3.31–3.51. Splitting
  it needs an eighth stop. `volatility.test.ts` asserts the current behaviour so
  the choice is on the record. No board-level meter yet: the rating shows in the
  mode picker and on the bet display only.
- B3–B8 optional polish: round history strip, session stats, quick-bet ½/2×,
  round ID surface, keyboard shortcuts for guesses, near-miss reveal.
- Open naming question: "High Stakes" implies a cost premium it no longer
  charges.
- **Approval-checklist gaps still open** (all from the verbatim criteria below):
  - ~~Replay "Play Again" button~~ — **closed.** The spin button already
    re-ran the round; it now says so. `replayFinished()` drives both the
    accessible name and a visible gold caption under the button. A caption
    rather than a label inside the disc: the button is 44 px and the words do
    not fit, and the deal glyph is still the right picture — it deals the same
    four cards again. Positioned out of flow like the tooltip, so it cannot add
    a row to a bar whose height budget is the tightest thing in the layout.
    Verified at Desktop, Popout S and Mobile M.
  - Touch targets: guess segments **paint** 29/35/39 px at 320/375/425,
    equal-badge tap area `min(32px, 45% of the square)`, bar icons 36 px,
    sound sliders 32 px on coarse pointers. The badge's ceiling is tied to the
    square rather than flat at 32 px because a flat 32 px reaches past a
    segment's own centre on a 320 px screen and steals it. Nothing reaches the
    44 px *comfortable* target: four cards across cap `--ui` at 2.265vw, and
    44 px bar icons overflowed a 375 px viewport. Table in
    `RGS_TEST_PLAN.md` §11. "Popout S/L" is still a named responsive check.
    - **This used to claim the 24 px floor was cleared "everywhere", and that
      is not true on Mobile S.** The claim measured the segments' PAINT. The
      badge is centred on the seam and its `::before` overlays them, so what a
      thumb can actually reach — probed with `elementFromPoint`, which is the
      only way to see a pseudo-element hit area — is **21 px** on
      `.third-btn.higher-third` and **22 px** on the two `.io-square` halves at
      320×568. Mobile M and Mobile L are genuinely clear (badge hit 32/33 px,
      segments unobstructed).
    - **It cannot be tuned out, and the arithmetic is why.** At 320 the square
      is 58.9 px; two 24 px halves plus a 24 px badge needs 72 px, i.e. `--ui`
      8.61 against the 7.04 available. Shrinking the badge instead makes it
      worse — for the halves to keep 24 px the badge would have to drop to
      10.9 px, below even its current 13.7 px paint, which is the unhittable
      state the `::before` exists to fix. And `--ui` is bound at 320 by
      **2.2vw** (the four-card row), not by height — `1.55vh` would allow 8.80.
      So the only real fixes are a narrower card row or moving the badge off
      the seam, and both are the owner's call, not a tuning pass.
    - Do not "fix" this by restating the paint figure. That is what hid it.
  - Tile assets: **done, and they live in `submission/`, not `static/`.** All
    three fixed names are present — `RideTheBus-BG.jpg` (1536×1024, 499 KB),
    `RideTheBus-FG.png` (1254×1254, 1.50 MB) and `TakeoverCasino-Logo.png`
    (710×710, 726 KB). BG+FG is **1.99 MB against the 3 MB cap**, with a megabyte
    of headroom; there is no documented cap on the provider logo.
    - They were in `static/`, which is copied wholesale into the build output,
      so every deployed build carried 2.7 MB of artwork no player ever fetches.
      `static/` is 726 KB now — just `logo.png`, the only one the game loads.
      **Do not move them back**; they go up through the Tile Editor.
    - `TakeoverCasino-Logo.png` is byte-identical to `logo.png`, which is
      correct rather than sloppy: the chip on the card backs, the loader and the
      table's deck prop *is* the Takeover Casino mark. Kept as two files because
      they have different owners — one is resolved through `${base}/logo.png`,
      the other's filename is dictated by Stake.
    - `logo.png` is now the WebP's fallback rather than the file the game
      loads, so it stays at 710×710 and byte-identical to the tile asset.
      README's older 4-layer Tile Editor description has been corrected.
  - **The live-session checks in `RGS_TEST_PLAN.md` remain unrun — now 94, not
    52.** The plan was strong on this project's own regression history and thin
    on the criteria Stake publishes; 33 were added covering the spacebar binding,
    the mute control, autoplay confirmation, an invalid `rgs_url`, a malformed
    `?lang=`, min/max bet selectability, the paytable and UI guide, double-tap
    zoom, the frame never scrolling, Play Again, replay in Popout S, and two new
    sections — **13 · Stake.US and social mode** and **14 · Performance** — that
    had no coverage at all.
  - **Closed on `ui-art-pass`, listed so they are not re-opened by accident:**
    - *"High cost bet modes require confirmation before activation."* The mode
      picker now proposes rather than applies: picking a different family shows
      a confirmation restating its blurb, ceiling and volatility, read from the
      same `FAMILY_RULES` / `FAMILY_BLURB` the list rows use. Every close path
      runs through one `closePopup()` that discards an unconfirmed pick.
    - *"Double tap to zoom is disabled on mobile."* Now `touch-action:
      manipulation`, **not** `maximum-scale=1.0, user-scalable=no`. The old pair
      met the checklist by disabling pinch zoom too, which fails WCAG 1.4.4. If
      the viewport meta looks under-specified, this is why — do not add them back.
    - Keyboard focus. There was no `:focus-visible` anywhere on the board, and
      `.choice-square` is `overflow: hidden`, so the browser's own outline on the
      four primary controls was **clipped away entirely**. Segments use inset
      rings for the same reason `.selected` does; everything unclipped uses an
      offset outline. Never transition a focus ring.
    - `prefers-reduced-motion` now covers the board (`cards.css`, `choices.css`,
      `control-bar.css`, `popups.css`), not just the loader, intro and
      celebration. The card flip still *happens* — it is how the game says a card
      was revealed — it just stops being a rotation.
- ~~Promo blurb for submission~~ — **written**, at three lengths, in
  `PROMO_BLURB.md`. The **standard** one is the default to submit. Its Second
  Chance sentence used to say the family "forgives your first wrong call
  outright", which is wrong twice over — forgiveness keeps **half** the running
  multiplier, and only from **card 2**. Stake reads the blurb against the game,
  so every claim in that file has to be checkable against `FAMILY_RULES`.
- **Not yet submitted to Stake** — math, bet modes and mechanics are all still
  changeable until the user says otherwise.


---

## Stake's own requirements live in a skill, not here

The Stake Engine **development contract** and the **verbatim approval guidelines**
used to sit at the bottom of this file — 34 KB, ~8.6K tokens, loaded on every turn
of every session to be consulted a few times a week.

They are now `.claude/skills/stake-approval/`, which fires on submission,
compliance, approval-checklist, risk-limit, replay-spec and restricted-term work:

- `references/approval-guidelines.md` — what Stake requires (checklist, PreChecks,
  star tiers, risk limits, replay spec, tile assets, disclaimer, social-mode terms)
- `references/development-contract.md` — how we work (math integrity, simulation
  workflow, release gates, operating procedure)

**Nothing was dropped or reworded** — both files are the original text, split at
their existing headings. Read them rather than answering a Stake question from
memory; that reference is the source of truth for every Stake-specific claim in
this repo.
