# Ride The Bus — math build

## Rebuilding

One command does everything. Run it from the **math-sdk root** with the venv's
Python (`make` is not required, and is not installed on the current dev machine):

```sh
cd "C:/Users/tcand/Desktop/Ride The Bus/math-sdk"
./.venv/Scripts/python.exe games/ride_the_bus/run.py
```

PowerShell:

```powershell
cd "C:\Users\tcand\Desktop\Ride The Bus\math-sdk"
.\.venv\Scripts\python.exe games\ride_the_bus\run.py
```

Use the venv Python specifically — a bare `python run.py` fails with
`ModuleNotFoundError: src`, because `src` is only importable via the editable
install in the venv (`pip install -e .`, see the Makefile).

That runs four phases:

1. **`create_books`** — ~13.8M simulations across the 64 bet modes, in parallel
   (`num_threads = 8` in `run.py`).
2. **`generate_configs`** — writes `library/configs/config.json`,
   `library/publish_files/index.json` and the per-mode event configs.
3. **`reweight_all`** (`reweight_luts.py`) — rewrites every published `_0` lookup
   table so each mode lands on exactly `config.rtp`. **This is what makes all 64
   modes report the same RTP**, so the Cross-Mode RTP Consistency check passes.
4. **`execute_all_tests`** (`utils/rgs_verification.py`) — verifies the published
   books/tables and writes `library/stats_summary.json`, the RTP / variance /
   ETL figures the approval dashboard reads.

Expect roughly **8–10 minutes**.

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
Reweighted 64 modes to 0.9400: realized RTP 94.0000%-94.0000% (spread 0.0000%)
```

Then spot-check the published config and stats:

```sh
cd games/ride_the_bus
grep -o '"maxWin": [0-9]*' library/configs/config.json | sort -u   # -> 1400
```

`library/stats_summary.json` should show, across all 64 modes: `rtp` 0.94
everywhere, `max_win` topping out at 135420 (= 1354.2x), `etl40b` ≤ 0.55 and
`non_zero_hr` between about 1.59 and 2.06.

## Things worth knowing

- **`wincap` is 1400, and can never bind.** The true payout ceiling is 1354.2x,
  established by exhaustively enumerating all 6,497,400 ordered 4-card draws
  against `partial_multiplier()`. See the comment on `wincap` in
  `game_config.py`; re-derive it if `target_rtp` or `STAGE_RETENTION` change.
- **`maxWin` is not uploaded.** `make_index_config` writes only
  `name` / `cost` / `events` / `weights` per mode into `publish_files/index.json`,
  so lowering `wincap` changes no uploaded file. Because the cap never binds,
  the books and lookup tables come out byte-identical too — which is why the
  Stake uploader correctly reports "no changes" after such a rebuild. The
  declared max win is an operator-side setting, like the bet levels.
- **Keep `num_threads` a power of two.** `sims_per_thread` truncates with
  `int()`, so a count that doesn't divide evenly silently drops simulations (12
  workers would lose 512). 8 divides all three per-mode counts (80k / 200k /
  800k) exactly. Simulation results do not depend on the worker count:
  `run_spin` seeds each simulation with `reset_seed(sim)` →
  `random.seed(sim + 1)`, so an outcome is a function of its global index alone.
- **Keep the frontend in step.** `max_win` in
  `web-sdk/apps/Ride-The-Bus/src/game/config.ts` mirrors `wincap`.
