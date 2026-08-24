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
| `RideTheBus-BG.jpg` | Environmental background, high-resolution PNG or JPG | 1536 × 1024, 499 KB |
| `RideTheBus-FG.png` | Feature character / key item, transparent PNG | 1254 × 1254, 1.50 MB |
| `TakeoverCasino-Logo.png` | Provider logo, transparent PNG, legible small | 710 × 710, 726 KB |

**Background + foreground must not exceed 3 MB combined.** Ours are 1.99 MB —
under, with 1 MB of headroom. There is no documented cap on the provider logo.

`TakeoverCasino-Logo.png` is byte-identical to the game's own
`static/logo.png`, which is correct: the chip mark on the card backs, the loader
and the table's deck prop *is* the Takeover Casino logo, so the provider mark and
the in-game mark are one file. Kept as two copies because the two have different
owners — one is a build asset resolved through `${base}/logo.png`, the other is a
deliverable whose filename Stake dictates — and coupling them through a symlink
or a build step would be a fragile way to save 726 KB in a directory that is not
shipped.
