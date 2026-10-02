# Submission artefacts

Files handed to Stake **with** the approval request. None of them is loaded by
the game, and that is why they live here rather than in
`web-sdk/apps/Ride-The-Bus/static/`.

They were in `static/` until now, which meant every build carried 2.7 MB of
artwork no player ever fetches — `static/` is copied wholesale into the build
output (they were listed in `.svelte-kit/output/server/manifest.js` as assets),
and "optimised bundle size" is an explicit 3-star criterion. Moving them cut the
deployed `static/` from 3.5 MB to 726 KB. **Do not move them back**; upload them
through the Tile Editor in the dashboard.

## Game tile assets

Filenames are **mandated** by Stake and must not be changed.

| File | Requirement | Ours |
|---|---|---|
| `RideTheBus-BG.jpg` | Environmental background, high-resolution PNG or JPG | 1920 × 1280, 152 KB |
| `RideTheBus-FG.png` | Feature character / key item, transparent PNG | 1600 × 1600, 1.2 MB |
| `TakeoverCasino-Logo.png` | Provider logo, transparent PNG, legible small | 710 × 710, 726 KB |

**Background + foreground must not exceed 3 MB combined.** Ours are 1.32 MB,
and `scripts/tile-art.mjs` refuses to write a pair over the limit. There is no
documented cap on the provider logo.

**Both are rendered from the game, not painted.** `node scripts/tile-art.mjs`
(with the game and replay RGS running, `GAME_PORT` as for `shoot.mjs`)
photographs `?dev_tile=fg` - the J, Q, K and house Ace the board deals, the
deck's back and two chips, on a transparent ground - and the live table with
the board's furniture hidden. Change the cards or the table and re-run it; the
tile cannot drift from the game. `--out <dir>` renders somewhere else to look
first; `--cups` puts the party cups back on the table (left off by default:
drinking props on the one image a player sees before choosing the game sit
closest to Stake's underage-appeal line). The generated pair these replaced is
in git history; provenance is in `ASSET_LICENCES.md`.

`TakeoverCasino-Logo.png` is byte-identical to the game's own
`static/logo.png`, which is correct: the chip mark on the card backs, the loader
and the table's deck prop *is* the Takeover Casino logo, so the provider mark and
the in-game mark are one file. Kept as two copies because the two have different
owners — one is a build asset resolved through `${base}/logo.png`, the other is a
deliverable whose filename Stake dictates — and coupling them through a symlink
or a build step would be a fragile way to save 726 KB in a directory that is not
shipped.
