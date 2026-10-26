/**
 * What the two characters in the back room do, and when - as data.
 *
 * THE BOSS (right, seated, cigar) and THE FLOORMAN (left, standing) are
 * scenery: painted figures (static/characters/, built by
 * scripts/character-art.py from art-masters/characters/), behind the table and
 * the whole board, and never catching a click. CHARACTER.MD has the brief.
 *
 * Every move here is a swap between whole frames of one painting, each locked
 * to its master so only the part that moves changes. A move is a SCRIPT: the
 * poses it passes through and when, in ms from its start. cast.svelte.ts plays
 * them; this file holds no state, so the tests can read it.
 *
 * THE RULE THAT MATTERS: neither man reacts to a result before the cards show
 * it - with ONE exception the owner chose (2026-10-23), the early puff below.
 * Otherwise their one anticipation is the HELD last card - the hum and the
 * squeeze - which is decided from what was bet and what is already face up
 * (lastCardHolds / lastCardHoldMs in winTiers.ts), never from the outcome. The
 * puff and the lean ride that hold; the exhale comes on the turn WHATEVER the
 * card shows. A puff keyed to "this round will win" would be a tell: a player
 * would learn to watch the Boss instead of the cards. The reactions to a
 * result (the salute, the hat tip) come only after a win has been shown -
 * when its takeover is dismissed - and only sometimes (reactionTo).
 */

export type BossPose = 'idle' | 'blink' | 'puff' | 'high' | 'mid' | 'low' | 'raise' | 'turn' | 'look';
export type FloormanPose = 'idle' | 'blink' | 'glance' | 'hattip';

export type Step<P> = { pose: P; at: number };

/** One frame of an arm's journey, for the moves that pass through several. */
export const STEP_MS = 120;

/**
 * The cigar to his lips, as the last card goes out to be held. The three
 * lowering frames played BACKWARDS are the lift: low -> mid -> high -> puff, the
 * cigar turning from pointing out past the chair arm to pointing forward from
 * his mouth. He holds the puff until the card turns, however long that is.
 */
export const BOSS_PUFF: readonly Step<BossPose>[] = [
	{ pose: 'low', at: 0 },
	{ pose: 'mid', at: STEP_MS },
	{ pose: 'high', at: STEP_MS * 2 },
	{ pose: 'puff', at: STEP_MS * 3 },
];

/**
 * The card has turned: the cigar comes down, slower than it went up, with the
 * plume leaving his lips on the first frame (cast.svelte.ts sends it).
 */
export const BOSS_EXHALE: readonly Step<BossPose>[] = [
	{ pose: 'high', at: 0 },
	{ pose: 'mid', at: 420 },
	{ pose: 'low', at: 640 },
	{ pose: 'idle', at: 860 },
];

/**
 * The EARLY puff, at the deal, on half the rounds whose last card will be held
 * (round.bossPuffsEarly - the owner's call, 2026-10-23: rare, and a sign the
 * game is going long). He lifts the cigar after the deal's riffle and KEEPS
 * PUFFING - the cigar at his lips, a breath of smoke now and then - through
 * cards 1 to n-1 and the hold, until the held card turns. An earlier version
 * put it down after one draw and picked it up again for the hold, which read
 * as two separate thoughts (the owner: "he should just keep puffing the whole
 * time").
 */
export const BOSS_EARLY_PUFF_DELAY_MS = 700;

/** While he is puffing, a small breath of smoke leaves his lips this often -
 *  the first a little after the cigar reaches them. */
export const PUFF_BREATH_FIRST_MS = 650;
export const PUFF_BREATH_EVERY_MS = 1500;

/**
 * After a full game win: the cigar raised in a small toast, his head turning
 * from the table to the player, held, and back the same way.
 */
export const BOSS_SALUTE: readonly Step<BossPose>[] = [
	{ pose: 'raise', at: 0 },
	{ pose: 'turn', at: 200 },
	{ pose: 'look', at: 380 },
	{ pose: 'turn', at: 2600 },
	{ pose: 'raise', at: 2780 },
	{ pose: 'idle', at: 3000 },
];

/** The Floorman's answer: a tip of the hat. */
export const FLOORMAN_HATTIP: readonly Step<FloormanPose>[] = [
	{ pose: 'hattip', at: 260 },
	{ pose: 'idle', at: 2200 },
];

// ---- who is impressed ------------------------------------------------------------

export type Reaction = 'none' | 'floorman' | 'boss' | 'both';

/** When both react, the Boss answers this long after the Floorman. */
export const BOTH_STAGGER_MS = 700;

/**
 * WHO REACTS TO A WIN, AND HOW OFTEN (the owner, 2026-10-23: saluting every
 * takeover "is too basic ... make the salutes feel more special as if the
 * bosses are actually impressed").
 *
 * A MAX win moves both, always - on every family. That includes Three of a
 * Kind, whose one win IS its Max: it comes 1 in 19, but it is the most the
 * mode pays and 4,583x the base bet (the owner, 2026-10-23, after seeing it
 * go unremarked - the rarity rule below had made it the least impressive win
 * in the game, a reaction about once in twenty).
 *
 * Below Max, keyed on how RARE the win was - the tier's published one-in
 * figure (winTiers.ts), which every family states for its own ladder - so it
 * means the same on every ladder. With L = log10(oneIn):
 *
 *   P(anyone reacts)      (L - 1.2) / 3     floored at 5%, capped at 100%
 *   P(both | someone)     (L - 2.3) / 2     0 to 100%
 *   P(Floorman | one)     1 - (L - 1.5) / 3 between 25% and 85%
 *
 * The Floorman is the easier to impress: on a small win it is his polite tip
 * of the hat, on a big one the Boss himself raises his cigar. On Classic's
 * ladder that comes to:
 *
 *   Big   (1 in 70)      Floorman 18%  Boss 3%   both 0%   no one 79%
 *   Huge  (1 in 305)     Floorman 26%  Boss 13%  both 4%   no one 57%
 *   Mega  (1 in 3,092)   Floorman 10%  Boss 21%  both 46%  no one 24%
 *   Epic  (1 in 15,561)  Floorman 1%   Boss 4%   both 94%  no one 0%
 *   Max   (1 in 36,384)  both, always
 *
 * And they do not stay impressed: if either reacted to one of the last two
 * takeovers, a win short of Max is only 40% as likely to move them again.
 */
export function reactionTo(
	tier: { id: string; oneIn: number },
	reactedRecently: boolean,
	random: () => number = Math.random,
): Reaction {
	if (tier.id === 'max') return 'both';
	const L = Math.log10(Math.max(tier.oneIn, 1));
	const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
	let react = clamp((L - 1.2) / 3, 0.05, 1);
	if (reactedRecently && L < 4.4) react *= 0.4;
	if (random() >= react) return 'none';
	if (random() < clamp((L - 2.3) / 2, 0, 1)) return 'both';
	return random() < clamp(1 - (L - 1.5) / 3, 0.25, 0.85) ? 'floorman' : 'boss';
}

/** How long a blink holds its frame, and the gap between blinks (random). */
export const BLINK_MS = 140;
export const BLINK_GAP_MS: readonly [number, number] = [3500, 7500];

/** The Floorman's glance across the room: between rounds only, now and then. */
export const GLANCE_MS = 1300;
export const GLANCE_GAP_MS: readonly [number, number] = [16000, 32000];

/** The poses each man's frames must cover - what the art script builds. */
export const BOSS_POSES: readonly BossPose[] = ['idle', 'blink', 'puff', 'high', 'mid', 'low', 'raise', 'turn', 'look'];
export const FLOORMAN_POSES: readonly FloormanPose[] = ['idle', 'blink', 'glance', 'hattip'];

/** A random wait in a [min, max] range. */
export function gap([min, max]: readonly [number, number], random: () => number = Math.random): number {
	return min + (max - min) * random();
}
