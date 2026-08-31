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
 * referenced. Four candidates at ~6 MB each is ~25 MB of payload for one 6 MB
 * track, so before a production build every track but the active one must be
 * deleted from static/music/. musicTracks.test.ts prints the current total so
 * this cannot be forgotten quietly.
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
 * The four Suno candidates, measured rather than guessed.
 *
 * loopStart/loopEnd come from a per-second RMS envelope of each file: the region
 * is where the track sits within 6 dB of its loudest second. That is what cuts
 * the outro - all four fade to digital silence over their last 12-17 seconds,
 * and a loop that includes that plays a fade-out into a cold entry forever.
 *
 * These are STARTING POINTS from a level measurement, not from listening. If a
 * seam sounds wrong, the fix is loopEnd, and it wants an ear rather than a
 * number: pull it back to a bar line.
 *
 * ALL FOUR ARE FREE-TIER SUNO OUTPUT AND NONE OF THEM CAN SHIP. See
 * ASSET_LICENCES.md - they are placeholders so the audio path can be built and
 * heard, and the chosen one must be regenerated on a paid subscription before
 * submission.
 */
export const MUSIC_TRACKS: readonly MusicTrack[] = [
	{
		id: 'late-night-lounge',
		file: 'Late Night Lounge.mp3',
		label: 'Late Night Lounge (5:23)',
		crossfade: 6,
		// 323.1s file. Full level from 0s; the outro decays from 305s to silence.
		loopStart: 0,
		loopEnd: 305,
		// body RMS -18.5 dBFS
		trim: 1.12,
	},
	{
		id: 'late-night-lounge-alt',
		file: 'Late Night Lounge (1).mp3',
		label: 'Late Night Lounge, second take (3:28)',
		crossfade: 6,
		// 208.5s file. Outro decays from 202s.
		loopStart: 0,
		loopEnd: 202,
		// body RMS -16.9 dBFS
		trim: 0.93,
	},
	{
		id: 'background-two',
		file: 'Ride The Bus Background 2.mp3',
		label: 'Ride The Bus Background 2 (5:12)',
		crossfade: 6,
		// 312.1s file. A 1s ramp in; the outro decays from 295s.
		loopStart: 1,
		loopEnd: 295,
		// body RMS -17.1 dBFS
		trim: 0.95,
	},
	{
		id: 'background-two-alt',
		file: 'Ride The Bus Background 2 (1).mp3',
		label: 'Ride The Bus Background 2, second take (4:40)',
		crossfade: 6,
		// 280.4s file. A 1s ramp in; the outro decays from 264s.
		loopStart: 1,
		loopEnd: 264,
		// body RMS -16.1 dBFS
		trim: 0.85,
	},
];

/**
 * The track the game plays. EDIT THIS LINE to change it.
 *
 * A placeholder pick, not a decision: it is the one whose brief matches the
 * board - a dark late-night card room rather than a casino floor. Audition the
 * others with ?dev_music= before settling.
 */
export const ACTIVE_TRACK_ID = 'background-two-alt';

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
