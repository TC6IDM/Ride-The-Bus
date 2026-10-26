# Building the pick

The checklist for turning a picked direction into the game, and the traps that cost time
during the 2026-10 overhaul.

## Before writing code

- Find where the area lives (`CLAUDE.md`'s "Where the client's logic lives" tables) and
  the invariants that touch it (`rtb-invariants` references). Note the tests that grep
  the source for the area - they will need to know about new files and paths.
- Plan sections a reviewer can read one at a time, each verified before the next.

## While building

- **Pure logic in a module, with a test.** Geometry and decisions (`cardFold.ts`,
  `chipSpot.ts`, `handFlight.ts`) go in plain modules with `node --test` tests; components
  draw. A new component goes into `game/sources.testlib.ts`'s manifest in the same change.
- **Svelte scoping:** a stylesheet only styles the component that imports it. Draw new
  markup inside the component whose sheet styles the parts you reuse (the squeeze lives in
  `GameBoard.svelte` so it can use `.card-back` / `.card-front`), and add its own sheet
  there. An unused selector is a svelte-check warning, which fails the gate.
- **The traps** - an apostrophe in a CSS comment, a filter that clips, a later rule that
  wins, a heredoc that eats a backslash - are in `traps.md`, by kind. Read the group for
  what you are changing before you start.
- **Standing rules that apply to almost every visual change:** the board never moves
  under the player (overlays, transforms and opacity only), lettered not lit (no glows),
  colour from `tokens.css`, the control bar stays lit, reduced motion keeps every state
  change, turbo and the slam shorten or skip the motion, nothing tips off a result before
  the card shows it.
- **Strings:** the English text is the key; add it to all 16 other catalogues with a
  genuinely different value (write the patch script with the Write tool and run it with
  `PYTHONUTF8=1`; heredocs mangle non-ASCII). Use Stake's social vocabulary from the
  start ("wins", never "pays"; "play", never "bet"), so no override is needed.
- **Sound changes** follow `rtb-audio-lab`: `npm run audio` on the moment, before and after.

## Verifying

- Drive it in the real game, never only the source. The spare pair is the game on 3002
  and the replay RGS on 3011 (`GAME_PORT=3002 npx vite dev --host --force` and
  `GAME_PORT=3002 REPLAY_PORT=3011 node ../../../scripts/replay-server.mjs`, both from
  `web-sdk/apps/Ride-The-Bus`); leave the owner's 3001/3010 alone. **Restart Vite after a
  stylesheet change** - it serves stale CSS to the driver - and wait for it to answer
  before the first navigation.
- Reach the state deterministically: a replay link (`?replay=true&mode=...&event=max`), a
  forced resume (`GET :3011/__force-resume/<mode>/<event>` then a fresh `sessionID`), or a
  dev flag behind `import.meta.env.DEV`. Read state from the DOM and time screenshots off
  it.
- Check the seven sizes for layout, both outcomes, reduced motion, and the phone with
  `isMobile: true, hasTouch: true` (a narrow desktop is not a phone).
- Sweep the states you touched with `../scripts/layout-audit.mjs` (`ONLY=` narrows it).
  It loads each state fresh at each size, because the deal, the squeeze and the takeover
  measure the board once when they start and a window resized under them shows defects
  no player sees. Treat what it prints as leads: open each in a real viewport and look
  before calling it a defect. Before trusting a quiet sweep on a new kind of problem,
  break the page on purpose with `CSS=` and check the sweep reports it.
- Run `npm run verify` (or the four gates) until green: tests, tsc, svelte-check with
  0 CSS warnings, lint.
- **A failing test** that pins a visual rule is a question for the owner - unless the
  owner asked for exactly that change. Then update the test to state the new rule, and
  prove it still bites: break the code on purpose, watch the test fail, restore.

## Writing it down

- The code comment at the change says what and why, with "the owner's call, <date>".
- `CLAUDE.md`: update or add the invariant bullet under the right heading.
- `web-sdk/apps/Ride-The-Bus/design.md`: the motion or material paragraph.
- `DECISIONS.md`: mark the pick built, with the date.
- Memory: the visual-directions memory gets the picks, briefly.

## Shipping

- Commit and push only when the owner says so for that batch.
- If the board's look changed, regenerate the lobby tile (`node scripts/tile-art.mjs
  --out <scratch>` with the spare pair running, look at both images, then copy them over
  `submission/` and update its README's sizes).
- A PR description is for its reviewer: what changes on screen, what does not (the maths),
  the checks run, and "Before it ships" (a listen on real speakers, a real phone, the
  build and the live smoke set, the tile upload).
