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
   npm run audio         # capture the REAL audio graph and draw it
   ```
   `npm run audio` exists because I cannot hear. It taps the running game's
   output, writes a WAV, and renders a spectrogram and a waveform I can look at,
   plus metrics (RMS, crest, level movement, centroid, flatness, band split).
   **Use it for any change to `audioGraph.ts` / `music.ts` / `sound.ts`** — the
   same rule as "if a change is visual, drive it and look", and for the same
   reason: `sound.test.ts` pins what gets SCHEDULED and says in its own header
   that it cannot tell you whether the result sounds good. Details are in
   `.claude/skills/rtb-audio-lab/`.

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
  the four cards just played, fanned, drawn from shared tokens rather than by
  importing `cards.css`. `revealedCards` is **snapshotted** into `celebration`,
  not referenced. The fan marks what happened: a `--loss` cross on the busted
  card (desaturated), a `--forgiven` arrow on a Second Chance one (**not**
  dimmed). Exactly three shapes can reach it; the fourth is defensive only.
- **One veil for the whole ladder.** `--wc-veil` on `.wc-overlay`, never per tier.
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
  individually in the test. The card row goes entirely; the choice row only dims;
  the table, rail, chips and cups stay lit.
- **The win ramp IS the volatility ramp** — `--vol-sc` / `--vol-base` / `--vol-hs`
  / `--vol-overflow`, referenced from the same triplets as the bolt meter. Max
  alone is off the scale and keeps its cream-on-crimson inversion. The hand hops
  through `element.animate()` with `composite: 'add'`; both halves matter.
- **Which wins open the takeover**: a **clean sweep** —
  `isCleanSweep(bustedIndex, forgivenIndex)`, not "did not bust" — is floored
  onto the ladder however little it pays.

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
  claim**, re-derived from `stats_summary.json` by `volatility.test.ts`.
- **One ruler.** Every meter draws `VOLATILITY_BOLTS` (7) stops.
- **The bar is coloured by the rating, not the accent — and by *two* ratings.**
  `--mode-ink`/`--mode-rgb` is the live rating (family + one stop per Equal, going
  purple past `FAMILY_BOLT_CEILING`); `--vol-color`/`--vol-rgb` is the family's
  own and is **never purple**. All four are published on the `<footer>`.

### Colour, menus and chips — `references/colour-and-menus.md`

- **Every menu wears the colour of the control that opened it** — one contract,
  `--tint` / `--tint-rgb` / `--tint-strong` / `--tint-ink`; nothing inside a panel
  names a colour. `--tint-ink` is **dark** on every panel but the blue ones.
  Each `--ctl-*` and its `-rgb` triplet must be the same colour.
- **The bet menu is CHIPS, and the chip palettes are tokens.** A wrapping row,
  never a grid. A symbol rides with the figure; a CODE takes its own line.
  Telling a decimal separator from a grouping one is the hard part. Colour by
  rank, not amount. The figure is fitted to the disc via `labelEms()`; `--fit` is
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
  Last Win right; its 26-unit floor is cleared on phones.
- **High-denomination currencies are the stress case.** Worst three are TZS, UGX
  and XOF at 24 characters. 31 of 46 render as a bare code, so the two-line chip
  is the common path. COP is **not** a Stake currency.
- **The bet is locked while autoplay runs, and the control says so rather than
  going grey.** `setBetLevel` and `formatBetInput` check `betLockedReason()` too.
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
  ranks are ASCII and deliberately NOT drawn.

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
- **The candidates are a manifest.** `musicTracks.ts` maps ids onto the files in
  `static/music/`; `ACTIVE_TRACK_ID` is the one line that switches tracks and
  `?dev_music=<id>` auditions one without a restart. `trim` level-matches them so
  switching does not change how loud the game is. **Every file in `static/music/`
  ships** — `static/` is copied wholesale — and every one needs a row in
  `ASSET_LICENCES.md`; `musicTracks.test.ts` enforces both.
  **The ten candidates there are PAID-TIER Suno output, generated 2026-09-02 on
  v5.5 and cleared to ship** — so MP3s are tracked normally now and
  `git add -f` is no longer needed. Only `*.wav` stays ignored, because masters
  belong in the repo-root `audio-masters/`, outside the app. A clone still runs on its cues
  alone if the audio is absent, which the loader handles by design. **All ten
  are kept on purpose** so the pick can be made by ear at submission — 44 MB of
  payload to deliver 6.4 MB, which needed `musicTracks.test.ts`'s directory
  ceiling raised from 32 MB to 56 MB. **Nine of the ten must be deleted, and
  that ceiling put back, before a production build.**
- **The loop is overlapping passes, not `src.loop = true`.** A produced track
  ends on a fade to silence, so a hard wrap plays that decay into a cold entry
  forever. Each pass is its own source started `span − crossfade` after the last;
  the seams are **equal-power** curves (two uncorrelated bars sum as powers, so a
  linear pair dips 3 dB) while the arrival fade stays linear. `loopStart`/
  `loopEnd` trim the outro off. `?dev_loop=<start>,<end>,<crossfade>` shortens the
  region, because a 5-minute loop cannot otherwise be made to wrap inside a
  capture.
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
- **The scene ladder is a DIP, not a climb.** Five scenes, one file, so level is
  the only thing a scene can change: loudest at `idle`, ducked for `round` (the
  busiest the cue book gets), ducked hardest and fastest for `celebration` —
  the bed and the fanfares share one limiter, so a bed sitting on top of a win
  would duck the win. The fade time belongs to the **destination**, which makes
  ducks fast and recoveries slow for free. A celebration outranks a round in the
  derivation, because the round is still in flight underneath the takeover.
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

## Current state and outstanding work

703/703 tests, 0 type errors, 0 CSS warnings, lint clean, and the client
reproduces all 76,800 published books exactly. The published math build
(192 modes, RTP 96.0000% everywhere, spread 0.000000%, zero volatility
violations) is generated but **NOT committed** — `math-sdk/.gitignore` line 9 is
`**/library/**`, so the 1.6 GB of books and `stats_summary.json` exist only on
the machine that built them. Every test that reads the math tree therefore
*skips* rather than fails elsewhere, which is deliberate but only safe while it
is written down.

The math clears the **2-star** risk limits, not merely the 3-star ones: worst
std 32.938 (limit 0.6–50.0), worst ETL 0.695 (limit 0.8), worst CVaR 568.8
(limit 700), worst non-zero hit rate 1 in 2.03 (limit 1 in 20), P(≥5000×) zero.

**Not yet submitted to Stake** — math, bet modes and mechanics are all still
changeable until the user says otherwise.

**The full picture — what is built, what was measured, every open item and every
approval-checklist gap — is `.claude/skills/rtb-invariants/references/status.md`.**
Read it when planning work. It also carries the local dev tooling: the replay
RGS, `npm run dev`, the six scenario aliases, and the headless CDP driver
(`npm run shots`) that every visual judgement in this repo has been made with.

The single biggest open item: **`RGS_TEST_PLAN.md` holds 95 live-session checks
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
emits one top-level ERROR node and every symbol is lost — 64% of this app's
Svelte is `<script>`, and `Game.svelte` alone is 2,724 lines of it. The script
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
