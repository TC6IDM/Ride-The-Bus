# Type, glyphs and shipped assets

The button font-family reset, the WebP logo probe, and which glyphs are drawn
rather than typed.

Moved verbatim out of CLAUDE.md so it is loaded on demand
rather than on every turn. Nothing here is reworded.

---

- **A `<button>` does not inherit `font-family`.** The UA stylesheet sets its
  own `font: 400 13.333px Arial` on `button`, `input`, `select` and `textarea`,
  and that beats inheritance — so `html body { font-family }` in `app.css`
  reached every element in the game *except the ones the player clicks*. This
  game self-hosts Poppins and then printed its most-read numbers in the system
  sans, for the whole life of the code. Measured in the running page before the
  fix: the control bar's bet display and mode name (`.cb-val`, `.cb-cap`,
  `.cb-mode-word`, `.cb-bet-mode` — on screen at all times), all three
  mode-picker rows, How to Play's tabs, the autoplay pills, the panel action
  button and every bet chip's value. `start-screen.css:408` had already worked
  this out for one button and said so; it was never generalised. It is a global
  reset in `app.css` now, **family only** — the UA shorthand also sets size and
  weight, and every control here declares its own.
  - Invisible in the source and invisible in a stylesheet: it only shows in the
    *computed* style of a running page, which is how it survived a full art
    pass. `betChips.test.ts` pins the reset, and the way to check it is to walk
    the live DOM for anything not drawing in Poppins — not to read CSS.
  - Stake names "standard fonts" as a top cause of a 1-star rating.
- **The logo is WebP, with the PNG as a real fallback, and the choice is made
  in JS rather than in CSS.** `logo.webp` is 81 KB against the PNG's 743 KB and
  is indistinguishable at the 310 CSS px the loader draws it at — the largest
  size anywhere in the game. The obvious CSS spelling does not work here twice
  over: the six call sites pass the URL through a custom property, and a `var()`
  resolving to something unusable is invalid *at computed-value time*, which
  resets the property to `none` instead of falling back to the declaration above
  it — the logo would simply vanish. Wrapping it in `@supports` fixes that and
  tests the wrong thing: **Safari 14–16 read WebP and do not support
  `image-set()` with `type()`**, so three major versions would be handed the
  743 KB file for nothing. `game/logoAsset.svelte.ts` probes a 34-byte WebP data
  URI instead, defaults to the WebP so the saving is real, and only ever moves
  downwards. **Not** a `canvas.toDataURL('image/webp')` probe, which is the usual
  one-liner and is wrong for exactly the browsers it exists to protect: Safari
  could decode WebP from 14 but could not encode it until 17.
- **Glyphs are drawn when, and only when, the font does not own them.** Poppins
  is self-hosted latin-only, and `✕` U+2715, `✓` U+2713, `→` U+2192 and the four
  suits fall outside every declared `unicode-range` — they dropped to the system
  font, which on Android and iOS means a colour emoji. `SuitIcon.svelte` and
  `MarkIcon.svelte` draw those. The card **ranks are ASCII, inside U+0000–00FF,
  and deliberately NOT drawn**: there is no fallback to fix, and hand-cutting
  thirteen glyph outlines would trade a real typeface for a worse one.
