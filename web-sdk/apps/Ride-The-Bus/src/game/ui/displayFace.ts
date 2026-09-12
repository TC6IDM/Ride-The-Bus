/**
 * Which face can draw this string WITHOUT breaking mid-word.
 *
 * WHY THIS EXISTS. `unicode-range` is applied PER CHARACTER, not per string. The
 * browser draws every codepoint a subset covers in that subset's font and falls
 * back for the rest - inside the same word. So a string that is 90% covered is
 * the broken case, not the nearly-fine one: it renders in two faces at once. The
 * note beside the @font-face block in components/app.css already names this,
 * calling a mid-word fallback "worse than not using it at all", and tokens.css
 * turns it into a rule: the display face "must not be put on a translated
 * string".
 *
 * It was put on one. win-celebration.css sets --font-display on .wc-title, and
 * .wc-title renders t(activeTier.label) - the five tier names, in all sixteen
 * locales, at the largest type size in the game.
 *
 * WHAT WAS AND WAS NOT ALREADY KNOWN. The rule beside .wc-title accounts for
 * ar/hi/ja/ko/zh: those fall outside BOTH self-hosted faces, drop wholesale to
 * the OS font, and the comment accepts that as the price of not shipping CJK
 * webfonts. That reasoning is sound and this file does not disturb it - a whole
 * string in one OS font is fine. What it misses is the Latin-ext case, which
 * behaves differently:
 *
 *   pl  "Duza Wygrana" (z-dot)  - Big Shoulders has no z-dot, POPPINS DOES
 *                                 (it ships latin-ext; Big Shoulders does not),
 *                                 so the accent is drawn by the body face
 *                                 inside a display-face word.
 *   vi  "Thang Lon" (stacked)   - U+1EAF and U+1EDB fall in the gap between
 *                                 Poppins' U+1E00-1E9F and U+1EF2-1EFF, so
 *                                 they reach NEITHER webfont and come from the
 *                                 OS - again inside the word.
 *
 * Those two are the actual defect, and they are why the answer here is three-way
 * rather than a swap. Falling back from display to body fixes Polish, because
 * Poppins covers the whole string; it does NOT fix Vietnamese, because Poppins
 * does not. Only dropping to the generic stack renders that one in a single
 * face.
 *
 * WHY COVERAGE AND NOT A LOCALE LIST. A list of "safe" locales is a second copy
 * of a fact that lives in the copy itself, and it goes stale the first time a
 * translator picks a different word. Turkish is the live example: every current
 * tier label happens to sit inside Latin-1, so a conservative list would drop
 * the face for nothing - but the cedilla spelling of "Kazanc" would need it
 * dropped, and the list would not notice the change. Reading the string is the
 * only version that cannot drift from the string.
 *
 * It CAN drift from the @font-face declarations, so displayFace.test.ts parses
 * the unicode-range descriptors straight out of app.css and fails if these
 * ranges stop matching them.
 */

type Range = readonly [number, number];

/**
 * The subset BOTH self-hosted faces are served with.
 *
 * Transcribed from the `unicode-range` on the four Poppins latin blocks and the
 * two Big Shoulders blocks in components/app.css - they are byte-identical,
 * which the test also asserts, because a weight served with a wider range would
 * make this answer wrong in one direction only and that is the hardest kind to
 * notice.
 */
export const LATIN_SUBSET: ReadonlyArray<Range> = [
	[0x0000, 0x00ff],
	[0x0131, 0x0131],
	[0x0152, 0x0153],
	[0x02bb, 0x02bc],
	[0x02c6, 0x02c6],
	[0x02da, 0x02da],
	[0x02dc, 0x02dc],
	[0x0304, 0x0304],
	[0x0308, 0x0308],
	[0x0329, 0x0329],
	[0x2000, 0x206f],
	[0x20ac, 0x20ac],
	[0x2122, 0x2122],
	[0x2191, 0x2191],
	[0x2193, 0x2193],
	[0x2212, 0x2212],
	[0x2215, 0x2215],
	[0xfeff, 0xfeff],
	[0xfffd, 0xfffd],
];

/**
 * The extra subset POPPINS ALONE is served with. Big Shoulders has no
 * latin-ext file, and that asymmetry is the whole bug: it is what lets one
 * accented letter in an otherwise-Latin word come from the other face.
 *
 * Note the gap at U+1EA0-1EF1. That is most of the Vietnamese precomposed block,
 * and it is absent from the shipped file rather than from this transcription.
 */
export const LATIN_EXT_SUBSET: ReadonlyArray<Range> = [
	[0x0100, 0x02ba],
	[0x02bd, 0x02c5],
	[0x02c7, 0x02cc],
	[0x02ce, 0x02d7],
	[0x02dd, 0x02ff],
	[0x0304, 0x0304],
	[0x0308, 0x0308],
	[0x0329, 0x0329],
	[0x1d00, 0x1dbf],
	[0x1e00, 0x1e9f],
	[0x1ef2, 0x1eff],
	[0x2020, 0x2020],
	[0x20a0, 0x20ab],
	[0x20ad, 0x20c0],
	[0x2113, 0x2113],
	[0x2c60, 0x2c7f],
	[0xa720, 0xa7ff],
];

/**
 * Which face to set on a string so that ALL of it comes from one file.
 *
 * - `display` - every codepoint is in the Big Shoulders subset.
 * - `body`    - not all are, but every one is in Poppins (latin + latin-ext).
 * - `system`  - neither covers it; hand the whole string to the OS stack, which
 *               is what ar/hi/ja/ko/zh/ru already do and is not a regression
 *               for them.
 *
 * All-or-nothing at each step on purpose: a "mostly covered" string is precisely
 * the case that renders in two faces, so there is no useful middle answer.
 */
export function titleFaceFor(text: string): 'display' | 'body' | 'system' {
	let needsBody = false;

	for (const ch of text) {
		// for..of walks codepoints, not UTF-16 units, so an astral character is
		// counted once and correctly rejected rather than read as two in-range
		// surrogate halves.
		const cp = ch.codePointAt(0);
		if (cp === undefined) continue;

		if (inRanges(cp, LATIN_SUBSET)) continue;
		if (inRanges(cp, LATIN_EXT_SUBSET)) {
			needsBody = true;
			continue;
		}
		return 'system';
	}

	return needsBody ? 'body' : 'display';
}

function inRanges(cp: number, ranges: ReadonlyArray<Range>): boolean {
	return ranges.some(([lo, hi]) => cp >= lo && cp <= hi);
}
