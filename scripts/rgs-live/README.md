# rgs-live - RGS_TEST_PLAN.md on the uploaded build, in one command

Runs every automatable check in `RGS_TEST_PLAN.md` against the build uploaded
to Stake Engine Studio, in parallel, and writes a report. Meant for the end of
a release: upload the front, then

```
cd web-sdk/apps/Ride-The-Bus
npm run rgs -- --front 74 --math 13              # everything
npm run rgs -- --front 74 --math 13 --quick      # the smoke set
npm run rgs -- --front 74 --math 13 --record     # ...and write the results into RGS_TEST_PLAN.md
npm run rgs -- --list                            # what is automated, what is still yours
npm run rgs:local -- --front 74                  # the LAYOUT checks on the local build/ - no RGS calls
```

`--front` / `--math` are the versions uploaded in Studio. The first run opens
an ordinary Chrome window on Studio for you to sign in; later runs reuse that
sign-in (kept in `%LOCALAPPDATA%\rtb-rgs-live`, never in the repo) until it
expires.

**Budget the time - and the limit is not yet known.** A full run makes about
1,900 RGS calls, most of them END-01's 500 rounds. The pacing assumes the RGS
allows ~80 calls in ten minutes, and on 2026-10-09 that proved too generous:
it refused at 33 calls in the trailing ten minutes after ~135 in the twenty
before, so its window is longer or its lockouts extend. Every 429 is now logged
with its path, the traffic before it and the RGS's answer; tune
`--window-cap` from those lines, and expect a full run to take many hours.
`--quick` stays small.

**Run only what needs Stake.** On 2026-10-09 the RGS refused this machine at
12 page loads in about five minutes, even after 9.5 hours of silence. Layout
checks (DEV-11/12, CUR-04 and the like) give the same answer on the local
`build/` when its `index.html` hashes identical to the live one - this runner
prints that comparison at the start of every run - so do those locally with
`npm run rgs:local` and keep `--only` to the smoke set and whatever only the
live RGS or CDN can show.

## `npm run rgs:local` - the layout checks, locally

`local.mjs` serves `build/` itself (on :3013) beside the local replay server
(:3021), answers authenticate in the live session's shape, and runs the checks
in `local-checks.mjs` - DEV-11, DEV-12 and CUR-04 - with the live checks' own
measuring code. `--front N` first compares `build/` with the live `index.html`
(one CDN request, no RGS call): only an identical build describes the upload.
The same dashboard opens on **http://127.0.0.1:8767**, with the screenshots
under the checks, and the run writes `report.md`, `results.json` and
`dashboard.html` to `scripts/.shots/rgs/<date>-local-<time>/`. `--record` writes
`**Local <date> - NOT run on Stake**` lines tagged `rgs-local`, and refuses when
`build/` is not the upload. Options: `--only`, `--langs fi,ru`, `--concurrency`,
`--headed`, `--no-ui`, `--port`, `--build-port`, `--replay-port`. About three
minutes for all three.

While it runs, a dashboard opens on **http://127.0.0.1:8766**: progress and an
ETA, every check by section (hover one for its evidence), the tasks running,
and the RGS gate - calls in the last ten minutes against the cap, refusals,
any pause. Its final state is saved as `dashboard.html` beside the report.

## Options

| Option | Default | |
|---|---|---|
| `--only WIN,REP-01` | all | checks or whole sections to run |
| `--skip END` | none | checks or sections to leave out |
| `--quick` | | SES-01, SES-06, BET-06, RND-01, REP-01, PRF-04, REG-02 |
| `--record` | off | write a dated line under each check in the plan; PASS ticks the box, FAIL unticks it, SIMULATED never ticks. Replaces the runner's own previous line, never a hand-written one |
| `--headless` | windows shown | run without browser windows |
| `--concurrency N` | 4 | tasks at once |
| `--endurance N` | 500 | END-01's round count |
| `--rgs-gap ms` | 1000 | spacing between ANY two RGS calls, across the whole run |
| `--auth-gap ms` | 8000 | spacing between authenticates (page loads), across the whole run |
| `--window-cap N` | 80 | most RGS calls in any rolling ten minutes; the gate waits rather than pass it |
| `--cooldown s` | 900 | how long everything pauses when the RGS refuses this machine |
| `--no-ui` | dashboard on | no dashboard |
| `--port N` | 8766 | the dashboard's port |
| `--signin` | | force a fresh sign-in |

Output: `scripts/.shots/rgs/<date>-v<front>-<time>/` (gitignored) -
`report.md` (failures first, then every check), `results.json`, screenshots,
and a `<task>-debug.json` with the RGS traffic of any task that failed. The
exit code is non-zero when anything failed or could not run.

## What it will not do

Two checks stay yours, and `--list` says why: **CMP-14** (search Stake's
catalogue for the title) and **DEV-04** (the icons on real iOS, Android,
Windows and macOS). Six more are run as **SIMULATED** - recorded with their
evidence, never ticked, because the real thing needs your hardware or a real
lapse: SES-03 (a forged token, not a genuine expiry), CMP-12 (the viewport and
`touch-action`, not a finger), CMP-18 (the accessibility tree, not a screen
reader), DEV-05 (a throttled link, not a cellular one), PRF-03 (a throttled
CPU, not an Android), END-02 (the runner paces every call, so the game's own
400/900 ms floors never decide a gap live - `rgsPacingMath`'s tests pin them). The JUR checks rewrite the authenticate response's
jurisdiction block in the browser - a demo account carries no operator flags -
and say so in their evidence.

## What a pass is worth

Not every verdict is the same kind of evidence. Read a report with this in mind:

- **Exact** - money (debits, credits, partial wins, drift, sub-cent amounts),
  replays against the published books, the handshake and the network, the
  jurisdiction flags, every win headline against its family's ladder, the
  locks, Space, the autoplay stops, restricted words, English left in another
  language. These compare numbers and strings. A pass is a pass.
- **Measured layout** - DEV-01-03, DEV-06-12, CUR-04, LNG-03/04, WIN-13. They
  measure clipping, overlap, scrolling and type size. A pass says nothing is
  broken, not that it looks right: flip through the screenshots once per
  submission.
- **Key phrases** - CMP-03-08, CMP-17. They confirm the required sentences are
  in How to Play, not that the wording is right; read it once per submission.
  BET-15 reads Studio's own risk-summary page, so a Studio redesign breaks the
  check, not the game.
- **Thresholds chosen here** - PRF-01 (Fast 3G: ready inside 15 s, under 3 MB)
  and PRF-02 (heap under 1.5x + 10 MB after the endurance run).

A FAIL or ERROR always needs a person: each one saves a screenshot and a
`<task>-debug.json` with its RGS traffic, and someone has to decide between a
game bug, a check that misread the screen, and the RGS throttling the run.

## Three things about the live RGS this is built around

Measured on 2026-10-08; each one broke an earlier version of this runner.

1. **The RGS rations requests per machine, and authenticates hardest.** About
   74 authenticates in 136 s - or 60-110 calls of any kind in ten minutes - and
   it refuses this machine outright, every call, for minutes (5, 12, then 35+
   when it happens again soon). A refusal carries
   no CORS headers, so the browser sees `net::ERR_FAILED`, not a 429. So every
   RGS request any task makes goes through ONE gate (`lib/runner.mjs`,
   `RgsGate`): a global gap between calls, a wider one between authenticates
   (reserved BEFORE a page navigates, so the game's 8 s loader never sees the
   wait), a rolling cap of `--window-cap` calls in any ten minutes, a pause for
   everyone on a refusal, wider gaps after one, and one retry of any task the
   RGS throttled. Tasks that only need a game on screen share demo sessions
   (`t.session({ shared: true })`), which saves an authenticate each; any task
   that audits a balance mints its own. A full run is therefore bounded by its
   RGS budget, not by the browser.
2. **Every demo session one Studio account mints shares ONE open round.** A new
   session's authenticate hands back another session's unfinished round, and
   its page resumes and ends it. Balances are per session; the open round is
   not. The gate holds that slot: a play waits for it and keeps it until its
   round closes; an authenticate carrying another live page's round has the
   round stripped; a page that closes mid-round has its round ended for it.
3. **Google refuses any browser Playwright launches** ("This browser or app may
   not be secure"), so the sign-in starts the system Chrome as a plain process
   and only attaches once you are signed in.

Also from the same day, worth knowing when reading a failure: the game's own
429 retry (`rgsPacing.ts`) can never fire on the live RGS, because a refused
request has no CORS headers and reaches the game as a network error.

## Adding a check

Each file in `checks/` exports tasks:

```js
{
  name: 'my-task', covers: ['XXX-01'], est: 60, timeout: 180_000,
  async run(t) {
    const url = await t.session({ currency: 'USD', balance: 100_000_000_000 });
    const page = await t.game(url, { viewport: 'mobileM' });   // intro dismissed
    // ... drive it with lib/game.mjs (setMode, playRound, dealUntil, watchReplay ...)
    t.expect('XXX-01', ok, 'what was seen');                   // or t.sim(...) for simulated
  },
}
```

`t` gives sessions, game pages, replays (`t.replay`), sweeps across sizes on
two page loads (`t.sweep`), reloads that respect the gate (`t.reload`), a
simulated operator block (`t.rewriteAuth`), screenshots, and an RGS recorder
whose traffic is dumped if the task fails. Use classes and attributes, never
English labels, so a check works in every language. A check must name its
evidence: the line it writes is what a reviewer reads.
