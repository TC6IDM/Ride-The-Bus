/**
 * The music manifest, checked against the files that are actually on disk.
 *
 * musicTracks.ts is a set of claims about a directory nothing else verifies:
 * that ACTIVE_TRACK_ID names a real track, that the loop regions fit inside the
 * files they were measured from, and that every file has a licence row. None of
 * that is visible from the game - a mistyped id falls back to the first track
 * and plays perfectly, which is the point of the fallback and the reason the
 * typo has to be caught somewhere else.
 *
 * TWO OF THESE ARE PAYLOAD GATES, not tidiness. static/ is copied wholesale
 * into the build, so every candidate left in the directory is shipped to every
 * player even though only one is ever fetched.
 *
 * Anything that reads the directory SKIPS when it is absent rather than
 * failing, the same way the tests that read the math tree do: a checkout
 * without the placeholders is a supported state, and a permanently red gate
 * gets ignored.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test, describe } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
	ACTIVE_TRACK_ID,
	MUSIC_TRACKS,
	type MusicTrack,
	activeTrack,
	resolveLoopOverride,
	resolveTrack,
	trackById,
	trackPath,
} from './musicTracks.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MUSIC_DIR = path.resolve(HERE, '../../static/music');
const REPO_ROOT = path.resolve(HERE, '../../../../..');
const LICENCES = path.join(REPO_ROOT, 'ASSET_LICENCES.md');

const AUDIO = /\.(mp3|wav|m4a|ogg|webm)$/i;

/**
 * Audio files actually sitting in static/music, or null if there are none.
 *
 * EMPTY COUNTS AS ABSENT, and that is deliberate: the tracks are gitignored, so
 * a fresh clone has this directory (the .gitignore is in it) and no audio at
 * all. Returning [] there would turn "every track in the manifest exists" into
 * a permanently red gate on every machine but the one holding the files - and a
 * gate that is always red gets ignored, which is how a real failure would then
 * be missed.
 */
function filesOnDisk(): string[] | null {
	if (!existsSync(MUSIC_DIR)) return null;
	const files = readdirSync(MUSIC_DIR).filter((f) => AUDIO.test(f));
	return files.length > 0 ? files : null;
}

const MB = 1024 * 1024;
const bytes = (f: string) => statSync(path.join(MUSIC_DIR, f)).size;

describe('the manifest is internally consistent', () => {
	test('ACTIVE_TRACK_ID names a track that exists', () => {
		// activeTrack() falls back to the first entry so a typo cannot silence the
		// game. That is right for the player and useless for whoever made the typo,
		// which is why the check lives here.
		assert.ok(
			trackById(ACTIVE_TRACK_ID),
			`ACTIVE_TRACK_ID is "${ACTIVE_TRACK_ID}", which is not in MUSIC_TRACKS`,
		);
		assert.equal(activeTrack().id, ACTIVE_TRACK_ID);
	});

	test('ids are unique kebab-case slugs and files are unique', () => {
		const ids = MUSIC_TRACKS.map((t) => t.id);
		assert.equal(new Set(ids).size, ids.length, 'two tracks share an id');
		for (const id of ids) {
			// ?dev_music= carries these in a URL, so they must survive one untouched.
			assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `id "${id}" is not a slug`);
		}
		const files = MUSIC_TRACKS.map((t) => t.file);
		assert.equal(new Set(files).size, files.length, 'two tracks name the same file');
	});

	test('every loop region is playable and leaves room for its own seam', () => {
		for (const t of MUSIC_TRACKS) {
			assert.ok(t.loopStart >= 0, `${t.id}: negative loopStart`);
			assert.ok(t.loopEnd > t.loopStart, `${t.id}: loopEnd is not after loopStart`);
			assert.ok(t.crossfade >= 0, `${t.id}: negative crossfade`);
			// loop() silently drops to a hard wrap when the region cannot hold two
			// overlaps - a pass's fade in has to finish before its fade out begins.
			// That fallback is a safety net, not a plan: a manifest entry hitting it
			// would loop with an audible jump and nothing would say so.
			assert.ok(
				t.loopEnd - t.loopStart > t.crossfade * 2 + 0.5,
				`${t.id}: a ${t.loopEnd - t.loopStart}s region cannot hold a ${t.crossfade}s cross-fade`,
			);
		}
	});

	test('level matches are corrections, not volume controls', () => {
		for (const t of MUSIC_TRACKS) {
			// trim exists to line candidates up against the track SCENE_MIX was tuned
			// on. A figure far from 1 means the tracks are genuinely mismatched and
			// the quiet one should be re-normalised, not scaled up here - the scene
			// gains are already well under 1 and there is headroom to lose.
			assert.ok(t.trim > 0.5 && t.trim < 2, `${t.id}: trim ${t.trim} is a re-mix, not a level match`);
		}
	});

	test('the path is URL-safe, because the filenames are not', () => {
		// The tracks keep the names they arrived with - spaces and brackets - so
		// that ASSET_LICENCES.md stays keyed by the real filename. That makes
		// encoding the manifest's job, not the caller's.
		//
		// THE SPACED NAME IS SYNTHETIC HERE, and has to be. The shipping track is
		// "A.mp3" and needs no encoding, so reading the case out of MUSIC_TRACKS
		// would have this test quietly prove nothing - which is what it did while
		// nine benched takes were still in the list. Every one of those carries a
		// space or brackets, so the encoding is live again the moment one comes
		// back, and the fixture is one of their real filenames.
		const benched: MusicTrack = { ...MUSIC_TRACKS[0]!, file: 'C (1).mp3' };
		assert.equal(trackPath(benched), 'music/C%20(1).mp3');
		for (const t of MUSIC_TRACKS) {
			assert.ok(!trackPath(t).includes(' '), `${t.id}: a space reached the URL raw`);
		}
	});
});

describe('choosing a track', () => {
	test('?dev_music= picks one out of the manifest', () => {
		// Naming a track in the manifest resolves to that track. With the nine
		// benched takes out of the list that is only ever the active one, so the
		// interesting half of this test is CONDITIONAL rather than deleted: paste
		// an entry back to audition it and the real discrimination comes back with
		// it. Deleting it instead would mean the audition path ships untested for
		// exactly as long as nobody is auditioning, which is when a break in it
		// would go unnoticed.
		assert.equal(resolveTrack(`?dev_music=${ACTIVE_TRACK_ID}`).id, ACTIVE_TRACK_ID);

		const other = MUSIC_TRACKS.find((t) => t.id !== ACTIVE_TRACK_ID);
		if (!other) return; // one-track manifest: the shipping state, not a fault.
		assert.equal(resolveTrack(`?dev_music=${other.id}`).id, other.id);
	});

	test('?dev_loop= shortens a region so the seam can be captured', () => {
		// The only way to see a loop point at all: the real regions are 3.5 to 5.5
		// minutes, and `npm run audio` would have to capture that long to catch one.
		assert.deepEqual(resolveLoopOverride('?dev_loop=40,70,4'), {
			loopStart: 40,
			loopEnd: 70,
			crossfade: 4,
		});
		// A blank field keeps the track's own value, so ?dev_loop=,,0 is "the same
		// region, with the cross-fade off" - which is how the hard wrap this
		// replaced can still be heard for comparison.
		assert.deepEqual(resolveLoopOverride('?dev_loop=,,0'), { crossfade: 0 });
		assert.deepEqual(resolveLoopOverride('?dev_loop=12'), { loopStart: 12 });
	});

	test('a malformed ?dev_loop= is ignored rather than scheduling silence', () => {
		// Number('x') is NaN, and a NaN loop point starts a source that never
		// plays - a silent game with nothing in the console to explain it.
		assert.deepEqual(resolveLoopOverride('?dev_loop=x,y,z'), {});
		assert.deepEqual(resolveLoopOverride('?dev_loop='), {});
		assert.deepEqual(resolveLoopOverride('?lang=de'), {});
	});

	test('an unknown or absent id falls through to the active track', () => {
		// Mistyping an audition should give you the game, not a debugging session.
		assert.equal(resolveTrack('?dev_music=not-a-track').id, ACTIVE_TRACK_ID);
		assert.equal(resolveTrack('?dev_music=').id, ACTIVE_TRACK_ID);
		assert.equal(resolveTrack('').id, ACTIVE_TRACK_ID);
		assert.equal(resolveTrack('?lang=de&currency=USD').id, ACTIVE_TRACK_ID);
	});
});

describe('the manifest matches static/music', () => {
	test('every track in the manifest is a file that exists', (t) => {
		const files = filesOnDisk();
		if (files === null) return t.skip('no audio in static/music in this checkout');

		for (const track of MUSIC_TRACKS) {
			assert.ok(
				files.includes(track.file),
				`${track.id} names "${track.file}", which is not in static/music`,
			);
		}
	});

	test('every file in static/music is in the manifest', (t) => {
		const files = filesOnDisk();
		if (files === null) return t.skip('no audio in static/music in this checkout');

		const known = new Set(MUSIC_TRACKS.map((m) => m.file));
		for (const f of files) {
			// An undeclared file cannot be auditioned and cannot be switched to, but
			// it still ships. Declaring it is how it becomes visible to the gates
			// below - and how someone notices it is there at all.
			assert.ok(known.has(f), `"${f}" is in static/music but not in MUSIC_TRACKS`);
		}
	});

	test('every file in static/music has a row in ASSET_LICENCES.md', (t) => {
		const files = filesOnDisk();
		if (files === null) return t.skip('no audio in static/music in this checkout');
		if (!existsSync(LICENCES)) return t.skip('no ASSET_LICENCES.md in this checkout');

		const licences = readFileSync(LICENCES, 'utf8');
		for (const f of files) {
			// The whole reason static/music/.gitignore exists. A reviewer can ask
			// where an asset came from, and an audio file with no written provenance
			// is the one thing that certainly cannot ship.
			assert.ok(licences.includes(f), `"${f}" ships but has no row in ASSET_LICENCES.md`);
		}
	});
});

describe('the payload', () => {
	test('the active track is small enough to be worth fetching', (t) => {
		const files = filesOnDisk();
		if (files === null) return t.skip('no audio in static/music in this checkout');
		const file = activeTrack().file;
		if (!files.includes(file)) return t.skip('the active track is not in this checkout');

		// What a player actually downloads, once the candidates are pruned. Well
		// clear of the current placeholders so this is a ceiling rather than a
		// target - but a 20 MB bed arriving unnoticed is the failure it prevents.
		const size = bytes(file);
		assert.ok(size < 9 * MB, `the active track is ${(size / MB).toFixed(1)} MB; re-encode it`);
	});

	test('static/music has not quietly become the biggest thing in the build', (t) => {
		const files = filesOnDisk();
		if (files === null) return t.skip('no audio in static/music in this checkout');

		// EVERY FILE HERE SHIPS. static/ is copied wholesale into the build and
		// nothing prunes it by what is referenced, so a candidate left here after
		// an audition is payload for every player who never hears it.
		//
		// THE CEILING IS BACK DOWN. It was raised to 56 MB on 2026-09-02 to hold
		// all ten paid-tier takes while the choice was deferred; the choice is made
		// and the nine benched takes now live in the repo-root audio-masters/, so
		// this reads 9 * MB again - deliberately the SAME figure as the
		// active-track gate above, because with one track they are the same file
		// and two different numbers would only invite one of them to drift.
		//
		// The directory is ~2.2 MB against that, which is head room for auditioning
		// a second take without tripping the gate and not nearly enough to let a
		// re-audition of all ten ship by accident. Raise it again only alongside a
		// note saying when it comes back down; that is what happened last time and
		// it is why this came back down at all.
		const total = files.reduce((sum, f) => sum + bytes(f), 0);
		assert.ok(
			total < 9 * MB,
			`static/music is ${(total / MB).toFixed(1)} MB across ${files.length} files, and all of it ships. ` +
				'Move every track but the active one back to audio-masters/, or raise this ceiling deliberately.',
		);
	});
});
