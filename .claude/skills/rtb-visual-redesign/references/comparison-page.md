# The comparison page and the mock-up kit

Everything lives in `design-archive/2026-10-17-visual-directions/` (tracked in git).

## Contents

1. What is in the archive
2. The kit (`kit/kit.js`, `kit/kit.css`)
3. A moment engine: one shared script per area
4. A direction page
5. Adding a tab to the comparison page
6. Today's frames (`today.html`)
7. Serving, checking, and publishing

## 1. What is in the archive

| Path | What |
|---|---|
| `index.html` | The comparison page: one tab per area, each with the audit, the Original pane and the directions (desktop + iPhone 14 iframes, the five facts, Replay / Open full size). |
| `<code>-<name>.html` | One page per direction (`a2-blind`, `g1-blinds`, `w1d-chips-flat`, `cl3b-squeeze-peel`, ...). Refinements are new files with a letter (`w1b`, `w1c`, `w1d`). |
| `today.html` | Plays captured frames of today's game: `today.html?f=hold0:640,hold1:450&ext=png`. |
| `kit/` | The shared kit, per-area engines, captured backdrops and frames. |
| `DECISIONS.md` | Picks, owner's notes, and every direction passed over. |
| `phase1/`, `takeover-phase1/` | The audits that preceded a round. |
| `hum-audition.html` | A sound audition page (see `audio-auditions.md`). |

## 2. The kit

`kit/kit.css` copies the game's tokens (`tokens.css`, 2026-10-17) and loads the real
Big Shoulders and Overpass files, so a mock-up draws in the game's palette and faces.
It defines `.stage` (a fixed full-window box), `.layer`, `.bg`, `.lockup`, the house card
`.back`, `.face`, `.panel`, `.action`, and a reduced-motion rule that collapses every
animation to 1ms.

`kit/kit.js` exposes `window.RTB`:

| Name | Use |
|---|---|
| `size()` | `'desk'` (>= 600px wide) or `'phone'`. Every mock adapts to the frame it is in. |
| `g`, `GEO` | Board geometry measured off the live game on 2026-10-17 (slots, squares, route, bar). **The board has moved since** - for new work, measure fresh positions with `rtb-today-capture` and put them in the area's engine, as `holdmock.js` does. |
| `face(rank, suit, opts)` | A card face SVG exactly as `CardFace.svelte` draws it (pips, courts via `courts.svg`, the house Ace). |
| `el(tag, cls, html)`, `place(el, rect)` | Make a node; place it over a measured rect. |
| `loop(ms, run)`, `wait(ms)` | Repeat a demo; a wait that is 0 under reduced motion. |
| `SUIT` | The suit paths, for drawing a mark anywhere. |

## 3. A moment engine

When the directions share a moment (a round's reveal, the hold, the takeover), put the
moment in one engine file and let each direction add only its idea. `kit/holdmock.js` is
the pattern:

- It lays the captured backdrop (`kit/hold-bg-<size>.webp`) and composites another
  capture's region over it (the ordinary bar, because a replay hides the balance).
- It draws the parts every direction needs (the card, the readout, the bus) at measured
  positions.
- It runs the moment at the game's real timings and exposes hooks:
  `play({ reset, hold, holdUntil, strike, land, ownTurn })`. The loop awaits each round
  before the next, so a page that waits for a player's hand still works.
- It alternates the outcome (`r.win`) so every direction shows a win and a miss.

A new area writes its own `kit/<area>mock.js` in the same shape.

## 4. A direction page

Plain HTML with no doctype (the artifact publisher wraps it), opening with
`<meta charset="utf-8">` and a `<title>`:

```html
<meta charset="utf-8">
<title>CL3b The squeeze, peeled</title>
<link rel="stylesheet" href="kit/kit.css">
<style>/* only this direction's idea */</style>
<div class="stage" id="s"></div>
<script src="kit/kit.js"></script><script src="kit/holdmock.js"></script>
<script>HOLDMOCK.play({ hold() { ... }, strike() { ... } });</script>
```

A comment at the top of the `<style>` says the idea in two sentences. Animate transform
and opacity; honour reduced motion. If the direction has a setting the owner should try,
add a small mock-only switch in a corner of the stage (CL3b's "Turn it for me / I'll
peel it") and read `?param=` for a default.

## 5. Adding a tab

`index.html` keeps the older tabs inline in `ITEMS`. **Write a new tab in its own file
with template literals**, as `kit/clitems.js` does: an apostrophe inside a single-quoted
string in the page's script has broken every tab at once, twice. The file defines:

```js
window.CL_ITEMS = { CL: { title, intro, auditCap, audit: [...], dirs: [
  { code: `CL3b`, name: `Your pick: the squeeze, peeled`, file: `cl3b-squeeze-peel`, pick: true,
    idea, reuse, motion, bytes, risk },
  ...
] } };
window.CL_ORIG = { CL: { src: `today.html?f=...`, note: `Today, captured ...` } };
```

Then in `index.html`: a `<script src="kit/<area>items.js">` before the main script, a
tab button (`<button role="tab" data-tab="XX">New · Area<span>3+1</span></button>`, the
new one `aria-selected="true"` and the old "New" marker removed from the previous tab),
`Object.assign(ITEMS, window.XX_ITEMS || {})` beside the CL line, the `XX_ORIG` unshift
beside CL's, and `let start = 'XX'`. Keep the counts in the tab label right.

## 6. Today's frames

`today.html?f=<name>:<ms>,<name>:<ms>[&ext=png]` crossfades `kit/today-<name>-<size>.<ext>`
for the given durations (WebP by default). `rtb-today-capture` writes the frames with these
names. Durations come from the capture's own timeline, so the Original plays at real speed.

## 7. Serving, checking, publishing

- Serve the folder: `python -m http.server 8771 --bind 127.0.0.1` from the archive (8770
  may be in use). Files need HTTP, not `file://` (`courts.svg` is fetched).
- Check every page headless with `playwright-cli run-code`: no `pageerror`, each tab
  renders its directions, and screenshots at the moments you describe, timed off DOM
  state. A 404 for `favicon.ico` is harmless.
- Images: WebP, quality 82. PIL is not installed; use ffmpeg:
  `ffmpeg -loglevel error -y -i x.png -c:v libwebp -quality 82 -compression_level 6 x.webp`.
  A 600 KB PNG capture becomes about 40 KB.
- Publish to the existing artifact, never a new one: `Artifact` with
  `action: "read"` on https://claude.ai/artifact/Diuihq1RAKoS6weYD9ABDs first, then
  `action: "list", scope: "files"` to see what is live. Diff the live page against the
  committed `index.html` - if the live one is NEWER, merge it first. Publish with
  `file_path` = the archive's `index.html`, `root` = the archive folder, and `files`
  mapping only the new and changed files (each published path = its archive path). Files
  not passed are kept.
- Say in the reply which tab to open, what plays in each pane, and which is your pick.
