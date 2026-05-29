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

export type RoundContract = {
	roundId: string;
	seed: string;
	deck: Card[];
};

export const createDeck = (): Card[] => {
	const deck: Card[] = [];

	for (const suit of suits) {
		for (const rank of ranks) {
			deck.push({ suit, rank });
		}
	}

	return deck;
};

const hashSeed = (seed: string) => {
	let hash = 2166136261;

	for (let index = 0; index < seed.length; index += 1) {
		hash ^= seed.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return hash >>> 0;
};

const createRandomNumberGenerator = (seed: string) => {
	let state = hashSeed(seed);

	return () => {
		state += 0x6d2b79f5;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
};

const shuffleDeck = (deck: Card[], seed: string) => {
	const random = createRandomNumberGenerator(seed);
	const shuffled = [...deck];

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
	}

	return shuffled;
};

export const createRoundContract = (seed: string): RoundContract => {
	const normalizedSeed = seed.trim() || 'ride-the-bus-default-round';

	return {
		roundId: normalizedSeed,
		seed: normalizedSeed,
		deck: shuffleDeck(createDeck(), normalizedSeed),
	};
};