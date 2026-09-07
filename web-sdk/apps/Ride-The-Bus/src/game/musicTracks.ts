/**
 * The music bed the game plays.
 *
 * ONE ROW, and that is the shipping state rather than a simplification. Ten
 * paid-tier takes were generated on 2026-09-02 and all ten sat here while the
 * choice was deferred; the choice has now been made by ear and the other nine
 * are BENCHED, not deleted - both their MP3s and their WAV masters live in the
 * repo-root audio-masters/, outside the app so nothing serves them.
 *
 * WHY A MANIFEST RATHER THAN ONE CONSTANT
 *
 * The bed is the one asset that cannot be judged by reading it. Auditioning
 * means playing a track under a real round, and a track that reads well on the
 * board can be wrong under the win fanfare, so switching has to be cheap enough
 * to do repeatedly. That is still true of the ONE track here - it is not
 * settled, only chosen - and the shape survives so bringing a benched take back
 * is a file copy plus one entry rather than a rewrite. Renaming files on disk is
 * not cheap - it breaks ASSET_LICENCES.md, which is keyed by filename - so the
 * tracks keep the names they arrived with and this file maps ids onto them.
 *
 * TO BRING A BENCHED TAKE BACK: copy its MP3 from audio-masters/ into
 * static/music/, paste its entry back here from the measured table in
 * .claude/skills/rtb-invariants/references/audio-and-jurisdiction.md, and put
 * its ASSET_LICENCES.md row back under "Shipping". The nine were measured the
 * same way this one was, and those numbers were kept precisely so that a
 * re-audition costs no measurement pass.
 *
 * TO CHANGE WHICH TRACK PLAYS
 *
 *   - permanently: edit ACTIVE_TRACK_ID below, one line, nothing else.
 *   - for one page load: ?dev_music=<id>, DEV builds only. This is the one you
 *     want while auditioning - it needs no rebuild and no restart, and it can be
 *     changed between rounds. With one entry it can only ever resolve to that
 *     entry; it earns its keep again the moment a second one is pasted back.
 *
 * NO $app/* IMPORT LIVES HERE, on purpose. This module is imported by a node
 * test, and a module reaching a SvelteKit virtual cannot be - betLimits.test.ts
 * carries that scar. The filename is all this file knows; bedAsset.ts is what
 * turns it into a URL.
 *
 * EVERY FILE IN static/music/ SHIPS TO PLAYERS.
 *
 * static/ is copied wholesale into the build; nothing prunes it by what is
 * referenced, which is why the nine had to leave the directory rather than just
 * this list. The directory is back to 2.2 MB against a 9 MB ceiling in
 * musicTracks.test.ts, and that test prints the current total on every run, so a
 * candidate dropped back in for an audition and forgotten is caught before it
 * ships. Anything added here needs its ASSET_LICENCES.md row in the same commit.
 */

/** One auditionable bed. Every field but the first three is a measurement. */
export type MusicTrack = {
	/** Stable slug. What ?dev_music= and ACTIVE_TRACK_ID name. */
	id: string;
	/** Filename inside static/music/, verbatim, spaces and all. */
	file: string;
	/** For the dev console line, so a mystery track can be identified by ear. */
	label: string;
	/**
	 * Seconds of tail-over-head overlap at the seam. See loop() in audioGraph.
	 * Roughly two bars at these tempos, which is long enough that the overlap
	 * reads as the track continuing rather than as two takes at once.
	 */
	crossfade: number;
	/** Seconds into the file the usable region starts - after any intro ramp. */
	loopStart: number;
	/** Seconds into the file the usable region ends - BEFORE the outro decay. */
	loopEnd: number;
	/**
	 * Level match, as a multiplier on the scene gain.
	 *
	 * Every scene level in music.ts is calibrated against ONE track. Without this
	 * a switch would change how loud the whole game is, and the next thing anyone
	 * did would be to re-tune the scene levels for the new track - which breaks
	 * the one before it. Derived from each file's body RMS against a -17.5 dBFS
	 * reference, measured over the loop region rather than the whole file.
	 */
	trim: number;
};

/**
 * The shipping bed. One row, measured rather than guessed.
 *
 * loopStart/loopEnd come from a per-second RMS envelope of the file - the region
 * where the track sits within 6 dB of its loudest second - cross-checked at
 * 0.25s resolution, which is the pass that catches a quiet intro the coarser one
 * reads as usable. Where the two disagree the fine pass wins at the HEAD (a
 * quiet intro is replayed on every wrap) and the coarse pass wins at the TAIL
 * (the crossfade covers a slightly softer ending).
 *
 * IT DOES NOT FADE OUT - it runs at full level to its last quarter second, as
 * all ten takes did. That is what "fade out" in the exclude-styles field bought,
 * and it is the one way this set differs structurally from the free-tier one it
 * replaced, every member of which decayed to silence over its last 12-17s.
 *
 * These are STARTING POINTS from a level measurement, not from listening. If the
 * seam sounds wrong, the fix is loopEnd, and it wants an ear rather than a
 * number: pull it back to a bar line.
 *
 * PAID-TIER SUNO OUTPUT, generated 2026-09-02, licensed to ship. See
 * ASSET_LICENCES.md for the row. The WAV master it was encoded from lives in the
 * repo-root audio-masters/, outside the app so it is never served, alongside the
 * nine benched takes' MP3s and masters.
 *
 * The letter in the filename is the prompt that produced it - the plan's A-E -
 * and "(1)" would be Suno's second take of the same prompt. That is the
 * provenance link back to ASSET_LICENCES.md, so the name is kept exactly as it
 * arrived.
 */
export const MUSIC_TRACKS: readonly MusicTrack[] = [
	{
		id: 'jazz-lounge-a1',
		file: 'A.mp3',
		label: 'A - late-night jazz lounge, take 1 (2:42)',
		crossfade: 6,
		// 162.2s. Centroid 2186 Hz - second brightest of the ten - but only 0.89%
		// of its energy above 2 kHz, where noir-triphop-c2 is at 2.69%. THE TWO
		// RANKINGS DISAGREE, and it is the second that was flagged as a risk: a
		// centroid rides up on upper-mid content that never reaches 2 kHz.
		// Measured on the board (npm run audio, 18s, bed plus cues through the
		// real limiter) this reads 1638-1673 Hz and 0.4% above 2 kHz, against
		// 1716 Hz / 1.6% for the placeholder and 1268 Hz / 0.1% for the free-tier
		// set it replaced. Clear of the dark-bed floor, with less margin than the
		// placeholder had. status.md carries the laptop-speaker check.
		loopStart: 0,
		loopEnd: 160,
		trim: 0.88,
	},
];

/**
 * The track the game plays. EDIT THIS LINE to change it.
 *
 * CHOSEN BY EAR out of the ten, which is the only instrument that could choose:
 * the measurements ranked them and could not rank them by whether they suit the
 * game. The previous value here was noir-triphop-c2, a measurement-led
 * placeholder picked for brightness, and it is superseded rather than
 * vindicated - this track is DARKER than it on the axis that placeholder was
 * picked for. The board measures 0.4% of energy above 2 kHz against the
 * placeholder's 1.6%, still four times the free-tier set's 0.1%. That is the
 * trade an ear made over a number, recorded so it is not rediscovered as a
 * defect; see the entry above and status.md's laptop-speaker item.
 *
 * IT IS STILL "FOR NOW". Nothing here is submitted, and the nine benched takes
 * are one file copy from being auditionable again - see the header.
 *
 * THE TRADE IS SPAN, and it is the largest of any of the ten. A 160s region with
 * a 6s crossfade wraps every 154s, so a player sitting on the board hears the
 * seam roughly every two and a half minutes, against 6:42 for the placeholder it
 * replaces and 7:53 for the three takes that loop end to end. That makes the
 * seam the thing to listen to on this track: it is heard often enough that a bad
 * one would be the most noticeable property of the bed. ?dev_loop= is how it
 * gets checked without waiting - see resolveLoopOverride below.
 */
export const ACTIVE_TRACK_ID = 'jazz-lounge-a1';

/** Where the tracks are served from, under SvelteKit's base path. */
export const MUSIC_DIR = 'music';

/** Look one up by id. Null rather than a throw - an unknown id is a typo, not a crash. */
export function trackById(id: string | null | undefined): MusicTrack | null {
	if (!id) return null;
	return MUSIC_TRACKS.find((t) => t.id === id) ?? null;
}

/**
 * The configured track.
 *
 * Falls back to the first entry rather than throwing, because the failure this
 * guards is a typo in ACTIVE_TRACK_ID and the game losing its music over one is
 * a worse outcome than playing the wrong track. musicTracks.test.ts catches the
 * typo where it is cheap to catch.
 */
export function activeTrack(): MusicTrack {
	return trackById(ACTIVE_TRACK_ID) ?? MUSIC_TRACKS[0]!;
}

/**
 * The track a given query string asks for, or the configured one.
 *
 * Pure and string-in, so it can be tested without a browser. The DEV guard is
 * the CALLER's - see bedAsset.ts. An unknown id falls through to the active
 * track rather than to silence: mistyping an audition should give you the game,
 * not a debugging session.
 */
export function resolveTrack(search: string): MusicTrack {
	const asked = new URLSearchParams(search).get('dev_music');
	return trackById(asked) ?? activeTrack();
}

/**
 * A loop region asked for by the address bar: ?dev_loop=<start>,<end>,<crossfade>
 *
 * WHY THIS EXISTS AT ALL. The seam is the one thing about the bed that cannot be
 * checked by reading, by testing, or by listening for a reasonable length of
 * time: the real regions are four to five MINUTES long, so `npm run audio`
 * would have to capture five minutes of audio to catch one wrap. Given
 * ?dev_loop=40,70,4 the same seam happens every 26 seconds, on the real file,
 * through the real graph - which is the difference between seeing the loop
 * point and taking it on trust.
 *
 * Seconds, in the manifest's own units. Any field left blank keeps the track's
 * own value, so ?dev_loop=,,0 turns the cross-fade off and hears the hard wrap
 * this replaced.
 *
 * DEV only - see bedAsset.ts, which is what guards it.
 */
export function resolveLoopOverride(search: string): Partial<MusicTrack> {
	const raw = new URLSearchParams(search).get('dev_loop');
	if (raw === null) return {};
	const [start, end, cross] = raw.split(',').map((v) => (v.trim() === '' ? null : Number(v)));
	const out: Partial<MusicTrack> = {};
	// Finite, because Number('') is 0 and Number('x') is NaN, and a NaN loop point
	// schedules a source that never plays.
	if (start !== null && Number.isFinite(start)) out.loopStart = start;
	if (end !== null && Number.isFinite(end)) out.loopEnd = end;
	if (cross !== null && Number.isFinite(cross)) out.crossfade = cross;
	return out;
}

/** The file's path under static/, URL-encoded. The names carry spaces and brackets. */
export function trackPath(track: MusicTrack): string {
	return `${MUSIC_DIR}/${encodeURIComponent(track.file)}`;
}
