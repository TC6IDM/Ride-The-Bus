# Stake Engine Casino Game Development Contract

You are helping build a casino game for Stake Engine. Treat this document as a development, QA, math-integrity, UX, and submission contract. Do not claim that any change guarantees a 2-star or 3-star quality ranking: Stake’s public materials describe quality ranking and visibility, but do not publish a deterministic scoring formula. Optimize for approval readiness, player clarity, technical reliability, mathematical integrity, and a polished, distinctive experience.

## 1. Source-of-truth policy

Use official Stake Engine documentation as the authority for platform behavior and file formats. When a requirement is unclear or appears to have changed, identify the uncertainty and ask for the relevant current dashboard/documentation detail instead of inventing an answer.

Primary references:

- [Stake Engine approval guidelines](https://stake-engine.com/docs/approval-guidelines)
- [Submission checklist](https://stake-engine.com/docs/approval-guidelines/submission-checklist)
- [General game disclaimer](https://stake-engine.com/docs/approval-guidelines/general-disclaimer)
- [Stake Development Kit](https://stakeengine.github.io/math-sdk/)
- [Quickstart and simulation workflow](https://stakeengine.github.io/math-sdk/math_docs/quickstart/)
- [Required math file format](https://stakeengine.github.io/math-sdk/rgs_docs/data_format/)
- [RGS technical details](https://stakeengine.github.io/math-sdk/rgs_docs/RGS/)
- [Recommended game structure](https://stakeengine.github.io/math-sdk/math_docs/overview_section/game_struct/)
- [Frontend SDK](https://stakeengine.github.io/math-sdk/fe_home/)
- [BetMode configuration](https://stakeengine.github.io/math-sdk/math_docs/gamestate_section/configuration_section/betmode_overview/)

When reporting completion, distinguish:

- **Hard requirement:** explicitly required by the docs or enforced by the RGS.
- **Strong recommendation:** documented guidance or a defensible quality practice.
- **Product hypothesis:** an idea intended to improve player appeal, retention, or visibility that must be validated through playtesting and analytics.

Never present a product hypothesis as an official Stake requirement.

## 2. Non-negotiable math and integrity rules

- Keep the authoritative outcome and payout on the RGS/static math side. The frontend must render the returned result and must never decide, alter, predict, or silently repair a payout.
- Use static, publishable game files. All possible outcomes must be represented in the compressed game books and mapped through the lookup table.
- For every mode, produce the required `index.json`, a zStandard-compressed JSON-lines events file, and a CSV lookup table.
- `index.json` must contain `modes`; each mode must include `name`, `cost`, `events`, and `weights` with correct filenames.
- Every game-logic record must contain `id`, `events`, and `payoutMultiplier`.
- The lookup-table payout multiplier must exactly match the corresponding game-logic payout multiplier. Validate this mechanically before submission; do not rely on visual inspection.
- Treat payout and probability values as non-negative integer data in the required format. Avoid floating-point ambiguity in serialized outputs.
- Make simulation IDs unique and stable within each mode, and ensure every lookup row resolves to exactly one logic record.
- Never add frontend randomness after the `/play` response. Given the same response, rendering and replay must be deterministic.
- Never use hidden odds changes, outcome manipulation based on player history, loss-chasing mechanics, misleading near-misses, or UI behavior that obscures the actual wager or payout.
- Display the actual rules, paytable, RTP/expected return where required, relevant volatility or hit-frequency information, maximum win/cap, feature costs, and material conditions clearly and consistently.
- If a mechanic is not mathematically represented in the published math files, it is not implemented. Update math, event schema, frontend, and tests together.

## 3. Math-development workflow

Follow this order:

1. Write a concise game specification: board/reels, symbols, pay rules, wilds/scatters, features, modes, bet costs, RTP targets, volatility target, hit rate, maximum win, and jurisdiction-dependent behavior.
2. Implement the smallest playable math slice first.
3. Run a small number of uncompressed simulations with one thread for debugging. Inspect the JSON events and lookup rows manually.
4. Add deterministic unit tests for every win type, feature trigger, retrigger, zero-win result, maximum-win result, interrupted round, and invalid configuration.
5. Run large simulations for every mode. Use at least 100,000 simulations per mode for production diversity unless current Stake guidance requires more.
6. Run optimization only after raw event correctness is established. Never use optimization to conceal incorrect win logic.
7. Run analysis and generate a PAR/statistics report. Review RTP contribution by feature, hit rate, win-size distribution, free-game contribution, maximum-win frequency, and dead-spin frequency.
8. Generate compressed publication files and run a clean-room verifier that reads only the output bundle.
9. Test the exact uploaded bundle in the Stake Engine dashboard, including resume/reload and mobile behavior.

Required math assertions:

- `sum(probability weights)` is valid for the selected format and uses no accidental zero/negative weights.
- Every weighted simulation exists in the events book.
- Every events-book simulation exists in the lookup table.
- Every lookup payout equals the events-book payout exactly.
- RTP is within the declared tolerance of the target after optimization.
- Mode cost multipliers, feature costs, and payout caps agree across config, math, frontend, and displayed rules.
- No simulation emits malformed, contradictory, missing, or unreachable events.
- Replaying a saved result produces the same visual state and final payout.

## 4. Quality target: 3-star-ready, without guessing the rubric

Build toward the following observable quality attributes. These are quality targets, not a published guarantee or official numeric rubric.

### Distinctive product

- The game has one clear hook that can be explained in one sentence.
- The hook materially affects decisions, anticipation, or progression rather than being cosmetic only.
- The theme, symbols, animation language, sound, and feature names are coherent and original.
- Avoid cloning Stake Originals or another provider’s identifiable presentation, wording, art, or mechanic combination.

### Excellent first session

- A new player understands the wager, spin/start control, result, win amount, and feature state immediately.
- The first interaction is fast, readable, and does not force unnecessary dialogs.
- Wins and losses are visually distinct, but the UI never exaggerates a small win as if it were a major profit.
- The player can inspect rules/paytable/RTP and understand how every major feature works.
- Loading, first render, and first spin are quick on ordinary mobile hardware.

### Durable play loop

- The base game is understandable without a tutorial wall.
- Feature entry and progression are legible; counters, multipliers, collections, and retriggers cannot be missed.
- The game has meaningful pacing: spins do not feel sluggish, animations can be skipped or sped up where allowed, and no animation blocks the next valid action unnecessarily.
- Auto-play/turbo behavior, if supported by the platform and jurisdiction, remains transparent and respects operator flags.
- High volatility is communicated honestly; the game does not imply that past outcomes influence future outcomes.

### Reliability and polish

- No console errors, uncaught promise rejections, broken assets, layout overflow, inaccessible controls, or stuck rounds.
- Works on desktop and narrow mobile layouts; test touch targets, orientation changes, reduced-motion preferences, and slow connections.
- Refresh/disconnect/reconnect resumes or safely completes an in-progress round according to RGS rules.
- All UI states have a defined result: loading, authenticated, insufficient balance, invalid bet, play pending, result received, feature active, end-round, timeout, maintenance, and generic server error.
- The game never double-submits a bet and clearly disables or debounces controls while a request is pending.
- Use only allowed static assets and dependencies. Do not fetch remote scripts, fonts, images, analytics, or APIs from the game build unless Stake explicitly permits them. Keep the build compatible with the platform’s strict static/XSS constraints.

## 5. RGS and wallet integration

- Read `sessionID`, `lang`, `device`, and `rgs_url` from the launch context as specified. Never hardcode `rgs_url`.
- Authenticate before wallet operations and handle invalid sessions, expired tokens, insufficient balance, gambling limits, location restrictions, maintenance, and server errors with clear recovery behavior.
- Use integer monetary units with six-decimal precision as required by the RGS. Never use display-formatted decimal strings as the authoritative wager.
- Read `minBet`, `maxBet`, `stepBet`, `defaultBetLevel`, and `betLevels` from wallet authentication. Do not hardcode operator limits.
- Validate that the requested amount is within limits and divisible by `stepBet` before play.
- Apply `base bet × mode cost multiplier` exactly once. Show the player the effective cost before any purchased or alternate feature is started.
- Use the correct play, event, balance, and end-round lifecycle. Preserve an active round after interruption and do not locally settle a payout.
- Keep request IDs/state transitions observable in development logs, but remove sensitive session data and verbose debug output from production.

## 6. Frontend implementation rules

- Keep math event names and payload schemas in one typed/shared contract. Reject unknown event types in development rather than silently ignoring them.
- Render from event order. Do not infer wins from board appearance when the event payload supplies authoritative win positions and amounts.
- Keep currency formatting separate from integer wallet arithmetic.
- Make paytable and rules usable on mobile, keyboard, and screen readers where practical: meaningful labels, focus order, contrast, no color-only meaning, and readable text.
- Localize visible strings using the supplied language context. Do not concatenate unescaped user or server-controlled strings into HTML.
- Use an explicit state machine for authentication, idle, betting, animation, feature, completion, and recovery. Prevent impossible transitions and duplicate completion calls.
- Add an internal debug/replay mode that can render a saved simulation without changing production outcomes. Remove test controls and forced outcomes from the release build.
- Add feature flags only when they are deterministic, documented, and not capable of changing the settled payout.

## 7. Testing and release gates

Before asking for approval, produce evidence for all of the following:

- Unit-test report for paytable, reels/board, wins, scatters, wilds, cascades, free games, retriggers, buy features, caps, and edge cases.
- Math verification report comparing every events-book payout to every lookup-table payout.
- PAR report for each mode: target RTP, measured RTP, base/feature RTP contribution, hit rate, average win, volatility proxy, feature frequency, maximum win, and relevant win bands.
- Deterministic replay test: same saved event response gives identical final UI and payout display across repeated runs.
- RGS integration test for successful play, insufficient funds, invalid bet, invalid session, timeout, location/limit rejection, disconnect, refresh, resume, and end-round.
- Browser/device matrix covering current desktop browsers and a narrow mobile viewport with touch input.
- Performance check covering bundle size, initial load, memory growth over many spins, animation frame rate, and asset failures.
- Accessibility and usability review of betting controls, rules, paytable, balance, win display, errors, and feature status.
- Clean production build scan: no secrets, test URLs, hardcoded session/rgs values, forced outcomes, debug buttons, remote dependencies, or console errors.
- Manual playtest with people unfamiliar with the game. Record confusion points, time to first spin, feature comprehension, and any misleading presentation.

Do not submit if any release gate fails. Report the exact failure, likely cause, and smallest safe fix.

## 8. Responsible design and compliance

- Include a clear game-information disclaimer conveying that outcomes and payouts are determined by the Remote Game Server, expected return is calculated over many plays, the display is illustrative, a stable connection is required, and interrupted rounds should be reloaded. Use the current Stake-approved wording where applicable.
- Do not imply guaranteed profit, skill-based control over random outcomes, “due” wins, hot/cold streaks, or a way to beat the house edge.
- Do not use dark patterns to increase wager size, hide the cost of features, pressure a player after losses, or obscure responsible-gambling controls.
- Respect jurisdiction configuration such as disabled fullscreen, disabled turbo, limits, and social-casino behavior. Never override operator-provided restrictions.
- Obtain clarification from Stake for any regulated-content, advertising, responsible-gambling, jurisdiction, or exclusivity question rather than making an assumption.

## 9. Claude operating procedure

For every coding task:

1. Inspect the existing repository and identify the relevant math, event, frontend, config, and test files before editing.
2. State which requirement or product goal the change addresses.
3. Make the smallest coherent change across all affected layers.
4. Add or update tests before declaring success.
5. Run the narrowest relevant tests, then the full verification suite when practical.
6. Check generated artifacts, not merely source code.
7. Report changed files, commands run, results, remaining risks, and any requirement that needs Stake confirmation.

For every design or math proposal:

- Give the player-facing behavior, exact math effect, event schema, expected RTP/volatility impact, and test plan.
- Flag anything that could affect fairness, payout integrity, jurisdiction, wallet lifecycle, or approval.
- Prefer transparent, replayable, deterministic mechanics over engagement tricks.
- Never optimize only for session length or revenue. Optimize for a game players can understand, trust, and choose to replay.

## 10. Final submission checklist

- [ ] Game hook and rules are documented and easy to explain.
- [ ] Math, frontend, events, configs, and displayed rules agree.
- [ ] Small uncompressed simulations were inspected.
- [ ] Production-scale simulations and optimization completed.
- [ ] PAR/statistics report reviewed against targets.
- [ ] `index.json`, `.jsonl.zst`, and CSV files validate and cross-match.
- [ ] RGS/wallet lifecycle and interruption recovery pass.
- [ ] No hardcoded session, RGS URL, wallet limits, or mode names.
- [ ] No client-side payout authority or post-response randomness.
- [ ] Mobile, performance, accessibility, localization, and error states pass.
- [ ] Static/XSS/dependency/security scan passes.
- [ ] Disclaimer, rules, RTP/expected-return information, and responsible design pass review.
- [ ] Production build contains no forced outcomes or debug controls.
- [ ] Approval submission includes clear test instructions, demo credentials/links if required, known limitations, and evidence from the release gates.
- [ ] Any claimed Stake-specific requirement is linked to current official documentation.

