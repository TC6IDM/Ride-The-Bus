/**
 * The seeded card shuffler. DEV ONLY - this module must not reach production.
 *
 * It lives apart from roundContract.ts for one reason: keeping a real-money
 * bundle free of a card generator. Game.svelte reaches it through a dynamic
 * import inside an `import.meta.env.DEV` branch, so Vite can prove the branch
 * dead and drop the module.
 *
 * That only works if NOTHING imports this statically. roundContract.ts holds
 * the card data - Card, suits, ranks, rankValue, createDeck - which the
 * paytable, the rules screen and localRound all legitimately need; while the
 * shuffler sat in that same file, those static imports pulled the whole module
 * into the graph and the dynamic import bought nothing. Vite said so on every
 * build ("dynamically imported by Game.svelte but also statically imported by
 * ..., dynamic import will not move module into another chunk"), and the
 * shuffler shipped anyway.
 *
 * So: import card DATA from roundContract, and import THIS only dynamically.
 * A real-money build should not carry a card generator even as dead code - it
 * is the first thing an auditor reading the bundle would query.
 */
import { createDeck, type Card } from './roundContract.ts';

export type RoundContract = {
	roundId: string;
	seed: string;
	deck: Card[];
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
