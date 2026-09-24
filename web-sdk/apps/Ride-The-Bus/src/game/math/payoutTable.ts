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
import { decayFor, partialMultiplier, quantizeMultiplier, stageRetention } from './payout.ts';
import { createDeck, ranks, rankValue, type Card } from '../round/roundContract.ts';
import { FAMILY_RULES, FREE_CHOICE, type FamilyRules } from './modes.ts';
import { stageNeed, stagePrice } from './stageOdds.ts';

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
	label: 'Red or Black' | 'Higher' | 'Lower' | 'Equal' | 'Inside' | 'Outside' | 'Any suit' | 'Any card';
	/**
	 * What the figure IS. A `factor` multiplies the running total - the four-guess
	 * tables, where every pick has its own odds and the player compounds them. A
	 * `total` is the running total itself after this card, in multiples of the
	 * bet and including the mode's cost - the fixed family, where there is one
	 * path and the board's chips already show exactly these numbers. Two kinds
	 * rather than one because a table of factors on Three of a Kind read
	 * 1.00 / 3.67 / 5.00 under a "Max win 4583.3x" line and beside chips
	 * reading 250.00 / 916.60 / 4583.30: the same rule in two units, which is
	 * the bug class this game keeps shipping. payoutColumnFor() names the column.
	 */
	kind: 'factor' | 'total';
	/** Lowest this pick can pay (a factor), or the running total (a total). */
	min: number;
	/** Highest it can pay. Equal to `min` when the odds never move. */
	max: number;
};

/** The heading over the figures - "Pays" for factors, "Total" for running totals. */
export function payoutColumnFor(rules: Pick<FamilyRules, 'fixedChoices'>): 'Pays' | 'Total' {
	return rules.fixedChoices ? 'Total' : 'Pays';
}

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
 * stage's multiplier is solved against - High Stakes keeps 15% on a miss
 * instead of 30%, so every figure below moves. Showing Classic's odds to a
 * player on another mode would be the same class of mistake as pricing a stage
 * one way and paying it another.
 *
 * No miss has happened when these are read, so any forgiveness is still in
 * hand and is what the stages are priced against - matching what the player
 * actually faces at the start of a round.
 */
export function payoutRowsFor(rules: FamilyRules = FAMILY_RULES.base): PayoutRow[] {
	if (rules.fixedChoices) return fixedPayoutRows(rules);

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

	const kind = 'factor' as const;
	return [
		{ stage: 1, label: 'Red or Black', kind, min: round2(colour), max: round2(colour) },
		{ stage: 2, label: 'Higher', kind, ...range(s2.higher) },
		{ stage: 2, label: 'Lower', kind, ...range(s2.lower) },
		{ stage: 2, label: 'Equal', kind, ...range(s2.equal) },
		{ stage: 3, label: 'Inside', kind, ...range(s3.inside) },
		{ stage: 3, label: 'Outside', kind, ...range(s3.outside) },
		{ stage: 3, label: 'Equal', kind, ...range(s3.equal) },
		{ stage: 4, label: 'Any suit', kind, ...range(s4) },
	];
}

/**
 * The table for a family with no guesses - Three of a Kind.
 *
 * RUNNING TOTALS, not factors, and that is the whole point of the row `kind`.
 * The deck is symmetric (every rank has the same number of cards) so each
 * stage's factor is a single value - card 1 dealt at 1.00x, card 2 matching 3
 * of 11 at 3.67x, card 3 matching 2 of 10 at 5.00x - but a table of those
 * three sat under "Max win 4583.3x" and beside board chips reading 250.00x,
 * 916.60x and 4583.30x, because the chips are the running total times the
 * 250x cost, in multiples of the BASE bet, which is Stake's unit for every
 * payout figure. Card 1 read 1.00x in the rules and 250.00x on the table. One
 * path means the running total is the natural figure, so that is what each
 * row states: quantized the way the chip is (0.1x floor), so the two print
 * the same digits, and the last row IS the family's maxWin.
 *
 * Computed from the deck and the same functions the round is priced with,
 * like the four-guess table above, and for the same reason: a typed-in
 * 4583.3x is the slow-motion version of the worst bug this game can have.
 * One row per stage the family deals - three here.
 */
function fixedPayoutRows(rules: FamilyRules): PayoutRow[] {
	const choices = rules.fixedChoices!;
	const decay = decayFor(rules);
	const deck = createDeck(rules.deck);
	const perRank = deck.filter((card) => card.rank === deck[0]!.rank).length;
	const label = (stage: number): PayoutRow['label'] =>
		choices[stage] === FREE_CHOICE ? 'Any card' : 'Equal';
	// The odds a match faces at each stage: the copies of card 1's rank still
	// in the deck over the cards left. A free card is p = 1.
	const probability = (stage: number) =>
		choices[stage] === FREE_CHOICE ? 1 : (perRank - stage) / (deck.length - stage);
	// Compounded at full precision and scaled by the cost BEFORE quantizing,
	// exactly as roundReveal.svelte.ts builds the chip for each card.
	let running = 1;
	return choices.map((_, stage) => {
		running *= partialMultiplier(probability(stage), stage, stageRetention(rules, stage, false), decay);
		const total = quantizeMultiplier(running * rules.cost);
		return { stage: stage + 1, label: label(stage), kind: 'total', min: total, max: total };
	});
}

/** The Classic table, kept for callers that predate the mode families. */
export const PAYOUT_ROWS: readonly PayoutRow[] = payoutRowsFor(FAMILY_RULES.base);

/**
 * The worked example in How to Play - "with a 3 on the table, Lower pays
 * about 4.75x..." - as figures, for one mode family.
 *
 * Computed, and per family, for the same reason as the table above. The
 * sentence used to carry Classic's five numbers typed into the copy and sat
 * ABOVE the mode tabs, so a High Stakes player read 4.75x on a page whose own
 * paytable, two paragraphs down, said 5.28x - and a reviewer checking a
 * High Stakes round against the rules found the board and the rules
 * disagreeing. Retention is what each stage's multiplier is solved against,
 * so the example moves with the family exactly as the table does.
 *
 * Card 2 against a 3: two ranks (A, 2) are lower = 8 of 51; ten ranks are
 * higher = 40 of 51. Against an 8: seven ranks lower = 28; five higher = 20.
 * Equal is always the 3 remaining cards of the rank, whatever it is.
 */
export type OddsExample = {
	lowerOn3: number;
	higherOn3: number;
	lowerOn8: number;
	higherOn8: number;
	equal: number;
};

export function oddsExampleFor(rules: FamilyRules = FAMILY_RULES.base): OddsExample {
	const retention = stageRetention(rules, 1, false);
	const at = (cards: number) => round2(partialMultiplier(cards / 51, 1, retention));
	return {
		lowerOn3: at(8),
		higherOn3: at(40),
		lowerOn8: at(28),
		higherOn8: at(20),
		equal: at(3),
	};
}

/**
 * One dealt round, for How to Play's example: each card, the pick it met, how
 * many cards could have met it, and the running total after it - the figures
 * the board itself would show for this deal on this family.
 *
 * Priced through stageNeed / stagePrice, which stageOdds.test.ts holds to the
 * published books, so the example cannot quote a figure the game would not
 * pay. The deal is fixed - 7♥, J♠, 2♣, 9♥ called Red, Higher, Outside, Heart -
 * chosen so every stage reads at a glance and the round lands; the figures move with
 * the family, which is the point of drawing it on every tab. The guess
 * families only: Three of a Kind's table already IS its one round.
 */
export type ExampleStep = {
	card: Card;
	choice: string;
	hits: number;
	total: number;
	/** Rounded down to 0.1x at each step, exactly as the board's chips are. */
	runningTotal: number;
};

export const EXAMPLE_DEAL: readonly { card: Card; choice: string }[] = [
	{ card: { rank: '7', suit: '♥' }, choice: 'red' },
	{ card: { rank: 'J', suit: '♠' }, choice: 'higher' },
	{ card: { rank: '2', suit: '♣' }, choice: 'outside' },
	{ card: { rank: '9', suit: '♥' }, choice: 'heart' },
];

export function exampleRoundFor(rules: FamilyRules = FAMILY_RULES.base): ExampleStep[] {
	let running = 1;
	const dealt: Card[] = [];
	return EXAMPLE_DEAL.map(({ card, choice }, stage) => {
		const need = stageNeed(rules, stage, choice, dealt);
		running *= stagePrice(rules, stage, need, false);
		dealt.push(card);
		return { card, choice, hits: need.hits, total: need.total, runningTotal: quantizeMultiplier(running * rules.cost) };
	});
}

/* FULL_WIN_ROWS used to live here: a three-row breakdown of what a full win
   pays by how many Equal picks it used (17.3x / 67.5x / 1329.2x average, topping
   out at 1354.2x). It was removed rather than made per-family because nothing
   renders it any more - How to Play states each family's ceiling from
   FAMILY_RULES.maxWin - and as BASE-ONLY figures sitting next to a per-family
   panel it was a trap: the obvious way to use it would have shown Classic's
   numbers on every mode, which is the same bug winTiersFor exists to fix.
   Recover it from git history if the breakdown is ever wanted back, per family. */

/**
 * What a wrong guess costs, for one mode family.
 *
 * Per family and computed, because the answer genuinely differs and used to be
 * stated as though it did not. The old fixed list said "Card 2 - you get 0.5x
 * your bet back" AND "you keep 30%", which reads as a contradiction: both are
 * true of Classic (30% of the running total at card 2 happens to be 0.5x the
 * bet) but only of Classic. High Stakes keeps 15%, Second Chance forgives the
 * first miss, and Three of a Kind keeps nothing at all.
 *
 * The card-2 figure is derived rather than typed. The running multiplier
 * entering stage 1 is always the colour pick, which is always 26 of 52, so the
 * value is fixed per family and can be quoted exactly.
 */
export type BustRow = {
	/** English text, which is also the i18n key. */
	label: 'Card 1' | 'Card 2, 3 or 4' | 'Your first wrong guess' | 'Your second wrong guess' | 'A card that does not match';
	/**
	 * The i18n KEY for the sentence, not the sentence.
	 *
	 * These used to be already-substituted English, rendered straight into the
	 * popup as `{row.detail}` - so the whole "If you guess wrong" section was the
	 * one block of player-visible copy that never went through `t()`. Two things
	 * followed, and neither was visible to any existing test: the rules read in
	 * English in all sixteen other locales, and in social mode "the round ends
	 * and PAYS nothing" survived, which is a term Stake prohibits outright.
	 * `locales.test.ts` could not see it because it walks the catalogues, and
	 * these strings were never in one.
	 *
	 * A key plus a number rather than a formatted string, because the retention
	 * genuinely varies by family - the `%s` is substituted at the call site the
	 * same way every other parameterised string in this game is.
	 */
	key:
		| 'The round ends and pays nothing.'
		| 'The round ends, keeping about %s% of what you had built.'
		| 'From card 2 on, it is forgiven: you keep %s% of what you had built and the round carries on.';
	/** Percentage to substitute for `%s`, or null when the sentence takes none. */
	percent: number | null;
};

/**
 * ONE UNIT PER RULE, which is why every row below speaks in percent.
 *
 * The retention is a share of the RUNNING MULTIPLIER. A bet multiple is a
 * different quantity, and listing "Card 2 - 0.5x your bet" beside "Card 3 or 4
 * - keep 30%" put both in one list and read as two rules when it is one rule
 * seen twice: 30% of the colour pick's 1.99x IS 0.5x the bet. On High Stakes it
 * was worse, because "0.3x" sits close enough to "15%" to be read as a third
 * number. Do not reintroduce a bet multiple here - payoutTable.test.ts fails if
 * one appears.
 */
export function bustRowsFor(rules: FamilyRules = FAMILY_RULES.base): BustRow[] {
	// "About", because it is not exactly this. A bust keeps
	// retention x DECAY^(stages never played) - see computeFinalMultiplier -
	// so a card-2 miss on Classic banks 29.85% of the running total, not 30%,
	// and on a 10.00x total the board settles 2.9x where a player computing
	// 30% expects 3.0x. The sentence used to state the bare figure; a reviewer
	// checking a bust against the rules would have found them disagreeing.
	// Forgiveness (below) carries no decay term, so its figure IS exact.
	const laterPercent = Math.round(rules.retention[1]! * 100);

	// Card 1 is never forgiven in any family, so it always reads the same.
	const first: BustRow = {
		label: 'Card 1',
		key: 'The round ends and pays nothing.',
		percent: null,
	};

	// Nothing on any miss, in one row: the family that keeps nothing has one
	// rule, and listing it per card would be the same sentence three times.
	// Not "a wrong guess" - nothing on this family is guessed; a card either
	// matches card 1 or the round is over.
	if (rules.fixedChoices) {
		return [{ label: 'A card that does not match', key: 'The round ends and pays nothing.', percent: null }];
	}

	if (rules.forgive !== null) {
		const kept = Math.round(rules.forgive * 100);
		return [
			first,
			{
				label: 'Your first wrong guess',
				key: 'From card 2 on, it is forgiven: you keep %s% of what you had built and the round carries on.',
				percent: kept,
			},
			{
				label: 'Your second wrong guess',
				key: 'The round ends, keeping about %s% of what you had built.',
				percent: laterPercent,
			},
		];
	}

	return [
		first,
		{
			label: 'Card 2, 3 or 4',
			key: 'The round ends, keeping about %s% of what you had built.',
			percent: laterPercent,
		},
	];
}
