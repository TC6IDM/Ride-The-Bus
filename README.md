# Ride The Bus

A Stake Engine casino game: the classic 4-stage card-guessing drinking game
(Red/Black → Higher/Lower → Inside/Outside → Guess Suit), with a multiplier
that compounds across the four stages.

The player commits to all four guesses **before** the bet is placed, and the
whole round then resolves in a single `/wallet/play` call — there is no
cash-out and no mid-round decision. Stake Engine requires every bet to be one
independent, stateless outcome, so the four choices are encoded in the bet
mode instead. Everything after the bet is
animation of an already-determined result.

## Bet modes

The same four guesses can be bought three ways. Only what a **miss** keeps
differs, and because every mode is reweighted onto the same 96.00% RTP, a mode
that forgives more cannot also pay more — the two are one dial seen from
opposite ends.

| Mode | Cost | A miss keeps | Max win | Pays something |
|---|---|---|---|---|
| Classic | 1.0× | nothing on card 1, 30% after | 1354.2× | ~1 in 2 |
| Second Chance | 1.0× | card 1 still ends it; after that the first miss keeps 50% and **play continues** | 585.2× | ~1 in 2 |
| High Stakes | 1.0× | nothing on card 1, 20% after | 1910.2× | ~1 in 2 |

A volatility ladder at one price, rather than paid feature modes. That is
forced, not chosen: `etl40b` — the expected payout from wins of at least 40× the
cost — is summed as an **absolute** figure against a fixed 0.9 limit and is not
divided by cost. A 2× mode must average 1.92× to return 96%, so it pays twice as
much for the same shape and its `etl40b` doubles. Even Classic's own shape fails
at 2× (1.120); only a low-volatility family survives the doubling, which is the
opposite of what High Stakes is for.

That is 3 families × 64 guess combinations = **192 published modes**. The
Classic family keeps its original unprefixed names, so replay event IDs
recorded against it stay valid; the others are prefixed `sc_` and `hs_`.

Two numbers here are not free choices:

- **High Stakes retention is 0.20.** Stake reads CVaR and Expected Tail
  Liability as the worst value across all modes, and a failed class shrinks the
  game's bet-level template. The binding metric is `etl40b`, not CVaR, and the
  build measures 0.695 and 568.8 against them.

  **The limits are per star tier**, and the binding pair for a new submission is
  the 2-star one — ETL 0.8 and CVaR 700, not the 0.9 / 800 of the 3-star tier.
  Retention could go lower than 0.20 — but not much, and the margin is what
  runs out first. Exact enumeration of all 64 combinations at each retention,
  reweighted the way `reweight_luts.py` does, gives:

  | Retention | etl40b (2★ 0.8 / 3★ 0.9) | CVaR (2★ 700 / 3★ 800) | Max win |
  | --- | --- | --- | --- |
  | 0.30 (Classic) | 0.553 | 429 | 1354.2× |
  | **0.20 (shipped)** | **0.689** | **551** | **1910.2×** |
  | 0.15 | 0.764 | 618 | 2237.3× |
  | 0.10 | **0.842 ✗ (2★)** | 689 | 2599.5× |
  | 0.05 | **0.880 ✗ (2★)** | **763 ✗ (2★)** | 2998.5× |
  | 0.025 | **0.898 ✗ (2★)** | **802 ✗** | 3212.3× |
  | 0.00 | **0.960 ✗** | 329 | 3436.1× |

  The published build reads 1–3% above these (it samples its tail where this
  enumerates it). Against the 2-star limits that makes **0.15 the practical
  floor**, not 0.10 — 0.10 enumerates at 0.842 and is already over 0.8 before
  the build's own margin is added. 0.20 keeps 14% of headroom under ETL 0.8,
  which is what a metric read as a worst-case across 64 modes needs.

  Zero is not the end of a gradient, it is a cliff: with nothing kept, the only
  rounds that pay are the 4-for-4 ones, so the reweighter has to make wins rare
  enough to hit 96% RTP and the hit rate collapses from ~1 in 2 to **1 in 3,530**.
  Anything below 0.20 also breaks the family's 2000× wincap, which would have to
  be raised with it.
- **Card 1 is never forgiven.** Forgiving it left almost no round paying zero,
  which pushed Second Chance's win-conditional mean below its reweight target —
  and `reweight_luts.py` can only move RTP by re-weighting losses, so with
  almost none to work with it refuses rather than emit a non-compliant table.

Both are recorded in `math-sdk/games/ride_the_bus/game_calculations.py`
(`MODE_FAMILIES`) and mirrored in `web-sdk/apps/Ride-The-Bus/src/game/modes.ts`
(`FAMILY_RULES`). The client resolves every round locally to draw it, so those
numbers necessarily exist twice; `payout.test.ts` and `modes.test.ts` are what
stop them drifting.

The project has two halves, matching Stake Engine's split between frontend
and math/RGS backend:

- **`web-sdk/`** — the game client (Svelte 5 + PixiJS), forked from
  [StakeEngine/web-sdk](https://github.com/StakeEngine/web-sdk). The game
  itself lives at `web-sdk/apps/Ride-The-Bus`.
- **`math-sdk/`** — the math/RGS backend (Python), forked from
  [StakeEngine/math-sdk](https://github.com/StakeEngine/math-sdk). The game
  itself lives at `math-sdk/games/ride_the_bus`.

Both halves must be built and published to Stake Engine for the game to run
there — publishing only one half is why you'll see a black screen / 404s if
you skip a step.

## Prerequisites

- Node 22.16.0 and pnpm 10.5.0 (for `web-sdk`)
- Python 3.x (for `math-sdk`)

Everything below runs from inside this repo. There is no second checkout to
copy files to or from: edit here, build here, commit here.

## Command summary

Paths are relative to the repo root. Windows shown; on macOS/Linux swap
`.venv\Scripts\python.exe` for `.venv/bin/python`.

| What | Where | Command |
| --- | --- | --- |
| Run the game locally | `web-sdk` | `pnpm run dev --filter=ride-the-bus` |
| Build the frontend | `web-sdk` | `pnpm run build --filter=ride-the-bus` |
| Test the frontend | `web-sdk\apps\Ride-The-Bus` | `pnpm test` |
| Build the math | `math-sdk` | `.venv\Scripts\python.exe games\ride_the_bus\run.py` |
| Test the math | `math-sdk` | `.venv\Scripts\python.exe -m pytest tests\` |

## Build & publish: math-sdk (RGS backend)

```
cd math-sdk

# first time only
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m pip install -e .

# generate books/paytables
.venv\Scripts\python.exe games\ride_the_bus\run.py
```

This is a long run - simulations across all 192 bet modes, on 8 worker
processes - and it writes everything under
`math-sdk\games\ride_the_bus\library\`.

Simulation counts are tiered by how many "equal" guesses a mode requires (100k /
200k / 800k), because the rare combinations need far more runs to land enough
wins to be representative. 100k is a floor rather than a preference: Stake's math
approval asks for 100,000 to 1,000,000 per bet mode, and `run.py` asserts it -
including after the thread split, since `run_sims.py` truncates and an uneven
split would silently drop simulations.

`run.py` finishes by regenerating [REPLAY_EVENTS.md](REPLAY_EVENTS.md), because
those IDs come from the simulation set and a rebuild invalidates them. It is
best-effort: if Node is missing it warns rather than failing a build that has
already produced valid files.

**Upload the contents of `math-sdk\games\ride_the_bus\library\publish_files\`**
to Stake Engine's Files page, under the Math/RGS section for this game. That is
385 files: one `books_<mode>.jsonl.zst` and one `lookUpTable_<mode>_0.csv` per
bet mode (192 of each), plus a single `index.json`. Around 1.6 GB in total -
well inside Stake's limits, which cap a single events file at 4.2 GB and a
single mode at 10,000,000 events (the largest book here is ~15 MB, and the
biggest mode simulates 800,000 rounds).

### Test the math

```
cd math-sdk
.venv\Scripts\python.exe -m pytest tests\
```

13 tests, under a second. These cover the win calculations only and need no
build output, so they are safe to run before a build.

`run.py` finishes by verifying the published files itself and writing
`library\stats_summary.json` - the RTP / variance / ETL figures the approval
dashboard reads. To re-run just that check against an existing build (it
catches payout-format issues like `ERR_MATH_OUTSIDE_RANGE` locally instead of
on the dashboard):

```
.venv\Scripts\python.exe -c "from utils.rgs_verification import execute_all_tests, load_game_config; execute_all_tests(load_game_config('ride_the_bus'))"
```

Should print `SHA-256 OK, payout hash OK, ...` with no assertion errors.

## Build & publish: web-sdk (frontend)

```
cd web-sdk
pnpm install   # first time only
pnpm run build --filter=ride-the-bus
```

**Upload the contents of `web-sdk\apps\Ride-The-Bus\build\`** to Stake
Engine's Files page, under the Front End section.

The build process does not always exit cleanly on Windows. Check for emitted
assets in `web-sdk\apps\Ride-The-Bus\build\_app\immutable\assets\` rather than
waiting on the exit code, and stop the dev server first - a build and a dev
server on the same app contend with each other.

Then on the dashboard: **Publish Game** → publish both Math/RGS and Front
End (publishing only one half leaves the other stale and the game won't run).

### Test the frontend

```
cd web-sdk\apps\Ride-The-Bus
pnpm test
```

680 tests (`node --test "src/**/*.test.ts"`). One of them, `parity with the
published books`, reads the math build out of
`math-sdk\games\ride_the_bus\library\publish_files\` and replays real books
through the client's payout arithmetic. It skips itself if that directory is
missing, and **fails if the directory holds output from an older math build** -
so if it reports mismatches, rebuild the math before believing the frontend
broke.

## Run locally

```
cd web-sdk
pnpm run dev --filter=ride-the-bus
```

Opens at `http://localhost:3001`. Without a live RGS session, the game falls
back to a local deterministic mode (`roundContract.ts`) so the UI is still
playable — this does **not** exercise the real math backend.

To test against the real RGS locally: start a session from Stake Engine's
**Developer** page (Start game session → Launch in New Tab), copy the query
string from the launched URL, and append it to `localhost:3001`, e.g.:

```
http://localhost:3001/?sessionID=...&rgs_url=...&currency=USD&...
```

That routes play through the real math backend instead of the local
fallback.

## Submitting for approval

### Read this first: three modes, 192 bet modes

A reviewer opening the dashboard sees **192 bet modes** and should know why
before counting them.

A player sees **three**: Classic, Second Chance and High Stakes. But all four
guesses are committed before the round is bought, so the guesses are part of the
wager rather than decisions taken during it - which is what keeps every round a
single, independent, stateless bet with no continuation and no cash-out. Each
distinct set of guesses is therefore its own bet mode:

> 3 families x 2 colours x (3 x 3 - 1) higher/lower x inside/outside pairs x 4 suits = **192**

The `- 1` is Equal-then-Inside, which is impossible rather than merely unlikely:
nothing falls strictly between two cards of the same rank, so that mode would
lose 100% of the time, have zero variance, and be rejected by the RGS on upload.
The client bars the same combination in the UI.

Consequences worth knowing:

- **All 192 cost 1.0x.** No mode is a purchase or a premium.
- **All 192 return 96.00%**, with a spread of 0.000000%.
- **Each has its own maximum win**, from 39.5x to 1910.2x. The three headline
  ceilings (1354.2x / 585.2x / 1910.2x) are the most each *family* can reach,
  and exactly 8 of each family's 64 combinations reach them. How to Play states
  the family ceiling **and** what the four guesses currently picked top out at,
  because Stake asks for the maximum win per bet mode and every combination is
  one.
- **[REPLAY_EVENTS.md](REPLAY_EVENTS.md) is the index.** It carries a loss, a
  normal win, a big win and a win-cap simulation ID for all 192, plus two
  round-shape scenarios, so any mode can be replayed without hunting for an ID.

### What has been checked, and what has not

Verified against Stake's math, RGS and frontend approval criteria:

| | |
| --- | --- |
| RTP 90-96.70%, all modes within 0.5% | 96.00% on every one of the 192 modes, spread 0.000000% |
| Simulations per bet mode | 100k minimum, asserted in `run.py` |
| Non-zero win hit rate, target better than 1 in 20 | 1 in 1.45 to 1 in 2.03 across all modes |
| Max win obtainable, target better than 1 in 10,000,000 | 1354.2x / 585.2x / 1910.2x per family, worst case 1 in 193,283 |
| Max win stated per BET MODE | each of the 192 has its own ceiling; How to Play names the one for the guesses on the board |
| No jackpot, gamble or cash-out | none - the single-bet design rules them out |
| Static files only, no external requests | the only network call is the RGS itself |
| Bet levels, `stepBet`, min/max from `authenticate` | honoured; nothing hardcoded |
| `rgs_url` read from the query string | never hardcoded |
| Rules popup states RTP, mode cost and max win | in How to Play |
| Legal disclaimer, all seven required points | in How to Play, reachable during play |
| Spacebar bets, mute exists, autoplay needs confirming | all present |
| Bet replay (mandatory) | implemented |
| Localisation | 16 languages; only English is required |

**Not verified, and worth doing before submitting:** everything above was
checked locally, where the game runs on the `roundContract` fallback rather than
a real RGS. Several bugs found late in development were invisible locally and
only appeared against a live session - an unwinnable bet mode the UI allowed,
guesses that stayed editable across the two round trips of placing a bet, and a
replay that started animating behind the loading screen. Play real rounds
through a Developer-page session before submitting, replay included.

[RGS_TEST_PLAN.md](RGS_TEST_PLAN.md) is that pass, written out: 95 checks
covering settlement, autoplay endurance, the jurisdiction flags, currency
display, replay and the compliance surface, each with the reason it exists. It
is weighted towards the paths the local fallback never executes, because that is
where every late bug in this project has come from.

The quality rating itself is three anonymous reviewers scoring 0 to 3 in
fractional steps, averaged and rounded. **1 star is not a publication** - the
ranking table calls it "Not published. The developer will be asked to resubmit
once improvements have been made." 2 stars may reach Burst Games and Stake
Exclusives if demand supports it; 3 stars gets optimal positioning. Polish and
originality drive it. Once approved, only cosmetic changes are permitted - math,
bet modes and mechanics are frozen.

Two of the named causes of a 1-star rating land directly on this build:
"over-reliance on generic AI-generated assets - standard fonts, gradients, emoji
icons and border effects are not sufficient for a quality release", and
"missing engaging features". The art pass is therefore a gate, not polish. See
the verbatim criteria in [CLAUDE.md](CLAUDE.md#game-quality-rankings).

### Replay event IDs

Approval requires replay event IDs **per bet mode**, covering normal win, big
win, win cap and loss. With 192 bet modes that is 768 IDs, so they are derived
from the published lookup tables rather than collected by hand, into
[REPLAY_EVENTS.md](REPLAY_EVENTS.md) - the full table, with the payout
multiplier beside each ID so a reviewer can see what the round is meant to
demonstrate.

**The math build regenerates it automatically**, so normally there is nothing to
run. To rebuild the table on its own - after editing the generator, or if the
build warned that Node was missing:

```
node scripts/replay-events.js
```

The table lists simulation IDs from the published lookup tables, and that is the
right thing to send: Stake's replay documentation defines the `event` query
parameter as the "unique simulation ID to replay", and the `{event}` segment of
`GET {rgs_url}/bet/replay/{game}/{version}/{mode}/{event}` takes the same value.
No recapture from a live session is needed.

### Game tile

Tiles are composed by Stake from assets submitted with the game, not shipped in
the build, so nothing in this repo produces them. **Three** assets are required,
with fixed naming, and **background + foreground must not exceed 3 MB combined**:

| Asset | Requirement | Filename |
|---|---|---|
| Background | Environmental background showing the world of the game. High-res PNG or JPG. | `RideTheBus-BG.png` |
| Foreground | A feature character or key item representing the game. High-res PNG, transparent background. | `RideTheBus-FG.png` |
| Provider logo | The studio logo. High-res PNG, transparent background, legible at small sizes. | `TakeoverCasino-Logo.png` |

Stake's guidance is that low-quality or visually unappealing artwork "often
results in lower player trust, lower interest and ultimately lower game
engagement" - the tile is judged, not just accepted. The full requirement is
reproduced in [CLAUDE.md](CLAUDE.md#game-tile-visual-assets).

## Project structure notes

- Each SDK folder is a full fork (framework + all sample apps/games from
  Stake Engine, not trimmed) — both need their shared framework code
  (`web-sdk/packages/*`, `math-sdk/src/*`) to build.
- Build output and environments are gitignored and never committed:
  `web-sdk/**/build`, `.svelte-kit`, `node_modules`, `.turbo`,
  `math-sdk/.venv` and `math-sdk/games/ride_the_bus/library`. A fresh clone
  therefore has no math output until you run the math build, and the
  frontend's parity test will skip itself until you do.
- `web-sdk/packages/*` carries local patches to the Stake SDK (search for
  `LOCAL ADDITION`) — re-apply them if those packages are ever updated from
  upstream.
- `web-sdk/apps/Ride-The-Bus` keeps its own commit history from before this
  repo was restructured (see `git log` — the "Add 'web-sdk/apps/Ride-The-Bus/'
  from commit ..." merge commit and its second parent chain).
- Round model: the math backend generates one full book per bet — the fixed
  4-card sequence plus each stage's fair-odds payout table (based on true
  remaining-deck probability minus a 2% house edge, quantized to 0.1x steps
  per Stake's RGS requirements). The client resolves each guess against that
  data locally, matching how Stake Engine's documented RGS API works (one
  `/wallet/play` call returns the whole round; there's no live per-decision
  endpoint).
