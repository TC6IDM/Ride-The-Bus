/**
 * The worked examples on the intro screen, as data.
 *
 * Eight lookup tables that were 75 lines in the middle of StartScreen.svelte's
 * script. They are pure - no props, no state, no DOM - and they are the whole
 * content of the four demo panels: which reference cards each step is built
 * around, and which card each pick turns up.
 *
 * DELIBERATELY NOT the board's rules. The note on IO_EQUAL_RESULTS and the one
 * about Inside below both record where this screen departs from what the game
 * enforces, and why.
 */

/** A miniature card face: the rank, the suit glyph, and whether it prints red. */
export type MiniCard = { rank: string; suit: string; red: boolean };

/**
 * The pick each step opens on, and what it falls back to when cleared.
 *
 * `locked` in IntroPanels starts from these so the screen opens on a complete
 * four-stage guess rather than four blank controls, and clearing one falls back
 * here for the worked example - so the demo never goes empty.
 */
export const DEFAULTS = { color: 'black', hl: 'higher', io: 'inside', suit: 'heart' } as const;

/*
 * NOTE: the board disables Inside once Equal is picked at stage 2, because
 * that combination is unwinnable and the math publishes no such bet mode.
 * This screen deliberately does NOT copy that rule. Nothing here is a bet -
 * the four controls are a demonstration - so greying out a pick the player
 * is only reading about would stop them seeing what Inside even means. The
 * "?" on this panel explains the restriction in words instead, and the board
 * enforces it where it actually matters.
 */

/** The reference cards the examples are built around. */
export const HL_REF = { rank: '7', suit: '♦', red: true };
export const IO_LOW = { rank: '4', suit: '♣', red: false };
export const IO_HIGH = { rank: '10', suit: '♥', red: true };

/** Card 2 for each Higher / Lower pick, against the 7. */
export const HL_RESULT: Record<string, { rank: string; suit: string; red: boolean }> = {
	higher: { rank: 'J', suit: '♠', red: false },
	lower: { rank: '3', suit: '♥', red: true },
	equal: { rank: '7', suit: '♣', red: false },
};

/** Card 3 for the Inside and Outside picks, against the 4 and the 10. */
export const IO_RESULT: Record<string, { rank: string; suit: string; red: boolean }> = {
	inside: { rank: '7', suit: '♠', red: false },
	outside: { rank: '2', suit: '♦', red: true },
	equal: { rank: '4', suit: '♥', red: true },
};

/**
 * Equal at stage 3 is satisfied by matching the rank of EITHER reference
 * card, not just the first - so both are shown. Suits deliberately differ
 * from the cards they match, because only the rank counts.
 */
export const IO_EQUAL_RESULTS = [
	{ rank: '4', suit: '♥', red: true },
	{ rank: '10', suit: '♠', red: false },
];

// `label` is typed as the literal union rather than string: t() is keyed on
// the English map, and a widened string is not assignable to it.
export const SUIT_GLYPH: Record<
	string,
	{ glyph: string; red: boolean; label: 'Heart' | 'Spade' | 'Club' | 'Diamond' }
> = {
	heart: { glyph: '♥', red: true, label: 'Heart' },
	spade: { glyph: '♠', red: false, label: 'Spade' },
	club: { glyph: '♣', red: false, label: 'Club' },
	diamond: { glyph: '♦', red: true, label: 'Diamond' },
};
