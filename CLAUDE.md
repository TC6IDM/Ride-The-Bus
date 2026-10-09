# Ride The Bus — Stake Engine game

A four-guess card game built for Stake Engine: a Python math package that
generates the published books, and a Svelte 5 client that replays them.

**New to the codebase? Read [WALKTHROUGH.md](WALKTHROUGH.md).** It is a guided
read of the whole system - the martingale the payouts are solved from, what the
math build produces, the four RGS endpoints, and the client's three-file round
- written to be followed with the files open. This file is the RULES; the
walkthrough is the EXPLANATION. [REFACTOR_LOG.md](REFACTOR_LOG.md) records the
2026-09 readability passes and, more usefully, the four classes of thing that
broke in them that no compiler catches.

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
   npm run check         # tsc; 0 vendored errors. The 2 it still prints are
                         # named type imports from .svelte, which tsc cannot
                         # resolve and svelte-check reports none of.
   npm run check:svelte  # must be 0 errors AND 0 CSS warnings. 0 in the
                         # vendored SDK too now; the "No Lingui config found"
                         # line it sometimes prints is a pnpm dlx artefact.
   ```
   ```
   npm run lint          # now a gate; must be clean
   ```
   `npm run lint` used to be dead — ESLint 9 reads `eslint.config.js` and every
   app in the vendored SDK still ships only `.eslintrc.cjs`. This app now has a
   flat config, so lint runs and must pass. The dead `.eslintrc.cjs` beside it
   is ignored by ESLint 9 and kept only so the app still matches its siblings.

   ```
   npm run verify        # all four gates at once, watched on a page (:8768)
   ```
   `npm run verify` (`scripts/verify.mjs`) runs those four through their own
   npm scripts in parallel (~25s) and shows each one live on
   http://127.0.0.1:8768 - status, the count, any failure, the output. It is
   stricter than `check:svelte` alone: a warning in the game's own source fails
   it, as the rule above says. Each run leaves its four logs and a
   `dashboard.html` in `scripts/.shots/verify/`. **The owner wants checks
   viewable this way**: `npm run rgs` (:8766) and `npm run rgs:local` (:8767)
   have pages too.

   ```
   npm run audio         # capture the REAL audio graph and draw it
   ```
   `npm run audio` exists because I cannot hear. It taps the running game's
   output, writes a WAV, and renders a spectrogram and a waveform I can look at,
   plus metrics (RMS, crest, level movement, centroid, flatness, band split).
   **Use it for any change to the `audio*.ts` modules / `music.ts` / `sound.ts`** — the
   same rule as "if a change is visual, drive it and look", and for the same
   reason: `sound.test.ts` pins what gets SCHEDULED and says in its own header
   that it cannot tell you whether the result sounds good. Details are in
   `.claude/skills/rtb-audio-lab/`.

   **Browser work defaults to `playwright-cli`** (the global `@playwright/cli`,
   not a project dependency; skill in `.claude/skills/playwright-cli`). Use it
   for any ad-hoc look, click, computed-style read or console check, ahead of the
   chrome-devtools MCP or a throwaway CDP script: a command answers in a few
   hundred bytes and its page snapshot goes to a file, not into context.
   **Phones need `open --mobile` before `resize`.** A bare resize is a narrow
   desktop with hover and a fine pointer, and the bar came out 11-20px short at
   all three phone sizes. The scenario sweeps stay on `npm run shots`. Timings
   and a recipe are in status.md.

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

**`main` is current.** PR #2 merged `refactor/readability-passes` into it
(2026-10-07) - Three of a Kind, High Stakes at 15%, the direct book writer, the
readability passes, Last Stop and everything since - and work goes straight
onto `main` from 2026-10-09. Local `main` tracks `origin/main` now (it used to
track `origin/monorepo-restructure`, which sent a bare `git push` somewhere
unexpected); still ask before every push.

---

## The game

Guess four cards: **colour → higher/lower/equal → inside/outside/equal → suit**.

All four guesses are picked *before* the round, so **each guess combination is
its own RGS bet mode**.

**257 published modes = 4 families × 64 playable combinations, plus one.**
(`equal` then `inside` is impossible — nothing falls strictly between two cards
of the same rank — so 64, not the 72 the four lists multiply out to. A mode that
loses 100% of the time also has zero variance, which the RGS rejects outright.)

| Family | Prefix | Cost | Retention on a miss | Max win | Forgiveness |
|---|---|---|---|---|---|
| Classic | *(none)* | 1× | card 1 nothing, then 30% | 1354.2× | none |
| Second Chance | `sc_` | 1× | card 1 nothing, then 30% | 585.2× | first miss from card 2 keeps 50%, play continues |
| High Stakes | `hs_` | 1× | card 1 nothing, then 15% | 2237.3× | none |
| Last Stop | `ls_` | 1× | card 1 nothing, then 30% | 4,301.9× | none - a right suit draws a 2-10× ticket in place of its price |
| Three of a Kind | `tr_` | **250×** | nothing, ever | 4,583.3× base bet | none |

**Last Stop is Classic until the suit** (redesigned 2026-09-30): cards 1-3 are
Classic's to the bit, and the suit card has no price of its own - a right suit
draws a bus ticket from a stack of 20 (ten 2×, five 3×, three 5×, two 10×) that
multiplies the running total, and a wrong one keeps Classic's 30%. The book
writes the suit card's `payout` as 1.0 (`TICKET_STAGE_PAYOUT`, both sides) and
the ticket as its own event; card 4's chip lands WITH the ticket. **A correct
pick never shows under 1×** (the owner's rule), and **no card is priced below
Classic's** (the owner's call: the design before this took the ticket's price
out of card 1 and the suit card, and card 1 read 1.28× against Classic's
1.99× - "cutting their profit, and the profit comes back as the ticket").
Modelled exactly by `model_families.py`: std 4.5-31.0, etl40b 0.585, CVaR 475,
max 4,301.9×, between Classic and High Stakes by std on all 64 combinations -
the fourth bolt, the orange (`--vol-ls`). The reweight publishes the ticket
odds EXACTLY as the stack (`ticket_weights`), because How to Play draws the
stack. A bust carries no ticket at all. **Built 2026-10-01**: parity replays
all 257 modes; the built worst cases (std 31.4, etl40b 0.591, CVaR 483.5) sit
within a few percent of the model. The parity replays go family by family
(`currentFamilies()`), so a family whose rules move before a rebuild is the
only one they skip. The argument is LAST STOP in `game_calculations.py`.

**Three of a Kind is a different game on the same table**: a 12-card deck (A K
Q of each suit), **three cards**, no guesses — card 1 is dealt, cards 2 and 3
must match its rank — one mode (`tr_any_equal_equal`, three tokens: a slug's
length is its stage count on both sides of the wire), one outcome, fair odds
(1 × 11/3 × 5 = 18.333× cost, physical 1 in 18.3, recorded 1 in 19.1). It is
**purely binary and 95% non-paying** — past the "90,000 of 100,000" example in
Stake's guidelines though inside the 1-in-20 line; the submission's softest
point, accepted. The whole derivation — why no all-or-nothing can exist on the
four-guess ride (pay × chance = 0.96 caps a binary payout at 19.2× cost; a
single outcome ≥ 40× cost puts 100% of the RTP in the tail), **why a binary
win must stay under 5,000× the base bet** (Stake's tail-probability rows are
written in base-bet multiples and never scale with cost; the first build, A K
Q J at 1000× paying 25,000×, failed every one of them), why 250× and not more,
the Graffiti Ways precedent and what its paytable actually showed — is THE
ALL-OR-NOTHING BOUND in `game_calculations.py`. Read it before proposing a
trips variant, a bigger prize or a token consolation.

**The four-guess families cost 1.0×.** That is forced, not chosen: `etl40b` is
an absolute sum against a fixed limit and is *not* divided by cost, so a 2× mode's
figure doubles for the same shape. Even Classic's shape fails at 2×. Three of a
Kind escapes it because its payout never reaches 40× its cost. The cost also
sizes the bet ladder: bet cost is capped at $50,000 a round on the 2-star
template, so 250× leaves the base bet at $200 where 1000× pushed it to $50.

**Cost is per mode now and must be shown**: the picker row, the confirmation
and the How to Play sentence all read `FAMILY_RULES[f].cost`, and the control
bar's multiplied-bet readout is live again.

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

The **rule** is here. The **argument** is in `.claude/skills/rtb-invariants/`,
one reference file per group below — moved out verbatim because it was 45 KB
loaded on every turn to be consulted a few times a week.

Read the one file covering what you are changing, not all of them. Almost every
rule below records a defect that already shipped once, and several say plainly
that the obvious alternative was tried and rejected — which is the part worth
reading before proposing it again.

- `math game_calculations.py:MODE_FAMILIES` ↔ `web game/modes.ts:FAMILY_RULES`
- `FAMILY_RULES[f].maxWin` is **data**, pinned by `payout.test.ts` to what the
  payout maths actually reaches.
- Win-tier ladders are **per family** (`winTiers.ts:winTiersFor(family)`) — every
  band, not just Max. Each is solved to hit Classic's rarities
  (~1 in 70 / 305 / 3,093 / 15,561) with Max = that family's own ceiling.

### The win takeover — `references/win-celebration.md`

- **The Max band is matched on equality; every band below it on `>=`.** A payout
  *above* a family's ceiling falls to Epic rather than claiming the rarest screen
  in the game. `winTiers.test.ts` pins both directions.
- **The takeover is made of the round, not of gradients** — its centrepiece is
  the cards just played, fanned, each drawn by **`CardFace`** - the same
  face the board turned over, not a lookalike - and, on a Last Stop sweep, the
  ticket laid ON the hand: the four cards fan as on every family and the ticket
  (**`TicketFace`**) sits over their middle, lower, in front, dealt after the
  last card (owner's call, 2026-09-30 - as a fifth place in the fan it read as
  a fifth card) - and it rides the hand's hop, with the middle of the hand
  (`hopFan`, 2026-10-01). `revealedCards` is **snapshotted** into `celebration`,
  not referenced. The fan marks what happened: a `--loss` cross on the busted
  card (desaturated), a `--forgiven` arrow on a Second Chance one (**not**
  dimmed). Exactly three shapes can reach it; the fourth is defensive only.
- **One veil for the whole ladder.** `--wc-veil` on `.wc-overlay`, never per tier.
- **Lettered, not lit: nothing on the takeover glows.** The title is a hard
  block shadow in the tier's deep colour (`--wc-cool`), cast down and left; the
  amount takes the same block while it holds; the fan's cards carry a thin rim
  in the tier colour and no bloom; the burst marks cast shadows. The two-colour
  neon title and the haloed hand were the stock slot "BIG WIN" look - the third
  Hallmark audit's top finding (2026-09-26).
- **Every tier draws the whole celebration. Escalation is intensity, never
  presence.** `.tier-*` rules may set nothing but custom properties, and
  `winCelebration.test.ts` fails if one does. `--wc-fan-spread` is the rung,
  because it is the only one anyone could see; a test pins it monotonic.
- **The burst is suit marks, not sparks, and a moment rather than a loop** — ten
  one-shot marks off the fan, keyed on `activeTier.id`. Keying is right there and
  **wrong for `.wc-title`**, which is what `promoteTitle` exists to replace.
- **The light is one beam, not a spinning cone**, from the upper right, on an
  edge-to-edge shadow band. Three ambient circles on one centre is not depth.
- **The board's numeric readouts are hidden while the takeover counts** —
  `.running-win`, the four `.card-mult` chips and `.cb-lastwin`, each named
  individually in the test. The card row goes entirely; the choice row only dims
  - to 0.16, and the rule names `.choice-row.locked`, because the lock (0.5)
  has the same specificity, loads later, and is ALWAYS on under a takeover: it
  silently won until 2026-09-27, and on phones the captions printed on the
  same line as the win's multiplier. Its LABELS go outright (`.choice-label`,
  choices-board.css): text beside the win figure, legible even at 0.16. The
  table, rail, chips and cups stay lit.
  A card's chip and the running total land after the card has turned (0.9 of
  `--flip-dur`, like the bust cross), never during the flip.
- **The win ramp IS the volatility ramp** — `--vol-sc` / `--vol-base` / `--vol-hs`
  / `--vol-overflow`, referenced from the same triplets as the bolt meter. Max
  alone is off the scale and keeps its cream-on-crimson inversion. The hand hops
  through `element.animate()` with `composite: 'add'`; both halves matter.
- **"A full game win" is `isCleanSweep(bustedIndex, forgivenIndex)`, never
  "did not bust", and SIX decisions ask it.** A clean sweep is floored onto the
  takeover ladder however little it pays; the same question also gates the
  autoplay **Stop on full game win**, the `playFullWin()` sting, the
  running-win bar's **"Full game win"** label, and (since 2026-09-23) the
  **last-card hold's floor** - a card that would complete a clean sweep is held
  at least the entry tier's length, and (since 2026-10-05) the **history
  panel's** record of the round. Only the takeover was converted
  when `isCleanSweep` landed, so a forgiven Second Chance round — three of four
  right, no bust marker — stopped autoplay runs and called itself a full game
  win for months. `modes.test.ts` greps all six sites and fails if
  `bustedIndex === null` reappears anywhere in the game's own sources. The six
  live in four files — the running-win label in `GameBoard.svelte`, the
  takeover floor, the win sting and the history entry in `roundSettle.svelte.ts`, the autoplay stop
  in `autoplayLoop.svelte.ts`, the hold in `roundReveal.svelte.ts` — which is
  why the grep reads a MANIFEST rather than a path. All three names have already changed once under a split, and the
  manifest is what kept the grep finding them. See `game/sources.testlib.ts`.

### Bet modes, ceilings and volatility — `references/modes-and-volatility.md`

- **`FAMILY_RULES[f].maxWin` and `MODE_CEILINGS[mode]` are different numbers and
  both are needed.** Only 8 of each family's 64 modes reach the family figure, so
  the headline alone overstates a typical bet about fivefold. **Ceilings come
  from the build, never from enumeration** — the published tables are sampled,
  and 24 of 48 groups disagree with theory. The win-tier ladder is deliberately
  **not** wired to them.
- **A `?lang=` value is resolved against the shipped locales BEFORE it is
  activated.** A malformed tag makes `Intl` throw and empties the whole board.
  `utils-shared/language.ts` holds the resolver; it also aliases **`po` → `pl`**.
- **Anything restoring a mode from a slug must apply `parsed.family`**, not just
  the four guesses. `modes.test.ts` greps both call sites; this has failed twice.
- The volatility rating is a **ranking of published figures, not a marketing
  claim**, re-derived from `stats_summary.json` by `volatility.test.ts` — and it
  reads **two columns**. The four-guess families rank by std (1 / 3 / 4 / 5 -
  Second Chance, Classic, Last Stop, High Stakes - per combination); Three of a Kind is drawn **full and purple** by its zero-rate
  (1 in 19 pays anything, against 1 in 2 everywhere else), because by std alone
  it is calmer than most Classic modes and the comment beside the rating says
  so. The test pins both columns.
- **One ruler.** Every meter draws `VOLATILITY_BOLTS` (7) stops.
- **Purple is a family's colour, not an overflow.** `--vol-tr` is the purple -
  a dusty amethyst (178, 124, 200) since 2026-09-26, where the saturated
  #b06ae8 read as a generated palette's violet; the dead `--vol-overflow` hex
  went with it;
  High Stakes with two Equals draws **seven red bolts**. `FAMILY_BOLT_CEILING`
  and `BoltMeter`'s `overflowAfter` are gone. `--vol-overflow*` survives only
  as the win takeover's Epic tier, which is the same reading (past the top of
  the family bands). The bar's `--mode-ink`/`--mode-rgb` and `--vol-color`/
  `--vol-rgb` are the family's own colour and now always agree.
- **The one-rung ladder, and the rung is Max.** `winTiersFor` returns a single
  `max` tier sitting on Three of a Kind's ceiling: its only win IS the most the
  mode pays, so it is called that, at 1 in 19 — the label says what the win is,
  not how rare it is; rarity semantics are the ladder families'. The takeover
  fans the cards the round dealt (`fanFor(stageCount)`), three there.
- **A family with `fixedChoices` has no guesses, and its slug length is its
  stage count.** `modeChoices()` is the only way a slug is built from the board;
  `guesses` is neither read nor cleared on such a family, so a player's picks
  survive the round trip; `restoreGuesses` skips them on the way back in;
  `parseModeName` validates a slug against what the family publishes (length
  included), so `any` exists only where a fixed combination puts it. The board
  renders `stageCount()` slots and, on a fixed family, two read-only Equal
  badges instead of the guess columns; `roundState` stays four wide.
- **A switch that changes the card count turns the cards back over.** The
  picker's Switch compares `stageCount()` before and after and calls
  `clearBoard()` — three of a settled four-card round's faces under trips'
  chips, or a fourth face-down slot beside three turned cards, both read as a
  round that never happened. Between the four-guess families the board is
  left alone. Last Win is the session's and is never cleared.

### Colour, menus and chips — `references/colour-and-menus.md`

- **Every menu wears the colour of the control that opened it** — one contract,
  `--tint` / `--tint-rgb` / `--tint-strong` / `--tint-ink`; nothing inside a panel
  names a colour. `--tint-ink` is **dark** on every panel but the blue ones.
  Each `--ctl-*` and its `-rgb` triplet must be the same colour.
- **The bet menu is CHIPS, and the chip palettes are tokens.** A wrapping row,
  never a grid. A symbol rides with the figure; a CODE takes its own line.
  Telling a decimal separator from a grouping one is the hard part. Colour by
  rank, not amount - and where a colour is shared (more levels than five
  colours), its second chip wears the alternate edge inlay (`chipInlayAlt`), so
  no two neighbours are the same chip printed twice. The figure is fitted to the disc via `labelEms()`; `--fit` is
  0.68 of the disc, 0.60 with a code.
- **The choice icons carry a keyline, and the fills do not move** — four zero-blur
  `drop-shadow`s, **not** on the equals badge (`svg:not(.eq-icon)`).
- **The bet button deals, it does not reload.**
- **Colour lives in `styles/tokens.css`.** Two exemptions only: `table.css`
  (sampled measurements) and closed one-screen palettes. The exemption covers the
  palette, **not** the derivation — anything needing an alpha is an rgb triplet
  with the hex derived from it.
- **The accent rule is narrower than "one accent"**: one accent for anything
  *chosen*; a fixed identity colour per control that *opens* something. These are
  wayfinding, not drift — a pass collapsed all five and was rejected.
- **One ink ramp, warm.** `--ink-strong` / `--ink-body` / `--ink-dim`;
  `--ink-warm*` are aliases of the same three. The cool blue-grey ramp survived
  the panels being warmed and printed icy type on every popup for a month —
  the second Hallmark pass re-pointed it at parity of contrast (table in
  `tokens.css`). Nothing cool goes on a warm panel.
- **One panel material, as tokens.** `--panel-face` / `--panel-elevation` /
  `--panel-elevation-low` over `--panel`. Every panel — popups, the bar's pills
  and discs, the RG plate, the error dialog, the replay panel — reads those
  three; no sheet spells its own shadow. A single blurred blob is "a sticker,
  not an object" (`table.css`), and a uniform hairline all round is a box that
  was drawn rather than lit. **Lit, not haloed:** no coloured bloom around a
  coloured control, anywhere.
- **Controls are lines, gauges are fills.** A pressable glyph is stroked in
  `MarkIcon`'s voice (round caps, ~2.2 on a 24 grid); a glyph that is read
  (the bolt meter) is filled. The turbo bolt and the meter share a silhouette
  and differ by exactly this. The spin button's shapes are the stated
  exception.
- **A panel opened from the keyboard shows its own ring, not the browser's** —
  `.popup:focus-visible { outline: none }` plus the header's rule thickening in
  `--tint`. Chrome's default double ring around a whole dialog was live on all
  seven panels until a screenshot was pixel-sampled.
- **The system is written down in `web-sdk/apps/Ride-The-Bus/design.md`**
  (genre, material, ink, type, icons, CTA voice, motion, focus, what every panel
  shares). It carries no values — `tokens.css` does — so it cannot drift. Read
  it before any visual change; Hallmark reads it first.

### Money and the control bar — `references/currency-and-control-bar.md`

- **Money is fitted to its box, everywhere** — chips and the takeover amount
  estimate via `labelEms()`; the bar's three readouts measure with `use:fitValue`.
  **All three** need `max-width` (`.cb-bet-display` was the one missed), `.cb-val`
  needs `nowrap` and `max-width: 100%`, and the re-fit runs on a
  **MutationObserver** watching `characterData` + `childList`, never `attributes`.
  The floor is relative, never an absolute pixel count.
- **On a phone the light pill is ONE line** and takes a bar row of its own; a
  share of the row (`flex: 1 1 0`), not a reservation. Popout S opts out and must
  restate `.cb-balance`, `.cb-lastwin` and `.cb-readouts.solo`.
- **Replay hides the balance, and that is a different layout** — `.solo` pushes
  Last Win right; its 26-unit floor is cleared on phones. Under a replay's
  takeover the pill KEEPS its width with Last Win faded out in place; it used
  to collapse, which re-flowed the whole bar under the veil.
- **A payout multiplier prints through `formatMultiplier`** (`game/ui/`): one
  decimal, grouped like money. Payouts floor to 0.1, so ".20" was a false
  place, and it was three formats for one number. How to Play's per-guess
  PRICE keeps two decimals (not floored). `multiplier.test.ts` greps every
  component for a hand-built `×`.
- **High-denomination currencies are the stress case.** Worst three are TZS, UGX
  and XOF at 24 characters. 31 of 46 render as a bare code, so the two-line chip
  is the common path. COP is **not** a Stake currency.
- **The bet is locked while autoplay runs, and the control says so rather than
  going grey.** `setBetLevel` and `formatBetInput` check `betLockedReason()` too.
- **MODE is the bar's outer-edge control, mirroring Turbo** (owner's call,
  2026-09-26). The sliders button and its two-switch "Advanced" panel are gone;
  both switches live in the autoplay panel. **MODE is a destination sign**
  (2026-10-06, the owner's "too basic"): the live family's NAME lettered in its
  colour on a recessed dark sign, the seven bolts (`liveBolts`) under it, no
  coloured outline; it keeps its `.cb-icon` "toggle" press cue, and its
  locked-state tip is hosted on `.cb-mode-slot` and anchored to the slot's inner
  edge (it sits at the screen edge). FIXED width, paid for by the bet display,
  which carries money only now: 8.42 / 11.6 units on the one-row bar (6.2 / 13.82
  before), 8.4 on phones at a 36px-or-5-unit height, and 9.4 with a thinner
  frame at 400px and under, where the hidden stepper gives its width back (F-11:
  at 7.4, eleven names in six languages fitted under the 9px phone floor); the
  name fits into it (`fitBlock`, two lines then smaller), never the sign to the
  name - so a wider sign is how a name is kept legible, not a wider name; Popout S drops
  the bolts. A family change ROLLS the name ({#key} + a transition, a crossfade
  under reduced motion). Out of the light pill, so Balance and Last Win got its
  width. **Row two of the phone bar is budgeted for every pointer** (tighter
  gaps and side margin, the bet figure's trimmed reservation, a narrower MODE,
  all in the 620px block and all restored for Popout S): with only the touch
  trim, a narrow mouse window and Russian at 401-408px put MODE on a third row.
  Swept every 4px from 320 to 620 in all 17 languages; `autoplayLimits.test.ts`
  pins the rules.
- **Autoplay only ever STOPS; it never changes the stake.** Its stops: a full
  game win, a loss limit, a single-win limit. The two limits are **typed**, each
  with a unit switch inside its field - **x, times the BASE bet** (the unit of
  every other "your bet" in the game, the multiplier the takeover prints, and
  what the Stake SDK multiplies), or **the player's currency**, by its real
  symbol (never a hardcoded $: social mode's SC/GC print their codes) - and an
  arm button to the field's right that stays pressed while armed. A field that
  does not parse is no limit, never zero (`autoplayLimits.ts`; decimal commas and
  lakh grouping accepted). Counting x in the round's COST was tried first and
  was the two-units bug on Three of a Kind. The two switches sit one above the
  other, directly above the panel's action. The panel stays openable DURING a run (count
  locked, Stop offered), because the stops live there. The DEV-only martingale that used to sit behind
  `ADVANCED_ENABLED` was deleted, and `autoplayLimits.test.ts` fails if bet
  progression comes back.
- **The table die fills the four picks; only the deal buys them** (owner's
  call, 2026-10-01, chosen over a published random-picks mode).
  `game/bet/dicePicks.ts` draws one of the 64 published combinations evenly,
  never the one already on the board (so never Equal-then-Inside), and
  `setAllGuesses` assigns it on the CLICK - the setters toggle, and a deal
  pressed mid-tumble buys what the squares show. `TableDie.svelte` lives
  inside `.choice-row`, so the row's lock and the takeover's dimming are its
  own, and `choicesLocked()` refuses a keyboard roll; no die on Three of a
  Kind. Physical `left`, never logical: the props do not mirror in Arabic,
  and a mirrored die lands on the bottom-left chips. Drawn by `DieFace`
  through `game/ui/dieGeometry.ts`, on table.css's `--flat` / `--upright`.
  It sounds its own roll (`playDiceRoll`, knocks on `DIE_LANDINGS`) and
  `pressCues`' `OWN_CUE` keeps the press cue off it. `dicePicks.test.ts`.
- **Space always deals** (owner's call, 2026-10-02). `spaceIsForUs` yields it
  only to a field being typed in; a focused guess square, the die or a bar
  button no longer takes it as its own activation key (a mouse click focuses
  a button, so "pick, then Space" toggled the pick off), and onKeyUp takes the
  keyup of a press it handled, which is when a button would fire. An open
  panel (`chromeInert`), the intro and the takeover still keep Space.
  `launchGuards.test.ts` / `dicePicks.test.ts`.
- **The ticket stack is on Last Stop's table only** (`TableScene`'s
  `showTickets`, owner's call 2026-10-02): elsewhere it offered a multiplier
  that could not be won. The cup it replaced stays gone.
- **Keys 1-4 step the four guesses** (`game/bet/guessKeys.ts`), through the
  board's own setters, gated beside the spacebar in `ControlBar.svelte` - never
  under the intro, a panel or the takeover, never onto Inside after an Equal,
  never clearing a pick. Not gated on `disabledSpacebar`: a digit buys nothing.
- **The +/- buttons ARE grey at the ends of the ladder.** `nextBetLevel()` is
  what a press lands on and what `canStepBet()` disables on, so the two cannot
  disagree; a + with no level above it used to look pressable and do nothing.
- **A typed bet clamps DOWN to the maximum and never UP to the minimum**, and the
  step snap is guarded — anything under one step would floor to zero.
- **One reason per failure, not one boolean** (`betBlockedReason()`), with
  affordability checked BEFORE the range.
- **A round in flight locks the bet and the mode, not just the guesses** —
  `roundInProgress()`, plus an `$effect` that closes an open bet/mode panel.
- **The card slot is pinned to the card's width**, not to the multiplier chip.
- Local dev supplies `minBet`/`maxBet`/`stepBet`; without them every helper in
  `betLimits.ts` correctly reads `{0,0,0}` as *unconstrained*.

### Type, glyphs and assets — `references/typography-and-assets.md`

- **A `<button>` does not inherit `font-family`.** A global reset in `app.css`,
  **family only**. Invisible in source; check the computed style of a live page.
- **The logo is WebP with the PNG as a real fallback, chosen in JS not CSS** —
  `image-set()` with `type()` fails on Safari 14–16, and a `canvas.toDataURL`
  probe is wrong for exactly those browsers.
- **Glyphs are drawn when, and only when, the font does not own them.** Card
  ranks are ASCII and deliberately NOT drawn; every suit mark is ONE drawing,
  `game/ui/suitPaths.ts`, which `SuitIcon` and the card pips both read.
- **Every dealt card wears one face: `components/cards/CardFace.svelte`** - the
  board's four and the takeover's fan (the intro's and How to Play's minis are
  glyph tokens, not faces). A casino deck's layout in a 200 x 298 SVG
  (`game/ui/cardFaceLayout.ts`): 2-10 in pips on the standard grid with the
  lower half inverted, the Ace of Spades as the house card, the English-pattern
  courts. **One colour family per card** - red/maroon/rose or ink/slate/stone,
  plus gold and paper - because card 1's guess is Red or Black; `cardFace.test.ts`
  fails if a card mixes them or the sprite paints a literal colour. **Below 46px
  on screen a number card goes compact** (one pip, larger index), measured by
  `bind:clientWidth`, not a container query (iOS 16+). **In Arabic the face
  mirrors and its text is turned back** (`rtl.test.ts`).
- **The court figures are `static/cards/courts.svg`, generated, never
  hand-edited.** `node scripts/court-art.mjs` rebuilds it from the CC0 masters in
  `art-masters/courts/` (Dmitry Fomin, Wikimedia Commons; provenance, SHA-1s and
  the rejected GPL/LGPL sources in its README) and fails if a rebuilt court
  strays from its master. Fetched at start like the music bed, never imported
  (`courtArt.svelte.ts`); until it lands a court draws its frame and pips round a
  large rank letter.
- **The lobby tile is photographed from the game, never painted.**
  `node scripts/tile-art.mjs` (game + replay RGS running) writes
  `submission/RideTheBus-FG.png` from `?dev_tile=fg` (`components/dev/DevTile.svelte`:
  the real J Q K and house A, the deck's back, two chips, on a transparent
  ground) and `-BG.jpg` from the live table with the board hidden, and refuses a
  pair over Stake's 3 MB. The cups are left off unless `--cups`. The generated
  pair it replaced (a mangled Jack, a droplet spade, a backyard party) is in git
  history.
- **The body face is Overpass (variable, one file per subset; Geist until
  2026-10-05, the owner's pick from a compare sheet), and its metrics are
  measured, never guessed.** It ships `tnum`, so every `tabular-nums` in
  the app is live (they were inert for the whole life of Poppins).
  `typeFit.ts`'s width table, `displayFace.ts`'s `unicode-range` transcription
  and the currency ranking test are all measured off the shipped woff2 files
  with fontTools; changing the face means re-measuring all three, and the
  tests fail if the `@font-face` ranges and the transcription drift apart.
  Known costs — no won or dong glyph; the 2025-default look — are in
  `design.md`.

### Audio and jurisdiction — `references/audio-and-jurisdiction.md`

- **Every cue is synthesised; the music bed is one produced file.** One
  `AudioContext`, one bus chain with a limiter, one generated room. Muting
  returns before anything is scheduled. `volume` and `muted` stay separate
  fields.
- **The bed is fetched from `static/`, never imported, and its URL is injected.**
  `bundleStrategy: "inline"` would base64 an imported asset into `index.html`;
  `${base}` needs `$app/paths`, which no node test can import. So `bedAsset.ts`
  owns the URL and `Game.svelte` hands it to `music.setBed`. The loader
  downloads nothing for a muted player and falls back to no music on any
  failure.
- **The manifest is a manifest, and it holds ONE row.** `musicTracks.ts` maps ids
  onto the files in `static/music/`; `ACTIVE_TRACK_ID` is the one line that
  switches tracks and `?dev_music=<id>` auditions one without a restart. `trim`
  level-matches them so switching does not change how loud the game is. **Every
  file in `static/music/` ships** — `static/` is copied wholesale — and every one
  needs a row in `ASSET_LICENCES.md`; `musicTracks.test.ts` enforces both.
  **The track there is PAID-TIER Suno output, generated 2026-09-02 on v5.5 and
  cleared to ship** — so MP3s are tracked normally now and `git add -f` is no
  longer needed. Only `*.wav` stays ignored, because masters belong in the
  repo-root `audio-masters/`, outside the app. A clone still runs on its cues
  alone if the audio is absent, which the loader handles by design.
  **The ten-candidate audition state is over.** `jazz-lounge-a1` (`A.mp3`) was
  chosen by ear on 2026-09-06; the other nine are **benched in `audio-masters/`**
  as MP3s beside their WAV masters — equally licensed, out of the build — and the
  directory ceiling in `musicTracks.test.ts` is back to **9 MB** from 56 MB.
  Their measured loop regions live in the `rtb-invariants` audio reference and
  their provenance rows in a "Benched" table in `ASSET_LICENCES.md`, so
  re-auditioning one is a file copy plus one manifest entry. **Copy it back OUT
  of `static/music/` before staging.**
- **The loop is overlapping passes, not `src.loop = true`.** A produced track
  ends on a fade to silence, so a hard wrap plays that decay into a cold entry
  forever. Each pass is its own source started `span − crossfade` after the last;
  the seams are **equal-power** curves (two uncorrelated bars sum as powers, so a
  linear pair dips 3 dB) while the arrival fade stays linear. `loopStart`/
  `loopEnd` trim the outro off. `?dev_loop=<start>,<end>,<crossfade>` shortens the
  region, because the shipping loop wraps every 154s and a capture that long is
  not a practical way to look at a seam.
- **The bed plays on the loading and start screens**, which needs `primeAudio`:
  the cue book was the only thing that ever opened an `AudioContext`, and those
  two screens have nothing to press, so they set a scene that could never sound.
  It opens the graph immediately where autoplay is permitted (an
  `allow="autoplay"` iframe, a trusted returning player) and otherwise on the
  first gesture anywhere — capture phase, so the music starts on the same tap
  rather than one interaction later. Permission is **asked**, not assumed:
  `getAutoplayPolicy`, then `userActivation`, then a throwaway context that is closed
  either way — measured through CDP with `Log.enable` to confirm a constructed and
  closed context logs nothing. A cold load in a strict embed is still silent
  until the first touch; that is a browser rule.
- **The scene ladder is a DIP, not a climb.** Six scenes, one file, so level
  and tone are all a scene can change: loudest at `idle`, ducked for `round`
  (the busiest the cue book gets), further for `hold` (a held last card, under
  the cue book's rising hum, until the round settles) - where the bed's lowpass
  also closes to 700 Hz, so the band plays on as if through a wall - and
  hardest and fastest for `celebration` — the bed and the fanfares share one
  limiter, so a bed sitting on top of a win would duck the win. The fade time
  belongs to the **destination**, which makes ducks fast and recoveries slow
  for free, and the filter rides the same fade. A celebration outranks a round
  in the derivation, because the round is still in flight underneath the
  takeover.
- **The last card is held only on a round with an Equal pick**
  (`lastCardHolds`, from the choices the book was bet on - never the result).
  Every clean run to the last card used to be held, about 1 round in 7 on the
  easy picks, three in four of them missing: the moment wore thin. Now one
  Equal on Classic / High Stakes holds ~1 in 33 rounds, two ~1 in 835, no Equal
  never, Second Chance with an Equal ~1 in 11-15 (a forgiven Equal miss still
  reaches card 4 with a Big stake), Three of a Kind (its two Equals are the
  mode) 1 in 3.7. The owner's call, 2026-09-25.
- **The last card's hum is the one HELD voice** (`swell()` in `audioVoices.ts`,
  `playLastCardHold` in `sound.ts`): it hands back a release, and the reveal
  calls it as the card turns however the wait ended - on time, slammed or cut
  by turbo. Its shape is the owner's, after five listens: **up linearly, stay
  at the top, then a crash** - a crowd's "ohhhh" (detuned sawtooths through
  "oh" formants, with breath), a lightning strike on the turn - and the card
  rises, sits and slams on the same clock (`holdClimbMs`), under a tunnel-vision
  vignette - only when it could land Huge or bigger (`lastCardTunnels`) - that
  **rises with the card** (one `--hold-rise` for both) and stops at the play
  area, so the control bar stays lit. **It is tuned and scaled**: the climb
  tops out two octaves under the chime the card plays if it lands
  (`stageWinRoot`), and the tier it could land (`lastCardTier`) sizes it - a
  few voices and a crack for Big, the crowd and a two-band thunder above, the
  sub hit on Max (`HOLD_SHAPE`), so the strike never outshouts its fanfare.
  A crowd answering the card after the turn (a cheer, an "awww") was built and
  taken out the same day, by the owner's call - `sound.test.ts` fails if it
  comes back. A short haptic buzz rides the strike (only after a tap, never
  with game sounds off). The release rides a
  gain stage of its own, never the swell's envelope; `sound.test.ts` fails if
  the shape, the vowel, the tuning, the scaling or the strike drifts, or the
  release moves after the flip.
- **The board never moves under the player.** The card row, the readout and
  the guess row hold their positions through picks, deals, holds and settles
  (0.0 px, measured every frame across a session at three sizes). The
  readout's third line is what used to break it: its empty state is a
  NON-BREAKING space, written as `'\u00a0'`, plus `min-height: 1lh` - a plain
  space collapses the line, and a rewrite once did exactly that, so the board
  jumped at the fourth pick and at every settle. `boardStill.test.ts` pins both.
- **The deal lands ON the pile, rests, and a slam finishes it** (2026-10-01).
  Each card - and Last Stop's ticket - is fitted to the prop it goes back to
  (centre, angle, foreshortened size, measured off the prop: a fixed scale
  hovered over the deck at some sizes), fades into it, rests `DEAL_REST_MS`
  out of sight and is dealt back; the reveal holds card 1 back by the same
  beat. Every piece is measured AT REST - the running transform taken out,
  the ticket slot's own `rotate` turned back - because a deal measured mid-
  flight sent cards across the board under fast slams. A slam `finish()`es
  the deal, and the bus rides on `--flip-dur`, so nothing is left travelling.
  No idle "Pays up to" line: removed by the owner's call the same day.
- **Card backs and the deck carry the house name, not the logo** - "TAKEOVER /
  CASINO" in the body face at 400, 58% white on a plain label of the card's own red with
  a faint hairline edge (set straight on the back, the crosshatch ran through
  the letters), one token set (`--brand-wordmark*`) for the board's backs, the
  deck prop, the loader's cards and the takeover's fan. On the deck it takes the
  deck's own shade (`--deck-dim`, as a brightness) and its flat-on-the-table
  squash (`--flat`) - a label is content, so the scrim in the face's background
  never reached it. The
  full-colour chip was five copies on the board before the first deal and the
  loudest thing on the table; it still leads the loader and the start screen.
- **No odds line on the board, by the owner's call (2026-09-25).** Two were
  tried: "Needs 8-K · 24 of 51" before each card, and "Full ride: 1 in 28"
  before a round; both are gone. If a frequency is ever shown again it must be
  the published tables' weighted one, NEVER the deck's count - the reweight
  deals paying rounds up to a third more often than the deck on the Inside
  modes. A LUT's simulation number indexes `library/deals_standard52.bin`
  (checked on every row of all 192 four-guess tables), so it can be counted
  exactly from a build; status.md has the method.
- **The jurisdiction block is the operator's, and every read must survive it
  being absent.** Every read goes through `readFlag`, and **the fallback is
  always the permissive value**. Social mode is read from BOTH `?social=true`
  and the block's `socialCasino`.

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

## Where the client's logic lives

`Game.svelte` was 3,789 lines — 2,738 of `<script>` — and held the popups, the
round lifecycle, autoplay, the takeover handoff, bet formatting, audio wiring
and dev-only URL seeding in one file. After four passes it is **709 lines**
(563 script, 136 markup): the layout root, the intro phases, the popup
switchboard, the audio wiring, the balance poll, and the effects that can only
live in a component.

### The directory layout

`src/game/` was 80 files and 14,687 lines in one flat directory. It is now nine
folders and three files:

```
src/game/
  audio/  round/  bet/  math/  celebration/
  ui/  dev/  jurisdiction/  platform/
  tests/              rtl.test.ts, sources.test.ts
  sources.testlib.ts
```

**Every `*.test.ts` lives in a `tests/` folder beside the code it covers** —
`game/audio/tests/`, `game/math/tests/`, `i18n/messagesMap/tests/`, and so on.
`npm run test` is `node --test "src/**/*.test.ts"`, a recursive glob, so the
depth does not matter to the runner. `sources.testlib.ts` is NOT a test and
stays at `game/` root: it is the manifest the grep tests read.

**A test that moves takes its path strings with it, and they are the half no
compiler checks.** Moving these 22 files broke ten anchors — `read()` bases,
`import.meta.dirname` constants, a `readdirSync` of the catalogue directory,
and both template-literal paths again. Two are worth naming:

- **`rtl.test.ts`'s `SRC` anchor.** It was `resolve(import.meta.dirname, '..')`,
  which meant `src/` at the old depth and `src/game/` at the new one. Prefixing
  every path with `../` would also have "worked" and left a constant named `SRC`
  pointing at `src/game`. It is `'../..'` now, and the paths are bare.
- **`sound.test.ts`'s `reload()` cache-bust**, which had to become
  `` `../audioMixer.ts?${tag}` ``. Re-proved the way it was proved originally:
  `DEFAULT_VOLUME` sabotaged to 0, four tests fail, restore. A cache-bust that
  names the wrong module does not error - it passes while testing nothing.

`platform/` holds the twelve files that match the Stake template's own `game/`
shape — `config`, `constants`, `context`, `eventEmitter`, the four `state*`, the
three `types*`, `ready`. **Every sibling sample game (`cluster`, `lines`,
`number-picker`, `price`, `scatter`, `ways`) keeps those at `game/` root and we
no longer do**, so a future template update will not line up by path. That was a
deliberate trade for a readable root; the twelve are still together and still
named exactly as the template names them.

The three files left at the root are there because they are *about* the others:
the manifest, its check, and the one grep test that predates the manifest.

`styles/` and `components/` are grouped the same way — `popups/ board/ intro/
scene/` and `popups/ board/ intro/ icons/`, with `tokens.css`, `base.css`,
`responsive.css` and `Game.svelte` staying at their roots.

**Three things broke that no import rewrite could see, and all three were
found by running something rather than by reading:**

- **`scripts/mode-ceilings.js` WRITES `modeCeilings.ts`.** Moving the file
  without repointing the generator would have left the next math build
  regenerating it at the old path, with the moved copy silently going stale.
  It is money-adjacent data. Same class as `replay-server.mjs`, which READS
  `musicTracks.ts` and `currencies.ts` and answers `[]` when the path is wrong —
  an empty music picker and no error.
- **Paths built as template literals.** `sound.test.ts` read ten stylesheets as
  `` `../styles/${name}.css` `` from a list of bare names, and `payoutTable.test.ts`
  imported catalogues as `` `../i18n/messagesMap/${locale}.ts` ``. No literal-matching
  pass resolves either. Both now carry their folder.
- **Comments naming a file by path.** 24 of them pointed at paths that no longer
  existed. A comment that names the wrong file is worse than no comment: it
  sends the next reader somewhere real-looking and empty.

**Rune modules use one `$state` object, not exported `let`s.** An exported `let`
cannot be reassigned across a module boundary, so each of these exports a single
object — `round.bustedIndex`, `bet.family`, `auto.running`. That is the shape
`ready.svelte.ts` and `jurisdiction.svelte.ts` already used.

The dependencies are a **DAG, deliberately**:

```
betState ─┐
revealPacing ─┤
autoplaySettings ─┼─→ roundPlace ─→ roundReveal ─→ roundSettle
roundState ─┤          └─→ autoplayLoop
celebrationState ─┘
```

**A round reads as three files, in that order.** The seams are exact: nothing
crosses from the reveal into the settle (it reads `round.*` off state, never the
loop's locals), and cutting anywhere else would have made a cycle —
`startGameEngineFlow` needs `animateRoundFromEvents`, and the gate wraps
`playRound`.

| File | Owns |
|---|---|
| `game/round/roundState.svelte.ts` | the round's facts — what was dealt, what it paid, the session tallies, `roundInProgress()`, `resetForNewRound()` |
| `game/bet/betState.svelte.ts` | what is being BET: the amount, the family, the four guesses, and every helper that reads or writes them |
| `game/round/revealPacing.svelte.ts` | the turbo scale, the slam flag, and the reveal's own interruptible pause |
| `game/round/autoplaySettings.svelte.ts` | what a run is configured to do — settings only |
| `game/celebration/celebrationState.svelte.ts` | the takeover on screen, and the promise the round awaits |
| `game/audio/soundSettings.svelte.ts` | the mixer mirror the sound panel writes through |
| `game/round/roundPlace.svelte.ts` | buy a round: the defensive end-round, the mode slug, `/wallet/play`, the single-flight gate and the regulator's floor |
| `game/round/roundReveal.svelte.ts` | turn the book into four cards on screen, with their cues |
| `game/round/roundSettle.svelte.ts` | the payout, `end-round`, the credit, Last Win, the tier decision |
| `game/round/roundRestore.svelte.ts` | put a round that already exists back on the board — replay, and resume |
| `game/round/autoplayLoop.svelte.ts` | the loop that repeats it |
| `game/dev/devSession.ts` | DEV: the URL standing in for `/wallet/authenticate` |
| `game/ui/fitValue.ts`, `ui/pressCues.ts`, `bet/betFieldFont.ts`, `bet/currencySymbol.ts` | four leaves that close over nothing |

### The board and the bar are components too

`components/ControlBar.svelte` (the `<footer>`, the spin button and the spacebar
that presses it), `components/GameBoard.svelte` (four cards, the running-win
bar, the guess squares) and `components/SessionReadouts.svelte` (the
jurisdiction-gated RG panel). `Game.svelte` keeps the layout root, the
`<main class="play-area">` wrapper, the popup switchboard and the intro phases.

This was ruled out once and became possible only after the state moved into
modules: the bar needed **13 component-local names and 11 moved with it**, so
what looked like a forty-prop interface is `openPopup` (bindable), `betRowEl`
and `introPhase`. `GameBoard` takes **none**. The eight icon snippets split
5 board / 3 bar with **zero overlap**, so nothing had to be duplicated.

`choicesLocked()` went to `roundState` — both the bar and the board ask it.

**`.cb-cap` and `.cb-val` are in `styles/readout.css`, not the bar's sheet.**
`base.css` had `.rg-item .cb-val`: the RG panel renders the same caption/figure
pair, so moving `control-bar.css` wholesale would have left it unstyled — and
`currencies.test.ts` would have kept passing, because it asserts on the *rule*,
not on who renders it. One definition, two importers; a copy was rejected
because these carry the money-fitting contract `use:fitValue` depends on.
Verified by reading computed styles off both panels in a browser: identical.

`responsive.css` (326) split **16 bar / 8 board / 3 root, zero unassignable**,
and `base.css`'s `.rg-*` rules went to `styles/session-readouts.css`.

### The second pass: the four files that were biggest after Game.svelte

`Game.svelte` stopped being the ceiling, so the next four went the same way.

**`audioGraph.ts` (1,197) → five modules**, on the DAG its own sections already
implied. `ensureContext` reaches IN to set `buses.<name>.gain` and `applyGain`
reads it back, so context → mixer and nothing returns:

```
audioVariation (pure, imports nothing)
audioMixer ──→ audioContext ──→ audioVoices ──→ audioLoop
```

| File | Owns |
|---|---|
| `game/audio/audioMixer.ts` | what the player has set: two buses, levels, mutes, `localStorage` |
| `game/audio/audioContext.ts` | the one graph — `ctx`/`master`/the two sends, `ensureContext`, autoplay permission, `primeAudio`, `decode`. **The whole-graph argument lives at the top of this file.** |
| `game/audio/audioVariation.ts` | `rand` / `drift` / `shuffler` — the randomness every cue borrows |
| `game/audio/audioVoices.ts` | `tone` / `noise` / `thud`, and `openVoice`, the gate they pass through |
| `game/audio/audioLoop.ts` | the bed's overlapping passes and their equal-power seams |

**There is no barrel, deliberately** — a module that re-exported all five would
hide which one owns what. And the reason matters beyond taste:
`sound.test.ts`'s `reload(tag)` cache-busts a module to re-run `loadBus()` over
empty storage, five times, because *"every player installing the game got
silence"* once. **A query string only busts the module it names**, so pointed at
a barrel Node would serve the cached mixer, `loadBus()` would never re-run, and
all five would pass while testing nothing. `reload` names `audioMixer.ts`
directly. Verified by sabotaging `DEFAULT_VOLUME` to 0 and watching four tests
fail.

**`StartScreen.svelte` (484) → three files.** It was two unrelated screens
sharing a file, and they shared *nothing* but the phase that chose between them
— not a snippet, not a helper, not a prop. `IntroPanels.svelte`,
`ReplayDetails.svelte`, and `game/introDemo.ts` for the worked examples'
lookup tables. `start-screen.css` (1,178) split with them into
`start-screen-shell.css` / `intro-panels.css` / `replay-details.css`; the
`@keyframes` were placed by which sheet references them, two of the three into
more than one.

That split also surfaced masked dead CSS, the same way the popup split did:
`.ss-popup-close` and `.ss-detail-mode` are rendered by nothing at `HEAD`, and
`choices.css`'s board-only wrappers (`.choice-row`, `.choice-column`,
`.choice-label`, `.choice-tip`) are now `choices-board.css` — the reason
`choice-unavailable.css` already gives, one step further along. **`.choice-square`
stays in `choices.css`: the intro renders it.**

**A round is three files: `roundPlace` → `roundReveal` → `roundSettle`.**
`roundFlow.svelte.ts` no longer exists; it was 524 lines carrying all three.
`settleRound()` came out first — `playRevealSequence` was 200 lines
with an exact seam: the reveal animates, then the round settles. Nothing crosses
it — the settle half reads `round.bustedIndex` / `round.forgivenIndex` off state,
never the loop's `running` / `busted` / `forgivenessSpent` — so `settleRound()`
takes no arguments. `engineRound` and `isEngineRound` moved to `roundState`,
where they break the cycle and where `isEngineRound()` belongs anyway: it is a
function of `round.source`.

**`WinCelebration.svelte` (603 script → 413).** `game/celebrationScene.ts` (the
`BURST` and `FAN` geometry, pure) and `game/celebrationGestures.ts` (`pop`,
`easePop`, `hopFan`, `reducedMotion`). The geometry being a plain module means
`winCelebration.test.ts` now **imports and asserts on it** — the fan's symmetry,
its centre falling between cards, the outer pair riding lower, the burst's suit
spread — instead of grepping the component for `length: 4 }`.

**The count-up state machine deliberately stayed in the component.**
`<WinCelebration>` is `{#key}`'d so it remounts per celebration; its state
cannot be a module-level `$state` singleton the way `roundState` and `betState`
are, and behind a factory it needs about six callbacks injected, which reads
worse than the 200 lines do. Its pure half is already `countUpSegments` in
`winTiers.ts`.

**`sound.ts` (751) is deliberately NOT split.** It is a flat catalogue of 18
independent cues in one object. Splitting a catalogue means looking in more
places to find one cue, and every change costs an `npm run audio` pass. Size
there is not complexity.

**Autoplay is split in two on purpose.** `startAuto` calls the round flow, and
the round flow reads `auto.running` / `stops.onFullWin` back out. In one module
that is a cycle; with the settings on their own it is a DAG.

**`$effect` only runs inside a component, so the effects stay in `Game.svelte`** —
including the replay effect and the resume effect, which are also the two places
that must apply `parsed.family` when restoring a mode from a slug. Keeping them
side by side is what lets `modes.test.ts` check there are exactly two.

**`bet` means betState's bet. The RGS resume payload is `resume`.** All three
restore blocks used to call it `bet`; once the bet state became an object of
that name, `bet.family = parsed.family` assigned to the *payload* and the family
was silently never restored — the third near-miss on the invariant that has
shipped broken twice. `modes.test.ts` now fails on any local `bet` declaration.

### Each popup is its own component, with its own stylesheet

`components/popups/` — `ModePopup`, `BetPopup`, `TurboPopup`, `SoundPopup`,
`AutospinPopup`, `AdvancedPopup`. The `{#if openPopup === 'x'}` switchboard
stays in `Game.svelte`; which panel is open is the component's own state.

`popups.css` (1,032 lines) became **`styles/popup-<panel>.css`**, plus
`popup-backdrop.css` for the one dimmer the parent renders. That split is
**required, not tidiness**: svelte-check reports an unused selector as a
WARNING, and `check:svelte` must come back at zero — so a rule in a sheet whose
importing component does not render it is a build failure. There is no shared
sheet for the same reason; `.action-button` and `.popup-sub` are *copied* into
the panels that use them.

- **A rule's home is decided by the markup, not by eye.** A grouped selector
  spanning panels is split per selector rather than duplicated whole.
- **`iconInfinity` / `iconPlus` / `iconMinus` are duplicated into
  `AutospinPopup`**, six lines of SVG each. That is what lets the sizing travel
  with the markup — the bar's copies sized by `control-bar.css`, the panel's by
  `popup-autospin.css` — and it retires the import-order hazard the old
  `popups.css` complained about, because the two are now different scopes.
- **`.cb-val-multiplied` is copied into `popup-bet.css`.** It lives in
  `control-bar.css`, which `BetPopup` does not import, so the chip lost it
  silently. Both copies must keep saying the same thing.

### The grep tests read a manifest, not a path

Eight test files assert on the game's source as TEXT, because what each guards
fails *silently* — a forgiven card that sounds like a bust, a mode restored
without its family, a class renamed out from under `pressKindFor`. They now read
**`game/sources.testlib.ts`**, which lists every file the component was split
into and concatenates them, so counting assertions still count and negative ones
still mean "nowhere".

**When a split moves code out of a listed file, add the new file to that
manifest in the same commit.** There is no glob and no `existsSync` filter: a
listed path must exist, which `sources.test.ts` checks, because a filter would
turn a typo into a grep test that quietly stopped looking at anything.

---

## Client conventions worth knowing

- **Svelte scoping bites child components.** A stylesheet is scoped to the
  component that imports it, and a child's elements never carry the parent's
  scope class — so a `.bolt` rule in the parent's stylesheet compiles to
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
Popout S is Popout L at exactly half size, and is laid out that way. **Type is
the one exception**: it stops at `--type-floor` (6px) / `--type-floor-figure`
(9px) in `tokens.css`, as `max(own calc, floor)`, because at half size the
balance printed at 5.9px and the bar's captions at 3.4px. The floor binds on
Popout S alone, and `fitValue` can still shrink a figure below it. A panel
takes the floor as one unit instead - `--ui-bar` itself floors at 6px there
(`popup-base.css`), so the whole panel scales up and scrolls under its header.

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

## Current state and outstanding work

**2026-10-09: the uploaded build is front v74 + math v13** (v74 = `f6369ae4`
plus the F-11 fix, built 2026-10-09 03:03; its live `index.html` hashes
identical to `build/`, sha256 `683db6d8...`). `RGS_TEST_PLAN.md` holds 132
checks, **124 ticked**. Of the eight open, five need the owner's hardware or
judgement (CMP-12, CMP-14, DEV-04, DEV-05, PRF-03 - DEV-05, PRF-03 and CMP-12
have SIMULATED evidence on record) and CMP-18 a real screen reader; SES-03 waits
for a genuine session lapse; DEV-11 waits on the owner's call (Three of a Kind's
bar is 2-7px taller on Popout S, unchanged by v74). DEV-12 failed on v73 on F-11
(the MODE sign's `fitBlock` shrank Finnish and Russian family names to
6.3-8.8px on phones) and PASSES on v74's bytes - measured LOCALLY, not on Stake:
every name 9px or more in ten languages. On v74 the live smoke set passed
(SES-01/02/06/08, PRF-04, REG-02). **The live checks are one command:** `npm run
rgs -- --front N --math N` (`scripts/rgs-live/`, 130 of 132 checks, a live
dashboard on :8766) - read its README before a run. **Run only what needs
Stake** (the owner's rule, 2026-10-09): the live RGS refused this machine at 12
page loads in about five minutes that day, even after 9.5 hours of silence, and
refuses for growing periods (5, 12, 35+ minutes); every demo session of one
Studio account shares ONE open round. A check that only measures layout runs on
the local `build/` instead - `npm run rgs:local -- --front N` (DEV-11, DEV-12,
CUR-04; :8767; zero RGS calls), recorded as **Local - NOT run on Stake**. The method,
its scripts and its pitfalls are the `rtb-live-audit` skill. 975 tests pass; 0
type errors, 0 CSS warnings, lint clean. Last Stop's volatility tie with High Stakes (three near-ties) was
accepted by the owner on 2026-10-05; `volatility.test.ts` allows a 5% sampled
tolerance on that one pair. The ticket cue was measured with `npm run audio`
(no clipping, adds no level; its parts sit at about a third of a card chime -
a listen is the owner's). Everything through 2026-10-09 is committed
and on `main` (PR #2 merged the branch; the v74 work went straight onto it).

**What changed in the client on 2026-10-05/06** (each rule has its own note in
the code; the test that pins it is named):

- **Fonts are same-origin FILES** in `static/fonts/`, declared in `app.html` via
  `%sveltekit.assets%`. The Stake CDN sends `font-src 'self'
  https://fonts.gstatic.com`, which blocked every `data:` font the build used to
  inline (F-5) - the live game drew in system fonts. `displayFace.test.ts` fails
  on any `@font-face` in a stylesheet or a font path that is not a file.
- **The error dialog is the top layer** (`--z-error`, above the loader and the
  intro, F-4). A launch failure (authenticate or the replay fetch) offers Reload;
  ERR_IS / ERR_ATE offer Reload; a failure it cannot name offers Reload beside
  Close (a forged session gets a bare `400 Bad Request`); a recognised code shows
  its translated sentence and the code, never the RGS's English statusMessage.
  `errorModal.test.ts`.
- **Money is exact everywhere**: `displayFractionDigits` widens past the
  currency's places until the amount is exact (to 6), so $0.017 never reads
  $0.02; the takeover counts in the final amount's own places (F-2/8/9).
- **Three restore paths, not two**: replay, resume and REMEMBERED PICKS
  (`rememberedPicks.ts`: the family and four picks under `ride-the-bus:picks`,
  never the amount, never in a replay, a resume wins). `modes.test.ts` counts
  three blocks that apply `parsed.family`.
- **Recent rounds** open from Last Win (a button except in replay):
  `HistoryPopup.svelte`, ten rounds, session-only, snapshotted at settle.
- **The result words**: Full game win / Won (a forgiven ride that finished) /
  Kept (a bust that kept a share - no percentage, it would not add up after the
  decay and the floor) / Busted. A missed card's chip is neutral ink; a bust that
  kept nothing shows no chip; Three of a Kind's live total is "At stake" (social
  "In play"). Screen readers get `aria-pressed` picks, named cards and the bust
  card in the announcement. `announce.test.ts`.
- **The count-up starts at the board's last figure** (`countUpSegments`'
  `startMultiplier`) and its progress is clamped - the live build opened on
  "-$0.00001". A leg whose ceiling the board had already passed is DROPPED, so
  the count opens on the board's figure under that figure's tier: v72 kept those
  legs as holds and opened a max win on "Big Win $40.00" over a $430.10 board
  (after v72, not uploaded; `winTiers.test.ts`).
- **The board and the bar are inert behind the loader, the intro and Round
  details** (`behindIntro`): Tab went from Continue onto the board's Black square
  under the intro (after v72, not uploaded; `launchGuards.test.ts`).
- **Three of a Kind's "$1.00 x 250" line is floored** like every other line of
  the bar - it printed at 3.3px on Popout S and 5.6px on a 320px phone (after
  v72, not uploaded). It still makes that family's bar 6px taller on Popout S and
  2.6px on Mobile S - open for the owner (DEV-11).
- **Owner's calls, 2026-10-06** (memory: feedback_deal_button_equal_seam): the
  deal button stays the blue disc with no caption; the Equal "=" stays on the
  seam at every size; picking a guess dims nothing.
- Also: phones floor type at 9 / 11 px (`--type-floor`, portrait <= 620px);
  desktop bar captions >= 10px; the guess palette is "Felt & brass" (palette A);
  prompts say Click with a mouse and Tap on touch (`pointerWords.ts`); Second
  Chance's How to Play says forgiven rounds price later cards as on Classic
  (`payoutTable.test.ts`); the intro's demo squares are out of the Tab order;
  `/index.html` launch URLs are rerouted (`hooks.ts`); `npm run build` prunes
  unreferenced files (`scripts/prune-build.mjs`).

Before Last Stop: 861/861 tests (none skipped), 0 type errors, 0 CSS warnings, lint clean, and
the client reproduces the published books of all **193** modes exactly — the
parity test replays a 400-book slice of every mode off `index.json`, three-card
trips books included. The build on disk is the **2026-09-22 02:30** one: High
Stakes at 15% (ceiling 2237.3×, wincap 2300), Three of a Kind as
`tr_any_equal_equal` (three cards, 250×, 4,583.3×), and `modeCeilings.ts` is
what its generator wrote. `library/build_rules.json` records the family rules a
build was made with, so a client whose `FAMILY_RULES` have moved since reads it
as **stale** - the parity tests skip and say what differs - rather than as
hundreds of failed assertions about arithmetic that did not change. It is **NOT
committed** — `math-sdk/.gitignore` line 9 is `**/library/**`, so the books and
`stats_summary.json` exist only on the machine that built them, and the tests
that read them skip on an absent or stale build (`game/mathBuild.testlib.ts`).

**What that build measured.** The four-guess families clear the **2-star**
limits: worst std 38.401 (limit 0.6–50.0), worst etl40b 0.769 on
`hs_red_equal_outside_club` (limit 0.8), worst CVaR 639.0 on
`hs_red_equal_equal_heart` (limit 700), worst non-zero hit rate 1 in 2.039
(limit 1 in 20), worst max-win hit rate 1 in 193,283, P(≥5,000×) zero. Every
one of those worst cases is a High Stakes mode, and ETL is the binding metric -
0.769 against 0.8 is 4% of headroom, where 0.16 had 9%. Three of a Kind: RTP 96.0000%,
non-zero hit rate 1 in 19.10 (94.8% pay nothing), max 458330 raw, P(≥5,000×) 0,
etl40b 0, etl10k 0, CVaR 4,583.3 absolute = 18.3 per stake — as predicted.

**The local verifier used to print one warning on it, and the warning was the
verifier's, not the mode's.** `utils/rgs_verification.py:verify_mode_volatility`
checked every mode against one flat table — the **3-star** figures, with `cvar`
compared to 800 — and `conditional_value_at_risk` never divides by cost, so a
250× mode's 4,583.3 base-bet CVaR was held against a limit written for 1×
modes: `Mode [tr_any_equal_equal] fails 3-star volatility limits: VIOLATED:
cvar VALUE:4583.3 --- LIMIT: 800`, on a build Stake's own console passed. Stake
reads **both** rows — the normalised figure (4,583.3 / 250 = 18.3, against 700)
and the un-normalised one (4,583.3, against 20,000 at 2 star / 50,000 at 3
star, the row the first trips build failed at 25,000). The verifier now reads
both too: it takes the mode's cost, divides for the per-stake check and holds
the raw figure against the absolute ceiling. All 193 modes pass it silently.
**The mode was never the thing to change** — do not tune it to satisfy a
limit, and do not restore the un-normalised comparison.

**A build watches itself.** `run.py` re-executes itself under
`games/ride_the_bus/build_monitor.py`, which serves
**http://127.0.0.1:8765** for the life of the run: 193 mode boxes by family,
four pass bars, the eight workers with their RTPs, an ETA, and the whole
transcript. The terminal still gets every line. `RTB_BUILD_MONITOR=0` turns it
off, a broken monitor cannot fail a build, and `build_monitor.py --demo`
replays a synthetic build in ~45 seconds - which is how the page is changed
without spending 40 minutes. Structured facts reach it as `##RTB {json}` lines
(`emit()`); everything else is parsed off the SDK's own prints, so **a reworded
print in `src/state/run_sims.py` or `utils/rgs_verification.py` silently stops
a parser** - the demo transcript is the copy of those lines to fix first.

**The build works through the families in `FAMILY_BUILD_ORDER`** (
`game_calculations.py`): Second Chance, Classic, High Stakes, Three of a Kind -
volatility order, calmest first. It sets the order of the simulation, the
reweight, the verification, the scan, `index.json`, `stats_summary.json` and
the monitor's boxes, so those generated files reorder on the first build after
this landed. Nothing reads a mode by position, and `ordered_families()` refuses
to run if a family in `MODE_FAMILIES` is missing from it rather than quietly
publishing 129 modes. The client's picker order is separate and still lists
Classic first.

**The three passes after the simulation run in parallel, and `num_threads`
sizes all of them** — the reweight and the verification over a
`ProcessPoolExecutor`, `replay-events.js` over `worker_threads` (it gets
`REPLAY_SCAN_WORKERS`). Measured 8-against-1 on the 2026-09-22 build: reweight
60.6s → 13.3s, verify 59.0s → 12.2s, scan 61.0s → 17.8s. **All three are
idempotent and were proved byte-identical** — the reweighter reads the
segmented tables and writes the published ones (193/193 md5s unchanged on a
re-run), the verifier only reads, and both `stats_summary.json` and
`REPLAY_EVENTS.md` came back identical. So any of the three can be re-run on
its own against an existing build, which is also how they are tested without
spending 40 minutes.

**The books are no longer simulated through the SDK: `direct_books.py` scores
every mode straight off one shared deal, and the published files are
byte-identical.** All 192 four-guess modes deal the same cards for a given
simulation index (`run_spin` seeds on it), and what a round pays is a pure
function of those cards and the mode's rules. So `run.py` deals the 800,000
shuffles once (`library/deals_standard52.bin`, ~2s), then each mode is scored
against them through `GameState.score_round` - **the same function `run_spin`
calls, so the rules exist once** - and its book, both lookup tables, force
record, verification sidecar and event config are written in one pass, with no
temp files and no decompress-and-recompress merge (zstd's output does not
depend on how its input is chunked; checked). What CANNOT be shared is the
output: every mode's book carries its own choices, flags and payouts, so all
44M lines are still written.

- **Proved in full against the 2026-09-22 build: all 193 modes, 1,352 files,
  every byte identical**, `force.json` included. `RTB_DIRECT_BOOKS=0` goes back
  to `create_books` (so does `profiling`).
- **Time: the simulate stage went from 1,980s to ~68s** (65.5s writing + ~2s
  dealing), across `os.cpu_count()` workers - 12 on this 6-core/12-thread
  machine, where 12 beat 8 (83.4s) and 6 (94.1s). `RTB_BOOK_WORKERS`
  overrides; `num_threads` (8) still defines create_books' split and must
  divide every sim count (12 and 5 silently drop simulations there).
- **Inside a mode**: every stage but the last is memoised by the cards turned
  so far (`score_stage`: 52 / 2,652 / 132,600 prefixes against 800,000
  rounds); a reveal's JSON and everything that depends only on the payout are
  rendered once per distinct value by the same encoder the SDK uses.
- **It checks itself on every build**: the first 2,000 rounds of each mode are
  re-scored through plain `score_round` and re-rendered from a full book dict,
  and every distinct payout's tail is re-rendered too; a mismatch fails the
  build.
- **The event config is `event_config_<mode>.json`'s one example per event
  type.** create_books let every worker write it, so the LAST worker's first
  round won - in practice always the first round of the mode's final slice
  (87,500 / 175,000 / 750,000 at 8 threads). direct_books writes that round
  deliberately; it depends on `num_threads`, not on the pool size.

The SDK path is still there and still faster than it was (one process pool,
arithmetic pricing, the shared deal, overlapped output with line-atomic stdout,
`copy_event`, a reused JSON encoder) - it is the fallback, and the test
reference. **`make_be_config` runs across the workers (31.8s -> 6.6s) and the
configs are now written AFTER the reweight**: before, `config.json` hashed the
tables and THEN the reweight rewrote them, so the first build after a rule
change recorded the previous build's hashes. It is not an uploaded file.

**Guarding it**: `games/ride_the_bus/tests/` (13, `.venv/Scripts/python.exe -m
pytest games/ride_the_bus/tests -q` from `math-sdk/`) - direct_books against
create_books-with-no-cache on a mode per family (every file), run_spin's events
against score_round, pricing against the full tables, the shuffle against
`random.shuffle`, the deal cache against a cold deal and its loader refusing
bad caches. Sabotages were caught every time. **Those tests compare the two
current paths with each other; a change to `score_stage` moves both.** The
guard against that is the published build: `payout.test.ts` on the client, and
rebuilding modes into a scratch library and byte-comparing them with
`library/` - which is how every change here was checked. `RTB_ONLY_MODES=<mode>`
builds just those modes into `library_test/` and stops before publish
(`MATH_LIBRARY_DIR` picks the folder; it never writes into `library/`).

**`run.py` does not sweep `publish_files/`.** A superseded build's books and
LUT (`*_tr_any_equal_equal_any_*`, 19:13) sat beside the current ones, which is
why the parity test reads the mode list off `index.json` rather than listing
the directory. They are gone (the rest of that build's files in `library/`
went on 2026-09-27), but re-count the folder after any rebuild and delete
leftovers before uploading it to Stake.

**Not yet submitted to Stake** — math, bet modes and mechanics are all still
changeable until the user says otherwise.

**The full picture — what is built, what was measured, every open item and every
approval-checklist gap — is `.claude/skills/rtb-invariants/references/status.md`.**
Read it when planning work. It also carries the local dev tooling: the replay
RGS, `npm run dev`, the six scenario aliases, the headless CDP driver
(`npm run shots`) that every visual judgement in this repo has been made with,
and the `playwright-cli` recipe for looking at one screen by hand.

The single biggest open item: **`RGS_TEST_PLAN.md` holds 115 live-session checks
and none has been run.** They need a real Stake session and cannot be done
locally.

## The knowledge graph maps the maths, not the components

`.claude/skills/graphify/` builds a queryable graph of the repo into the
gitignored `graphify-out/` (`graph.html`, `GRAPH_REPORT.md`, and a ~6k-note
`obsidian/` vault). Rebuild with:

```
npm run graph         # scripts/graph-build.mjs — the whole rebuild
```

Then ask it things:

```
python -m graphify affected "FAMILY_RULES"      # what breaks if I change this
python -m graphify explain "stageRetention()"   # what is this, what touches it
python -m graphify path "Game.svelte" "payout.ts"
```

**Never `graphify extract .` at the monorepo root**, which is why the build is a
script. Rooting at `.` gives 5,603 nodes of which only ~11% are this game — the
rest is the vendored SDK and the other sample games — so `god-nodes` returns
`eslint`, `node_modules` and `BetMode`, and the >5,000-node ceiling silently
degrades `graph.html` to an aggregated blob. Scoped it is 929 nodes whose hubs
are `FAMILY_RULES`, `partialMultiplier()`, `familyOf()` and `stageRetention()`.

**Components are graphed through a line-preserving shadow tree.** Graphify maps
`.svelte` onto the JS/TS grammar, and markup is not valid JS, so the parser
emits one top-level ERROR node and every symbol is lost — most of this app's
Svelte is `<script>`, and `Game.svelte` still carries ~1,140 lines of it (it was
2,724 before the split described above). The script
rewrites each component to a `.svelte.ts` holding only its script blocks, with
markup and style lines **blanked rather than deleted** so every line keeps its
original number; `bolts` reports `BoltMeter.svelte:L45` and that is genuinely
L45 of the component. Do not "simplify" that into stripping the lines, and do
not blanket-replace the `.svelte.ts` suffix afterwards — `stateGame.svelte.ts`
and `jurisdiction.svelte.ts` are real rune modules and renaming them points
every symbol they own at a phantom file. Both mistakes were made and fixed once.

The remaining 36% — markup and `<style>` — is out of reach. That is what
`npm run shots` and `npm run check:svelte` are for; a graph is the wrong
instrument for asking how something looks. The merge also co-locates Python and
TypeScript without drawing **any edge between them** — `MODE_FAMILIES` and
`FAMILY_RULES` are name-mirrors, not imports. The graph is a map, not a drift
check; `payout.test.ts` is still the only thing guarding that.

**A component's degree UNDER-REPORTS, and does so silently.** `explain
BoltMeter.svelte` returns `Degree: 1` — one import from `Game.svelte`. The real
figure is five: `--vol-sc`, `--vol-base`, `--vol-hs` and `--mode-ink` couple it
to `Game.svelte`, `base.css`, `control-bar.css`, `tokens.css` and
`win-celebration.css`. Custom properties ARE the parent→child contract here (see
the notes atop `ChoiceIcon.svelte` and `BoltMeter.svelte`) and no stylesheet is
in the graph, so the answer is not "unknown" but a confident number that is 5×
too low. Never read a low degree on a component as "safe to change" — grep the
custom properties. The graph does not know they exist.

**`--code-only` is deliberate, not a shortcut.** Without it the 122 docs — this
file, the `rtb-invariants` references, `stake-approval` — get a semantic pass
through a third-party LLM, shipping unreleased game math and compliance text off
the machine.

**It reads `.svelte` at the import level ONLY.** Graphify maps `.svelte` to the
JS/TS grammar, so the markup makes the parser emit one top-level ERROR node and a
regex pass recovers the imports. You get which component imports which, never a
function, prop or symbol inside one — `BoltMeter.svelte` and `ChoiceIcon.svelte`
extract zero symbols. The 352 "syntax errors" a build prints are expected output,
and installing `tree-sitter-svelte` does **not** help because graphify never looks
for it. So trust the graph for the Python↔TypeScript mirror — the worst bug class
in this repo — and use `npm run shots` and `check:svelte` for anything inside a
component. `styles/tokens.css` is absent too, skipped as "potentially sensitive"
on its filename alone.

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
