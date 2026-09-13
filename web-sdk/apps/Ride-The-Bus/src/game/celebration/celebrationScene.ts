/**
 * The takeover's scene geometry: where the burst marks fly and how the fan sits.
 *
 * Pure - no props, no state, no DOM - which is the whole reason it is worth
 * having out here. winCelebration.test.ts could previously only GREP the
 * component for these invariants, and the one about the fan opening wider at
 * every tier had to read the stylesheet to do it. Both are now arithmetic a
 * unit test can just call.
 *
 * Both tables are computed in TypeScript rather than in CSS on purpose: the
 * notes below say why (`round()` is too new for the Android and iOS versions
 * Stake tests on, and would silently collapse every mark to one radius).
 */

/**
 * The burst geometry, computed here rather than in CSS.
 *
 * The obvious CSS version needs `round()` to alternate the throw distance,
 * and `round()` is far too new to rely on - Stake tests on older Android and
 * iOS, where it would silently collapse every mark to the same radius. Plain
 * arithmetic in a module constant costs nothing and works everywhere.
 *
 * THESE ARE SUIT MARKS, NOT SPARKS. They used to be fourteen glowing dots,
 * which is the particle burst every generated casino screen ships and says
 * nothing about what game you just won. Ride The Bus is four cards and four
 * guesses; its celebration should be made of its own deck. The marks come
 * from SuitIcon - already drawn as SVG because the body face does not own
 * U+2660..U+2666 and the fallback is a colour emoji on most phones.
 *
 * Sixteen over 360deg, four of each suit so no one suit dominates, jittered
 * off the exact spoke angles and alternating short/long so the ring does not
 * read as a perfect circle, on staggered delays so they do not fire as one.
 * Alternating spin direction keeps the tumble from looking mechanical.
 */
export const SUIT_CYCLE = ['heart', 'spade', 'diamond', 'club'] as const;

export const BURST_COUNT = 10;

export const BURST = Array.from({ length: BURST_COUNT }, (_, i) => ({
	suit: SUIT_CYCLE[i % 4]!,
	angle: +(i * (360 / BURST_COUNT) + (i % 2 === 0 ? -9 : 9)).toFixed(2),
	/* Pulled in hard from 19/26. The marks are 2x the size they were, and a
	 * big mark thrown the old distance ends up out in a frame corner or over
	 * the control bar, where a suit reads as a speck of dirt rather than as
	 * part of the gesture. They should burst off the FAN, not off the
	 * viewport. */
	dist: i % 2 === 0 ? 11 : 15,
	/** Font size in --ui units; the mark is sized in em off it. */
	size: i % 3 === 0 ? 4.6 : 3.6,
	spin: i % 2 === 0 ? 210 : -250,
	/**
	 * Small, and small ON PURPOSE. This used to run to 2.1s against a 3.6s
	 * infinite loop, which meant the marks never shared a t=0: at any given
	 * frame they sat at ten unrelated radii, so the ring drifted rather than
	 * burst, and it read as dust on the lens. A burst is a MOMENT - one
	 * origin, one instant, a little jitter so the edge is not machined.
	 */
	delay: +((i % 5) * 0.045).toFixed(3),
}));

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
 * Geometry is computed here for the same reason BURST is: the CSS version
 * needs the index centred about the middle of the row, and doing that in a
 * stylesheet means either sibling-index() (far too new for the Android and
 * iOS versions Stake tests) or four hand-written nth-child rules that stop
 * working the day the game deals a fifth card.
 *
 * Offsets are in FAN UNITS, multiplied by --wc-fan-spread on the tier. That
 * is the ladder a player can actually see: every tier draws all four cards,
 * the higher ones open the hand wider. Intensity, never presence.
 */
export const FAN = Array.from({ length: 4 }, (_, i) => {
	// -1.5, -0.5, 0.5, 1.5 - centred, so the fan has no middle card to sit
	// dead-straight and look like the odd one out.
	const offset = i - 1.5;
	return {
		index: i,
		tilt: +(offset * 6.2).toFixed(2),
		shift: +(offset * 4.4).toFixed(2),
		/** The outer cards ride lower, the way a real fan hangs. */
		drop: +(Math.abs(offset) * 1.05).toFixed(2),
		delay: +(0.16 + i * 0.075).toFixed(3),
	};
});
