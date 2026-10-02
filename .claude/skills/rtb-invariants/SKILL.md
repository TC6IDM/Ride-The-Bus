---
name: rtb-invariants
description: The long-form reasoning behind Ride The Bus's design invariants - win takeover, bet modes and volatility, colour and menu tints, money fitting and the control bar, type and assets, audio and jurisdiction - plus current status and outstanding work. Use when changing those areas or when a CLAUDE.md one-liner needs its argument.
---

# Ride The Bus — the invariants in full

CLAUDE.md carries every invariant as a one-line **rule**. The argument behind
each one lives here, moved out verbatim so it is loaded when it is needed rather
than on every turn of every session.

This is the same move the repo already made once: Stake's approval guidelines
used to sit at the bottom of CLAUDE.md at 34 KB and became
`.claude/skills/stake-approval/`. The invariants had since grown to 45 KB —
61% of the file — and status to another 19 KB.

**Nothing here is reworded.** These files are the original text, split at its
existing bullet boundaries.

## Which file

| Read this | When you are touching |
|---|---|
| `references/win-celebration.md` | `WinCelebration.svelte`, `win-celebration.css`, `winTiers.ts`, anything about the five tiers, the fan, the burst or what the board hides |
| `references/modes-and-volatility.md` | `modes.ts`, `modeCeilings.ts`, `volatility.ts`, `BoltMeter`, the mode picker, `?lang=`, or any restore-from-slug path |
| `references/colour-and-menus.md` | `tokens.css`, `popups.css`, any panel tint, the bet chips, `ChoiceIcon`, or adding a colour anywhere |
| `references/currency-and-control-bar.md` | `control-bar.css`, `betLimits.ts`, `betChips.ts`, `typeFit.ts`, `currencies.ts`, `fitValue`, or any rule about locking / clamping / explaining a bet |
| `references/typography-and-assets.md` | fonts, `logoAsset.svelte.ts`, `SuitIcon`/`MarkIcon`, or anything shipped from `static/` |
| `references/audio-and-jurisdiction.md` | `audioGraph.ts`, `music.ts`, `sound.ts`, `jurisdictionRules.ts`, `devOverrides.ts` |
| `references/status.md` | planning: what is built, what is measured, what is still open, and the approval-checklist gaps |

## How to use it

Read the ONE file that covers the area you are changing. Do not read them all —
that would reproduce the cost this split exists to remove.

The rule in CLAUDE.md is authoritative and sufficient for *following* an
invariant. Come here when you need to know **why** — because the reason is
usually a defect that was already shipped once, and the note records what it
cost. Several of these say plainly that an alternative was tried and rejected;
that is the part worth reading before proposing it again.
