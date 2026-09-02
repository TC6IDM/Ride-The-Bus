# Licence evidence

The documents behind the music-bed rows in [`ASSET_LICENCES.md`](../ASSET_LICENCES.md).

| File | Committed? | Why |
|---|---|---|
| `terms/suno-tos-2026-03-26.pdf` | **yes** | The Terms in force when the ten tracks were generated and downloaded on 2026-09-02. Replaced on Suno's site on 2026-09-03, so it cannot be re-fetched. |
| `terms/suno-tos-2026-09-03.pdf` | **yes** | The Terms effective the following day, which govern the tracks going forward and contain the perpetual-rights clause. |
| `private/Invoice-ZKHGT4B9-0001.pdf` | **no** | Billing name, home address, email. This repository is public. |
| `private/Receipt-2187-0616-9413.pdf` | **no** | As above, plus a partial card number. |

`private/` is excluded by `.gitignore`, which is written default-deny: everything
is ignored unless explicitly re-admitted, so a misfiled document is ignored
rather than committed. Keep a copy of `private/` off this machine — it is the
only proof the subscription was paid before the tracks were generated, and
nothing else holds it.

## What these prove

`ASSET_LICENCES.md` sets out the argument in full. In short: the tracks were
generated **and** downloaded on 2026-09-02 on an active paid Suno Pro
subscription, which satisfies both the generation-based assignment in the March
Terms and the download-based commercial-use condition in the September Terms.

## The WAV masters are evidence too

They are not here, because they are large and because they are also working
files, but [`audio-masters/`](../audio-masters/) at the repository root holds the
ten Suno downloads unmodified. Under the Terms effective 2026-09-03 the
commercial right attaches to a permitted **download** taken on a paid plan, so
those WAVs are the licensed artefacts in the same way the invoice is the proof of
payment. They are gitignored and must be backed up off this machine alongside
`private/`.
