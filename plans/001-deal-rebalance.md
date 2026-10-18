# 001 — Re-balance the deal so the eye can follow it

- **Status**: TODO
- **Commit**: 619403e8
- **Severity**: HIGH
- **Category**: Easing & duration
- **Estimated scope**: 2 files (`GameBoard.svelte`, `sound.ts`), about 10 changed lines

## Problem

The owner reports that the deal and Last Stop's ticket are "too fast". The total
time is not the problem; how it is divided is. In
`web-sdk/apps/Ride-The-Bus/src/components/board/GameBoard.svelte:478-536`:

```ts
/* GameBoard.svelte:480-488 — current */
const seconds = Number(flipDurSec());
if (!(seconds > 0) || reducedMotion()) return;
const travel = seconds * 1300;
const gather = travel * 0.17;
const rest = paceMs(DEAL_REST_MS, 0);
const duration = travel + rest;
const landed = gather / duration;
const leaves = (gather + rest) / duration;
const ease = 'cubic-bezier(0.3, 0.7, 0.3, 1)';
```

```ts
/* GameBoard.svelte:530 and :535 — current stagger */
if (block) viaPile(block, pile, index * seconds * 90);
...
if (stack && stackFace && ticketEl) viaPile(ticketEl, pileFace(stackFace, stack), slots * seconds * 90);
```

At normal speed (`seconds` = 0.5), the timing breaks down like this:

| Leg | Now |
|---|---|
| Gather (slot → deck) | **110ms**: a card crossing a third of the table reads as a teleport |
| Rest on the deck | 300ms (`DEAL_REST_MS`, the owner's call, 2026-10-01, stays) |
| Deal out (deck → slot) | 540ms |
| Stagger between cards | **45ms**: all four move as one block |

Both legs use one ease-out curve, so the gather starts at full speed.

`playDeal()` (`src/game/audio/sound.ts:735-750`) spaces its four riffles 52-75ms
apart from t = 0 and puts the squaring-up thud at 0.21s:

```ts
/* sound.ts:736-749 — current */
for (let i = 0; i < 4; i++) {
  noise({ ..., delay: i * rand(0.052, 0.075), ... });
}
thud({ from: rand(120, 150), to: 58, duration: 0.13, gain: 0.07, delay: 0.21 });
```

## Target

**Keep the total; move the split.** The travel stays `seconds * 1300` (650ms) and
the rest stays `DEAL_REST_MS`. Card 1 must still land by the reveal's hold-back
of `DEAL_REST_MS + 650`ms (`roundReveal.svelte.ts:137` and `:176`), or it turns
over mid-flight.

| Leg | Target at `seconds` = 0.5 |
|---|---|
| Gather | 34% of the travel, about **221ms**, on the game's `--ease-in-out` curve `cubic-bezier(0.45, 0, 0.25, 1)` (a card moving across the table) |
| Rest | unchanged, 300ms |
| Deal out | the remaining 66%, about **429ms**, on the game's `--ease-out` curve `cubic-bezier(0.2, 0.8, 0.3, 1)` (ends at rest in its slot) |
| Stagger | `seconds * 160`, about **80ms** |
| Ticket | starts after card 4: `slots * seconds * 160` (320ms at 0.5) |

```ts
/* target */
const travel = seconds * 1300;
const gather = travel * 0.34;
const rest = paceMs(DEAL_REST_MS, 0);
const duration = travel + rest;
const landed = gather / duration;
const leaves = (gather + rest) / duration;
const gatherEase = 'cubic-bezier(0.45, 0, 0.25, 1)';
const dealEase = 'cubic-bezier(0.2, 0.8, 0.3, 1)';
```

- **Keyframes:** `{ transform: 'none', easing: gatherEase }`, then
  `{ transform: atPile, offset: landed }`, then
  `{ transform: atPile, offset: leaves, easing: dealEase }`, then
  `{ transform: 'none' }`. The opacity keyframes are unchanged.
- **Stagger:** `index * seconds * 160` for the cards and `slots * seconds * 160` for
  the ticket.
- **Sound** (`playDeal`), so the riffles land with the cards on the deck:
  - each riffle gets `delay: 0.2 + i * rand(0.07, 0.09)`;
  - the thud moves to `delay: 0.48`, after the fourth card is on the deck.
  - These values are a starting point. **The owner's ear decides.**

## Repo conventions to follow

- **Curves:** `src/styles/tokens.css:799-804` defines `--ease-out:
  cubic-bezier(0.2, 0.8, 0.3, 1)` and `--ease-in-out: cubic-bezier(0.45, 0, 0.25,
  1)`. Web Animations cannot read CSS variables, so write the same curves as string
  literals with a comment naming the token, as `ControlBar.svelte`'s `roll` does
  with `cubicInOut`.
- **Pacing:** everything is scaled through `flipDurSec()` (turbo shrinks it, a slam
  zeroes it) and `paceMs()`. Do not add a new clock.

## Steps

1. `GameBoard.svelte:483`: change `travel * 0.17` to `travel * 0.34`.
2. `GameBoard.svelte:488`: replace `const ease = ...` with the two constants in
   Target, then use `gatherEase` on the first keyframe and `dealEase` on the third
   (lines 504-506).
3. `GameBoard.svelte:530`: change `index * seconds * 90` to `index * seconds * 160`.
4. `GameBoard.svelte:535`: change `slots * seconds * 90` to `slots * seconds * 160`.
5. Update the comment block at `GameBoard.svelte:389-394`. It says the legs "keep
   the split the single curve used to make" and that "each eases out". Say instead
   that the gather is a third of the travel on the game's ease-in-out and the deal
   eases out, and why: at 17% the gather read as a teleport (the owner,
   2026-10-16).
6. `sound.ts:743`: change `delay: i * rand(0.052, 0.075)` to
   `delay: 0.2 + i * rand(0.07, 0.09)`.
7. `sound.ts:749`: change the thud's `delay: 0.21` to `delay: 0.48`. Update the
   two comments above `playDeal` and at `roundReveal.svelte.ts:117-121` if they
   name the old spacing.
8. `revealPacing.svelte.ts:65` says "60ms is playDeal's own riffle spacing".
   Change it to 80ms only if `INSTANT_CUE_STAGGER` is changed to match. Leave both
   as they are unless the owner asks.

## Boundaries

- Do NOT change `DEAL_REST_MS`, the `* 1300` travel, or any `revealWait` (the
  owner's rest and card 1's hold-back are pinned by `boardStill.test.ts`).
- Do NOT touch `restCentre`, `pileFace` or `settleDeal` (the measured-at-rest and
  slam behaviour).
- Do NOT touch the opacity keyframes.
- If any excerpt above does not match the file, STOP and report.

## Verification

- **Mechanical:** from `web-sdk/apps/Ride-The-Bus/`, `npm run verify` is green.
  `boardStill.test.ts` "the deal" and `sound.test.ts` must pass unchanged.
- **Audio** (CLAUDE.md rule): `npm run audio` on a round. In the spectrogram, the
  four riffles are about 80ms apart starting near 0.2s with the thud near 0.48s, no
  clipping, and the level is unchanged.
- **Feel check** (spare dev and replay pair, `npm run shots -- --reveal` or by
  hand):
  - With the DevTools Animations panel at 10%, each card visibly travels to the
    deck before vanishing into it, and the four leave one after another.
  - Card 1 has landed in its slot before it starts to turn, at normal speed and at
    turbo.
  - A slam mid-deal puts everything in place at once.
  - Reduced motion: no deal at all, as before.
  - Last Stop: the ticket leaves its stack after card 4 has left the deck.
- **Done when:** the owner no longer reads the deal as too fast, and the gates are
  green.
