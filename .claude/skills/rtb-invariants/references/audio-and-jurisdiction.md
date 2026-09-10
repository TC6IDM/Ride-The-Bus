# Audio and the jurisdiction block

The audio graph and the operator jurisdiction flags.

Moved out of CLAUDE.md so it is loaded on demand rather than on every turn.

The jurisdiction half is the original text, verbatim. The audio half has been
rewritten as the audio changed.

---

- **Every cue is synthesised. The music bed is one produced file.**
  `audioContext.ts` owns one `AudioContext`, one bus chain with a limiter on the
  end, and a generated impulse response for the room; `sound.ts` is the cue
  book; `music.ts` is a loader and player for the bed. **One context,
  deliberately** — music and cues share the bus, because a second context is a
  second limiter that cannot see the first, so a fanfare and a bed would each
  stay clean on their own meter and clip against each other on the speakers.
  Browsers also cap contexts per page.
  - **The bed is fetched, never imported.** `bundleStrategy: "inline"` base64s
    any Vite-processed asset straight into `index.html` — at ~1.4× its real size,
    in the document that blocks first paint. So the tracks live in `static/` and
    load by URL, exactly as `logo.png` does. An `import bed from './bed.mp3'`
    silently undoes this and fails no test.
  - **The URL is INJECTED, not imported.** `${base}` comes from `$app/paths`, and
    a module reaching an `$app/*` virtual cannot be imported by a node test —
    `betLimits.test.ts` carries that scar. So `bedAsset.ts` owns the import,
    `Game.svelte` calls `music.setBed`, and `music.ts` stays testable. Left
    unset, the game is silent behind its cues — which is also exactly what a
    build shipped without the asset does.
  - **The manifest is a MANIFEST, not a constant — and it is down to one row.**
    `musicTracks.ts` maps ids onto the files in `static/music/`; `ACTIVE_TRACK_ID`
    is the one line that changes which plays, and `?dev_music=<id>` auditions one
    without a restart. The tracks keep the filenames they arrived with — spaces
    and brackets and all — because `ASSET_LICENCES.md` is keyed by filename, so
    `trackPath()` encodes rather than the caller. The shape survives a
    single-track manifest on purpose: it is what makes bringing a benched take
    back a file copy plus one entry.
    - **`trim` is a level match, not a volume control.** Every scene level is
      calibrated against ONE track. Without a per-track correction, switching
      candidates changes how loud the game is, and the next thing anyone does is
      re-tune the scene levels — which breaks the track before it.
    - **EVERY FILE IN `static/music/` SHIPS.** `static/` is copied wholesale into
      the build and nothing prunes it by what is referenced, so a candidate left
      behind after an audition is payload for every player who never hears it.
      That is why the nine benched takes had to leave the DIRECTORY and not
      merely the manifest. `musicTracks.test.ts` holds the ceiling — 9 MB again,
      down from the 56 MB the ten-track audition needed; `ASSET_LICENCES.md`
      holds the provenance.
    - **Provenance is a test, not a convention.** Every audio file present in
      `static/music/` must have a row in `ASSET_LICENCES.md`, and
      `musicTracks.test.ts` fails if one does not. Since the tracks became
      paid-tier they are committed normally, so that test — not the `.gitignore`
      — is what stops an unattributed file shipping.
  - **The loader fails soft, and downloads nothing for a player who cannot hear
    it.** The silence gate comes before the fetch — "muted costs nothing" is a
    bandwidth claim as much as a CPU one. A 404 or a bad decode falls back to no
    music silently, because console errors are a Stake build failure, and
    `failed` is terminal so a missing file cannot become unbounded retries.
  - **THE LOOP IS OVERLAPPING PASSES, NOT `src.loop = true`.** A wrapping source
    is seamless only for a file authored to be, and a produced track is not one.
    The four free-tier placeholders this replaced each measured 12–17 seconds of
    outro decaying to digital silence, so a hard wrap played that decay into a
    cold entry forever. The paid-tier set does not fade — "fade out" is in the
    exclude-styles field — which removes the worst case and not the problem: a
    hard wrap still cuts from an arbitrary bar to bar one. Each pass
    is a source of its own started `span − crossfade` after the last, so the tail
    of one plays over the head of the next and neither end is heard alone.
    - **The seams are EQUAL-POWER, where the arrival fade is linear.** They are
      different jobs. A seam balances two uncorrelated signals — two different
      bars of music — which sum as powers, so a linear pair sits 3 dB down in the
      middle and every loop point breathes. The arrival raises one signal out of
      silence, where a linear ramp is right because it has no knee.
    - **The region is trimmed to skip the outro**, per track, `loopStart`/
      `loopEnd` in the manifest, measured off a per-second RMS envelope rather
      than guessed. `loop()` clamps into the buffer and drops to the hard wrap
      when the region cannot hold two overlaps, because two colliding curves on
      one param throw.
    - **Passes are scheduled AHEAD OF THE CLOCK**, topped up on an interval. When
      the page hides the context suspends and `currentTime` stops, so the pump
      correctly schedules nothing.
    - **`?dev_loop=<start>,<end>,<crossfade>` exists because the seam is
      otherwise unobservable.** The real regions are 3.5–5.5 minutes, so
      `npm run audio` would have to capture that long to catch one wrap.
  - **`primeAudio` opens the graph as early as the browser allows, and music.ts
    still never opens one itself.** That rule is intact: this is the GAME asking
    for audio in `Game.svelte`, not the music module reaching for a context.
    - Two paths. Where autoplay is permitted — an `allow="autoplay"` iframe, or a
      returning player Chrome trusts — the graph is built on mount and the bed
      fades up under the loading screen. Where it is not, **nothing is built**
      and the first gesture anywhere opens it. Capture phase, so it lands before
      a button own handler and the music starts on that same tap.
    - **Permission is ASKED, in three steps, cheapest first.**
      `getAutoplayPolicy` (absent from Safari, and from the Chromium the audio
      lab runs — which is how the rest came to be needed), then
      `userActivation.hasBeenActive`, then **a throwaway context, built, read and
      closed**. The probe was avoided at first on the grounds that a blocked
      context logs "The AudioContext was not allowed to start" — a Stake build
      failure. That was then measured through CDP with `Log.enable` on: a context
      CONSTRUCTED and closed without ever being resumed or scheduled logs
      nothing. Chrome emits that warning on a refused `resume()`, not on birth.
    - A cold load in a strict embed is still silent until the player touches
      something. That is a browser rule, not a setting, and not worth chasing.
  - **TWO GAIN STAGES on a running loop.** `env` is the scene's level; each pass
    carries only its own cross-fade. Collapsed into one param, a scene change
    landing mid-seam cancels the fade holding two passes in balance and the seam
    jumps.
  - **THE SCENE LADDER IS A DIP, NOT A CLIMB.** Five scenes — `loading`, `lobby`,
    `idle`, `round`, `celebration` — and one file, so the only thing a scene can
    change is level. The bed is loudest at `idle`, the one moment it has the room
    to itself; it ducks for `round`, which is the busiest the cue book ever gets
    (four flips, three stage wins, the bust); and it ducks hardest and fastest for
    `celebration`, because the bed and the fanfares share one limiter and a bed
    mixed to sit on top of a win would duck the WIN. `music.test.ts` pins the
    ranking, not the values.
    - **The fade time belongs to the DESTINATION**, which makes ducks asymmetric
      without a second table: down fast into `celebration`'s 0.35 s, back up slow
      over `idle`'s 1.5 s.
    - **A celebration outranks a round in `Game.svelte`'s derivation**, because
      the round flow awaits the takeover's dismissal and is still "in progress"
      underneath it. Ordered the other way, a big win never ducks for its own
      fanfare.
    - **`loading` and `lobby` SOUND, and only because of `primeAudio`.** Before
      it, the cue book was the only thing that ever opened an `AudioContext` and
      those two screens have nothing to press, so both set a scene that could
      never be heard and the bed arrived with the tap that LEFT them.
  - **A scene change cross-fades the loop.** Every scene is the same file at a
    different level, so `settleBed` re-levels the running source rather than
    restarting it.
  - **The music bus carries a 48 Hz highpass and no EQ beyond it.** A produced
    track arrives balanced; anything shaping it here reads as a bad track rather
    than a bad EQ decision, so brightness belongs in the file. The highpass is
    generic protection — this bus shares a limiter with the cue book, so sub
    energy here steals headroom from every card flip.
  - **`playMusicTick` still uses the music bus and its reverb**, and must: the
    music slider has to preview the bus it controls. It is a UI cue, not music.
  - **Muting returns before anything is scheduled**, rather than turning a gain
    to zero, so a muted game builds no nodes at all. `sound.test.ts` pins that,
    because it is a CPU claim as much as an audio one.
  - **Two buses with `volume` and `muted` kept separate**, never collapsed into
    "volume 0 means muted". That is what lets the speaker button and the slider
    agree: the button toggles `muted` and leaves `volume` where it was, and
    `setBusMuted` restores `lastAudible` when un-muting a bus parked at zero —
    without which a slider dragged to 0 becomes a dead end with no way back up.
  - **Every cue is jittered per trigger, and every noise burst is a fresh
    buffer**, so four card flips in a round are not one sample four times. This
    is the cue book's, not the bed's — it is why the reveals do not machine-gun.
---

## The nine benched takes, and their measurements

Kept here because the numbers cost a measurement pass and the files do not.

Ten paid-tier takes were generated on 2026-09-02 and all ten sat in
`static/music/` while the choice was deferred. It is no longer deferred:
**`jazz-lounge-a1` (`A.mp3`) ships**, and the other nine were moved to the
repo-root `audio-masters/` as MP3s beside their WAV masters — out of the build,
not out of the project. `ASSET_LICENCES.md` carries a provenance row for each;
this table carries what `musicTracks.ts` would need to play one again.

**To re-audition one:** copy its MP3 from `audio-masters/` into `static/music/`,
paste its row back into `MUSIC_TRACKS` as an entry, restore its
`ASSET_LICENCES.md` row under "Shipping", and load `?dev_music=<id>`. Move the
file back out before staging — `static/` is copied wholesale into the build, and
`musicTracks.test.ts`'s 9 MB directory ceiling is the backstop, not the rule.

| id | file | length | loopStart | loopEnd | crossfade | trim | why it might win |
|---|---|---|---|---|---|---|---|
| `jazz-lounge-a1` | `A.mp3` | 162.2s | 0 | 160 | 6 | 0.88 | **SHIPPING**, chosen by ear. Centroid 2186 Hz — second brightest of the ten — but only 0.89% above 2 kHz. See the note under the table: the two brightness rankings disagree. |
| `jazz-lounge-a2` | `A (1).mp3` | 203.7s | 0 | 198 | 6 | 0.84 | Centroid 1821 Hz, 0.52% above 2 kHz. The same prompt as the shipping track, 41s longer. |
| `dusty-vamp-b1` | `B.mp3` | 153.1s | 0 | 148 | 6 | 0.92 | Darkest of the B/C/E group: 1320 Hz, 0.22% above 2 kHz. |
| `dusty-vamp-b2` | `B (1).mp3` | 479.4s | 0 | 479 | 6 | 0.93 | Level end to end. Centroid 1707 Hz, but 20.3% of its energy in 200 Hz–2 kHz — the band a laptop speaker actually reproduces. |
| `noir-triphop-c1` | `C.mp3` | 479.4s | 0 | 479 | 6 | 0.82 | The most UNIFORM of the ten — within 3 dB of its loudest quarter-second from 0.00s to 479.00s, which is what a 6s crossfade at an arbitrary seam wants. Scooped mid though: 12.8%. |
| `noir-triphop-c2` | `C (1).mp3` | 479.4s | 23 | 431 | 6 | 0.94 | The previous measurement-led pick, and best of the ten on the laptop test at 22.1% above 200 Hz. Its first 22s are 7–16 dB down, which is why the region starts at 23. |
| `tension-d1` | `D.mp3` | 146.8s | 8 | 143 | 6 | 0.71 | DARKEST of the ten — 790 Hz, 0.27% above 2 kHz, which is the failure mode `status.md` warns about. Quiet first 7.5s, skipped. |
| `tension-d2` | `D (1).mp3` | 183.7s | 0 | 176 | 6 | 0.82 | Second darkest: 772 Hz, 0.26% above 2 kHz. |
| `soul-groove-e1` | `E.mp3` | 479.4s | 0 | 479 | 6 | 0.84 | Level, easing slightly over its last 10s. Centroid 1976 Hz. |
| `soul-groove-e2` | `E (1).mp3` | 479.4s | 0 | 410 | 6 | 0.76 | Brightest of the ten at 3016 Hz, but only its first 410s hold level — the last 69s sit more than 6 dB down. |

`loopStart`/`loopEnd` come from a per-second RMS envelope — the region within
6 dB of the loudest second — cross-checked at 0.25s. Where the two passes
disagree the fine one wins at the HEAD (a quiet intro is replayed on every wrap)
and the coarse one at the TAIL (the crossfade covers a slightly softer ending).
`trim` is each file's body RMS against a −17.5 dBFS reference, measured over the
loop region rather than the whole file, so a switch does not change how loud the
game is.

**THE TWO BRIGHTNESS RANKINGS DISAGREE, and the column that matters is the
second one.** `jazz-lounge-a1` is second of the ten by centroid and eighth by
energy above 2 kHz; `noir-triphop-c2` is the reverse. A centroid rides up on
strong upper-mid content that never reaches 2 kHz, and it was the >2 kHz figure
that `status.md` flagged as the laptop-speaker risk. Measured on the board
(`npm run audio`, 18s, bed plus cue book through the real limiter) the shipping
bed reads **1638–1673 Hz and 0.4% above 2 kHz**, against 1716 Hz / 1.6% for
`noir-triphop-c2` and 1268 Hz / 0.1% for the free-tier set both replaced. Clear
of the floor, with less margin than the placeholder had.

**These are measurements, not judgements.** They rank the takes on brightness,
uniformity and span, and could not rank them on whether they suit the game —
which is why the shipping track was chosen by ear and why the losing nine were
benched rather than deleted.

**The shipping track has the shortest span of the ten.** A 160s region with a 6s
crossfade wraps every 154s, against 6:42 for `noir-triphop-c2` and 7:53 for the
three that loop end to end. The seam is therefore heard far more often than it
was under any earlier candidate, which makes it the thing to listen for on this
bed — `?dev_loop=` is how, without waiting two and a half minutes per pass.

---

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
