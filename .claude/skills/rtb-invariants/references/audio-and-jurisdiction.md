# Audio and the jurisdiction block

The synthesised audio graph and the operator jurisdiction flags.

Moved verbatim out of CLAUDE.md so it is loaded on demand
rather than on every turn. Nothing here is reworded.

---

- **The audio is synthesised, and there are no audio assets.** `audioGraph.ts`
  owns one `AudioContext`, one bus chain with a limiter on the end, and a
  generated impulse response for the room; `sound.ts` is the cue book;
  `music.ts` is the bed. **One context, deliberately** — music and cues share
  the bus, because a second context is a second limiter that cannot see the
  first, so a fanfare and a bed would each stay clean on their own meter and
  clip against each other on the speakers. Browsers also cap contexts per page.
  Nothing is downloaded: `bundleStrategy: "inline"` would base64 any Vite-processed
  asset straight into `index.html`, which makes shipped audio disproportionately
  expensive. If produced audio is ever commissioned it goes in `static/` behind
  `${base}/…`, and only the bodies of `sound.ts`'s `play*` functions change —
  `Game.svelte` touches nothing but that module's public API.
  - **Muting returns before anything is scheduled**, rather than turning a gain
    to zero, so a muted game builds no nodes at all. `sound.test.ts` pins that,
    because it is a CPU claim as much as an audio one.
  - **Two buses with `volume` and `muted` kept separate**, never collapsed into
    "volume 0 means muted". That is what lets the speaker button and the slider
    agree: the button toggles `muted` and leaves `volume` where it was, and
    `setBusMuted` restores `lastAudible` when un-muting a bus parked at zero —
    without which a slider dragged to 0 becomes a dead end with no way back up.
  - **The bed has no foreground, and that took three attempts to accept.** A
    sparkle and then a plucked arpeggio were both built and both removed:
    anything with an attack and a pitch stops being background the moment the
    player notices it once. Movement comes from re-voiced pad chords and from
    room noise (chips settling, cards on felt) — never from another melodic
    layer. Every cue is jittered per trigger, and every noise burst is a fresh
    buffer, so four card flips in a round are not one sample four times.
- **The jurisdiction block is the operator's, and every read must survive it
  being absent.** `Authenticate.svelte` assigns
  `stateConfig.jurisdiction = authenticateData?.config?.jurisdiction`
  *unconditionally*, so a response without the block replaces the defaults
  object with `undefined` and a bare property access throws. Every read goes
  through `readFlag` in `jurisdictionRules.ts` (pure, unit-tested), and **the
  fallback is always the permissive value** — a missing block never disables the
  game, and never enables a restriction the regulator did not ask for.
  `jurisdiction.svelte.ts` only wires that to `stateConfig`.
  - Consumed: `disabledTurbo`, `disabledSuperTurbo` (caps the slider at
    `TURBO_CAP_WITHOUT_SUPER` and relabels its end "Fast" rather than
    "Instant"), `disabledAutoplay`, `disabledSpacebar`, `disabledSlamstop`,
    `minimumRoundDuration` (gates the NEXT play rather than slowing the current
    animation), the three responsible-gambling readouts, and `socialCasino`.
    `disabledFullscreen` and `disabledBuyFeature` are declared and unconsumed
    because this game has neither control — that is correct, not a gap.
  - **Social mode is read from BOTH signals.** `?social=true` is the documented
    one, and the jurisdiction block's `socialCasino` is the same fact by the
    other route. `isSocialMode()` in `i18nDerived.ts` ORs them, and
    `+layout.svelte` uses the same predicate to force English. The redundancy is
    deliberate and one-directional: the cost of missing it is showing US players
    the restricted gambling terms `socialMessages.ts` exists to remove.
  - `devOverrides.ts` drives all of it from the address bar
    (`?dev_disabledTurbo=1`, `?dev_displayRTP=1`, `?dev_minimumRoundDuration=2500`,
    `?dev_minBet=1&dev_maxBet=100`), because localhost has no
    `/wallet/authenticate` and none of this behaviour can otherwise be seen. It
    is behind an `import.meta.env.DEV` literal, so Vite drops the module from a
    production build.

---
