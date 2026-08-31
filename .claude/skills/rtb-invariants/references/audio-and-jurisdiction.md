# Audio and the jurisdiction block

The audio graph and the operator jurisdiction flags.

Moved out of CLAUDE.md so it is loaded on demand rather than on every turn.

The jurisdiction half is the original text, verbatim. The audio half has been
rewritten as the audio changed.

---

- **Every cue is synthesised. The music bed is one produced file.**
  `audioGraph.ts` owns one `AudioContext`, one bus chain with a limiter on the
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
  - **The candidates are a MANIFEST, not a constant.** `musicTracks.ts` maps ids
    onto the files in `static/music/`; `ACTIVE_TRACK_ID` is the one line that
    changes which plays, and `?dev_music=<id>` auditions one without a restart.
    The tracks keep the filenames they arrived with — spaces and brackets and
    all — because `ASSET_LICENCES.md` is keyed by filename, so `trackPath()`
    encodes rather than the caller.
    - **`trim` is a level match, not a volume control.** Every scene level is
      calibrated against ONE track. Without a per-track correction, switching
      candidates changes how loud the game is, and the next thing anyone does is
      re-tune the scene levels — which breaks the track before it.
    - **EVERY FILE IN `static/music/` SHIPS.** `static/` is copied wholesale into
      the build and nothing prunes it by what is referenced, so four candidates
      is four candidates of payload to deliver one. `musicTracks.test.ts` holds
      the ceiling; `ASSET_LICENCES.md` holds the prune step.
    - **Provenance is a test, not a convention.** Every audio file present in
      `static/music/` must have a row in `ASSET_LICENCES.md`. The `.gitignore`
      there ignores audio by default and un-ignores the four placeholders by
      name, so a fifth candidate stays invisible to git until someone writes its
      row.
  - **The loader fails soft, and downloads nothing for a player who cannot hear
    it.** The silence gate comes before the fetch — "muted costs nothing" is a
    bandwidth claim as much as a CPU one. A 404 or a bad decode falls back to no
    music silently, because console errors are a Stake build failure, and
    `failed` is terminal so a missing file cannot become unbounded retries.
  - **THE LOOP IS OVERLAPPING PASSES, NOT `src.loop = true`.** A wrapping source
    is seamless only for a file authored to be, and a produced track is not one:
    all four candidates measure 12–17 seconds of outro decaying to digital
    silence, so a hard wrap plays that decay into a cold entry forever. Each pass
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
