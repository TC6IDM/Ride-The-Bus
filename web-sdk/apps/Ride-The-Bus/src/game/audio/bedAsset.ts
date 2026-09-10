/**
 * Which music bed to play, and where it is fetched from.
 *
 * A file of its own for one reason: it imports SvelteKit's $app/paths, and a
 * module that reaches an $app/* virtual cannot be imported by a node test -
 * betLimits.test.ts carries the scar of finding that out. Keeping the import
 * here is what lets music.ts and musicTracks.ts stay testable while still
 * resolving `${base}` correctly on Stake, which serves games from a sub-path
 * rather than from root.
 *
 * WHY static/ AND NOT AN IMPORT. config-svelte sets bundleStrategy:"inline", so
 * anything Vite processes is base64-inlined into index.html - at roughly 1.4x
 * its real size, in the document that blocks first paint. logoAsset.svelte.ts
 * explains the same trap for the logo, which is a third of the payload at
 * 743 kB. An audio file is larger than the logo. It goes in static/ and is
 * fetched by URL, and `npm run audio` is how you check it arrived.
 *
 * WHY MP3, WHICH IS NOT THE BEST CODEC AVAILABLE. Opus in WebM is meaningfully
 * smaller at the same quality and is what a bundle-size argument points to. It
 * is also the one common codec whose decodeAudioData support is patchy on older
 * Safari, and this repo has already been bitten once by exactly that shape of
 * assumption - see logoAsset.svelte.ts on Safari 14-16 and image-set(). MP3 is
 * decodable by decodeAudioData in every browser Stake's checklist mentions, and
 * a bed is one file fetched once, not a per-frame cost. If the size ever
 * matters more than the tail of old iOS, add a real capability probe rather
 * than swapping the extension and hoping.
 */
import { base } from '$app/paths';

import {
	resolveTrack,
	resolveLoopOverride,
	activeTrack,
	trackPath,
	type MusicTrack,
} from './musicTracks.ts';

/**
 * The track for this page load.
 *
 * ?dev_music=<id> wins in a dev build and is how the candidates get auditioned
 * without a restart. The guard is `import.meta.env.DEV`, which Vite replaces
 * with a literal `false` in production, so the branch - and the reason a player
 * cannot go fishing for other files in static/ - is dropped from the bundle
 * entirely. devOverrides.ts does the same thing for the jurisdiction block.
 */
function chooseTrack(): MusicTrack {
	if (import.meta.env.DEV && typeof location !== 'undefined') {
		// ?dev_music= picks the file; ?dev_loop= overrides the region measured for
		// it, which is the only practical way to make a five-minute loop wrap
		// inside a capture. Both are dropped from a production bundle with this
		// branch.
		const search = location.search;
		return { ...resolveTrack(search), ...resolveLoopOverride(search) };
	}
	return activeTrack();
}

const track = chooseTrack();

/**
 * Handed to music.setBed by Game.svelte: the URL plus everything loop() needs to
 * make the track come round again without being heard to.
 *
 * Absent, the game is fully synthesised and nothing breaks - the loader fails
 * soft by design - so a build shipped without the file is quiet rather than
 * broken.
 */
export const MUSIC_BED = {
	url: `${base}/${trackPath(track)}`,
	crossfade: track.crossfade,
	loopStart: track.loopStart,
	loopEnd: track.loopEnd,
	trim: track.trim,
	label: track.label,
} as const;
