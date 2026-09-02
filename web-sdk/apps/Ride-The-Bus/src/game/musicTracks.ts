/**
 * The candidate music beds, and which one the game plays.
 *
 * WHY A MANIFEST RATHER THAN ONE CONSTANT
 *
 * The bed is the one asset that cannot be judged by reading it. Auditioning
 * means playing a track under a real round, and a track that reads well on the
 * board can be wrong under the win fanfare, so switching has to be cheap enough
 * to do repeatedly. Renaming files on disk is not cheap - it breaks
 * ASSET_LICENCES.md, which is keyed by filename - so the tracks keep the names
 * they arrived with and this file maps ids onto them.
 *
 * TO CHANGE WHICH TRACK PLAYS
 *
 *   - permanently: edit ACTIVE_TRACK_ID below, one line, nothing else.
 *   - for one page load: ?dev_music=<id>, DEV builds only. This is the one you
 *     want while auditioning - it needs no rebuild and no restart, and it can be
 *     changed between rounds.
 *
 * NO $app/* IMPORT LIVES HERE, on purpose. This module is imported by a node
 * test, and a module reaching a SvelteKit virtual cannot be - betLimits.test.ts
 * carries that scar. The filename is all this file knows; bedAsset.ts is what
 * turns it into a URL.
 *
 * EVERY FILE IN static/music/ SHIPS TO PLAYERS.
 *
 * static/ is copied wholesale into the build; nothing prunes it by what is
 * referenced. TEN candidates is 44 MB of payload for one 6.4 MB track, so
 * before a production build every track but the active one must be deleted from
 * static/music/ AND its row dropped from ASSET_LICENCES.md, AND the ceiling in
 * musicTracks.test.ts put back. That test prints the current total on every run
 * so this cannot be forgotten quietly.
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
 * The ten paid-tier candidates, measured rather than guessed.
 *
 * TEN, not one, because the choice is deferred: all ten were generated on the
 * same paid subscription on the same day, all ten are licensed, and which one
 * ships is a decision for submission rather than for now. Every one is
 * auditionable with ?dev_music=<id> against a real round.
 *
 * THIS IS 44 MB OF PAYLOAD TO DELIVER 6.4 MB, and all of it ships as it stands.
 * musicTracks.test.ts holds a ceiling that was raised deliberately to allow this
 * audition state and must come back down to one track before a production build.
 *
 * loopStart/loopEnd come from a per-second RMS envelope of each file - the
 * region where the track sits within 6 dB of its loudest second - cross-checked
 * at 0.25s resolution, which is the pass that catches a quiet intro the coarser
 * one reads as usable. Where the two disagree the fine pass wins at the HEAD (a
 * quiet intro is replayed on every wrap) and the coarse pass wins at the TAIL
 * (the crossfade covers a slightly softer ending).
 *
 * NONE OF THE TEN FADES OUT - all run at full level to their last quarter
 * second. That is what "fade out" in the exclude-styles field bought, and it is
 * the one way they differ structurally from the free-tier set they replaced,
 * every one of which decayed to silence over its last 12-17 seconds.
 *
 * These are STARTING POINTS from a level measurement, not from listening. If a
 * seam sounds wrong, the fix is loopEnd, and it wants an ear rather than a
 * number: pull it back to a bar line.
 *
 * ALL TEN ARE PAID-TIER SUNO OUTPUT, generated 2026-09-02, licensed to ship. See
 * ASSET_LICENCES.md for a row per file. The WAV masters they were encoded from
 * live in the repo-root audio-masters/, outside the app so they are never served.
 *
 * The letter in each filename is the prompt that produced it - the plan's A-E -
 * and "(1)" is Suno's second take of the same prompt. That is the provenance
 * link back to ASSET_LICENCES.md, so the names are kept exactly as they arrived.
 */
export const MUSIC_TRACKS: readonly MusicTrack[] = [
	{
		id: 'jazz-lounge-a1',
		file: 'A.mp3',
		label: 'A - late-night jazz lounge, take 1 (2:42)',
		crossfade: 6,
		// 162.2s. Centroid 2186 Hz, 0.89% above 2 kHz.
		loopStart: 0,
		loopEnd: 160,
		trim: 0.88,
	},
	{
		id: 'jazz-lounge-a2',
		file: 'A (1).mp3',
		label: 'A - late-night jazz lounge, take 2 (3:24)',
		crossfade: 6,
		// 203.7s. Centroid 1821 Hz, 0.52% above 2 kHz.
		loopStart: 0,
		loopEnd: 198,
		trim: 0.84,
	},
	{
		id: 'dusty-vamp-b1',
		file: 'B.mp3',
		label: 'B - warm dusty lounge vamp, take 1 (2:33)',
		crossfade: 6,
		// 153.1s. The darkest of the B/C/E group: 1320 Hz, 0.22% above 2 kHz.
		loopStart: 0,
		loopEnd: 148,
		trim: 0.92,
	},
	{
		id: 'dusty-vamp-b2',
		file: 'B (1).mp3',
		label: 'B - warm dusty lounge vamp, take 2 (7:59)',
		crossfade: 6,
		// 479.4s, level end to end. Centroid 1707 Hz, but 20.3% of its energy
		// in 200Hz-2kHz - the band a laptop speaker actually reproduces.
		loopStart: 0,
		loopEnd: 479,
		trim: 0.93,
	},
	{
		id: 'noir-triphop-c1',
		file: 'C.mp3',
		label: 'C - downtempo noir trip-hop, take 1 (7:59)',
		crossfade: 6,
		// 479.4s. The most UNIFORM of the ten - within 3 dB of its loudest
		// quarter-second from 0.00s to 479.00s, which is what a 6s crossfade at
		// an arbitrary seam wants. Scooped mid though: 12.8%.
		loopStart: 0,
		loopEnd: 479,
		trim: 0.82,
	},
	{
		id: 'noir-triphop-c2',
		file: 'C (1).mp3',
		label: 'C - downtempo noir trip-hop, take 2 (7:59)',
		crossfade: 6,
		// 479.4s with a QUIET FIRST 22s - 7 to 16 dB down, which the per-second
		// 6 dB pass reads as usable and the 0.25s pass does not. Looping from 0
		// would replay that dip on every wrap, so the region starts after it.
		// Best of the ten on the laptop test: 22.1% above 200 Hz.
		loopStart: 23,
		loopEnd: 431,
		trim: 0.94,
	},
	{
		id: 'tension-d1',
		file: 'D.mp3',
		label: 'D - minimal cinematic tension, take 1 (2:27)',
		crossfade: 6,
		// 146.8s. DARKEST of the ten - centroid 790 Hz, 0.27% above 2 kHz, which
		// is the failure mode status.md warns about. Quiet first 7.5s, skipped.
		loopStart: 8,
		loopEnd: 143,
		trim: 0.71,
	},
	{
		id: 'tension-d2',
		file: 'D (1).mp3',
		label: 'D - minimal cinematic tension, take 2 (3:04)',
		crossfade: 6,
		// 183.7s. Second darkest: 772 Hz, 0.26% above 2 kHz.
		loopStart: 0,
		loopEnd: 176,
		trim: 0.82,
	},
	{
		id: 'soul-groove-e1',
		file: 'E.mp3',
		label: 'E - dusty late-night soul groove, take 1 (7:59)',
		crossfade: 6,
		// 479.4s, easing slightly over its last 10s. Centroid 1976 Hz.
		loopStart: 0,
		loopEnd: 479,
		trim: 0.84,
	},
	{
		id: 'soul-groove-e2',
		file: 'E (1).mp3',
		label: 'E - dusty late-night soul groove, take 2 (7:59)',
		crossfade: 6,
		// 479.4s, but only the first 410s hold level - the last 69s sit more than
		// 6 dB down, so the region stops there. Brightest of the ten at 3016 Hz.
		loopStart: 0,
		loopEnd: 410,
		trim: 0.76,
	},
];

/**
 * The track the game plays. EDIT THIS LINE to change it.
 *
 * A MEASUREMENT-LED pick, not a settled one, and explicitly a PLACEHOLDER until
 * submission: of the ten it is the strongest
 * where brightness is the constraint that binds. status.md records the free-tier
 * candidates at 0.1% of energy above 2 kHz and calls that "close to the edge of
 * a track a laptop cannot carry"; this one is at 2.69%, with 22.1% of its energy
 * above 200 Hz where a laptop speaker starts working at all.
 *
 * The trade it makes is span - 408s against 479s for the three that loop end to
 * end - because its first 22 seconds are too quiet to loop through. That is a
 * seam every 6:42 rather than every 7:53, which is still longer than anything
 * the free-tier set managed.
 *
 * Audition the others with ?dev_music= before settling. The ear decides this,
 * not the table above.
 */
export const ACTIVE_TRACK_ID = 'noir-triphop-c2';

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
