# Promo blurb

Approval requests must be accompanied by a short blurb describing the game's
theme and mechanics, used for promotional material and the game description tag.

Three lengths below. The **short** one is the description tag; the **standard**
one is the default to submit; the **long** one is there if a longer slot needs
filling. They say the same thing at three sizes — pick one, don't mix.

Every claim in them is checkable against the build: 96.00% RTP on every mode,
2169.2× ceiling on High Stakes, all four guesses committed before the bet, one
price for the three guess modes, and Three of a Kind at 250× the bet paying
4583.3× it about one round in nineteen (recorded hit rate 1 in 19.1).

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
> deck, so in Classic calling Lower on a 3 pays about 4.75× while Higher pays
> 1.19×, and the odds shift under you as the run builds. Three guess modes
> change only what a miss leaves behind: Classic keeps 30%, High Stakes keeps
> 16% and pays further, and Second Chance keeps half of what you had built on
> your first wrong call from card two on and plays through it. All three cost
> the same and return the same 96.00%.
>
> Four correct calls is the whole game. The longest of them pays 2169.2×.
>
> Or skip the guessing. **Three of a Kind** deals three cards from a twelve-card
> deck of Aces, Kings and Queens: cards two and three must match card one, and
> anything less pays nothing. It costs 250× your bet and pays 4583.3× it —
> about one round in nineteen.

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
> so in Classic a Lower on a 3 pays about 4.75× where Higher pays 1.19×, and
> turn that 3 into an 8 and it flips. Tie the rank and you are on the longest
> shot on the table at roughly 12×. The multiplier compounds across all four
> calls, and the odds move under you the whole way down.
>
> Three ways to back the same four calls, at the same price. **Classic** keeps
> 30% of what you had built when a call misses. **High Stakes** keeps only 16%,
> and pays every correct call more for the shortfall — the steepest climb, and
> the 2169.2× ceiling. **Second Chance** keeps half of what you had built on
> your first wrong call from card two onward and plays on through it, trading
> the ceiling for the odds of finishing. Every mode returns the same 96.00%;
> what changes is the shape of the ride.
>
> And one way to skip the calls altogether. **Three of a Kind** is a different
> game on the same table: three cards from a twelve-card deck of Aces, Kings and
> Queens, no guesses to make. Card one is dealt; cards two and three have to
> match it, and anything less pays nothing. It costs 250× your bet and pays
> 4583.3× it, about one round in nineteen — the biggest single win on the table,
> at fair odds on its own deck.
>
> Get all four and you have ridden the bus.

---

## Notes for whoever submits this

- **Social mode wording differs.** "bet", "pays", "cash" and "stake" are all
  restricted on stake.us, and "High Stakes" is renamed **High Risk** in-game for
  exactly that reason (see `src/i18n/socialMessages.ts`). If the blurb is used
  in a social context, the mode must be called High Risk, "pays" must become
  "wins" and "costs 250× your bet" must become "can be played for 250× your
  play amount". The versions above are the standard-market wording.
- **The 4.75× / 1.19× / 12× examples are Classic's.** High Stakes prices the
  same calls at 5.50× / 1.23× / 14.40× and Second Chance at 3.67× / 1.13× /
  8.96× (`oddsExampleFor` in `payoutTable.ts`, re-derived after High Stakes
  went to 16%). The blurbs say "in Classic" for that reason; keep the
  qualifier if the sentence is reworded.
- **Two max-win figures, and they are different claims.** 2169.2× is the most
  the four-guess ride pays (High Stakes; Classic tops out at 1354.2× and Second
  Chance at 585.2×). 4583.3× is the game's overall maximum, on Three of a Kind,
  and is a multiple of the BASE bet on a mode that costs 250 of them — Stake's
  convention for every payout figure. Never quote 4583.3× as the four-guess
  ceiling, never quote it without the cost beside it, and never write
  "18.33×" (its multiple of the cost) anywhere a player could read it against
  the other figures.
- **The three guess modes cost the same; Three of a Kind does not.** Classic,
  Second Chance and High Stakes are all 1.0× the bet — the naming is a known
  wart, "High Stakes" implies a premium it does not charge. Three of a Kind is
  250× the bet, and its cost is stated in the mode picker, the confirmation
  before it is activated, and the rules.
- **"About one round in nineteen" is the recorded figure**, 1 in 19.1 after
  the reweighter (physical odds 1 in 18.3). Do not round it to "one in twenty":
  that is the line Stake's hit-rate guidance draws, and the mode sits inside it.
- Avoid "bonus", "free spins", "jackpot" and "re-trigger". The game has none,
  the rules panel says so, and claiming one is a fast rejection.
