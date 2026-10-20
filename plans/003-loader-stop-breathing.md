# 003 — Stop the loader's cards breathing (baseline; item A may replace it)

- **Status**: TODO (and superseded if item A's loader rebuild is approved; fold it
  in there)
- **Commit**: 619403e8
- **Severity**: MEDIUM
- **Category**: Purpose & frequency
- **Estimated scope**: 1 file, 3 lines

## Problem

After their deal, the loader's four card backs loop a vertical bob forever.
`src/styles/intro/loader.css:148-150`:

```css
/* loader.css:148-150 — current */
animation:
  loader-deal 0.52s var(--ease-out) backwards,
  loader-breathe 1.9s var(--ease-in-out) 0.52s infinite;
```

The per-card delays are at `loader.css:186-189`
(`animation-delay: 0s, 0.52s;` and so on), and the keyframe is at
`loader.css:204-207`. A breathing loop is a pulsing indicator: it says "busy"
without saying what is happening, beside a progress bar that already says it.

## Target

The cards are dealt once and then rest. The progress bar is the only thing that
moves while the game loads.

```css
/* target */
animation: loader-deal 0.52s var(--ease-out) backwards;
```

```css
/* target per-card delays */
.gl-card:nth-child(1) { animation-delay: 0s; }
.gl-card:nth-child(2) { animation-delay: 0.11s; }
.gl-card:nth-child(3) { animation-delay: 0.22s; }
.gl-card:nth-child(4) { animation-delay: 0.33s; }
```

Delete the `@keyframes loader-breathe` block.

## Repo conventions to follow

- The reduced-motion block at `loader.css:249-260` already sets `animation: none`
  on `.gl-card`. Leave it.
- The comment above the animation ("Deal in once, then breathe on a loop while we
  wait") must change to say why there is no loop.

## Steps

1. `loader.css:146-150`: replace the comment and the two-animation shorthand with
   the single animation above.
2. `loader.css:186-189`: drop the second value from each `animation-delay`.
3. `loader.css:204-207`: delete `@keyframes loader-breathe`.

## Boundaries

- Do NOT touch `GameLoader.svelte`, the progress bar, the logo or the title.
- If item A has been approved, do not run this plan. Fold the intent ("no idle
  loop") into A.

## Verification

- **Mechanical:** `npm run check:svelte` reports 0 warnings (no unused keyframe),
  and `npm run verify` is green.
- **Feel check:** `npm run shots -- --loader` shows the four cards dealt and
  still; a throttled reload shows no bob.
- **Done when:** nothing on the loader loops except the bar's own fill.
