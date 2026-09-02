# Current state and outstanding work

What is built, what is measured, and what is still open. Status rather than
rules - read it when planning work, not when checking a change.

Moved verbatim out of CLAUDE.md so it is loaded on demand
rather than on every turn. Nothing here is reworded.

---

## Current state

680/680 tests, 0 type errors, 0 CSS warnings, lint clean, and the
client reproduces all 76,800 published books exactly. The published math build
(192 modes, RTP 96.0000% everywhere, spread 0.000000%, zero volatility
violations) is generated.

**It is NOT committed**, and the note here used to say it was. `math-sdk/.gitignore`
line 9 is `**/library/**`, so `git ls-files` on the library returns nothing: the
1.6 GB of books, lookup tables and `stats_summary.json` exist only on the machine
that built them. Two things follow. A fresh clone cannot reproduce the books
without a 40-minute rebuild, and every test that reads the math tree
(`payout.test.ts`, `volatility.test.ts`, `modeCeilings.test.ts`) silently skips
there rather than failing — which is deliberate, but only safe while it is
written down.

`npm run lint` works again — `eslint.config.js` (flat) was added because ESLint 9
ignores the `.eslintrc.cjs` every app in the vendored SDK still ships. The old
`.eslintrc.cjs` is now dead and only kept so the app still matches its siblings.

The math clears the **2-star** risk limits, not merely the 3-star ones: worst
std 32.938 (limit 0.6–50.0), worst ETL 0.695 (limit 0.8), worst CVaR 568.8
(limit 700), worst non-zero hit rate 1 in 2.03 (limit 1 in 20), P(≥5000×) zero.

### Seeing the game, rather than reasoning about it

Two things landed together and are worth knowing about before touching anything
visual, because between them they turn "this should look right" into "this does".

**A local replay RGS** (`scripts/replay-server.mjs`) serves any of the 192 modes
out of the real published books.

`npm run dev` / `pnpm run dev` is now the whole thing: it **reclaims ports 3001
and 3010 first** (so a second run is a restart, not a second pair — vite used to
slide to 3002 while the browser tab kept showing an hour-old build on 3001,
which looks exactly like everything working), starts both, and opens the link
builder. `--no-open` skips the tab; `dev:game` is raw vite if you want only that.

**The dev port travels by environment variable, never on the command line**, and
that is not a style preference. dev-all used to append `-- --port N
--strictPort` to the inner script; npm *strips* the `--` separator before
handing the rest to the script, pnpm passes it through as a literal argument. So
under pnpm vite received `--host "--" "--port" "3021"`, ignored an argument list
it could not parse, and came up on its own default 5173 while the builder went
on linking to 3021 — silently, which is the same failure the port reclamation
exists to prevent, arriving by a different route. `vite.config.js` reads
`GAME_PORT` and sets `server.port` + `strictPort` from it. dev-all also spawns
the inner script with whatever package manager started it, read off
`npm_config_user_agent`.

Six scenario aliases, not four — and **the server does no scanning of any kind.
It reads every one of them out of `REPLAY_EVENTS.md`.**

`max`/`big`/`win`/`loss` were read from the 192 lookup CSVs at boot, which cost
**33 seconds** on the first landing-page load. `bustwin` and `forgiven` describe
the SHAPE of a round rather than its size — whether it busted, whether it spent
a Second Chance — which lives in the book events, and those were resolved by
streaming a 215k-round book file on demand. Both are gone: the generator writes
all six into `REPLAY_EVENTS.md` and the server parses that. First load is
**0.11 s**, and the four table-derived figures were checked against the old
CSV-derived ones mode for mode.

- `bustwin` — busted and still paid enough to take the screen over. A round does
  not have to be a full game win to celebrate.
- `forgiven` — Second Chance only: spent its forgiveness, survived, finished big
  enough to celebrate. The case `isCleanSweep` deliberately does not floor.

**Regenerate after a math build** — `run.py` already calls
`scripts/replay-events.js` at the end of every one, and that script now scans
the books for those two columns. It can also be run on its own against an
existing build: `node scripts/replay-events.js` (a few minutes, almost all of it
the book scan).

Three states on a round button, and they are different problems:

| Shows | Means |
|---|---|
| `129.00x #1393` | resolved |
| `none` | scanned, and this mode has no such round — **button greyed out** |
| `rebuild` | the table predates these columns — run the generator |
| `sc only` | `forgiven` off Second Chance — **button greyed out** |

A greyed-out button is the point. `sc_red_lower_outside_heart` has zero drawable
bust-win rounds (0 of 1110 eligible), and the page used to let you build that
link anyway — the game then opened an error modal reading `RGS responded 404`.
Showing the answer is not the same as refusing the pick, which is the lesson
Equal-then-Inside already taught this page. Switching mode also repairs a
now-impossible selection.

**The round-details panel shows the ID the RGS served, not the URL parameter.**
The server returns `bookId` (a local extension Stake does not send) and
`replayEventId()` in `Game.svelte` prefers it, falling back to `?event=` — which
is the production path, since a real replay URL always carries the ID. Without
that, `event=bustwin` printed "Event #bustwin".

The builder also has a **game-port field**, defaulting to 3001 and remembered in
`localStorage`, because vite does not always land there.

It carries **all 49 currencies** with their dashboard names (it had fourteen),
and its guess buttons wear **the game's own choice colours** - Higher green,
Lower red, Inside cyan, Outside magenta, Equal gold, hearts/diamonds red - copied
by name from `tokens.css`. Red and Black were already painted that way and the
other three rows were not, so half the picker spoke the game's language and half
spoke the page's generic green. The ink there stays **light**, unlike the app:
these fills are a 26% wash over near-black, not the app's full-strength colour,
so `--on-choice-ink` dark-on-dark was unreadable. Same colour, different ground,
opposite answer.

**Headless browser driving over CDP** — `scripts/shoot.mjs`, `npm run shots`.
Node 22+ ships a `WebSocket` client and Playwright's chromium is already on disk
under `%LOCALAPPDATA%\ms-playwright`, so it can launch Chrome, open a replay
URL, click through the round details, poll for each tier promotion and
screenshot at any viewport — with **no new dependency in the project**, which
matters because the bundle is inlined and bundle size is a 3-star criterion.

```
npm run shots              # five tiers, desktop
npm run shots -- --sizes   # a max win at each of the seven target sizes
npm run shots -- --intro   # the intro fan and the replay details panel
npm run shots -- --reduced # prefers-reduced-motion
npm run shots -- --mode sc_red_equal_equal_heart --event forgiven
```

**Shots are a working surface, not an archive.** `scripts/.shots/` is
git-ignored and every run overwrites what it finds. Re-shoot after a visual
change rather than reasoning about a stale image, and delete anything that no
longer shows what it claims to - a screenshot of a screen that has since moved
on is worse than none, because it looks like evidence. Nothing outside that
directory should link to a file inside it.

**The repo-root `scripts/.shots/` is the only place they go.** `shoot.mjs`
anchors there correctly; an ad-hoc capture script run from inside
`web-sdk/apps/Ride-The-Bus/` once wrote 18 PNGs into *that* app's `scripts/`
directory, where the anchored ignore pattern did not reach them and `git status`
offered them for commit. `.gitignore` now carries a bare `.shots/` as well, so a
stray one at any depth is still ignored — but a capture script must resolve the
directory from the repo root, never from `pwd`.

This is how the win takeover was actually looked at, and every defect fixed in
that pass was invisible in the source and obvious in a screenshot: three ambient
circles that composed into a lens smudge, sixteen suit marks that never shared a
start, the settled payout legible behind the blur, a fan that covered its own
headline on a phone, and an intro fan that split into two half-fans leaning off
opposite sides when it wrapped 2-per-row. **If a change is visual, drive it and
look.**

## Outstanding

- **The music bed: built, playing, and now licensed.** The audio path is finished — `musicTracks.ts` holds the
  candidates, `music.ts` runs the five-scene level ladder, `audioGraph.ts`
  cross-fades the loop, `primeAudio` opens the graph early enough that the
  loading and start screens have music. Measured through `npm run audio` at every
  scene, nothing clipping.

  **The licence is settled.** The four free-tier placeholders were deleted and
  replaced on **2026-09-02** by ten fresh generations (v5.5) on a paid **Suno Pro**
  subscription — fresh generations, not re-downloads, because the licence
  attaches when the Output is *generated*. `ASSET_LICENCES.md` carries a row per
  file with the verbatim Styles and Exclude Styles fields, the settings
  (instrumental, 50% weirdness, 50% style influence) and the SHA-256. **Four
  items in that file are still open**: the ten generation URLs, the
  subscription invoice, and a saved copy of Suno's Terms as they read on
  2026-09-02 — time-critical, because a new Terms took effect 2026-09-03.

  The WAV masters live in the repo-root `audio-masters/`, outside the app so they are never
  served, and the shipped MP3s were encoded from them at 112 kbps in a single
  lossy generation:
  `ffmpeg -i in.wav -vn -b:a 112k out.mp3`

  Measured against the free-tier set, the new bed is **brighter on exactly the
  axis that was flagged**: idle-board centroid 1716 Hz against 1268, and 1.6% of
  energy above 2 kHz against 0.1%. Peak and RMS are within a hair of the old
  reference points and nothing clips. Two things remain:

  1. **Pick by ear.** All ten takes are kept and auditionable with
     `?dev_music=<id>`; `ACTIVE_TRACK_ID` is a measurement-led placeholder, not
     a decision. This is deliberately deferred to submission.
  2. **Then delete every track but the chosen one**, and put the
     `musicTracks.test.ts` directory ceiling back to 9 MB from the 56 MB it was
     raised to. `static/` is copied wholesale, so all ten ship as they stand —
     44 MB of payload to deliver 6.4 MB.

  Then re-measure: `SCENE_MIX` was tuned against one track, and `MusicTrack.trim`
  is what keeps the others level with it, so a new file needs a new trim.
  `RGS_TEST_PLAN.md` CMP-16 is the live-session pass for all of this, and it is
  currently failing by design.

  Two things about the bed that no test can reach and that want ears on real
  speakers: **the loop seam** — the wrap is only heard once per loop period,
  four to five minutes on these candidates, so `?dev_loop=` exists to make it
  happen every 26 seconds — and **whether the track survives laptop speakers**.
  The candidates put 0.1% of their energy above 2 kHz, which is the dark
  late-night brief working as intended and is also close to the edge of a track
  a laptop cannot carry.

- **Win takeover: still wants real hardware, but the perf risk is mostly
  spent.** The blur is `blur(2px) saturate(0.86)` and is dropped entirely under
  `@media (pointer: coarse)` — that was the pre-emptive fix this list used to
  defer, and it is free now that the text sits on its own shadow band rather
  than depending on the blur for legibility. The burst is ten one-shot marks
  instead of sixteen on infinite loops. What remains for a device: the fan's
  four `box-shadow`ed cards and the `drop-shadow` on the marks. If it still
  drops frames, take the marks' `filter` first; do not go back to blacking out
  the table.
  - All five tiers **have** now been eyeballed at Desktop, Laptop, Popout L,
    Popout S, Mobile M and Mobile L, on Classic and High Stakes, including a
    busted-but-paying round and `prefers-reduced-motion`. Driven headless over
    CDP against the local replay RGS, not by hand — see the note on browser
    automation below. Mobile S (320×568) and a real device are still open.
  - Two responsive traps are recorded in the CSS because both cost a pass:
    `.wc-fan` is a **child of `.wc-body`**, not a viewport-anchored sibling —
    anchored to the viewport it sized in `--ui` while the title is capped in
    `vw`, so on a 375px phone (title 41px, `--ui` 7.5px) the word landed across
    the middle of the cards. And the deck sweep's mask percentages are measured
    against an element inset `-60%`, i.e. 220% of the viewport, so every value
    there lands 2.2× wider on screen than it reads.
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

  **Assets, done:** `static/` holds `logo.webp` (81 KB) with `logo.png`
  (743 KB) kept only as the fallback, plus `favicon.png` at 10 KB. A cold load
  now fetches **90 KB of images against 743 KB before** — the favicon used to be
  the full 710×710 logo, three quarters of a megabyte for a 16 px tab icon,
  fetched before anything a player can see. Whether the game needs any
  *bitmap* art at all is still a judgement call: the table scene is hand-sampled
  CSS and is the best work in the repo, so the honest risk is not "no assets" but
  "does a reviewer read CSS art as art". Note the tension before adding any:
  `config-svelte` sets `bundleStrategy: "inline"`, so anything Vite processes is
  base64'd into `index.html`, and bundle size is itself a 3-star criterion —
  ship art from `static/` via `${base}/…` like `logo.png` does, not through Vite.
- **REP-02 — deliberately deferred, not forgotten.** A replay on the Stake site
  showed bet amount 1000 where the game rendered 1 — an exact 1000× gap pointing at a units convention. Stake documents
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
  - ~~Replay "Play Again" button~~ — **closed.** The spin button already
    re-ran the round; it now says so. `replayFinished()` drives both the
    accessible name and a visible gold caption under the button. A caption
    rather than a label inside the disc: the button is 44 px and the words do
    not fit, and the deal glyph is still the right picture — it deals the same
    four cards again. Positioned out of flow like the tooltip, so it cannot add
    a row to a bar whose height budget is the tightest thing in the layout.
    Verified at Desktop, Popout S and Mobile M.
  - Touch targets: guess segments **paint** 29/35/39 px at 320/375/425,
    equal-badge tap area `min(32px, 45% of the square)`, bar icons 36 px,
    sound sliders 32 px on coarse pointers. The badge's ceiling is tied to the
    square rather than flat at 32 px because a flat 32 px reaches past a
    segment's own centre on a 320 px screen and steals it. Nothing reaches the
    44 px *comfortable* target: four cards across cap `--ui` at 2.265vw, and
    44 px bar icons overflowed a 375 px viewport. Table in
    `RGS_TEST_PLAN.md` §11. "Popout S/L" is still a named responsive check.
    - **This used to claim the 24 px floor was cleared "everywhere", and that
      is not true on Mobile S.** The claim measured the segments' PAINT. The
      badge is centred on the seam and its `::before` overlays them, so what a
      thumb can actually reach — probed with `elementFromPoint`, which is the
      only way to see a pseudo-element hit area — is **21 px** on
      `.third-btn.higher-third` and **22 px** on the two `.io-square` halves at
      320×568. Mobile M and Mobile L are genuinely clear (badge hit 32/33 px,
      segments unobstructed).
    - **It cannot be tuned out, and the arithmetic is why.** At 320 the square
      is 58.9 px; two 24 px halves plus a 24 px badge needs 72 px, i.e. `--ui`
      8.61 against the 7.04 available. Shrinking the badge instead makes it
      worse — for the halves to keep 24 px the badge would have to drop to
      10.9 px, below even its current 13.7 px paint, which is the unhittable
      state the `::before` exists to fix. And `--ui` is bound at 320 by
      **2.2vw** (the four-card row), not by height — `1.55vh` would allow 8.80.
      So the only real fixes are a narrower card row or moving the badge off
      the seam, and both are the owner's call, not a tuning pass.
    - Do not "fix" this by restating the paint figure. That is what hid it.
  - Tile assets: **done, and they live in `submission/`, not `static/`.** All
    three fixed names are present — `RideTheBus-BG.jpg` (1536×1024, 499 KB),
    `RideTheBus-FG.png` (1254×1254, 1.50 MB) and `TakeoverCasino-Logo.png`
    (710×710, 726 KB). BG+FG is **1.99 MB against the 3 MB cap**, with a megabyte
    of headroom; there is no documented cap on the provider logo.
    - They were in `static/`, which is copied wholesale into the build output,
      so every deployed build carried 2.7 MB of artwork no player ever fetches.
      `static/` is 726 KB now — just `logo.png`, the only one the game loads.
      **Do not move them back**; they go up through the Tile Editor.
    - `TakeoverCasino-Logo.png` is byte-identical to `logo.png`, which is
      correct rather than sloppy: the chip on the card backs, the loader and the
      table's deck prop *is* the Takeover Casino mark. Kept as two files because
      they have different owners — one is resolved through `${base}/logo.png`,
      the other's filename is dictated by Stake.
    - `logo.png` is now the WebP's fallback rather than the file the game
      loads, so it stays at 710×710 and byte-identical to the tile asset.
      README's older 4-layer Tile Editor description has been corrected.
  - **The live-session checks in `RGS_TEST_PLAN.md` remain unrun — now 95, not
    52.** The plan was strong on this project's own regression history and thin
    on the criteria Stake publishes; 33 were added covering the spacebar binding,
    the mute control, autoplay confirmation, an invalid `rgs_url`, a malformed
    `?lang=`, min/max bet selectability, the paytable and UI guide, double-tap
    zoom, the frame never scrolling, Play Again, replay in Popout S, and two new
    sections — **13 · Stake.US and social mode** and **14 · Performance** — that
    had no coverage at all.
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
- ~~Promo blurb for submission~~ — **written**, at three lengths, in
  `PROMO_BLURB.md`. The **standard** one is the default to submit. Its Second
  Chance sentence used to say the family "forgives your first wrong call
  outright", which is wrong twice over — forgiveness keeps **half** the running
  multiplier, and only from **card 2**. Stake reads the blurb against the game,
  so every claim in that file has to be checkable against `FAMILY_RULES`.
- **Not yet submitted to Stake** — math, bet modes and mechanics are all still
  changeable until the user says otherwise.


---
