# Product

<!-- impeccable:product-schema 1 -->

Written 2026-10-16 from the repo-root `CLAUDE.md`, `design.md` and the
`rtb-invariants` skill, and confirmed by the owner. Those three stay the
authority: this file is the product record impeccable reads, and it carries no
values a test pins.

## Platform

web

## Users

- **Players on Stake.** They launch the game from the casino lobby, inside an
  iframe, on stake.com (real money) or stake.us (social / sweepstakes, which
  uses its own restricted vocabulary). They play on phones held upright and in
  desktop or popout windows, by touch and by mouse. Sessions are short and
  repeated, often with turbo, slam-stop or autoplay.
- **Stake Engine's reviewers.** They check the build against the approval
  checklist and its risk limits before it can go live.

## Product Purpose

A four-guess card game built on the bar game Ride the Bus: colour, then
higher / lower / equal, then inside / outside / equal, then suit. All four
guesses are picked before the round, and each combination is its own RGS bet
mode: 257 published modes across five families.

- **The families:** Classic, Second Chance, High Stakes and Last Stop are all
  1× cost. Three of a Kind costs 250×.
- **RTP:** every mode returns 96.00%.
- **Success:** first, approval by Stake Engine. The game is not yet submitted,
  so the math, modes and mechanics can still change until the owner says
  otherwise. Then, players who come back to it.

## Positioning

- **The bet:** a familiar bar game made into a priced, provably settled casino
  bet. The whole ride is committed up front, and every stage is priced by a
  martingale, so every combination of guesses returns the same.
- **The families:** they are one dial seen from two ends, trading forgiveness
  against ceiling.
- **The world:** the bus itself (the ticket, the destination sign, the route)
  on a lit card table.

## Operating Context

- **Where it runs:** inside Stake's lobby iframe, served from Stake's CDN under
  a strict CSP (fonts must be same-origin files). The bundle is inlined into
  `index.html`, and bundle size is a 3-star approval criterion.
- **Target sizes:** seven. Desktop 1200×675, Laptop 1024×576, Popout L 800×450,
  Popout S 400×225, and phones at 425×812, 375×667 and 320×568.
  - **Phones** are the only place a layout may be rearranged.
  - **Popout S** is Popout L at half size.
- **Rounds:** each one replays a book the RGS hands back; the client never
  decides an outcome.
- **What the player can control:** turbo, slam-stop, autoplay with typed stop
  limits, the spacebar deal, keys 1-4 for the guesses, and the table die.
- **Operators** can switch features off through a jurisdiction block.
- **Languages:** 17 locales, including Arabic right-to-left and a social-mode
  overlay.

## Capabilities and Constraints

- **Money is frozen for visual work.** That covers the payout maths,
  `FAMILY_RULES` and the math package. The client must never show a number the
  RGS will not credit.
- **Stake's approval rules bind, as written in the stake-approval skill.** These
  include:
  - each mode's description and cost;
  - a confirmation before a high-cost mode;
  - a confirmation before autoplay;
  - the maximum win per mode;
  - the replay spec;
  - the restricted terms in social mode.
- **Art** is drawn in code or SVG, or photographed from the game itself. No
  generated raster art, and no web images without asking. Anything shipped
  needs a row in `ASSET_LICENCES.md`.
- **Audio:** every cue is synthesised; there is one licensed music bed.
- **Builds:** math builds (40+ min) and production builds (10+ min) are run by
  the owner, never by an agent. No commit or push without asking every time.

## Brand Commitments

- **The names:** the game is "Ride The Bus"; the house is "Takeover Casino",
  with a crown-over-spade mark. The house name is lettered on the card backs and
  the deck.
- **The owner's settled calls stand unless the owner reopens them:**
  - the deal button stays the blue disc with no caption;
  - the Equal "=" stays on the seam of its square;
  - a pick never dims anything else;
  - Last Stop's ticket sits over cards 2-3 on the takeover;
  - the two-row phone control bar stays.
- **Player copy is terse:** each fact Stake requires is said once.
- **The design system** is `web-sdk/apps/Ride-The-Bus/design.md`. It is a living
  record, and better designs are proposed against it on merit.

## Evidence on Hand

- **Published books and `stats_summary.json`:** local only, never committed.
- **`RGS_TEST_PLAN.md`:** 124 of 132 live checks passed.
- **Assets:**
  - the CC0 court art (`art-masters/courts/`);
  - the paid-tier licensed music bed;
  - the lobby tile, photographed from the game.
- **Absent:** player data, testimonials and reviews. Nothing may be invented
  in their place.

## Product Principles

1. **The screen agrees with the books.** Every figure a player sees is one the
   RGS will credit.
2. **One rule, one unit.** Two units for one quantity on one screen reads as a
   contradiction.
3. **Every family is first-class.** Nothing hardcodes Classic.
4. **The player is never surprised by the interface.** The board never moves
   under them, and a result lands after its card turns, never before.
5. **Targeted craft over redesign.** Rebuild what is weak; keep the world that
   works.

## Accessibility & Inclusion

- **Target:** WCAG 2.2 AA.
- **Touch targets:** the 44 / 36 / 32 px house floors.
- **Contrast:** measured, not assumed.
- **Motion:** prefers-reduced-motion is honoured everywhere.
- **Screen readers:** results are announced once the card has turned, and picks
  report `aria-pressed`.
- **Keyboard:** full play.
- **Type floors:** 6 px for labels and 9 px for figures (9 / 11 px on phones).
- **Colour vision:** the guess squares are safe for colour-blind players.
- **Right-to-left:** Arabic is fully mirrored.
