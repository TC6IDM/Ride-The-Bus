# Refactor log — the 2026-09 readability passes

Six passes over the client, run 2026-09-08 → 2026-09-10, all driven by one
request: the code was hard to navigate. **No behaviour changed in any of them.**

Recorded here rather than in `CLAUDE.md` because this is history — what moved
and what it cost. `CLAUDE.md` carries the *rules* that came out of it.

Every pass ended on the same four gates: **719 tests, 0 type errors, 0 CSS
warnings, lint clean**, plus screenshots at the seven target viewports and
`npm run audio` whenever the audio modules were touched.

---

## The passes

### 1–2. `Game.svelte` 3,789 → 1,651, and the popups

State moved out of the component into rune modules — `roundState`, `betState`,
`revealPacing`, `autoplaySettings`, `celebrationState`, `soundSettings`,
`roundFlow`, `autoplayLoop`, plus four leaf helpers.

Each `{#if openPopup === 'x'}` case became its own component under
`components/popups/`, and `popups.css` (1,032 lines) became one stylesheet per
panel.

**The stylesheet split was required, not tidiness.** svelte-check reports an
unused selector as a warning and `check:svelte` must return zero — so a rule in
a sheet whose importing component doesn't render it is a build failure.

### 3. Dead code

39 dead imports and locals removed. Pre-existing dead CSS surfaced and went
too: `.bet-cell-base`, `.ss-popup-close`, `.ss-detail-mode`, `step-icon-sq`,
`is-infinite`, `.sound-mute svg`.

### 4–5. The next four largest files

- `audioGraph.ts` (1,197) → `audioMixer` → `audioContext` → `audioVoices` →
  `audioLoop`, plus pure `audioVariation`, later plus `audioAutoplay`
- `StartScreen.svelte` (484) → `IntroPanels`, `ReplayDetails`, `introDemo.ts`
- `roundFlow.svelte.ts` (524) → `roundPlace` → `roundReveal` → `roundSettle`,
  plus `roundRestore`
- `Game.svelte` → `ControlBar`, `GameBoard`, `SessionReadouts`
- `WinCelebration.svelte` (603 script → 413) → `celebrationScene`,
  `celebrationGestures`

`Game.svelte` ended at **709 lines** (563 script, 136 markup).

### 6. The directory regroup

`src/game/` was 80 files and 14,687 lines flat. Now nine folders:

```
game/    audio/ round/ bet/ math/ celebration/ ui/ dev/ jurisdiction/ platform/
         tests/  sources.testlib.ts
styles/  popups/ board/ intro/ scene/   (tokens, base, responsive at root)
components/ popups/ board/ intro/ icons/   (Game.svelte, app.css at root)
```

**117 files moved, 213 import specifiers rewritten**, then 22 test files moved
again into `tests/` folders beside the code they cover.

The rewrite resolved each specifier against the file's **old** location and
recomputed it from the **new** one. String substitution would have been wrong
the moment two files shared a name fragment, and wrong silently.

---

## What broke that no compiler would have caught

This is the part worth keeping. Four classes, and every one was found by
running something rather than by reading.

### 1. Scripts that read or write source paths at runtime

- **`scripts/mode-ceilings.js` WRITES `modeCeilings.ts`.** Left unrepointed,
  the next math build would have regenerated it at the old path while the moved
  copy silently went stale. It is money-adjacent data — the per-mode ceilings
  the client shows a player.
- **`scripts/replay-server.mjs` READS `musicTracks.ts` and `currencies.ts`**,
  and answers `[]` when the path is wrong. An empty music picker, no error.

### 2. Paths built as template literals

No literal-matching pass resolves these:

| File | Was | Now |
|---|---|---|
| `sound.test.ts` | `` `../styles/${name}.css` `` | folder per name, `../../../styles/` |
| `payoutTable.test.ts` | `` `../i18n/messagesMap/${locale}.ts` `` | `../../../i18n/…` |
| `sound.test.ts` | `` `./audioMixer.ts?${tag}` `` | `` `../audioMixer.ts?${tag}` `` |

The last one is the dangerous one. **A cache-bust naming the wrong module does
not error — it passes while testing nothing.** Re-proved the way it was proved
originally: sabotage `DEFAULT_VOLUME` to 0, watch four tests fail, restore.

### 3. Anchors that moved with the file

`rtl.test.ts` had `const SRC = resolve(import.meta.dirname, '..')` — `src/` at
the old depth, `src/game/` at the new one. Prefixing every path with `../`
would also have "worked", and left a constant named `SRC` pointing at
`src/game`. It is `'../..'` now, with bare paths.

Same class: `lang.test.ts`'s `readdirSync`, `locales.test.ts`'s `HERE`.

### 4. Comments naming a file by path

26 of them pointed somewhere that no longer existed. **A comment that names the
wrong file is worse than no comment: it sends the next reader somewhere
real-looking and empty.**

---

## Mistakes made during the refactor

Recorded because they are the ones likely to recur.

- **An automated comment-fixer made a comment lie.** It rewrote
  `config-lingui/index.ts` → `i18n/messagesMap/index.ts` in `lang.test.ts`,
  because the basename `index.ts` matched exactly one file in `src` — but the
  reference was to a *vendored* file the test reads three lines later. The
  skip-list keyed on the old path and stopped matching once the file moved.
  **Rewriting prose is how a comment starts lying**; every such pass now
  requires the target to resolve to a file that really existed.
- **`is-face` was nearly deleted as dead CSS.** It carries no styling and is
  not supposed to: `scripts/shoot.mjs` reads it to report which fan slots came
  back face-up. Removing it would have passed all four gates and silently
  blinded the visual driver. It now carries a comment saying so.
- **The `bet` shadow**, introduced and caught in the same pass — see
  `CLAUDE.md`.
- **Shell escaping**, repeatedly. The Bash tool collapses `\\` in heredocs,
  which breaks any Python or JS containing a regex. Use the editor.

---

## Stale figures found while writing the walkthrough

Not refactor damage — pre-existing drift, surfaced by reading the maths
end-to-end for `WALKTHROUGH.md`. All four predate the change that dropped
Second Chance and High Stakes from 2.0× to 1.0× cost.

| File | Said | Actually |
|---|---|---|
| `game_config.py` | SC 1170.4×, HS 3820.5× | 585.2×, 1910.2× (exactly half — the 2×-cost figures) |
| `roundPlace.svelte.ts` | RTP pinned to 0.94 | 0.96 |
| `roundReveal.svelte.ts` | RTP pinned to 0.94 | 0.96 |
| `reweight_luts.py` | `TARGET_RTP (~0.94)` | 0.96 |

All corrected. The `3820.5` mention is kept in `game_config.py` with an
explanation, because it appears in a real bug story and someone will meet the
number again.

---

## Tooling added

- **`npm run shots -- --board`** — the idle board and control bar at all seven
  viewports. The driver previously only shot the *takeover* and the *intro*,
  and the takeover deliberately hides the bar's readouts, so it was the one
  screen where an unstyled `.cb-val` would look correct. It also reports
  computed styles, so the money-fitting contract is checked rather than eyeballed.
- **`game/sources.testlib.ts`** — the manifest the eight grep tests read, so a
  split moves code without silently emptying a negative assertion.

---

## The one deliberate trade

`platform/` holds the twelve files matching the Stake template's own `game/`
shape. **Every sibling sample game keeps those at `game/` root and we no longer
do**, so a future SDK template update will not line up by path. Chosen
knowingly, for a readable root; the twelve are still together and still named
exactly as the template names them.
