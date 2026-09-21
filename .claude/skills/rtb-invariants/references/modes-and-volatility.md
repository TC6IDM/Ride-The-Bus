# Bet modes, ceilings and the volatility meters

The 193 published modes, the two different ceiling figures and why both are
needed, the `?lang=` resolver, the mode-slug restore sites, the two volatility
ratings the bar draws, and — at the end — the all-or-nothing analysis that
produced Three of a Kind and rules out every other shape of it.

Moved out of CLAUDE.md so it is loaded on demand rather than on every turn.

---

- **`FAMILY_RULES[f].maxWin` and `MODE_CEILINGS[mode]` are different numbers
  and both are needed.** The family figure is the most that FAMILY can reach and
  is the right headline for a mode a player is choosing between — some
  combination in it really does pay that. But every four-guess combination is
  its own published bet mode, and only **8 of each family's 64** reach the family
  figure: Classic runs 68.2× to 1354.2× with a median of 268.8×, so the headline
  alone overstated the typical bet about fivefold. Stake asks for the maximum win
  to be stated per bet mode and to be realistically obtainable, so How to Play
  and the mode-switch confirmation state both, the second suppressed when the two
  are equal.
  - **The ceilings come from the build, never from enumeration.** The
    theoretical maximum of a combination IS derivable from `payout.ts`, and it is
    the wrong number: the RGS can only pay what its lookup table holds, and the
    published tables are *sampled*. That is measurable rather than assumed —
    heart and diamond are both red, so for a fixed colour + higher/lower +
    inside/outside they must share a theoretical ceiling, and **24 of the 48
    groups disagree** (`base/red/higher/inside` is
    `{heart: 290.9, diamond: 268.8, club: 268.8, spade: 268.8}`). An enumeration
    would therefore print a figure ABOVE what the mode can pay on about half of
    them, which is the exact overstatement being fixed.
  - `scripts/mode-ceilings.js` writes `game/modeCeilings.ts` from
    `stats_summary.json`; `run.py` calls it beside `replay-events.js` at the end
    of every build. The generated `.ts` is **committed**, because the library is
    not. `modeCeilings.test.ts` pins it against the build when one is present.
  - **The win-tier ladder is deliberately NOT wired to it.** Max Win stays pinned
    to `FAMILY_RULES[f].maxWin`, so it fires only on a round that reaches the
    family's stated figure. A mode reaching its own lower ceiling is not a max
    win — the claim is about one reachable number per family, and softening it
    would make the rarest screen in the game routine.
- **A `?lang=` value is resolved against the shipped locales BEFORE it is
  activated.** An unknown-but-well-formed tag is harmless — `t()` falls back to
  English and then to the key, which IS the English text. A **malformed** one is
  not: `LoadI18n` activates whatever it is handed, Lingui passes that to
  `Intl.NumberFormat` on every `i18n.number()`, and Intl throws a RangeError
  rather than degrading. `numberToCurrencyString` draws the balance, the last
  win, the bet display, the running win, the takeover amount and every bet chip,
  so `?lang=en_US` emptied the whole board. `?lang=xx` is fine; `?lang=en_US`,
  `?lang=zz!!` and `?lang=en;a` all throw. Stake's PreChecks name it directly.
  - `utils-shared/language.ts` holds the resolver, beside `currency.ts` and for
    the same reason: a node test can reach it without dragging state-shared and
    SvelteKit's `$app/*` virtuals in behind it. `stateUrl.svelte.ts` imports it
    by **relative path**, because utils-shared already depends on state-shared
    and importing back by package name would put a cycle in the manifests.
  - It also aliases **`po` → `pl`**. `po` is Stake's own code for Polish in its
    supported-languages list; every catalogue in this repo is named `pl`, so
    without the alias a Polish session silently got English number formatting.
  - `numberToCurrencyString` keeps a `try`/`catch` around the format call
    regardless. A formatter that throws must never be able to empty the board.
- **Anything restoring a mode from a slug must apply `parsed.family`, not just
  the four guesses.** `parseModeName` returns five fields; the replay and resume
  effects in `Game.svelte` consumed four and dropped the family, which left a
  High Stakes round on Classic's ladder — measuring a 1400× win against
  Classic's 1354.2 ceiling and announcing MAX WIN over a round nowhere near High
  Stakes' real 2169.2 max. The family also drives the MODE button, the bolts,
  the rules popup and the printed retention rule. `modes.test.ts` greps both
  call sites, because the failure is silent and has now happened twice. Since
  Three of a Kind, both sites put the four guesses back through ONE helper,
  `restoreGuesses`, which does nothing on a family with `fixedChoices` — its
  slug carries `any` for cards 1 and 4, which is not a pick, and the guesses
  parked from the last four-guess mode are deliberately kept.
- The volatility rating (`game/volatility.ts`) is a **ranking of published
  figures, not a marketing claim**. `volatility.test.ts` re-derives it from
  `math-sdk/.../library/stats_summary.json` and fails if the bolts disagree.
  It reads **two columns**:
  - By **std**, per combination, the four-guess families: `sc < base < hs` for
    every one of the 64 guess combinations individually, and grouping a
    family's 64 modes by Equal-pick count gives three bands with **no overlap
    at all** — the calmest 1-Equal mode is wilder than the wildest 0-Equal
    mode, in every family. That is what licenses "one bolt per Equal".
  - By **zero-rate**, Three of a Kind: its non-zero hit rate is 1 in 19 where
    the worst four-guess mode is 1 in 2, and the test requires at least a 5×
    gap. By std alone it is calmer than most Classic modes (~4.1 ÷ cost; a
    fixed 18.3×-cost prize cannot deviate much), and the comment beside the
    rating says so rather than letting seven bolts imply otherwise. That is
    what puts it FULL and PURPLE on a ruler the other three never fill alone.
- **One ruler.** Every meter draws `VOLATILITY_BOLTS` (7) stops. The mode picker
  lights the family's own rating (1/3/5/7); the bet display adds one per Equal
  pick on the four-guess families and nothing on the fixed one. A second meter
  counting to a different maximum would be bug class 1.
- **Purple is a family's colour, not an overflow.** It used to be the stops past
  `FAMILY_BOLT_CEILING` (five) — High Stakes with an Equal pick. That ceiling,
  `BoltMeter`'s `overflowAfter` and the purple branch in `modeNameColor` are
  gone: High Stakes with two Equals draws **seven red bolts**, and `--vol-tr`
  is the purple. `--vol-overflow*` survives only as the win takeover's Epic tier,
  which is the same reading (past the top of the family bands). The lifted
  value (176, 106, 232) rather than the deeper bolt purple, because unlike the
  other three it is also read as 9.5px text in the bar and the deeper one
  misses 4.5:1 there.
- **The bar is coloured by the rating, not by the accent.** `--mode-ink` /
  `--mode-rgb` (the mode name, the `+/−` steppers, the bet button) and
  `--vol-color` / `--vol-rgb` (the MODE button, the picker) are both the
  family's own colour now and always agree; they stay two pairs because they
  reach different panels.

  All four are published on the `<footer class="control-bar">`, not on a panel
  inside it. They have to reach three groups sitting in different panels — the
  bet display, its sibling steppers, and the MODE button over in the light pill
  — so the bar is the nearest element that can carry them.

---

## The all-or-nothing bound — why Three of a Kind is what it is

Asked for: nothing back on a miss, more for the full ride. Every shape of it
was enumerated (every ordered draw, priced with the game's own martingale,
reweighted the way `reweight_luts.py` reweights the published tables) before
the one that ships was chosen, and the first build of the one that seemed to
fit was put through Stake's verifier and failed. THE ALL-OR-NOTHING BOUND in
`game_calculations.py` is the canonical record; this is the longer argument.

**Two walls on the four-guess ride, neither a matter of tuning.**

1. **pay × chance = 0.96.** Only the sweep pays, so its recorded frequency must
   clear Stake's "better than 1 in 20", which caps a binary payout at **19.2×
   the cost**. Lowering the RTP makes it worse (at 90% it is 1 in 22); raising
   it to the 96.7% ceiling only reaches 1 in 20.7; and no mode may have its own
   RTP (all within 0.5%). A short deck does not escape it — it makes the sweep
   more common and cheaper in exact proportion.
2. **etl40b.** A single outcome at or above 40× cost puts 100% of the RTP in the
   tail against an 80% limit. So a zero-on-miss mode is capped under 40× cost
   before the hit-rate line even applies. A big trips payout (600×+) is only
   reachable with a consolation on the pair — real deck, three cards, retention
   0.15: colour-only 0.2×, pair 4.3×, trips 618× at 1 in 834 — a different
   product, declined.

**Every four-guess combination fails.** Best is higher/lower + outside at
1 in 26.8 (9–140× at fair odds); `equal` combinations have ETL 1.0 (every sweep
≥ 40×); `colour → equal → equal → suit` sweeps 1 in 3,500 and fails hit rate,
std (57 > 50), CVaR (960 > 700) and ETL at once. A shorter deck makes the
four-guess ride WORSE: fewer ranks means more ties, ties eat the higher/lower
probability, and the suit stage (×¼) is untouched by any rank change (32-card
1 in 31–38; 24-card 1 in 35–36).

**A cost multiple escapes both walls — and then the third wall appears.** The
trips ride pays under 40× its cost, so its etl40b is 0 at any cost, and the
cost turns a small multiple into a large base-bet figure. The first build took
that as far as it goes — A K Q J, one of each, four cards, cost 1000×, priced
at 25× cost = 25,000× base (the 2-star payout cap) — and the verifier failed it
on every tail row at once:

| Row (2-star) | Measured | Limit |
|---|---|---|
| P(≥ 5,000× base) | 0.0384 | 0.01 |
| P(≥ 10,000×) | 0.0384 | 0.005 |
| P(≥ 25,000×) | 0.0384 | 0.002 |
| CVaR absolute | 25,000 | 20,000 |
| ETL above 10,000× | 0.96 | 0.6 |

**Every row is the same fact:** Stake's tail rules are written in base-bet
multiples and never scale with cost. A binary win at or above 10,000× base
would have to land rarer than 1 in 200 — i.e. pay ≥ 192× cost — which etl40b
forbids; at or above 5,000× needs 1 in 100, ≥ 96× cost, the same wall. So a
binary mode's win **must stay under 5,000× the base bet** (10,000× at 3-star).
No consolation rescues 25,000× either: fixing the ETL-10k row alone would need
the pair to return 2.24× the stake, and the probability rows count how OFTEN a
≥ 10,000× win lands, not how much RTP it carries.

**Under 5,000×, with the win under 40× cost, the cost lands at a few hundred
and the deck sets the multiple.** Designs that fit:

| Deck | cost | pays | × base bet | chance | 1-in-20 | base bet the caps allow |
|---|---|---|---|---|---|---|
| **A K Q, 12 cards, fair** | **250** | **18.33×** | **4,583.3×** | **1 in 19** | inside | **$200** |
| A K Q, 12 cards, fair | 200 | 18.33× | 3,660× | 1 in 19 | inside | $250 |
| A K Q J, 16 cards, priced down to 24× | 200 | 24× | 4,800× | 1 in 25 | past | $250 |
| A K Q J × 2, 32 cards, fair | 225 | 22.1× | 4,972× | 1 in 23 | past | $222 |

A K Q at 250× is the one that ships: fair pricing (the table deals what the
deck deals), the only option inside the soft 1-in-20 line, and a $200 base bet
under the 2-star caps (bet cost ≤ $50,000 a round sizes the base ladder; max
exposure ≤ $5,000,000 sizes the win — this is the answer to "bet more in the
base game": a lower cost multiplier, not a bigger prize). **Why not higher:**
the win is 18.333 × cost and must stay under 5,000× base, so cost < 272.7 — at
273× the mode's only win crosses the line and P(≥ 5,000×) jumps from 0 to the
whole hit rate, 5.2% against 1%; a cliff, not a slope. 250 is the last round
figure under it, and 272 would only take the base bet from $200 to $183 for a
1% bigger prize. A K Q J only fits by pricing it down to 24× and dealing trips
45% more often than the deck.

**Three cards, end to end.** The mode deals three, so the slug has three tokens
(`tr_any_equal_equal`), the book has three reveal events, `computeFinalMultiplier`
counts the unplayed stages from the round's own length, the board renders
`stageCount()` slots and the takeover fans `fanFor(3)`. Hiding a dealt fourth
card the book still contained was the alternative, and a replay a reviewer
cannot reconcile with the screen is not worth the smaller diff.

**Volatility, honestly.** Normalised std ≈ 4.1 — the third-calmest family by
that column. What is off the scale is the zero-rate: 95% of rounds pay nothing
against ~50% everywhere else. The purple meter is defined on that column.

**Precedent, read properly.** Graffiti Ways (Colorful Play) ships a 1000×-cost
mode paying 25,000× base. Its paytable is a wide slot distribution with token
line hits of 0.1×–16× *base* on a 1000× round: its 25,000× is a rare corner of
a spread, not a 1-in-26 binary, which is how it clears the tail rows this mode
cannot. It is NOT evidence that any rule is soft for a binary mode. This mode
stays purely binary; if review objects to 95% non-paying, the first fix is a
token pair payout (retention ~2e-3 on the card-3 miss returns 1× base on a
pair: hit rate 1 in 5, RTP cost ~0.06%, trips unchanged).

**High Stakes went 20% → 16% in the same pass.** The rebuild measured CVaR
624.6 and std 36.58, both clear (the exhaustive model had said 682 / 36.3 — it
runs a few percent hot on the tail). A card-2 bust still shows 0.3× (1.995 ×
0.16 × 0.995 floors to it); only card-3/4 busts pay less. Classic stays at 30%:
with High Stakes at 16% it is already the arithmetic middle on std medians
(3.6 / 5.7 / 7.9); 35% would have evened the ceiling ladder (585 / 1122 / 2169,
×1.9 twice) and was declined.
