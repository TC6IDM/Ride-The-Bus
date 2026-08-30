# The win takeover

Every rule governing the win-celebration overlay: what it is made of, how the
five tiers escalate, which wins open it, and what the board hides while it runs.

Moved verbatim out of CLAUDE.md so it is loaded on demand
rather than on every turn. Nothing here is reworded.

---

- **The Max band is matched on equality; every band below it on `>=`.** "Max Win"
  is a claim about hitting a single reachable figure (1354.2 / 585.2 / 1910.2),
  not about clearing the bottom of an open range — so a payout *above* a family's
  ceiling falls to Epic rather than claiming the rarest screen in the game. The
  published `max_win` bound is 1400 against a true Classic ceiling of 1354.2, so
  the two are not the same number and the ladder must not treat them as one.
  Understating is the safe direction; `winTiers.test.ts` pins both directions.
- **The win takeover is made of the round, not of gradients.** Its centrepiece
  is the four cards the player just played, fanned — the same warm paper,
  crimson crosshatch and chrome edge as every other card in the game, drawn from
  the shared tokens rather than by importing `cards.css` (a stylesheet imported
  into a second component gets a second scope class). `revealedCards` is
  **snapshotted** into `celebration` at `showWinCelebration`, not referenced: the
  round-start resets would empty the fan under a still-open overlay during an
  auto run. All four slots come out as faces in practice — the reveal loop deals
  every card whether the round busted or not — so the face-down branch is a
  fallback for a null slot, **not a behaviour to promise in copy or tests**.
  What this replaced was a scrim gradient, a conic gradient, a radial gradient
  and a text stack, which is item for item the list Stake's rating notes give
  for a 1-star release. Gradients may light a celebration; they cannot be what
  it is made of.
  - **The fan marks what actually happened**, using the board's own two marks
    rather than new ones — a red `--loss` cross on the card that ended the round,
    an amber `--forgiven` return arrow on the one a Second Chance let off.
    `cards.css` is careful that those differ ("a red cross says the round ended
    here, and this one carried on") and the celebration must not undo it. The
    busted card is desaturated and dimmed; **the forgiven card is not**, because
    dimming it would read as a second bust. Showing only the winning cards was
    the alternative and loses the round: which guess failed, and on what card.
  - **Exactly three shapes reach the takeover**, at most one mark each: a clean
    sweep (no marks), a bust (one cross — Classic and High Stakes only, since a
    card-1 miss keeps nothing and pays zero), and a forgiven-then-finished Second
    Chance round (one arrow). A fourth exists in the books and **cannot get
    here**: forgiven *and then* busted takes both haircuts on one round — half
    the multiplier, then 30% of the remainder — and never clears the entry tier.
    Measured across every drawable round of `sc_red_equal_equal_heart`, the
    family's highest-ceiling mode: 382,729 of them, best payout **2.6×** against
    an 11× floor. The `{:else if}` is therefore defensive, not load-bearing.
    A Max Win is always a clean sweep for the same arithmetic.
- **One veil for the whole ladder.** `--wc-veil` is set on `.wc-overlay`, not
  per tier. It used to climb 0.46 → 0.70, so the room got darker on every
  promotion — the rarest screen was the murkiest, and the scene visibly
  re-dimmed four times inside a single count-up. The takeover establishes a
  place once and stays in it; what escalates is the light, the colour, the hand
  and the burst.
- **Every win tier draws the whole celebration. Escalation is intensity, never
  presence.** All five tiers are full-bleed and draw every layer — veil, beam,
  fan and suit burst; the `.tier-*` rules only turn them up (`--wc-beam-op`,
  `--wc-fan-spread`, `--wc-throw`) and `winCelebration.test.ts`
  fails if one of them sets anything that is not a custom property. Max alone
  adds a layer: the deck's own crosshatch, sweeping once. **A tier that
  withholds a layer was tried and rejected** — Big/Huge got a bounded "plate" and
  rendered as a grey rectangle while the higher tiers looked untouched, so the
  ladder read as two unfinished screens. If a tier should feel smaller, turn it
  down; do not take the scene away.
  - **`--wc-fan-spread` is the rung, because it is the only one anyone could
    see.** The ladder used to move sheen opacity and bloom diameter by 30–60% on
    layers already sitting at 34–72% behind a blur — under the just-noticeable
    threshold, so the only real difference between Big and Epic was the word and
    the hue. The hand opening wider reads at a glance and is still intensity: a
    test pins it monotonic across the five.
- **The burst is suit marks, not sparks, and it is a moment rather than a
  loop.** Hearts, diamonds, clubs and spades through `SuitIcon`, thrown once per
  promotion — `WinCelebration` keys the container on `activeTier.id` to re-fire
  it. Sixteen marks on *independent infinite* loops with delays to 2.1s never
  shared a `t=0`, so at any frame they sat at sixteen unrelated radii and read as
  dust on the lens; several also ended up in the frame corners and over the
  control bar. Ten larger marks, one origin, one instant, thrown off the fan
  rather than the viewport centre, fading before they reach an edge. **Keying is
  right here and wrong for `.wc-title`** — that is the bug `promoteTitle` exists
  to replace, and both are now pinned by tests.
- **The light is one beam, not a spinning cone**, aimed from the upper right
  because that is where `table.css` puts the light for the whole game. Two
  counter-rotating conic sweeps plus a radial bloom plus an elliptical vignette
  under the text all centred on one point, and on screen they composed into a
  soft-edged grey-brown disc that read as a smudge or a half-loaded asset.
  **Three ambient circles on one centre is not depth.** The text's ground is an
  **edge-to-edge shadow band** now — full viewport width, so it has no side edge
  to read as the rejected "plate", and it reaches up over the bottom of the fan
  so the title is never cream type on white card faces.
- **The board's numeric readouts are hidden while the takeover counts.**
  `.running-win`, the four `.card-mult` chips and `.cb-lastwin` all print the
  *settled* figure, and the overlay is semi-transparent: the segmented count-up
  ran from $0.00 with "Full Game Win! $1,354.20" legible behind it for the whole
  climb. `Game.svelte` sets `takeover-open` on `.game-layout`; `cards.css`
  consumes it. The **card row goes entirely** — the fan is those same four cards
  brought forward, and dimming it to 0.16 was tried first and left a ghost row
  reading through the veil, which is worse than either showing it or not. One
  hand on screen at a time. The choice row only dims: nothing in the overlay
  duplicates it, but the squares encode the bet and are the loudest thing in the
  game. The table, rail, chips and cups stay lit: the scene stays, the interface
  recedes. A fourth readout added later must join that list —
  `winCelebration.test.ts` names all three individually for that reason.
- **The win ramp IS the volatility ramp.** Big is `--vol-sc` green, Huge
  `--vol-base` yellow, Mega `--vol-hs` red, Epic `--vol-overflow` purple — the
  four stops the bolt meter already spends on the control bar, referenced from
  the same triplets so the two ladders cannot drift. Max alone stays off the
  scale and keeps its *inversion*: a cream core on brand crimson, the only tier
  lighter in the middle than at the edge.
  - This replaced a bespoke gold→amber→orange→ember heat climb, and it
    deliberately reverses the old "no purple here" rule. That rule existed
    because `--vol-overflow` already means *this bet passed its family's
    volatility ceiling*; the call now is that both readings are the same idea —
    near the top of a scale — rather than two meanings competing for one hue,
    and that a player who has already learned green→yellow→red→purple on the bet
    display should not be made to learn a second ramp for wins.
  - **The cards carry it too**: a tier-coloured rim and bloom on every card in
    the fan, plus a specular glint at the beam's own 118°, so the escalation
    reaches the thing the eye is already on rather than only the word above it.
  - **The hand hops on every promotion** (`hopFan`), driven through
    `element.animate()` with `composite: 'add'`. Both halves of that matter: a
    CSS class would replace the `wc-fan-deal` fill and drop each card back to its
    undealt transform, and without `add` the keyframes would overwrite
    `transform` outright and snap every card to the centre of the fan, because
    the tilt and offset live in that same property.
- **Which wins open the takeover**: `winTierFor`'s `fullGameWin` floor puts a
  **clean sweep** on the ladder at the entry tier however little it pays, so a
  6.6× opens it. Gating those to a board-level beat instead was tried and
  reverted — the progression is the one players already learned. The cost is a
  known cosmetic wart: a sub-10× full win is titled "Big Win" below the Big Win
  floor. Fixing that needs its own label, which is a 17-locale change.
  - **A clean sweep is `isCleanSweep(bustedIndex, forgivenIndex)`** — four right,
    nothing forgiven — not "did not bust". That distinction exists only because
    Second Chance survives a wrong guess, and it replaces a per-family
    `celebrateEveryFullWin: false` on `sc` that was too blunt. The old flag was
    half right: forgiveness makes "reached card 4" the ordinary case, and
    flooring those fired the takeover on most rounds. But suppressing the whole
    family also swallowed the case the floor exists for — a genuine 4/4 in Second
    Chance, the same 1-in-70 event that takes the screen over in Classic, which
    paid in silence below 11×. Classic and High Stakes have no forgiveness, so
    `forgivenIndex` is structurally always null there and they are untouched.
