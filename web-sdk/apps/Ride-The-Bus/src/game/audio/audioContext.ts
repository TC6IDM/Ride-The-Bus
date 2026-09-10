/**
 * The shared audio output chain, and the three voices every cue is built from.
 *
 * Split out of sound.ts, which is where all of this used to live. The split is
 * not tidying: music needs the SAME AudioContext, bus, limiter and reverb that
 * the cues use. A second context would be a second limiter with no knowledge of
 * the first, so a fanfare and a music bed would each stay clean on their own
 * meter and clip against each other on the speakers - and browsers cap how many
 * contexts a page may open at all.
 *
 * EVERY CUE IS SYNTHESISED. THE MUSIC BED IS THE ONE FILE.
 *
 * Nothing in the cue book is a sample and nothing in it is downloaded - the
 * three voices below build every sound the game makes in response to a player.
 * The single exception is music.ts's bed, which is a produced track, and it
 * loads through decode() at the bottom of this file rather than through an
 * import.
 *
 * THAT DISTINCTION IS LOAD-BEARING. config-svelte sets bundleStrategy:"inline",
 * so any asset Vite processes is base64-inlined into index.html rather than
 * fetched - at roughly 1.4x its real size, in a document that blocks first
 * paint. The bed therefore lives in static/ and is fetched by URL, exactly as
 * logo.png is (see logoAsset.svelte.ts, which explains why that file is a third
 * of the payload). An `import bed from './bed.mp3'` would silently undo all of
 * this, and would not fail any test.
 *
 * The URL is INJECTED rather than imported, and that is also not arbitrary:
 * `${base}` comes from SvelteKit's $app/paths, and a module reaching an $app/*
 * virtual cannot be imported by a node test - betLimits.test.ts carries the
 * scar. So bedAsset.ts owns the URL, Game.svelte hands it to music.setBed, and
 * music.ts stays import-free and testable. musicTracks.ts holds the candidates
 * and decides which of them that URL points at.
 *
 * WHAT THIS FILE OWNS
 *
 * 1. A real output chain. Every voice runs into a shared bus with a limiter on
 *    the end, so overlapping cues - four card flips landing over a win fanfare -
 *    duck each other instead of clipping into distortion.
 *
 * 2. A room. A short generated impulse response on a reverb send puts the cues
 *    in a space. Dry oscillators are what made an early version sound like a
 *    calculator; the wet path is quiet (this is a card table, not a cathedral)
 *    but removing it is instantly audible.
 *
 * 3. The variation machinery. Every cue is jittered per trigger - pitch by a few
 *    cents, timing by a few milliseconds, filters by a few hundred hertz - and
 *    every noise burst is a freshly generated buffer, so no two card flips are
 *    the same sample. This is the fix for the machine-gun effect you get when
 *    one identical cue fires four times in a round. The knobs are here; which
 *    cue turns which one is sound.ts's business.
 *
 * 4. Mute. Muting returns before anything is scheduled rather than turning a
 *    gain to zero, so a muted game builds no nodes at all. sound.test.ts pins
 *    that, because it is a CPU claim as much as an audio one.
 *
 * Browsers block audio until the user interacts with the page, so the context is
 * built lazily on the first cue and resumed on demand.
 *
 * ONE OF FIVE. audioGraph.ts was 1,197 lines; it is now audioMixer.ts (what the
 * player has set), audioContext.ts (the one graph, and when it may open),
 * audioVariation.ts (the randomness every cue borrows), audioVoices.ts (tone,
 * noise, thud) and audioLoop.ts (the produced bed's overlapping passes). The
 * whole-graph argument - why ONE context, one limiter, one room - is at the top
 * of audioContext.ts.
 */
import {
  MASTER_HEADROOM,
  type AudioBusName,
  announce,
  applyGain,
  buses,
  silent,
} from './audioMixer.ts';

let ctx: AudioContext | null = null;
/** Headroom into the limiter. Both buses land here. */
let master: GainNode | null = null;
/** Reverb send for the SFX bus. Voices tap this in parallel with their dry path. */
let send: GainNode | null = null;
/** The music bus's own, longer room. See buildImpulse. */
let musicSend: GainNode | null = null;

/**
 * A short plate-ish impulse response, generated rather than loaded.
 *
 * Two channels of noise decaying exponentially, with the very start left almost
 * silent so the reverb reads as a room around the cue rather than a doubling of
 * it. Kept to a third of a second: a card table is a small space, and anything
 * longer smears consecutive cues into each other.
 */
function buildImpulse(audio: AudioContext, seconds = 0.32): AudioBuffer {
	const frames = Math.floor(audio.sampleRate * seconds);
	const impulse = audio.createBuffer(2, frames, audio.sampleRate);

	for (let channel = 0; channel < 2; channel++) {
		const data = impulse.getChannelData(channel);
		for (let i = 0; i < frames; i++) {
			const progress = i / frames;
			// Exponential tail, plus a slow fade-in over the first 8% so the
			// wet signal never arrives before the dry one.
			const decay = Math.pow(1 - progress, 2.6);
			const onset = Math.min(1, progress / 0.08);
			data[i] = (Math.random() * 2 - 1) * decay * onset;
		}
	}
	return impulse;
}

/** Lazily build the audio graph. Returns null when audio isn't available. */
export function ensureContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	// Whether THIS call is the one that brings the graph into existence. The
	// announce at the bottom depends on it - see the note there.
	const built = !ctx;
	if (!ctx) {
		const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
		if (!Ctor) return null;
		ctx = new Ctor();

		// The limiter. A compressor with a high ratio and a fast attack, sitting
		// on the very end - its job is only to stop stacked cues clipping, not
		// to be heard. Without it a full-win fanfare over a card flip is audibly
		// crunchy on the peaks.
		const limiter = ctx.createDynamicsCompressor();
		limiter.threshold.value = -10;
		limiter.knee.value = 6;
		limiter.ratio.value = 12;
		limiter.attack.value = 0.003;
		limiter.release.value = 0.18;
		limiter.connect(ctx.destination);

		master = ctx.createGain();
		master.gain.value = MASTER_HEADROOM;
		master.connect(limiter);

		// One bus per volume slider. Music and cues share the limiter above so
		// that a fanfare landing over a music bed is ducked as one signal - two
		// contexts, or two limiters, would each stay clean alone and clip
		// against each other on the speakers.
		buses.sfx.gain = ctx.createGain();
		buses.sfx.gain.connect(master);
		buses.music.gain = ctx.createGain();

		// A HIGHPASS ON THE MUSIC BUS, AND NOTHING ELSE.
		//
		// No EQ here on purpose. The bed is a produced file that arrives already
		// balanced, so anything shaping it on the way out reads as a bad track
		// rather than as a bad EQ decision - and it would be tuned against a file
		// nobody had chosen yet. Brightness belongs in the track, where it can be
		// heard while it is being picked.
		//
		// The highpass is protection rather than taste. Small speakers cannot
		// reproduce the bottom octave and turn it into intermodulation instead, and
		// this bus shares a limiter with the cue book, so sub energy here steals
		// headroom from every card flip. 48Hz is below any musical fundamental a
		// bed is likely to carry.
		const sub = ctx.createBiquadFilter();
		sub.type = 'highpass';
		sub.frequency.value = 48;
		sub.Q.value = 0.707;

		buses.music.gain.connect(sub);
		sub.connect(master);

		applyGain('sfx');
		applyGain('music');

		const reverb = ctx.createConvolver();
		reverb.buffer = buildImpulse(ctx);

		// Roll the top off the wet path. Bright reverb on a click sounds like a
		// tiled bathroom; darker tails read as a room with furniture in it.
		const damp = ctx.createBiquadFilter();
		damp.type = 'lowpass';
		damp.frequency.value = 3200;

		const wet = ctx.createGain();
		wet.gain.value = 0.5;

		send = ctx.createGain();
		send.gain.value = 1;
		send.connect(reverb);
		reverb.connect(damp);
		damp.connect(wet);
		// The wet return lands on the SFX bus, not on master, so that pulling
		// the cue slider down takes the room down with it. Returned to master it
		// would leave a reverb tail of a cue whose dry signal had been turned
		// off, which sounds like a fault rather than like a quieter game.
		wet.connect(buses.sfx.gain);

		// A second, much longer room for music. The cue reverb is 0.32s because
		// anything longer smears consecutive card flips into each other; a bed
		// wants the opposite, and borrowing the short one made the ambience sound
		// like it was playing in the next room through a door.
		const musicReverb = ctx.createConvolver();
		// 1.0s. A CARD ROOM, NOT A CHAPEL. A 1.9s tail is the size of a hall, and
		// a hall behind a quiet sound reads as melancholy whatever is in it; a
		// small room reads as a place with people in it.
		musicReverb.buffer = buildImpulse(ctx, 1.0);

		// 3400Hz, not 1800. The darker setting was copied from the cue reverb's
		// reasoning - bright reverb on a CLICK sounds like a tiled bathroom - but
		// a music bed is the opposite case: rolling the top off at 1800 took all
		// the air out of it and was a large part of why the room came out sounding
		// bleak rather than warm.
		const musicDamp = ctx.createBiquadFilter();
		musicDamp.type = 'lowpass';
		musicDamp.frequency.value = 4200;

		// Drier again. At 0.62 the bed was more reverb than source, which reads as
		// distance; at 0.44 it still smeared the arpeggio's attacks together, and
		// those attacks are the whole reason the arpeggio is there.
		//
		// 0.24 now, for the same reason the tail above was shortened: distance
		// reads as wistful, and a shorter tail at the old send level would only
		// have sounded like a smaller sad room. This puts the bed closer.
		const musicWet = ctx.createGain();
		musicWet.gain.value = 0.24;

		musicSend = ctx.createGain();
		musicSend.gain.value = 1;
		musicSend.connect(musicReverb);
		musicReverb.connect(musicDamp);
		musicDamp.connect(musicWet);
		musicWet.connect(buses.music.gain);

		watchVisibility(ctx);
	}
	// Autoplay policy: the context starts suspended until a user gesture. The
	// announce() is what lets music.ts in: it will not load or start the bed
	// until a context is actually running, and the first press of the game is
	// what makes that true - so the music arrives with the first thing the
	// player clicks rather than waiting for them to open the mixer.
	if (ctx.state === 'suspended') void ctx.resume().then(announce);
	// ...but a context BORN running must announce too, and this is what made the
	// start screen silent.
	//
	// Chrome hands you a context already in 'running' when it is constructed
	// inside a real gesture handler - which is exactly where the cue book builds
	// it, on the player's first press. The suspended branch above is then
	// skipped, and without this nothing announces, so music.ts is never told a
	// context exists and never loads the bed - with no error anywhere.
	//
	// The start screen is where that bites. It sets its scene once, while the
	// loader is up and before any context can exist, and never again; the board
	// hides the bug because reaching it is a SECOND setScene, which reconciles
	// again by itself. Pinned by music.test.ts's first block.
	//
	// queueMicrotask so listeners never run part-way through construction above.
	else if (built) queueMicrotask(announce);
	return ctx;
}

/**
 * Release the audio hardware when the tab goes away, and take it back when the
 * player returns.
 *
 * Nothing in the cue book sustains, so for the cues alone this would be merely
 * tidy. It stops being optional the moment a bed loops: a backgrounded tab
 * otherwise keeps playing, which is the single most complained-about behaviour
 * a browser game can have. Suspending the whole context is what stops the
 * looping track without music.ts needing to know the tab went away. Stake's own
 * SDK tracks the same two signals - see utils-sound/src/createSound.svelte.ts.
 */
function watchVisibility(audio: AudioContext) {
	if (typeof document === 'undefined') return;
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			if (audio.state === 'running') void audio.suspend();
		} else if (audio.state === 'suspended') {
			// announce() once it is actually running again, so music.ts picks the
			// track back up rather than waiting for the player to touch the mixer.
			void audio.resume().then(announce);
		}
	});
}

// Whether the browser will let us open a context yet, and primeAudio(),
// live in audioAutoplay.ts - a permission question rather than a graph one.

/**
 * The context clock, and the test for "is there a graph to play on at all".
 *
 * Null until the graph exists, and null when the music bus is silent - music
 * must not be the thing that opens an AudioContext for a player who has turned
 * everything off. music.ts reads it before fetching the bed.
 */
export function contextTime(): number | null {
	if (silent('music')) return null;
	// Deliberately does NOT call ensureContext. Music must never be the thing
	// that opens an AudioContext: nothing has been clicked yet when the loader is
	// on screen, so forcing one into existence would put a suspended context -
	// and on some browsers an "audio playing" badge on the tab - in front of a
	// player who has not so much as touched the page. The cue book opens the
	// context on the first press, which is a real gesture, and the music joins
	// whatever is already there.
	//
	// Requiring 'running' rather than merely existing also means a hidden tab,
	// which watchVisibility suspends, reads as "nothing to play on".
	if (!ctx || ctx.state !== 'running') return null;
	return ctx.currentTime;
}

/**
 * Turn downloaded bytes into a playable buffer, or null.
 *
 * Deliberately does NOT call ensureContext, for exactly the reason contextTime
 * does not: music must never be the thing that opens an AudioContext. By the
 * time anything asks to decode, the cue book has already opened one on a real
 * gesture - and if it has not, returning null simply leaves the game without
 * music rather than forcing a context in front of a player who has not touched
 * the page.
 *
 * Every failure path returns null rather than throwing. A missing or corrupt
 * bed must degrade to the synthesised room, not to a broken game: Stake fails
 * builds on console errors, and "no music" is a far cheaper outcome than "no
 * game".
 */
export async function decode(bytes: ArrayBuffer): Promise<AudioBuffer | null> {
	if (!ctx) return null;
	try {
		return await ctx.decodeAudioData(bytes);
	} catch {
		return null;
	}
}

/**
 * The reverb send a bus taps, or null before the graph is open.
 *
 * One accessor rather than exporting the two nodes, because they are `let`s
 * that ensureContext replaces - an importer holding the value would keep the
 * one that existed when it first read it, which before the graph opens is null
 * forever. audioVoices asks per voice, which is also when it matters.
 */
export function roomFor(name: AudioBusName): GainNode | null {
  return name === 'sfx' ? send : musicSend;
}
