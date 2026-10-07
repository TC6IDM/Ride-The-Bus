/**
 * Where everything sits on a card face - pips, corner index, court frame - in
 * the face's own 200 x 298 units. Pure data, so it can be tested without a
 * browser; CardFace.svelte draws it.
 *
 * 200 x 298 IS THE BOARD CARD'S SHAPE: --card-w : --card-h is 9.27 : 13.8
 * (base.css), which is 200 : 297.7. The takeover's fan cards are a shade wider
 * (7.4 : 10.4) and the face centres in them.
 *
 * THE LAYOUT IS A REAL DECK'S. Numbers 2-10 carry their value in pips on the
 * standard Anglo-American grid, and a pip past the middle of the card is turned
 * upside down - the detail that makes a face read as printed rather than drawn.
 * The courts use the English pattern's own geometry, scaled from the 360 x 540
 * masters (art-masters/courts/): a frame with its top-left and bottom-right
 * corners cut away, the corner index sitting in the cut, and a suit pip beside
 * each head. The index sits in the same place on every card, number or court,
 * because that is the corner a player reads when cards overlap.
 */

export const FACE_W = 200;
export const FACE_H = 298;
const CX = FACE_W / 2;
const CY = FACE_H / 2;

/** The masters' card, which the court geometry below is scaled from. */
const MASTER_W = 360;
const MASTER_H = 540;
const sx = (x: number) => (x * FACE_W) / MASTER_W;
const sy = (y: number) => (y * FACE_H) / MASTER_H;

export type FaceKind = 'pips' | 'ace' | 'court';

const COURTS = new Set(['J', 'Q', 'K']);

export function faceKind(rank: string): FaceKind {
	if (rank === 'A') return 'ace';
	if (COURTS.has(rank)) return 'court';
	return 'pips';
}

// ---- Corner index ---------------------------------------------------------
/**
 * The rank and its suit, top-left; the bottom-right copy is the same group
 * turned 180 degrees about the card's centre.
 *
 * Measured, not guessed: Big Shoulders 700 has a cap height of 0.8em and "10",
 * the one two-glyph rank, inks 0.684em. At 36 units the cap is 28.8 - the
 * masters' own index letter is 27.6 - and "10" is 24.6 wide, centred at x 17,
 * so it spans 4.7 to 29.3: inside the court frame's cut corner, which opens to
 * x 33.3. components/app.css has why the ranks are this face at all.
 */
export const INDEX = {
	x: 17,
	/** Baseline: the cap top lands at y 16.6, where the masters' letter starts. */
	baseline: 45.4,
	fontSize: 36,
	pipSize: 20,
	pipY: 60.4,
} as const;

/**
 * Below a card this narrow on screen (CSS px), pips would be specks: ten of them
 * on Popout S's 32 px card come out about 5 px each. A compact face keeps one
 * large pip and a larger index instead - the two marks that survive being small,
 * which is how the takeover's fan read before this face existed.
 */
export const COMPACT_BELOW_PX = 46;

/** The compact face's index, scaled from INDEX about the corner. */
export const COMPACT_INDEX_SCALE = 1.3;

// ---- Pips (2-10) ------------------------------------------------------------
/**
 * 42 units is 21% of the card's width - printed decks run 17-20% - because a
 * suit shape inks only ~78% of its box (suitPaths.ts draws them inside a 24
 * grid with margins). At 34 the first cut read as a sparse card with small pips.
 */
export const PIP_SIZE = 42;

/** Pip column centres: left, middle, right. */
// 43 either side of centre: a whole pip clear of the 10's middle pair, and
// 9 units clear of the corner index's pip on the 4-10's top row.
const COL = { l: 57, c: CX, r: FACE_W - 57 } as const;

/** The pip field's top and bottom row centres; the middle row is the card's. */
const TOP = 58;
const BOTTOM = FACE_H - TOP;
const at = (f: number) => TOP + (BOTTOM - TOP) * f;

/**
 * Rows as fractions of the field, per column. This is the standard layout: the
 * 7 is the only one that is not point-symmetric (its single middle pip sits in
 * the upper half), exactly as printed decks have it.
 */
const LAYOUT: Record<string, { side: number[]; centre: number[] }> = {
	'2': { side: [], centre: [0, 1] },
	'3': { side: [], centre: [0, 0.5, 1] },
	'4': { side: [0, 1], centre: [] },
	'5': { side: [0, 1], centre: [0.5] },
	'6': { side: [0, 0.5, 1], centre: [] },
	'7': { side: [0, 0.5, 1], centre: [0.25] },
	'8': { side: [0, 0.5, 1], centre: [0.25, 0.75] },
	'9': { side: [0, 1 / 3, 2 / 3, 1], centre: [0.5] },
	'10': { side: [0, 1 / 3, 2 / 3, 1], centre: [1 / 6, 5 / 6] },
};

export type Pip = { x: number; y: number; inverted: boolean };

/**
 * The pips for a number card, or none for A, J, Q and K. A pip below the
 * card's middle is inverted; one ON the middle is upright, as printed.
 */
export function pipLayout(rank: string): Pip[] {
	const spec = LAYOUT[rank];
	if (!spec) return [];
	const pip = (x: number, f: number): Pip => {
		const y = at(f);
		return { x, y, inverted: y > CY + 0.01 };
	};
	return [
		...spec.side.flatMap((f) => [pip(COL.l, f), pip(COL.r, f)]),
		...spec.centre.map((f) => pip(COL.c, f)),
	];
}

// ---- Aces ---------------------------------------------------------------------
/**
 * One large pip. The Ace of Spades is the house card - engraved, crowned, and
 * carrying the house name under it, the way a casino deck prints its maker's
 * mark on that one ace (the backs print the same name; tokens.css,
 * --brand-wordmark). Crown over spade is the Takeover Casino mark itself.
 */
export const ACE = {
	pipSize: 92,
	spadeSize: 108,
	/** Centred on the card, a shade low, so the crown above it clears the index. */
	spadeY: CY - 5,
	crownY: 77,
	crownSize: 40,
	nameY: [228, 244] as const,
	nameSize: 12.5,
} as const;

// ---- Courts -------------------------------------------------------------------
/**
 * The English pattern's frame: two L-shaped lines, their open corners at the
 * top-left and bottom-right where the index sits. Straight from the masters -
 * (60,30)-(330,30)-(330,390) and (30,150)-(30,510)-(300,510) - scaled.
 */
export const COURT_FRAME = [
	`M${sx(60)} ${sy(30)}H${sx(330)}V${sy(390)}`,
	`M${sx(30)} ${sy(150)}V${sy(510)}H${sx(300)}`,
] as const;

/** Where the figure goes: the panel the frame encloses (the masters' 30,30 300x480). */
export const COURT_PANEL = { x: sx(30), y: sy(30), w: sx(300), h: sy(480) } as const;

/**
 * The suit pip beside the head, where the masters had their own (dropped, so
 * the game has one drawing of each suit): the box (60,45)-(120,135), centred -
 * and the Takeover crown over it (owner's call, 2026-09-26), the house mark's
 * crown on every court, in gold so it never touches the Red/Black read. The
 * pair shares the box the masters' single pip had, so the figure is untouched.
 */
export const COURT_PIP = { x: sx(90), y: sy(90) + 6, size: 26 } as const;
export const COURT_CROWN = { x: sx(90), y: sy(90) - 15, size: 22 } as const;

/** The card's centre, for turning the bottom half of anything. */
export const FACE_CENTRE = { x: CX, y: CY } as const;

/** The sprite's symbol for a court: court-KS, court-QH, ... */
export function courtSymbol(rank: string, suit: string): string {
	const s = ({ '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C', spade: 'S', heart: 'H', diamond: 'D', club: 'C' } as Record<string, string>)[suit];
	return `court-${rank}${s}`;
}
