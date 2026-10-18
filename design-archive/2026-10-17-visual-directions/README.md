# Animation plans

Written by `improve-animations` on 2026-10-16 (commit 619403e8), during Phase 1
of the visual iteration (items A–F plus G). Each plan is self-contained. Two of
them are baselines that a Phase 2 design direction may replace. Check their
Status line before running them.

| # | Plan | Severity | Status | Note |
|---|---|---|---|---|
| 001 | [Re-balance the deal](001-deal-rebalance.md) | HIGH | TODO | The owner's touch-up 6; needs `npm run audio` |
| 002 | [Give the intro an exit](002-intro-exit.md) | HIGH | TODO | A baseline; item C's chosen direction replaces it |
| 003 | [Stop the loader's cards breathing](003-loader-stop-breathing.md) | MEDIUM | TODO | A baseline; item A's rebuild absorbs it |

## Recommended order

1. **001** stands alone. It is a touch-up in the Phase 3 plan and touches only the
   deal and `playDeal`.
2. **002 and 003** wait for the owner's Phase 2 picks for items C and A. Run them
   only if those items are deferred, as a stopgap.

## Dependencies

- 001 changes `playDeal` timing. Any later change to the deal (item C's "loader
  deals onto the table") reuses `dealFromDeck`'s measured-at-rest helpers, so it
  should land after 001.
- None of the three touches the payout maths, `FAMILY_RULES` or anything
  money-facing.
