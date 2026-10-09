---
name: rtb-live-audit
description: Run RGS_TEST_PLAN.md's live-session checks against the UPLOADED Ride The Bus build on Stake Engine Studio - now one command, `npm run rgs -- --front N --math N` (scripts/rgs-live, 130 of 132 checks, parallel, rate-limit aware). The per-check playwright-cli scripts below are the reference it was ported from. Use when the owner pastes a studio.engine.io launch link, asks for the live/Stake checks, or a new front/math version has been uploaded.
---

# Live audit on Stake Engine (the uploaded build)

**Start with the runner.** `cd web-sdk/apps/Ride-The-Bus && npm run rgs -- --front <N> --math <N>`
(add `--record` to write results into RGS_TEST_PLAN.md, `--quick` for the smoke set,
`--only WIN,REP-01` for a slice). It is `scripts/rgs-live/` - read its README first:
it is built around three facts about the live RGS that broke earlier attempts (a
per-machine rate limit that authenticates exhaust fastest, ONE open round per Studio
account shared by every demo session, and Google refusing Playwright-launched
browsers). Everything below is the hand-driven method it was ported from - still the
reference for what each check measures, and the way to dig into one that fails.

Localhost is not the uploaded build. The first live pass found two Blocker failures
that no local check could see: the CDN's CSP blocks every embedded font, and the
error modal sits under the intro. So this is how the RGS_TEST_PLAN boxes get ticked.

## Local on the uploaded bytes - do this first

**The owner's rule (2026-10-09): if a check is fully valid locally, run it locally,
not against the live RGS.** That day the RGS refused this machine at 12 page loads
in about five minutes, and the owner asked whether it could lock them out of
Stake Engine. Every page load is an authenticate.

- **Valid locally:** anything that only measures layout - clipping, overflow,
  type size, the bar's rows, the MODE sign - provided the local
  `build/index.html` hashes identical to the live one (`npm run rgs` prints the
  comparison; any live run of it does). Serve that `build/` folder itself on
  localhost, with the local replay server answering authenticate. The same bytes
  lay out the same way.
- **Still needs Stake:** the wallet and its arithmetic, the handshake, the CDN's
  own headers (CSP, fonts), the replay endpoint, the jurisdiction block, rate
  limits.
- **Before a live run,** name which checks go live and why each one cannot be
  done locally, then keep that list to the minimum (the smoke set plus whatever
  only Stake can show).
- **Record it honestly:** the line reads `**Local <date> - NOT run on Stake**`
  and names what was served (`build/` with its hash, or the dev server). A pass
  on the uploaded build's bytes ticks the box; see RGS_TEST_PLAN.md, "Layout
  checks run locally".

**The command:** `cd web-sdk/apps/Ride-The-Bus && npm run rgs:local -- --front <N>`
(`scripts/rgs-live/local.mjs`). It serves `build/` and the local replay server
on spare ports itself (3013 / 3021 - the owner's 3001 / 3010 are left alone),
checks `build/` against the live `index.html` with ONE CDN request (no RGS call;
leave `--front` off to make none), and runs DEV-11, DEV-12 and CUR-04 with the
live checks' own measuring code (`checks/11-devices.mjs`' `signAndTypeAt`,
`checks/06-currency.mjs`' `fits`), authenticate answered in the live session's
shape. A dashboard opens on http://127.0.0.1:8767 - the live runner's page,
with the screenshots under it - and the run writes `report.md`, `results.json`
and `dashboard.html` to `scripts/.shots/rgs/<date>-local-<time>/`. `--record`
writes `rgs-local`-tagged lines into the plan, and refuses when `build/` is not
the upload. `--only DEV-12 --langs fi,ru` narrows it. A new layout check goes in
`scripts/rgs-live/local-checks.mjs`, measuring with an export from `checks/`
so the two cannot drift.

## What you need from the owner

- A **Studio launch link**, e.g.
  `https://studio.engine.io/teams/takeovercasino/games/ride-the-bus/math?launch=true&team=takeovercasino&game=ride-the-bus&currency=USD&language=en&deviceType=desktop&balance=1000000000&social=false&math=<N>&front=<N>&checklist=false&replay=false&amount=1000000`.
  These are demo sessions with **play money**. The link's own parameters create
  sessions, so you can change them yourself:
  - `balance` is in micro-units (1000000000 = $1,000);
  - `currency=XSC&social=true` gives a social session;
  - `currency=JPY` / `IDR` / `NOK` give the currency checks;
  - `math` and `front` pick the versions to test.
- **The launch path is `/math?launch=true…`.** The game's plain Studio URL with
  `?launch=true` lands on the Overview page with no play modal (seen 2026-10-06).
  `golaunch.js` goes through `/math`, waits for the game frame and returns its URL
  with the session ID redacted; edit its `q` line to change currency, balance,
  social or language - each run is a NEW demo session.
- **Their sign-in, once.** Open a visible window with a persistent profile and let
  them sign in. You never see the password. The profile keeps the sign-in, so a
  later `open` on the same profile is usually already signed in.
  ```
  playwright-cli -s=live open --headed --persistent "<studio link>"
  ```
  When the pass is over: `playwright-cli -s=live close` then `playwright-cli -s=live delete-data`.

## How the page is shaped

- The Studio page holds a play modal, and the modal holds the game in an iframe at
  `https://takeovercasino.live.engine.io/ride-the-bus/v<front>/?sessionID=…&rgs_url=rgsd.engine.io&lang=…&currency=…&device=…&social=…&demo=true`.
- Every script finds it with
  `page.frames().find(f => f.url().includes('live.engine.io'))`.
- A fresh tab opened on that frame URL is a second view of the **same session**. Use
  one for size sweeps, malformed `lang`, a bad `rgs_url` or simulated flags, and the
  main tab is left alone.
- **The Studio menu bar** (Versions / Settings / Local Testing / Screen / Replay):
  - **Screen → size** resizes the frame to Desktop, Laptop, Popout S/L or Mobile.
    That is the reviewer's own view. It does NOT make the pointer coarse, so the
    phone rules also need CDP touch emulation (`sizes.js`).
  - **Replay** takes a Game Mode, an Event ID, an Amount in dollars and a Currency,
    and a **Play Event** button builds the replay URL.
- **The replay URL format**, as the Studio builds it:
  `?replay=true&game=<game UUID>&version=<math>&mode=<mode>&event=<simulation id>&currency=USD&amount=<MICRO-units>&lang=en&device=desktop&social=false&rgs_url=rgsd.engine.io`.
  - The game UUID is `019f7e00-fa38-78fa-9ea7-b4933e75765b`. The RGS rejects the slug,
    and authenticate's `config.gameID` comes back EMPTY, so the game cannot learn it.
  - Replays need no game session, so they can run in any tab of the signed-in
    profile - but NOT in a fresh browser: the CDN answers `403 Forbidden` to
    every path, every version, without the Studio sign-in's cookies (seen
    2026-10-07). A separate headless session cannot replay.
  - Event IDs come from `REPLAY_EVENTS.md`.

## Running scripts

- **`run-code --filename=<script>`, not `run-code "$(cat <script>)"`, for anything
  big.** A script carrying data (the language leak lists are ~100 KB) is past the
  Windows command-line limit and node dies with "No error".
- **Placeholders.** Several scripts are templates: `__CASES__` (repcase.js),
  `__SIZES__` (devsizes.js), `__CFG__` (autolimit.js), `__LEAK__`/`__LANGS__`
  (lang.js), `__JOBS__` (scanlocal.mjs edits its own list). Fill them with `sed`
  into a copy, never in place.
- **Composed scripts.** `mk.sh <name>` wraps a tail in `lib-round.js`; the copies
  here (autolimit.js, auto1.js, win0405.js, end06.js, cur01.js, bet02b.js) are
  already composed. `mk.sh` writes NEXT TO ITSELF, so run it from the scratch copy
  of this folder, never from `.claude/`.

## Rules while driving

- **The session ID is a credential.** Never print it, never write it into a file in
  the repo, and redact it from any request you quote (`lib-round.js` strips every
  `session*` key). `.playwright-cli/` and `scripts/.shots/` are gitignored.
- **Evidence over impressions.**
  - Read the RGS traffic: `lib-round.js`'s `recorder(page)` logs every
    `/wallet/*` and `/bet/*` call with its body and a summary.
  - `check.js` verifies the round arithmetic in micro-units.
  - For long runs, `end01start.js` wraps `fetch` inside the frame, observing only, so
    `poll.js` can read the counters while autoplay runs.
- **Simulated means simulated.** For operator flags a demo account cannot have:
  - `jur.js` / `jur03.js` rewrite only the authenticate response, in the browser,
    through `page.route` → `route.fetch` → `fulfill`;
  - the uploaded build's code reads it;
  - record the result as **SIMULATED**.
- **Record as you go.** Every check gets a `**Live <date>** (front vN = <sha>, math vN, …)`
  line under its box in `RGS_TEST_PLAN.md`, ticked only on a pass. `record2.py`
  shows the pattern.
- **Confirm the build first.** `hash.js` must match `sha256sum build/index.html`.
  If it does not, the live results describe a different build from the branch.

## Which script covers what

Added 2026-10-07 (against front v73). `gen-rounds.sh` now reads a pick's
`aria-pressed`; it read a `selected` class the squares no longer carry, so it
could toggle a pick OFF.

| Checks | Script |
|---|---|
| SES-01, PRF-04 | `smokenet.js` - a fresh tab: the authenticate summary, every origin and status, the console, font status, two rounds, every panel |
| DEV-12's Three of a Kind line | `tbase.js` - the "$1.00 x 250" line's size and clipping, five sizes x en/de/ar |
| DEV-05 (SIMULATED) | `dev05sim.js` - Mobile M, +800 ms latency, tap / double-tap / Space mid-play; one play per round, board = RGS |
| PRF-03 (SIMULATED) | `prf03sim.js` - Mobile M, CPU 1x / 4x / 6x, every rAF interval through the #975 takeover |
| CMP-12 (evidence only) | `cmp12.js` - the viewport meta and every element's computed `touch-action` |

Added 2026-10-06, later (against front v72). Every script now reads the front
version off the live frame (`FRONT`), and `golaunch.js` names `MATH` / `FRONT`
beside `q` - nothing to hand-edit per upload but those two numbers.

| Checks | Script |
|---|---|
| SES-08, CMP-20, CMP-18 (accessibility tree), RND-10, CMP-17, CMP-19 (mouse), BET-17 | `ui-batch.js` - one fresh tab, five rounds across three families |
| WIN-16, RND-11, CUR-06 (replay half), CMP-17 (replay), REP-01 | `repcase.js` (now also records the "At stake" ink, every chip's ink and `aria-hidden`, the card names, the announcer and whether Last Win is a button), summarised by `rcsum.py` |
| CUR-06 (live half) | `cur06live.js` - eight rounds at $0.01, then the history panel |
| REP-12 | `rep12.js` - an unpublished event and a dropped replay fetch |
| DEV-11, DEV-12, CMP-19 (touch) | `dev11.js` with `__LANGS__` (two languages per run, ~9 min), summarised by `dev11sum.py`; it flags any family that changes the bar's size |
| BET-16 | `bet16.js` - reload restore, then a paying round resumed over picks overwritten in storage |
| REG-01, PRF-04 | `reg01.js` - cold launch, 100 autoplay rounds at full turbo, every panel, a reload in `de` |
| SOC-01 over new strings | `social3.js` on a `currency=XSC&social=true` session |
| LNG-01..04 | `lang.js` now switches to Classic first and plays one real round, so the result words, card names, the takeover and the history panel are swept too |
| Local proof of a fix before an upload | `win16local.js` (the count-up's first figure per leg), `betbase-local.js` (a line's size and the bar's height per family at all seven sizes) |

Added 2026-10-06 (all against front v71):

| Checks | Script |
|---|---|
| WIN-01/02/03/07/08/09/10/12/14/15, RND-04/09, BET-09, REP-04/08/11, CMP-13 | `repcase.js` with `__CASES__` = `[[mode, event, {currency, amount, lang, w, h, tapMid}]]`, summarised by `rcsum.py <out.json>`; `cmp13.mts` checks every captured stage price against How to Play's tables |
| Finding replay IDs by SHAPE (a forgiven finish under 10x, a bust on card 3...) | `scanlocal.mjs` against the LOCAL replay server - never against the live RGS (see Pitfalls) |
| BET-04, RND-04 | `gen-rounds.sh` per family/pattern, piped into `check.js` |
| BET-10, RND-06, END-02, END-04 | `auto1.js` |
| END-07, END-08 | `autolimit.js` with `__CFG__` = `{ family, chip, loss: [n, 'x'|'usd'] or null, win: ..., maxMs }` |
| WIN-04, WIN-05 | `win0405.js` (Three of a Kind: a takeover every ~19 rounds), then `tapcont.js` |
| WIN-13, DEV-09, DEV-10 | `dev0910.js` |
| BET-02, END-06 | `bet02b.js`, `end06.js` on a `balance=3000000` session |
| CUR-01, CUR-04 | `cur01.js` (JPY session), `cur04.js` (IDR, balance 2,000,000,000) |
| SES-03, BET-05 (SIMULATED requests) | `ses03bet05.js` - rewrites the outgoing play request in the browser; the RGS's answer is real |
| LNG-01/02/03/04, LNG-08 | `leaksets.mts` builds per-language English leak lists from the catalogues, `lang.js` sweeps board + every panel + a simulated ERR_GEN dialog per language |
| LNG-07 | `lng07.js` |
| SOC-06 | `soc06.js` on a `currency=XSC&social=true` session |
| DEV-02/03/06/07/08 | `devsizes.js` with `__SIZES__` (nine sizes, CDP touch on phones) |
| BET-15 | `bet15.js` reads Studio's Math page (risk summary) behind the play modal |
| PRF-01 | `prf01.js` (Fast 3G via CDP, cache off) |
| Local verification of fixes before an upload | `localverify.js` on the dev pair; `sweep.js` (the control bar, every 4 px 320-620 in 17 languages) and `signcheck.js` (the MODE sign, every family x language) |

From 2026-10-05:

All scripts are `playwright-cli -s=live run-code --filename=<script>`. Scripts that
need the shared helpers are composed with
`scripts/mk.sh <name> <<'EOF' … EOF`, which wraps the tail in `lib-round.js`. That
library also removes stale listeners from earlier failed runs and dismisses the
intro.

| Checks | Script |
|---|---|
| SES-01/02 | `state.js` (+ authenticate response via `playwright-cli request-body`) |
| SES-05 | `ses05b.js`: is the error modal ON TOP (elementFromPoint), over time? |
| SES-06 | `ses06.js` (+ `hash.js`) |
| PRF-04 / REG-01 fonts | `fonts.js`: the CDN CSP header and `document.fonts` status |
| BET-01 | `bet01b.js` (stepper ends), `bet01c.js` (typed values) |
| BET-03 | `bet03.js` |
| BET-06/07, RND-01/02 | `gen-rounds.sh <name> "<Family>" <n> "<picks>"` piped into `check.js` |
| BET-11, SES-04 | `bet11.js` (reload the FRAME mid-round: same session) |
| BET-12 | `bet12b.js` |
| BET-13 | `bet13.js` |
| BET-14 | `bet14b.js`, on a session with `balance=300000000000` |
| RND-07, END-05 | `trips.js` (autoplay + stop on full game win) |
| RND-08 | `ls_sweep.js` |
| RND-05, CUR-05 | `cur05rnd05.js` (`context.setOffline`) |
| END-01/03, RND-03, PRF-02 | `end01start.js`, then `poll.js`, then `end01done.js` |
| JUR-01/02/03 | `jur.js`, `jur03.js` (SIMULATED) |
| LNG-05 | `lng05.js` |
| CMP-01–08, WIN-11 | `howto.js` (+ `win11b`-style pick change) |
| CMP-09/10 | `cmp0910.js`, and `cmp10to.js` for Space during a takeover |
| CMP-11, DEV-01 | `sizes.js` / `dev01.js` (touch via CDP; use `.click`, not `.tap`) |
| REP-01–10 | `rep3.js` (six cases), `rep4.js` (Play Again across a takeover) |
| CUR-03, SOC-01–05 | `social.js`, `social2.js` (term list = `socialMessages.test.ts`) |
| a11y evidence | `a11y.js` (tab order + rings, target sizes), `contrast.js` |

## Pitfalls already paid for

- **Listeners outlive a failed run-code.** A script that throws leaves its
  `page.on(...)` attached, and every later script inherits its errors.
  `lib-round.js` line 1 removes them.
- **A listener that THROWS kills the browser.** An exception inside a
  `tab.on('response' | 'requestfailed' | 'console', ...)` body takes down the
  playwright-cli daemon: run-code dies with "Session closed" and the window is
  gone (`new URL(r.url())` on every response did it twice, 2026-10-07). Wrap
  every listener body in `try { } catch {}`; reopen with
  `open --headed --persistent` - the sign-in survives - and relaunch.
- **Reloading the frame brings the intro back.** Any click then times out behind it.
- **Playwright waits for "stable".** The pulsing Deal button and touch-emulated
  squares can time out. Use `{ force: true }`, or accept the retry.
- **`locator.tap` needs a hasTouch context.** Under CDP touch emulation `.click`
  already arrives as touch.
- **Social mode renames labels.** "Choose play amount", "Auto Play settings",
  "Stop auto play on full game won" - match with a regex.
- **Three of a Kind's bet chips are the round COST** ($2.50 to $250,000), not the
  base bet.
- **The SDK's own docs put `index.html` in the launch URL; the Studio does not.**
  Loading `…/v71/index.html` makes SvelteKit log "Not found" (still renders).
- **`curl` on the CDN returns 403.** Fetch from inside the frame (same origin)
  instead.
- **Takeovers** need a big win. Three of a Kind with autoplay stop-on-full-win off
  skip gets one in about 19 rounds.

- **The replay endpoint rate-limits.** About 300 rapid `/bet/replay` fetches and
  it refuses for minutes, with no CORS headers, so `fetch` just throws
  (`net::ERR_FAILED`) and a replay tab shows Round details with "Play amount –"
  and a Play that does nothing. `/wallet/*` keeps working. Find IDs by shape with
  `scanlocal.mjs` against the local replay server (the same books - check one ID
  matches), then replay only the chosen few live.
- **Touch emulation and clicks.** Under CDP touch emulation some `locator.click`s
  stall on panels and controls; `locator.dispatchEvent('click')` is reliable for
  everything the game handles with `onclick`. Dismiss a takeover with a mouse
  click at its centre or a dispatched click on `.wc-overlay`.
- **The prompts say Click with a mouse now.** Since 2026-10-06 "Tap to continue"
  reads "Click to continue" on a fine pointer; select `.ss-continue` /
  `.wc-prompt` or match `/continue/i`, never the exact label.
- **Three of a Kind prints "Full game win" before its takeover opens.** A loop that
  ends a round on that label clicks the next deal straight into the overlay; end
  on "Busted" only, or wait for `.wc-overlay`.
- **Remembered picks and family.** The local build restores the last family and
  picks on load; a new Studio SESSION does not (v71 predates it). Set the picks
  explicitly in every script.
- **Killing the dev ports can close the playwright sessions.** Reopen with
  `playwright-cli -s=<name> open` before the next run; the `live` profile keeps
  its sign-in.
- **The live RGS's failure shape** is HTTP 400 with `{error, message}` (ERR_VAL),
  or a bare `400 Bad Request` for a session token it will not accept - not 200 with
  `status.statusCode`. The local replay server now answers the same way.

- **Remembered picks persist across every tab of a session.** A script that
  ends on Three of a Kind leaves the NEXT script on it, and Three of a Kind has no
  guess buttons - a pick step then waits 30 s on a locator and the whole run-code
  dies (the language sweep did, 2026-10-06). Set the family first in every
  script; `.mode-option` is in volatility order (sc, base, ls, hs, tr), so
  `nth(1)` is Classic in every language.
- **A takeover's opening figure is easy to misread as a pass.** Record the first
  amount of EVERY leg against the board's last figure, not only "never $0 and
  never negative" - v72 opened a max win on "Big Win $40.00" over a $430.10 board
  and the check's original wording passed it.

## After the pass

- Record the results.
- Write each failure up as a finding (F-n) with its cause in code.
- Fix on a **local dev server**, never by re-checking Stake: the owner must build and
  upload before Stake changes.
- Re-run the checks that touch changed UI on the next upload, plus the smoke set
  (SES-01, BET-06, RND-01, REP-01, PRF-04).
