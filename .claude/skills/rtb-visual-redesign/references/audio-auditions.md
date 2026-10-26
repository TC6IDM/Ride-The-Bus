# Audition pages for sound

The owner chooses sounds by ear, and the only way to put several renditions in front of
them is a page that plays them. `design-archive/2026-10-17-visual-directions/hum-audition.html`
(published as its own artifact, https://claude.ai/artifact/U6wF182WQ6SQzY1Zmpv54W) is the
working example: six suspense sounds, five ways to wait during a manual peel, and a
bench to try them.

## Port the game's chain, so "Today" really is today

A comparison is only fair if the baseline is the shipping sound. Port it from source
rather than imitating it:

- The chain from `audioContext.ts` / `audioMixer.ts`: master gain 0.56 (`MASTER_HEADROOM`)
  into a limiter (threshold -10, knee 6, ratio 12, attack 3 ms, release 180 ms), the SFX bus
  at 0.75 (default volume 75), and the room - a 0.32 s generated impulse, lowpassed at
  3,200 Hz, wet 0.5, returning onto the SFX bus.
- The voices from `audioVoices.ts`: `tone`, `noise` (with the 5 ms raised-cosine attack and
  the pink filter), `thud`, and `swell` for held sounds.
- The cue itself from `sound.ts`, with its constants (`HOLD_SHAPE`, `OH`, `CROWD`,
  `strike()`, `stageWinRoot`), plus whatever follows it in the game (the card flip, the
  stage chime or the bust), so a rendition is heard in context.

## Make the comparison honest

- **Level-match.** Put an `AnalyserNode` after the limiter, expose the running peak
  (`window.__peak`, with a reset), and measure every rendition in a headless browser. Bring
  each within a few dB of today's before publishing; a louder option wins an A/B for being
  louder. The hum audition measured today's crowd at -16 to -18 dBFS and brought two
  renditions down 6 dB.
- Play each at the game's real timings, and offer the settings that change the sound
  (the stake's tier, a win or a miss).
- Where the sound depends on the player (a manual peel), give the page an interaction
  that stands in for it (a slider standing in for the corner), and offer the behaviours
  separately from the sounds, so the owner can mix one of each.
- Say in the reply that you can measure but not hear: the choice is the owner's ear.

## After the pick

Build it into `sound.ts` / `audioVoices.ts`, keep `sound.test.ts`'s scheduling tests honest
(prove a changed one with a sabotage), and run `npm run audio` on the real moment before
and after: no clipping, the peak and the level against the old capture, and the cue landing
where it should (the chime-timing check traced energy at the cue's pitch in the WAV).
