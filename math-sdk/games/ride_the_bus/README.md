# Ride The Bus — math build

## Rebuilding

One command does everything. Run it from the **math-sdk root** with the venv's
Python (`make` is not required, and is not installed on the current dev machine):

```sh
cd "C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/math-sdk"
./.venv/Scripts/python.exe games/ride_the_bus/run.py
```

PowerShell:

```powershell
cd "C:\Users\tcand\Desktop\Ride-The-Bus-monorepo\math-sdk"
.\.venv\Scripts\python.exe games\ride_the_bus\run.py
```

Use the venv Python specifically — a bare `python run.py` fails with
`ModuleNotFoundError: src`, because `src` is only importable via the editable
install in the venv (`pip install -e .`, see the Makefile).

That runs six steps, which the build monitor below groups into four passes:

1. **`create_books`** — 44,000,000 simulations across the 193 bet modes
   (14.4M per four-guess family, 800k for Three of a Kind), in parallel
   (`num_threads = 8` in `run.py`). **Second Chance first, then Classic, High
   Stakes and Three of a Kind** — `FAMILY_BUILD_ORDER` in
   `game_calculations.py`, which every later step and every published list
   follows. It is a reading order only: a simulation's outcome is a function
   of its global index, never of when its mode ran.
2. **`generate_configs`** — writes `library/configs/config.json`,
   `library/publish_files/index.json` and the per-mode event configs.
3. **`build_rules.json`** — records the `MODE_FAMILIES` rules this build was
   made with. The client reads it to tell a build that PREDATES a rules change
   (stale: its parity tests skip and say what differs) from one whose numbers
   genuinely disagree with the client's arithmetic (drift: they fail).
4. **`reweight_all`** (`reweight_luts.py`) — rewrites every published `_0` lookup
   table so each mode lands on exactly `config.rtp`. **This is what makes all 193
   modes report the same RTP**, so the Cross-Mode RTP Consistency check passes.
   One line per mode, and one process per worker.
5. **`execute_all_tests`** (`utils/rgs_verification.py`) — verifies the published
   books/tables and writes `library/stats_summary.json`, the RTP / variance /
   ETL figures the approval dashboard reads. Also across `num_threads` workers.
6. **The two generators** — `scripts/replay-events.js` rewrites
   `REPLAY_EVENTS.md` (it scans the new books for a bust, a win and a
   second-chance round per mode, on worker threads) and
   `scripts/mode-ceilings.js` rewrites `modeCeilings.ts`. Both are products of
   THIS simulation set, so a rebuild invalidates them; both are best-effort and
   a missing Node will not fail the build.

**Step 1 no longer goes through the SDK's simulator.** The 800,000 shuffles
are dealt once (`library/deals_standard52.bin`, ~2s), and `direct_books.py`
scores every mode against them through `GameState.score_round` - the function
`run_spin` also calls - writing each mode's book, tables and sidecars in one
pass. **The simulate stage went from 33 minutes to about 68 seconds, and all
193 modes' files (1,352 of them) were byte-compared with the 2026-09-22 build:
identical.** It uses every logical CPU (`RTB_BOOK_WORKERS` overrides);
`RTB_DIRECT_BOOKS=0` goes back to `create_books`. The configs are written in
parallel AFTER the reweight (before, `config.json` hashed the previous build's
tables for one build after any rule change). CLAUDE.md has the detail.

The fast paths are held to the slow ones by tests - run them after touching
`gamestate.py`, `game_calculations.py` or anything in the deal cache:

```sh
./.venv/Scripts/python.exe -m pytest games/ride_the_bus/tests -q
```

**Testing a change to the simulator**, without a 34-minute build:

```sh
RTB_ONLY_MODES=red_higher_inside_heart ./.venv/Scripts/python.exe games/ride_the_bus/run.py
```

That simulates one mode into `library_test/` and stops before publish (a
partial set has nothing to publish, reweight or verify). Compare its
`publish_files/books_<mode>.jsonl.zst` and
`lookup_tables/lookUpTableSegmented_<mode>.csv` against `library/`'s: a mode's
simulations depend only on their own global indices, so anything that changes
those bytes changed the game. `MATH_LIBRARY_DIR` chooses the folder and
`MATH_WORKER_POOL=0` falls back to the old per-batch process spawning.

**Steps 4, 5 and 6 run in parallel, and `num_threads` sizes all three** (it
reaches the Node scan as `REPLAY_SCAN_WORKERS`). Each mode's files are its own,
so there is nothing shared to serialise on. Measured on the 2026-09-22 build,
8 workers against 1:

| Step | serial | parallel |
| --- | ---: | ---: |
| reweight | 60.6s | 13.3s |
| verify | 59.0s | 12.2s |
| scan (`replay-events.js`) | 61.0s | 17.8s |

**All three are idempotent and were proved byte-identical**: the reweighter
reads the *segmented* tables and writes the *published* ones, so re-running it
on a finished build rewrites the same bytes (193/193 md5s unchanged); the
verifier only reads, and its `stats_summary.json` came back identical; the
scan's `REPLAY_EVENTS.md` came back identical. That also means any of the three
can be re-run on its own against a build that already exists.

Expect roughly **40 minutes**.

## Watching a build

`run.py` opens a live view of itself at **http://127.0.0.1:8765** — 193 mode
boxes grouped by family, the four passes with their own progress bars, the eight
simulation workers as they start and report their RTP, an ETA, and every line
the build prints, beside them rather than scrolled past.

Each box shows four bars - simulate, reweight, verify, scan - in the game's
own volatility colours, and each fills for that mode as that mode passes it.

```sh
RTB_BUILD_MONITOR=0 ./.venv/Scripts/python.exe games/ride_the_bus/run.py   # without it
RTB_BUILD_MONITOR_PORT=9000     # serve somewhere else
RTB_BUILD_MONITOR_OPEN=0        # serve it, but do not open a browser
RTB_BUILD_MONITOR_LINGER=0      # exit as soon as the build ends (default: 15 min)
RTB_DEMO_PACE=3                 # slow the demo down enough to watch
./.venv/Scripts/python.exe games/ride_the_bus/build_monitor.py --demo   # a 45s fake build
```

`build_monitor.py` runs `run.py` as a child process and reads its output; the
terminal still gets every line unchanged, and the build itself is not modified
in any way by being watched. `build_monitor.py`'s own docstring explains why it
attaches that way (short version: the simulation workers are separate processes,
and their "Thread 3 finished with 0.961 RTP" lines exist only on the real
stdout). The last run's stage timings are kept in `library/build_timings.json`
and weight the next run's ETA; the whole transcript is in
`library/build_progress.jsonl`.

### Re-running verification on its own

Phase 4 used to be a separate step, and forgetting it left
`stats_summary.json` describing the *previous* build. It is now part of `run.py`,
but you can still run it alone — e.g. to re-check the published files without
re-simulating:

```sh
./.venv/Scripts/python.exe utils/rgs_verification.py -g ride_the_bus
```

Note this script writes to the **relative** path
`games/<game_id>/library/stats_summary.json`, so it silently produces nothing
unless the working directory is the math-sdk root. `run.py` pins the directory
itself, so the bundled phase 4 works from anywhere.

## Confirming a good build

`run.py` prints this near the end — the spread should be ~0:

```
Reweighted 193 modes to 0.9600: realized RTP 96.0000%-96.0000% (spread 0.0000%)
```

Then spot-check the published config and stats:

```sh
cd games/ride_the_bus
grep -o '"maxWin": [0-9]*' library/configs/config.json | sort -u   # -> 700 1400 2300 4700
```

Those are the four families' declared caps, and none of them binds - see the
`wincap` note below.

`library/stats_summary.json` should show `rtp` 0.96 for all 193 modes and
`max_win` topping out at 458330 (= 4583.3x, Three of a Kind). The four-guess
families reach 135420 (Classic), 58520 (Second Chance) and 223730 (High
Stakes); those are payout ceilings, which no RTP target changes.

`etl40b` and `non_zero_hr` **do** move with the RTP target — raising it shifts
weight from losing to winning outcomes — so re-read them after any change rather
than assuming the previous build's figures. At 94% they were `etl40b` ≤ 0.55 and
`non_zero_hr` ≈ 1.59–2.06; both want to stay comfortably inside Stake's limits.

## Things worth knowing

- **`wincap` is per family, and none of them can bind.** 1400 / 700 / 2300 /
  4700 against true ceilings of 1354.2x / 585.2x / 2237.3x / 4583.3x - the
  four-guess figures established by exhaustively enumerating all 6,497,400
  ordered 4-card draws against `partial_multiplier()`. The cap MUST sit above
  the ceiling: `events.py` clips at `min(win, wincap)`, so a cap on the true
  figure would both clip the top win and trip the wincap event path. Re-derive
  it whenever a family's `retention`, `forgive` or `target_rtp` changes - the
  move to 15% on High Stakes took its ceiling past the old 2200 cap.
- **`maxWin` is not uploaded.** `make_index_config` writes only
  `name` / `cost` / `events` / `weights` per mode into `publish_files/index.json`,
  so lowering `wincap` changes no uploaded file. Because the cap never binds,
  the books and lookup tables come out byte-identical too — which is why the
  Stake uploader correctly reports "no changes" after such a rebuild. The
  declared max win is an operator-side setting, like the bet levels.
- **Keep `num_threads` a power of two.** `sims_per_thread` truncates with
  `int()`, so a count that doesn't divide evenly silently drops simulations (12
  workers would lose 512). 8 divides all three per-mode counts (100k / 200k /
  800k) exactly. Simulation results do not depend on the worker count:
  `run_spin` seeds each simulation with `reset_seed(sim)` →
  `random.seed(sim + 1)`, so an outcome is a function of its global index alone.
- **Keep the frontend in step.** `MODE_FAMILIES` here mirrors `FAMILY_RULES` in
  `web-sdk/apps/Ride-The-Bus/src/game/math/modes.ts`, and that mirror is the
  worst thing in this repo to get wrong: the client would show a player one
  number while the RGS credited another. `payout.test.ts` replays every
  published book against the client's arithmetic to catch it. (The `max_win`
  figures in `game/platform/config.ts` are INERT - that file only keeps the
  Stake template's shape; nothing reads it.)
