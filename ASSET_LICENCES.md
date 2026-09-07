# Asset licences

Provenance for every non-code asset that ships in the game build. One row per
file, and **a file must not be committed to `static/` without its row**.

Stake's approval guidelines require that submitted games use **unique audio and
visual assets** (`approval-guidelines.md`, "Game display") and that "team names,
game titles and assets must comply with IP/copyright law" ("Key restrictions").
A reviewer can ask where an asset came from. This file is the answer.

Keep receipts, signed licences and subscription invoices **outside `static/`** —
anything in that directory ships to players.

---

## Shipping assets

| File | Source | Licence | Acquired | Notes |
|---|---|---|---|---|
| `static/logo.png` | Original artwork for this game | Owned | — | 743 kB, 710×710 |
| `static/logo.webp` | Same artwork, re-encoded q90 | Owned | — | 81 kB; the default, see `logoAsset.svelte.ts` |
| `static/favicon.png` | Same artwork | Owned | — | |

**There are no sound-effect files to licence.** Presses, card flips, wins and
fanfares are generated in code at runtime by `audioGraph.ts`, so none of them is
a recording and none needs a row above. The music bed below is the only audio
asset the game will ship, and therefore the only one this file has to account
for.

---

## Music bed — PAID-TIER SUNO, LICENSED TO SHIP

**One track ships: `static/music/A.mp3`**, which is what `ACTIVE_TRACK_ID` in
`musicTracks.ts` names and the only audio file in that directory. It was
**generated and downloaded on 2026-09-02 on an active paid Suno Pro
subscription**, using model **v5.5**, and everything below about tier, terms and
downloads applies to it.

It has nine siblings. Ten takes were generated in the same session under the same
subscription, and all ten were carried in `static/music/` for a time while the
choice was deferred. **That audition state is over**: the nine that were not
chosen are **benched in the repo-root `audio-masters/`** as MP3s beside their WAV
masters, and they are gitignored there. They are equally licensed and equally
usable — benched is not rejected — but they are out of the build, which is the
only thing that matters for payload. The directory ceiling in
`musicTracks.test.ts` is back to **9 MB** from the 56 MB it was raised to, and
`static/music/` is 2.2 MB.

The ten replaced four free-tier placeholders (generated 2026-08-31) which were
licensed for personal, non-commercial use only and could not ship. Those four
were deleted from disk and their rows removed from this file. Re-downloading them
would not have helped — the replacements are fresh generations, not re-downloads.

**To bring a benched take back for an audition**, copy its MP3 from
`audio-masters/` into `static/music/`, and move it back out before staging. It
carries the same licence, so the objection is payload rather than rights, and
`static/` is copied wholesale into the build.

---

### Which Terms govern, and why both are satisfied

Suno replaced its Terms of Service **the day after these tracks were made**, and
the two versions license Output differently. Both are satisfied here, so this is
recorded rather than argued.

**Terms dated 26 Mar 2026 — in force on 2026-09-02, the generation date.**
The assignment turns on *generation*:

> "Suno hereby assigns to you all of its right, title and interest in and to any
> Output owned by Suno and generated from Submissions made by you through the
> Service **during the term of your paid-tier subscription**."

Satisfied: Pro was active from 2026-09-02 (invoice below) and every track was
generated that afternoon. These Terms impose no download condition.

**Terms dated 10 Aug 2026, effective 2026-09-03 — in force from the day after.**
The assignment drops the subscription-term qualifier, and a **download**
condition appears for commercial use:

> "You may commercially exploit Output solely to the extent it adheres to Suno's
> Conditions of Access and Use as outlined above **provided you have obtained a
> permitted download of that Output** in accordance with the download allocations
> for your applicable service tier."

Satisfied: all ten were downloaded through Suno's own download channel on the
paid tier, ten against a Pro allotment of twenty, within minutes of generation.
Recording or stream-ripping would **not** have qualified; those are named as
prohibited.

**The new Terms answer the cancellation question the old ones left open**, and
answer it favourably:

> "Any assignment made to you under the paragraphs above, and the commercial use
> rights described in this paragraph with respect to a Download you have
> obtained, **are perpetual and are not affected** by your exhaustion of your
> Download allotment, by any later change to allotments or pricing, or **by the
> expiry, cancellation, downgrade or suspension of your subscription**."

So letting the subscription lapse does not touch these ten tracks. What it would
affect is any *future* download: a re-download on a lapsed account would be a
free-tier download, personal and non-commercial. **The files in `audio-masters/`
are therefore the licensed artefacts** and must be backed up off the build
machine — they are gitignored, so no clone or remote holds a copy.

**Format conversion is expressly permitted**, which is what the shipped MP3s
rely on:

> "You may edit, process, or convert the format of an Output you are otherwise
> permitted to use to the extent such use is incidental."

**Metadata must not be stripped.** The new Terms add:

> "You agree not to remove, alter, obscure or circumvent any fingerprint,
> watermark or metadata Suno appends to an Output for the purpose of concealing
> or misrepresenting the provenance, service tier, or status of that Output."

Every master carries `comment=made with suno; created=<ISO 8601>; id=<song id>`.
The first encode used `-map_metadata -1` and removed it — for payload, not
concealment, but the tag is ~100 bytes and there is no reason to sit on the wrong
side of that sentence. **All ten were re-encoded with the tag preserved**, and
the hashes below are of those files. Do not reintroduce `-map_metadata -1`.

Unchanged across both versions, and recorded so nobody rediscovers it as a
surprise: *"Suno makes no representation or warranty to you that any copyright
will vest in any Output."* The game may freely **use** the track; it may not be
able to **stop** others reusing it. That is an accepted trade for a background
loop.

---

### Generation settings — identical for all takes

| Setting | Value |
|---|---|
| Service | Suno |
| Model | **v5.5** |
| Date generated | **2026-09-02**, 19:39–20:00 UTC |
| Subscription tier active on that date | **Pro** |
| Mode | Custom, **Instrumental** |
| Duration requested | 6 minutes *(not honoured — see note)* |
| Weirdness | 50% |
| Style Influence | 50% |

Suno returns two takes per generation; `(1)` in a filename is the **browser's**
duplicate-name suffix, not Suno's take numbering — both takes of a prompt arrive
under the same title. The duration slider was set to 6 minutes and was not
honoured: five takes came back at exactly 479.40 s (7:59) and five between 2:27
and 3:24. That is recorded because it is a reproducibility fact about the
request, not a defect in the Output.

### Exclude Styles — identical for all takes

```
vocals, choir, applause, casino ambience, slot machine, big band swing, guitar solo, saxophone solo, piano solo, drum fill, build-up, crescendo, drop, breakdown, chorus, key change, tempo change, cathedral reverb, distant, melancholy, orchestral swell, fade out
```

### Styles — verbatim, one per prompt letter

The letter in every filename is the prompt that produced it.

**A**
```
Late-night jazz lounge in C minor, warm and close, brushed drums, upright bass, muted Rhodes chords, small dry room, intimate, 72 BPM, steady repeating groove, even dynamics, instrumental
```

**B**
```
Warm dusty lounge vamp in C minor, close and unhurried, felt piano, fat upright bass, soft brushed kit, light tape saturation, dry small room, 66 BPM, one repeating figure, instrumental
```

**C**
```
Downtempo noir trip-hop in C minor, hypnotic and warm, dusty breakbeat, deep upright bass, muted Wurlitzer chords, close dry mix, 82 BPM, one continuous groove, instrumental
```

**D**
```
Minimal cinematic tension underscore in C minor, slow burn, warm low strings, pulsing bass, muted piano clusters, soft heartbeat percussion, close and dry, 68 BPM, flat dynamics, instrumental
```

**E**
```
Dusty late-night soul groove in C minor, warm and hazy, fat analog bassline, brushed drums, muted electric piano, faint horn pads, close dry room, 76 BPM, one repeating vamp, instrumental
```

---

### File-to-URL pairing is VERIFIED, not assumed

Because both takes of a prompt download under the same title, the pairing could
not be settled from filenames, and duration settles only eight of ten — `C`/`C (1)`
and `E`/`E (1)` are 7:59 within their pair.

It is settled by the embedded tag: every master carries the **song id** Suno
generated it under, and all ten were checked against the URLs recorded below.
**All ten match.** To re-verify:

```
ffprobe -v error -show_entries format_tags=comment -of default=nw=1:nk=1 "audio-masters/C (1).wav"
```

The `created=` timestamp in that tag is also the generation time in the table
below, and it falls in the same minute as the download (Vaughan is UTC−4 in
September) — generation and download were one action.

### The shipping bed — `static/music/`

Encoded from the WAV master at 112 kbps, **preserving Suno's metadata tag**:

```
ffmpeg -i in.wav -vn -b:a 112k out.mp3
```

The WAV was downloaded in preference to Suno's MP3 so the shipped file is a
single generation of lossy encoding rather than a transcode — this bed has little
energy above 2 kHz to spare, and that is the band cascaded encoding damages first.
Licensed **Paid tier (Pro, v5.5), generated 2026-09-02, cleared to ship**.

| File | Prompt | Length | Generated (UTC) | Generation URL | SHA-256 (first 16) |
|---|---|---|---|---|---|
| `static/music/A.mp3` | A, take 1 | 2:42 | 19:39:08Z | [`0be98ea4`](https://suno.com/song/0be98ea4-d8fb-49f6-a90b-2f3a6dc41389) | `7e011b43e2a25862` |

### Benched MP3s — `audio-masters/`, not shipped, not committed

The other nine encodes, from the same session and the same subscription, made the
same way. **Their rows are kept rather than deleted.** Deleting them would mean
re-establishing provenance for any take later brought back, and provenance is the
one thing about these files that cannot be re-derived from the files themselves
once the subscription lapses.

They are licensed identically to the row above. The reason they are not in
`static/music/` is payload, not rights. The hashes are of the files as they were
encoded; moving them did not touch their bytes, so they still verify. Their
measured loop regions and level trims live in
`.claude/skills/rtb-invariants/references/audio-and-jurisdiction.md`, so bringing
one back costs a file copy rather than a measurement pass.

| File | Prompt | Length | Generated (UTC) | Generation URL | SHA-256 (first 16) |
|---|---|---|---|---|---|
| `audio-masters/A (1).mp3` | A, take 2 | 3:24 | 19:40:41Z | [`24d50891`](https://suno.com/song/24d50891-fc85-4623-a12b-297a9d7195aa) | `6b5b38fa30155f5b` |
| `audio-masters/B.mp3` | B, take 1 | 2:33 | 19:42:44Z | [`1513712f`](https://suno.com/song/1513712f-5e2a-4a33-b94d-7943178ffb8f) | `8b546cabe06b50bd` |
| `audio-masters/B (1).mp3` | B, take 2 | 7:59 | 19:44:19Z | [`1e9f2031`](https://suno.com/song/1e9f2031-c603-435c-91a7-dc6ab5b98659) | `156ff9aee251d547` |
| `audio-masters/C.mp3` | C, take 1 | 7:59 | 19:50:55Z | [`6272ad86`](https://suno.com/song/6272ad86-152d-4c77-87ee-958a1c2610ac) | `8a92618c0078e9c4` |
| `audio-masters/C (1).mp3` | C, take 2 | 7:59 | 19:53:08Z | [`1e14ea63`](https://suno.com/song/1e14ea63-cf50-42e8-a030-6773ef4e9acc) | `c651d33f71e9180b` |
| `audio-masters/D.mp3` | D, take 1 | 2:27 | 19:56:09Z | [`a27de14b`](https://suno.com/song/a27de14b-8752-4f33-ae2d-733b6e872596) | `d7e0428fb5b7c9e7` |
| `audio-masters/D (1).mp3` | D, take 2 | 3:04 | 19:57:12Z | [`f301ccd6`](https://suno.com/song/f301ccd6-eea3-4ebd-bc54-1b0a11a2f3d1) | `f114f67dff097c67` |
| `audio-masters/E.mp3` | E, take 1 | 7:59 | 19:58:14Z | [`39ad3dbd`](https://suno.com/song/39ad3dbd-9e99-4faa-b23f-87bd116bef97) | `60de636b24541e12` |
| `audio-masters/E (1).mp3` | E, take 2 | 7:59 | 20:00:21Z | [`8ad6bd6b`](https://suno.com/song/8ad6bd6b-2b24-417e-9c68-611c3f6c86c1) | `1b90b90e76725598` |

### WAV masters — `audio-masters/`, never shipped, never committed

The archival sources and the licensed artefacts: these are the permitted
Downloads, unmodified. Kept because re-cutting `loopEnd` to a bar line or
re-encoding at another bitrate should start from these rather than from a
second-generation MP3, and because a later re-download would not carry this
licence. They sit outside `static/` so the build never sees them, and
`audio-masters/.gitignore` keeps them — and the nine benched MP3s beside
them — out of git.

| File | Prompt | Downloaded (2026-09-02, local UTC−4) | SHA-256 (first 16) |
|---|---|---|---|
| `A.wav` | A, take 1 | 15:39 | `087d34cf49ab3d46` |
| `A (1).wav` | A, take 2 | 15:42 | `12dfbb243d2182a7` |
| `B.wav` | B, take 1 | 15:43 | `0cc6b31553e2763a` |
| `B (1).wav` | B, take 2 | 15:49 | `a2dd11e7993c1eaf` |
| `C.wav` | C, take 1 | 15:52 | `9eab113cf52d1a31` |
| `C (1).wav` | C, take 2 | 15:55 | `1274d8eb26df49d9` |
| `D.wav` | D, take 1 | 15:56 | `aa5b65b3e02283b8` |
| `D (1).wav` | D, take 2 | 15:57 | `b2175d2cf309b333` |
| `E.wav` | E, take 1 | 16:00 | `285f3f448a7543c9` |
| `E (1).wav` | E, take 2 | 16:02 | `4f753c747bc9d1fa` |

### Evidence — `licence-evidence/`

The supporting documents live in [`licence-evidence/`](licence-evidence/), split
by whether they can be published. This repository is **public**.

| Document | Where | Committed? |
|---|---|---|
| Terms of Service, revised 26 Mar 2026 | `licence-evidence/terms/suno-tos-2026-03-26.pdf` | **yes** |
| Terms of Service, effective 03 Sep 2026 | `licence-evidence/terms/suno-tos-2026-09-03.pdf` | **yes** |
| Suno Pro invoice `ZKHGT4B9-0001`, issued 2026-09-02 | `licence-evidence/private/` | **no** |
| Payment receipt `2187-0616-9413`, paid 2026-09-02 | `licence-evidence/private/` | **no** |

Subscription period: **Suno Pro, Sep 2 – Oct 2 2026**, CA$15.82 incl. HST, paid
2026-09-02 — before the first generation at 19:39 UTC the same day.

**The Terms are committed on purpose.** They are public documents carrying no
personal data, and the 26 Mar text — the one these tracks were licensed under —
was replaced on Suno's site on 3 Sep 2026 and cannot be re-fetched. Keeping it in
the tree is what makes this file's argument checkable by someone who was not
there.

**The invoice and receipt are not**, and their absence is deliberate rather than
an oversight: they carry a billing name, a home address, an email and a partial
card number. The numbers above are enough for a reviewer to request the
originals. `licence-evidence/.gitignore` is written **default-deny** — everything
ignored unless explicitly re-admitted — so a document dropped in the wrong place
is ignored rather than committed. Keep a copy of `private/` off this machine; it
is the only proof the subscription was paid before the tracks were generated.

### ⚠️ Still outstanding

1. **Drop the four PDFs into `licence-evidence/`.** The directory and its rules
   exist; the documents themselves are still only wherever they were downloaded.
   Two go in `terms/` and are committed; two go in `private/` and are not.
2. **Archive the page behind each generation URL** — screenshot or
   print-to-PDF — **while the subscription is live.** The URLs and song ids are
   recorded and verified, but a URL is only evidence for as long as it resolves,
   and account access is not guaranteed after a lapse.
3. **Back up `audio-masters/` off this machine.** Those WAVs are the permitted
   Downloads the commercial licence attaches to, and they are gitignored, so no
   clone, fork or remote holds a copy. A later re-download on a lapsed account
   would carry the free-tier licence instead.
4. ~~**Prune to one track.**~~ **Done 2026-09-06.** The nine unused MP3s were
   moved to `audio-masters/` rather than deleted, their rows moved to the benched
   table above rather than dropped, and the `musicTracks.test.ts` directory
   ceiling put back to 9 MB. `static/music/` is one 2.2 MB file. Note that the
   nine were committed once before this and remain in git history; that is
   accepted, because what mattered was the build payload and a history rewrite
   would cost more than it saves.

### If the track comes from Suno

Record all of these — the generation URL alone is not a licence:

- **Generation URL** and the date it was generated
- **The prompt used**, verbatim
- **Subscription tier active at the time of generation.** This is the load-bearing
  fact. Suno's terms assign rights for Outputs "generated from Submissions made
  by you through the Service **during the term of your paid-tier subscription**";
  a track generated on the free tier is licensed for "personal and
  non-commercial purposes" only and cannot ship, regardless of what is paid for
  later.
- **A saved copy of the Terms of Service as they read on that date**, plus the
  subscription invoice.

Known limitation, recorded so nobody rediscovers it as a surprise: Suno states
it "makes no representation or warranty that any copyright will vest in any
Output". The game may freely *use* the track; it may not be able to *stop*
others reusing it. That is an accepted trade for a background loop.

### If the track is commissioned instead

The written agreement must cover all of:

- Work-for-hire / full assignment of copyright, or an exclusive perpetual
  worldwide licence
- All media, **including interactive software and video games**
- **Real-money gambling and online casino use expressly permitted** — named, not
  left to "all uses"
- No attribution required, or an agreed place for the credit
- **No PRO registration** (ASCAP/BMI/PRS) — a registered track can generate a
  performance-royalty claim against the operator
- Composer warrants the work is original and that any samples are cleared
