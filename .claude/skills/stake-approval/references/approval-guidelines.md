# Stake Engine approval guidelines — verbatim reference

**This is the source of truth for every Stake-specific claim in this repo.**

Captured from <https://stake-engine.com/docs/approval-guidelines> and its
sub-pages. That site is a client-rendered SPA: fetching it returns only a
loading shell, and the old `stakeengine.github.io/math-sdk` mirror now 404s. No
tool in this project can read it. Re-paste from the live site rather than
guessing when something looks out of date.

The math-SDK half of the docs *is* readable locally, at `math-sdk/docs/`
(`rgs_docs/data_format.md`, `rgs_docs/RGS.md`, `math_docs/**`). Prefer those
files over the web for file formats and RGS endpoints.

## Submission checklist

Use this checklist before submitting for approval. Incomplete submissions cause
delays — games that do not meet all requirements are held until the issues are
resolved, which may push the go-live date back significantly.

The review queue is shared across all teams. Submissions that fail basic checks
take reviewer time away from other games and may result in the request being
deprioritised.

This is the criteria applied to a **new team**. Requirements may vary once a team
builds a track record.

### PreChecks

- Game authenticates with RGS successfully on game launch
- Game authentication fails correctly with an invalid `rgs_url`
- Clicking on the bet button sends a successful play request to RGS
- Game should not contain the Stake Engine Loader

### Compliance checks

- Game title is unique and does not use restricted terms
- Game assets and imagery do not contain offensive or inappropriate content
- Game is sufficiently distinct from existing titles and series

### Game thumbnail

- Game thumbnail meets Stake artwork guidelines

### RGS requirements

**Bet levels**
- Game dynamically uses all betting parameters from the authenticate response
- Active rounds restore the bet amount from the authenticate response

**Currency support**
- Game supports and displays currencies correctly
- Game displays sub-cent payouts correctly

**RGS requests**
- Zero-win bets do not send an end-round request to the RGS
- Insufficient balance bets do not send a play request to the RGS

### Frontend requirements

- Main game frame should not be scrollable
- Space bar should be bound to the bet button

**Game rules**
- RTP and Max Win are clearly stated within the game rules
- Payout information per symbol must be clearly communicated
- Win combinations are displayed in the game rules
- Game modes include description and cost information
- Free game and re-trigger conditions are clearly displayed in the game rules
- General disclaimer is included in the game information

**Auto play**
- Auto-bet requires a confirmation step before starting
- High cost bet modes require confirmation before activation

**Responsive checks**
- Game functions correctly on Desktop/Laptop
- Game functions correctly on Popout S/L
- Game functions correctly on Mobile
- Double tap to zoom is disabled on mobile
- User interaction guide is included in the game information

**Sounds / music**
- Game provides an option to disable sounds

**Multiple language support**
- Game supports English language
- Invalid language parameters do not break game display
- Check 5 wins for each game mode against the Game Rules
- If Mystery Mode is present, any numerical values representing chances or
  probabilities are accurate

### Jurisdiction requirements — Stake.US

- Is the game compliant with the required translations for a social game?
- Game supports SC and GC currencies & values do not display a `$` prefix
- Game mode naming follows Social Mode terminology guidelines
- Replay window does not contain restricted words
- English is the only supported language in Social Mode

### Replay support

- Supports replay urls, loads and plays desired event
- Supports all optional parameters like currency, language, amount
- Replay allows replaying the event again after completion
- UI clearly displays bet cost and applied multiplier
- Supports Replays in Popout S view

### Final approval checklist

- Game has bet-level templates applied
- Provably Fair and Replay are enabled
- Front and Math requests are approved
- Game is posted in the `stake-engine-game-approved` channel
- Game works correctly on older mobile devices (Android and iOS)
- Approval request is closed after the game is live & emojis are added to the
  Slack notification
- Game Released

### What happens after submission

Three independent reviewers are assigned. Each rates the game 0–3 stars across
design, gameplay and math compliance. Ratings stay hidden until all three are in.

- Average ≥ 1 star → approved for production.
- Average < 1 star → rejected. Reviewers may give feedback; resubmission allowed
  after addressing it.

Can be as quick as a couple of hours; an incomplete or non-compliant game blows
that out to weeks.

## General requirements

Approval requests are actioned for a **specific frontend and math version**. Stake
inspects functionality, clarity, communication and technical performance.

**Approval requests must be accompanied by a short blurb describing the game
theme and mechanics**, for promotional material and the game description tag.

### Key restrictions

- Stake Engine games are **strictly stateless**: each bet must be independent of
  previous outcomes. Games cannot include jackpots, gamble features,
  continuation, or early cashout options.
- Team names, game titles and assets must comply with IP/copyright law.
- Games must be original designs. Pre-purchased or licensed games existing on
  other third-party websites are not permitted.
- Game assets cannot include material with Stake™ branding or themes.
- Approval is at the reviewer's discretion. Games deemed offensive, explicit, in
  poor taste, or of insufficient quality may be rejected.
- Games that promote, encourage, or are likely to appeal to underage persons are
  not permitted, including artistic depictions of children or child-like
  characters in any gambling context.
- Games are automatically considered for stake.us provided they abide by the
  language requirements below.

### Post-release

Once approved for Stake/Stake-US, **only minor updates to address visual issues
are permitted** unless Stake requests otherwise. Changes to the math model, new
game modes, or gameplay mechanic modifications are not allowed.

## Bet Replay

Mandatory for all new games. Games without it will not be approved. During review
Stake tests replay and requests a range of event IDs to validate scenarios.

**A player session is NOT required to view a replay** — replay URLs can be shared
publicly.

### Query parameters

| Parameter | Required | Description |
|---|---|---|
| `replay` | Yes | Always `true` in replay mode |
| `game` | Yes | Game ID |
| `version` | Yes | Math version (e.g. 1, 2) |
| `mode` | Yes | Bet mode |
| `event` | Yes | Unique **simulation ID** to replay |
| `rgs_url` | Yes | RGS server URL to fetch replay data from |
| `currency` | No | Currency code |
| `amount` | No | Bet amount in units |
| `lang` | No | Language code |
| `device` | No | Device type |
| `social` | No | Social mode (true/false) |

`event` being a simulation ID resolves the open question in REPLAY_EVENTS.md:
the IDs derived from the published lookup tables are the right thing to send.

### Endpoint

```
GET {rgs_url}/bet/replay/{game}/{version}/{mode}/{event}
```

Response: `{ "payoutMultiplier": float, "costMultiplier": float, "state": object }`

### Expected UX

- **Loading:** auto-load the event data without interaction, then show a "Play"
  button.
- **During:** play the round as normal — all animations, sounds and effects. No
  betting allowed; all bet controls disabled or hidden.
- **After:** show a **"Play Again"** button and keep the win amount and outcome
  visible.

Recommended slimmed-down replay UI — hide balance display, play buttons, bet
amount selector, autoplay settings; keep win amount, replay controls, replay bet
amount, currency display.

Must also: show a loading state, disable session calls (no authenticated API
calls), handle errors with a message if replay data fails to load, and prevent
any transition from replay into normal play.

## Game quality rankings

0–3 stars, determining visibility and positioning eligibility.

| Rank | Description | Promotion & visibility |
|---|---|---|
| ★★★ | Studio-quality, exceptional creativity, uniqueness, attention to detail | Optimal positioning; eligible for Burst Games, Stake Exclusives, featured New Releases |
| ★★ | Considerable creativity or originality; may lack polish vs established studios but strong development quality | Burst Games / Stake Exclusives if user popularity drives it; New Releases placement depends on space and demand |
| ★ | Lower polish but meets publishing requirements | **Not published.** The developer is asked to resubmit once improved. |

**One star is not a publication.** Any claim in this repo that 1 star ships at
the bottom of New Releases is wrong.

### Common issues leading to low ratings

- Shallow gameplay with limited depth — players place only 1–2 bets before
  losing interest.
- **Over-reliance on generic AI-generated assets — standard fonts, gradients,
  emoji icons and border effects are not sufficient for a quality release.**
- Inconsistent or low-quality visual design — mismatched art styles and poor
  animation quality.
- Missing engaging features — bonus modes and additional mechanics significantly
  enhance retention and are expected in competitive submissions.

### What makes a 3-star game

- Tested across a range of devices; renders correctly at all screen sizes with
  no laggy or low-quality sounds.
- **Optimised bundle size** — large assets and long loads create poor experiences.
- Clean animations and art; cohesive, polished, professional.
- In-depth concepts for Burst Games — simple concepts do not perform well;
  players wanting simple content play Stake Originals. Benchmarks: Cut n Crash,
  Angry Balls, Drop the Boss.

## RGS communication

- **Bet level verification:** the authenticate response returns default bet
  levels, supported levels for the currency, and min/max amounts. The frontend
  must respect these. Bet increments must reflect `authenticate/config/minStep`.
  Min and max levels must be selectable.
- **XSS:** strict policy. The build must consist only of static files and cannot
  reach external sources. Downloading fonts from external servers is a common
  failure that logs console errors.
- **RGS URL:** must come from the `rgs_url` query parameter.
- **Language:** English is the only required language. If only `en` is supported,
  on-screen text must not corrupt when other language parameters are passed.

Supported languages: `ar de en es fi fr hi id ja ko po pt ru tr zh vi`.

Supported currencies now extend well past the math-SDK doc's list — it adds NGN,
SAR, ILS, AED, TWD, NOK, KWD, JOD, CRC, TND, SGD, MYR, OMR, QAR, BHD, PKR, EGP,
NZD, BOB, GHS, KES, MAD, BAM, ISK, TZS, UGX, XOF and XEC (Stake Euro Cash,
displayed `SC`) alongside XGC/XSC. Code examples: <https://stake-engine.com/docs/rgs>

## Frontend and communication

### Game display

- Submitted games must use **unique audio and visual assets**. Backgrounds,
  symbols and animations shipped with the web-sdk sample games will not be
  approved.
- Free of visual bugs, broken or missing assets or animations.
- **Popout view support:** games must support Stake's 'mini-player' modal small
  view without the active game board being visibly distorted.
- Must support mobile view for commonly used devices, with all UI functionality
  usable during screen scaling.
- All images and fonts must be loaded from the Stake Engine CDN.

### Rules and paytable

- Game information accessible from the UI, with a detailed description of all
  rules.
- If multiple modes exist, describe the cost of each bet and what is purchased.
- The RTP of the game (and each mode) must be clearly communicated.
- The maximum win for each mode must be clearly displayed.
- Payout amounts for all symbol combinations must be presented.
- Special symbols (cash prizes, multipliers) — list all obtainable values.
- Feature modes — describe how to access them.

### UI components

- A **User Interface guide** briefly describing what the UI buttons do.
- The player must be able to change bet size, and use all bet levels from the
  authenticate response.
- Current balance must be displayed.
- Final win amounts clearly shown for non-zero payouts.
- If an outcome contains multiple winning actions, the payout must incrementally
  update to the final multiplier.
- An option to disable sounds.
- **Spacebar mapped to the bet button.**
- If autoplay exists, the player must confirm it — games may not automatically
  place consecutive bets with one click.

### Other checks

- Network tab must show no errors and no game information being logged.
- Playtesting verifies the game behaves as the rules describe.
- Tested with various currency and language combinations.
- Any 'fastplay' option must keep win amounts, winning combinations and pop-up
  information legible.

## Math verification

### File size restrictions

- No single events file (`.jsonl.zst`) may exceed **4.2 GB**
- No game mode may contain more than **10,000,000 events**

### Summary statistics

- Mode cost correctly represented in the game rules for each mode.
- **Calculated RTP must be within 90.0%–96.70%.** For multiple modes, all must
  fall within a **0.5% variation**.
- Maximum win must match the game rules for each mode.
- Maximum win must be realistically obtainable — typically more frequent than
  1 in 10,000,000, depending on payout size.
- Slot-type games: run **100,000–1,000,000 simulations** for outcome diversity.
- A reasonable portion of simulations must pay — e.g. 90,000 non-paying out of
  100,000 may be grounds for rejection.
- The hit-rate of the most likely single simulation must not be overwhelmingly
  dominant where results are visually expected to vary.

### Other considerations

- Non-zero win hit-rate should be **better than 1 in 20 bets**.
- For 1.0×-cost "BASE" modes, standard deviation should sit within industry norms.
- List the number of non-zero weight payouts; zero-weight payouts should not
  dominate.
- Inspect hit-rates for win ranges to avoid gaps where expected win amounts are
  unobtainable.

### Risk limits by star tier

| Limit | 2-star | 3-star |
|---|---|---|
| Maximum exposure | $10,000,000 | $50,000,000 |
| Maximum payout multiplier | 25,000× | 100,000× |
| Maximum bet cost | $100,000 | $500,000 |
| Maximum cost multiplier | 1,000× | 1,500× |
| Minimum base (1.0× cost) standard deviation | 0.6 | 0.6 |
| Maximum base (1.0× cost) standard deviation | 50.0 | 60.0 |
| P(≥5000) / P(≥10000) | 1e-2 / 8e-2 | 1e-2 / 2e-2 |
| Risk limits (CVaR) | 700 | 800 |
| Liability (ETL, >40× bet) | **0.8** | 0.9 |
| Liability (ETL, P(>10000)) | 0.6 | 0.8 |

**The 0.9 / 800 figures cited elsewhere in this repo are the 3-star tier.** The
binding pair for a new submission is the 2-star tier: ETL 0.8 and CVaR 700.

Maximum bet size accepted by the RGS is $500,000 USD; beyond that returns
400 `invalid bet amount`.

**P(≥5000) / P(≥10000)** are maximum allowed cumulative probabilities of a payout
at or above those multipliers, taken as the worst case across all modes. High-cost
modes are scaled down before comparison: cost ≥ 1000× by 0.2; 500 ≤ cost < 1000
by 0.5; 200 ≤ cost < 500 by 0.8.

**CVaR** (Conditional Value at Risk / Expected Shortfall): the expected payout to
the operator when a win occurs in the worst 0.1% of outcomes. Both the normalized
(CVaR / bet cost) and un-normalized values are considered.

**ETL** (Expected Tail Liability): the proportion of total expected return
concentrated in wins ≥ 40× the cost multiplier (or >10,000× if not applicable).
A normalized ETL of 0.5 means half the game's RTP comes from wins above the
threshold — high tail-risk concentration for operators.

## Game tile visual assets

Submitted with the game. Low-quality or unappealing artwork results in lower
player trust, interest and engagement.

Three assets required. **Background + foreground must not exceed 3 MB combined.**

| Asset | Requirement | Naming |
|---|---|---|
| Background | Environmental background showing the world of the game. High-resolution PNG or JPG. | `GameTitle-BG.format` (e.g. `CrownConquest-BG.png`) |
| Foreground | A feature character or key item representing the game. High-resolution PNG, transparent background. | `GameTitle-FG.png` |
| Provider logo | Official provider/studio logo. High-resolution PNG, transparent background, legible at small sizes. | `ProviderName-Logo.png` |

## General disclaimer

The rules/information popup must include a brief disclaimer about game operation.
Stake Engine uses pre-calculated results: payouts are dictated purely by the RGS
response and are not influenced by frontend events. Stake's template may be used,
or your own, so long as the same message is clearly conveyed.

> Malfunction voids all wins and plays. A consistent internet connection is
> required. In the event of a disconnection, reload the game to finish any
> uncompleted rounds. The expected return is calculated over many plays. The game
> display is not representative of any physical device and is for illustrative
> purposes only. Winnings are settled according to the amount received from the
> Remote Game Server and not from events within the web browser. TM and © 2026
> Stake Engine.

## Jurisdiction requirements — restricted terms

For availability on stake.us, US requirements prohibit certain gambling terms.
This applies predominantly to game rules but extends to images and UI elements.

The RGS sets `social=true/false` to indicate a social casino. Stake recommends an
additional language file prefixed `sweeps_<lang>`; this project uses
`src/i18n/socialMessages.ts` instead, applied through `i18nDerived.t`.

| Restricted | Replacement |
|---|---|
| win feature | play feature |
| pay out | win / won |
| paid out | win |
| stake | play amount |
| pays out | won |
| betting | play / playing |
| total bet | total play |
| bet | play |
| bets | plays |
| cash | coins |
| payer | winner |
| pay | win |
| pays | wins |
| paid | won |
| money | coins |
| buy | play |
| bought | instantly triggered |
| purchase | play |
| at the cost of | for |
| rebet | respin |
| cost of | can be played for |
| credit | balance |
| buy bonus | get bonus |
| gamble | play |
| wager | play |
| deposit | get coins |
| withdraw | redeem |
| bonus buy | bonus / feature |
| be awarded to player's accounts | appear in player's accounts |
| bet/s | play/s |
| currency | token |
| fund | balance |
| place your bets | come and play / join in the game |
