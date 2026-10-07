export interface Card {
	suit: '♥' | '♦' | '♣' | '♠';
	rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
}

export const suits: Card['suit'][] = ['♥', '♦', '♣', '♠'];
export const ranks: Card['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const rankValue: Record<Card['rank'], number> = {
	A: 1,
	'2': 2,
	'3': 3,
	'4': 4,
	'5': 5,
	'6': 6,
	'7': 7,
	'8': 8,
	'9': 9,
	'10': 10,
	J: 11,
	Q: 12,
	K: 13,
};

/**
 * A family's deck, unshuffled: the standard 52, or the ranks and copies a
 * family names for itself (Three of a Kind deals A K Q, one of each).
 * Ranks always come out in `ranks` order so `rankValue` keeps its meaning.
 * Mirrors build_deck(family) in game_calculations.py.
 *
 * Typed structurally rather than importing FamilyRules, so this module stays
 * import-free - it is the leaf the payout maths, the rules screen and the
 * DEV dealer all read card data from.
 */
export type DeckSpecLike = { ranks: readonly Card['rank'][]; copies: number } | null;

export const createDeck = (spec: DeckSpecLike = null): Card[] => {
	const deck: Card[] = [];
	const dealt = spec ? ranks.filter((rank) => spec.ranks.includes(rank)) : ranks;
	const copies = spec ? spec.copies : 1;

	for (let copy = 0; copy < copies; copy += 1) {
		for (const suit of suits) {
			for (const rank of dealt) {
				deck.push({ suit, rank });
			}
		}
	}

	return deck;
};
