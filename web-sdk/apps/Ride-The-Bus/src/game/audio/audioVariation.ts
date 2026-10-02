/**
 * The randomness every cue borrows, so no two presses are identical.
 *
 * Pure, and imports nothing at all - which is the point of it being out here.
 * A card flip that sounds the same on the forty-third round as on the first is
 * the thing these three functions exist to prevent, and they are cheap enough
 * to be unit-testable arithmetic rather than something buried in a 1,200-line
 * audio module.
 *
 * ONE OF FIVE. audioGraph.ts was 1,197 lines; it is now audioMixer.ts (what the
 * player has set), audioContext.ts (the one graph, and when it may open),
 * audioVariation.ts (the randomness every cue borrows), audioVoices.ts (tone,
 * noise, thud) and audioLoop.ts (the produced bed's overlapping passes). The
 * whole-graph argument - why ONE context, one limiter, one room - is at the top
 * of audioContext.ts.
 */

/** Uniform random in [min, max). */
export function rand(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

/**
 * Detune by up to `cents` in either direction, as a frequency multiplier.
 * Musical rather than linear: a few cents is a shade out of tune at any pitch,
 * whereas a few hertz is inaudible up high and a semitone down low.
 */
export function drift(cents: number): number {
	return Math.pow(2, rand(-cents, cents) / 1200);
}

/**
 * Pick from a list without ever choosing the same entry twice running.
 * Pure Math.random repeats about as often as it alternates, and a repeat is
 * exactly what this whole exercise is trying to avoid, so the last index is
 * held and excluded.
 */
export function shuffler<T>(items: readonly T[]) {
	let last = -1;
	return (): T => {
		if (items.length === 1) return items[0]!;
		let index = Math.floor(Math.random() * items.length);
		if (index === last) index = (index + 1) % items.length;
		last = index;
		return items[index]!;
	};
}
