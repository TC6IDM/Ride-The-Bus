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
npm run audio                                    # 18s of the board's bed
npm run audio -- --scene lobby --seconds 12      # the start screen instead
npm run audio -- --seconds 30 --out bed-long
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
the real generated impulse response, the real per-trigger jitter, the real
scheduler — not a re-implementation that could drift from it.

The scene is reached by **playing to it** (`lobby` = start screen, `table` =
click through to the board) rather than by calling `music.setScene`, so the bed
captured is the one the game actually puts there.

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

Rules of thumb for this game, from the baseline measured on 2026-08-29:

- **`flatness` near 0.03 means there is no noise layer audible.** `music.ts`
  says movement comes from "chips settling and cards on felt… noise rather than
  notes" and names that as the layer to reach for when the bed feels flat. If
  flatness is that low, it is not reaching the output.
- **Check the top half of the spectrogram.** If it is black, the bed has no air
  above ~1–2 kHz, and on laptop speakers — which roll off below ~200 Hz — a
  player may hear very little of it at all.
- **A regular row of blobs is a pulse**, however soft. The bed's whole design is
  motion "without anything ever being struck"; visible periodicity means it is
  being struck.

## The baseline it starts from

18 s of the board, music only, no cues (2026-08-29, before any redesign):

```
peak -23.5 dBFS   RMS -39.2 dBFS   crest 15.7 dB   movement 22.5 dB
centroid 721 Hz   flatness 0.036   clipped 0
energy: <500 Hz 99%   >500 Hz 1%   >2 kHz ~0%
```

Read: very quiet, very dark, almost purely tonal, with the pad swelling about
six times in eighteen seconds. Keep this to compare against — a redesign that
cannot show a change here has not made one.

## What it still cannot tell you

Timbre quality, whether a chord is pleasant, and whether the room sounds like a
card room. It measures level, spectrum and movement. A human listen on real
speakers is still the last step before shipping, and stereo is summed to mono in
the capture, so width is not measured at all.
