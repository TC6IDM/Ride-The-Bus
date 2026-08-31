/**
 * The music bed: one produced track, fetched at runtime and looped.
 *
 * The music is a file, not code. This module fetches one track, loops it, and
 * decides how loud it sits at each moment of the game; there is nothing here
 * that makes a sound on its own.
 *
 * The cue book in sound.ts is the other half and is entirely synthesised.
 * Everything the game says in response to a player - presses, card flips, stage
 * wins, the fanfares - is built from oscillators and generated noise, and none
 * of it is a sample. This file is only the room behind that.
 *
 * WHAT THIS FILE OWES THE REST OF THE GAME
 *
 * A scene, and nothing else. Game.svelte says where the player is and this
 * decides what that means. Every scene is the SAME FILE at a different level,
 * so moving between them is a cross-fade rather than a restart - which is why
 * settleBed re-levels the running source instead of building a new one.
 *
 * THE FILE IS FETCHED, NEVER IMPORTED.
 *
 * config-svelte sets bundleStrategy:"inline", so anything Vite processes is
 * base64-inlined into index.html - at roughly 1.4x its real size, in the
 * document that blocks first paint. So the track lives in static/ and is
 * fetched by URL, exactly as logo.png is. An `import bed from './bed.mp3'`
 * would silently undo that and would fail no test.
 *
 * ITS URL IS INJECTED, NOT IMPORTED.
 *
 * The URL needs SvelteKit's `${base}`, and a module reaching an $app/* virtual
 * cannot be imported by a node test - betLimits.test.ts carries that scar. So
 * bedAsset.ts owns the import, Game.svelte hands the result to setBed, and this
 * file stays testable. Left unset, the game is silent behind its cues, which is
 * also exactly what a build shipped without the asset does.
 */
import { contextTime, decode, isBusSilent, loop, onMixerChange, type LoopHandle } from './audioGraph.ts';

/**
 * Where the game is.
 *
 * Five places, not two, because the bed's job changes at each of them and the
 * only thing one file can change is its level. 'none' releases the track.
 */
export type MusicScene = 'none' | 'loading' | 'lobby' | 'idle' | 'round' | 'celebration';

/** Everything a scene says about the bed: how loud, and how long to get there. */
type SceneMix = { gain: number; fade: number };

/**
 * How loud the track sits, and how quickly it moves, per moment of the game.
 *
 * THE SHAPE IS A DIP, NOT A CLIMB, and that is the whole design. The bed and the
 * cue book share ONE limiter (see audioGraph's header), so the bed cannot get
 * out of the way by being drowned out - it has to actually move. Every level
 * below is therefore set by how much OTHER sound is happening at that moment:
 *
 *   loading      quiet, but AUDIBLE - the two screens before the board carry no
 *                cues at all, so a bed that only just registers there is a bed
 *                nobody hears. It was 0.10 while these scenes could not sound;
 *                primeAudio made them real and 0.10 was then simply too low.
 *   lobby        a little up. The start screen is still waiting, and the lift
 *                from the loader is the first thing the mix ever does.
 *   idle         the loudest the bed ever is. The board with no round on it is
 *                the only moment the music has the room to itself.
 *   round        DOWN about 4 dB. Four card flips, three stage wins and the bust
 *                cue all land here - the busiest the cue book ever gets is
 *                exactly when the bed must be least in the way. A bed that rose
 *                here would fight every cue the round is made of.
 *   celebration  DOWN hard, and fast. The fanfare is the payoff and it is the
 *                loudest thing in the game; a bed mixed to sit on top of it
 *                would duck the WIN rather than the other way round.
 *
 * THE FADE TIME BELONGS TO THE DESTINATION, which is what makes the ducks
 * asymmetric without a second table. Going to 'celebration' takes that row's
 * 0.35s, so the bed is out of the way before the fanfare's first hit; coming
 * back to 'idle' takes idle's 1.5s, so it returns underneath the player rather
 * than announcing itself. Down fast, up slow, for free.
 *
 * These are calibrated against ONE track - see MusicTrack.trim in
 * musicTracks.ts, which level-matches the others onto them so switching a
 * candidate does not change how loud the game is.
 *
 * Re-measure with `npm run audio` after any change here. A mastered file arrives
 * near full scale, so the right number is well below what it looks like it
 * should be.
 */
const SCENE_MIX: Record<Exclude<MusicScene, 'none'>, SceneMix> = {
	loading: { gain: 0.14, fade: 2.5 },
	lobby: { gain: 0.19, fade: 1.6 },
	idle: { gain: 0.26, fade: 1.5 },
	round: { gain: 0.17, fade: 0.7 },
	celebration: { gain: 0.07, fade: 0.35 },
};

/** Everything about the track that is not the audio itself. */
export type BedSpec = {
	url: string;
	/** Seconds of tail-over-head overlap at the seam. */
	crossfade?: number;
	loopStart?: number;
	loopEnd?: number;
	/** Level match against the track SCENE_MIX was calibrated on. */
	trim?: number;
	label?: string;
};

let scene: MusicScene = 'none';

let bed: BedSpec | null = null;

/**
 * idle -> loading -> ready | failed, and never backwards.
 *
 * `failed` is terminal ON PURPOSE. A track that 404s will 404 again, and
 * retrying on every mixer change would turn one missing file into an unbounded
 * number of requests.
 */
let bedState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
let bedBuffer: AudioBuffer | null = null;
let bedHandle: LoopHandle | null = null;

/** The level for a scene, after the track's own level match. */
function levelFor(at: Exclude<MusicScene, 'none'>): number {
	return SCENE_MIX[at].gain * (bed?.trim ?? 1);
}

/**
 * Fetch and decode the track, at most once.
 *
 * NOTHING IS DOWNLOADED FOR A PLAYER WHO CANNOT HEAR IT. The silence gate comes
 * first, which extends the cue book's "muted costs nothing" from CPU to
 * bandwidth: a muted session fetches no audio at all.
 */
function ensureBed() {
	if (bedState !== 'idle' || bed === null) return;
	if (scene === 'none' || isBusSilent('music')) return;
	// No running context means no cue has been played yet. Waiting is the point:
	// music must never be the thing that opens an AudioContext, or a player who
	// has not touched the page gets a suspended context and, on some browsers, an
	// "audio playing" badge on the tab. decode() would return null here anyway,
	// and that would burn the single load attempt.
	if (contextTime() === null) return;
	if (typeof fetch === 'undefined') return;

	bedState = 'loading';
	const url = bed.url;

	void (async () => {
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error(String(response.status));
			const decoded = await decode(await response.arrayBuffer());
			if (!decoded) throw new Error('decode failed');
			bedBuffer = decoded;
			bedState = 'ready';
			// The world may have changed entirely while this was in flight - the
			// player could have muted, left the board, or closed the game. settle
			// re-reads it rather than assuming it still looks the way it did.
			settle();
		} catch {
			// Deliberately silent. A missing track degrades to a game with no music,
			// and console errors are a Stake build failure.
			bedState = 'failed';
		}
	})();
}

/** Start, re-level or release the loop to match the scene and the mixer. */
function settleBed() {
	const wanted = scene !== 'none' && !isBusSilent('music') && bedState === 'ready';

	if (!wanted) {
		bedHandle?.stop();
		bedHandle = null;
		return;
	}

	const at = scene as Exclude<MusicScene, 'none'>;
	const mix = SCENE_MIX[at];
	// Re-level rather than restart: every scene is the same file at a different
	// level, so a scene change is a cross-fade. The ramp takes the DESTINATION's
	// time, which is what makes a duck fast and its recovery slow.
	if (bedHandle) bedHandle.setGain(levelFor(at), mix.fade);
	else if (bedBuffer)
		bedHandle = loop({
			buffer: bedBuffer,
			gain: levelFor(at),
			// The track arrives over the same time a move to this scene would take,
			// so the first thing a player hears is paced like every change after it.
			fadeIn: mix.fade,
			bus: 'music',
			crossfade: bed?.crossfade ?? 0,
			loopStart: bed?.loopStart ?? 0,
			loopEnd: bed?.loopEnd,
		});
}

/** Reconcile everything with the scene and the mixer. Idempotent. */
function settle() {
	ensureBed();
	settleBed();
}

// A player who un-mutes music mid-round should hear the track arrive, and one
// who mutes it should stop paying for it entirely.
onMixerChange(settle);

export const music = {
	/**
	 * Which track to play, and how to loop it. Called once by the app.
	 *
	 * A setter rather than an import - see this file's header. Left unset, as it
	 * is in every test, the game simply has no music.
	 */
	setBed(next: BedSpec) {
		if (bed?.url === next.url) {
			// Same file, possibly different loop points. Keep the decoded buffer and
			// the running source; the new numbers apply at the next start.
			bed = next;
			return;
		}
		bed = next;
		// A new URL is a new asset: forget any previous verdict, `failed` included,
		// so this is not a one-way door.
		bedState = 'idle';
		bedBuffer = null;
		settle();
	},

	/** Where the game is. Changing scene cross-fades; it never cuts the track. */
	setScene(next: MusicScene) {
		if (scene === next) return;
		scene = next;
		settle();
	},

	scene: () => scene,

	/**
	 * The level the current scene asks for, after the track's level match.
	 *
	 * For the test rather than the game, like isBedPlaying: the scene ladder is a
	 * set of claims about which moments duck under which, and nothing outside this
	 * module can otherwise see a gain that lives on a node inside audioGraph.
	 * It is the TARGET, not a measurement - use `npm run audio` for that.
	 */
	level: () => (scene === 'none' ? 0 : levelFor(scene)),

	/**
	 * Whether the track is sounding.
	 *
	 * For the test rather than the game: a fallback to no music and a successful
	 * load are otherwise indistinguishable from outside this module.
	 */
	isBedPlaying: () => bedHandle !== null,

	/** Full stop, for teardown. */
	stop() {
		scene = 'none';
		settle();
	},
};
