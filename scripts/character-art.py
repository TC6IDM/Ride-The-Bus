"""Build the back room's characters from their masters.

    math-sdk/.venv/Scripts/python.exe -I scripts/character-art.py

Reads the PNGs the owner generated (art-masters/characters/, provenance and
every pick in its README.md) and writes what the game ships:

  web-sdk/apps/Ride-The-Bus/static/characters/*.webp
  web-sdk/apps/Ride-The-Bus/src/game/scene/castGeometry.ts   (GENERATED)

Never hand-edit either output: change this script and re-run it. It is the
court-art.mjs of the characters - the masters are the source, the build is a
function of them, and the script fails rather than write something wrong.

WHAT IT DOES TO EVERY FRAME, and why (CHARACTER.MD has the long version):

1. LOCKED TO THE MASTER. ChatGPT's Select-brush edits still come back as
   whole-image redraws: the outline of the figure moves by a pixel or so
   everywhere. Swapped frame to frame that shimmers. So each frame keeps the
   master's own pixels everywhere except where it really changed (the arm, the
   eyes, the face), found by a diff and feathered in. Only the part the frame
   was made for ever moves.
2. BLENDED INTO THE ROOM (the owner, 2026-10-22: "the characters dont seem to
   blend into the background well"). A painted figure is lit brighter and more
   saturated than the CSS room it stands in, and its cut-out edge carries the
   generator's light fringe. Every frame is graded down to the room's light
   (exposure, saturation, contrast - the same for every frame of a figure, so
   swaps never change the grade), its alpha is eroded a pixel and feathered,
   and the wall's own colour is let a few pixels into the outline (light
   wrap). The room's vignette and the contact shadows are drawn live, by the
   page, so they hold at every window shape.
3. CROPPED TOGETHER. All frames of a figure share one box, so a frame drops
   onto the one before at the same place.

The smoke sheets are on black: brightness becomes alpha, which keeps the soft
edges a cut-out would lose.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTERS = os.path.join(ROOT, 'art-masters', 'characters')
APP = os.path.join(ROOT, 'web-sdk', 'apps', 'Ride-The-Bus')
OUT = os.path.join(APP, 'static', 'characters')
GEOMETRY = os.path.join(APP, 'src', 'game', 'scene', 'castGeometry.ts')

# The room panel behind the figures (tokens.css --room-panel / --room-panel-lit),
# for the light wrap. A flat colour is enough: the wrap is a few pixels wide.
WALL = np.array([0x26, 0x16, 0x0d], np.float32) / 255
WEBP_QUALITY = 80

# Each figure: its master, its frames (name -> master file), the height it
# ships at (the largest it is drawn: ~2x the 1200x675 layout), and its grade.
# `light` is the exposure: the Boss sits under the room's one lamp (the warm
# pool high on the right wall, table.css), so he is lifted and warmed a touch.
FIGURES = {
    'boss': {
        'dir': 'boss',
        'master': 'boss-idle.png',
        'frames': {
            'idle': 'boss-idle.png',
            'blink': 'boss-blink.png',
            'puff': 'boss-puff.png',
            'high': 'boss-exhale-1-high.png',
            'mid': 'boss-exhale-2-mid.png',
            'low': 'boss-exhale-3-low.png',
            'raise': 'boss-salute-1-raise.png',
            'turn': 'boss-salute-mid.png',
            'look': 'boss-salute-2-look.png',
        },
        'height': 560,
        'grade': {'light': 0.97, 'warm': 0.035, 'sat': 0.88, 'contrast': 0.94},
    },
    'floorman': {
        'dir': 'floorman',
        'master': 'floorman-idle.png',
        'frames': {
            'idle': 'floorman-idle.png',
            'blink': 'floorman-blink.png',
            'glance': 'floorman-glance.png',
            'hattip': 'floorman-hattip.png',
        },
        'height': 900,
        'grade': {'light': 0.90, 'warm': 0.0, 'sat': 0.88, 'contrast': 0.94},
    },
    'cart': {
        'dir': 'props',
        'master': 'barcart.png',
        'frames': {'idle': 'barcart.png'},
        'height': 400,
        'grade': {'light': 0.86, 'warm': 0.0, 'sat': 0.86, 'contrast': 0.94},
    },
}

# Points measured on the Boss's master canvas (1254 x 1254), by eye on a
# gridded crop: where the exhaled plume leaves his lips. The cigar's tip is
# found by colour below, so it follows the master if the master changes.
BOSS_MOUTH = (565, 207)


def load(path):
    im = Image.open(path).convert('RGBA')
    a = np.array(im).astype(np.float32)
    al = a[..., 3]
    al[al >= 250] = 255          # the generator leaves the inside 98-99% opaque
    al[al < 12] = 0              # and a faint haze round the outside
    return a


def premul(a):
    return np.dstack([a[..., :3] * (a[..., 3:] / 255), a[..., 3]])


def unpremul(p):
    al = p[..., 3:]
    rgb = np.where(al > 0, p[..., :3] / np.maximum(al, 1e-6) * 255, 0)
    return np.dstack([rgb, p[..., 3]])


def lock_to_master(master, frame):
    """The frame where it really differs from the master, the master elsewhere."""
    pm, pf = premul(master), premul(frame)
    diff = np.abs(pf - pm).max(axis=2)
    changed = Image.fromarray((diff > 30).astype(np.uint8) * 255)
    # Opening drops the outline shimmer (a pixel wide).
    changed = changed.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    # Then the region is CLOSED and its holes FILLED, at a quarter scale for
    # speed. A frame that moves an arm across navy cloth differs only faintly
    # from the master where sleeve meets jacket, so a plain threshold left
    # islands of the master inside the change - the Floorman's hat tip showed
    # the ghost of the idle's tucked hand on his chest (2026-10-22).
    small = changed.resize((changed.width // 4, changed.height // 4), Image.BILINEAR).point(lambda v: 255 if v > 20 else 0)
    small = small.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    holes = small.copy()
    ImageDraw.floodfill(holes, (0, 0), 128)
    small = Image.fromarray(np.where(np.array(holes) == 128, 0, 255).astype(np.uint8))
    changed = Image.fromarray(np.maximum(np.array(changed), np.array(small.resize(changed.size, Image.NEAREST))))
    # And the dilation and blur grow it into a soft-edged region.
    changed = changed.filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.GaussianBlur(7))
    w = np.array(changed, np.float32)[..., None] / 255
    return unpremul(pm * (1 - w) + pf * w), float((w > 0.5).mean())


def grade(a, g):
    rgb = a[..., :3] / 255
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    rgb = lum[..., None] + (rgb - lum[..., None]) * g['sat']
    rgb = 0.5 + (rgb - 0.5) * g['contrast']
    rgb = rgb * g['light'] + np.array([1.0, 0.55, 0.15], np.float32) * g['warm']
    al = Image.fromarray(a[..., 3].astype(np.uint8))
    # The edge: eroded a pixel (the generator's light fringe goes with it) and
    # feathered; then the wall let into the outline.
    al_soft = np.array(al.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7)), np.float32)
    core = np.array(al.filter(ImageFilter.MinFilter(11)).filter(ImageFilter.GaussianBlur(4)), np.float32) / 255
    rim = np.clip(a[..., 3] / 255 - core, 0, 1)[..., None] * 0.42
    rgb = rgb * (1 - rim) + WALL * rim
    return np.dstack([np.clip(rgb, 0, 1) * 255, al_soft])


def solid_box(arrays):
    box = None
    for a in arrays:
        ys, xs = np.where(a[..., 3] > 8)
        b = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    pad = 6
    return (max(0, box[0] - pad), max(0, box[1] - pad), box[2] + pad, box[3] + pad)


def save(a, box, height, path):
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).crop(box)
    w = round(im.width * height / im.height)
    im = im.resize((w, height), Image.LANCZOS)
    im.save(path, 'WEBP', quality=WEBP_QUALITY, method=6, alpha_quality=90)
    return im


def feet(a, box, bands, sole=0.05):
    """Each foot's SOLE, heel to toe, in a column band (fractions of the box
    width): where a shoe, a chair foot or a wheel meets the floor - the contact
    shadows lie along it. A shoe seen at an angle has its heel higher than its
    toe, so the lowest point alone put the shadow under the toe and left the
    heel in the air (the Floorman's left foot, the owner: "still floating",
    2026-10-22). So: every column's lowest solid pixel, the columns whose
    bottom lies within `sole` of the band's lowest (the shoe, not the trouser
    above it), and a line from the first to the last. Returned as fractions of
    the box: the middle of the sole (x, y), its length (w) and its angle in
    degrees (a; positive = the right end lower)."""
    x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1, 3] > 128
    H, W = sub.shape
    out = []
    for lo, hi in bands:
        c0, c1 = int(lo * W), int(hi * W)
        cols, bottoms = [], []
        for c in range(c0, c1):
            rows = np.where(sub[:, c])[0]
            if len(rows):
                cols.append(c)
                bottoms.append(rows.max())
        cols, bottoms = np.array(cols), np.array(bottoms)
        low = bottoms.max()
        keep = bottoms >= low - sole * H
        cols, bottoms = cols[keep], bottoms[keep]
        # The sole: the outermost columns, each at its own bottom.
        lx, rx = cols.min(), cols.max()
        ly = bottoms[cols == lx].max() + 1
        ry = bottoms[cols == rx].max() + 1
        angle = float(np.degrees(np.arctan2((ry - ly), (rx - lx) * 1.0))) if rx > lx else 0.0
        out.append({
            'x': round(float((lx + rx) / 2 / W), 4),
            'y': round(float((ly + ry) / 2 / H), 4),
            'w': round(float((rx - lx + 1) / W), 4),
            'a': round(angle, 1),
        })
    return out


def cigar_tip(a):
    """The idle cigar's glowing end: ember orange (not leather red), right-most."""
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    hot = (r > 210) & (g > 0.38 * r) & (g < 0.78 * r) & (b < 0.35 * r) & (al > 200)
    hot[:, : a.shape[1] * 2 // 3] = False
    ys, xs = np.where(hot)
    if not len(xs):
        sys.exit('character-art: no ember found on the Boss master')
    far = xs > np.percentile(xs, 98)
    return float(xs[far].mean()), float(ys[far].mean())


def smoke_pieces(path, half, count):
    """Cut the separate puffs of smoke out of one half of a sheet on black."""
    lum = np.array(Image.open(path).convert('L'), np.float32)
    h = lum.shape[0] // 2
    lum = lum[:h] if half == 'top' else lum[h:]
    cols = (lum > 40).any(axis=0)
    runs, start = [], None
    for x, on in enumerate(list(cols) + [False]):
        if on and start is None:
            start = x
        if not on and start is not None:
            runs.append((start, x))
            start = None
    runs = sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:count]
    pieces = []
    for x0, x1 in sorted(runs):
        p = lum[:, x0:x1]
        rows = np.where((p > 40).any(axis=1))[0]
        p = p[rows.min(): rows.max() + 1]
        a = np.zeros(p.shape + (4,), np.float32)
        a[..., :3] = (214, 204, 190)
        a[..., 3] = np.clip((p - 12) / 150, 0, 1) * 255
        pieces.append(a)
    return pieces


def main():
    os.makedirs(OUT, exist_ok=True)
    for stale in os.listdir(OUT):
        if stale.endswith('.webp'):
            os.remove(os.path.join(OUT, stale))
    geometry = {}
    total = 0
    for name, fig in FIGURES.items():
        d = os.path.join(MASTERS, fig['dir'])
        master = load(os.path.join(d, fig['master']))
        frames = {}
        for key, file in fig['frames'].items():
            raw = load(os.path.join(d, file))
            if raw.shape != master.shape:
                sys.exit(f'character-art: {file} is {raw.shape[1]}x{raw.shape[0]}, the master is not')
            locked, share = (raw, 0.0) if file == fig['master'] else lock_to_master(master, raw)
            frames[key] = grade(locked, fig['grade'])
            print(f'  {name}/{key:7s} from {file}  ({share * 100:4.1f}% of the canvas taken from the frame)')
        box = solid_box(frames.values())
        bw, bh = box[2] - box[0], box[3] - box[1]
        for key, a in frames.items():
            im = save(a, box, fig['height'], os.path.join(OUT, f'{name}-{key}.webp'))
            size = os.path.getsize(os.path.join(OUT, f'{name}-{key}.webp'))
            total += size
        g = {'aspect': round(bw / bh, 4), 'frames': list(frames), 'px': [im.width, im.height]}
        if name == 'boss':
            tx, ty = cigar_tip(master)
            g['ember'] = {'x': round((tx - box[0]) / bw, 4), 'y': round((ty - box[1]) / bh, 4)}
            g['mouth'] = {'x': round((BOSS_MOUTH[0] - box[0]) / bw, 4), 'y': round((BOSS_MOUTH[1] - box[1]) / bh, 4)}
            g['feet'] = feet(frames['idle'], box, [(0.30, 0.55), (0.62, 0.80), (0.80, 0.92)])
        elif name == 'floorman':
            g['feet'] = feet(frames['idle'], box, [(0.0, 0.42), (0.5, 1.0)])
        else:
            g['feet'] = feet(frames['idle'], box, [(0.0, 0.12), (0.15, 0.38), (0.6, 1.0)])
        geometry[name] = g

    # Three wisps and one plume: what cast.css animates. Every file in
    # static/ ships, so nothing is written that the game does not draw.
    wisps = smoke_pieces(os.path.join(MASTERS, 'smoke', 'smoke-1.png'), 'top', 5)[:3]
    plumes = smoke_pieces(os.path.join(MASTERS, 'smoke', 'smoke-1.png'), 'bottom', 2)[:1]
    smoke = {'wisps': [], 'plumes': []}
    for kind, pieces, height in (('wisp', wisps, 240), ('plume', plumes, 220)):
        for i, a in enumerate(pieces):
            path = os.path.join(OUT, f'smoke-{kind}-{i + 1}.webp')
            im = save(a, (0, 0, a.shape[1], a.shape[0]), height, path)
            total += os.path.getsize(path)
            smoke[kind + 's'].append(round(im.width / im.height, 4))
    geometry['smoke'] = smoke

    os.makedirs(os.path.dirname(GEOMETRY), exist_ok=True)
    with open(GEOMETRY, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// GENERATED by scripts/character-art.py - do not edit. Re-run the script.\n')
        f.write('//\n')
        f.write('// Every figure\'s frames share one box; every point is a fraction of it\n')
        f.write('// (x across, y down). `feet` are where the figure meets the floor - its\n')
        f.write('// contact shadows - and `w` is the width of that contact, as a share.\n')
        f.write('export const CAST_GEOMETRY = ')
        f.write(json.dumps(geometry, indent='\t'))
        f.write(' as const;\n')
    print(f'wrote {len(os.listdir(OUT))} files, {total / 1024:.0f} KB, and {os.path.relpath(GEOMETRY, ROOT)}')


if __name__ == '__main__':
    main()
