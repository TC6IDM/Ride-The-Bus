/**
 * The four suits as path data on a 24x24 grid - the ONE drawing of each.
 *
 * SuitIcon.svelte draws these for every suit mark in the UI (the guess square,
 * the burst, the corner index), and CardFace.svelte draws them again as the
 * pips on a card. They used to live inside SuitIcon's markup, which was fine
 * while it was the only thing drawing a suit; a card face that drew its own
 * heart would have been two hearts in one game, and the court art's own big pip
 * is dropped for exactly that reason (art-masters/courts/README.md).
 *
 * Why suits are drawn at all rather than typed as U+2660..U+2666: SuitIcon's
 * header has the whole argument - the body faces do not own those glyphs, and
 * the fallback on many phones is a colour emoji that ignores the card's red.
 */
export type SuitName = 'heart' | 'diamond' | 'club' | 'spade';
export type SuitChar = '♥' | '♦' | '♣' | '♠';

/** The book writes a card's suit as the character; the UI names it. */
export const SUIT_FROM_CHAR: Record<SuitChar, SuitName> = {
	'♥': 'heart',
	'♦': 'diamond',
	'♣': 'club',
	'♠': 'spade',
};

/** Accepts either spelling, the way every caller that holds a real card does. */
export const suitName = (suit: string): SuitName =>
	(SUIT_FROM_CHAR as Record<string, SuitName>)[suit] ?? (suit as SuitName);

export const isRedSuit = (suit: string): boolean => {
	const n = suitName(suit);
	return n === 'heart' || n === 'diamond';
};

/** A circle as path data, so a club is one list of paths like the others. */
const circle = (cx: number, cy: number, r: number) =>
	`M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/**
 * Each suit as the paths that fill it, drawn inside a 24x24 box. The shapes are
 * the ones SuitIcon has always drawn, unchanged:
 *   heart   - two lobes meeting at a point, squatter than a UI heart; card pips are squat
 *   diamond - a rhombus, taller than wide, points very slightly softened
 *   club    - three lobes and a flared stem, separate shapes; the overlap is what reads as a club
 *   spade   - an inverted heart over a flared stem
 */
export const SUIT_PATHS: Record<SuitName, readonly string[]> = {
	heart: [
		'M12 21.4C12 21.4 2.6 15.1 2.6 9C2.6 5.7 5.1 3.2 8.2 3.2C10 3.2 11.3 4.1 12 5.3C12.7 4.1 14 3.2 15.8 3.2C18.9 3.2 21.4 5.7 21.4 9C21.4 15.1 12 21.4 12 21.4Z',
	],
	diamond: ['M12 2.2C12 2.2 14.4 6.6 19.3 12C14.4 17.4 12 21.8 12 21.8C12 21.8 9.6 17.4 4.7 12C9.6 6.6 12 2.2 12 2.2Z'],
	club: [
		circle(12, 7.1, 4.05),
		circle(6.85, 14.3, 4.05),
		circle(17.15, 14.3, 4.05),
		'M12 12.3C13 16 13.3 18.9 15.2 21.7H8.8C10.7 18.9 11 16 12 12.3Z',
	],
	spade: [
		'M12 2.3C12 2.3 3.4 9 3.4 14C3.4 16.7 5.5 18.6 8 18.6C9.6 18.6 10.9 17.8 11.6 16.7C11.4 18.9 10.6 20.5 9 21.7H15C13.4 20.5 12.6 18.9 12.4 16.7C13.1 17.8 14.4 18.6 16 18.6C18.5 18.6 20.6 16.7 20.6 14C20.6 9 12 2.3 12 2.3Z',
	],
};
