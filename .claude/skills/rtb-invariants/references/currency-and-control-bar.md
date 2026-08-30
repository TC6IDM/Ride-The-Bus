# Money, currencies and the control bar

How money is fitted to its box on three surfaces, the high-denomination stress
cases, and every rule about locking, clamping and explaining a bet.

Moved verbatim out of CLAUDE.md so it is loaded on demand
rather than on every turn. Nothing here is reworded.

---

- **Money is fitted to its box, everywhere.** Three surfaces size type from the
  string rather than from a constant, because no constant is right for both
  `$1.00` and `NGN 11,461,200,000.00`: the bet chips and the win takeover's
  amount solve a font-size from `labelEms()` (`game/typeFit.ts`), and the
  control bar's three readouts use `use:fitValue`, which measures the real box.
  - **Estimate vs. measure is a deliberate split.** A chip or the takeover
    amount holds one run of text, so an em estimate is exact enough and needs no
    reflow. A control-bar readout can hold a value AND an inline multiplier chip
    at a different size; summing two estimates at two scales is a ratio nobody
    would maintain, so that one measures `scrollWidth` against `clientWidth`.
  - **The reservations became ceilings.** `.cb-balance` and `.cb-lastwin` had
    `min-width` measured from *dollar* strings (`$99,999,999.00`,
    `$5,000,000.00`). They now carry `max-width` at the same figure, and that
    half is load-bearing: without it a flex child simply widens, there is no
    overflow for the fit to detect, and the bar wraps exactly as before.
  - **`.cb-val` must be `white-space: nowrap`** for the same reason - a wrapped
    line has no horizontal overflow to measure, so the fit sees nothing to do
    while the readout silently doubles in height.
  - **All THREE readouts need the cap, and `.cb-bet-display` was the one
    missed.** With the balance and last win capped but the bet display still
    free to widen, a weak-unit currency pushed the bar 2-14px over its row
    budget and broke the Advanced button onto a second line at *every* landscape
    width from 660 to 1100. Invisible in dollars, because the reservation was
    measured in them. `currencies.test.ts` names all three.
  - **`.cb-val` needs `max-width: 100%`, and that line is load-bearing.**
    `.cb-lastwin` is a flex column with `align-items: flex-end`, and a flex
    child under anything but `stretch` sizes to its own CONTENT - so the value
    box grew straight past the readout's `max-width`. Two things then failed
    silently at once: `overflow: hidden` clipped nothing, because the box was
    never smaller than the text; and `fitToBox` saw `scrollWidth ===
    clientWidth` and concluded there was nothing to shrink. The last-win figure
    therefore never fitted and never clipped - it painted across the balance
    beside it, 17-42px of overlap at every size. `.cb-balance` was fine
    throughout, because it uses the default `stretch`: one readout worked and
    its neighbour did not, for a reason nothing in either rule mentioned.
  - **Re-fit on a MutationObserver, not on the framework calling back.** The
    action's own `update` was the only trigger at first and the fit simply never
    re-ran: the readout kept its mount-time size, and a settled figure long
    enough to overflow painted leftward (it is `text-align: right`) straight
    across the MODE and info buttons. Watch `characterData` + `childList` -
    never `attributes`, or the `style.fontSize` the fit writes re-triggers it.
    `.cb-val` also carries `overflow: hidden` as a hard guard: if the floor is
    ever hit, clipping inside its own readout beats painting over a control.
  - **On a phone the light pill is ONE line**: sound, info, MODE, Balance, Last
    Win. The pill takes a bar row of its own (that wrap is by design and is the
    only one on a phone); its own contents do not wrap, and
    `.cb-panel-light` is pinned `flex-wrap: nowrap` to say so.
    - This reverses an earlier pass that gave the two readouts a **second line
      inside the pill**. That pass reserved them 16 units each, which is more
      than three icon buttons leave, and let the existing `flex-wrap` drop them
      down - buying the widest possible box for the worst currency and paying a
      whole extra line of bar for it on every phone, in every currency, on
      every round. A balance sitting under the buttons rather than beside them
      reads as a layout that wrapped, not one that was drawn. **The owner's
      call is the single row**; small type in the worst case is the accepted
      cost, and shrinking a long figure is already what this bar does
      everywhere else.
    - **A share of the row, not a reservation.** `flex: 1 1 0` + `min-width: 0`
      on `.cb-readouts` and on both readouts splits whatever the icons leave.
      That matters because neither neighbour is a fixed width: the MODE button
      is a translated word, and `.cb-icon` carries a flat **36px** floor under
      `pointer: coarse` that does not scale with `--ui-bar`. The box is still
      **bounded**, which is the property `use:fitValue` depends on - a
      zero-basis flex item cannot grow past its share, so `scrollWidth` against
      `clientWidth` stays meaningful. `max-width: none` alone would not be, and
      `currencies.test.ts` fails if the cap is lifted without the flex bound.
    - Measured at all seven sizes with the worst case in the supported set
      (`TZS 2,578,770,000,000.00`) and with the widest `Mode` translations (ru,
      vi): one pill row on all three phones, **nothing clipped anywhere**, no
      horizontal scroll, and the four landscape sizes untouched at one bar row.
      The balance bottoms at 6.02px on Mobile S against a 5.52px floor.
    - **Popout S still opts out**, and must name `.cb-balance` and
      `.cb-lastwin` - and now `.cb-readouts.solo .cb-lastwin` as well - setting
      `max-width` as well as `min-width` each time. Left unrestated, the 620px
      block's reset reaches into a window that has the room for the measured
      widths and does not need the phone treatment.
  - **Replay hides the balance, and that is a different layout.** `.cb-readouts`
    is `space-between`, and one child under that sits at the START - so Last Win
    ended up mid-pill with the balance's width doing nothing. `.solo` pushes it
    right and hands it the freed width (26 units against 17).
    - That 26-unit floor is **cleared on phones**, at `.cb-readouts.solo`'s own
      specificity or it does not land. Once three 36px icons are paid for, 26
      units is wider than a phone row has left: at Mobile S it pushed the pill
      4.7px past the bar's padding on each side - the "hangs off both edges"
      failure - through the one selector specific enough to outrank the reset.
  - The floor is **relative** (0.55 of the breakpoint's own size), never an
    absolute pixel count. An absolute 9px was tried and sat *above* the unfitted
    5.9px size at Popout S, so the viewport that most needed the fit was the one
    it refused to touch.
  - **Shrinking, not abbreviating.** `NGN 11.46B` would fit easily; Stake's
    checklist asks for final win amounts to be clearly shown, and an exact
    figure in small type is a figure where a rounded one is not.
- **High-denomination currencies are the stress case, and they are not exotic.**
  The RGS supports units worth a thousandth of a dollar, and an operator sets
  `maxBet` in those units. High Stakes' 1910.2x cap on a 2,000,000 NGN maximum
  settles at `NGN 3,820,400,000.00`. The worst three across the supported set are
  **TZS, UGX and XOF**, tied at 24 characters - `TZS 2,578,770,000,000.00`, and
  XOF with a five-character `F CFA ` prefix. NGN is fourth; VND and IDR have
  weaker units still but no minor unit, which saves them three characters.
  (An earlier note here named COP as the worst. **COP is not a Stake currency** -
  that figure came from a scratch list written before `currencies.ts` existed,
  which also wrongly carried GBP, AUD, CHF, SEK and THB. `currencies.test.ts`
  derives the worst three from the real list now, so the claim cannot drift
  again.) Before this pass that figure ran off both
  edges of a 375px viewport on the win screen, spilled the balance readout on
  every phone, and broke the Advanced button onto a second bar row at Laptop and
  Popout L. `game/currencies.ts` holds the full list and `currencies.test.ts`
  walks it - **31 of 46 render as a bare code** in an English locale, so the
  chip's two-line "CODE over number" layout is the common path, not the
  exception.
- **The bet is locked while autoplay runs, and the control says so rather than
  going grey.** Autoplay stakes the same amount every round - that is the
  contract the player confirmed - so the chips, the entry field and the steppers
  cannot move it. The display button is **not disabled and not dimmed**: a
  greyed primary control reads as "this is broken", where a live one that
  answers back reads as "not right now, and here is why". The click is refused
  and flashes `.cb-bet-tip`; hover shows it on a pointer device, and the flash
  is the only route a phone has to it. Replay still disables the button
  outright, where Stake's guidance asks for inert bet controls.
  - `setBetLevel` and `formatBetInput` both check `betLockedReason()` too. The
    menu is unreachable while locked, but a run can *start* with it already open
    (the spacebar hold does not go through the popup at all), and those two
    lines are what actually make the bet safe.
- **Local dev now supplies bet limits** (`minBet`/`maxBet`/`stepBet`) in
  `Game.svelte`'s dev bootstrap, beside the dev balance. Without them
  `stateConfig.betLimits` is `{0,0,0}`, which every helper in `betLimits.ts`
  correctly reads as *unconstrained* - so the clamp, the step snapping and the
  spin button's range check were all no-ops locally and none of them could be
  seen to work until the game was on a real session.
- **A typed bet clamps DOWN to the maximum and never UP to the minimum.** The
  asymmetry has been argued both ways and this is the settled form. Clamping
  down stakes a player less than they asked and makes the maximum selectable,
  which Stake's checklist requires. Clamping up stakes them **more** than the
  figure they typed - the one thing the frontend must not do to a player's own
  number - so a below-minimum bet stands exactly as typed and the spin button
  explains it instead.
  - **The step snap has to be guarded for the same reason.** `snapToStep` floors
    onto the grid, so anything under one step floors to *zero*: with a 1,000
    step, typing 500 came back as `0.00` and the button said "Enter a valid bet"
    - true of zero, and silent about the 500 the player typed. If the snap
    produces nothing, keep what they typed; it is unplayable either way, and a
    figure snapped out of existence cannot be described.
- **One reason per failure, not one boolean.** `betBlockedReason()` replaces a
  `betIsValid()` that printed "Enter a valid bet" for a zero bet, a bet the
  player cannot afford and a bet under the operator's floor alike - and only the
  first of the three is something a player can act on by reading it. Now
  "Insufficient funds", "Bet is below the minimum of %s" and "Bet is above the
  maximum of %s", with the figure named. Affordability is checked BEFORE the
  range: someone who cannot afford the round needs to hear that first, even if
  the amount also sits under the minimum.
- **A round in flight locks the bet and the mode, not just the guesses.**
  `choicesLocked()` had covered the guess squares since the engine-flow window
  was found, but the MODE button and the whole bet group were on
  `autoRunning || replay` only - so the family and the amount could both still
  be changed while a round was on the wire. Same failure class as the guesses,
  for the same reason: you end up looking at a board that no longer describes
  the round being settled. `roundInProgress()` is the shared predicate now, and
  an `$effect` closes the bet or mode panel if one is open when a round starts -
  a panel already up would otherwise stay there showing controls that silently
  refuse, which reads worse than a greyed button.
- **The card slot is pinned to the card's width**, not to the multiplier chip
  above it. Without that the slot is as wide as its widest child, and the chip
  becomes that child once the figure gets long: on a High Stakes maximum the
  four slots measured 97 / 97 / 99 / 100px, so the cards sat at four different
  pitches and shifted as each chip appeared.
