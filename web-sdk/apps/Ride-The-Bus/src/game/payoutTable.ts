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
import { partialMultiplier, stageRetention } from './payout.ts';
import { ranks, rankValue } from './roundContract.ts';
import { FAMILY_RULES, type FamilyRules } from './modes.ts';

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

/**
 * Build the table for one mode family.
 *
 * A function of the family, not a constant, because retention is what every
 * stage's multiplier is solved against - High Stakes keeps 20% on a miss
 * instead of 30%, so every figure below moves. Showing Classic's odds to a
 * player on another mode would be the same class of mistake as pricing a stage
 * one way and paying it another.
 *
 * No miss has happened when these are read, so any forgiveness is still in
 * hand and is what the stages are priced against - matching what the player
 * actually faces at the start of a round.
 */
export function payoutRowsFor(rules: FamilyRules = FAMILY_RULES.base): PayoutRow[] {
	const retentionAt = (stage: number) => stageRetention(rules, stage, false);

	/* Stage 1: always 26 of 52, so red and black are one fixed figure. */
	const colour = partialMultiplier(0.5, 0, retentionAt(0));

	/* Stage 2: 51 cards remain. Higher and lower swing on card 1's rank; equal
	   is always the 3 remaining cards of that rank, so it is a constant. */
	const s2 = { higher: [] as number[], lower: [] as number[], equal: [] as number[] };
	for (const reference of values) {
		let higher = 0;
		let lower = 0;
		for (const other of values) {
			const count = other === reference ? PER_RANK - 1 : PER_RANK;
			if (other > reference) higher += count;
			else if (other < reference) lower += count;
		}
		const equal = 51 - higher - lower;
		// An ace is never beaten downwards nor a king upwards - unreachable
		// rather than free, so those are skipped instead of recorded as zero.
		if (higher > 0) s2.higher.push(partialMultiplier(higher / 51, 1, retentionAt(1)));
		if (lower > 0) s2.lower.push(partialMultiplier(lower / 51, 1, retentionAt(1)));
		s2.equal.push(partialMultiplier(equal / 51, 1, retentionAt(1)));
	}

	/* Stage 3: 50 remain, and both bounds move - the widest-swinging stage. */
	const s3 = { inside: [] as number[], outside: [] as number[], equal: [] as number[] };
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
			// Adjacent or equal references leave nothing strictly between them -
			// the combination isCombinationPlayable already bars.
			if (inside > 0) s3.inside.push(partialMultiplier(inside / 50, 2, retentionAt(2)));
			if (outside > 0) s3.outside.push(partialMultiplier(outside / 50, 2, retentionAt(2)));
			if (equal > 0) s3.equal.push(partialMultiplier(equal / 50, 2, retentionAt(2)));
		}
	}

	/* Stage 4: 49 remain, of which 10-13 share any given suit. */
	const s4: number[] = [];
	for (let left = 10; left <= 13; left += 1) {
		s4.push(partialMultiplier(left / 49, 3, retentionAt(3)));
	}

	return [
		{ stage: 1, label: 'Red or Black', min: round2(colour), max: round2(colour) },
		{ stage: 2, label: 'Higher', ...range(s2.higher) },
		{ stage: 2, label: 'Lower', ...range(s2.lower) },
		{ stage: 2, label: 'Equal', ...range(s2.equal) },
		{ stage: 3, label: 'Inside', ...range(s3.inside) },
		{ stage: 3, label: 'Outside', ...range(s3.outside) },
		{ stage: 3, label: 'Equal', ...range(s3.equal) },
		{ stage: 4, label: 'Any suit', ...range(s4) },
	];
}

/** The Classic table, kept for callers that predate the mode families. */
export const PAYOUT_ROWS: readonly PayoutRow[] = payoutRowsFor(FAMILY_RULES.base);

/* FULL_WIN_ROWS used to live here: a three-row breakdown of what a full win
   pays by how many Equal picks it used (17.3x / 67.5x / 1329.2x average, topping
   out at 1354.2x). It was removed rather than made per-family because nothing
   renders it any more - How to Play states each family's ceiling from
   FAMILY_RULES.maxWin - and as BASE-ONLY figures sitting next to a per-family
   panel it was a trap: the obvious way to use it would have shown Classic's
   numbers on all three modes, which is the same bug winTiersFor exists to fix.
   Recover it from git history if the breakdown is ever wanted back, per family. */

/**
 * What a wrong guess costs, for one mode family.
 *
 * Per family and computed, because the answer genuinely differs and used to be
 * stated as though it did not. The old fixed list said "Card 2 - you get 0.5x
 * your bet back" AND "you keep 30%", which reads as a contradiction: both are
 * true of Classic (30% of the running total at card 2 happens to be 0.5x the
 * bet) but only of Classic. High Stakes keeps 20%, and Second Chance forgives
 * the first miss entirely.
 *
 * The card-2 figure is derived rather than typed. The running multiplier
 * entering stage 1 is always the colour pick, which is always 26 of 52, so the
 * value is fixed per family and can be quoted exactly.
 */
export type BustRow = {
	/** English text, which is also the i18n key. */
	label: 'Card 1' | 'Card 2, 3 or 4' | 'Your first wrong guess' | 'Your second wrong guess';
	/** Already-substituted sentence; the caller renders it as-is. */
	detail: string;
};

/**
 * ONE UNIT PER RULE, which is why every row below speaks in percent.
 *
 * The retention is a share of the RUNNING MULTIPLIER. A bet multiple is a
 * different quantity, and listing "Card 2 - 0.5x your bet" beside "Card 3 or 4
 * - keep 30%" put both in one list and read as two rules when it is one rule
 * seen twice: 30% of the colour pick's 1.99x IS 0.5x the bet. On High Stakes it
 * was worse, because "0.3x" sits close enough to "20%" to be read as a third
 * number. Do not reintroduce a bet multiple here - payoutTable.test.ts fails if
 * one appears.
 */
export function bustRowsFor(rules: FamilyRules = FAMILY_RULES.base): BustRow[] {
	const laterPercent = Math.round(rules.retention[1]! * 100);

	// Card 1 is never forgiven in any family, so it always reads the same.
	const first: BustRow = { label: 'Card 1', detail: 'The round ends and pays nothing.' };

	if (rules.forgive !== null) {
		const kept = Math.round(rules.forgive * 100);
		return [
			first,
			{
				label: 'Your first wrong guess',
				detail: `From card 2 on, it is forgiven — you keep ${kept}% of what you had built and the round carries on.`,
			},
			{
				label: 'Your second wrong guess',
				detail: `The round ends, keeping ${laterPercent}% of what you had built.`,
			},
		];
	}

	return [
		first,
		{
			label: 'Card 2, 3 or 4',
			detail: `The round ends, keeping ${laterPercent}% of what you had built.`,
		},
	];
}
