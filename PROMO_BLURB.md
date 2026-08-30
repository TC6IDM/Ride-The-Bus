# Promo blurb

Approval requests must be accompanied by a short blurb describing the game's
theme and mechanics, used for promotional material and the game description tag.

Three lengths below. The **short** one is the description tag; the **standard**
one is the default to submit; the **long** one is there if a longer slot needs
filling. They say the same thing at three sizes — pick one, don't mix.

Every claim in them is checkable against the build: 96.00% RTP on every mode,
1910.2× ceiling on High Stakes, all four guesses committed before the bet, one
price for all three modes.

---

## Short (description tag, ~140 characters)

> Call all four cards before you bet: colour, higher or lower, inside or
> outside, then the suit. Every guess pays its true odds.

*(139 characters.)*

---

## Standard (submission default)

> **Ride The Bus** takes the four-card bar game to the table. Call every card
> up front — colour, higher or lower, inside or outside, then the suit — and
> lock the whole run in before a single card turns.
>
> Nothing pays a flat rate. Each guess is priced off the cards still in the
> deck, so calling Lower on a 3 pays about 4.75× while Higher pays 1.19×, and
> the odds shift under you as the run builds. Three modes change only what a
> miss leaves behind: Classic keeps 30%, High Stakes keeps 20% and pays further,
> and Second Chance keeps half of what you had built on your first wrong call
> from card two on and plays through it. All three cost the same and return the
> same 96.00%.
>
> Four correct calls is the whole game. The longest of them pays 1910.2×.

---

## Long (if a fuller slot needs filling)

> **Ride The Bus** takes the four-card bar game to the table, and asks for the
> whole run before it deals anything.
>
> Call the colour of card one. Call whether card two runs higher or lower.
> Call whether card three lands inside or outside the two before it. Call the
> suit of card four. Every choice is locked in before the first card turns —
> there is no folding, no cashing out and no second look. You back your read of
> all four, then watch it play.
>
> Nothing pays a flat rate. Every guess is priced off what is still in the deck,
> so a Lower on a 3 pays about 4.75× where Higher pays 1.19×, and turn that 3
> into an 8 and it flips. Tie the rank and you are on the longest shot on the
> table at roughly 12×. The multiplier compounds across all four calls, and the
> odds move under you the whole way down.
>
> Three ways to back the same four calls, at the same price. **Classic** keeps
> 30% of what you had built when a call misses. **High Stakes** keeps only 20%,
> and pays every correct call more for the shortfall — the steepest climb, and
> the 1910.2× ceiling. **Second Chance** keeps half of what you had built on
> your first wrong call from card two onward and plays on through it, trading
> the ceiling for the odds of finishing. Every mode returns the same 96.00%;
> what changes is the shape of the ride.
>
> Get all four and you have ridden the bus.

---

## Notes for whoever submits this

- **Social mode wording differs.** "bet", "pays", "cash" and "stake" are all
  restricted on stake.us, and "High Stakes" is renamed **High Risk** in-game for
  exactly that reason (see `src/i18n/socialMessages.ts`). If the blurb is used
  in a social context, the mode must be called High Risk and "pays" must become
  "wins". The versions above are the standard-market wording.
- **Do not add a max-win figure other than 1910.2×.** That is the High Stakes
  ceiling and the game's overall maximum. Classic tops out at 1354.2× and
  Second Chance at 585.2×, so a blanket "win up to 1354×" would be wrong in two
  directions at once.
- **Do not describe the modes as costing different amounts.** All three are
  1.0× the bet. The naming is a known wart — "High Stakes" implies a premium it
  does not charge.
- Avoid "bonus", "free spins", "jackpot" and "re-trigger". The game has none,
  the rules panel says so, and claiming one is a fast rejection.
