# RGS verification test plan

52 checks to run against the **uploaded** build on a Developer-page session,
not against localhost.

That distinction is the whole reason this document exists. Locally the game
falls back to `roundContract`, which deals its own cards and credits its own
wins without ever making a request - so the entire settlement path, every
jurisdiction flag and all of the bet limits are simply never executed. Every
serious bug found late in this project hid in exactly that gap: an unwinnable
bet mode the UI allowed, wins that were never credited, autoplay dying to a
rate limit, and a defensive `end-round` that returned 400 before every spin.
None of them were reproducible before upload.

Read alongside [README.md](README.md#submitting-for-approval), which lists what
has already been verified against Stake's published criteria.

## How to read this

Severity is about what it costs if it ships, not how hard it is to fix.

| Severity | Meaning |
| --- | --- |
| **Blocker** | Takes real money, stops play, or fails a mandatory approval criterion. Do not submit. |
| **Major** | Visibly wrong to a reviewer, or breaks a feature a regulator asked for. |
| **Minor** | Cosmetic, or a nicety that degrades gracefully. |

Test IDs encode their area (`RND-03`, `END-01`) so a failure can be referenced
without quoting the whole title.

## Before you start

Most of this is unrunnable without the following. Set it up first.

| What | Why it is needed |
| --- | --- |
| Devtools, Network + Console | Half these tests are assertions about requests, not pixels |
| A funded test account | Settlement and balance-drift tests need real spins |
| A near-empty account | The only way to reach `ERR_IPB` |
| A zero-decimal currency (JPY / KRW) | Rounding differs from every other currency |
| A social account (GC / SC) | Separate wording and suffix rules |
| A real phone, on cellular | Desktop throttling does not reproduce touch targets or real latency |

Filter the console to `[RideTheBus]`. The game logs its own warnings under that
prefix - rate-limit backoff, missing balances, failed settles - and several
tests below are pass/fail purely on whether one of those lines appears.

---

## 01 · Session and launch

The handshake. If `/wallet/authenticate` is misread, everything downstream
inherits the mistake, usually silently.

- [ ] **SES-01 · Cold launch completes the handshake** — *Blocker*
  Open the game URL fresh with the Network tab open.
  **Expect:** `/wallet/authenticate` returns 200; balance, currency and bet
  limits on the control bar all match the account; the loader clears to the
  start screen.

- [ ] **SES-02 · Balance matches the operator's figure exactly** — *Blocker*
  Compare the displayed balance against the operator UI, to the last decimal.
  **Expect:** identical. The RGS speaks micro-units (1,000,000 = 1.00); a
  factor-of-100 or 1,000,000 error here is the most damaging bug possible, and
  a display-only scaling error still governs affordability checks - so it
  silently changes which bets the player is allowed to place.

- [ ] **SES-03 · Expired session is explained, not dumped raw** — *Major*
  Leave the game idle until the session lapses, or invalidate the session ID,
  then spin.
  **Expect:** a readable modal ("Your session has expired. Please reload the
  game.") with a reload action. Never a raw `ERR_IS` or `[object Object]`.
  Both `ERR_IS` and `ERR_ATE` map here and are the only two codes offering a
  reload.

- [ ] **SES-04 · Reload mid-round restores cleanly** — *Major*
  Spin, then hard-reload while the cards are revealing.
  **Expect:** correct balance on return. Either the interrupted round replays
  onto the board or it settles silently, but the balance must be right either
  way and no error modal appears.

---

## 02 · Bets and limits

Limits come from the RGS, not from the game. They are never populated locally,
so this section is genuinely untested until upload.

- [ ] **BET-01 · Min, max and step come from the RGS** — *Blocker*
  Compare the stepper's bounds against `betLimits` in the authenticate response.
  **Expect:** stepping down stops at `minBet`, up at `maxBet`, each press moves
  by `stepBet`, and the quick-select menu offers only allowed levels.

- [ ] **BET-02 · Insufficient balance is caught before the request** — *Major*
  On the near-empty account, set a bet above the balance and try to spin.
  **Expect:** spin is disabled and explains why on hover. If a request does go
  out, `ERR_IPB` renders as "Not enough balance for that bet."

- [ ] **BET-03 · Equal + Inside stays unselectable** — *Blocker*
  Pick **Equal** at stage 2, then try to pick **Inside** at stage 3.
  **Expect:** Inside is struck through and dimmed, hovering explains why, and it
  cannot be selected by click, keyboard or tap. Tying the rank leaves nothing
  strictly between the two cards, so the math publishes no such mode -
  2 x (3x3 - 1) x 4 = **64** per mode family, not 72, and 192 published in
  total across the three families. Sending the missing mode earns `ERR_VAL`.

- [ ] **BET-04 · Sample the mode space** — *Major*
  Play at least one round in each guess family, checking the mode string sent in
  `/wallet/play`: no Equal picks (e.g. `red_higher_outside_heart`), Equal at
  Higher/Lower only, Equal at Inside/Outside only, and Equal at both.
  **Expect:** all accepted; the mode string is always `colour_hl_io_suit` and
  matches the four buttons lit on screen.

- [ ] **BET-06 · Every bet mode is accepted** — *Blocker*
  Play at least one round in each of the three modes — Classic, Second Chance,
  High Stakes — and check the mode string sent in `/wallet/play`.
  **Expect:** Classic sends an unprefixed name, the others `sc_`/`hs_`. All
  accepted. There are 192 published modes; a rejection here means the math
  version live on the site predates the three-family build.

- [ ] **BET-07 · Every mode debits exactly the bet** — *Blocker*
  Note the balance, place one round in each mode, and check what was taken.
  **Expect:** exactly the bet shown, in all three. Every mode costs 1.0×, so no
  mode should ever debit a multiple — and the bet display should show a single
  plain figure with no multiplier line. If a multiplied amount appears, a cost
  has drifted away from 1.0 in `FAMILY_RULES` or `MODE_FAMILIES`.

- [ ] **BET-09 · Second Chance forgives exactly once, never on card 1** — *Major*
  Play Second Chance until a round misses card 1, then until one misses a later
  card, then until one misses twice.
  **Expect:** card 1 wrong ends the round and pays nothing, exactly like
  Classic. A later miss shows the amber return mark, and the reveal
  **continues**. A second miss ends the round with the usual bust cross.

- [ ] **BET-10 · Mode is locked during an autoplay run** — *Minor*
  Start autoplay, then try to change mode.
  **Expect:** the mode control is disabled for the duration. The run was
  started on one mode's odds and cost.

- [ ] **BET-05 · A rejected bet recovers** — *Major*
  Provoke an `ERR_VAL` (an out-of-range amount is easiest).
  **Expect:** "That bet was rejected. Please adjust the amount and try again."
  Dismissing leaves the game playable and the stake not deducted.

---

## 03 · Round settlement

The highest-risk area, and the one that cannot be exercised locally at all.

A winning round needs a second call - `/wallet/end-round` - to credit the payout
and close the round. Losing rounds auto-close on the RGS and must **not** send
one.

- [ ] **RND-01 · A win settles and credits** — *Blocker*
  Play until a round pays, watching the Network tab throughout.
  **Expect:** exactly one `/wallet/play`, then exactly one `/wallet/end-round`,
  both 200. Balance afterwards equals *before - stake + payout*.

- [ ] **RND-02 · A losing round sends no end-round** — *Major*
  Bust on card 1, so the round pays nothing.
  **Expect:** one `/wallet/play` and **no** `end-round`. No 400 anywhere.
  Zero-payout rounds close themselves; calling end-round anyway returned 400
  before every single spin, which is the noise that hid a real failure.

- [ ] **RND-03 · Balance does not drift down over a long run** — *Blocker*
  Note the starting balance, run 100+ rounds, compare against the operator's
  figure.
  **Expect:** they agree, and no `end-round returned no usable balance` in the
  console. This is the nastiest failure mode in the game: play debits the stake,
  and if the credit never lands the tracked balance only ever falls - eventually
  dropping below the bet, so autoplay stops for "insufficient funds" while the
  real balance is fine.

- [ ] **RND-04 · Partial wins pay the right fraction** — *Major*
  Bust deliberately at each stage: card 1 wrong pays nothing; card 2 wrong pays
  0.5x the stake; card 3 or 4 wrong keeps 30% of the multiplier built so far.
  **Expect:** the screen matches the book's `finalWin` event, and the credited
  balance matches the screen.

- [ ] **RND-05 · Kill the connection mid-round** — *Blocker*
  Spin, go offline in devtools before the reveal finishes, then come back online
  and reload.
  **Expect:** the game recovers. If a round was left open the next spin settles
  it first and proceeds - no permanent `ERR_VAL` lock needing a manual refresh.

---

## 04 · Autoplay endurance

Autoplay stopping early has been the most persistent bug in this project, with
four separate root causes so far, and it only ever reproduces against a real
RGS. Budget real time here - it is the section most likely to still be hiding
something.

**Requests are paced deliberately.** Bets are floored at 900 ms apart and any
two RGS calls at 400 ms, independent of turbo (see
`web-sdk/apps/Ride-The-Bus/src/game/rgsPacingMath.ts`). A 500-round run
therefore takes roughly 8-10 minutes and cannot be hurried. That is the fix
working, not a hang.

- [ ] **END-01 · 500 rounds, turbo at Instant, unattended** — *Blocker*
  Set turbo to maximum, autoplay to 500 (or unlimited), and leave it.
  **Expect:** it runs the full count and stops because the counter reached zero,
  not because of an error. No 429s, no unhandled rejections.

- [ ] **END-02 · Confirm request spacing on the wire** — *Major*
  During the run, sort the Network tab by time and read the gaps between
  consecutive RGS calls.
  **Expect:** no two calls closer than ~400 ms, no two `/wallet/play` closer
  than ~900 ms, and traffic that looks evenly spaced rather than arriving in
  pairs. The earlier failure was bursty rather than fast on average - play and
  end-round landed ~200 ms apart, then the line went quiet - and a fixed-window
  limiter measures the burst.

- [ ] **END-03 · If a 429 appears, the run survives it** — *Blocker*
  Search the console for `rate limited by the RGS`.
  **Expect:** ideally absent. If present, autoplay must **continue** - the line
  reports the retry and the widened spacing, and the run carries on. A 429 that
  stops the run is a blocker. Note the printed spacing figures: if they climb to
  the 2000/4000 ms ceilings, the floors are too low for this session's limit and
  need raising in `rgsPacingMath.ts`.

- [ ] **END-04 · Stop is honoured without losing the round in flight** — *Major*
  Start a long run, then press the red stop square mid-reveal.
  **Expect:** the round already in play finishes and settles normally, no new
  round starts, and the final result stays on the board.

- [ ] **END-05 · Stop on full-game win fires on the right round** — *Minor*
  Enable stop-on-full-win and run until all four cards land.
  **Expect:** the run ends on that round; a partial win, however large, does not
  stop it.

- [ ] **END-06 · Autoplay runs the balance down gracefully** — *Major*
  On the near-empty account, set unlimited autoplay and let it exhaust the
  balance.
  **Expect:** it stops cleanly when the next bet is unaffordable, with the
  balance genuinely spent - cross-check against the operator's figure to rule
  out an early stop caused by a tracking error.

---

## 05 · Jurisdiction flags

The RGS sends a `jurisdiction` block that switches features off for regulated
markets. Each flag has a visible consequence and a reviewer will check them.

| Flag | Expected effect | Severity |
| --- | --- | --- |
| `disabledTurbo` | Turbo control gone or inert; reveal always at normal speed | Major |
| `disabledSuperTurbo` | Slider capped at 0.8 - cannot reach Instant | Major |
| `disabledAutoplay` | Autoplay button and popup unavailable; spacebar hold does not start a run | Blocker |
| `disabledSlamstop` | Spin does not become Skip mid-reveal; animation always plays out | Major |
| `disabledSpacebar` | Spacebar does nothing, tap or hold | Major |
| `disabledFullscreen` | No fullscreen control | Minor |
| `minimumRoundDuration` | Spin held disabled between rounds; tooltip states the interval in seconds | Blocker |
| `displayRTP` | RTP shown in the control bar | Major |
| `displayNetPosition` | Session net win/loss shown | Major |
| `displaySessionTimer` | Elapsed session time shown | Major |
| `socialCasino` | Social wording throughout; GC/SC amounts | Blocker |

If the operator cannot vary these server-side, they can be driven from the
address bar **on a dev build only** - `?dev_disabledTurbo=1`,
`?dev_minimumRoundDuration=2500`, and so on (see `src/game/devOverrides.ts`).
Those overrides are compiled out of a production bundle, so on the uploaded
build they do nothing. Record which route you used: a flag verified only via dev
override is not verified for submission.

- [ ] **JUR-01 · Every flag in the table behaves** — *Blocker*
  **Expect:** each row's effect is visible, and turning the flag off restores
  the feature.

- [ ] **JUR-02 · A missing jurisdiction block does not break the game** — *Blocker*
  Play a session on an account whose authenticate response carries no
  jurisdiction block.
  **Expect:** the game plays with everything permitted - no crash, no blank
  screen, no feature stuck off. The SDK assigns the block unconditionally, so an
  absent one replaces the defaults with `undefined`, and every read has to
  survive that.

- [ ] **JUR-03 · Minimum round duration is enforced, and slam cannot beat it** — *Blocker*
  With a minimum duration set, spin and immediately try to skip the reveal and
  spin again.
  **Expect:** the gate holds for the full interval regardless of skipping or
  turbo, and the tooltip names the interval in seconds.

---

## 06 · Currency display

Decimal places follow Stake's own table, which disagrees with ISO on nine
currencies. Only these five are shown with no decimal places.

| Currency | Decimals | 1,234.5 shows as |
| --- | --- | --- |
| JPY, IDR, KRW, VND, CLP | 0 | `1,235` |
| Everything else | 2 | `1,234.50` |

- [ ] **CUR-01 · Zero-decimal currency renders whole** — *Major*
  Launch on JPY or KRW.
  **Expect:** no decimal point anywhere - balance, bet, payout, win takeover,
  Last Win.

- [ ] **CUR-02 · Sub-cent payouts are not shown as zero** — *Major*
  Set the smallest possible bet and win a small multiplier, so the payout falls
  below one cent.
  **Expect:** extra decimal places appear so the amount is visible, never a flat
  `0.00` for a round that paid. The RGS carries six decimal places; a win of
  0.004 rendered at two places reads as a game that took the stake and paid
  nothing.

- [ ] **CUR-03 · Social currencies use the right suffix** — *Blocker*
  Launch on the social account.
  **Expect:** amounts carry the GC / SC suffix in Stake's format, and no wording
  anywhere implies real money.

- [ ] **CUR-04 · Large amounts stay inside their boxes** — *Minor*
  Use a high-balance account in a high-denomination currency (IDR or VND run to
  millions of units).
  **Expect:** correct thousands separators, and nothing overflowing or
  truncating on the control bar or the win takeover.

---

## 07 · Win presentation

Tiers are keyed on payout size, not on surviving all four cards - except that
a full-game win is floored into the bottom tier, because the smallest possible
one pays 6.6x and would otherwise pass in silence.

**Every band is per mode.** A tier is a claim about how RARE something is, and
the three families spread their payouts differently, so one shared set of
thresholds made the same word mean different things. Each ladder is solved to
land on the same rarities - Classic's originals - with Max Win being exactly
that mode's ceiling:

| Tier | Classic | Second Chance | High Stakes | Roughly |
| --- | ---: | ---: | ---: | ---: |
| Big Win | 10x | 11x | 12x | 1 in 70 |
| Huge Win | 40x | 28x | 50x | 1 in 300 |
| Mega Win | 120x | 60x | 130x | 1 in 3,100 |
| Epic Win | 300x | 130x | 440x | 1 in 15,800 |
| Max Win | 1354.2x | 585.2x | 1910.2x | 1 in 36,400 |

At the old shared thresholds, "Epic" was 1 in 16,198 on Classic but 1 in 26,768
on Second Chance - nearly as rare as that mode's Max Win, squashing the top of
its ladder into one step - and 1 in 12,238 on High Stakes, which pays a busted
round less and so climbs higher.

**The full-game-win floor is off for Second Chance.** Forgiveness means most of
its rounds reach card 4, so treating that as remarkable made the takeover fire
on nearly every round. It still celebrates on size.

- [ ] **WIN-01 · The headline never contradicts the number** — *Major*
  Over a long run, check each takeover's title against its final multiplier.
  **Expect:** the word always matches the band above. Watch particularly for a
  max win reading "Epic Win" - the payout arrives as a division of two rounded
  numbers and can land at 1354.1999...

- [ ] **WIN-02 · A small full-game win still celebrates (Classic, High Stakes)** — *Major*
  On Classic, and again on High Stakes, land all four guesses on a round paying
  under 10x.
  **Expect:** the takeover appears, titled Big Win. Landing all four is the
  point of the game in these modes and must never pass unmarked.

- [ ] **WIN-07 · Second Chance does NOT celebrate every completed round** — *Major*
  On Second Chance, play until a round lands all four cards for under 10x -
  including one where the first wrong guess was forgiven and play carried on.
  **Expect:** no takeover, just the ordinary win. Because forgiveness makes
  finishing the round the common case, a takeover here would fire on most rounds.

- [ ] **WIN-08 · Second Chance still celebrates on size** — *Major*
  On Second Chance, reach a round paying 10x or more.
  **Expect:** the takeover appears at the usual thresholds (10x / 40x / 120x /
  300x). Suppressing the floor must not have suppressed the ladder - this is the
  half of WIN-07 that is easy to break.

- [ ] **WIN-09 · Max Win is announced on each mode's own ceiling** — *Major*
  Use a max-win replay ID for each family (see REPLAY_EVENTS.md).
  **Expect:** "Max Win" on 1354.2x in Classic, on 585.2x in Second Chance and on
  1910.2x in High Stakes. Two specific failures to watch for: a High Stakes win
  of 1354.2x - which is NOT its maximum - announcing "Max Win", and a Second
  Chance ceiling of 585.2x announcing only "Epic Win".

- [ ] **WIN-10 · The lower bands differ per mode too** — *Minor*
  Win about 30x on Second Chance, then about 30x on High Stakes.
  **Expect:** "Huge Win" on Second Chance (its band opens at 28x) and only "Big
  Win" on High Stakes (whose Huge band opens at 50x). Same payout, different
  titles - that is correct, because it is a far rarer result in one than the
  other. If both read the same, the ladders have been collapsed back into one.

- [ ] **WIN-03 · Count-up, skip and dismiss** — *Minor*
  On a multi-tier win: let it climb, tap mid-climb, then tap again once settled.
  **Expect:** starts at zero, climbs, pauses ~1 s at each ceiling with the title
  escalating; a tap jumps to the next tier's floor; once settled a tap
  dismisses. The title never disappears and re-enters between tiers.

- [ ] **WIN-04 · Turbo does not touch the win animation** — *Minor*
  Trigger comparable wins at Normal and at Instant.
  **Expect:** the count-up runs at the same speed both times. Turbo governs the
  card reveal only.

- [ ] **WIN-05 · Autoplay skip setting behaves both ways** — *Minor*
  Run autoplay with "skip win animations" on, then off.
  **Expect:** on - the final amount appears immediately and holds briefly
  (longer for rarer tiers) before the run continues; off - the full count-up
  plays. Either way the run continues afterwards.

- [ ] **WIN-06 · The takeover is keyboard-dismissable** — *Minor*
  With a takeover on screen, press Enter or Space.
  **Expect:** it skips, then dismisses, exactly as tapping does - and Space does
  not scroll the page behind it.

---

## 08 · Replay

Reviewers use replay to audit specific rounds, so it gets looked at closely.
Event IDs per bet mode are in [REPLAY_EVENTS.md](REPLAY_EVENTS.md).

**One known open question.** A replay opened on the Stake Engine site showed a
bet amount of `1000` where the game rendered `1` - an exact 1000x disagreement,
which points at a units convention (micro-units vs display units) rather than a
rounding bug.

Stake documents the replay `amount` parameter as "bet amount in units", and the
RGS speaks micro-units (1,000,000 = 1.00), so `Authenticate.svelte:121-122`
divides by `API_AMOUNT_MULTIPLIER`. That matches the documented convention -
what is unknown is what Stake actually puts in the parameter.

**Capturing it is now one console line.** A replay needs no session ("player
session is not required for viewing bet replay"), so the whole query string from
a Stake replay URL can be pasted onto `localhost:3001` and the same round loads
against the same `rgs_url`:

```
http://localhost:3001/?replay=true&game=...&version=1&mode=hs_red_equal_equal_spade&event=283&rgs_url=...&amount=...&currency=USD
```

Filter the console to `[RideTheBus]` and read `REP-02 replay amount chain`. It
prints `rawAmountParam`, `parsedAmount`, `wageredBetAmount`, `betAmount`,
`initialBet` and `currency`. Compare `rawAmountParam` against the stake shown on
Stake's own replay view - that single pair settles which side is scaling wrong.

The probe is behind `import.meta.env.DEV`, so it is compiled out of the uploaded
build. That is deliberate: approval checks the network tab for game information
being logged, so this must not become a production-visible flag.

- [ ] **REP-01 · A replay renders the original round** — *Blocker*
  Take a round ID from a real session and open it in replay.
  **Expect:** the same four cards, the same guesses lit, the same stage
  multipliers and the same final payout.

- [ ] **REP-02 · Replay bet amount matches the original round** — *Blocker*
  Compare the stake shown in replay against the stake actually placed.
  **Expect:** identical. If they differ by exactly 1000x or 100x, record both
  figures and the raw `amount` from the response.

- [ ] **REP-03 · Replay places no bets** — *Blocker*
  In replay, press every control you can - spin, autoplay, the bet stepper.
  **Expect:** no `/wallet/play` and no `end-round` in the Network tab, the
  balance never moves, and spin re-runs the same round only.

- [ ] **REP-05 · The replay details name the mode and its guesses** — *Major*
  Open a replay for a `sc_` mode and one for an `hs_` mode, e.g.
  `sc_red_higher_equal_spade`.
  **Expect:** a "Game mode" row reading Classic, Second Chance or High Stakes,
  and a "Guesses" row of four labelled badges. **Fail if the raw mode slug is
  printed** - the parser used to split on `_` and require four parts, which every
  prefixed mode fails, so those rounds showed their identifier instead of their
  picks.

- [ ] **REP-04 · Currency in the replay URL is honoured** — *Major*
  Open a replay with an explicit `?currency=`, including a zero-decimal one.
  **Expect:** amounts formatted for that currency, with the right number of
  decimal places.

---

## 09 · Localisation

Sixteen languages: `ar de en es fi fr hi id ja ko pl pt ru tr vi zh`. Only
English is required for approval; the rest are shipped.

- [ ] **LNG-01 · Each language loads and nothing falls back to English** — *Major*
  Launch in each of the sixteen, opening How to Play, the autoplay popup and an
  error modal in each.
  **Expect:** fully translated. Acronyms like RTP staying in Latin script is
  correct and expected.

- [ ] **LNG-02 · No "uncompiled message" warnings** — *Minor*
  Watch the console while switching languages.
  **Expect:** clean - no Lingui warnings about uncompiled messages.

- [ ] **LNG-03 · Arabic does not break the layout** — *Major*
  Launch in Arabic and work through the whole UI.
  **Expect:** text legible, nothing overlapping or overflowing, and card ranks
  and suits still left-to-right.

- [ ] **LNG-04 · The longest languages do not overflow** — *Minor*
  German and Finnish produce the longest strings; check the control bar and
  every popup title.
  **Expect:** no clipping, no ellipsis on a control label, no wrapping that
  breaks the bar.

---

## 10 · Compliance surface

The specific things an approval reviewer opens the game to find. All of them
live in the How to Play panel behind the `i` button.

- [ ] **CMP-01 · RTP is stated and reachable during play** — *Blocker*
  **Expect:** 96.00%, reachable at any point during play, consistent with the
  submitted math. It is interpolated from `game/config.ts` rather than written
  out, so it cannot drift from the figure the math is built to.

- [ ] **CMP-02 · Max win is stated and matches the math** — *Blocker*
  **Expect:** 1354.2x - the true enumerated ceiling, not the declared bound of
  1400 in the config.

- [ ] **CMP-03 · Disclaimer is present and complete** — *Blocker*
  **Expect:** covers malfunction voiding plays, the connection requirement,
  expected return over many plays, and settlement from the Remote Game Server
  rather than the browser.

- [ ] **CMP-04 · No claims the game cannot honour** — *Major*
  **Expect:** the panel states there are no free spins, bonus rounds, jackpots
  or re-triggers, and the game has none. Payouts are described as dynamic, which
  they are.

- [ ] **CMP-05 · Provider name is real** — *Blocker*
  Check `providerName` in `game/config.ts` against the operator's registered
  name.
  **Expect:** the real provider, not SDK template boilerplate.

---

## 11 · Devices

Test on real hardware. A desktop browser resized to phone dimensions does not
reproduce touch target sizes, and this is the weakest area of the game.

**Re-measured in a browser at each target viewport.** This section used to warn
that the guess controls land at 21-39 px and the help text at 3-6 px. Both
figures predate their fixes. The figures below replace a second stale set (41 px
segments, 44 px bar icons) that came from a `--ui` coefficient which was itself
10% too large - it made every control look comfortable on paper while actually
wrapping the card row and the guess row 3 + 1 on every phone.

| Control | Mobile S 320 | Mobile M 375 | Mobile L 425 | Against |
| --- | --- | --- | --- | --- |
| Guess square | 59 px | 69 px | 78 px | — |
| Guess segments (`.third-btn`, `.half-btn`) | **29 px** | **35 px** | **39 px** | 24 px AA floor |
| Suit quadrants | **29 x 29** | **35 x 35** | **39 x 39** | 24 px AA floor |
| Equal badge, tap area | **27 px** | **31 px** | **32 px** | 24 px AA floor |
| Control-bar icons / round buttons | **36 px** | **36 px** | **36 px** | 24 px AA floor |
| Bet steppers | hidden | hidden | **30 x 26** | 24 px AA floor |
| Intro `?` badge | **44 px** overspill | **44 px** | **44 px** | 44 px comfortable |
| Intro tip text | 13 px floor | 13 px floor | 13 px floor | legibility |

The 21 px figure was the guess segments when the higher/lower square held three
stacked thirds. It is now two halves plus an overlaid chip. The genuinely
undersized control was the **equal badge** - the most expensive miss on the
board, since it sits on the seam and a near-miss buys the other bet rather than
doing nothing. Its tap area is grown independently of its paint, to whichever is
smaller of 32 px and 45% of the square: a flat 32 px reaches 16 px either side of
the seam, and on a 320 px screen a segment's own centre is only 14.7 px out, so
aiming at the middle of Higher would have bought Equal. Tied to the square, the
reach is 13-16 px and the segment centre stays clear by 1.5-3.6 px everywhere.

Nothing here is below the 24 px WCAG 2.2 AA floor. The remaining gap is against
the 44 px *comfortable* target, which the guess controls cannot reach
geometrically: four cards across a 375 px viewport cap `--ui` at 2.265vw, so the
square is 69 px and its halves 35 px. Only a non-square control could do better,
and a non-square control would be a different shape from the one every other
screen draws. The bar's icons are floored at 36 px rather than 44 for the same
reason - at 44 px the bar overflowed a 375 px viewport on both of its rows.

**Still confirm on hardware** - these are computed and measured in a desktop
browser at emulated viewports, not on a device, and the segments have the equal
badge taking a bite out of their inner edge.

- [ ] **DEV-01 · Phone, portrait - a full round is playable** — *Blocker*
  On a real phone, set all four guesses, spin, and read the result.
  **Expect:** every control hittable first time, nothing clipped, no zooming
  needed, no accidental mis-taps between adjacent halves.

- [ ] **DEV-02 · Phone, landscape** — *Major*
  **Expect:** board and control bar both fit without page scrolling, and the win
  takeover fits the short axis.

- [ ] **DEV-03 · Start screen fits without scrolling** — *Major*
  Across phone, tablet and desktop, at several window sizes.
  **Expect:** all four steps stay on one row, the whole screen fits, and the `?`
  badges open their explanations by tap as well as hover.

- [ ] **DEV-04 · Suit and sound icons render identically everywhere** — *Minor*
  Compare the four suits and the mute button across iOS, Android, Windows and
  macOS.
  **Expect:** identical shapes and weights - they are drawn, not emoji,
  precisely so no platform substitutes its own.

- [ ] **DEV-05 · Cellular latency does not break the round** — *Major*
  Play on a real mobile connection, not office wifi.
  **Expect:** slow responses delay the reveal but never double-charge, never
  desync the balance and never strand the spin button disabled.

---

## 12 · Regression watch

Bugs already found and fixed. Every one reached a build, so each is worth a
deliberate look rather than trusting the fix.

| Was | Covered by |
| --- | --- |
| Autoplay stopped partway through | `END-01` |
| 429 killed the run outright | `END-03` |
| `end-round` 400'd before every spin | `RND-02` |
| Wins never credited; balance only fell | `RND-03` |
| Refused rounds still burned the counter | `END-06` |
| Sub-cent payouts displayed as `0.00` | `CUR-02` |
| Currency decimals disagreed with Stake on 9 currencies | `CUR-01` |
| Full win under 10x showed no celebration | `WIN-02` |
| Win title vanished and re-entered between tiers | `WIN-03` |
| 18 strings untranslated in all 15 languages | `LNG-01` |
| Emoji suits rendered differently per platform | `DEV-04` |
| Start screen overflowed and scrolled | `DEV-03` |

- [ ] **REG-01 · Console is clean across a full session** — *Major*
  From cold launch through 100 rounds, autoplay, a win takeover, every popup and
  a language switch.
  **Expect:** no uncaught errors, no unhandled rejections, no 4xx or 5xx except
  ones a test here deliberately provoked.

---

## Recording results

For each failure capture the test ID, the request and response bodies from the
Network tab, the console output, and the account and currency you were on.
Settlement and pacing bugs are timing-dependent and often will not reproduce
without those details.

**Two items need a decision rather than just a result:** the replay bet amount
convention (`REP-02`) and small-screen touch targets (`DEV-01`).
