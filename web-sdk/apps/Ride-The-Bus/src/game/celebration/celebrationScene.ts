/**
 * The takeover's scene geometry: how the fan sits. (The suit-mark burst that
 * also lived here went on 2026-10-18; the chips that replaced it fly from
 * chipStream.ts.)
 *
 * Pure - no props, no state, no DOM - which is the whole reason it is worth
 * having out here. winCelebration.test.ts could previously only GREP the
 * component for these invariants, and the one about the fan opening wider at
 * every tier had to read the stylesheet to do it. Both are now arithmetic a
 * unit test can just call.
 *
 * Computed in TypeScript rather than in CSS on purpose: see the note on the
 * fan below (sibling-index() is too new for the devices Stake tests on).
 */

/**
 * The fan of the round's own cards - the thing this screen is made of.
 *
 * The player just named four cards; the celebration should be built out of
 * them rather than out of gradients.
 *
 * IN PRACTICE ALL FOUR ARE FACES. The reveal loop deals every card in the
 * book whether the round busted or not - a bust marks the card, it does not
 * stop the deal - so any round that reached a celebration has four of them.
 * The face-down branch is a fallback for a null slot, not a described
 * behaviour: do not write copy or tests that promise a back.
 *
 * THE FAN MARKS WHAT ACTUALLY HAPPENED. A round can reach this screen without
 * being a clean sweep - a bust on the last card keeps its retention and
 * Classic reaches 129x that way, and a Second Chance round can spend its
 * forgiveness and still finish big. Four cards that all look equally good
 * would be telling the player they got four right when they did not.
 *
 * The marks are the BOARD'S OWN, not new ones: a red cross for the card that
 * ended the round, an amber return arrow for the one a Second Chance let off.
 * cards.css explains why those two must differ - "a red cross says the round
 * ended here, and this one carried on" - and the celebration would undo that
 * distinction by inventing its own pair.
 *
 * Showing only the successful cards was the alternative and is worse: it
 * throws away which guess failed and what the card was, and it makes the fan
 * a different width depending on the round.
 *
 * EXACTLY THREE SHAPES REACH THIS SCREEN, and at most one mark:
 *
 *   no marks   a clean sweep, in any family
 *   one cross  a bust - Classic and High Stakes, where the first miss ends
 *              the round. A miss on card 1 keeps nothing (retention[0] is 0)
 *              and so pays zero, which never celebrates.
 *   one arrow  Second Chance, forgiven and then finished
 *
 * A fourth shape exists in the books and CANNOT get here: a Second Chance
 * round that spends its forgiveness AND then busts. Both haircuts land on one
 * round - forgiveness takes half the running multiplier, the bust keeps 30%
 * of what is left - and it never clears the entry tier. Measured over every
 * drawable round of sc_red_equal_equal_heart, the family's highest-ceiling
 * mode: 382,729 of them, best payout 2.6x, against an 11x floor.
 *
 * So the two marks are mutually exclusive in practice, and the {:else if}
 * below is defensive rather than load-bearing. Left as an else-if anyway: if
 * a future retention or forgiveness change makes the shape reachable, one
 * mark is a reasonable thing to show, and two overlapping ones on one card
 * would not be.
 *
 * A Max Win is always a clean sweep, for the same arithmetic: a forgiven
 * round has already given up half its multiplier and cannot reach a ceiling.
 *
 * Geometry is computed here rather than in CSS: the CSS version needs the
 * index centred about the middle of the row, and doing that in a
 * stylesheet means either sibling-index() (far too new for the Android and
 * iOS versions Stake tests) or four hand-written nth-child rules that stop
 * working the day the game deals a fifth card.
 *
 * Offsets are in FAN UNITS, multiplied by --wc-fan-spread on the tier. That
 * is the ladder a player can actually see: every tier draws all four cards,
 * the higher ones open the hand wider. Intensity, never presence.
 */
export type FanSlot = {
	index: number;
	tilt: number;
	shift: number;
	/** The outer cards ride lower, the way a real fan hangs. */
	drop: number;
	delay: number;
};

/**
 * A fan of `count` cards, centred. Four on the four-guess ride, three on
 * Three of a Kind - the takeover fans the cards the round actually dealt,
 * and a three-card round with an empty fourth slot would read as a card that
 * never turned.
 *
 * Offsets run -(n-1)/2 .. +(n-1)/2, so a four-card fan has no middle card
 * sitting dead-straight and looking like the odd one out, and a three-card
 * fan does have one, which is the right shape for a hand of three.
 */
export function fanFor(count: number): FanSlot[] {
	return Array.from({ length: count }, (_, i) => {
		const offset = i - (count - 1) / 2;
		return {
			index: i,
			tilt: +(offset * 6.2).toFixed(2),
			shift: +(offset * 4.4).toFixed(2),
			drop: +(Math.abs(offset) * 1.05).toFixed(2),
			delay: +(0.16 + i * 0.075).toFixed(3),
		};
	});
}

/** The four-card fan - the default, and what the tests pin the geometry on. */
export const FAN: readonly FanSlot[] = fanFor(4);
