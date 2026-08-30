# Bet modes, ceilings and the volatility meters

The 192 published modes, the two different ceiling figures and why both are
needed, the `?lang=` resolver, the mode-slug restore sites, and the two
volatility ratings the bar draws.

Moved verbatim out of CLAUDE.md so it is loaded on demand
rather than on every turn. Nothing here is reworded.

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
  Stakes' real 1910.2 max. The family also drives the MODE button, the bolts,
  the rules popup and the printed retention rule. `modes.test.ts` greps both
  call sites, because the failure is silent and has now happened twice.
- The volatility rating (`game/volatility.ts`) is a **ranking of published
  figures, not a marketing claim**. `volatility.test.ts` re-derives it from
  `math-sdk/.../library/stats_summary.json` and fails if the bolts disagree.
  Both rules it encodes hold in their *strict* form, not on average:
  - `sc < base < hs` for every one of the 64 guess combinations individually.
  - Grouping a family's 64 modes by Equal-pick count gives three bands with
    **no overlap at all** — the calmest 1-Equal mode is wilder than the wildest
    0-Equal mode, in every family. That is what licenses "one bolt per Equal".
- **One ruler.** Every meter draws `VOLATILITY_BOLTS` (7) stops. The mode picker
  lights the family's own rating (1/3/5); the bet display adds one per Equal
  pick. A second meter counting to a different maximum would be bug class 1.
- **The bar is coloured by the rating, not by the accent** — and by *two*
  ratings, which are different numbers and must not be collapsed:
  - `--mode-ink` / `--mode-rgb` — the **live** rating (family + one stop per
    Equal pick), worn by the mode name, the `+/−` steppers and the bet button:
    green / yellow / red, and `--vol-overflow-ink` purple once the guesses pass
    `FAMILY_BOLT_CEILING`. In practice that is **High Stakes with one or two
    Equals and nothing else**, because the families sit at 1/3/5 against a
    ceiling of 5; `volatility.test.ts` asserts `hs` is the only family any guess
    combination can push over.
  - `--vol-color` / `--vol-rgb` — the **family's own** rating, worn by the MODE
    button and the mode picker. Never purple: the Equal picks that overflow a
    ceiling are a property of the bet, not of the mode being chosen.

  All four are published on the `<footer class="control-bar">`, not on a panel
  inside it. They have to reach three groups sitting in different panels — the
  bet display, its sibling steppers, and the MODE button over in the light pill
  — so the bar is the nearest element that can carry them.
