/**
 * The paytable shown in How to Play, DERIVED from the payout model.
 *
 * Stake's approval checklist requires "payout amounts for all symbol
 * combinations" and "win combinations are displayed in the game rules". This
 * game has no symbols and no fixed paytable - every stage pays its true odds
 * against the cards still in the deck, so the same pick returns a different
 * amount from one round to the next. What CAN be stated exactly is the range
 * each pick can pay, and that is what this produces.
 *
 * Computed from partialMultiplier rather than typed out, so the rules cannot
 * drift from the maths. A hardcoded table would be a slow-motion version of the
 * worst bug this game can have: showing the player one number while the RGS
 * credits another.
 *
 * The enumeration is exhaustive but tiny - 13 ranks for stage 2, 169 rank pairs
 * for stage 3 - so it runs once at module load and costs nothing.
 *
 * NOTE THE `.ts` EXTENSIONS BELOW. Every other module reachable from a test in
 * this app happens to be import-free, so this is the first one that needs them:
 * `node --test` uses Node's ESM resolver, which will not resolve a relative
 * import without its extension. tsconfig.json turns on
 * allowImportingTsExtensions for exactly this reason, and Vite resolves them
 * unchanged. Drop an extension here and the whole test file fails to load.
 */
import { partialMultiplier } from './payout.ts';
import { ranks, rankValue } from './roundContract.ts';

/** Cards of each rank in a full deck. */
const PER_RANK = 4;

export type PayoutRow = {
	/** 1-4, matching the stage the player sees. */
	stage: number;
	/**
	 * English label, which is also the i18n key.
	 *
	 * The literal union rather than `string` is load-bearing, same as
	 * winTiers.ts: `t()` is keyed on the English map and a widened `string` is
	 * not assignable to it, so the popup would not compile.
	 */
	label: 'Red or Black' | 'Higher' | 'Lower' | 'Equal' | 'Inside' | 'Outside' | 'Any suit';
	/** Lowest this pick can pay, as a multiple of the running total. */
	min: number;
	/** Highest it can pay. Equal to `min` when the odds never move. */
	max: number;
};

const values = ranks.map((rank) => rankValue[rank]);

/** Round for display. The game floors the FINAL multiplier to 0.1x, but these
 *  are per-stage factors that compound, so they are shown at 2dp. */
const round2 = (n: number) => Math.round(n * 100) / 100;

const range = (multipliers: number[]) => ({
	min: round2(Math.min(...multipliers)),
	max: round2(Math.max(...multipliers)),
});

/* ---- Stage 1: colour -----------------------------------------------------
   Always 26 of 52, whatever the deck, so red and black are one fixed figure. */
const colour = partialMultiplier(0.5, 0);

/* ---- Stage 2: higher / lower / equal vs card 1 ---------------------------
   51 cards remain. Higher and lower swing on card 1's rank; equal is always the
   3 remaining cards of that same rank, so it is a constant. */
const stage2 = { higher: [] as number[], lower: [] as number[], equal: [] as number[] };
for (const reference of values) {
	let higher = 0;
	let lower = 0;
	for (const other of values) {
		// One card of the reference rank is already face up.
		const count = other === reference ? PER_RANK - 1 : PER_RANK;
		if (other > reference) higher += count;
		else if (other < reference) lower += count;
	}
	const equal = 51 - higher - lower;
	// An ace is never beaten downwards and a king never upwards, so those picks
	// are unreachable rather than free - skip them instead of recording a zero.
	if (higher > 0) stage2.higher.push(partialMultiplier(higher / 51, 1));
	if (lower > 0) stage2.lower.push(partialMultiplier(lower / 51, 1));
	stage2.equal.push(partialMultiplier(equal / 51, 1));
}

/* ---- Stage 3: inside / outside / equal vs cards 1 and 2 ------------------
   50 cards remain. Both bounds move, so this is the widest-swinging stage. */
const stage3 = { inside: [] as number[], outside: [] as number[], equal: [] as number[] };
for (const first of values) {
	for (const second of values) {
		const low = Math.min(first, second);
		const high = Math.max(first, second);
		let inside = 0;
		let outside = 0;
		for (const other of values) {
			let count = PER_RANK;
			if (other === first) count -= 1;
			if (other === second) count -= 1;
			if (other > low && other < high) inside += count;
			else if (other < low || other > high) outside += count;
		}
		const equal = 50 - inside - outside;
		// Adjacent or equal reference cards leave nothing strictly between them;
		// that is the combination isCombinationPlayable already bars.
		if (inside > 0) stage3.inside.push(partialMultiplier(inside / 50, 2));
		if (outside > 0) stage3.outside.push(partialMultiplier(outside / 50, 2));
		if (equal > 0) stage3.equal.push(partialMultiplier(equal / 50, 2));
	}
}

/* ---- Stage 4: suit -------------------------------------------------------
   49 cards remain. Between 10 and 13 of them share any given suit, depending on
   how many of that suit the first three cards took. */
const stage4: number[] = [];
for (let remainingOfSuit = 10; remainingOfSuit <= 13; remainingOfSuit += 1) {
	stage4.push(partialMultiplier(remainingOfSuit / 49, 3));
}

export const PAYOUT_ROWS: readonly PayoutRow[] = [
	{ stage: 1, label: 'Red or Black', min: round2(colour), max: round2(colour) },
	{ stage: 2, label: 'Higher', ...range(stage2.higher) },
	{ stage: 2, label: 'Lower', ...range(stage2.lower) },
	{ stage: 2, label: 'Equal', ...range(stage2.equal) },
	{ stage: 3, label: 'Inside', ...range(stage3.inside) },
	{ stage: 3, label: 'Outside', ...range(stage3.outside) },
	{ stage: 3, label: 'Equal', ...range(stage3.equal) },
	{ stage: 4, label: 'Any suit', ...range(stage4) },
] as const;

/**
 * What a full four-stage win pays, by how many Equal picks it used.
 *
 * Measured by exhaustive enumeration of all 6,497,400 ordered four-card draws
 * against payout.ts - the same figures the win-tier design was built on. Stated
 * as data so the rules and the tests quote one source.
 */
export type WinFamilyRow = {
	label: string;
	average: number;
	max: number;
};

export const FULL_WIN_ROWS: readonly WinFamilyRow[] = [
	{ label: 'No Equal picks', average: 17.3, max: 317.4 },
	{ label: 'One Equal pick', average: 67.5, max: 381.9 },
	{ label: 'Two Equal picks', average: 1329.2, max: 1354.2 },
] as const;

/** What a wrong guess keeps, by the stage it happened at. */
export const BUST_ROWS: readonly { label: string; detail: string }[] = [
	{ label: 'Card 1', detail: 'The round pays nothing.' },
	{ label: 'Card 2', detail: 'You get 0.5× your bet back.' },
	{ label: 'Card 3 or 4', detail: 'You keep 30% of the multiplier built so far.' },
] as const;
