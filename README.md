# Ride The Bus

A Stake Engine casino game: the classic 4-stage card-guessing drinking game
(Red/Black → Higher/Lower → Inside/Outside → Guess Suit), with a multiplier
that compounds across the four stages.

The player commits to all four guesses **before** the bet is placed, and the
whole round then resolves in a single `/wallet/play` call — there is no
cash-out and no mid-round decision. Stake Engine requires every bet to be one
independent, stateless outcome, so the four choices are encoded in the bet
mode instead (64 modes, one per combination). Everything after the bet is
animation of an already-determined result.

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

This is a long run - 14.4M simulations across the 64 bet modes, on 8 worker
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
129 files: one `books_<mode>.jsonl.zst` and one `lookUpTable_<mode>_0.csv` per
bet mode (64 of each), plus a single `index.json`.

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

130 tests (`node --test "src/**/*.test.ts"`). One of them, `parity with the
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

### What has been checked, and what has not

Verified against Stake's math, RGS and frontend approval criteria:

| | |
| --- | --- |
| RTP 90-98%, all modes within 0.5% | 96.00% on all 64 modes, spread 0.000000 |
| Simulations per bet mode | 100k minimum, asserted in `run.py` |
| Non-zero win hit rate, target better than 1 in 20 | about 1 in 2 |
| Max win obtainable, target better than 1 in 10,000,000 | 1354.2x at about 1 in 3,833 |
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

[RGS_TEST_PLAN.md](RGS_TEST_PLAN.md) is that pass, written out: 52 checks
covering settlement, autoplay endurance, the jurisdiction flags, currency
display, replay and the compliance surface, each with the reason it exists. It
is weighted towards the paths the local fallback never executes, because that is
where every late bug in this project has come from.

The quality rating itself is three anonymous reviewers scoring 0 to 3 in
fractional steps, averaged and rounded. Below 1.0 is not approved; 1 star is
published at the bottom of New Releases; 2 stars may reach Burst Games and Stake
Exclusives if demand supports it; 3 stars gets optimal positioning. Polish and
originality drive it. Once approved, only cosmetic changes are permitted - math,
bet modes and mechanics are frozen.

### Replay event IDs

Approval requires replay event IDs **per bet mode**, covering normal win, big
win, win cap and loss. With 64 bet modes that is 256 IDs, so they are derived
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

One thing to confirm before sending that table to reviewers: it lists simulation
IDs from the lookup tables, on the assumption that the `{event}` segment of
`GET {rgs_url}/bet/replay/{game}/{version}/{mode}/{event}` accepts one. If
reviewers expect a round or bet ID issued by the RGS during live play instead,
the IDs need recapturing from a real session - the scenarios and payouts in the
table still say which round to play in each mode.

### Game tile

Tiles are composed in the Stake Engine dashboard's **Tile Editor**, not shipped
in the build, so nothing in this repo produces them. Four layers are needed:

| Layer | Requirement |
|---|---|
| Background | High-res PNG/JPG, **brighter than the Stake platform** - dark backgrounds blend into it. No dark edges. No text, no multipliers. |
| Foreground | High-res PNG, transparent background, key character or item enlarged to fill the focus area. No text, no multipliers. |
| Gradient | Light overlay in a colour already prominent in the artwork, enough to make the title readable without dominating. Avoid bright yellow, green and blue. |
| Title | Fits the title guide's height, fills the text box width, at most two text sizes. |

Tiles are rejected for dark edges, low-contrast backgrounds, or text and
multipliers baked into the imagery. The provider logo is separate and set once
under Team Settings -> Branding (PNG/JPG/GIF up to 10MB, square, transparent
background recommended); it is applied to every tile automatically.

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
