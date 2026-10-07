# RGS verification test plan

132 checks to run against the **uploaded** build on a Developer-page session,
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
| A Studio launch link | The Developer page's play modal starts demo sessions with play money; its URL's `currency`, `balance`, `social` and `language` parameters make the JPY, IDR, near-empty and social sessions. How to drive one from a browser - and every script used so far - is the `rtb-live-audit` skill |

Filter the console to `[RideTheBus]`. The game logs its own warnings under that
prefix - rate-limit backoff, missing balances, failed settles - and several
tests below are pass/fail purely on whether one of those lines appears.

## Already verified locally (still to confirm on the uploaded build)

Some checks here are pure frontend and need no funded account, so they have been
driven headless against the local dev game and **pass**. They are recorded rather
than ticked, because this document's whole premise is that localhost is not the
uploaded build - the game deals from `roundContract` without a session, so
nothing below exercises the RGS. Treat these as "expected to pass, and known to
pass in a browser", not as done.

| Check | Local evidence |
| --- | --- |
| `CMP-01` RTP stated | 96.00% present in How to Play |
| `CMP-06b` Worked example per mode | "Lower on a 3 pays about …" reads 4.75× / 3.67× / 5.28× on the Classic / Second Chance / High Stakes tabs, matching that tab's own paytable |
| `CMP-03` Disclaimer | all required points present |
| `CMP-06` Paytable | 8 payout rows rendered |
| `CMP-07` Mode description and cost | 3 tabs, cost and ceiling on each |
| `CMP-08` UI guide | Controls section names every bar button |
| `CMP-09` Sound can be disabled | both buses mute independently and survive a reload |
| `CMP-10` Spacebar bound to the bet button | plays with nothing focused AND with a guess square, the die or a bar button focused (keydown and keyup both taken); refuses only on a focused INPUT, an open panel, the intro and the takeover |
| `CMP-10b` Spacebar refused behind a panel | How to Play open, all four guesses picked, Space: no `/wallet/play` (it used to buy one behind the panel); with the panel closed the same press does |
| `CMP-11` Frame never scrolls | all seven target sizes, idle / bet menu open / How to Play open |
| `CMP-12` Double-tap zoom off, pinch intact | `touch-action: manipulation`, no `user-scalable=no` |
| `BET-12` Mode change confirmed | picking a family shows the confirmation; Cancel leaves the live mode alone |
| `BET-13` Autoplay confirmed | the panel opens with a Start button and begins no round on its own |
| `LNG-05` Malformed `?lang=` | `en_US`, `zz!!`, `en;a`, empty, `po`, `xx`, `ar`, `de` all render every money readout, no RangeError |
| `REP-04b` Malformed `?currency=` on a replay | `currency=ab` renders the replay in the USD default, no RangeError (the raw parameter used to override the validated one) |
| `SOC-01` No restricted term on screen | 761 visible strings swept across board, rules (3 tabs), bet menu, autoplay, mode picker and confirmation |
| `SOC-02` High Risk naming | mode tabs read Classic / Second Chance / High Risk |
| `SOC-03` English only in social mode | `de`, `ar`, `ja` all render English, `dir=ltr` |
| `SOC-04` SC / GC / XEC suffix | "1.00 SC" / "1.00 GC", no `$` prefix |
| `REP-06` Play Again | present and enabled at Desktop, Popout S and Mobile M |
| `REP-07` Replay in Popout S | board undistorted, bar on one row, no frame scroll |
| `WIN-11` Per-mode ceiling stated | 68.2x and 85.8x shown beside the family figure; suppressed when equal |

**Mobile S (320 x 568) win takeover: checked.** The Max Win tier renders at
320 x 568 with the title, amount, multiplier and prompt all legible and no
horizontal overflow. The title overlaps the bottom of the card fan more than it
does at 375, which is the shadow band doing its documented job - it reaches up
over the bottom of the fan so the title is never cream type on white card faces -
and the ranks and pips still read above it. A real device is still open.

---

## 01 · Session and launch

The handshake. If `/wallet/authenticate` is misread, everything downstream
inherits the mistake, usually silently.

- [x] **SES-01 · Cold launch completes the handshake** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): authenticate 200; Balance $1,000.00 and Bet $1.00 match 1,000,000,000 / 1,000,000 micro; 42 levels; the loader cleared to the intro.
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD): smoke re-run - cold launch, then five Classic rounds: every debit and the one credit exact (a 0.5x win, end-round 500000 of 500000), Last Win agrees.
  Open the game URL fresh with the Network tab open.
  **Expect:** `/wallet/authenticate` returns 200; balance, currency and bet
  limits on the control bar all match the account; the loader clears to the
  start screen.

- [x] **SES-02 · Balance matches the operator's figure exactly** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): board $1,000.00 = RGS 1,000,000,000 micro; held to the cent through 500+ rounds.
  Compare the displayed balance against the operator UI, to the last decimal.
  **Expect:** identical. The RGS speaks micro-units (1,000,000 = 1.00); a
  factor-of-100 or 1,000,000 error here is the most damaging bug possible, and
  a display-only scaling error still governs affordability checks - so it
  silently changes which bets the player is allowed to place.

- [ ] **SES-03 · Expired session is explained, not dumped raw** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD, SIMULATED): FAIL. a forged session token (the request's sessionID rewritten in the browser) gets a bare `400 Bad Request` from the RGS - no ERR_IS, no body - so the dialog said "Something went wrong" with Close only. A real lapse could not be produced on demand. FIXED LOCALLY (unconfirmed live): a failure the dialog cannot name now offers Reload beside Close; ERR_IS/ERR_ATE keep Reload alone. Re-run on the next upload, and once more after a session has genuinely lapsed.
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD, SIMULATED): the forged session's bare `400 Bad Request` now raises "Something went wrong. Please try again." with Close AND Reload, on top of everything. Still open only for a genuine lapse (ERR_IS), which cannot be produced on demand; its Reload-only path is unit-tested (`errorModal.test.ts`).
  Leave the game idle until the session lapses, or invalidate the session ID,
  then spin.
  **Expect:** a readable modal ("Your session has expired. Please reload the
  game.") with a reload action. Never a raw `ERR_IS` or `[object Object]`.
  Both `ERR_IS` and `ERR_ATE` map here and are the only two codes offering a
  reload.

- [x] **SES-04 · Reload mid-round restores cleanly** — *Major*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): frame reloaded mid-round: the round resumed and settled (end-round 200, credit exact). BUT the resumed reveal runs behind the intro screen - finding F-3.
  Spin, then hard-reload while the cards are revealing. Do it once on a guess
  mode and once on Three of a Kind.
  **Expect:** correct balance on return. Either the interrupted round replays
  onto the board or it settles silently, but the balance must be right either
  way and no error modal appears. A resumed round comes back on its OWN family
  - three slots, the purple MODE button and the 250x readout for Three of a
  Kind - not on whichever mode was last chosen; the resume path has dropped the
  family twice before.

- [x] **SES-05 · An invalid `rgs_url` fails cleanly** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): FAIL. Both a dead host and a garbage host raise the error modal in 1-2 s, but at z-index 91 it sits UNDER the loader (998) and the intro (1000): the player sees a normal intro and only finds the error after Tap to continue. The modal then offers Close only (no Reload) over a $0.00 board, with the raw detail "Failed to fetch". Finding F-4.
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD): PASS (F-4 fixed). A dead host (`rgs.invalid.example`) and one answering garbage (`example.com`) both raise the dialog within seconds ON TOP of the loader and the intro: "Could not reach the game server. Check your connection, then reload." with Reload, and no raw detail.
  Launch with `rgs_url` pointed at a host that does not answer, and again at one
  that answers with garbage.
  **Expect:** the error modal, promptly, with readable text and a reload action.
  Never an indefinite loader, a blank board, or a raw stack. This is a verbatim
  Stake PreCheck ("Game authentication fails correctly with an invalid
  `rgs_url`"), and the loader's own 8000 ms ceiling is what stops the first
  case stranding a player on a spinner.

- [x] **SES-06 · The build carries no Stake Engine Loader** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): deployed index.html searched: no LoaderStakeEngine, no #041721 loader background; only the game's own loader. Deployed index.html is byte-identical to build/ (sha256 b44f9e83...).
  Search the deployed bundle for the SDK's loader markup and watch the load
  sequence.
  **Expect:** only this game's own CSS loader appears. A verbatim PreCheck
  ("Game should not contain the Stake Engine Loader").


- [x] **SES-07 · A failure the dialog cannot name still offers a way out** — *Major*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD, SIMULATED request): PASS. A rewritten session ID gets the RGS's bare `400 Bad Request`; the dialog, on top, reads "Something went wrong. Please try again." with Close and Reload (the detail line "RGS responded 400: Bad Request" stays, as for any failure the game cannot name).
  Rewrite one `/wallet/play` request's session ID in the browser (the RGS answers a
  bare `400 Bad Request`), then deal.
  **Expect:** "Something went wrong. Please try again." with **Reload** beside
  Close. A recognised code keeps its own single action (ERR_IS / ERR_ATE: Reload
  only; ERR_VAL and the rest: Close), and a launch failure offers Reload.

- [x] **SES-08 · The `/index.html` launch URL is clean** — *Minor*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD): PASS. `/ride-the-bus/v72/index.html?sessionID=...` loads exactly as the bare path does - intro, board, balance - with an empty console.
  Open the build as `…/v<front>/index.html?sessionID=…` - the form the SDK's own
  docs give.
  **Expect:** the game loads exactly as it does without `index.html`, and the
  console has no SvelteKit "Not found" error (it used to log one; `hooks.ts`
  reroutes the path).

---

## 02 · Bets and limits

Limits come from the RGS, not from the game. They are never populated locally,
so this section is genuinely untested until upload.

- [x] **BET-01 · Min, max and step come from the RGS** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): minus disabled at $0.01, 41 presses of plus walk all 42 RGS levels to $1,000.00, plus disabled there; the menu offers exactly the 42 levels; typed 5000 clamps to $1,000.00, 1.234 snaps to $1.23. A typed 0.004 shows "Bet $0.00" with the generic "Enter a valid bet" (finding F-1) - it is refused, no /wallet/play.
  Compare the stepper's bounds against `betLimits` in the authenticate response.
  **Expect:** stepping down stops at `minBet`, up at `maxBet`, each press moves
  by `stepBet`, and the quick-select menu offers only allowed levels.

- [x] **BET-02 · Insufficient balance is caught before the request** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD $3.00 balance): Bet $5.00 on $3.00: the deal is blocked with "Insufficient funds" and no `/wallet/play` goes out.
  On the near-empty account, set a bet above the balance and try to spin.
  **Expect:** spin is disabled and explains why on hover. If a request does go
  out, `ERR_IPB` renders as "Not enough balance for that bet."

- [x] **BET-03 · Equal + Inside stays unselectable** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): after Equal, Inside is disabled + aria-disabled; click and Enter do not select it; hover explains why.
  Pick **Equal** at stage 2, then try to pick **Inside** at stage 3.
  **Expect:** Inside is struck through and dimmed, hovering explains why, and it
  cannot be selected by click, keyboard or tap. Tying the rank leaves nothing
  strictly between the two cards, so the math publishes no such mode -
  2 x (3x3 - 1) x 4 = **64** per guess family, not 72, and 193 published in
  total - three families of 64 plus Three of a Kind's one. Sending the missing
  mode earns `ERR_VAL`.

- [x] **BET-04 · Sample the mode space** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): 26 rounds: `red_higher_outside_heart`, `sc_red_equal_outside_heart`, `hs_red_higher_equal_heart`, `ls_red_equal_equal_heart` - no Equal, Equal at Higher/Lower, at Inside/Outside, at both - all accepted, each string matching the lit squares; every round reconciled to the micro-unit (debit, credit, board).
  Play at least one round in each guess family, checking the mode string sent in
  `/wallet/play`: no Equal picks (e.g. `red_higher_outside_heart`), Equal at
  Higher/Lower only, Equal at Inside/Outside only, and Equal at both.
  **Expect:** all accepted; the mode string is always `colour_hl_io_suit` and
  matches the four buttons lit on screen.

- [x] **BET-06 · Every bet mode is accepted** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): all FIVE families accepted: red_higher_outside_heart, sc_..., ls_..., hs_..., and tr_any_equal_equal (three tokens).
  Play at least one round in each of the four modes — Classic, Second Chance,
  High Stakes, Three of a Kind — and check the mode string sent in
  `/wallet/play`.
  **Expect:** Classic sends an unprefixed name, the others `sc_`/`hs_`, and
  Three of a Kind sends exactly `tr_any_equal_equal` - three tokens, no suit.
  All accepted. There are 193 published modes; a rejection here means the math
  version live on the site predates the four-family build.

- [x] **BET-07 · Every guess mode debits exactly the bet** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): every guess mode debits exactly the bet (amount 10,000 micro on $0.01); the bet display is one plain figure.
  Note the balance, place one round in each guess mode, and check what was taken.
  **Expect:** exactly the bet shown, in all three. The guess modes cost 1.0×, so
  none should ever debit a multiple — and the bet display should show a single
  plain figure with no multiplier line. If a multiplied amount appears, a cost
  has drifted away from 1.0 in `FAMILY_RULES` or `MODE_FAMILIES`.

- [x] **BET-09 · Second Chance forgives exactly once, never on card 1** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): `sc_red_higher_outside_heart` #0: card 1 wrong ends the round, pays 0, cards 2-4 stay down; #6: card 2 missed carries the forgiven mark and the reveal continues to 4.0x; #11: forgiven at card 2, second miss at card 4 busts with the cross, 0.4x.
  Play Second Chance until a round misses card 1, then until one misses a later
  card, then until one misses twice.
  **Expect:** card 1 wrong ends the round and pays nothing, exactly like
  Classic. A later miss shows the amber return mark, and the reveal
  **continues**. A second miss ends the round with the usual bust cross.

- [x] **BET-10 · Mode is locked during an autoplay run** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): during an autoplay run MODE is blocked: a press opens nothing and shows "Mode is locked while autoplay runs".
  Start autoplay, then try to change mode.
  **Expect:** the mode control is disabled for the duration. The run was
  started on one mode's odds and cost.

- [x] **BET-05 · A rejected bet recovers** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD, SIMULATED request): an off-ladder amount (the request rewritten to 1,234,567 micro) gets the real RGS answer `400 {"error":"ERR_VAL","message":"invalid amount"}`; the dialog reads "That bet was rejected. Please adjust the amount and try again." on top, with Close; the balance is untouched and the next deal plays. The raw JSON detail printed under the sentence - removed locally for every recognised code.
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD, SIMULATED request): re-run - "That bet was rejected. Please adjust the amount and try again." and `ERR_VAL`, no English line under it, Close only; Close clears it, the balance is untouched and the next deal plays (200).
  Provoke an `ERR_VAL` (an out-of-range amount is easiest).
  **Expect:** "That bet was rejected. Please adjust the amount and try again."
  Dismissing leaves the game playable and the stake not deducted.

- [x] **BET-11 · An active round restores its bet amount** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): reloaded mid-round at a $0.05 bet: the bet display read $0.05, from round.amount 50,000 (default is $1.00).
  Spin, kill the tab mid-round, relaunch, and read the bet display before doing
  anything else.
  **Expect:** the amount the interrupted round was actually staked at, taken
  from `round.amount` in the authenticate response - not the default level, and
  not the last amount this browser happened to have. Verbatim RGS requirement
  ("Active rounds restore the bet amount from the authenticate response"), and
  distinct from `SES-04`, which is about the round rather than the stake.

- [x] **BET-12 · Changing mode asks first** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): confirmation restates blurb, ceiling, this pick's ceiling, cost and 96.00%; X, Escape and click-away close with Classic still live; Cancel returns to the list; only Switch changes the mode, and sends no /wallet/play.
  Open MODE and pick a family other than the live one.
  **Expect:** a confirmation restating that mode's blurb, ceiling, cost and
  volatility - the bet mode does not change until Switch is pressed, and every
  close path (Cancel, the X, clicking away, pressing Escape) discards the pick
  and leaves the live mode alone. Verbatim ("High cost bet modes require
  confirmation before activation").

- [x] **BET-13 · Autoplay cannot start from one click** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): opening autoplay sends nothing; the panel needs a count and Start. Space held 6 s played 2 rounds, released played none.
  Press the autoplay button, then Start.
  **Expect:** two deliberate actions - the panel opens, a round count is chosen,
  and only Start begins the run. Verbatim ("Auto-bet requires a confirmation
  step before starting"; "games may not automatically place consecutive bets
  with one click"). **Also check the spacebar-hold path**, which does not go
  through the panel: holding Space runs rounds only while the key is physically
  held and stops the moment it is released or focus is lost.

- [x] **BET-14 · A 250× mode keeps the base bet the RGS allows** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): on a $300,000 USD session, the $250,000 chip (base $1,000 = maxBet) sent amount 1,000,000,000 with tr_any_equal_equal; accepted; balance fell by exactly 250 x base. The cap is on the BASE amount. Note: this demo template allows a $250,000 round cost, over the 2-star $100,000 maximum bet cost - the bet-level template Stake applies must keep trips under it. On trips the bet menu lists chips by round COST ($2.50 to $250,000).
  Switch to **Three of a Kind**, set the base bet to the session's `maxBet`, and
  play one round.
  **Expect:** `/wallet/play` is sent with `amount = maxBet` and `mode =
  tr_any_equal_equal`, the RGS accepts it, and the balance moves by 250 × the
  base bet. The docs in this repo and the template's own 100× / 200× bonus buys
  say the limits are on the BASE amount and the cost is applied on top; this has
  never been observed live. If the RGS rejects it, the mode's bet ladder needs
  its own cap (`maxBet / cost`) and this plan needs a check for that instead.

- [x] **BET-15 · The 250× mode's caps match the tier** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, Studio > Math, version 13): STATISTICS VALIDATION: Valid. 2 Star (template 300max_1cent): max exposure 1,374,990 / 15,000,000; max payout 4,583x / 50,000; max bet cost 75,000 / 100,000 ($300 base x 250); cost multiplier 250 / 1,000; std 38.40 / 50; every tail probability 0; CVaR per-stake 639.0 / 700; CVaR absolute 4,583.3 / 20,000; ETL(40x) 0.769 / 0.800; ETL(10,000x) 0; ETL sum 0.769 / 1.300; ETL absolute 1 / 3,000. 3 Star passes every row too.
  Read the Developer page's risk summary for the uploaded build.
  **Expect:** max bet cost for `tr_any_equal_equal` sits under the tier's
  $100,000 (the 2-star template is `300max_1cent`: a $300 base × 250 = $75,000) and max exposure under $5,000,000 (4,583.3 × the
  base bet); no tail row (P ≥ 5,000× / 10,000× / 25,000×, CVaR absolute, ETL
  above 10,000×) is flagged. The first build of this mode - 1000× paying 25,000×
  - failed every one of them, which is why the mode is the size it is.


- [x] **BET-16 · The family and picks come back after a reload** — *Major*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, XSC social): PASS. High Risk with Black / Lower / Inside / Spade and the bet raised to 1.20: a reload brought back the family and all four picks and NOT the amount (1.00 SC). Then a paying round was dealt, the stored picks overwritten with Classic Red / Higher / Outside / Heart and the frame reloaded mid-reveal: the resumed round came back on its own family and picks, end-round 200, "Kept, Card 3: Ace of Spades, 0.30 SC, 0.3x". Replays on v72 showed their own round's family and picks whatever was remembered (WIN-16, RND-11 below).
  Pick High Stakes with Black / Lower / Inside / Spade, reload the frame; then open
  a replay; then reload mid-round.
  **Expect:** the reload restores the family and all four picks; the replay shows
  its own round's family and picks, untouched by them; a resumed round wins over
  them. Never the bet amount. A private window, or storage that throws, simply
  starts on Classic with nothing picked.

- [x] **BET-17 · A typed bet under the minimum is explained, not zeroed** — *Major*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD): PASS. This template's minimum is $0.01 (levels $0.01 ... $1,000.00). Typed 0.004: the bet display reads "Bet $0.004", a deal flashes "Bet is below the minimum of $0.01" and sends no `/wallet/play`, the balance is untouched and the field still holds 0.004. Social mode: "Play amount is below the minimum of 0.01 SC".
  Type an amount below the minimum (e.g. 0.004) into the bet field.
  **Expect:** the figure stays as typed and the deal is blocked with "Bet is below
  the minimum of $0.01" (the session's own minimum; $0.01 on the Studio USD
  template) - it is never snapped to 0 or to a level the player did not type
  (F-1).

---

## 03 · Round settlement

The highest-risk area, and the one that cannot be exercised locally at all.

A winning round needs a second call - `/wallet/end-round` - to credit the payout
and close the round. Losing rounds auto-close on the RGS and must **not** send
one.

- [x] **RND-01 · A win settles and credits** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): every paying round: one /wallet/play, one /wallet/end-round, both 200; credit = payoutMultiplier x amount to the micro-unit (e.g. 4.1 x 10,000 = 41,000).
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD): smoke re-run - the 0.5x win credited exactly by end-round; an 8.4x Second Chance sweep settled through its takeover ($993.80 to $1,001.20).
  Play until a round pays, watching the Network tab throughout.
  **Expect:** exactly one `/wallet/play`, then exactly one `/wallet/end-round`,
  both 200. Balance afterwards equals *before - stake + payout*.

- [x] **RND-02 · A losing round sends no end-round** — *Major*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): 217 of 500 rounds paid nothing and none sent end-round.
  Bust on card 1, so the round pays nothing.
  **Expect:** one `/wallet/play` and **no** `end-round`. No 400 anywhere.
  Zero-payout rounds close themselves; calling end-round anyway returned 400
  before every single spin, which is the noise that hid a real failure.

- [x] **RND-03 · Balance does not drift down over a long run** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): 500 rounds at $0.01: RGS 1,026,414,000 vs board $1,026.41 - no drift, no warning lines.
  Note the starting balance, run 100+ rounds, compare against the operator's
  figure.
  **Expect:** they agree, and no `end-round returned no usable balance` in the
  console. This is the nastiest failure mode in the game: play debits the stake,
  and if the credit never lands the tracked balance only ever falls - eventually
  dropping below the bet, so autoplay stops for "insufficient funds" while the
  real balance is fine.

- [x] **RND-04 · Partial wins pay the right fraction** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD + replay): replays bust at card 2 / 3 / 4 for 0.5x / 0.6x / 0.7x, exactly the book's finalWin; card 1 wrong pays 0. Live: 26 rounds, every credited balance equal to the screen to the micro-unit (check.js).
  Bust deliberately at each stage: card 1 wrong pays nothing; a later miss keeps
  30% of the running total (15% on High Stakes) times the decay for the cards
  not played, floored to 0.1x - 0.5x on a card-2 miss from 1.99x.
  **Expect:** the screen matches the book's `finalWin` event, and the credited
  balance matches the screen.

- [x] **RND-05 · Kill the connection mid-round** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): went offline right after an active play response: the reveal finished as Banked 0.6x with no error shown; back online, a frame reload returned the open round in authenticate, the game sent the missing end-round (200, exact credit) and the next round played. No ERR_VAL lock.
  Spin, go offline in devtools before the reveal finishes, then come back online
  and reload.
  **Expect:** the game recovers. If a round was left open the next spin settles
  it first and proceeds - no permanent `ERR_VAL` lock needing a manual refresh.

- [x] **RND-06 · The win amount climbs to its final figure** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD, Normal turbo): sampled every 80 ms: each card's chip lands after it turns and the readout follows it ($1.90 after card 1, then $0.50 after the card-2 miss); never jumps to the total, never shows a figure the round did not pay.
  Watch a four-card round settle at normal turbo.
  **Expect:** the running win and the four multiplier chips build stage by stage
  and land on exactly the settled payout - never jumping straight to the total,
  and never showing a figure the round did not pay. Verbatim ("If an outcome
  contains multiple winning actions, the payout must incrementally update to the
  final multiplier"). In this game the stages ARE those actions.

- [x] **RND-07 · A Three of a Kind round settles on three cards** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): 6 busts (no end-round, 250 x $0.01 debited each) then A-A-A: 4,583.3x credited exactly ($45.833); always 3 cards; chips 916.6x / 4,583.3x, card 1 shows none.
  Switch to Three of a Kind and play until one round busts and one pays.
  **Expect:** exactly three cards turn, never a fourth. The bust (card 2 or 3
  not matching card 1) sends one `/wallet/play` and **no** `end-round`, and the
  balance moves by 250 x the base bet. The win sends `end-round` and credits
  4583.3 x the base bet - the chips read 916.60x then 4583.30x, the dealt first
  card carries no chip, and Last Win reads 4583.30x. The client rejects a book
  with the wrong number of reveal events ("Round did not contain all 3 reveal
  stages"), so a settled round that shows an error here means the live math
  version predates the three-card build.


- [x] **RND-10 · Recent rounds** — *Minor*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD): PASS. Five rounds across Classic, Second Chance and Three of a Kind: newest first; family names in their colours; "Bet $250.00 ($1.00 x 250)" on Three of a Kind; bust and forgiven marks on the cards; "$8.40 8.4x" in win green and the partial returns ($0.50, $0.30) in neutral ink; the picks under each (none on Three of a Kind). Escape closes it and focus is back on Last Win. In every v72 replay Last Win is a plain readout.
  Play five rounds across two families, then press Last Win.
  **Expect:** a panel lists them newest first: the family in its colour, what the
  round cost (Three of a Kind as "$250.00 ($1.00 x 250)"), the cards with a bust
  or forgiven mark and Last Stop's ticket, the payout with its multiplier (a
  partial return in neutral ink) and the four picks. Escape closes it and focus
  returns to Last Win. In a replay Last Win is a plain readout, not a button.

- [x] **RND-11 · The result words and colours** — *Major*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, replay, USD) + live): PASS. Full game win (#2484, live 8.4x); Won (sc #6: card 2 forgiven, its chip neutral 0.9x); Kept (#17 bust card 3, sc #11, live 0.5x / 0.3x) with the missed chip in neutral ink and no percentage; Busted (sc #0 card 1, trips #0, live) with no chip. Three of a Kind's live total read "At stake" in neutral ink until it paid; social mode read the same words.
  Play until you see each ending.
  **Expect:** "Full game win" for four right; "Won" for a Second Chance ride that
  reached the end with a miss forgiven; "Kept" for a bust after card 1 that kept a
  share (no percentage printed); "Busted" for nothing kept. The chip over a missed
  card is neutral ink, never win green; a bust that kept nothing (card 1, or any
  Three of a Kind miss) shows no chip; Three of a Kind's live total reads "At
  stake" (social: "In play") in neutral ink until the round has paid it.

---

- [x] **RND-08 · A Last Stop sweep settles with its ticket** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): ls_red_higher_outside_heart swept 10h Js 3s 5h with a x10 ticket: book 71.1x = full-precision run 7.1153 x 10 floored (not 7.1 x 10); card 4 reveal payout 1, one ticket event; end-round credit exact; chips 1.9 / 6.5 / 7.1 / 71.1x.
  On a Last Stop mode (`ls_`, an easy pick such as Red / Higher / Outside /
  Heart), play until all four land and the ticket turns.
  **Expect:** the credited payout equals the book's `payoutMultiplier` - the
  full-precision run to card 3 times the ticket, floored once to 0.1×, which
  is NOT card 3's chip times the ticket (the chip is already floored: event
  1136 of `ls_red_higher_inside_heart` reads 7.2× on card 3 and pays 72.6×,
  not 72.0×) - and it is the figure card 4's chip and the readout land on when
  the ticket turns, with one `/wallet/end-round`. The book's card-4 reveal says
  `payout: 1.0`, and it carries one `ticket` event, between the reveals and
  `finalWin`.

- [x] **RND-09 · A Last Stop miss keeps Classic's share, and no ticket** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): #1801 busts on card 4 at 13.6x on `red_higher_inside_heart` AND on `ls_red_higher_inside_heart` - same chip; the Last Stop book has no `ticket` event; the ticket stays face down and dims (is-dead).
  Miss card 2, 3 or 4 on Last Stop. A live session cannot deal the same cards
  twice, so compare by replay: the two families share the deal, and a bust ID
  is the same round on both (e.g. 1801 is 13.60x on `red_higher_inside_heart`
  and on `ls_red_higher_inside_heart` - REPLAY_EVENTS.md).
  **Expect:** the bust card's chip is the same figure Classic shows for the
  same miss (about 30%), and the book has **no** `ticket` event. The ticket
  stays face down and dims with the dead cards.

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

- [x] **END-01 · 500 rounds, turbo at Instant, unattended** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): 500 rounds, Classic $0.01, turbo 1 (Instant), skip on: ran the full count in 504 s and stopped on the counter. No non-200, no unhandled rejection.
  Set turbo to maximum, autoplay to 500 (or unlimited), and leave it.
  **Expect:** it runs the full count and stops because the counter reached zero,
  not because of an error. No 429s, no unhandled rejections.

- [x] **END-02 · Confirm request spacing on the wire** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD, Normal turbo): closest two RGS calls 401 ms apart; `/wallet/play` gaps 3.2-3.9 s; evenly spaced.
  During the run, sort the Network tab by time and read the gaps between
  consecutive RGS calls.
  **Expect:** no two calls closer than ~400 ms, no two `/wallet/play` closer
  than ~900 ms, and traffic that looks evenly spaced rather than arriving in
  pairs. The earlier failure was bursty rather than fast on average - play and
  end-round landed ~200 ms apart, then the line went quiet - and a fixed-window
  limiter measures the burst.

- [x] **END-03 · If a 429 appears, the run survives it** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): no 429 in 500 rounds at ~1 round/s - the ideal outcome; the retry path itself is untested live.
  Search the console for `rate limited by the RGS`.
  **Expect:** ideally absent. If present, autoplay must **continue** - the line
  reports the retry and the widened spacing, and the run carries on. A 429 that
  stops the run is a blocker. Note the printed spacing figures: if they climb to
  the 2000/4000 ms ceilings, the floors are too low for this session's limit and
  need raising in `rgsPacingMath.ts`.

- [x] **END-04 · Stop is honoured without losing the round in flight** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): Stop pressed during "Revealing...": the round finished and stayed on the board, autoplay ended, and the only request after it was a balance poll - no new `/wallet/play`.
  Start a long run, then press the red stop square mid-reveal.
  **Expect:** the round already in play finishes and settles normally, no new
  round starts, and the final result stays on the board.

- [x] **END-05 · Stop on full-game win fires on the right round** — *Minor*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): fired on Three of a Kind (stopped at the 7th round, the win) and on Last Stop (stopped at the sweep).
  Enable stop-on-full-win and run until all four cards land.
  **Expect:** the run ends on that round; a partial win, however large, does not
  stop it.

- [x] **END-07 · The loss limit stops at the figure, in base bets** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): 5x on Classic at $1: stopped on round 6, the first at -$5.50 (round 5 stood at -$4.50). 5x on Three of a Kind at $0.01 base: stopped after its first loss (250 base bets). $20 in USD: stopped on round 44, the first at -$20.10 (round 43 at -$19.10).
  In the autoplay panel type 5 into "Stop on a loss of", leave the unit on x,
  press the button beside it so it stays lit, and run unlimited on a Classic
  mode. Then repeat on Three of a Kind, and once with the unit on the currency
  (type an amount, e.g. 20).
  **Expect:** the run ends on the round that leaves it 5 base bets down, net of
  what it won - not before, not a round later. On Three of a Kind one losing
  round is 250 base bets, so a 5x limit ends the run after its first loss -
  "5x your bet" means the same bet there as "costs 250x your bet" does in the
  mode picker. With the currency unit it ends on the round that leaves the
  run that much money down. The stake never changes during the run, and the
  panel can be opened mid-run to change a limit (its count is locked; its
  button is Stop). In social mode the unit reads SC/GC, never $.

- [x] **END-08 · The single-win limit stops on one big round, not a good run** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): 5x on Classic: stopped on the first round paying 5x or more (7.2x) while the run was still $4.30 down - a single round, not a running total. 100x on Three of a Kind ($0.01 base): stopped on its first win, round 44, 4,583.3x.
  Type 5 into "Stop on a single win of" (x), arm it, and run unlimited; then
  100x on Three of a Kind.
  **Expect:** the run ends on the first round that alone pays 5 base bets or
  more; a run that is up 5 bets over many small wins does not stop. On Three of
  a Kind a 100x limit stops on its first win (4,583.3x).

- [x] **END-06 · Autoplay runs the balance down gracefully** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD $3.00 balance): unlimited at $1: four deals, all 200, then stopped at $0.90 with "Insufficient funds"; the RGS's own balance read 900,000 micro, matching the board. No error dialog.
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

- [x] **JUR-01 · Every flag in the table behaves** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): SIMULATED - authenticate's jurisdiction block rewritten in the browser only (the uploaded build reads it): disabledAutoplay removes the autoplay control; disabledSuperTurbo caps the turbo slider at 0.8; disabledTurbo removes Turbo; disabledSpacebar - a Space tap plays nothing; disabledSlamstop - the spin never becomes Skip; displayRTP / NetPosition / SessionTimer show the RG plate (NET POSITION, RTP 96.00%, SESSION). No page errors.
  **Expect:** each row's effect is visible, and turning the flag off restores
  the feature.

- [x] **JUR-02 · A missing jurisdiction block does not break the game** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): SIMULATED - the jurisdiction block deleted from authenticate: everything permitted (Turbo to 1, autoplay, Space, Skip), no page errors, rounds play.
  Play a session on an account whose authenticate response carries no
  jurisdiction block.
  **Expect:** the game plays with everything permitted - no crash, no blank
  screen, no feature stuck off. The SDK assigns the block unconditionally, so an
  absent one replaces the defaults with `undefined`, and every read has to
  survive that.

- [x] **JUR-03 · Minimum round duration is enforced, and slam cannot beat it** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): SIMULATED - minimumRoundDuration 2500 with turbo at Instant, Skip pressed and Deal/Space hammered: next play 2.56 s after the last; tooltip "Rounds must be 2.5 seconds apart".
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

- [x] **CUR-01 · Zero-decimal currency renders whole** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, JPY): balance JPY 100,000, chips JPY 1 - JPY 7,500, bet, readout and Last Win with no decimal point over 20 rounds (JPY 220 at 2.2x). The takeover is REP-04's.
  Launch on JPY or KRW.
  **Expect:** no decimal point anywhere - balance, bet, payout, win takeover,
  Last Win.

- [x] **CUR-02 · Sub-cent payouts are not shown as zero** — *Major*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): as written: a 0.2x win on $0.01 reads $0.002, 0.4x reads $0.004. BUT amounts above a cent round to 2 places - 58% of paying rounds at $0.01 show a figure that differs from the credit, mostly UP (0.5x pays $0.005, shows $0.01). Finding F-2.
  Set the smallest possible bet and win a small multiplier, so the payout falls
  below one cent.
  **Expect:** extra decimal places appear so the amount is visible, never a flat
  `0.00` for a round that paid. The RGS carries six decimal places; a win of
  0.004 rendered at two places reads as a game that took the stake and paid
  nothing.

- [x] **CUR-03 · Social currencies use the right suffix** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): social session (currency XSC): "Balance 1000.00 SC", "Play 1.00 SC" - suffix, no $. Minor: SC amounts are not digit-grouped ("4583.30 SC" beside "4,583.3x").
  Launch on the social account.
  **Expect:** amounts carry the GC / SC suffix in Stake's format, and no wording
  anywhere implies real money.

- [x] **CUR-04 · Large amounts stay inside their boxes** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, IDR, balance 2,000,000,000): fits its box at all seven sizes with no horizontal scroll (fitted to 5 px at Popout S, as designed); 43 chips up to IDR 10,000,000, none overflowing; the takeover reads IDR 45,833,000 (REP-04).
  Use a high-balance account in a high-denomination currency (IDR or VND run to
  millions of units).
  **Expect:** correct thousands separators, and nothing overflowing or
  truncating on the control bar or the win takeover.

- [x] **CUR-05 · The lowest and highest bet levels are both selectable** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): USD, 42 levels: $0.01 and $1,000.00 both selected and PLAYED ($1,000 accepted, 0.5x credited $500.00 exactly); the bet panel scrolls inside itself, the frame never does.
  On a currency with many levels (NOK ships around forty), open the bet menu and
  reach both ends.
  **Expect:** every chip is inside the panel, the panel scrolls internally if it
  must, the main frame never scrolls horizontally, and both extremes can be
  selected and played. Verbatim RGS requirement ("Min and max levels must be
  selectable"; "Main game frame should not be scrollable"). Verified at 40
  levels on Desktop, Popout L and Popout S in a browser - this is the same check
  against real RGS levels.


- [x] **CUR-06 · Sub-cent amounts are exact everywhere** — *Major*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD) + replay): PASS. Live at $0.01: readout, Last Win, balance ($751.185, $751.187 ...) and the history panel all exact ($0.005, $0.012, $0.006). Replays at amount=10000: $0.682, $0.082, $0.006, $13.542, the takeover counting in three places ($0.200 ... $0.682). The bet keeps two places ($0.01).
  Bet the minimum ($0.01) and play until a few rounds pay; replay one with
  `amount=10000`.
  **Expect:** every money figure shows the exact amount - $0.017, $0.011, never
  rounded to $0.02 / $0.01: the readout, Last Win, the history panel and the
  takeover, which counts in the final amount's own decimal places rather than
  flickering through extra ones. Whole-cent amounts still show two places.

---

## 07 · Win presentation

Tiers are keyed on payout size, not on surviving all four cards - except that
a full-game win is floored into the bottom tier, because the smallest possible
one pays 6.6x and would otherwise pass in silence.

**Every band is per mode.** A tier is a claim about how RARE something is, and
the guess families spread their payouts differently, so one shared set of
thresholds made the same word mean different things. Each ladder is solved to
land on the same rarities - Classic's originals - with Max Win being exactly
that mode's ceiling. Three of a Kind has one rung: its only win IS its ceiling,
so it is called Max Win, at 1 in 19 - the label says what the win is, not how
rare it is.

| Tier | Classic | Second Chance | High Stakes | Three of a Kind | Roughly |
| --- | ---: | ---: | ---: | ---: | ---: |
| Big Win | 10x | 11x | 12x | — | 1 in 70 |
| Huge Win | 40x | 28x | 55x | — | 1 in 300 |
| Mega Win | 120x | 60x | 145x | — | 1 in 3,100 |
| Epic Win | 300x | 130x | 500x | — | 1 in 15,800 |
| Max Win | 1354.2x | 585.2x | 2237.3x | 4583.3x (1 in 19) | 1 in 36,400 |

(High Stakes' bands survived its move to 15% unchanged: re-measured against the
0.15 build's lookup tables, 12 / 55 / 145 / 500 are still the round thresholds
closest to the target rarities. What moved is how often they land - 1 in 68 /
295 / 2,818 / 15,444 - and the ceiling.)

At the old shared thresholds, "Epic" was 1 in 16,198 on Classic but 1 in 26,768
on Second Chance - nearly as rare as that mode's Max Win, squashing the top of
its ladder into one step - and 1 in 12,238 on High Stakes, which pays a busted
round less and so climbs higher.

**The full-game-win floor is off for Second Chance.** Forgiveness means most of
its rounds reach card 4, so treating that as remarkable made the takeover fire
on nearly every round. It still celebrates on size.

- [x] **WIN-01 · The headline never contradicts the number** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay + USD): about 20 takeovers across every family: each title in its family's band (e.g. 13.6x Big, 68.2x Huge, 29x Huge on Second Chance, 30x Big on High Stakes, Max only on each ceiling).
  Over a long run, check each takeover's title against its final multiplier.
  **Expect:** the word always matches the band above. Watch particularly for a
  max win reading "Epic Win" - the payout arrives as a division of two rounded
  numbers and can land at 1354.1999...

- [x] **WIN-02 · A small full-game win still celebrates (Classic, High Stakes)** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): Classic #159 sweeps 8.2x and High Stakes #159 sweeps 9.8x: both take the screen, titled Big Win.
  On Classic, and again on High Stakes, land all four guesses on a round paying
  under 10x.
  **Expect:** the takeover appears, titled Big Win. Landing all four is the
  point of the game in these modes and must never pass unmarked.

- [x] **WIN-07 · Second Chance does NOT celebrate every completed round** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): the FORGIVEN finish under 10x (#6, 4.0x) gets no takeover. A clean Second Chance sweep under 10x (#7, 8.3x) does celebrate, by design: the full-game floor applies to a CLEAN sweep on every family (`celebrateEveryFullWin` + `isCleanSweep`, modes.ts) - the expectation above predates that and is corrected.
  On Second Chance, play until a round lands all four cards for under 10x -
  including one where the first wrong guess was forgiven and play carried on.
  **Expect:** a FORGIVEN finish under 10x gets no takeover, just the ordinary win -
  forgiveness makes finishing the round the common case. A CLEAN sweep under 10x
  does celebrate, as on every family: the floor is for getting all four right.

- [x] **WIN-08 · Second Chance still celebrates on size** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): #378, forgiven at card 2, pays 13.6x and takes the screen as Big Win.
  On Second Chance, reach a round paying 10x or more.
  **Expect:** the takeover appears at the usual thresholds (10x / 40x / 120x /
  300x). Suppressing the floor must not have suppressed the ladder - this is the
  half of WIN-07 that is easy to break.

- [x] **WIN-09 · Max Win is announced on each mode's own ceiling** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): Max Win on Classic 1,354.2x, Second Chance 585.2x, High Stakes 2,237.3x, Last Stop 4,301.9x (ticket on the fan) and Three of a Kind 4,583.3x (three cards fanned). High Stakes' 467.1x cap round, short of its ceiling, stops at Mega Win. FOUND: the count opened on a NEGATIVE frame ("-$0.00001", "-0,00 $") - the first rAF timestamp precedes the leg's start; FIXED LOCALLY by clamping the progress.
  Use a max-win replay ID for each family (see REPLAY_EVENTS.md).
  **Expect:** "Max Win" on 1354.2x in Classic, on 585.2x in Second Chance, on
  2237.3x in High Stakes and on 4583.3x in Three of a Kind, where the takeover
  fans THREE cards. Two specific failures to watch for: a High Stakes win of
  1354.2x - which is NOT its maximum - announcing "Max Win", and a Second
  Chance ceiling of 585.2x announcing only "Epic Win".

- [x] **WIN-10 · The lower bands differ per mode too** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): 29.0x on Second Chance reads Huge Win (its band opens at 28x); 30.0x on High Stakes reads Big Win (its Huge band opens at 55x, not the 50x written above).
  Win about 30x on Second Chance, then about 30x on High Stakes.
  **Expect:** "Huge Win" on Second Chance (its band opens at 28x) and only "Big
  Win" on High Stakes (whose Huge band opens at 55x). Same payout, different
  titles - that is correct, because it is a far rarer result in one than the
  other. If both read the same, the ladders have been collapsed back into one.

- [x] **WIN-03 · Count-up, skip and dismiss** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): 1,354.2x climbs Big -> Huge -> Mega -> Epic -> Max with about 1 s on each ceiling; a tap mid-Big jumped to the Huge floor ($40.15) and climbed on; the title never left the screen. Locally the count now starts from the board's figure, not zero (the critique).
  On a multi-tier win: let it climb, tap mid-climb, then tap again once settled.
  **Expect:** starts at zero, climbs, pauses ~1 s at each ceiling with the title
  escalating; a tap jumps to the next tier's floor; once settled a tap
  dismisses. The title never disappears and re-enters between tiers.

- [x] **WIN-04 · Turbo does not touch the win animation** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD, Three of a Kind): the same 4,583.3x count took 3,020 ms at Normal and 2,999 ms at Instant, while the reveal before it fell from 4.5 s to 0.8 s.
  Trigger comparable wins at Normal and at Instant.
  **Expect:** the count-up runs at the same speed both times. Turbo governs the
  card reveal only.

- [x] **WIN-05 · Autoplay skip setting behaves both ways** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD, Three of a Kind): skip on: the takeover opened on the final $45.83, held 3.6 s, closed itself and the run dealt on. Skip off: the full count-up played and the takeover waited on "Tap to continue"; after the tap the run resumed (7 deals in 6 s).
  Run autoplay with "skip win animations" on, then off.
  **Expect:** on - the final amount appears immediately and holds briefly
  (longer for rarer tiers) before the run continues; off - the full count-up
  plays. Either way the run continues afterwards.

- [x] **WIN-06 · The takeover is keyboard-dismissable** — *Minor*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): Space dismisses the takeover (second press) without dealing.
  With a takeover on screen, press Enter or Space.
  **Expect:** it skips, then dismisses, exactly as tapping does - and Space does
  not scroll the page behind it.

- [x] **WIN-11 · The rules state this bet's own ceiling** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): How to Play on Red/Higher/Outside/Heart: "Max win 1,354.2x your bet" plus "Your four guesses top out at 68.2x your bet" (= REPLAY_EVENTS win cap). BUT on Red/Equal/Equal/Heart the second line is NOT suppressed ("top out at 1,354.2x" under "Max win 1,354.2x") - finding F-7.
  Open How to Play on a low-ceiling combination (`red_higher_outside_heart`,
  68.2x) and on one that reaches its family's figure (`red_equal_equal_heart`,
  1354.2x).
  **Expect:** the family ceiling as the headline in both, plus a second line
  naming what the four guesses on the board top out at - and that second line
  absent on the combination where the two are the same number. The figure must
  match that mode's Win cap column in `REPLAY_EVENTS.md`. Stake requires the
  maximum win to be stated per bet mode and to be obtainable, and every
  combination here is its own published bet mode: only 8 of each family's 64
  reach the family figure.

- [x] **WIN-12 · Max Win is announced only on the family ceiling** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): `red_higher_outside_heart` #2484 (68.2x, its cap) reads Huge Win; `red_equal_equal_heart` #975 (1,354.2x) reads Max Win.
  Play the cap round of a combination that falls short (`red_higher_outside_heart`,
  68.2x) and the cap round of one that does not (`red_equal_equal_heart`).
  **Expect:** only the second announces MAX WIN. A mode reaching its own ceiling
  is not a max win - the claim is about a single reachable figure per family
  (1354.2 / 585.2 / 2237.3 / 4583.3), and softening it to "the best this bet can do"
  would make the rarest screen in the game routine.

- [x] **WIN-13 · Turbo and skip keep the figures legible** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): 15 rounds slammed early: every settled readout and chip fully opaque and readable; at Instant the settled board and the takeover text read normally (END-07/08, WIN-04).
  Play at Instant turbo, and again using the skip button mid-reveal.
  **Expect:** the settled amount, the per-card multipliers and any takeover text
  are all readable at the end. Verbatim ("Any 'fastplay' option must keep win
  amounts, winning combinations and pop-up information legible").


- [ ] **WIN-16 · The count-up starts where the board stopped** — *Minor*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, replay, USD)): FAIL for big wins. #2484 opens on "Big Win $20.00" over a $20.00 board and climbs, and no figure is ever negative - but the max win #975 (board $430.10 after card 3) opened on "Big Win $40.00" and climbed back up through Huge and Mega: the first fix held each band the board had already passed at its own ceiling. FIXED LOCALLY: those legs are dropped, so #975 opens on "Epic Win $430.10" and a High Stakes 467.1x on "Huge Win $119.00" (`winTiers.test.ts`). Prompts: "Click to skip" / "Click to continue" with a mouse. Re-run on the next upload.
  Replay `red_higher_outside_heart` #2484 (68.2x; the board shows $20.00 after
  card 3) and any max win.
  **Expect:** the takeover opens on "Big Win $20.00" and climbs, never on $0.00 and
  never on a negative figure (it opened on "-$0.00001" on front v71); the max win
  #975 (board $430.10) opens on "Epic Win $430.10", never on a lower tier's
  ceiling (it opened on "Big Win $40.00" on front v72). The prompt
  reads "Click to continue" with a mouse and "Tap to continue" on a phone.

---

- [x] **WIN-14 · The ticket counts up and joins the fan** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): `ls_red_higher_outside_heart` #162 (x10, 28x) and `ls_red_higher_inside_heart` #64 (x2, 4.5x - the minimum) both celebrate; the ticket joins the fan and its label reads "Ticket x10" / "Ticket x2".
  Land any Last Stop sweep - every one celebrates, down to the 4.5× minimum,
  through the full-game-win floor.
  **Expect:** card 4 turns with no chip, the ticket turns after one uniform
  pause - the same length whatever it shows - and card 4's chip and the readout
  land together on the ticketed figure. The takeover fans the four cards as on
  every family and lays the ticket over the middle of them, lower - and on a
  win that climbs a tier, the ticket hops with the hand.

- [x] **WIN-15 · No correct pick ever reads under 1×** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): the same deal #64: Classic chips 1.9 / 2.0 / 2.2 / 6.6x, Last Stop 1.9 / 2.0 / 2.2 / 4.5x (x2) - cards 1-3 identical, nothing under the chip before it.
  On Last Stop, pick near-certain guesses (Higher on an Ace, Outside on a pair)
  and watch the chips, then play the same picks on Classic.
  **Expect:** every chip after a right guess is at least the one before it,
  and cards 1-3 read exactly what they read on Classic. The owner's rule;
  `ticket.test.ts` and `test_model.py` pin both.

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

- [x] **REP-01 · A replay renders the original round** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): Studio-format replay URLs (game UUID 019f7e00-fa38-78fa-9ea7-b4933e75765b, version 13): Classic #82 (1.1x), #2484 (68.2x), trips #2 (4583.3x), ls #9426 (200.3x, x10 ticket), sc #128 (19.1x forgiven) - board chips and payout match the /bet/replay book every time.
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, replay, USD)): re-run - twelve replays across the five families render their own round, family and picks, and no replay calls `/wallet/*`.
  Take a round ID from a real session and open it in replay.
  **Expect:** the same four cards, the same guesses lit, the same stage
  multipliers and the same final payout.

- [x] **REP-02 · Replay bet amount matches the original round** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): RESOLVED. The Studio's own Replay panel builds amount=10000 for $0.01 - micro-units, which is what the game assumes; the details panel reads Play amount $0.01 / $1.00 exactly as sent. The 1000x gap seen earlier was not this path.
  **KNOWN OPEN, DELIBERATELY DEFERRED for this submission.** A Stake replay
  showed bet amount 1000 where the game rendered 1 - an exact 1000x gap
  pointing at a units convention. Recorded here as a decision rather than an
  untested box; capture is one console line (see the note in CLAUDE.md).
  Compare the stake shown in replay against the stake actually placed.
  **Expect:** identical. If they differ by exactly 1000x or 100x, record both
  figures and the raw `amount` from the response.

- [x] **REP-03 · Replay places no bets** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): zero /wallet calls across six replays and a Play Again; Increase/Decrease bet, Autoplay and Mode all disabled.
  In replay, press every control you can - spin, autoplay, the bet stepper.
  **Expect:** no `/wallet/play` and no `end-round` in the Network tab, the
  balance never moves, and spin re-runs the same round only.

- [x] **REP-05 · The replay details name the mode and its guesses** — *Major*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): sc #128 details: "Game mode Second Chance / Guesses Red Higher Equal Spade" - no raw slug.
  Open a replay for a `sc_` mode and one for an `hs_` mode, e.g.
  `sc_red_higher_equal_spade`.
  **Expect:** a "Game mode" row reading Classic, Second Chance or High Stakes,
  and a "Guesses" row of four labelled badges. **Fail if the raw mode slug is
  printed** - the parser used to split on `_` and require four parts, which every
  prefixed mode fails, so those rounds showed their identifier instead of their
  picks.

- [x] **REP-04 · Currency in the replay URL is honoured** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): JPY: #975 counts to JPY 135,420 with no decimals (except the negative opening frame, fixed locally); IDR: Three of a Kind #2 reads IDR 45,833,000 and its round cost IDR 2,500,000 (x250).
  Open a replay with an explicit `?currency=`, including a zero-decimal one.
  **Expect:** amounts formatted for that currency, with the right number of
  decimal places.

- [x] **REP-06 · A finished replay offers Play Again** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): Play Again appears with the result kept on screen; it stays disabled while a takeover is up and enables the moment it closes; it re-runs the round with no /wallet call.
  Let a replay run to the end.
  **Expect:** the primary button reads **Play Again**, is enabled, and re-runs
  the same round from the start; the win amount and outcome stay on screen.
  Verbatim ("After: show a 'Play Again' button and keep the win amount and
  outcome visible"). Checked in a browser at Desktop, Popout S and Mobile M -
  this is the same check on the uploaded build.

- [x] **REP-07 · Replay works in Popout S** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): #82 at 400 x 225: Play Again reachable and enabled, no frame scroll.
  Open a replay URL at 400 x 225.
  **Expect:** the board is undistorted, the control bar stays on one row, the
  frame does not scroll, and Play Again is reachable. Verbatim, and listed
  separately from the other responsive checks ("Supports Replays in Popout S
  view").

- [x] **REP-08 · Replay honours `lang`** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): #2484 with `lang=de`, `ar`, `ja`: Round details, takeover titles, readout and Play Again all translated; the round unchanged (68.2x).
  Load the same replay with `&lang=de`, `&lang=ar`, `&lang=ja`.
  **Expect:** the replay UI translates and the round is unchanged. Verbatim
  ("Supports all optional parameters like currency, language, amount");
  `REP-04` covers currency and `REP-02` the amount, so this closes the set.

- [x] **REP-09 · A Three of a Kind replay shows its cost and three cards** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): trips #2: "Play amount $1.00 / Round cost $250.00 (x250) / Game mode Three of a Kind / Cards Any Equal Equal / Payout 4,583.3x"; three cards; chips 916.6x / 4,583.3x.
  Open a replay for `tr_any_equal_equal` (IDs in REPLAY_EVENTS.md), at desktop
  and at 400 x 225.
  **Expect:** the details panel reads Game mode "Three of a Kind", a **Round
  cost** row of 250 x the play amount, a "Cards" row of exactly THREE badges
  (Any, Equal, Equal - no empty fourth pill) and the payout; the round deals
  three cards and the takeover fans three. Verbatim ("UI clearly displays bet
  cost and applied multiplier") - the play amount alone is the base bet, and on
  this mode the round took 250 of them.


- [x] **REP-12 · A replay that cannot load says so** — *Major*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, replay, USD)): PASS. Event 99999999 (the RGS answers 500) and a dropped replay fetch (SIMULATED offline) both put the dialog ON TOP of Round details - "Something went wrong. Please try again." / "Could not reach the game server. Check your connection, then reload." - with Reload, which reloads.
  Open a replay with an event ID the mode does not publish, or while offline.
  **Expect:** the error dialog on top of Round details, readable, with Reload -
  never a Round details panel whose Play does nothing (front v71 hid the dialog
  under it).

---

- [x] **REP-10 · A Last Stop replay shows its ticket** — *Major*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): ls #9426 details carry "Ticket x10"; the takeover lays the x10 ticket on the hand.
  Open a replay from `REPLAY_EVENTS.md`'s Last Stop table, one per ticket column.
  **Expect:** the round details list the ticket (×2 / ×3 / ×5 / ×10) beside the
  payout, the reveal turns that ticket, and the payout matches the table.

- [x] **REP-11 · A Last Stop bust replays with no ticket** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): `ls_red_higher_inside_heart` #1801: no Ticket row in Round details, the ticket face down and dimmed.
  Open a Last Stop "Bust + win" replay.
  **Expect:** no ticket row in the details, and the ticket stays face down.

## 09 · Localisation

Sixteen languages: `ar de en es fi fr hi id ja ko pl pt ru tr vi zh`. Only
English is required for approval; the rest are shipped.

- [x] **LNG-01 · Each language loads and nothing falls back to English** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): all 16 languages: board, How to Play (every family tab), autoplay and mode panels swept against the English catalogue - no English string shown where a translation exists. The ERROR dialog printed the RGS's English statusMessage under the translated sentence in all 15 - FIXED LOCALLY (the detail is hidden for every recognised code).
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD): re-run with this session's strings (leak lists rebuilt from the catalogues), all 15 non-English languages: board, How to Play (every tab), autoplay, mode, a settled round (result words, card names), the history panel, the takeover where one landed and a simulated ERR_GEN dialog - no English string, nothing clipped, no frame scroll, `dir=rtl` in Arabic.
  Launch in each of the sixteen, opening How to Play, the autoplay popup and an
  error modal in each.
  **Expect:** fully translated. Acronyms like RTP staying in Latin script is
  correct and expected.

- [x] **LNG-02 · No "uncompiled message" warnings** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): no Lingui or uncompiled-message warnings in any of the 16 languages.
  Watch the console while switching languages.
  **Expect:** clean - no Lingui warnings about uncompiled messages.

- [x] **LNG-03 · Arabic does not break the layout** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): `dir=rtl`, no horizontal scroll, the die stays right, card ranks and the A-to-K strip read left to right, every money figure isolated (pay-amount cells `ltr`).
  Launch in Arabic and work through the whole UI.
  **Expect:** text legible, nothing overlapping or overflowing, and card ranks
  and suits still left-to-right.

- [x] **LNG-04 · The longest languages do not overflow** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): German and Finnish: no clipped bar label, guess label or panel title; nothing wraps the bar.
  German and Finnish produce the longest strings; check the control bar and
  every popup title.
  **Expect:** no clipping, no ellipsis on a control label, no wrapping that
  breaks the bar.

- [x] **LNG-05 · A malformed `lang` does not break the display** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): en_US, zz!!, en;a, empty and absent all render English with every money figure; po renders Polish ("Saldo 526,39 USD"); no console errors beyond F-5's fonts.
  Load with `?lang=en_US`, `?lang=zz!!`, `?lang=en;a`, `?lang=` and with no
  `lang` at all. Then `?lang=po`, which is Stake's own code for Polish where
  every catalogue here is named `pl`.
  **Expect:** the game renders in English (Polish for `po`), every money figure
  on the control bar and in the bet menu is present and correctly formatted, and
  the console is clean. Verbatim PreCheck ("Invalid language parameters do not
  break game display").
  **Why it is a Blocker:** Lingui hands the activated locale to
  `Intl.NumberFormat`, which throws a RangeError on a malformed tag rather than
  degrading - and `numberToCurrencyString` draws the balance, the last win, the
  bet display, the running win, the takeover amount and every chip. One
  underscore emptied the board. `?lang=` is now resolved against the shipped
  locales before activation; this confirms it on the uploaded build.

- [x] **LNG-06 · The Three of a Kind copy reads in every language** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): Three of a Kind's tab in `pl`, `ar`, `ja` fully translated; the Arabic table mirrors without overflow and its totals read 250.00x / 916.60x / 4583.30x.
  In `pl`, `ar` and `ja`, open the mode picker, confirm a switch to Three of a
  Kind, and read its tab in How to Play.
  **Expect:** the blurb, "Costs 250x your bet", the running-total table headed
  "Total", the one bust rule and the "about one round in 19" line are all
  translated, and the Arabic table mirrors without overflowing. These strings
  arrived with the mode and were translated in one pass; `locales.test.ts`
  proves they exist and differ from English, not that they read well.


- [x] **LNG-08 · The error dialog is all in the player's language** — *Major*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD, SIMULATED request): PASS. ERR_VAL in de, ar and ja: the translated sentence and `ERR_VAL`, no English line, Close in the language ("Schließen", "إغلاق", "閉じる").
  In `de`, `ar` and `ja`, provoke a recognised RGS error (ERR_VAL is easiest).
  **Expect:** the translated sentence and the code (e.g. `ERR_VAL`) - no English
  line under it. The RGS's own statusMessage is shown only for a failure the game
  cannot name, where it is the only description there is.

---

- [x] **LNG-07 · Last Stop reads in every language** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): `de`, `ar`, `ja`: the ticket and stack read "LETZTER HALT" / the Arabic / "ラストストップ" with "x2 - x10" low to high; the route runs right to left in Arabic; the payout cells stay left to right.
  Switch to `?lang=de`, `ar`, `ja` on Last Stop.
  **Expect:** the tab, the blurb, the ticket's band ("LAST STOP" in the
  language), the stack's "N of 20" counts, the example's range and its Classic
  line are all translated; in Arabic the route runs right to left, the ticket
  hangs under card 4, and "×2 – ×10" still reads low to high.

## 10 · Compliance surface

The specific things an approval reviewer opens the game to find. All of them
live in the How to Play panel behind the `i` button.

- [x] **CMP-01 · RTP is stated and reachable during play** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): 96.00% on all five How to Play tabs, reachable at any time from the i button.
  **Expect:** 96.00%, reachable at any point during play, consistent with the
  submitted math. It is interpolated from `game/config.ts` rather than written
  out, so it cannot drift from the figure the math is built to.

- [x] **CMP-02 · Max win is stated and matches the math** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): family ceilings stated: 1,354.2x / 585.2x / 4,301.9x / 2,237.3x / 4,583.3x - match the build.
  **Expect:** 1354.2x - the true enumerated ceiling, not the declared bound of
  1400 in the config.

- [x] **CMP-03 · Disclaimer is present and complete** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): malfunction voids, connection required, reload to finish, expected return over many plays, display illustrative, settled by the Remote Game Server.
  **Expect:** covers malfunction voiding plays, the connection requirement,
  expected return over many plays, and settlement from the Remote Game Server
  rather than the browser.

- [x] **CMP-04 · No claims the game cannot honour** — *Major*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): "This game has no free spins, bonus rounds, jackpots, or re-trigger features."
  **Expect:** the panel states there are no free spins, bonus rounds, jackpots
  or re-triggers, and the game has none. Payouts are described as dynamic, which
  they are.

- [x] **CMP-05 · Provider name is real** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): providerName 'Takeover Casino' (game/platform/config.ts).
  Check `providerName` in `game/config.ts` against the operator's registered
  name.
  **Expect:** the real provider, not SDK template boilerplate.

- [x] **CMP-06 · The paytable and win combinations are shown** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): six pay-range rows per guess tab, with "These figures are exact: the stages multiply at full precision...".
  **Expect:** How to Play lists every pick at every stage with the range it pays,
  and states that the figures are exact rather than rounded. Verbatim ("Payout
  information per symbol must be clearly communicated"; "Win combinations are
  displayed in the game rules"). This game has no symbols and no fixed paytable
  - each stage pays its true odds against the remaining deck - so the range per
  pick is the honest form of that requirement, and it is derived from the same
  function the game pays out with.

- [x] **CMP-07 · Every mode states its description and its cost** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): five tabs; each states blurb, ceiling and "This mode costs 1x your bet" (250x on Three of a Kind).
  **Expect:** all four families are reachable from the tabs in How to Play,
  each with its blurb, its ceiling and its bust rule, and the line under the
  Game modes heading follows the tab: "This mode costs 1x your bet..." on the
  three guess modes and "This mode costs 250x your bet..." on Three of a Kind,
  which also states the cost on its picker row and in the switch confirmation.
  Verbatim ("Game modes include description and cost information" and "High
  cost bet modes require confirmation before activation").

- [x] **CMP-08 · The UI guide is present** - *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): Controls names the deal button and Space, MODE, plus/minus, Turbo, autoplay and its stops, the speaker, i, the die and keys 1-4.
  **Expect:** the Controls section in How to Play names every button on the
  bar, one line each, and says what it does. There is no separate Speed section
  any more; turbo, autoplay and the sliders are described on their own lines. Verbatim ("A User Interface guide briefly
  describing what the UI buttons do"; "User interaction guide is included in the
  game information").

- [x] **CMP-09 · Sound can be turned off** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): Music and Game sounds mute independently without moving their sliders (75 stays 75); the bar's speaker crosses only when both are muted; all four settings survive a reload (localStorage ride-the-bus:* works inside Stake's iframe). Ears still needed for 'muted is silent'.
  The speaker button on the bar **opens the sound panel rather than muting**.
  That is the price of separate music and cue levels, and it makes muting two
  actions instead of one — so this check is about the panel, not about a toggle.

  Open it, and for **each** of the two rows (Music, Game Sounds): press its
  speaker, play a round, drag its slider to zero, play another, reload.
  **Expect:**
  - the speaker silences that bus alone and leaves the other one playing;
  - the speaker does **not** move the slider, and un-muting returns to the level
    that was set rather than to the default;
  - dragging to zero also mutes, so the speaker glyph never shows sound on over
    a silent bus;
  - un-muting a slider parked at zero lifts it back to the last audible level
    rather than doing nothing visible;
  - the bar's own icon shows the crossed speaker only when **both** buses are
    silent;
  - all four settings survive a reload.

  Verbatim ("Game provides an option to disable sounds"; "An option to disable
  sounds"). The blocker is satisfied by the panel's two speakers: there is no
  requirement that muting be a single tap.

  Most of the above is pinned by `src/game/sound.test.ts` against a fake
  AudioContext, so this pass is confirming it on real hardware with real ears —
  in particular that muted really is silent, which no unit test can hear.

- [x] **CMP-10 · The spacebar is bound to the bet button** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): one Space tap = one round; Space with the bet field focused = no round (it types a trailing space into the field); with How to Play open = no round; during a takeover the first Space does nothing, the second dismisses it, neither deals.
  With all four guesses picked, tap Space. Then hold it. Then tap it with the
  bet field focused, with a popup open, and while the win takeover is up.
  **Expect:** a tap plays one round; a hold keeps playing until released; and it
  does nothing at all in the other three cases - typing a bet must never place
  one. Verbatim ("Space bar should be bound to the bet button").

- [x] **CMP-11 · The main frame never scrolls** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): no frame scroll at all seven sizes (phones touch-emulated), idle, with the bet menu open (it scrolls internally) and with How to Play open.
  At all seven target sizes, with the bet menu open, with How to Play open, and
  with a long currency (TZS / UGX / XOF) and a large balance.
  **Expect:** no horizontal or vertical scrollbar on the game frame. A popup may
  scroll inside itself; the frame may not. Verbatim ("Main game frame should not
  be scrollable").

- [ ] **CMP-12 · Double-tap zoom is off, pinch zoom is not** — *Major*
  On a real phone, double-tap the board, then pinch it.
  **Expect:** double-tap does nothing; pinch still magnifies. Verbatim for the
  first half. The second half is deliberate and easy to undo by accident: the
  older `maximum-scale=1.0, user-scalable=no` pair met the checklist by
  disabling pinch too, which fails WCAG 1.4.4. If the viewport meta looks
  under-specified, that is why - do not add them back.

- [x] **CMP-13 · Five wins per mode agree with the rules** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, replay): FAIL. 23 replayed rounds across the five families: every stage price inside the family's How to Play range - except Second Chance #11, whose card 4 paid 3.41x against the table's 2.38-2.94x: after a forgiven miss the following cards are priced as on Classic, which the table did not say. FIXED LOCALLY: a sentence under every forgiving family's table. Re-run on the next upload.
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, replay, USD)): PASS. Math unchanged (v13), so the 23 v71 books plus eight replayed on v72 were reconciled again (`cmp13.mts`): every winning round's stage prices sit inside its family's table; the one outlier, sc #11's 3.41x card after a forgiven miss, is now stated under Second Chance's table (CMP-17).
  Play or replay five winning rounds in each of the three guess families,
  checking each payout against the stage figures in that family's payout table,
  and five Three of a Kind rounds against its running-total table (250.00x /
  916.60x / 4583.30x - the chips print the same digits).
  **Expect:** every figure reconciles. Verbatim ("Check 5 wins for each game
  mode against the Game Rules"). Scoped to the four families a player sees
  rather than to the 193 published bet modes; `REPLAY_EVENTS.md` carries a
  win-cap, big-win, normal-win and loss ID for every one of the 193 if a
  reviewer wants to go wider.

- [ ] **CMP-14 · Title, assets and imagery clear the compliance checks** — *Major*
  **Read 2026-10-06** (web search, not the Stake catalogue): no online-casino or slot title called "Ride the Bus" turned up - the name is the traditional card game's, used by party apps and by a minigame inside the video game Schedule I. No restricted term in it. Stake's own catalogue needs a signed-in search; the call stays with the owner.
  **Expect:** the title is unique, uses no restricted term, and is distinct from
  existing titles and series; nothing in the art is offensive or inappropriate;
  no Stake branding or themes appear anywhere. Verbatim, all four. **"Ride The
  Bus" is a widely known bar card game and the name may be in use elsewhere** -
  search the Stake catalogue before submitting, because a rename after approval
  is far more expensive than one before it.

- [x] **CMP-15 · Tile assets meet the artwork guidelines** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, files in `submission/`): `RideTheBus-FG.png` 1600 x 1600 RGBA, transparent; `RideTheBus-BG.jpg` 1920 x 1280; 1.37 MB together, under 3 MB; `TakeoverCasino-Logo.png` 710 x 710 RGBA. Names follow Stake's `GameTitle-BG/FG`, `ProviderName-Logo`. No multipliers. A judgement for the owner: "TAKEOVER CASINO" is printed on the card back and the Ace in the FG and small on the deck in the BG - in-world printing, and Stake's captured guidelines say nothing against it.
  Check the three files in `submission/` against the Tile Editor's requirements.
  **Expect:** background and foreground under 3 MB combined (they are 1.99 MB),
  the foreground transparent, no text or multipliers baked into either, no dark
  edges on the background, and the provider logo legible at small sizes. These
  are uploaded through the dashboard, not shipped in the build.

- [x] **CMP-16 · The music bed is licensed, single, and behaves** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): one track, static/music/A.mp3, is the only music request; ASSET_LICENCES.md carries its paid-tier row and hash; mute works (CMP-09). Ears still needed on real speakers.
  Nothing in this item can be checked by the test suite, and the first line of it
  is the one that stops a submission.

  **Licence.** The track in `static/music/` must have been **generated on a paid
  Suno subscription**, with its `ASSET_LICENCES.md` row carrying the generation
  URL, the date, the verbatim prompt and the tier active on that date.
  Free-tier Output is licensed for personal, non-commercial use only.
  Re-downloading a free-tier track after subscribing does **not** fix it — the
  licence attaches when the Output is *generated*. **As of 2026-09-02 this is
  satisfied**: the free-tier placeholders were deleted and ten fresh tracks
  generated on a paid Pro subscription (v5.5), with a row per file in
  `ASSET_LICENCES.md`. One of the ten ships and the other nine are benched in
  `audio-masters/`, still licensed and still documented. Still open there, and
  required before sign-off: the ten **generation URLs**, the **invoice**, and a
  saved copy of the **Terms as they read on 2026-09-02** (a new Terms took effect the following day, so that text
  cannot be retrieved from the site later).

  **One file.** `static/` is copied wholesale into the build, so every candidate
  left in `static/music/` ships. **Expect:** exactly one audio file there, named
  by `ACTIVE_TRACK_ID` in `musicTracks.ts`. `musicTracks.test.ts` prints the
  directory total and holds a 9 MB ceiling, but it cannot know which one you
  meant. **Satisfied as of 2026-09-06**: `A.mp3` alone, 2.2 MB, with the nine
  benched takes moved to the repo-root `audio-masters/`. Re-check it anyway if
  anyone has auditioned a take since — the way this fails is a copied-in
  candidate that was never copied back out.

  **The seam, and it now happens often.** Leave the game idle on the board for
  **longer than one full loop period** — `loopEnd − loopStart − crossfade`, which
  on the shipping track is **154 seconds**, not the five minutes the earlier
  candidates ran — and listen through the wrap. Sit through at least two. A
  player on a long session hears this every two and a half minutes, so it carries
  more weight than it did. **Expect:** no dropout, no level dip, no audible
  restart, and no fade to silence followed by a cold entry. If it wraps badly the
  fix is `loopEnd` in the manifest, pulled back to a bar line.
  `npm run audio -- --params "dev_loop=40,70,4"` reproduces the same seam every
  26 seconds if you need to hear it repeatedly.

  **Laptop speakers — the one measurement could not settle.** The bed measures
  0.4% of its energy above 2 kHz on the board: four times the free-tier set this
  replaced, a quarter of the `noir-triphop-c2` placeholder. **Expect:** the bed
  is still present, not just felt as low rumble, on a laptop's built-in speakers
  and on phone speakers. If it disappears, the nine benched takes in
  `audio-masters/` are the shortlist and
  `rtb-invariants/references/audio-and-jurisdiction.md` ranks them.

  **The ladder.** Play a round through to a big win. **Expect:** the bed is
  loudest on the idle board, pulls back as the cards turn, and ducks hard and
  fast under the fanfare — never the other way round. It shares one limiter with
  every cue, so a bed sitting on top of a win ducks the *win*.

  **Bandwidth.** With music muted before the first tap, open the network tab and
  reload. **Expect:** the track is **not** requested at all. Muting is a
  bandwidth claim here, not only a CPU one.

  **The two screens before the board.** **Expect:** on Stake's own embed, the bed
  is already playing under the loading and start screens. If it only arrives at
  the board, the iframe is not granting autoplay — which is legitimate, not a
  bug, but it is worth knowing which of the two a real session does.


- [x] **CMP-17 · A forgiven Second Chance round can be checked against the rules** — *Major*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD): PASS. sc #11 replays (card 2 forgiven, card 4 busted, 0.4x). The sentence sits under Second Chance's payout table, in social mode too, and on no other tab.
  Replay `sc_red_higher_outside_heart` #11 (forgiven at card 2, card 4 priced
  3.41x) and read Second Chance's How to Play tab.
  **Expect:** under the payout table: "These prices assume your forgiveness is
  unused. After a forgiven miss, the cards that follow are priced as on Classic, a
  little higher." On no other family's tab.

- [ ] **CMP-18 · A screen reader hears the picks, the cards and the result** — *Major*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD), accessibility tree): PASS for everything a screen reader is handed - the twelve picks carry `aria-pressed`; before a deal the chips are `aria-hidden` and the cards unnamed; dealt cards read "Card 2: Ace of Clubs, Busted" / "Card 3: 5 of Hearts, Forgiven" / "Card 1: Ace of Diamonds" (trips' dealt card); the status line says "Kept, Card 2: Ace of Clubs, $0.50, 0.5x" once. The NVDA / VoiceOver listen is still the owner's.
  With NVDA or VoiceOver, pick four guesses, deal, and let the round settle.
  **Expect:** each pick is announced pressed or not pressed; each dealt card reads
  like "Card 2: King of Clubs, Right" (Busted / Forgiven on a miss); the empty
  chips are silent before the deal; the result is announced once, naming the card
  that ended the round ("Kept, Card 4: 2 of Clubs, $1.10, 1.1x").

- [x] **CMP-19 · The prompts name the pointer** — *Minor*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD), phones by CDP touch emulation): PASS. Mouse: "Click to continue", "Click to skip", "Click the amount for the quick-bet menu". Touch (Mobile S/M/L): "Tap to continue", "Tap the amount ...". The same split in de, fi, ru, ar and ja.
  On a desktop with a mouse, then on a phone.
  **Expect:** "Click to continue" / "Click to skip" and "Click the amount for the
  quick-bet menu" with a mouse; "Tap ..." on touch. In every language.

- [x] **CMP-20 · The intro's Tab order reaches Continue first** — *Minor*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD): PASS - Tab visits the four ? badges, then Continue. One more Tab then reached the board's Black square, hidden under the intro: FIXED LOCALLY, the board and the bar are `inert` until play starts (`launchGuards.test.ts`), so Tab now wraps from Continue to the badges.
  Load the game and press Tab from the start.
  **Expect:** the four ? badges, then Continue - the demo squares are not in the
  Tab order (a pointer still plays them) - and Tab never leaves the intro for the
  board hidden under it.

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

- [x] **DEV-01 · Phone, portrait - a full round is playable** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): EMULATED Mobile M (375 x 667, touch, coarse pointer) on the live build: picks, bet and a full round played (/wallet/play 200, bust shown with its cross and ring). Real-phone sign-off still owed.
  On a real phone, set all four guesses, spin, and read the result.
  **Expect:** every control hittable first time, nothing clipped, no zooming
  needed, no accidental mis-taps between adjacent halves.

- [x] **DEV-02 · Phone, landscape** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD, CDP touch, 844x390 and 667x375): board and bar fit with no page scroll; the 1,354.2x takeover's title, amount, multiplier, prompt and fan all inside the short axis.
  **Expect:** board and control bar both fit without page scrolling, and the win
  takeover fits the short axis.

- [x] **DEV-03 · Start screen fits without scrolling** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD, nine sizes): the start screen fits with no scroll and Continue on screen at every size; one row of four steps on every 16:9 size and the landscape phones, a 2x2 grid on portrait phones (rearranging is allowed there); the ? badges open by click and by tap.
  Across phone, tablet and desktop, at several window sizes.
  **Expect:** all four steps on one row on every 16:9 size (a 2x2 grid on a
  portrait phone, where rearranging is allowed), the whole screen fits, and the `?`
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

- [x] **DEV-06 · The Three of a Kind board holds at Popout S and Mobile S** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD, CDP touch at 320x568): Popout S: three slots, two read-only Equal badges, the blue cost with "$1.00 x 250" under it, one bar row, no scroll; the picker scrolls inside its panel; back on Classic, four face-down cards and four squares. Mobile S: the same board with "$0.10 x 250", no scroll; the picker fits without scrolling.
  Switch to Three of a Kind at 400 x 225 and at 320 x 568, then play a round.
  **Expect:** three card slots and two read-only Equal badges under the gaps
  between them, the bar on one row at Popout S with the blue cost figure and
  the "1.00 x 250" line under it, the mode picker's four rows scrolling inside
  the panel rather than the frame, and no horizontal scroll. Switching back to
  a guess family turns the cards over and restores the four squares.


- [ ] **DEV-11 · The MODE sign** — *Major*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD), seven sizes x en, de, fi, ru, ar, ja, phones by CDP touch emulation): the sign PASSES everywhere - the name in its family colour, fitted (smallest: Finnish "Toinen mahdollisuus" at 4.4px on Popout S), never overflowing; seven bolts except on Popout S; the bet display money only; MODE the same size on every family; the accessible name "Choose game mode, Three of a Kind, Volatility 7 of 7" translated in each. NOT the same bar height: on Popout S Three of a Kind's bar is 1-5px taller (its extra "$1.00 x 250" line), and that line printed at 3.3px there (DEV-12). The floor is FIXED LOCALLY; the height difference remains (6px on Popout S, 2.6px on Mobile S) and is the owner's call.
  Switch through all five families at every size, in `en`, `de`, `fi`, `ru`, `ar`
  and `ja`.
  **Expect:** the family's name in its colour on the dark sign, with the seven
  bolts under it (not on Popout S, where the sign is too small for them), fitted to
  two lines and never overflowing; the bet display shows money only; the bar the
  same width and height on every family; switching rolls the name (a short fade
  under reduced motion). The accessible name is "Choose game mode, <family>,
  Volatility N of 7".

- [ ] **DEV-12 · Phone type is legible** — *Minor*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD), Mobile S/M/L by CDP touch emulation, six languages): captions, guess labels, hints and family names are all >= 9px and the bar stays on two rows. FAIL for one line: Three of a Kind's base-bet line ("$1.00 x 250") was the only unfloored type in the bar - 5.6 / 6.6 / 7.5px on the phones, 3.3px on Popout S. FIXED LOCALLY (9px on phones, 6px on Popout S).
  Mobile S, M and L.
  **Expect:** no caption, guess label, hint, family name or Three of a Kind's
  "$1.00 x 250" line under 9 px; the bar
  stays on two rows in every language (swept every 4 px from 320 to 620,
  2026-10-06).

---

- [x] **DEV-07 · The ticket on the small sizes** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD, nine sizes): the ticket is whole on screen, under card 4, and touches neither the readout, the Suit label nor any prop, idle and after a deal.
  Last Stop at Popout S, Mobile S, M and L, idle and after a sweep.
  **Expect:** the ticket is whole on screen, hanging under card 4 at every size,
  and touches neither the readout, the Suit label nor a prop.

- [x] **DEV-08 · The deal goes INTO the deck, at every size** — *Minor*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD, nine sizes): each card's centre reaches the deck (distance 0) and fades out into it during the deal at every size.
  Start rounds at all seven sizes (and Last Stop for the ticket).
  **Expect:** the last round's cards shrink onto the deck and disappear into
  it, a short rest, then deal back out; the ticket does the same into its
  stack. Nothing hovers over the deck or the stack at any size.

- [x] **DEV-09 · Fast slams never strew the board** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): 15 rounds slammed early: worst card displacement from its slot 0 px; no deal animation left running.
  With the skip button, slam rounds over and over, early in the deal.
  **Expect:** every card and the ticket land in their places at once, every
  time; the bus is at its stop immediately. Locally: 40 slammed rounds, worst
  displacement 0.2 px, no deal animation left running (2026-10-01).

- [x] **DEV-10 · The table die picks, and only the deal plays** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD): no die on Three of a Kind; six rolls, six playable sets (never Equal then Inside); the die does nothing mid-round; die clicked then Space DEALT `red_lower_equal_heart`, exactly the squares shown.
  (Also: click the die with the mouse, then press Space - it must DEAL, not
  roll again; the same after clicking a guess square. Space always deals on
  the board - CMP-10.)
  Roll the die beside the guesses a few times, then deal; try it mid-round, in
  autoplay, in replay and on Three of a Kind; and in `?lang=ar`.
  **Expect:** each roll changes the four picks to a playable set (never Equal
  then Inside), the bet mode in the deal request is the one shown, and nothing
  is placed until the deal. Mid-round, in autoplay and in replay it is dimmed
  with the squares and does nothing; Three of a Kind shows no die. It sits on
  the wood right of the Suit square (under the Color square on a portrait
  phone) and stays on the RIGHT in Arabic. One roll sound, no click under it.
  Locally (2026-10-01) it was on screen, on top, fully opaque and on the wood
  at all seven sizes and at 667x375, 844x390 and 932x430 landscape - 18 px at
  Popout S, 30-35 px on a landscape phone, where its touch target grows to 44.

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
| A malformed `?lang=` emptied every money readout | `LNG-05` |
| Rules stated a ceiling 56 of each family's 64 modes cannot reach | `WIN-11` |
| A finished replay offered no Play Again button | `REP-06` |

- [x] **REG-01 · Console is clean across a full session** — *Major*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): FAIL for the same font errors as PRF-04 (F-5); no [RideTheBus] warnings over 500 rounds.
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD): PASS (F-5 fixed). Cold launch, a 100-round autoplay at full turbo (44 end-rounds, three takeovers), all seven panels, then a reload in `de`: no console error or warning, no failed request, no 4xx or 5xx.
  From cold launch through 100 rounds, autoplay, a win takeover, every popup and
  a language switch.
  **Expect:** no uncaught errors, no unhandled rejections, no 4xx or 5xx except
  ones a test here deliberately provoked.


- [x] **REG-02 · The fonts load under the CDN's policy** — *Blocker*
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD): PASS (F-5 fixed). The CDN still sends `font-src 'self' https://fonts.gstatic.com`; Overpass and Big Shoulders load from the build's own `fonts/` files and report `loaded`; no font error in the console.
  On the uploaded build, check the response's `content-security-policy` and
  `document.fonts`.
  **Expect:** Overpass and Big Shoulders load from the build's own `fonts/` files
  (`font-src 'self'`) and report `loaded`; no font error in the console. Front v71
  embedded them as `data:` URIs, which the CDN blocks (F-5). `csp-preview.mjs`
  in the `rtb-live-audit` skill rehearses this on a local build first.

---

## 13 · Stake.US and social mode

`?social=true` puts the game in social-casino mode, where a table of gambling
terms is prohibited outright. `socialMessages.ts` carries the replacements and a
unit test scans the catalogue for banned words - but a catalogue that is clean
and a screen that is clean are different claims, and only the second one ships.
Run every check here with `&social=true` on the URL.

- [x] **SOC-01 · No restricted term reaches the screen** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): social session swept against Stake's prohibited-term table (the socialMessages.test.ts list): intro, board, bet menu, autoplay panel, sound panel, mode picker and confirmation, all five How to Play tabs, a settled round - no hits. Copy defect: "Stop auto play on full game won" / "Full game won" - finding F-10.
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, XSC social): re-run over this session's surfaces - the MODE sign on all five families, the picker, every How to Play tab, autoplay, sound, turbo, five rounds ("Kept", "Busted", "Full game win"), a takeover, the history panel, the blocked tip and an error dialog: no restricted term. The only match is again "Stake Engine" in Stake's own disclaimer.
  Walk the whole UI: control bar, bet menu, mode picker, How to Play, autoplay,
  the win takeover, every error modal.
  **Expect:** none of "bet", "stake", "cash", "money", "pay/paid/pays", "wager",
  "buy", "gamble", "deposit", "withdraw", "credit" or "currency" appears.
  Watch particularly for strings assembled at runtime, which the catalogue scan
  cannot see.

- [x] **SOC-02 · Mode naming follows the social guidelines** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): High Stakes reads "High Risk" in the picker and the tabs.
  **Expect:** High Stakes reads **High Risk** everywhere it appears - the picker,
  the confirmation, the MODE button, How to Play and the replay details.

- [x] **SOC-03 · English only in social mode** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): social + lang=de renders English, dir=ltr.
  Load `?social=true&lang=de`, and again with `ar`.
  **Expect:** English throughout, and left-to-right layout even for Arabic.
  Verbatim ("English is the only supported language in Social Mode").

- [x] **SOC-04 · SC / GC / XEC display correctly** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): "1000.00 SC" suffix everywhere, no $ prefix.
  Cross-references `CUR-03`. **Expect:** the suffix form ("10.00 SC"), never a
  leading `$`. Verbatim ("Game supports SC and GC currencies & values do not
  display a `$` prefix").

- [x] **SOC-05 · The replay window carries no restricted words** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session): social replay of trips #2: "Play amount 1.00 SC / Round cost 250.00 SC (x250) / Won 4,583.3x"; takeover "Max Win 4583.30 SC" - no prohibited word.
  Open a replay with `&social=true` and read the round-details panel and the
  control bar.
  **Expect:** clean. Verbatim, and listed separately from `SOC-01` because the
  replay UI is a different set of strings that is easy to miss.

---

- [x] **SOC-06 · Last Stop's copy in social mode** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, XSC, social): Last Stop's picker row, confirmation, board and every How to Play tab: no restricted term. The only match was "Stake Engine" in Stake's own required disclaimer - the company name. Units read SC (XSC) and "Times your base play amount".
  `?social=true` on Last Stop: the picker and How to Play.
  **Expect:** no "pay", "bet", "fund" or "buy" anywhere in the family's copy.
  (The idle readout's "Wins up to" line was removed on 2026-10-01.)

## 14 · Performance

Stake's release gates name bundle size, load time and frame rate directly, and
"optimised bundle size" is an explicit 3-star criterion. None of it is
measurable from the source.

- [x] **PRF-01 · Bundle size and time to first interaction** — *Major*
  **Live 2026-10-06** (front v71 = a177bf85, math v13, Studio demo session, USD, Chrome's Fast 3G throttle, cache off): 473 KB transferred in all - `index.html` 347 KB compressed, `logo.webp` 80 KB (the 743 KB PNG is no longer what loads), `courts.svg` 46 KB, authenticate 2 KB; the music bed is not fetched until audio can start. The start screen was ready to press at 6.0 s. The next build moves the fonts out of `index.html` into files (F-5), so re-measure it.
  Load the uploaded build cold on a throttled connection (Fast 3G) with the
  Network tab open.
  **Expect:** a sensible total transfer and a board a player can act on quickly.
  `config-svelte` sets `bundleStrategy: "inline"`, so everything Vite processes
  is base64'd into `index.html` - currently about 1.29 MB, plus `logo.png` at
  743 KB. That logo is 710 x 710 and drawn at roughly 150 px, and is the single
  largest saving available.

- [x] **PRF-02 · Memory does not grow over a long run** — *Major*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): JS heap 33.6 MB before and after 500 rounds.
  Heap snapshot before and after `END-01`'s 500 rounds.
  **Expect:** no unbounded growth. Each round builds and discards card, chip and
  celebration nodes, and an autoplay run is the only place that repeats enough
  to show a leak.

- [ ] **PRF-03 · The win takeover holds its frame rate on a phone** — *Major*
  Record a performance trace through a Max Win on a mid-range Android.
  **Expect:** no sustained dropped frames. The known costs are the fan's four
  `box-shadow`ed cards and the `drop-shadow` on the suit marks; the blur is
  already dropped under `@media (pointer: coarse)`. If it does drop frames, take
  the marks' `filter` first - do not go back to blacking out the table.

- [x] **PRF-04 · The network tab is clean and says nothing it should not** — *Blocker*
  **Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session, USD): FAIL. The CDN sends `font-src 'self' https://fonts.gstatic.com`, which blocks the bundle's data: fonts: every Geist and Big Shoulders face reports `error`, the console logs one error per face, and the live game draws in fallback system fonts. Finding F-5. Requests otherwise clean: only the RGS and the game's own CDN (courts.svg, A.mp3); no game data logged.
  **Live 2026-10-06** (front v72 = this working tree built 2026-10-06 15:26, math v13, Studio demo session, USD): PASS (F-5 fixed). Only the RGS and the game's own CDN in the network log, no 4xx or 5xx, no font errors and no game data logged, across launch, rounds and every panel (and REG-01's 100 rounds).
  Play a full session on the **uploaded** build with the Network tab open.
  **Expect:** no 4xx or 5xx that a test here did not provoke, no requests to any
  origin but the RGS and the Stake CDN, and no game internals logged. The
  `/wallet/play` request and response logs are behind `import.meta.env.DEV` and
  must not appear - confirm that on the deployed build, not locally, because
  that is the whole point of the gate. Verbatim ("Network tab must show no
  errors and no game information being logged").

## Recording results

For each failure capture the test ID, the request and response bodies from the
Network tab, the console output, and the account and currency you were on.
Settlement and pacing bugs are timing-dependent and often will not reproduce
without those details.

**One item needs a decision rather than just a result:** small-screen touch
targets (`DEV-01`). The replay bet amount convention (`REP-02`) was settled live on
2026-10-05: `amount` is in micro-units.
