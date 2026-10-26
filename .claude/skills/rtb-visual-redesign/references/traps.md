# Traps this codebase has already sprung

Every entry below cost time at least once, most of them during the 2026-10 overhaul. Most
real findings in a sweep or a review turn out to be one of these, so read the group that
matches what you are changing before you start, and again when something looks wrong.

## Contents

1. Svelte and the cascade
2. Layers, filters and painting
3. Layout and sizes
4. Measuring and capturing
5. Mock-up pages and the archive
6. Strings, scripts and files
7. Sound

## 1. Svelte and the cascade

- **A stylesheet only styles the component that imports it.** A child component's elements
  never carry the parent's scope class, so `.bolt` in the parent's sheet matches nothing.
  Children style themselves and take custom properties from the parent (see the notes atop
  `ChoiceIcon.svelte` and `BoltMeter.svelte`).
- **An unused selector fails the gate.** svelte-check reports it as a warning and
  `check:svelte` must be at zero, so a rule left in a sheet whose component no longer renders
  it breaks the build. When markup moves, its rules move with it.
- **An apostrophe in a comment inside a CSS value** breaks Svelte's parser with "Expected a
  valid CSS identifier", pointing somewhere else. Locate it with
  `node -e "require('svelte/compiler').parse('<div></div><style>'+css+'</style>')"`.
- **A later rule of equal specificity wins silently.** `.choice-row.locked` (0.5) loads after
  the takeover's dim (0.16) and beat it for months. After any new state rule, list what else
  matches the element and in which order the sheets load.
- **A `<button>` does not inherit `font-family`**, and the UA's `font: 400 13.333px Arial`
  also fixes a line box that never scales. Only the computed style of a live page shows it.

## 2. Layers, filters and painting

- **A `filter` makes a stacking context and clips what sticks out.** The selected guess
  segment's filter cut the suit chip at the seam. Put the filter on the part that needs it
  (`> :global(svg)`), and lighten a colour with relative colour syntax
  (`rgb(from var(--seg) calc(r * 1.22) ...)`) instead of `brightness()`.
- **Angles drawn on a squashed box are wrong.** A conic gradient on an ellipse put the High
  Stakes vignette's stripes in the wrong places. Draw it round, then squash it with a
  transform (`--sq`).
- **Stripes on a 3D chip must be the extrusion of the face's spots**, not a second chip
  behind it, or it reads as one chip floating on another. `chipWallStripes` computes them.
- **Text behind a semi-transparent layer stays legible.** The settled payout read through
  the takeover's veil. Hide a number outright; do not count on a veil to cover it.
- **Lettered, not lit.** No glow, bloom or halo on anything; light comes from the upper
  right and edges are lit and shaded (`design.md`).

## 3. Layout and sizes

- **A narrow desktop window is not a phone.** Phones need `isMobile` + `hasTouch` (or
  `playwright-cli open --mobile` then `resize`); a bare resize keeps hover and a fine
  pointer, and the bar came out 11-20px short.
- **The owner's touch laptop reports `hover: none`.** Gate hover on `any-hover`, never on
  `hover: hover`. The headless driver will not reproduce it.
- **Popout S is Popout L at half size.** Every Popout S defect so far came from a clamp
  floor (`--ui`, `--ui-bar`, `--type-floor`) bottoming out, at which point the layout stops
  scaling and starts restructuring.
- **The board never moves under the player.** A new readout line needs an empty state that
  keeps its height (`' '` plus `min-height: 1lh`); overlays use transform and opacity.
- **Long words**: Russian, Finnish and German break fitted names first; Arabic mirrors the
  layout but not the table's props. Sweep them (`RTB_LANG=ru`), do not assume.

## 4. Measuring and capturing

- **Vite serves a stale stylesheet to a driver** after a CSS change. Restart it before
  shooting, and wait until it answers 200 before the first navigation.
- **Time screenshots off DOM state, never off fixed sleeps.** Fixed sleeps caught the turn
  instead of the top of the hold three times. `waitForSelector('.squeeze.out')`, then time
  frames from that.
- **Never resize the window into a moment that has started.** The deal, the title hand-off,
  the squeeze and the takeover's hand measure the board once when they begin; resized
  mid-hold, the squeezed card sat off-centre and its hint off-screen at Popout L and S,
  which no player sees. Load fresh at each size (`layout-audit.mjs` does).
- **Measure at rest.** Take the running transform out before reading a rect; a deal
  measured mid-flight sent cards across the board.
- **A defect that does not reproduce locally may need zoom.** The seam cut on the suit chip
  showed at 4x and 10x `deviceScaleFactor`, not at 1x.
- **The sweep measures; it does not judge.** Text with `pointer-events: none` drops out of
  `elementsFromPoint`, a tap area widens `scrollWidth`, a covered element still has a rect.
  Look at the screenshot before calling anything a defect.

## 5. Mock-up pages and the archive

- **An apostrophe in a single-quoted string in `index.html`'s script broke every tab at
  once, twice.** Write tab data in its own file with template literals (`kit/clitems.js`).
- **Start every page with `<meta charset="utf-8">`**, or the × and the em dash come out as
  mojibake.
- **Serve the folder over HTTP.** `file://` cannot fetch `courts.svg`.
- **PIL is not installed.** Convert with ffmpeg (`-c:v libwebp -quality 82`).
- **Read the live artifact before publishing to it.** If the live page is newer than the
  committed `index.html`, merge it first.

## 6. Strings, scripts and files

- **Heredocs mangle non-ASCII and backslashes.** A `\d` in a heredoc'd patch came out as
  `d` and silently broke a check. Write scripts with the Write tool; run Python with
  `PYTHONUTF8=1` and open files with `newline='\n'` (text mode writes CRLF).
- **The guard hook matches the string `run.py`** in any command, even an `echo`.
- **New strings go in all 17 catalogues** with a genuinely different value, in Stake's
  social vocabulary ("wins", never "pays"; "play", never "bet"). Single quotes, apostrophes
  escaped (`\'`). `locales.test.ts` fails on a missing or identical value.
- **A moved test takes its path strings with it**, and template-literal paths and
  comments naming a file are the half no compiler checks.
- **A new component goes into `game/sources.testlib.ts`'s manifest** in the same change,
  or the grep tests stop looking at it.

## 7. Sound

- **`sound.test.ts` pins what gets scheduled, not how it sounds.** Run `npm run audio` on
  the moment before and after, and look at the spectrogram.
- **A test's fake `GainNode` has no `disconnect`.** Wrap a disconnect in try/catch, or add
  it to the fake.
- **A cache-bust that names the wrong module passes while testing nothing.** Prove a
  changed test by breaking the code on purpose and watching it fail.
- **The owner chooses by ear.** Level-match renditions before an A/B; a louder one wins
  for being louder.
