---
name: rtb-audio-lab
description: Measure and SEE Ride The Bus's audio instead of guessing at it - capture the real Web Audio graph's output from the running game and render it as a WAV, a spectrogram, a waveform and a metrics table. Use for any change to audioGraph.ts, music.ts or sound.ts, and whenever a judgement is being made about how the game sounds.
---

# Hearing the game by looking at it

**I cannot hear. I can measure, and I can look at a picture.** Before this
existed, every audio judgement in this repo was made by reading source, and
`sound.test.ts` says so in its own header: it pins *what gets scheduled*, and
"says nothing about whether the result sounds good. That judgement needs ears."

This closes most of that gap. It does not replace a listen on real speakers —
it replaces *guessing*.

## Run it

From `web-sdk/apps/Ride-The-Bus/`, with the dev server up:

```
npm run audio                                    # 18s of the board
npm run audio -- --scene lobby --seconds 12      # the start screen instead
npm run audio -- --seconds 30 --out bed-long
npm run audio -- --params "dev_music=<id>"       # a benched take, once copied in
npm run audio -- --params "dev_loop=40,70,4" --seconds 40 # make the seam happen
npm run audio -- --scene loading --autoplay --seconds 8   # the loader, untouched
```

Writes to the repo-root `scripts/.shots/audio/`:

| File | What it is for |
|---|---|
| `<name>.wav` | 48 kHz mono, real samples. Playable, and readable by any analyser |
| `<name>-spectrogram.png` | **Look at this first.** Log frequency 0–12 kHz, time left to right |
| `<name>-waveform.png` | Level over time — swells, pulsing, dead air |
| `<name>-metrics.json` | The numbers below |

Shots are a working surface, not an archive: the directory is git-ignored and
every run overwrites. Re-capture after a change rather than reasoning about a
stale image.

## How the capture works, and why it is trustworthy

`AudioNode.prototype.connect` is patched **before any page script runs** (CDP
`Page.addScriptToEvaluateOnNewDocument`), so anything connecting to
`ctx.destination` is also connected to a `ScriptProcessorNode` that copies raw
samples out. What is captured is therefore the real graph — the real limiter,
the real generated impulse response, the real per-trigger jitter — not a
re-implementation that could drift from it.

The scene is reached by **playing to it** (`lobby` = start screen, `table` =
click through to the board) rather than by calling `music.setScene`, so what is
captured is what the game actually puts there.

**No new dependency**, which matters because `bundleStrategy: "inline"` makes
anything Vite processes expensive. Playwright's bundled ffmpeg is no help here —
it muxes only `image2` and `webm`, and has neither `showspectrumpic` nor
`showwavespic` — so the tool writes its own WAV header and its own PNG encoder
over Node's built-in `zlib`. Chromium comes from the same on-disk Playwright
install `shoot.mjs` uses.

## Reading the output

`metrics.json` carries peak/RMS/crest in dBFS, `movementDb` (the spread between
the 10th and 90th percentile of 400 ms RMS windows — how much the level actually
travels), `centroidHz` (brightness), `flatness` (0 = pure tone, 1 = white noise)
and an eight-band energy split.

Rules of thumb for this game:

- **`flatness` separates the two sources.** The cue book is largely filtered
  noise — card flips, chips — so a capture of a round sits high (~0.09). A
  tonal, well-produced music track pulls it down. A number that surprises you is
  usually telling you which of the two is dominating the capture.
- **Check the top half of the spectrogram.** If it is black, there is no air
  above ~1–2 kHz, and on laptop speakers — which roll off below ~200 Hz — a
  player may hear very little of what is there at all.
- **`peakDb: null` means literally zero samples.** With no track in `static/`
  that is the correct reading for an idle board, not a broken capture.

## What there is to measure

The game makes two kinds of sound, and they are measured differently.

**The cue book** (`sound.ts`) is synthesised, and it is what a capture of a
played round is mostly showing you: presses, card flips, stage wins, bust,
forgiveness and the win fanfares.

**The music bed** (`music.ts`) is one produced file fetched from `static/music/`.
Exactly one file sits there — `A.mp3`, which `ACTIVE_TRACK_ID` in
`musicTracks.ts` names — and it is paid-tier Suno output cleared to ship
(`ASSET_LICENCES.md`), so it is committed and a fresh clone captures it. The nine
other takes from the same session are benched in the repo-root `audio-masters/`
and are gitignored; copy one into `static/music/`, add its manifest entry from
the table in `rtb-invariants/references/audio-and-jurisdiction.md`, and
`?dev_music=<id>` will audition it. **Move it back out afterwards** — `static/`
is copied wholesale into the build. A build without any bed is still a supported
state: the loader fails soft and an idle capture comes back as literal silence
(`peakDb: null`).

**The current board reference**, for comparing a capture against: centroid
1638–1673 Hz, 0.4% of energy above 2 kHz, peak −17.0 dBFS, RMS −33.6, crest
16.6 dB, 14 dB of movement, nothing clipped.

### Driving the bed from the address bar

`--params` appends query parameters to whichever URL the lab builds, which is
the only way to reach the bed's dev overrides:

```
npm run audio -- --params "dev_music=<id>" --play             # a benched take
npm run audio -- --params "dev_loop=40,70,4" --seconds 40    # a seam every 26s
npm run audio -- --params "dev_loop=40,70,0" --seconds 40    # the hard wrap
```

`?dev_loop=<start>,<end>,<crossfade>` is what makes the seam observable at all.
The shipping region wraps every 154s and the benched takes run 3.5–5.5 minutes,
so without it a capture would have to run that long to catch one wrap. Shorten the region and the same seam, on the
same file, through the same graph, happens every 26 seconds.

### Capturing the screens that have nothing to press

`--scene loading` captures the loader itself: it does not wait for
`.ss-continue` and it dispatches no gesture, because the whole question about
that screen is whether the bed plays with nothing pressed. It polls for the tap
to appear and prints whether the loader was still up when recording began — a bed
measured after the loader has gone is a different measurement.

`--autoplay` adds Chrome's `--autoplay-policy=no-user-gesture-required`,
simulating an embedder that granted autoplay, which Stake's iframe may. Pair the
two: without `--autoplay` the loading screen is correctly silent and the run
reports NO TAP, which is the answer rather than a tool failure.

The default is still no autoplay override, and that matters — forcing 'running'
skips `ctx.resume().then(announce)` entirely, which is what once made this tool
report the lobby bed as dead.

### Reference points, measured 2026-08-31

```
no track at all       peak null       (zero samples - the fail-soft state)
loading, --autoplay   peak -19.8 dBFS  rms -34.4  centroid 1366 Hz  clipped 0
loading, strict       NO TAP - correctly silent, nothing has been pressed
start screen, 1 tap   peak -19.1 dBFS  rms -33.6  clipped 0
idle board + bed      peak -15.5 dBFS  rms -30.8  centroid 1268 Hz
                      flatness 0.068   movement 9.3   clipped 0
played round + bed    peak -10.8 dBFS  rms -34.7  centroid 1420 Hz
                      flatness 0.077   movement 19.4  clipped 0
```

The two loading-screen rows are the pair that matters: the same screen is audible
or silent purely on whether the embedder granted autoplay, and both are correct.

Against the old no-bed round (peak −12.1, rms −36.1): the bed adds about 1.3 dB
of peak and still clips nothing. The band split is the thing to watch on these
candidates — **0.1% of the energy sits above 2 kHz**. That is the dark late-night
brief working as intended, and it is also close to the edge of a track that
laptop speakers cannot carry.

### The scene ladder, measured under a real round

The bed cannot be isolated from the cues in a capture, but it IS the floor
between them: a 20th percentile of 100 ms RMS over a rolling 1.5 s tracks the bed
and ignores the cue book. Under a played round that floor reads

```
idle, before the round      ~ -31 dB
during the round            ~ -44 dB
at the win                  ~ -53 dB
```

which is more separation than `SCENE_MIX` alone asks for (−3.7 dB and −11.4 dB),
because the shared limiter ducks the bed further whenever the cues push it. That
is the design working, not an error — but it means **the gains are not the whole
mix**, and re-tuning one by reading the table is a mistake.

### Checking the seam

Level, not clicks. An equal-power cross-fade holds the level flat through the
overlap; a linear one dips ~3 dB in the middle. Measured on `dev_loop=40,70,4`:

```
before the seam  -32.1 dB
DURING           -30.4 dB     <- a linear pair would read ~-35
after            -30.6 dB
```

A splice is a **single-sample step**, so look for max `|x[i] − x[i−1]|` per 10 ms
window against the file's own distribution — not high-frequency energy, which on
a track with 0.1% above 2 kHz tells you nothing. Neither the cross-faded seam nor
a hard wrap at the same point reached even the 99.9th percentile of the music's
own slew rate, so **the argument for the cross-fade is not a click**: it is that
every candidate ends with 12–17 seconds of decay to silence, and a wrap plays
that decay into a cold entry forever.

### Watch these on any bed change

- **`clipped` must stay 0.** A mastered file over the cue book is the most likely
  thing ever to reach the limiter — the bed and the fanfares share one, by
  design, so that a win ducks the music rather than clipping against it.
- **Capture a round (`--play`), not just the board.** The bed-versus-fanfare
  collision is the case that actually bites, and an idle capture cannot show it.
- **Level against the cues.** The bed should sit clearly under `playCardFlip` and
  the fanfares. `SCENE_MIX` in `music.ts` was set by ear against one track and is
  expected to move; `MusicTrack.trim` is what keeps the others lined up with it.

`centroidHz` and the band split are the pair for judging whether a track
survives laptop speakers, which roll off below ~200 Hz: a track with most of its
energy under 250 Hz will be nearly inaudible on them however good it sounds on
headphones.


## Measuring a click: two ways to get it wrong

Both apply to any source, and a produced track with a bad loop seam is exactly
the case to reach for them.

1. **A dB ratio of a rise is not a click detector.** It measures contrast, not
   loudness: a quiet tick over quiet material scores the same as a loud clap
   over loud material. Quieten whatever is underneath and the score goes *up*,
   so removing the suspect reads as making things worse.
2. **Never measure in windows shorter than the lowest cycle present.** One cycle
   of a 65 Hz tone is 15.4 ms, so a 5 ms window sees a third of it and its RMS
   swings with **waveform phase** — which reports steady low tones as the
   clickiest thing in the capture.

**High-pass first.** Clicks are broadband and fast; low content is neither, so
filtering above ~2 kHz before looking removes the artefact entirely. Then
sanity-check any surviving event's *absolute* level against the rest of the mix
before believing it matters — an event 12 dB down is loud against the
high-frequency floor and inaudible in context.


## What it still cannot tell you

Timbre quality, whether a track is any good, and whether the game sounds like a
card room. It measures level, spectrum and movement. A human listen on real
speakers is still the last step before shipping, and stereo is summed to mono in
the capture, so width is not measured at all.
