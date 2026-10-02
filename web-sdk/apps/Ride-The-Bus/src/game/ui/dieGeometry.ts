/**
 * The table die, drawn: the three faces of a cube lying on the table that the
 * camera can see, projected the way the table's own props are.
 *
 * THE CAMERA IS THE SCENE'S. table.css measures it as two ratios: --flat
 * (0.676), how far a face lying on the table is foreshortened, and --upright
 * (0.737), how far a face standing on it is - the sine and the cosine of one
 * elevation (0.676^2 + 0.737^2 is 1 to within the measurement). A die drawn
 * from any other angle would sit on the table differently from the deck and
 * the chips beside it. dieGeometry.test.ts holds these two to table.css.
 *
 * Orthographic, so every face is an AFFINE image of a square: each is one SVG
 * matrix() over a unit square in its own [-0.5, 0.5] coordinates, its rounded
 * corners and its pips included. The cube is turned YAW about the vertical so
 * two side faces show, and DieFace lights them from the upper right like
 * everything else on the table: the right face brighter than the front.
 *
 * `.ts` extensions are unnecessary here (no imports), and it stays pure.
 */
export const FLAT = 0.676;
export const UPRIGHT = 0.737;
const YAW = (28 * Math.PI) / 180;

/** The square view box DieFace draws in. */
export const DIE_VIEW = 100;
const MARGIN = 4;

type Vec3 = readonly [number, number, number];
export type FaceName = 'top' | 'front' | 'right';

/** World: x to the right, y up, z toward the camera. Screen: y down. */
function project([x, y, z]: Vec3): [number, number] {
  const c = Math.cos(YAW);
  const s = Math.sin(YAW);
  const across = x * c - z * s;
  const towardUs = x * s + z * c;
  return [across, -y * UPRIGHT + towardUs * FLAT];
}

/** Each visible face: its centre and the two directions of its own u and v. Drawn
 *  in this order - the two sides, then the top over their upper edges. */
const FACES: readonly { name: FaceName; origin: Vec3; u: Vec3; v: Vec3 }[] = [
  { name: 'front', origin: [0, 0, 0.5], u: [1, 0, 0], v: [0, -1, 0] },
  { name: 'right', origin: [0.5, 0, 0], u: [0, 0, -1], v: [0, -1, 0] },
  { name: 'top', origin: [0, 0.5, 0], u: [1, 0, 0], v: [0, 0, 1] },
];

const CORNERS: readonly Vec3[] = [-0.5, 0.5].flatMap((x) =>
  [-0.5, 0.5].flatMap((y) => [-0.5, 0.5].map((z) => [x, y, z] as const)),
);

/** Scale and offset that fit the projected cube into the view box. */
function fit() {
  const points = CORNERS.map(project);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const scale = (DIE_VIEW - 2 * MARGIN) / Math.max(width, height);
  return {
    scale,
    dx: DIE_VIEW / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * scale,
    dy: DIE_VIEW / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2) * scale,
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Each visible face's matrix() from its unit square into the view box. */
export function dieFaces(): { name: FaceName; matrix: string }[] {
  const { scale, dx, dy } = fit();
  return FACES.map(({ name, origin, u, v }) => {
    const [ox, oy] = project(origin);
    const [ux, uy] = project(u);
    const [vx, vy] = project(v);
    const m = [ux * scale, uy * scale, vx * scale, vy * scale, ox * scale + dx, oy * scale + dy].map(round);
    return { name, matrix: `matrix(${m.join(' ')})` };
  });
}

/**
 * The cube's outline - the hexagon its silhouette makes - in view-box units.
 * Drawn under the faces, so where their rounded corners pull away from the
 * cube's own corners the body shows rather than the table.
 */
export function dieOutline(): string {
  const { scale, dx, dy } = fit();
  const points = CORNERS.map(project).map(([x, y]) => [x * scale + dx, y * scale + dy] as const);
  // Convex hull, gift-wrapped - eight points, six on the hull.
  const hull: (readonly [number, number])[] = [];
  let at = points.reduce((a, b) => (b[0] < a[0] ? b : a));
  do {
    hull.push(at);
    let next = points[0]!;
    for (const p of points) {
      const cross = (next[0] - at[0]) * (p[1] - at[1]) - (next[1] - at[1]) * (p[0] - at[0]);
      if (next === at || cross < 0) next = p;
    }
    at = next;
  } while (at !== hull[0] && hull.length <= points.length);
  return hull.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');
}

const Q = 0.26;
/** Pip positions on a face, in its own [-0.5, 0.5] coordinates. */
export const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0, 0]],
  2: [[-Q, -Q], [Q, Q]],
  3: [[-Q, -Q], [0, 0], [Q, Q]],
  4: [[-Q, -Q], [Q, -Q], [-Q, Q], [Q, Q]],
  5: [[-Q, -Q], [Q, -Q], [0, 0], [-Q, Q], [Q, Q]],
  6: [[-Q, -Q], [-Q, 0], [-Q, Q], [Q, -Q], [Q, 0], [Q, Q]],
};

/**
 * The two side faces a top face shows, as on a real die: never the top's
 * opposite (opposite faces sum to 7), and adjacent to each other.
 */
export const SIDES: Record<number, readonly [front: number, right: number]> = {
  1: [2, 3],
  2: [3, 1],
  3: [1, 2],
  4: [5, 1],
  5: [1, 4],
  6: [2, 4],
};

export function faceValues(top: number): Record<FaceName, number> {
  const [front, right] = SIDES[top] ?? SIDES[1]!;
  return { top, front, right };
}
