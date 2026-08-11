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
   `npm run lint` is currently broken for an unrelated reason (ESLint 9 needs an
   `eslint.config.js`, and none exists). It is not a gate.

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

Branch: `second-chance-mode`. Not yet merged.

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
- **Sizing is fluid, not stepped.** Everything is a multiple of `--ui` /
  `--ui-bar` in `base.css`. `responsive.css` holds structural changes only.
  Vertical space is budgeted: cards + win readout + guess squares ≈ 30× `--ui`.
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

437/437 tests, 0 type errors, 0 CSS warnings, clean production build, and the
client reproduces all 76,800 published books exactly. The published math build
(192 modes, RTP 96.0000% everywhere, spread 0.000000%, zero volatility
violations) is generated and committed.

## Outstanding

- **REP-02 (submission blocker).** A replay on the Stake site showed bet amount
  1000 where the game rendered 1 — an exact 1000× disagreement pointing at a
  units convention. Needs a live replay URL and raw response body to settle.
- **B2:** art pass (real card/table artwork) — the one substantial gap.
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
- Promo blurb for submission.
- **Not yet submitted to Stake** — math, bet modes and mechanics are all still
  changeable until the user says otherwise.
