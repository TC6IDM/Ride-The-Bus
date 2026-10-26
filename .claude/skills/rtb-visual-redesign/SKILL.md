---
name: rtb-visual-redesign
description: The Ride The Bus method for redesigning any visual or audible part of the game the way the 2026-10 overhaul did it - capture today's version, audit it, mock up two or three directions plus the original as playable pages on the real board, publish them side by side for the owner's pick, refine, record every passed-over option, then build in verified sections. Use whenever the owner wants to redesign, restyle, rethink, "explore options for", "give me directions for", "mock up" or "do the same as the takeover / the hold / the mode picker" for a screen, panel, animation, card moment or sound in Ride The Bus - even if they only say "this looks basic" or "can we make X better" about a part of the game.
---

# Redesigning a part of Ride The Bus

The 2026-10 overhaul redesigned the loader, the intro hand-off, the guess squares, the
room, the card faces, the panels, the control bar, the mode picker, the running total,
the win takeover and the close-call hold this way. It worked because the owner never had
to imagine a design from a description: every choice was a playable page on the real
board, beside a capture of how the game looks today, and every step stopped for the
owner's call. Keep that shape. It is slower per step and much faster overall, because
nothing gets built twice.

The record of all of it is `design-archive/2026-10-17-visual-directions/` -
`DECISIONS.md` maps every pick to its file, and the comparison page
(`index.html`, published as https://claude.ai/artifact/Diuihq1RAKoS6weYD9ABDs) has a tab
per area. Read the relevant tab's mock-ups before proposing something for an area that
was already explored; a direction the owner passed on is recorded there with why.

## The loop

The loop stops for the owner at steps 4, 5 and 8. When a step needs answers, ask
everything it needs in **one** round of questions (AskUserQuestion), recommended option
first, rather than one question per message.

### 0. Scope it, and read what is settled

- Name the area and the states it has (idle, mid-round, a win, a miss, phone, Popout S).
- Read `web-sdk/apps/Ride-The-Bus/design.md`, `DECISIONS.md`, and the `rtb-invariants`
  reference for the area. Settled owner's calls are not reopened without asking (the deal
  disc, "=" on the seam, no dimming on a pick, the takeover ticket's place, and whatever
  `DECISIONS.md` lists since). design.md is not locked: judge a finding on its merit and
  propose changing design.md if it should change.
- Money, maths and `FAMILY_RULES` are out of scope for a visual redesign. If a direction
  would change a number the player is paid, it is not a visual direction.

### 1. Capture today

Spawn the **`rtb-today-capture`** subagent to photograph the area on the running game:
a frame sequence of the moment at desktop (1200x675) and iPhone 14 (390x664), and, if the
mock-ups need it, a clean backdrop (the board with the redesigned element hidden) plus
the element's measured position at rest. It writes WebP files into the archive's `kit/`
and returns the paths, the timeline and the geometry. Doing this in a subagent keeps
dozens of screenshots out of this conversation.

For sound, run `npm run audio` on the moment yourself (see `rtb-audio-lab`) and keep the
metrics: peak, RMS, how much is above 4 kHz, where the strike or chime lands.

### 2. Audit it

Write 4-8 findings, each one concrete and measured, not a taste remark: "the card rises
16px over 1.65s, so the hold reads as nothing happening", "the readout shows what is
already won, not what the card is worth", "only 1.3% of the energy is above 4 kHz". The
lenses that found real problems before: does it move enough to be seen, does it say what
matters (what is at stake, what is needed), does it speak the game's own language (the
blind, the split-flap, the route, the chips, the ticket, the rail), and does it obey the
standing rules (lettered not lit, one veil, the board never moves, reduced motion).

End the audit with two lines that every direction then honours: **"All three fix it the
same way: ..."** (the shared fixes) and **"Kept by all three: ..."** (the invariants and
owner's calls none of them touches). This stops the directions differing on things that
were never in question.

### 3. Mock up two or three directions, plus the original

Each direction is a different idea, not a colour swap of one idea. Good sets so far: one
quiet direction built from existing pieces, one that changes the lighting or material,
one bold ritual (the squeeze was the bold one, and won).

- Build each as a scratch HTML page in the archive folder on the shared kit (real tokens,
  real fonts, real card faces, the photographed backdrop at measured positions). Mechanics
  and the kit's API: `references/comparison-page.md`.
- Play the real moment at the game's real timings, looping, at both sizes. If the outcome
  could differ (a win and a miss), alternate them, so the page shows the design does not
  tip off the result.
- Give every direction the same five facts: **The idea / Reuses / Motion** (properties,
  durations, curves, reduced-motion behaviour) **/ Bytes when shipped / Risk** (be
  honest: new strings in 17 languages, Stake rules, phone fit, performance, which owner's
  call it touches).
- The **Original** pane comes first: today's capture, played as frames.
- Mark one **My pick**, and say why in the reply - one recommendation, not a survey.
- If a direction moves something to a different place (a setting into another panel, a
  readout off the board, a control onto the rail), list it as a **move**:
  *from -> to -> why*. Flag any move that reopens a settled call in `CLAUDE.md` or
  `DECISIONS.md` - those are asked about, never slipped in with a look.

Test each page in a headless browser before publishing (no page errors, every pane plays,
the frames you describe actually appear). Time captures off the page's own state
(`waitForSelector('.held')`), never fixed sleeps - fixed sleeps caught the turn instead of
the top three times.

### 4. Publish, then stop

Add a tab to the comparison page and republish it (the recipe is in
`references/comparison-page.md`; read the live artifact before publishing). For sound,
publish a separate audition page (`references/audio-auditions.md`). Then stop and wait for
the owner's pick. Do not start building on a guess.

### 5. Refine in rounds

The owner's notes usually come as a list ("half the chips", "not 3D", "start from Big").
Apply them to a NEW file (`w1b`, `w1c`, `w1d`, `cl3b`) rather than overwriting the one they
saw, add it to the tab as "Your pick: ..., modified", and republish. Earlier passes stay
playable. A note that would break a standing rule gets said back to the owner in one line
before it is built, never quietly dropped.

### 6. Record it

Before or alongside the build, write the round into `DECISIONS.md`: the pick and the
owner's notes, and **every option passed over** - the other directions, earlier passes of
the picked one, other sounds or behaviours offered, and any suggestion of yours the owner
overrode (where a setting lives, a default). Each with its file, so it can be reopened.
Update the visual-directions memory with the picks. The owner asked for this explicitly
and it is what made earlier rounds reopenable.

Keep each round in the same shape, so the next reader finds things where they expect:

- a table *Area | Picked | Offered and passed on* (with files);
- the owner's notes, kept in their intent, each refinement round under its own heading;
- every question asked during the build, with its answer;
- a build log, one row per section: *# | Section | Commit | Notes* (the commit column
  fills in when the owner says commit).

### 7. Build in sections

Build the pick in sections a reviewer could read one at a time (the takeover went in five).
The rules that kept the overhaul from breaking things are in `references/building.md`, and
the mistakes already made are in `references/traps.md` - read the group for what you are
touching. After **every** section, run this checklist:

1. `npm run verify` green: tests, tsc, svelte-check with 0 CSS warnings, lint.
2. Every changed screen driven in the real game and **looked at** (Read the image): the
   seven sizes, both outcomes, reduced motion, turbo. For sound, `npm run audio` before
   and after.
3. The layout sweep over the states the section touched -
   `node .claude/skills/rtb-visual-redesign/scripts/layout-audit.mjs` with `ONLY=` - or,
   for a longer look, the **`rtb-visual-qa`** subagent, which runs the sweep, verifies each
   finding by eye and returns only the real ones.
4. A failing test that pins a visual rule is a question for the owner - unless the owner
   asked for exactly that change, in which case update the test to the new rule and prove
   it still catches a mistake (sabotage the code, watch it fail, restore).
5. Every new or changed player-facing string in all 17 catalogues, in Stake's social
   vocabulary ("wins", never "pays"); `locales.test.ts` passing.
6. The CLAUDE.md invariant, design.md and the code comments updated in the same change,
   with the owner's call and its date; a build-log row in `DECISIONS.md`.

### 8. Close out, and check the build against the pick

When the last section is in:

- Run the full layout sweep (all states, both device classes, and `RTB_LANG=ru` for the
  longest words), and the capture of the moment again, so the comparison page can gain a
  "Built" pane beside the pick if the owner wants one.
- Go through the picked mock-up, element by element and move by move, and list each one as
  **built as drawn / built differently / not built**. Ask the owner about every one built
  differently - one round of questions - and say why it differs (a rule, a size, a cost).
- Never report "all done" from memory. The list is made by looking at the mock and the
  running game side by side.

### 9. Commit only when told

Never commit or push without the owner saying so for that batch. When they do: logical
commits (the archive round, then the build), on the working branch, and a PR whose
description is written for a reviewer - what changes on screen, what does not change
(the maths), the checks, and a "Before it ships" list (a listen on real speakers, a real
phone, the build and live smoke, the tile upload if the look changed). If the board's look
changed, regenerate the lobby tile (`node scripts/tile-art.mjs`) and say so.

## Reference files

- `references/comparison-page.md` - the archive layout, the mock-up kit, writing a tab,
  capturing frames, publishing the artifact. Read before step 3.
- `references/audio-auditions.md` - an audition page for sounds, ported from the game's
  own chain and level-matched. Read when the area has sound.
- `references/building.md` - the build checklist. Read before step 7.
- `references/traps.md` - every trap this codebase has already sprung, by kind (Svelte
  and the cascade, layers and filters, sizes, measuring, mock-up pages, strings, sound).
  Read the group for what you are changing; the QA agent reads it too.

## Scripts and agents

| What | Use |
|---|---|
| `scripts/layout-audit.mjs` | Measures the intro, the board (idle and picked), all six panels, the held card and a Max takeover at the seven sizes, each loaded fresh at its size, phones as phones. Reports the frame scrolling, controls or text off screen, clipped controls, overlapping controls, text spilling, text on text, and type under `--type-floor`. `ONLY=`, `SIZES=desk\|phone`, `FAMILY=`, `RTB_LANG=`, `SHOTS=1`, and `CSS=` to try a fix (or break something on purpose to prove the sweep sees it). About 6 minutes for everything, on the spare 3002/3011 pair. Read its header. |
| `rtb-today-capture` agent | Step 1: today's frames, backdrops and geometry, written into the archive's `kit/`. |
| `rtb-visual-qa` agent | Steps 7-8: runs the sweep, reproduces each finding in a real viewport, looks, finds the rule that causes it, and returns only the confirmed problems. Edits nothing. |
| `rtb-locale-auditor` agent | Any new or changed string, in all 17 catalogues and the social overrides. |
