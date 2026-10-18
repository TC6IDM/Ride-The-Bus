# 002 — Give the intro an exit (baseline; item C may replace it)

- **Status**: TODO (and superseded if the owner picks an item-C direction in
  Phase 2 that hands the intro over to the board)
- **Commit**: 619403e8
- **Severity**: HIGH
- **Category**: Missed opportunities (a state change that teleports)
- **Estimated scope**: 1-2 files, about 15 lines

## Problem

The intro leaves in a single frame. `src/components/Game.svelte:715` mounts it
with no transition:

```svelte
<!-- Game.svelte:715 — current -->
{#if introPhase === 'start' || introPhase === 'replay-info'}
  <StartScreen phase={introPhase} ... oncontinue={onStartContinue} onplay={onReplayPlay} />
{/if}
```

`src/components/intro/StartScreen.svelte:35` has no exit either:

```svelte
<div class="ss-overlay" style={`--logo-url: url(${logoAsset.url})`}>
```

- **What a player sees:** pressing Continue cuts straight to the board.
- **It is the only cut in the game:** the intro ARRIVES with a deal (`ss-rise`
  0.52s and `ss-step-in`, `styles/intro/intro-panels.css:118`), and every panel in
  the game arrives too.
- **The props pop in:** the overlay draws its own `TableScene` with the props
  off. On the cut, the board's cup, chips, deck and die appear on the same frame.

## Target

A short, quiet exit, subtler than the entrance:

- **Exit:** the overlay fades out over **240ms** on `cubicOut` (Svelte's
  `svelte/easing`).
- **Taps:** the overlay stops taking pointer events the moment the exit begins,
  because the board is live from the click.
- **Reduced motion:** a **150ms** fade.

```svelte
<!-- StartScreen.svelte — target root -->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  ...
</script>

<div
  class="ss-overlay"
  style={`--logo-url: url(${logoAsset.url})`}
  out:fade|global={{ duration: reduce ? 150 : 240, easing: cubicOut }}
  onoutrostart={(e) => ((e.currentTarget as HTMLElement).style.pointerEvents = 'none')}
>
```

`|global` is needed because the `{#if}` that removes this element lives in the
parent component (Game.svelte). Svelte 5 transitions are local by default.

## Repo conventions to follow

- `src/components/intro/GameLoader.svelte:121` already does this:
  `transition:fade={{ duration: 320 }}` on its root. Keep the exit shorter than
  that.
- `ControlBar.svelte:51` imports from `svelte/easing`. Use the same import style.
- The reduced-motion helper `reducedMotion` exists in
  `game/celebration/celebrationGestures.ts:100`. Import it rather than inlining
  `matchMedia`, if it suits the file.

## Steps

1. In `StartScreen.svelte`, add the two imports, and the reduced-motion read
   (or `reducedMotion()`).
2. Add `out:fade|global={...}` and the `onoutrostart` handler to `.ss-overlay`,
   exactly as in Target.
3. Nothing else changes: not `Game.svelte`'s `{#if}`, and not `onStartContinue`.

## Boundaries

- Do NOT add an entrance. The intro already arrives.
- Do NOT touch `IntroPanels.svelte`, `ReplayDetails.svelte` or their stylesheets.
- Do NOT change when `introPhase` flips: the board's inertness (`behindIntro`)
  must end on the click, not after the fade.
- Do NOT add the prop pop-in fix here. That is item C's.

## Verification

- **Mechanical:** `npm run verify` is green. `launchGuards.test.ts` (inert behind
  the intro) and `rtl.test.ts` must pass unchanged.
- **Feel check:**
  - At 10% playback, Continue fades the intro over the live board, and a tap
    during the fade reaches the board, not the overlay.
  - Replay: Play fades the round-details panel the same way, and the reveal starts
    under it.
  - Reduced motion: a short fade, no movement.
- **Done when:** no frame shows the intro and the board's props swapping in one
  paint.
