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
- Second Chance has `celebrateEveryFullWin: false`, and only Second Chance.
  Forgiveness makes reaching card 4 the common case, so the full-win celebration
  floor is off there. It still celebrates on *size*.
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
- **Colour lives in `styles/tokens.css`.** Any colour used in more than one
  place is named there and referenced by name; 193 literals across 357
  occurrences is what the absence of that rule produced (four unrelated felt
  greens, three card reds, three golds, two blues). Two deliberate exemptions:
  `table.css`, whose colours are sampled measurements with the sampling recorded
  beside them, and closed one-screen palettes (the five win-celebration tiers,
  the eleven replay-info badges).
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
- **Glyphs are drawn when, and only when, the font does not own them.** Poppins
  is self-hosted latin-only, and `✕` U+2715, `✓` U+2713, `→` U+2192 and the four
  suits fall outside every declared `unicode-range` — they dropped to the system
  font, which on Android and iOS means a colour emoji. `SuitIcon.svelte` and
  `MarkIcon.svelte` draw those. The card **ranks are ASCII, inside U+0000–00FF,
  and deliberately NOT drawn**: there is no fallback to fix, and hand-cutting
  thirteen glyph outlines would trade a real typeface for a worse one.

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

451/451 tests, 0 type errors, 0 CSS warnings, lint clean, and the
client reproduces all 76,800 published books exactly. The published math build
(192 modes, RTP 96.0000% everywhere, spread 0.000000%, zero volatility
violations) is generated and committed.

`npm run lint` works again — `eslint.config.js` (flat) was added because ESLint 9
ignores the `.eslintrc.cjs` every app in the vendored SDK still ships. The old
`.eslintrc.cjs` is now dead and only kept so the app still matches its siblings.

The math clears the **2-star** risk limits, not merely the 3-star ones: worst
std 32.938 (limit 0.6–50.0), worst ETL 0.695 (limit 0.8), worst CVaR 568.8
(limit 700), worst non-zero hit rate 1 in 2.03 (limit 1 in 20), P(≥5000×) zero.

## Outstanding

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

  **Still open:** `static/` holds `logo.png` (726 KB, drawn at ~150 px — it wants
  sized variants or an SVG) plus the two tile files. Whether the game needs any
  *bitmap* art at all is still a judgement call: the table scene is hand-sampled
  CSS and is the best work in the repo, so the honest risk is not "no assets" but
  "does a reviewer read CSS art as art". Note the tension before adding any:
  `config-svelte` sets `bundleStrategy: "inline"`, so anything Vite processes is
  base64'd into `index.html`, and bundle size is itself a 3-star criterion —
  ship art from `static/` via `${base}/…` like `logo.png` does, not through Vite.
- **REP-02.** A replay on the Stake site showed bet amount 1000 where the game
  rendered 1 — an exact 1000× gap pointing at a units convention. Stake documents
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
  - Replay re-watch works, but through the spin button. The checklist asks for a
    **"Play Again"** button — a relabel in replay mode, not new behaviour.
  - Touch targets **re-measured at every target viewport and clear the 24 px
    WCAG AA floor everywhere** — guess segments 29/35/39 px at 320/375/425,
    equal-badge tap area `min(32px, 45% of the square)`, bar icons 36 px. The
    badge's ceiling is tied to the square rather than flat at 32 px because a
    flat 32 px reaches past a segment's own centre on a 320 px screen and steals
    it. Nothing reaches the 44 px *comfortable* target: four cards across cap
    `--ui` at 2.265vw, and 44 px bar icons overflowed a 375 px viewport. Table
    in `RGS_TEST_PLAN.md` §11. "Popout S/L" is still a named responsive check.
  - Tile assets: **three** files with fixed names — `RideTheBus-BG.png`,
    `RideTheBus-FG.png`, `TakeoverCasino-Logo.png` — BG+FG ≤ 3 MB combined.
    Two of three are in: `RideTheBus-BG.jpg` (499 KB) and `RideTheBus-FG.png`
    (1.5 MB), 2.0 MB combined against the 3 MB cap. **`TakeoverCasino-Logo.png`
    is missing** and has to come from the studio — it is a real company mark, not
    something to generate. README's older 4-layer Tile Editor description has
    been corrected.
  - The 52 live-session checks in `RGS_TEST_PLAN.md` remain unrun.
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
- Promo blurb for submission — **mandatory**, not optional: "approval requests
  must be accompanied by a short blurb describing your game theme and mechanics".
- **Not yet submitted to Stake** — math, bet modes and mechanics are all still
  changeable until the user says otherwise.


# Stake Engine Casino Game Development Contract

You are helping build a casino game for Stake Engine. Treat this document as a development, QA, math-integrity, UX, and submission contract. Do not claim that any change guarantees a 2-star or 3-star quality ranking: Stake’s public materials describe quality ranking and visibility, but do not publish a deterministic scoring formula. Optimize for approval readiness, player clarity, technical reliability, mathematical integrity, and a polished, distinctive experience.

## 1. Source-of-truth policy

Use official Stake Engine documentation as the authority for platform behavior and file formats. When a requirement is unclear or appears to have changed, identify the uncertainty and ask for the relevant current dashboard/documentation detail instead of inventing an answer.

Primary references:

- [Stake Engine approval guidelines](https://stake-engine.com/docs/approval-guidelines)
- [Submission checklist](https://stake-engine.com/docs/approval-guidelines/submission-checklist)
- [General game disclaimer](https://stake-engine.com/docs/approval-guidelines/general-disclaimer)
- [Stake Development Kit](https://stakeengine.github.io/math-sdk/)
- [Quickstart and simulation workflow](https://stakeengine.github.io/math-sdk/math_docs/quickstart/)
- [Required math file format](https://stakeengine.github.io/math-sdk/rgs_docs/data_format/)
- [RGS technical details](https://stakeengine.github.io/math-sdk/rgs_docs/RGS/)
- [Recommended game structure](https://stakeengine.github.io/math-sdk/math_docs/overview_section/game_struct/)
- [Frontend SDK](https://stakeengine.github.io/math-sdk/fe_home/)
- [BetMode configuration](https://stakeengine.github.io/math-sdk/math_docs/gamestate_section/configuration_section/betmode_overview/)

When reporting completion, distinguish:

- **Hard requirement:** explicitly required by the docs or enforced by the RGS.
- **Strong recommendation:** documented guidance or a defensible quality practice.
- **Product hypothesis:** an idea intended to improve player appeal, retention, or visibility that must be validated through playtesting and analytics.

Never present a product hypothesis as an official Stake requirement.

## 2. Non-negotiable math and integrity rules

- Keep the authoritative outcome and payout on the RGS/static math side. The frontend must render the returned result and must never decide, alter, predict, or silently repair a payout.
- Use static, publishable game files. All possible outcomes must be represented in the compressed game books and mapped through the lookup table.
- For every mode, produce the required `index.json`, a zStandard-compressed JSON-lines events file, and a CSV lookup table.
- `index.json` must contain `modes`; each mode must include `name`, `cost`, `events`, and `weights` with correct filenames.
- Every game-logic record must contain `id`, `events`, and `payoutMultiplier`.
- The lookup-table payout multiplier must exactly match the corresponding game-logic payout multiplier. Validate this mechanically before submission; do not rely on visual inspection.
- Treat payout and probability values as non-negative integer data in the required format. Avoid floating-point ambiguity in serialized outputs.
- Make simulation IDs unique and stable within each mode, and ensure every lookup row resolves to exactly one logic record.
- Never add frontend randomness after the `/play` response. Given the same response, rendering and replay must be deterministic.
- Never use hidden odds changes, outcome manipulation based on player history, loss-chasing mechanics, misleading near-misses, or UI behavior that obscures the actual wager or payout.
- Display the actual rules, paytable, RTP/expected return where required, relevant volatility or hit-frequency information, maximum win/cap, feature costs, and material conditions clearly and consistently.
- If a mechanic is not mathematically represented in the published math files, it is not implemented. Update math, event schema, frontend, and tests together.

## 3. Math-development workflow

Follow this order:

1. Write a concise game specification: board/reels, symbols, pay rules, wilds/scatters, features, modes, bet costs, RTP targets, volatility target, hit rate, maximum win, and jurisdiction-dependent behavior.
2. Implement the smallest playable math slice first.
3. Run a small number of uncompressed simulations with one thread for debugging. Inspect the JSON events and lookup rows manually.
4. Add deterministic unit tests for every win type, feature trigger, retrigger, zero-win result, maximum-win result, interrupted round, and invalid configuration.
5. Run large simulations for every mode. Use at least 100,000 simulations per mode for production diversity unless current Stake guidance requires more.
6. Run optimization only after raw event correctness is established. Never use optimization to conceal incorrect win logic.
7. Run analysis and generate a PAR/statistics report. Review RTP contribution by feature, hit rate, win-size distribution, free-game contribution, maximum-win frequency, and dead-spin frequency.
8. Generate compressed publication files and run a clean-room verifier that reads only the output bundle.
9. Test the exact uploaded bundle in the Stake Engine dashboard, including resume/reload and mobile behavior.

Required math assertions:

- `sum(probability weights)` is valid for the selected format and uses no accidental zero/negative weights.
- Every weighted simulation exists in the events book.
- Every events-book simulation exists in the lookup table.
- Every lookup payout equals the events-book payout exactly.
- RTP is within the declared tolerance of the target after optimization.
- Mode cost multipliers, feature costs, and payout caps agree across config, math, frontend, and displayed rules.
- No simulation emits malformed, contradictory, missing, or unreachable events.
- Replaying a saved result produces the same visual state and final payout.

## 4. Quality target: 3-star-ready, without guessing the rubric

Build toward the following observable quality attributes. These are quality targets, not a published guarantee or official numeric rubric.

### Distinctive product

- The game has one clear hook that can be explained in one sentence.
- The hook materially affects decisions, anticipation, or progression rather than being cosmetic only.
- The theme, symbols, animation language, sound, and feature names are coherent and original.
- Avoid cloning Stake Originals or another provider’s identifiable presentation, wording, art, or mechanic combination.

### Excellent first session

- A new player understands the wager, spin/start control, result, win amount, and feature state immediately.
- The first interaction is fast, readable, and does not force unnecessary dialogs.
- Wins and losses are visually distinct, but the UI never exaggerates a small win as if it were a major profit.
- The player can inspect rules/paytable/RTP and understand how every major feature works.
- Loading, first render, and first spin are quick on ordinary mobile hardware.

### Durable play loop

- The base game is understandable without a tutorial wall.
- Feature entry and progression are legible; counters, multipliers, collections, and retriggers cannot be missed.
- The game has meaningful pacing: spins do not feel sluggish, animations can be skipped or sped up where allowed, and no animation blocks the next valid action unnecessarily.
- Auto-play/turbo behavior, if supported by the platform and jurisdiction, remains transparent and respects operator flags.
- High volatility is communicated honestly; the game does not imply that past outcomes influence future outcomes.

### Reliability and polish

- No console errors, uncaught promise rejections, broken assets, layout overflow, inaccessible controls, or stuck rounds.
- Works on desktop and narrow mobile layouts; test touch targets, orientation changes, reduced-motion preferences, and slow connections.
- Refresh/disconnect/reconnect resumes or safely completes an in-progress round according to RGS rules.
- All UI states have a defined result: loading, authenticated, insufficient balance, invalid bet, play pending, result received, feature active, end-round, timeout, maintenance, and generic server error.
- The game never double-submits a bet and clearly disables or debounces controls while a request is pending.
- Use only allowed static assets and dependencies. Do not fetch remote scripts, fonts, images, analytics, or APIs from the game build unless Stake explicitly permits them. Keep the build compatible with the platform’s strict static/XSS constraints.

## 5. RGS and wallet integration

- Read `sessionID`, `lang`, `device`, and `rgs_url` from the launch context as specified. Never hardcode `rgs_url`.
- Authenticate before wallet operations and handle invalid sessions, expired tokens, insufficient balance, gambling limits, location restrictions, maintenance, and server errors with clear recovery behavior.
- Use integer monetary units with six-decimal precision as required by the RGS. Never use display-formatted decimal strings as the authoritative wager.
- Read `minBet`, `maxBet`, `stepBet`, `defaultBetLevel`, and `betLevels` from wallet authentication. Do not hardcode operator limits.
- Validate that the requested amount is within limits and divisible by `stepBet` before play.
- Apply `base bet × mode cost multiplier` exactly once. Show the player the effective cost before any purchased or alternate feature is started.
- Use the correct play, event, balance, and end-round lifecycle. Preserve an active round after interruption and do not locally settle a payout.
- Keep request IDs/state transitions observable in development logs, but remove sensitive session data and verbose debug output from production.

## 6. Frontend implementation rules

- Keep math event names and payload schemas in one typed/shared contract. Reject unknown event types in development rather than silently ignoring them.
- Render from event order. Do not infer wins from board appearance when the event payload supplies authoritative win positions and amounts.
- Keep currency formatting separate from integer wallet arithmetic.
- Make paytable and rules usable on mobile, keyboard, and screen readers where practical: meaningful labels, focus order, contrast, no color-only meaning, and readable text.
- Localize visible strings using the supplied language context. Do not concatenate unescaped user or server-controlled strings into HTML.
- Use an explicit state machine for authentication, idle, betting, animation, feature, completion, and recovery. Prevent impossible transitions and duplicate completion calls.
- Add an internal debug/replay mode that can render a saved simulation without changing production outcomes. Remove test controls and forced outcomes from the release build.
- Add feature flags only when they are deterministic, documented, and not capable of changing the settled payout.

## 7. Testing and release gates

Before asking for approval, produce evidence for all of the following:

- Unit-test report for paytable, reels/board, wins, scatters, wilds, cascades, free games, retriggers, buy features, caps, and edge cases.
- Math verification report comparing every events-book payout to every lookup-table payout.
- PAR report for each mode: target RTP, measured RTP, base/feature RTP contribution, hit rate, average win, volatility proxy, feature frequency, maximum win, and relevant win bands.
- Deterministic replay test: same saved event response gives identical final UI and payout display across repeated runs.
- RGS integration test for successful play, insufficient funds, invalid bet, invalid session, timeout, location/limit rejection, disconnect, refresh, resume, and end-round.
- Browser/device matrix covering current desktop browsers and a narrow mobile viewport with touch input.
- Performance check covering bundle size, initial load, memory growth over many spins, animation frame rate, and asset failures.
- Accessibility and usability review of betting controls, rules, paytable, balance, win display, errors, and feature status.
- Clean production build scan: no secrets, test URLs, hardcoded session/rgs values, forced outcomes, debug buttons, remote dependencies, or console errors.
- Manual playtest with people unfamiliar with the game. Record confusion points, time to first spin, feature comprehension, and any misleading presentation.

Do not submit if any release gate fails. Report the exact failure, likely cause, and smallest safe fix.

## 8. Responsible design and compliance

- Include a clear game-information disclaimer conveying that outcomes and payouts are determined by the Remote Game Server, expected return is calculated over many plays, the display is illustrative, a stable connection is required, and interrupted rounds should be reloaded. Use the current Stake-approved wording where applicable.
- Do not imply guaranteed profit, skill-based control over random outcomes, “due” wins, hot/cold streaks, or a way to beat the house edge.
- Do not use dark patterns to increase wager size, hide the cost of features, pressure a player after losses, or obscure responsible-gambling controls.
- Respect jurisdiction configuration such as disabled fullscreen, disabled turbo, limits, and social-casino behavior. Never override operator-provided restrictions.
- Obtain clarification from Stake for any regulated-content, advertising, responsible-gambling, jurisdiction, or exclusivity question rather than making an assumption.

## 9. Claude operating procedure

For every coding task:

1. Inspect the existing repository and identify the relevant math, event, frontend, config, and test files before editing.
2. State which requirement or product goal the change addresses.
3. Make the smallest coherent change across all affected layers.
4. Add or update tests before declaring success.
5. Run the narrowest relevant tests, then the full verification suite when practical.
6. Check generated artifacts, not merely source code.
7. Report changed files, commands run, results, remaining risks, and any requirement that needs Stake confirmation.

For every design or math proposal:

- Give the player-facing behavior, exact math effect, event schema, expected RTP/volatility impact, and test plan.
- Flag anything that could affect fairness, payout integrity, jurisdiction, wallet lifecycle, or approval.
- Prefer transparent, replayable, deterministic mechanics over engagement tricks.
- Never optimize only for session length or revenue. Optimize for a game players can understand, trust, and choose to replay.

## 10. Final submission checklist

- [ ] Game hook and rules are documented and easy to explain.
- [ ] Math, frontend, events, configs, and displayed rules agree.
- [ ] Small uncompressed simulations were inspected.
- [ ] Production-scale simulations and optimization completed.
- [ ] PAR/statistics report reviewed against targets.
- [ ] `index.json`, `.jsonl.zst`, and CSV files validate and cross-match.
- [ ] RGS/wallet lifecycle and interruption recovery pass.
- [ ] No hardcoded session, RGS URL, wallet limits, or mode names.
- [ ] No client-side payout authority or post-response randomness.
- [ ] Mobile, performance, accessibility, localization, and error states pass.
- [ ] Static/XSS/dependency/security scan passes.
- [ ] Disclaimer, rules, RTP/expected-return information, and responsible design pass review.
- [ ] Production build contains no forced outcomes or debug controls.
- [ ] Approval submission includes clear test instructions, demo credentials/links if required, known limitations, and evidence from the release gates.
- [ ] Any claimed Stake-specific requirement is linked to current official documentation.


# Stake Engine approval guidelines — verbatim reference

**This is the source of truth for every Stake-specific claim in this repo.**

Captured from <https://stake-engine.com/docs/approval-guidelines> and its
sub-pages. That site is a client-rendered SPA: fetching it returns only a
loading shell, and the old `stakeengine.github.io/math-sdk` mirror now 404s. No
tool in this project can read it. Re-paste from the live site rather than
guessing when something looks out of date.

The math-SDK half of the docs *is* readable locally, at `math-sdk/docs/`
(`rgs_docs/data_format.md`, `rgs_docs/RGS.md`, `math_docs/**`). Prefer those
files over the web for file formats and RGS endpoints.

## Submission checklist

Use this checklist before submitting for approval. Incomplete submissions cause
delays — games that do not meet all requirements are held until the issues are
resolved, which may push the go-live date back significantly.

The review queue is shared across all teams. Submissions that fail basic checks
take reviewer time away from other games and may result in the request being
deprioritised.

This is the criteria applied to a **new team**. Requirements may vary once a team
builds a track record.

### PreChecks

- Game authenticates with RGS successfully on game launch
- Game authentication fails correctly with an invalid `rgs_url`
- Clicking on the bet button sends a successful play request to RGS
- Game should not contain the Stake Engine Loader

### Compliance checks

- Game title is unique and does not use restricted terms
- Game assets and imagery do not contain offensive or inappropriate content
- Game is sufficiently distinct from existing titles and series

### Game thumbnail

- Game thumbnail meets Stake artwork guidelines

### RGS requirements

**Bet levels**
- Game dynamically uses all betting parameters from the authenticate response
- Active rounds restore the bet amount from the authenticate response

**Currency support**
- Game supports and displays currencies correctly
- Game displays sub-cent payouts correctly

**RGS requests**
- Zero-win bets do not send an end-round request to the RGS
- Insufficient balance bets do not send a play request to the RGS

### Frontend requirements

- Main game frame should not be scrollable
- Space bar should be bound to the bet button

**Game rules**
- RTP and Max Win are clearly stated within the game rules
- Payout information per symbol must be clearly communicated
- Win combinations are displayed in the game rules
- Game modes include description and cost information
- Free game and re-trigger conditions are clearly displayed in the game rules
- General disclaimer is included in the game information

**Auto play**
- Auto-bet requires a confirmation step before starting
- High cost bet modes require confirmation before activation

**Responsive checks**
- Game functions correctly on Desktop/Laptop
- Game functions correctly on Popout S/L
- Game functions correctly on Mobile
- Double tap to zoom is disabled on mobile
- User interaction guide is included in the game information

**Sounds / music**
- Game provides an option to disable sounds

**Multiple language support**
- Game supports English language
- Invalid language parameters do not break game display
- Check 5 wins for each game mode against the Game Rules
- If Mystery Mode is present, any numerical values representing chances or
  probabilities are accurate

### Jurisdiction requirements — Stake.US

- Is the game compliant with the required translations for a social game?
- Game supports SC and GC currencies & values do not display a `$` prefix
- Game mode naming follows Social Mode terminology guidelines
- Replay window does not contain restricted words
- English is the only supported language in Social Mode

### Replay support

- Supports replay urls, loads and plays desired event
- Supports all optional parameters like currency, language, amount
- Replay allows replaying the event again after completion
- UI clearly displays bet cost and applied multiplier
- Supports Replays in Popout S view

### Final approval checklist

- Game has bet-level templates applied
- Provably Fair and Replay are enabled
- Front and Math requests are approved
- Game is posted in the `stake-engine-game-approved` channel
- Game works correctly on older mobile devices (Android and iOS)
- Approval request is closed after the game is live & emojis are added to the
  Slack notification
- Game Released

### What happens after submission

Three independent reviewers are assigned. Each rates the game 0–3 stars across
design, gameplay and math compliance. Ratings stay hidden until all three are in.

- Average ≥ 1 star → approved for production.
- Average < 1 star → rejected. Reviewers may give feedback; resubmission allowed
  after addressing it.

Can be as quick as a couple of hours; an incomplete or non-compliant game blows
that out to weeks.

## General requirements

Approval requests are actioned for a **specific frontend and math version**. Stake
inspects functionality, clarity, communication and technical performance.

**Approval requests must be accompanied by a short blurb describing the game
theme and mechanics**, for promotional material and the game description tag.

### Key restrictions

- Stake Engine games are **strictly stateless**: each bet must be independent of
  previous outcomes. Games cannot include jackpots, gamble features,
  continuation, or early cashout options.
- Team names, game titles and assets must comply with IP/copyright law.
- Games must be original designs. Pre-purchased or licensed games existing on
  other third-party websites are not permitted.
- Game assets cannot include material with Stake™ branding or themes.
- Approval is at the reviewer's discretion. Games deemed offensive, explicit, in
  poor taste, or of insufficient quality may be rejected.
- Games that promote, encourage, or are likely to appeal to underage persons are
  not permitted, including artistic depictions of children or child-like
  characters in any gambling context.
- Games are automatically considered for stake.us provided they abide by the
  language requirements below.

### Post-release

Once approved for Stake/Stake-US, **only minor updates to address visual issues
are permitted** unless Stake requests otherwise. Changes to the math model, new
game modes, or gameplay mechanic modifications are not allowed.

## Bet Replay

Mandatory for all new games. Games without it will not be approved. During review
Stake tests replay and requests a range of event IDs to validate scenarios.

**A player session is NOT required to view a replay** — replay URLs can be shared
publicly.

### Query parameters

| Parameter | Required | Description |
|---|---|---|
| `replay` | Yes | Always `true` in replay mode |
| `game` | Yes | Game ID |
| `version` | Yes | Math version (e.g. 1, 2) |
| `mode` | Yes | Bet mode |
| `event` | Yes | Unique **simulation ID** to replay |
| `rgs_url` | Yes | RGS server URL to fetch replay data from |
| `currency` | No | Currency code |
| `amount` | No | Bet amount in units |
| `lang` | No | Language code |
| `device` | No | Device type |
| `social` | No | Social mode (true/false) |

`event` being a simulation ID resolves the open question in REPLAY_EVENTS.md:
the IDs derived from the published lookup tables are the right thing to send.

### Endpoint

```
GET {rgs_url}/bet/replay/{game}/{version}/{mode}/{event}
```

Response: `{ "payoutMultiplier": float, "costMultiplier": float, "state": object }`

### Expected UX

- **Loading:** auto-load the event data without interaction, then show a "Play"
  button.
- **During:** play the round as normal — all animations, sounds and effects. No
  betting allowed; all bet controls disabled or hidden.
- **After:** show a **"Play Again"** button and keep the win amount and outcome
  visible.

Recommended slimmed-down replay UI — hide balance display, play buttons, bet
amount selector, autoplay settings; keep win amount, replay controls, replay bet
amount, currency display.

Must also: show a loading state, disable session calls (no authenticated API
calls), handle errors with a message if replay data fails to load, and prevent
any transition from replay into normal play.

## Game quality rankings

0–3 stars, determining visibility and positioning eligibility.

| Rank | Description | Promotion & visibility |
|---|---|---|
| ★★★ | Studio-quality, exceptional creativity, uniqueness, attention to detail | Optimal positioning; eligible for Burst Games, Stake Exclusives, featured New Releases |
| ★★ | Considerable creativity or originality; may lack polish vs established studios but strong development quality | Burst Games / Stake Exclusives if user popularity drives it; New Releases placement depends on space and demand |
| ★ | Lower polish but meets publishing requirements | **Not published.** The developer is asked to resubmit once improved. |

**One star is not a publication.** Any claim in this repo that 1 star ships at
the bottom of New Releases is wrong.

### Common issues leading to low ratings

- Shallow gameplay with limited depth — players place only 1–2 bets before
  losing interest.
- **Over-reliance on generic AI-generated assets — standard fonts, gradients,
  emoji icons and border effects are not sufficient for a quality release.**
- Inconsistent or low-quality visual design — mismatched art styles and poor
  animation quality.
- Missing engaging features — bonus modes and additional mechanics significantly
  enhance retention and are expected in competitive submissions.

### What makes a 3-star game

- Tested across a range of devices; renders correctly at all screen sizes with
  no laggy or low-quality sounds.
- **Optimised bundle size** — large assets and long loads create poor experiences.
- Clean animations and art; cohesive, polished, professional.
- In-depth concepts for Burst Games — simple concepts do not perform well;
  players wanting simple content play Stake Originals. Benchmarks: Cut n Crash,
  Angry Balls, Drop the Boss.

## RGS communication

- **Bet level verification:** the authenticate response returns default bet
  levels, supported levels for the currency, and min/max amounts. The frontend
  must respect these. Bet increments must reflect `authenticate/config/minStep`.
  Min and max levels must be selectable.
- **XSS:** strict policy. The build must consist only of static files and cannot
  reach external sources. Downloading fonts from external servers is a common
  failure that logs console errors.
- **RGS URL:** must come from the `rgs_url` query parameter.
- **Language:** English is the only required language. If only `en` is supported,
  on-screen text must not corrupt when other language parameters are passed.

Supported languages: `ar de en es fi fr hi id ja ko po pt ru tr zh vi`.

Supported currencies now extend well past the math-SDK doc's list — it adds NGN,
SAR, ILS, AED, TWD, NOK, KWD, JOD, CRC, TND, SGD, MYR, OMR, QAR, BHD, PKR, EGP,
NZD, BOB, GHS, KES, MAD, BAM, ISK, TZS, UGX, XOF and XEC (Stake Euro Cash,
displayed `SC`) alongside XGC/XSC. Code examples: <https://stake-engine.com/docs/rgs>

## Frontend and communication

### Game display

- Submitted games must use **unique audio and visual assets**. Backgrounds,
  symbols and animations shipped with the web-sdk sample games will not be
  approved.
- Free of visual bugs, broken or missing assets or animations.
- **Popout view support:** games must support Stake's 'mini-player' modal small
  view without the active game board being visibly distorted.
- Must support mobile view for commonly used devices, with all UI functionality
  usable during screen scaling.
- All images and fonts must be loaded from the Stake Engine CDN.

### Rules and paytable

- Game information accessible from the UI, with a detailed description of all
  rules.
- If multiple modes exist, describe the cost of each bet and what is purchased.
- The RTP of the game (and each mode) must be clearly communicated.
- The maximum win for each mode must be clearly displayed.
- Payout amounts for all symbol combinations must be presented.
- Special symbols (cash prizes, multipliers) — list all obtainable values.
- Feature modes — describe how to access them.

### UI components

- A **User Interface guide** briefly describing what the UI buttons do.
- The player must be able to change bet size, and use all bet levels from the
  authenticate response.
- Current balance must be displayed.
- Final win amounts clearly shown for non-zero payouts.
- If an outcome contains multiple winning actions, the payout must incrementally
  update to the final multiplier.
- An option to disable sounds.
- **Spacebar mapped to the bet button.**
- If autoplay exists, the player must confirm it — games may not automatically
  place consecutive bets with one click.

### Other checks

- Network tab must show no errors and no game information being logged.
- Playtesting verifies the game behaves as the rules describe.
- Tested with various currency and language combinations.
- Any 'fastplay' option must keep win amounts, winning combinations and pop-up
  information legible.

## Math verification

### File size restrictions

- No single events file (`.jsonl.zst`) may exceed **4.2 GB**
- No game mode may contain more than **10,000,000 events**

### Summary statistics

- Mode cost correctly represented in the game rules for each mode.
- **Calculated RTP must be within 90.0%–96.70%.** For multiple modes, all must
  fall within a **0.5% variation**.
- Maximum win must match the game rules for each mode.
- Maximum win must be realistically obtainable — typically more frequent than
  1 in 10,000,000, depending on payout size.
- Slot-type games: run **100,000–1,000,000 simulations** for outcome diversity.
- A reasonable portion of simulations must pay — e.g. 90,000 non-paying out of
  100,000 may be grounds for rejection.
- The hit-rate of the most likely single simulation must not be overwhelmingly
  dominant where results are visually expected to vary.

### Other considerations

- Non-zero win hit-rate should be **better than 1 in 20 bets**.
- For 1.0×-cost "BASE" modes, standard deviation should sit within industry norms.
- List the number of non-zero weight payouts; zero-weight payouts should not
  dominate.
- Inspect hit-rates for win ranges to avoid gaps where expected win amounts are
  unobtainable.

### Risk limits by star tier

| Limit | 2-star | 3-star |
|---|---|---|
| Maximum exposure | $10,000,000 | $50,000,000 |
| Maximum payout multiplier | 25,000× | 100,000× |
| Maximum bet cost | $100,000 | $500,000 |
| Maximum cost multiplier | 1,000× | 1,500× |
| Minimum base (1.0× cost) standard deviation | 0.6 | 0.6 |
| Maximum base (1.0× cost) standard deviation | 50.0 | 60.0 |
| P(≥5000) / P(≥10000) | 1e-2 / 8e-2 | 1e-2 / 2e-2 |
| Risk limits (CVaR) | 700 | 800 |
| Liability (ETL, >40× bet) | **0.8** | 0.9 |
| Liability (ETL, P(>10000)) | 0.6 | 0.8 |

**The 0.9 / 800 figures cited elsewhere in this repo are the 3-star tier.** The
binding pair for a new submission is the 2-star tier: ETL 0.8 and CVaR 700.

Maximum bet size accepted by the RGS is $500,000 USD; beyond that returns
400 `invalid bet amount`.

**P(≥5000) / P(≥10000)** are maximum allowed cumulative probabilities of a payout
at or above those multipliers, taken as the worst case across all modes. High-cost
modes are scaled down before comparison: cost ≥ 1000× by 0.2; 500 ≤ cost < 1000
by 0.5; 200 ≤ cost < 500 by 0.8.

**CVaR** (Conditional Value at Risk / Expected Shortfall): the expected payout to
the operator when a win occurs in the worst 0.1% of outcomes. Both the normalized
(CVaR / bet cost) and un-normalized values are considered.

**ETL** (Expected Tail Liability): the proportion of total expected return
concentrated in wins ≥ 40× the cost multiplier (or >10,000× if not applicable).
A normalized ETL of 0.5 means half the game's RTP comes from wins above the
threshold — high tail-risk concentration for operators.

## Game tile visual assets

Submitted with the game. Low-quality or unappealing artwork results in lower
player trust, interest and engagement.

Three assets required. **Background + foreground must not exceed 3 MB combined.**

| Asset | Requirement | Naming |
|---|---|---|
| Background | Environmental background showing the world of the game. High-resolution PNG or JPG. | `GameTitle-BG.format` (e.g. `CrownConquest-BG.png`) |
| Foreground | A feature character or key item representing the game. High-resolution PNG, transparent background. | `GameTitle-FG.png` |
| Provider logo | Official provider/studio logo. High-resolution PNG, transparent background, legible at small sizes. | `ProviderName-Logo.png` |

## General disclaimer

The rules/information popup must include a brief disclaimer about game operation.
Stake Engine uses pre-calculated results: payouts are dictated purely by the RGS
response and are not influenced by frontend events. Stake's template may be used,
or your own, so long as the same message is clearly conveyed.

> Malfunction voids all wins and plays. A consistent internet connection is
> required. In the event of a disconnection, reload the game to finish any
> uncompleted rounds. The expected return is calculated over many plays. The game
> display is not representative of any physical device and is for illustrative
> purposes only. Winnings are settled according to the amount received from the
> Remote Game Server and not from events within the web browser. TM and © 2026
> Stake Engine.

## Jurisdiction requirements — restricted terms

For availability on stake.us, US requirements prohibit certain gambling terms.
This applies predominantly to game rules but extends to images and UI elements.

The RGS sets `social=true/false` to indicate a social casino. Stake recommends an
additional language file prefixed `sweeps_<lang>`; this project uses
`src/i18n/socialMessages.ts` instead, applied through `i18nDerived.t`.

| Restricted | Replacement |
|---|---|
| win feature | play feature |
| pay out | win / won |
| paid out | win |
| stake | play amount |
| pays out | won |
| betting | play / playing |
| total bet | total play |
| bet | play |
| bets | plays |
| cash | coins |
| payer | winner |
| pay | win |
| pays | wins |
| paid | won |
| money | coins |
| buy | play |
| bought | instantly triggered |
| purchase | play |
| at the cost of | for |
| rebet | respin |
| cost of | can be played for |
| credit | balance |
| buy bonus | get bonus |
| gamble | play |
| wager | play |
| deposit | get coins |
| withdraw | redeem |
| bonus buy | bonus / feature |
| be awarded to player's accounts | appear in player's accounts |
| bet/s | play/s |
| currency | token |
| fund | balance |
| place your bets | come and play / join in the game |
