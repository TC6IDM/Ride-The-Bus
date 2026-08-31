---
name: stake-approval
description: Stake Engine submission and compliance reference for Ride The Bus: the approval checklist and PreChecks, RGS/wallet and frontend requirements, star tiers and risk limits (ETL/CVaR/std), math verification limits, bet replay spec, tile assets, the general disclaimer, and Stake.US restricted terms. Use for submission readiness, RGS_TEST_PLAN checks, compliance wording, promo blurb or replay URLs.
---

# Stake Engine approval & compliance

Reference material for submitting Ride The Bus. Split out of `CLAUDE.md` so it is
loaded on demand rather than on every turn — it is consulted a few times a week,
not every turn, and it was costing ~8.6K tokens per turn to keep resident.

**Read the relevant file below rather than answering from memory.** Every
Stake-specific claim in this repo traces to `references/approval-guidelines.md`.

## Which file to read

| Need | File |
|---|---|
| What Stake *requires* — checklist, PreChecks, star tiers, risk limits, replay spec, tile assets, disclaimer, restricted terms | `references/approval-guidelines.md` |
| How *we* work — math integrity rules, simulation workflow, release gates, testing evidence, operating procedure | `references/development-contract.md` |

## Standing cautions

- **`approval-guidelines.md` is verbatim capture, not paraphrase.** The live site
  is a client-rendered SPA that returns only a loading shell to a fetch, and the
  old `stakeengine.github.io/math-sdk` mirror 404s. No tool in this project can
  read it. Re-paste from the live site rather than guessing when something looks
  out of date — do not "correct" it from memory.
- **The math-SDK half of the docs IS readable locally**, at `math-sdk/docs/`
  (`rgs_docs/data_format.md`, `rgs_docs/RGS.md`, `math_docs/**`). Prefer those
  files over the web for file formats and RGS endpoints.
- **The binding risk tier is 2-star, not 3-star.** ETL 0.8 and CVaR 700. The
  0.9 / 800 figures that appear elsewhere are the 3-star tier. This project's
  build clears the 2-star limits (worst ETL 0.695, worst CVaR 568.8).
- **One star is not a publication.** A 1-star game is returned to the developer to
  resubmit. Any claim that 1 star ships at the bottom of New Releases is wrong.
- When reporting completion, keep the three categories distinct: **hard
  requirement** (enforced by docs or the RGS), **strong recommendation**
  (documented guidance), and **product hypothesis** (needs playtesting). Never
  present a hypothesis as an official Stake requirement.

## Live state

`RGS_TEST_PLAN.md` holds 95 live-session checks across 14 sections. As of the last
audit, **0 are ticked** — the whole plan is unrun. Sections 06 (Currency),
07 (Win presentation), 09 (Localisation), 11 (Devices) and 14 (Performance) are
mutually independent and can be worked in parallel against the local replay RGS.

The game is **not yet submitted**. Math, bet modes and mechanics all remain
changeable until the user says otherwise.
