# Ride The Bus — how it actually works

A guided read of the whole system, written to be followed **with the files open
beside it**. Every claim points at the file that makes it true, so when this
document and the code disagree, the code wins and this document is the bug.

It assumes nothing beyond "it's a card game with a Python half and a Svelte
half". It does not assume you remember any prior decision.

**Read it in order.** Part 1 is the one idea the whole design hangs off; nothing
after it makes sense without it.

---

## Contents

1. [The one idea](#1-the-one-idea-the-bet-mode-is-the-guesses)
2. [The game, as a player sees it](#2-the-game-as-a-player-sees-it)
3. [The maths](#3-the-maths-why-a-multiplier-is-what-it-is)
4. [The three families](#4-the-three-families)
5. [What the math build actually produces](#5-what-the-math-build-actually-produces)
6. [The RGS: four endpoints](#6-the-rgs-four-endpoints)
7. [The client: one round, three files](#7-the-client-one-round-three-files)
8. [Where client state lives](#8-where-client-state-lives)
9. [The screen](#9-the-screen)
10. [How the two halves stay honest](#10-how-the-two-halves-stay-honest)
11. [Running it locally](#11-running-it-locally)
12. [Reading order, if you want a path](#12-reading-order-if-you-want-a-path)

---

## 1. The one idea: the bet mode IS the guesses

Everything strange about this codebase follows from one platform rule.

**Stake Engine requires every bet to be a single, independent, stateless
outcome.** No continuation between bets. No cashing out halfway. One call in,
one settled result out.

But "Ride The Bus" is a four-stage game where you'd naturally guess, see a
card, then guess again. That is a continuation, and it is not allowed.

So the design inverts it: **the player picks all four guesses before the round
starts, and that combination of four guesses IS the bet mode.**

```
colour → higher/lower/equal → inside/outside/equal → suit
  2    ×          3          ×          3           ×  4   = 72
```

…minus the eight impossible ones (see below) = **64 playable combinations**,
times three families = **192 published bet modes**.

A mode is named by joining the guesses:

```
red_higher_equal_spade          Classic
sc_red_higher_equal_spade       Second Chance
hs_red_higher_equal_spade       High Stakes
```

Built by `modeName()` in [`game/math/modes.ts`](web-sdk/apps/Ride-The-Bus/src/game/math/modes.ts#L220)
and by `mode_name()` in [`game_calculations.py`](math-sdk/games/ride_the_bus/game_calculations.py#L158).
The two must agree exactly, because the client sends the string and the RGS
looks it up.

### Why 64 and not 72

`equal` at stage 2 then `inside` at stage 3 is impossible. If card 2 ties card
1's rank exactly, the two reference cards are the same rank, and nothing can
fall *strictly between* them. That mode would lose 100% of the time — and a
mode that always loses has zero variance, which the RGS rejects outright.

`all_mode_combinations()` in [`game_calculations.py`](math-sdk/games/ride_the_bus/game_calculations.py#L139)
filters them out. 72 − 8 = 64.

### The consequence you'll trip over

Because a mode is a string built from five parts, and the family prefix is one
of them, **anything parsing a mode name must strip the family prefix before
splitting on `_`**. `sc_red_higher_equal_spade` has five underscore-separated
parts, not four. This has shipped broken twice.

---

## 2. The game, as a player sees it

Four cards face down. The player picks four guesses, sets a bet, presses deal.
The cards turn one at a time.

| Stage | Guess | Compared against |
|---|---|---|
| 1 | Red or black | the card's own colour |
| 2 | Higher / lower / equal | card 1's rank |
| 3 | Inside / outside / equal | the range between cards 1 and 2 |
| 4 | Suit | the card's own suit |

A **correct** guess multiplies the running win. A **miss** ends the round — but
not at zero: it keeps a fraction of what was built (see retention, below).

`_is_correct_guess()` in [`gamestate.py`](math-sdk/games/ride_the_bus/gamestate.py)
is the authority on what counts as correct. Note stage 2 and 3: an exact rank
tie is `equal`, and only `equal` wins it.

---

## 3. The maths: why a multiplier is what it is

This is the part worth genuinely understanding, because everything else is
plumbing.

### The problem

Different guesses have wildly different odds. "Red" is ~50%. "Equal" at stage 2
is ~6%. If you paid fair odds on each, the *rare* combinations would have
enormous RTP swings, and Stake requires every mode's RTP to sit within ±0.5% of
every other mode's.

### The solution: a martingale

Every stage's multiplier is **solved**, not chosen, from this requirement:

```
p·m + (1−p)·retention = decay
```

- `p` — the true probability this guess is right, computed from the cards
  actually left in the deck
- `m` — the multiplier if correct (the unknown we solve for)
- `retention` — the fraction kept on a miss
- `decay` — a **fixed constant**, the same for every stage and every mode

Rearranged:

```
m = (decay − (1 − p)·retention) / p
```

`partial_multiplier()` in [`game_calculations.py`](math-sdk/games/ride_the_bus/game_calculations.py#L239)
and `partialMultiplier()` in [`game/math/payout.ts`](web-sdk/apps/Ride-The-Bus/src/game/math/payout.ts#L52).

**Read the left-hand side aloud:** "the chance I'm right times what I win, plus
the chance I'm wrong times what I keep." That is the expected multiplicative
change for this stage. Setting it to a constant means **every stage of every
mode has the same expected effect on the running total, no matter how likely
the guess was.**

That is the whole trick. A 6% "equal" guess and a 50% "red" guess are worth
exactly the same in expectation — the equal just pays far more, far less often.

### Where decay comes from

```python
decay = target_rtp ** 0.25          # target_rtp = 0.99
```

Four stages, each contributing `decay`, so a full round tends to `decay⁴ =
target_rtp`. Set in `target_rtp_decay()`; `TARGET_RTP` / `DECAY` mirror it in
`payout.ts`.

**`target_rtp` (0.99) is not the published RTP (0.96).** It is the pull the
formula exerts to cluster every mode together. The exact published figure is
set afterwards — see reweighting.

### Retention: what a miss keeps

```python
BASE_RETENTION = (0.0, 0.3, 0.3, 0.3)
```

Stage 1 keeps **nothing** — a wrong first card loses the round outright. Stages
2–4 keep 30%.

Stage 1 is lethal on purpose, and the reason is mechanical rather than
dramatic: it is what keeps roughly half of all rounds paying zero, and the
reweighter (below) can only move RTP by adjusting the weight of losing
outcomes. Take away the losses and it has nothing to tune with. The comment on
`MODE_FAMILIES` in `game_calculations.py` records an attempt to forgive card 1
that had to be reverted for exactly this reason.

### The decay term on a bust

When a round busts at stage *i*, the stages never played still have to be
accounted for:

```python
running_multiplier *= stage_retention
running_multiplier *= decay ** (3 - stage_index)
```

Each unplayed stage would have contributed an expected factor of `decay`, so
its expected contribution is applied analytically instead of simulated. Busting
at stage 2 is worth exactly what playing on would have been worth, in
expectation.

**This is only valid because `decay` is a fixed constant** rather than derived
from this round's own cards. Substituting it for stages that never happened
preserves the expectation exactly. If `decay` ever became per-round, this line
would silently become wrong.

### Flooring, never rounding

```python
quantized = math.floor(raw * 10) / 10
```

Stake's RGS only accepts payout multipliers in 0.1× steps. It **must floor**:
a fair 50/50 single stage pays 1.96×, and rounding to nearest would give 2.0× —
wiping out the house edge entirely. `quantize_multiplier()` / `quantizeMultiplier()`.

The floor is applied **once, to the final compounded multiplier**, not per
stage.

### Reweighting: the exact 0.96

The martingale gets every mode *close*. It doesn't get them *identical*,
because the published lookup table records each mode's **sampled** RTP, and
high-variance modes stay noisy no matter how many simulations you run.

[`reweight_luts.py`](math-sdk/games/ride_the_bus/reweight_luts.py) fixes this
after the fact. Every simulated round is kept — the on-screen card variety is
untouched — and only two weight tiers are scaled:

- every **winning** outcome gets weight `K`
- every **losing** outcome gets weight `w0`

solved so that:

```
RTP = K·Σ(win payouts) / (K·num_wins + w0·num_losses) == 0.96
```

A mode whose raw RTP is too high gets its losses *up*-weighted; too low, and
they're *down*-weighted. Because ~half of all rounds are stage-1 busts, there
is always plenty of zero-weight to tune with.

Result: **192 modes, all at RTP 96.0000%, spread 0.000000%.**

---

## 4. The three families

Same four guesses, same deck. The only thing that differs is **what a miss
keeps** — and that alone reshapes the entire payout curve.

| Family | Prefix | Retention on a miss | Max win | Forgiveness |
|---|---|---|---|---|
| Classic | *(none)* | card 1 nothing, then 30% | 1354.2× | none |
| Second Chance | `sc_` | card 1 nothing, then 30% | 585.2× | first miss from card 2 keeps 50%, **play continues** |
| High Stakes | `hs_` | card 1 nothing, then 20% | 1910.2× | none |

Defined once, in `MODE_FAMILIES` in
[`game_calculations.py`](math-sdk/games/ride_the_bus/game_calculations.py#L83),
and mirrored as `FAMILY_RULES` in
[`game/math/modes.ts`](web-sdk/apps/Ride-The-Bus/src/game/math/modes.ts).

**These two structures are name-mirrors, not imports.** Nothing enforces their
agreement at build time. `payout.test.ts` is what catches drift, by replaying
every published book.

### Why forgiving *raises* the ceiling for others

Because every family is reweighted to the same 0.96, generosity in one place
has to be paid for in another. Second Chance forgives a miss, so its wins are
smaller — 585.2× against Classic's 1354.2×. High Stakes keeps only 20% on a
miss, so each correct guess is priced higher, and it reaches 1910.2×.

**They are the same dial seen from opposite ends.**

### All three cost 1.0×, and that is forced

Second Chance and High Stakes used to cost 2.0×. Both had to come down.

`etl40b` — expected payout from wins of at least 40× the cost — is summed as an
**absolute** figure against a fixed 0.9 limit, and is **not divided by cost**. A
2× mode must average 1.92× to return 96%, so it pays twice as much for the same
shape and its `etl40b` doubles automatically:

| design | cost 1 | cost 2 |
|---|---|---|
| Classic, retention 0.3 | 0.560 | 1.120 ✗ |
| High Stakes, retention 0.2 | 0.678 | 1.356 ✗ |
| Second Chance, forgive 0.5 | 0.325 | 0.650 |

Even Classic's shape fails at 2×. Only a *low*-volatility mode survives the
doubling, which is the opposite of what High Stakes exists for.

**If you see `3820.5×` anywhere, it is High Stakes' ceiling from the 2×-cost
era** — every payout was doubled then. The current figure is 1910.2×.

### Two different ceilings, both needed

- `FAMILY_RULES[f].maxWin` — the **family's** headline ceiling
- `MODE_CEILINGS[mode]` — what **one specific mode** can actually reach

Only 8 of each family's 64 modes reach the family figure, so the headline alone
overstates a typical bet about fivefold. `modeCeilings.ts` is **generated from
the build** by `scripts/mode-ceilings.js`, never enumerated by hand — the
published tables are sampled, and 24 of 48 groups disagree with theory.

---

## 5. What the math build actually produces

```
cd math-sdk && .venv/Scripts/python.exe games/ride_the_bus/run.py
```

**Never run this casually — it is ~43 million simulations across 192 modes and
takes 40+ minutes.**

[`run.py`](math-sdk/games/ride_the_bus/run.py) runs six steps in order:

1. **`create_books()`** — simulate every mode. Eight parallel worker
   processes, each taking a disjoint slice of the global simulation index.
   Results are identical regardless of worker count, because
   `reset_seed(sim)` seeds the RNG from the **global index alone**.
2. **`generate_configs()`** — write the published config files.
3. **`reweight_all()`** — pin every mode to exactly 0.96. Must run *after*
   step 2, because the pipeline only writes a raw weight-1 table when one is
   absent; this overwrites it.
4. **`execute_all_tests()`** — verify, and write `stats_summary.json`, the RTP
   / variance / ETL figures the approval dashboard reads.
5. **`replay-events.js`** → `REPLAY_EVENTS.md`
6. **`mode-ceilings.js`** → `src/game/math/modeCeilings.ts`

Steps 5 and 6 are folded in deliberately. Both products are derived from *this
build's* simulation indices, so every rebuild invalidates them — and **a stale
table is worse than no table, because it looks correct.**

### Simulation counts scale with rarity

```python
SIMS_BY_EQUAL_COUNT = {0: 1e5, 1: 2e5, 2: 8e5}
```

Two `equal` picks is roughly a 1-in-3,600 win. A flat count would leave those
modes with a handful of wins and unusably noisy RTP. The 100k floor is Stake's
stated minimum per bet mode.

### A book

Each simulated round is a **book** — a list of events:

```json
{ "index": 0, "type": "reveal", "stage": 1,
  "card": { "rank": "K", "suit": "♠" },
  "choice": "red", "correct": false, "payout": 1.96 }
```

…four of those, then:

```json
{ "index": 4, "type": "finalWin", "amount": 135420 }
```

`amount` is the **multiplier × 100**, capped at `wincap`
([`events.py:final_win_event`](math-sdk/src/events/events.py#L211)). 135420 →
1354.2×.

**This is the entire contract between the two halves.** The client never
re-derives the payout for an engine round; it reads `finalWin.amount`.

### The books are not in git

`math-sdk/.gitignore` line 9 is `**/library/**`. The 1.6 GB of books and
`stats_summary.json` exist only on the machine that built them. Every test that
reads the math tree therefore **skips** rather than fails elsewhere — which is
deliberate, but only safe because it's written down.

---

## 6. The RGS: four endpoints

The Remote Gaming Server sits between the client and the money. The client
never computes a payout it then credits — it asks, and reports what came back.

[`packages/rgs-requests/`](web-sdk/packages/rgs-requests/) — vendored SDK, four
endpoints:

| Endpoint | When | Gives back |
|---|---|---|
| `/wallet/authenticate` | once, on load | balance, currency, bet limits, **any round already open** |
| `/wallet/play` | one per round | the **book**, and the post-debit balance |
| `/wallet/end-round` | after a **winning** round | credits the win, closes the round |
| `/wallet/balance` | polled | balance |

### The lifecycle, and the trap in it

```
authenticate ──→ play ──→ (reveal) ──→ end-round ──→ play ──→ …
                   │                        │
                   └── debits the stake     └── credits the win, CLOSES the round
```

**A winning round that is never closed blocks the next bet.** The round stays
"active" and the next `/wallet/play` is rejected with `ERR_VAL`. That is
exactly why the game once blocked immediately after the first win.

Losing rounds (0 payout) **auto-close** on the RGS and need no `end-round` —
which is why consecutive losses kept working and hid the bug.

Guarded in [`roundSettle.svelte.ts`](web-sdk/apps/Ride-The-Bus/src/game/round/roundSettle.svelte.ts),
with a defensive `end-round` at the top of `roundPlace` for the case where a
previous close failed.

### The balance trap

```ts
if (typeof amount === 'number' && Number.isFinite(amount)) { … }
```

Checked as a **finite number**, not `!== undefined`. The older guard let `null`
through — and `null / 1_000_000` is `0`, so a response carrying
`balance: { amount: null }` zeroed the displayed balance outright and killed
the run on the next affordability check.

### Resume

`/wallet/authenticate` can come back with a round already open — a player who
closed the tab mid-round. The client restores it, including **applying
`parsed.family`** from the mode slug. Handled in
[`roundRestore.svelte.ts`](web-sdk/apps/Ride-The-Bus/src/game/round/roundRestore.svelte.ts).

---

## 7. The client: one round, three files

A round reads as three files, in order, and the dependencies only ever point
forwards:

```
roundPlace ──→ roundReveal ──→ roundSettle
```

### `roundPlace.svelte.ts` — spend the money

1. **Defensive `end-round`**, gated on `engineRound.open` — so a clean run
   doesn't put a failed request in the network tab every spin.
2. **Build the mode slug** from family + four guesses. Naming a mode the math
   never published gets the bet rejected outright.
3. **`/wallet/play` through `pacedPlay`**, so nothing can outrun the RGS.
4. **A single-flight gate**, so a spacebar tap and the autoplay loop 400 ms
   behind it cannot place two bets on one round.
5. **The regulator's minimum round duration**, applied *after* the result is on
   screen rather than by slowing the reveal — the rule exists so a player can
   register the outcome.

### `roundReveal.svelte.ts` — turn the book into cards

`animateRoundFromEvents()` is the door in, and it is **shared**: a freshly
placed bet arrives through it, and so does a replay, which has no bet to place
at all. That's why it lives with the reveal rather than the placing.

It filters the book's `reveal` events into `round.revealEvents`, reads
`finalWin.amount / 100` into `round.engineFinalMultiplier`, then plays the
cards one at a time with their cues.

### `roundSettle.svelte.ts` — the money

```ts
const multiplier = round.engineFinalMultiplier
                ?? computeFinalMultiplier(round.revealEvents, familyRules());
```

**The server's figure wins.** The local formula is a fallback for when there's
no RGS session at all (local dev). Displaying anything other than what was
credited is the worst bug this project can have.

Then four branches: replay (credit nothing, close nothing), local fallback
(credit locally), zero payout (auto-closed, nothing to do), or a win (`end-round`).

---

## 8. Where client state lives

`Game.svelte` was 3,789 lines. It is now 709, and the state lives in rune
modules under [`src/game/`](web-sdk/apps/Ride-The-Bus/src/game/):

```
audio/  round/  bet/  math/  celebration/
ui/  dev/  jurisdiction/  platform/
```

### The rune-module rule

**An exported `let` cannot be reassigned across a module boundary**, so every
one of these exports a single `$state` object instead:

```ts
export const round = $state({ bustedIndex: null, … });
```

You write `round.bustedIndex`, `bet.family`, `auto.running`.

### The dependency DAG, and why it is one

```
betState ─┐
revealPacing ─┤
autoplaySettings ─┼─→ roundPlace ─→ roundReveal ─→ roundSettle
roundState ─┤          └─→ autoplayLoop
celebrationState ─┘
```

**Autoplay is split in two on purpose.** `startAuto` calls the round flow, and
the round flow reads `auto.running` back out. In one module that is a cycle;
with the settings on their own it is a DAG.

### `$effect` only runs inside a component

Which is why the effects stay in `Game.svelte` — including the replay effect
and the resume effect, the two places that must apply `parsed.family`. Keeping
them side by side is what lets `modes.test.ts` check there are exactly two.

### The `bet` shadow

**`bet` means betState's bet. The RGS resume payload is `resume`.** All three
restore blocks used to call the payload `bet`; once the bet state became an
object of that name, `bet.family = parsed.family` assigned to the *payload* and
the family was silently never restored. `modes.test.ts` now fails on any local
`bet` declaration.

---

## 9. The screen

```
Game.svelte                    layout root, intro phases, popup switchboard,
                               audio wiring, balance poll, the effects
├── components/board/          ControlBar, GameBoard, SessionReadouts,
│                              TableScene, WinCelebration
├── components/intro/          StartScreen, IntroPanels, ReplayDetails, GameLoader
├── components/icons/          BoltMeter, ChoiceIcon, MarkIcon, SoundIcon, SuitIcon
└── components/popups/         Mode, Bet, Turbo, Sound, Autospin, Advanced,
                               HowToPlay, ErrorModal
```

### Why every component owns its own stylesheet

**svelte-check reports an unused selector as a WARNING, and `check:svelte` must
come back at zero.** So a rule in a sheet whose importing component doesn't
render it is a *build failure*. There is no shared stylesheet — `.action-button`
and `.popup-sub` are *copied* into the panels that use them.

The one exception is `styles/board/readout.css`, holding `.cb-cap` and
`.cb-val`, imported by both `ControlBar` and `SessionReadouts`. Those two carry
the money-fitting contract `use:fitValue` depends on, and two copies that must
stay in step is worse than one shared sheet with two real importers.

### Svelte scoping bites child components

A stylesheet is scoped to the component that **imports** it, and a child's
elements never carry the parent's scope class. A `.bolt` rule in the parent's
sheet compiles to `.bolt.svelte-<parent>` and matches nothing. Children style
themselves and take **custom properties** from the parent, which inherit
through the DOM normally.

This also means **a component's graph degree under-reports**. `BoltMeter` shows
degree 1; the real figure is five, because `--vol-sc`, `--vol-base`, `--vol-hs`
and `--mode-ink` couple it to four more files. No stylesheet is in the graph.

### The win takeover

`WinCelebration.svelte` — its centrepiece is **the four cards just played**,
fanned, snapshotted into `celebration` rather than referenced. Every tier draws
the whole scene; escalation is intensity, never presence, and `.tier-*` rules
may set nothing but custom properties.

**"A full game win" is `isCleanSweep(bustedIndex, forgivenIndex)`, never "did
not bust"** — and four separate decisions ask it. A forgiven Second Chance
round has no bust marker but is not a clean sweep.

---

## 10. How the two halves stay honest

If the client's arithmetic drifts from the Python, the game shows a player one
number while the RGS credits another. **That is the worst bug this project can
have.**

| Guard | What it does |
|---|---|
| `payout.test.ts` | replays **every published book** — all 76,800 — and checks the client reaches the same figure |
| `modes.test.ts` | greps for the four `isCleanSweep` sites, both `parsed.family` restore sites, and any local `bet` shadow |
| `winTiers.test.ts` | pins the Max band matched on equality, every band below on `>=` |
| `volatility.test.ts` | re-derives the volatility ratings from `stats_summary.json` |
| `locales.test.ts` | 16 locales, no missing keys, no values left identical to English |
| `sources.test.ts` | every path in the manifest exists |

### The grep tests read a manifest

Eight test files assert on the game's source **as text**, because what each
guards fails *silently* — a forgiven card that sounds like a bust, a mode
restored without its family, a class renamed out from under `pressKindFor`.

They read [`game/sources.testlib.ts`](web-sdk/apps/Ride-The-Bus/src/game/sources.testlib.ts),
which lists every file the component was split into and concatenates them.

**When a split moves code out of a listed file, add the new file to that
manifest in the same commit.** There is no glob and no `existsSync` filter: a
filter would turn a typo into a grep test that quietly stopped looking at
anything.

### The gates

```
npm run test          # 719 tests
npm run check         # tsc
npm run check:svelte  # 0 errors AND 0 CSS warnings
npm run lint
npm run audio         # required for any audio change
```

`npm run audio` exists because the author of most of this code cannot hear it:
it taps the running game's real output, writes a WAV, and renders a spectrogram
and waveform plus metrics. `sound.test.ts` pins what gets *scheduled* and says
in its own header that it cannot tell you whether the result sounds good.

---

## 11. Running it locally

```
cd web-sdk/apps/Ride-The-Bus
npm run dev:replay      # game on :3001, local replay RGS on :3010
```

Open **http://localhost:3010** to build links for any of the 192 modes, or use
the "Regular game" link at the bottom for a plain session with no replay.

`scripts/replay-server.mjs` stands in for the real RGS. `game/dev/devSession.ts`
lets the URL stand in for the `/wallet/authenticate` response.

### Looking at it

```
npm run shots -- --board     # the idle board and bar, all seven sizes
npm run shots -- --sizes     # a settled max win at each size
npm run shots -- --tiers     # all five win tiers, desktop
npm run shots -- --intro     # intro and replay-details screens
```

Shots land in `scripts/.shots/` (git-ignored). This exists because **the win
takeover was rewritten twice on the strength of the intent recorded in its own
stylesheet, and both times the intent was right and the render was not.**

### The seven target sizes

| Size | Viewport |
|---|---|
| Desktop | 1200 × 675 |
| Laptop | 1024 × 576 |
| Popout L | 800 × 450 |
| Popout S | 400 × 225 |
| Mobile L | 425 × 812 |
| Mobile M | 375 × 667 |
| Mobile S | 320 × 568 |

The first four are **exactly 16:9**, which is what lets one arrangement work
across the whole range. **Mobile is the only place anything may be rearranged.**
Popout S is Popout L at exactly half size, and is laid out that way.

---

## 12. Reading order, if you want a path

**Half a day, to understand the maths:**

1. `game_calculations.py` — the `MODE_FAMILIES` comment block, then
   `partial_multiplier`, then `quantize_multiplier`
2. `gamestate.py` — the whole file; it is one loop over four stages
3. `reweight_luts.py` — the docstring alone

**Half a day, to understand the client:**

4. `game/math/payout.ts` — the same maths in TypeScript; read it against
   `game_calculations.py`
5. `game/round/roundPlace.svelte.ts` → `roundReveal` → `roundSettle`, in order
6. `game/round/roundState.svelte.ts` and `game/bet/betState.svelte.ts`
7. `components/Game.svelte` — last, once the modules make sense

**Then, for the reasoning behind any specific rule:**

- `CLAUDE.md` — the rules, and the two recurring bug classes
- `.claude/skills/rtb-invariants/references/` — the *arguments*, one file per
  group. Almost every rule records a defect that already shipped once, and
  several say plainly that the obvious alternative was tried and rejected.
- `.claude/skills/rtb-invariants/references/status.md` — what is built, what
  was measured, every open item

---

## What is not done

**`RGS_TEST_PLAN.md` holds 95 live-session checks and none has been run.** They
need a real Stake session and cannot be done locally. That is the single
biggest open item.

The game is **not yet submitted to Stake** — math, bet modes and mechanics are
all still changeable.
