/**
 * THE SQUEEZE'S FOLD (the owner's pick CL3, with their notes of 2026-10-20):
 * a face-down card with one corner lifted and folded back, showing the face
 * underneath - the real face, not a drawing of a corner.
 *
 * Corner C of a w x h card is lifted to the point P. The fold is the
 * perpendicular bisector of CP. The back keeps the part of the card on P's
 * far side of the fold; the lifted part is reflected across the fold, and,
 * being the card's underside, shows the FACE. A face point (u, v) - the face
 * as it is normally read - lies under the back at (w - u, v), because turning
 * a card over mirrors it left to right; the fold then reflects that. The two
 * mirrors make a rotation, so the face in the flap is never mirrored.
 *
 * Pure: corners and points in the card's own unscaled pixels, out come the
 * clip polygons and the flap's matrix as CSS strings. GameBoard draws them;
 * cardFold.test.ts holds the geometry.
 */
export type Pt = readonly [number, number];

export type Fold = {
  /** clip-path for the back: what is still lying flat. null = the whole card. */
  back: string | null;
  /** The flap - the face, folded over - or null while nothing is lifted. */
  flap: { transform: string; clip: string } | null;
  /** How much of the card is lifted, 0-1. */
  lifted: number;
};

const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];

/** The part of a convex polygon where `side` is not negative (Sutherland-Hodgman, one edge). */
export function clipPolygon(polygon: readonly Pt[], side: (p: Pt) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const sa = side(a);
    const sb = side(b);
    if (sa >= 0) out.push(a);
    if (sa >= 0 !== sb >= 0) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export const polygonArea = (polygon: readonly Pt[]) =>
  Math.abs(
    polygon.reduce((sum, a, i) => {
      const b = polygon[(i + 1) % polygon.length]!;
      return sum + a[0] * b[1] - b[0] * a[1];
    }, 0),
  ) / 2;

const cssPolygon = (polygon: readonly Pt[]) =>
  `polygon(${polygon.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(', ')})`;

/**
 * The affine map that puts face point (u, v) where the folded flap shows it,
 * as [a, b, c, d, e, f] in CSS matrix() order: x' = a u + c v + e,
 * y' = b u + d v + f.
 */
export function flapMatrix(w: number, C: Pt, P: Pt): [number, number, number, number, number, number] {
  const d = sub(P, C);
  const length = Math.hypot(d[0], d[1]);
  const [nx, ny] = [d[0] / length, d[1] / length];
  const m = dot([(C[0] + P[0]) / 2, (C[1] + P[1]) / 2], [nx, ny]);
  // Reflection across the fold, R = I - 2nn^T, composed with the turn-over
  // mirror (u, v) -> (w - u, v).
  return [
    -(1 - 2 * nx * nx),
    2 * nx * ny,
    -2 * nx * ny,
    1 - 2 * ny * ny,
    w * (1 - 2 * nx * nx) + 2 * m * nx,
    -2 * w * nx * ny + 2 * m * ny,
  ];
}

/** Corner C of a w x h card lifted to P. */
export function foldCard(w: number, h: number, C: Pt, P: Pt): Fold {
  const d = sub(P, C);
  if (Math.hypot(d[0], d[1]) < 0.5) return { back: null, flap: null, lifted: 0 };
  const card: Pt[] = [[0, 0], [w, 0], [w, h], [0, h]];
  const mid: Pt = [(C[0] + P[0]) / 2, (C[1] + P[1]) / 2];
  const side = (p: Pt) => dot(sub(p, mid), d);
  const flat = clipPolygon(card, side);
  const up = clipPolygon(card, (p) => -side(p));
  const [a, b, c, dd, e, f] = flapMatrix(w, C, P);
  return {
    back: flat.length ? cssPolygon(flat) : 'inset(50%)',
    // The flap's clip is in the face's own coordinates: the lifted part of
    // the back, mirrored onto the face.
    flap: { transform: `matrix(${a}, ${b}, ${c}, ${dd}, ${e}, ${f})`, clip: cssPolygon(up.map(([x, y]) => [w - x, y] as Pt)) },
    lifted: polygonArea(up) / (w * h),
  };
}

/** The four corners of a w x h card, in the order top-left, top-right, bottom-right, bottom-left. */
export const cardCorners = (w: number, h: number): Pt[] => [[0, 0], [w, 0], [w, h], [0, h]];

/**
 * The automatic squeeze lifts the BOTTOM-LEFT corner (the owner, 2026-10-20),
 * whose underside carries the face's bottom-right index, along the diagonal:
 * `reach` is how far the fold has travelled in along each edge, in pixels.
 */
export const autoPeelPoint = (h: number, reach: number): Pt => [reach, h - reach];
