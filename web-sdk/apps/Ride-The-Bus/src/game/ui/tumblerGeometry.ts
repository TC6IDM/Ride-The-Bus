/**
 * The whiskey glass on the table, as geometry (TumblerGlass.svelte draws it).
 *
 * A cut-crystal tumbler is a CYLINDER, and the cut is a lattice of diamonds
 * on its surface - so it is built as one: every point is a place on the
 * cylinder (an angle round it and a height up it) projected through the
 * table's own camera, the one table.css states once for every prop:
 *
 *   a circle lying flat     draws --flat    (0.676) of its width tall
 *   anything standing up    draws --upright (0.737) of its height
 *
 * which is why the glass sits on the wood at the chips' angle, and why the
 * cut does what a real one does: the diamonds wrap all the way round, squeeze
 * toward the edges as the glass turns away, and their rows curve with the
 * rim. A flat CSS pattern laid over a rectangle could do none of that (the
 * owner, 2026-10-23: "make sure the entire whiskey glass has that diamond
 * pattern all around" and "tilted exactly as the table and the chips are").
 *
 * Units: the glass is 100 wide. Real heights are in the same units: the glass
 * stands 90 tall (a tumbler is ~0.9 of its width), its base is 11 thick, and
 * the whiskey is one finger - 10 - on top of the base. On screen that is a box
 * 100 x 133.9 (VIEW_H): half the mouth above the side, half the foot below.
 *
 * Pure, so the tests can hold it to the camera.
 */

export const FLAT = 0.676;
export const UPRIGHT = 0.737;

/** Outer radius, inner radius (the wall is 6 thick), real height, base. */
export const R = 50;
export const R_IN = 44;
export const H = 90;
export const BASE = 11;
/** The whiskey's surface, one finger above the base (the owner: "less"). */
export const SURFACE = BASE + 10;
/** The cut runs from just above the foot to a plain band under the rim. */
const CUT_FROM = 3;
const CUT_TO = 72;

/** The box: half the foot's ellipse, the side, half the mouth's. */
export const VIEW_H = +(R * FLAT * 2 + H * UPRIGHT).toFixed(2);

/** The screen y of the centre of the circle at real height h. */
export function centreY(h: number): number {
	return VIEW_H - R * FLAT - h * UPRIGHT;
}

/** A point on the circle of radius r at height h, angle a (0 = nearest the
 *  viewer, positive toward the right). */
export function project(a: number, h: number, r = R): [number, number] {
	return [50 + r * Math.sin(a), centreY(h) + r * FLAT * Math.cos(a)];
}

const f = (n: number) => +n.toFixed(2);
const pt = ([x, y]: [number, number]) => `${f(x)} ${f(y)}`;

/** An ellipse as an SVG path, so it can be clipped and combined. */
export function ellipsePath(h: number, r: number): string {
	const cy = centreY(h);
	const ry = r * FLAT;
	return `M ${f(50 - r)} ${f(cy)} A ${r} ${f(ry)} 0 1 0 ${f(50 + r)} ${f(cy)} A ${r} ${f(ry)} 0 1 0 ${f(50 - r)} ${f(cy)} Z`;
}

/** The glass's whole outline: the mouth's far half, down the sides, round
 *  the foot's near half. */
export const SILHOUETTE = (() => {
	const top = centreY(H);
	const bottom = centreY(0);
	const ry = R * FLAT;
	return `M 0 ${f(top)} A ${R} ${f(ry)} 0 0 1 100 ${f(top)} L 100 ${f(bottom)} A ${R} ${f(ry)} 0 0 1 0 ${f(bottom)} Z`;
})();

/** The front wall: the outline, less the far half of the mouth - its top
 *  edge is the near lip. */
export const FRONT_WALL = (() => {
	const top = centreY(H);
	const bottom = centreY(0);
	const ry = R * FLAT;
	return `M 0 ${f(top)} A ${R} ${f(ry)} 0 0 0 100 ${f(top)} L 100 ${f(bottom)} A ${R} ${f(ry)} 0 0 1 0 ${f(bottom)} Z`;
})();

export const MOUTH_OUTER = ellipsePath(H, R);
export const MOUTH_INNER = ellipsePath(H, R_IN);

/** The whiskey seen through the glass: its surface's far edge, down its
 *  sides, round the inside floor's near edge. */
export const WHISKY_BODY = (() => {
	const top = centreY(SURFACE);
	const bottom = centreY(BASE);
	const ry = R_IN * FLAT;
	const l = 50 - R_IN;
	const r = 50 + R_IN;
	return `M ${l} ${f(top)} A ${R_IN} ${f(ry)} 0 0 1 ${r} ${f(top)} L ${r} ${f(bottom)} A ${R_IN} ${f(ry)} 0 0 1 ${l} ${f(bottom)} Z`;
})();

export const WHISKY_SURFACE = ellipsePath(SURFACE, R_IN);

/** The thick base, seen through the front: from the inside floor down to the
 *  foot. */
export const BASE_BODY = (() => {
	const top = centreY(BASE);
	const bottom = centreY(0);
	const ry = R * FLAT;
	return `M 0 ${f(top)} L 100 ${f(top)} L 100 ${f(bottom)} A ${R} ${f(ry)} 0 0 1 0 ${f(bottom)} Z`;
})();

/** The star cut on the base's underside, seen through it: spokes from the
 *  middle of the foot. */
export const STAR = (() => {
	const lines: string[] = [];
	const spokes = 16;
	for (let i = 0; i < spokes; i++) {
		const a = (i / spokes) * Math.PI * 2;
		lines.push(`M ${pt(project(0, 1.5, 0))} L ${pt(project(a, 1.5, R_IN * 0.92))}`);
	}
	return lines.join(' ');
})();

// ---- the diamond cut ----------------------------------------------------------

/** How many diamonds round the glass, and how tall each is (real units). */
const AROUND = 22;
const DIAMOND_H = 11.5;

export type Facet = {
	/** The polygon, as SVG points. */
	points: string;
	/** -1 (in shadow) .. +1 (catching the lamp). */
	light: number;
	/** The real height of the facet's middle - for the whiskey's band. */
	h: number;
	/** Whether it is on the near side of the glass. */
	front: boolean;
};

/**
 * Every facet of the cut, near side and far. A diamond is centred on a point
 * of the lattice and split into four triangles from its centre; each faces a
 * slightly different way, so the lamp (upper right) lights the upper-right
 * one most and the lower-left one least, and every facet on the right of the
 * glass more than its twin on the left. Facets whose middle is on the far
 * side are kept too - the cut seen through the glass - and drawn fainter.
 */
export const FACETS: readonly Facet[] = (() => {
	const out: Facet[] = [];
	const dA = (Math.PI * 2) / AROUND;
	const rows = Math.floor((CUT_TO - CUT_FROM) / DIAMOND_H);
	for (let row = 0; row < rows * 2 + 1; row++) {
		const h = CUT_FROM + (row * DIAMOND_H) / 2 + DIAMOND_H / 2;
		if (h + DIAMOND_H / 2 > CUT_TO + 0.01) break;
		const offset = row % 2 === 0 ? 0 : dA / 2;
		for (let i = 0; i < AROUND; i++) {
			const a = i * dA + offset;
			const c = project(a, h);
			const left = project(a - dA / 2, h);
			const right = project(a + dA / 2, h);
			const up = project(a, h + DIAMOND_H / 2);
			const down = project(a, h - DIAMOND_H / 2);
			const front = Math.cos(a) > 0;
			// The lamp is to the upper right: the right of the glass faces it.
			const side = Math.sin(a) * 0.55;
			const tris: [[number, number], [number, number], number][] = [
				[up, right, 0.45], // upper right faces the lamp
				[right, down, 0.05],
				[down, left, -0.5], // lower left faces away
				[left, up, -0.1],
			];
			for (const [p, q, bias] of tris) {
				out.push({
					points: `${pt(c)} ${pt(p)} ${pt(q)}`,
					light: Math.max(-1, Math.min(1, bias + side)),
					h,
					front,
				});
			}
		}
	}
	return out;
})();

/** The cut's grooves - the lattice lines themselves, near side only, as one
 *  path: two families of helices round the cylinder. Where the whiskey is
 *  behind them they glint gold; this is drawn twice, once clipped to it. */
export const GROOVES = (() => {
	const dA = (Math.PI * 2) / AROUND;
	const slope = dA / DIAMOND_H; // radians per unit of height
	const parts: string[] = [];
	// One line per diamond in each direction: a diamond's edges run from its
	// top point to its side points, a slope of dA/2 per DIAMOND_H/2, and the
	// lines through every vertex are a whole diamond apart.
	for (const dir of [1, -1]) {
		for (let i = 0; i < AROUND; i++) {
			const a0 = i * dA;
			let open = false;
			let d = '';
			for (let h = CUT_FROM; h <= CUT_TO + 0.01; h += 1.5) {
				const a = a0 + dir * slope * (h - CUT_FROM);
				const visible = Math.cos(a) > 0.05;
				if (visible) {
					d += `${open ? ' L' : ' M'} ${pt(project(a, h))}`;
					open = true;
				} else {
					open = false;
				}
			}
			if (d) parts.push(d.trim());
		}
	}
	return parts.join(' ');
})();

/** The real-height band the whiskey fills, for the facets that sit in it. */
export function inWhisky(h: number): boolean {
	return h > BASE - 2 && h < SURFACE + 2;
}
