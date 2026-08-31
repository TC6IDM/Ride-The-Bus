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
 */

let ctx: AudioContext | null = null;
/** Headroom into the limiter. Both buses land here. */
let master: GainNode | null = null;
/** Reverb send for the SFX bus. Voices tap this in parallel with their dry path. */
let send: GainNode | null = null;
/** The music bus's own, longer room. See buildImpulse. */
let musicSend: GainNode | null = null;

/**
 * Two buses, because a player who wants the music off usually still wants to
 * hear the cards. `volume` and `muted` are kept as SEPARATE fields rather than
 * collapsed into "volume 0 means muted", and that is what lets the two controls
 * in the panel agree with each other:
 *
 *   - the speaker button toggles `muted` and leaves `volume` where it was, so
 *     unmuting returns to the level the player had chosen rather than to a
 *     default;
 *   - dragging a slider to zero also mutes, so the speaker glyph never claims
 *     sound is on while the bus is silent;
 *   - unmuting a bus whose slider is parked at zero lifts it back to the last
 *     audible level, because a speaker button that visibly does nothing reads
 *     as broken.
 *
 * 0-100 rather than 0-1, and defaulting to 75, to match the convention the
 * platform already sets in state-shared/src/stateSound.svelte.ts.
 */
export type AudioBusName = 'music' | 'sfx';

const DEFAULT_VOLUME = 75;

/**
 * Level 75 lands the SFX path on 0.42 - the exact gain the single bus used
 * before it was split, so the default mix is unchanged for anyone upgrading.
 * The remaining headroom above 75 is real rather than clipped: the limiter is
 * still the last thing before the speakers.
 */
const MASTER_HEADROOM = 0.56;

const STORAGE_PREFIX = 'ride-the-bus:';
/** What the single global mute was stored under before the split. */
const LEGACY_MUTE_KEY = `${STORAGE_PREFIX}muted`;

function readStored(key: string): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStored(key: string, value: string) {
	try {
		localStorage?.setItem(key, value);
	} catch {
		/* storage unavailable (private mode) - the setting still applies this session */
	}
}

type BusState = {
	volume: number;
	muted: boolean;
	/** Where an unmute returns to when the slider is sitting at zero. */
	lastAudible: number;
	gain: GainNode | null;
};

function loadBus(name: AudioBusName): BusState {
	// The null check has to come FIRST. Number(null) is 0, not NaN, and 0 passes
	// a finite-and-in-range test perfectly well - so folding the two together
	// silently gave every player with no stored setting a volume of zero, which
	// is to say it opened the game in silence for everyone installing it. Found
	// in the browser, not here: the unit test asked for the default and got 75,
	// because un-muting had already lifted it off the floor before the assert.
	const raw = readStored(`${STORAGE_PREFIX}vol:${name}`);
	const storedVolume = raw === null ? Number.NaN : Number(raw);
	const volume =
		Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 100
			? storedVolume
			: DEFAULT_VOLUME;

	const storedMute = readStored(`${STORAGE_PREFIX}mute:${name}`);
	// Migration, not a fallback. A player who muted the game before the split
	// stored a single `ride-the-bus:muted`, and silently un-muting them on
	// upgrade is the one outcome that is definitely wrong.
	const muted = storedMute === null ? readStored(LEGACY_MUTE_KEY) === 'true' : storedMute === 'true';

	return { volume, muted, lastAudible: volume || DEFAULT_VOLUME, gain: null };
}

const buses: Record<AudioBusName, BusState> = {
	music: loadBus('music'),
	sfx: loadBus('sfx'),
};

/** True when this bus would produce nothing - muted, or turned all the way down. */
function silent(name: AudioBusName): boolean {
	const bus = buses[name];
	return bus.muted || bus.volume <= 0;
}

function applyGain(name: AudioBusName) {
	const bus = buses[name];
	if (bus.gain) bus.gain.gain.value = silent(name) ? 0 : bus.volume / 100;
}

function persist(name: AudioBusName) {
	const bus = buses[name];
	writeStored(`${STORAGE_PREFIX}vol:${name}`, String(bus.volume));
	writeStored(`${STORAGE_PREFIX}mute:${name}`, String(bus.muted));
}

/**
 * Anything that needs to know the mix moved. music.ts subscribes so it can
 * release the looping track the moment its bus goes silent, and start it again
 * when the bus comes back - the same "off costs nothing" property the cues get
 * from returning before they build a node.
 */
const mixerListeners = new Set<() => void>();

export function onMixerChange(listener: () => void): () => void {
	mixerListeners.add(listener);
	return () => mixerListeners.delete(listener);
}

function announce() {
	for (const listener of mixerListeners) listener();
}

export function busVolume(name: AudioBusName): number {
	return buses[name].volume;
}

export function isBusMuted(name: AudioBusName): boolean {
	return buses[name].muted;
}

/** True when the bus is producing nothing, whether by mute or by level. */
export function isBusSilent(name: AudioBusName): boolean {
	return silent(name);
}

export function setBusVolume(name: AudioBusName, next: number) {
	const bus = buses[name];
	bus.volume = Math.min(100, Math.max(0, Math.round(next)));
	// The slider and the speaker are two views of one state: dragging to the
	// bottom mutes, and dragging back up un-mutes. Without this the panel can
	// show a lit speaker over a silent bus.
	bus.muted = bus.volume <= 0;
	if (bus.volume > 0) bus.lastAudible = bus.volume;
	applyGain(name);
	persist(name);
	announce();
}

export function setBusMuted(name: AudioBusName, next: boolean) {
	const bus = buses[name];
	bus.muted = next;
	// Un-muting a bus parked at zero has to move the slider too, or the button
	// appears to do nothing at all.
	if (!next && bus.volume <= 0) bus.volume = bus.lastAudible;
	applyGain(name);
	persist(name);
	announce();
}

export function toggleBusMuted(name: AudioBusName): boolean {
	setBusMuted(name, !buses[name].muted);
	return buses[name].muted;
}

/**
 * The whole-game switch, kept because Game.svelte's bar button and Stake's
 * CMP-09 both talk about "sound" rather than about buses. Reading it as "both
 * buses are silent" rather than tracking a third flag is what stops the bar
 * icon disagreeing with the panel behind it.
 */
export function isMuted(): boolean {
	return silent('music') && silent('sfx');
}

export function setMuted(next: boolean) {
	setBusMuted('music', next);
	setBusMuted('sfx', next);
}

export function toggleMuted(): boolean {
	const next = !isMuted();
	setMuted(next);
	return next;
}

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
function ensureContext(): AudioContext | null {
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

/**
 * Whether this document may open an AudioContext without being touched first.
 *
 * THREE ANSWERS, CHEAPEST FIRST, because no one of them covers every browser.
 *
 * 1. getAutoplayPolicy. Chrome 110+ and Firefox 120+ answer directly and for
 *    free. Missing from Safari, and missing from the Chromium the audio lab
 *    runs, which is how the fallbacks below came to be needed at all.
 * 2. userActivation.hasBeenActive. Weaker - it says nothing about an embedder
 *    that granted autoplay - but never a false positive, and true on a remount.
 * 3. A THROWAWAY CONTEXT, which is the only thing that works on Safari and the
 *    only thing that sees an allow="autoplay" iframe. Build one, read its state,
 *    close it. This was avoided at first on the grounds that a blocked context
 *    logs "The AudioContext was not allowed to start" - a Stake build failure -
 *    but that was measured through CDP with Log.enable on, and a context that is
 *    CONSTRUCTED and closed without ever being resumed or scheduled logs
 *    nothing. Chrome emits that warning on a refused resume(), not on birth.
 *    Nothing renders through it either, so there is no tab badge.
 */
function autoplayPermitted(): boolean {
	if (typeof navigator === 'undefined') return false;
	const nav = navigator as Navigator & {
		getAutoplayPolicy?: (type: string) => string;
		userActivation?: { hasBeenActive?: boolean };
	};
	if (typeof nav.getAutoplayPolicy === 'function') {
		try {
			return nav.getAutoplayPolicy('audiocontext') === 'allowed';
		} catch {
			// An older signature, or an argument it does not know. Fall through to
			// the checks below rather than assuming either answer.
		}
	}
	if (nav.userActivation?.hasBeenActive === true) return true;

	if (typeof window === 'undefined') return false;
	const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
	if (!Ctor) return false;
	try {
		const probe: AudioContext = new Ctor();
		const allowed = probe.state === 'running';
		// Closed either way, and immediately. A kept probe would be a second
		// context competing for the per-page limit with the one that matters.
		void probe.close?.();
		return allowed;
	} catch {
		return false;
	}
}

/**
 * Every gesture that can legally unlock audio, including on iOS.
 *
 * `touchend` rather than `touchstart`: Safari has historically only counted a
 * completed touch, and a scroll that begins with a touchstart is not a gesture
 * anyone meant as one.
 */
const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

/**
 * Open the graph at the earliest moment the browser will allow, so the bed is
 * playing on the loading and start screens rather than arriving at the board.
 *
 * WHY THIS IS NEEDED AT ALL. Before it, the ONLY thing that ever built a context
 * was the cue book, on a real press - and there is nothing to press while the
 * loader is up. So the two screens before the board set a music scene that could
 * never sound, and the track arrived with the tap that left them. music.ts still
 * refuses to open a context itself, and that rule is intact: this is the GAME
 * asking for audio, not the music module reaching for it.
 *
 * TWO PATHS, because there are two situations:
 *
 *   1. The embedder allows autoplay - Stake's iframe with allow="autoplay", or a
 *      returning player Chrome already trusts. Then the context is built now,
 *      is born running, and the bed fades up under the loading screen.
 *   2. It does not. Then nothing is built, nothing is logged, and the FIRST
 *      gesture anywhere on the page opens it - a tap on the help badge, a key
 *      press, the tap on "Tap to continue" itself. Capture phase, so it lands
 *      before the button's own handler and the music starts on the same tap
 *      rather than one interaction later.
 *
 * A cold load in a strict embed still cannot make sound before the player
 * touches something. That is a browser rule, not a setting.
 *
 * Returns a teardown, because the listeners outlive nothing else here.
 */
export function primeAudio(): () => void {
	if (typeof document === 'undefined') return () => {};

	if (autoplayPermitted()) {
		ensureContext();
		return () => {};
	}

	const stop = () => {
		for (const type of UNLOCK_EVENTS) document.removeEventListener(type, unlock, true);
	};
	const unlock = () => {
		// Removed FIRST: ensureContext is re-entrant but three listeners firing off
		// one tap would call it three times, and the announce it triggers walks
		// every mixer listener each time.
		stop();
		ensureContext();
	};

	for (const type of UNLOCK_EVENTS) {
		document.addEventListener(type, unlock, { capture: true, passive: true });
	}
	return stop;
}

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

/* ---- variation ----------------------------------------------------------- */

/** Uniform random in [min, max). */
export function rand(min: number, max: number): number {
	return min + Math.random() * (max - min);
}

/**
 * Detune by up to `cents` in either direction, as a frequency multiplier.
 * Musical rather than linear: a few cents is a shade out of tune at any pitch,
 * whereas a few hertz is inaudible up high and a semitone down low.
 */
function drift(cents: number): number {
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

/* ---- voices -------------------------------------------------------------- */

/**
 * The one gate every voice passes through.
 *
 * Silence is checked BEFORE ensureContext, not inside the null-guard with the
 * rest. Built the other way round, the first cue of a muted session still
 * opened an AudioContext and built a limiter, a convolver and a generated
 * impulse response - so "muted costs nothing" was false for exactly the player
 * who had asked for nothing. Some browsers also badge the tab as playing audio
 * the moment a context exists.
 *
 * It reads isBusSilent rather than the mute flag, so a slider dragged to zero
 * skips the work as cheaply as the speaker button does.
 */
/*
 * NO VOICE CAP HERE, AND THAT IS A DECISION.
 *
 * A rolling "at most N voices per 60ms" guard was built and removed. Two things
 * were wrong with it, and both are worth knowing before adding one again.
 *
 * It measured the wrong clock. A cap on voices SCHEDULED cannot tell a burst
 * apart from a large cue: a Max Win fanfare schedules 21 voices in one call, but
 * their delays spread them over about two seconds, so they never sound together
 * and there is nothing to protect against. To be meaningful the budget would
 * have to count voices by the time they START, not the time they are built.
 *
 * And it had nothing left to protect. The case it was written for - a slammed
 * round firing four card flips and four stage wins on the same millisecond, ~24
 * voices the limiter then ducks as one signal, so the round comes out mushier
 * the FASTER it is played - is fixed in Game.svelte's reveal loop, by not
 * sounding per-card cues for a reveal that did not visibly happen. That is the
 * right place: it decides what a slammed round should sound like, where a cap
 * would only have thinned it by dropping arbitrary notes.
 *
 * What it did do was silently refuse real cues once anything fired more than 64
 * voices inside a wall-clock window, which the test suite manages easily and a
 * long autoplay run might. Insurance that can fail closed on a Max Win is worse
 * than the overload it prevents.
 */
function openVoice(name: AudioBusName) {
	if (silent(name)) return null;
	const audio = ensureContext();
	const out = buses[name].gain;
	if (!audio || !out) return null;
	return { audio, out, room: name === 'sfx' ? send : musicSend };
}

type ToneOptions = {
	/** Start frequency in Hz. */
	from: number;
	/** End frequency in Hz; omit for a steady tone. */
	to?: number;
	/** Seconds. */
	duration: number;
	type?: OscillatorType;
	/** Peak gain 0..1, before the bus gain. */
	gain?: number;
	/** Seconds to wait before starting - used to build small arpeggios. */
	delay?: number;
	/** Attack in seconds. Longer softens a cue from a click into a swell. */
	attack?: number;
	/** How much of this voice goes to the reverb, 0..1. */
	space?: number;
	/** Maximum random detune, in cents. */
	jitter?: number;
	/** Which bus this voice belongs to. Cues are 'sfx'; music.ts passes 'music'. */
	bus?: AudioBusName;
};

export function tone({
	from,
	to,
	duration,
	type = 'triangle',
	gain = 0.6,
	delay = 0,
	attack,
	space = 0.25,
	jitter = 12,
	bus = 'sfx',
}: ToneOptions) {
	const voice = openVoice(bus);
	if (!voice) return;
	const { audio, out, room } = voice;

	const wobble = drift(jitter);
	// A few milliseconds of lead, never zero. Starting a voice at exactly
	// currentTime can land inside the block the audio thread is already
	// rendering, which truncates the first segment of the attack ramp - a step
	// edge, which is a click. 5ms is one block at any sample rate this runs at,
	// and is far below anything audible as latency on a cue.
	const start = audio.currentTime + Math.max(delay, 0.005);
	const osc = audio.createOscillator();
	const env = audio.createGain();

	osc.type = type;
	osc.frequency.setValueAtTime(from * wobble, start);
	if (to !== undefined) {
		osc.frequency.exponentialRampToValueAtTime(Math.max(1, to * wobble), start + duration);
	}

	// Quick attack, smooth decay - avoids the click a raw start/stop makes.
	const rise = attack ?? Math.min(0.02, duration / 4);
	env.gain.setValueAtTime(0.0001, start);
	env.gain.exponentialRampToValueAtTime(gain, start + rise);
	env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

	osc.connect(env);
	env.connect(out);
	if (space > 0 && room) {
		const tap = audio.createGain();
		tap.gain.value = space;
		env.connect(tap);
		tap.connect(room);
	}

	osc.start(start);
	osc.stop(start + duration + 0.02);
}

type NoiseOptions = {
	duration?: number;
	gain?: number;
	/** Bandpass centre at the start, in Hz. */
	from?: number;
	/** Bandpass centre at the end - sweeping is what makes a noise burst a THING
	 *  rather than a hiss. Omit to hold still. */
	to?: number;
	q?: number;
	delay?: number;
	space?: number;
	/** Pink rather than white. Room tone is pink; a card flip is fine white. */
	pink?: boolean;
	/** Shapes the amplitude decay. >1 snaps shut, <1 lingers. */
	curve?: number;
	/** Which bus this voice belongs to. Cues are 'sfx'; music.ts passes 'music'. */
	bus?: AudioBusName;
};

/**
 * Filtered noise burst - the papery part of a card, the transient on a chip.
 *
 * The buffer is regenerated on every call rather than cached. That costs a few
 * hundred microseconds and means two consecutive flips are genuinely different
 * noise, which is most of why the four reveals in a round no longer sound like
 * the same sample fired four times.
 */
export function noise({
	duration = 0.09,
	gain = 0.35,
	from = 1800,
	to,
	q = 0.8,
	delay = 0,
	space = 0.3,
	curve = 1,
	pink = false,
	bus = 'sfx',
}: NoiseOptions = {}) {
	const voice = openVoice(bus);
	if (!voice) return;
	const { audio, out, room } = voice;

	// Same lead as tone(): a burst that begins mid-block starts part-way down its
	// own decay, which is a click.
	const start = audio.currentTime + Math.max(delay, 0.005);
	const frames = Math.max(1, Math.floor(audio.sampleRate * duration));
	const buffer = audio.createBuffer(1, frames, audio.sampleRate);
	const data = buffer.getChannelData(0);

	/**
	 * A few milliseconds of fade-in, and it is not cosmetic.
	 *
	 * The shape here is a DECAY only - Math.pow(1 - i/frames, curve) starts at
	 * 1.0 - and the gain node below is a constant, so every burst used to step
	 * from silence to full amplitude on sample zero. A step edge is a click, and
	 * a click with noise behind it is a snare.
	 *
	 * It was inaudible while these layers sat at gain 0.026-0.03. Raising the
	 * room to carry the bed, and then putting a high shelf over it, is what
	 * made it audible - a shelf boosts exactly the broadband energy a step edge
	 * is made of. tone() has always ramped its envelope up for this reason; this
	 * is noise() catching up.
	 *
	 * Raised cosine rather than linear: a linear fade still has a corner at each
	 * end, and a corner is a (quieter) click. Capped at a quarter of the burst
	 * so the shortest chip - 18ms - keeps its attack and does not turn into a
	 * swell, which would cost the room its sense of things being SET DOWN.
	 */
	const attack = Math.max(1, Math.min(Math.round(audio.sampleRate * 0.005), Math.floor(frames * 0.25)));
	const shape = (i: number) => {
		const rise = i < attack ? 0.5 - 0.5 * Math.cos((Math.PI * i) / attack) : 1;
		return rise * Math.pow(1 - i / frames, curve);
	};

	if (pink) {
		// Paul Kellet's filter. Room tone measures PINK - equal energy per
		// octave, -3dB per octave - and white does not: white has as much energy
		// in the top octave as in everything below it put together, which is why
		// a white burst reads as hiss and a pink one reads as a thing in a room.
		// Chips settling and cards on felt are the layer this bed leans on for
		// movement, so it is the layer worth getting right.
		//
		// Per-burst state, not shared: each burst is its own buffer by design
		// (see the variation note at the top of this file), and carrying the
		// filter state across bursts would correlate them, which is the machine
		// gun effect that design exists to avoid.
		let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; // prettier-ignore
		for (let i = 0; i < frames; i++) {
			const w = Math.random() * 2 - 1;
			b0 = 0.99886 * b0 + w * 0.0555179;
			b1 = 0.99332 * b1 + w * 0.0750759;
			b2 = 0.969 * b2 + w * 0.153852;
			b3 = 0.8665 * b3 + w * 0.3104856;
			b4 = 0.55 * b4 + w * 0.5329522;
			b5 = -0.7616 * b5 - w * 0.016898;
			// 0.11 is the standard normalisation for this filter - it brings the
			// sum back to roughly unit peak, so `gain` means the same thing on a
			// pink burst as on a white one and no call site has to be re-tuned.
			data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11 * shape(i);
			b6 = w * 0.115926;
		}
	} else {
		for (let i = 0; i < frames; i++) {
			data[i] = (Math.random() * 2 - 1) * shape(i);
		}
	}

	const src = audio.createBufferSource();
	src.buffer = buffer;

	const band = audio.createBiquadFilter();
	band.type = 'bandpass';
	band.frequency.setValueAtTime(from, start);
	if (to !== undefined) {
		band.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
	}
	band.Q.value = q;

	const env = audio.createGain();
	env.gain.value = gain;

	src.connect(band);
	band.connect(env);
	env.connect(out);
	if (space > 0 && room) {
		const tap = audio.createGain();
		tap.gain.value = space;
		env.connect(tap);
		tap.connect(room);
	}

	src.start(start);
}

/**
 * The low body under a hit - a fast downward sine sweep.
 * Sub content is what separates a card LANDING from a card being described.
 */
/* ---- the produced bed ---------------------------------------------------- */

type LoopOptions = {
	buffer: AudioBuffer;
	/** Peak gain 0..1, before the bus gain. */
	gain?: number;
	/** Seconds to fade up over. A bed must never be heard to START. */
	fadeIn?: number;
	/**
	 * How much of it goes to the music room, 0..1. ZERO by default, unlike every
	 * other voice here: the convolver is a 1.0s synthetic space built for
	 * oscillators, and a produced track arrives with its own room already on it.
	 * Sending one through the other smears it and reads as distance.
	 */
	space?: number;
	bus?: AudioBusName;
	/**
	 * Seconds of overlap between the end of one pass and the start of the next.
	 *
	 * Zero restores the plain hard wrap - `src.loop = true` and nothing else -
	 * which is correct only for a file whose last sample already meets its first.
	 * A produced track is not that file, so music.ts always passes an overlap.
	 */
	crossfade?: number;
	/** Seconds into the buffer the usable region starts. Default 0. */
	loopStart?: number;
	/** Seconds into the buffer the usable region ends. Default the whole file. */
	loopEnd?: number;
};

/**
 * A running loop, and the two things a scene change needs to do to one.
 *
 * A handle rather than a bare stop function because setScene must CROSS-FADE:
 * the scenes play the same bed at different levels, and restarting the source
 * at the new gain would cut the room off and start it again, which is the one
 * thing music.ts's setScene contract says never happens.
 */
export type LoopHandle = {
	/** Ramp to a new level over `seconds`. */
	setGain(next: number, seconds?: number): void;
	/** Ramp down and release every source. Safe to call twice. */
	stop(fadeOut?: number): void;
};

/** How far ahead of the clock passes are scheduled, and how often that is topped up. */
const LOOP_LOOKAHEAD = 8;
const LOOP_TICK_MS = 1500;

/** Points in an equal-power fade curve. The browser interpolates between them. */
const FADE_POINTS = 64;

/**
 * An equal-power fade, as a value curve.
 *
 * NOT linear, and that is the whole reason this is a curve rather than two
 * linearRampToValueAtTime calls. A cross-fade lays the track's tail over its own
 * head, which is UNCORRELATED material - two different bars of music. Those sum
 * as POWERS, not as amplitudes: a linear pair sits at 0.5 + 0.5 in the middle,
 * which is 3 dB down, so every seam would breathe. cos and sin squared sum to 1
 * at every point, so the level holds flat right through it.
 *
 * A rising and a falling curve are the same shape read in opposite directions.
 */
function equalPowerCurve(rising: boolean): Float32Array {
	const curve = new Float32Array(FADE_POINTS);
	for (let i = 0; i < FADE_POINTS; i++) {
		const x = i / (FADE_POINTS - 1);
		curve[i] = Math.cos((rising ? 1 - x : x) * 0.5 * Math.PI);
	}
	return curve;
}

const FADE_IN_CURVE = equalPowerCurve(true);
const FADE_OUT_CURVE = equalPowerCurve(false);

/**
 * Apply one fade to a gain param, by curve where that exists and by ramp where
 * it does not.
 *
 * setValueCurveAtTime is in every browser Stake's checklist names, so the
 * fallback is not a support hedge - it is there because a param without it is
 * exactly what a test double looks like, and a bed that throws under test is
 * worse than a bed that fades linearly under test.
 */
function fade(p: AudioParam, rising: boolean, at: number, seconds: number) {
	if (typeof p.setValueCurveAtTime === 'function') {
		p.setValueCurveAtTime(rising ? FADE_IN_CURVE : FADE_OUT_CURVE, at, seconds);
		return;
	}
	p.setValueAtTime(rising ? 0 : 1, at);
	p.linearRampToValueAtTime(rising ? 1 : 0, at + seconds);
}

/**
 * Play a decoded buffer on a loop, overlapping each pass with the next.
 *
 * The fourth voice, and the only one that is not synthesised. It goes through
 * openVoice like the other three, so "muted builds no nodes at all" survives -
 * a muted player never reaches this even if a buffer is already decoded and
 * sitting in memory.
 *
 * WHY THIS IS NOT `src.loop = true`.
 *
 * That is one source wrapping from its last sample to its first, and it is
 * seamless only for a file authored to be. A produced track is not one: it opens
 * on a downbeat and closes on a fade to silence - every candidate in static/
 * measures 12 to 17 seconds of decaying outro - so a hard wrap plays that decay
 * into a cold entry every few minutes, which is the most audible thing the bed
 * could possibly do. Instead each pass is a SOURCE OF ITS OWN, started
 * `span - crossfade` after the one before it, so the tail of one plays over the
 * head of the next and neither end is ever heard alone.
 *
 * That needs passes scheduled AHEAD OF THE CLOCK, which is what the interval is
 * for. It is a top-up, not a metronome: it schedules anything starting inside
 * the next LOOP_LOOKAHEAD seconds and does nothing the rest of the time. When
 * the page hides, audioGraph suspends the context and currentTime stops
 * advancing, so the pump keeps ticking and correctly schedules nothing.
 *
 * TWO GAIN STAGES, DELIBERATELY.
 *
 * `env` is the whole loop's level and belongs to the SCENE - setGain ramps it,
 * stop() collapses it. Each pass then has a gain of its own carrying nothing but
 * its own cross-fade. Collapsed into one param, a scene change landing mid-seam
 * would cancel the fade holding two passes in balance, and the seam would jump.
 *
 * THE ARRIVAL FADE IS LINEAR, WHERE THE SEAMS ARE EQUAL-POWER.
 *
 * Different jobs. A seam balances two signals against each other and wants
 * constant power - hence the curve. The arrival raises ONE signal out of
 * silence, and the shape that suits a struck note is wrong for it: tone() ramps
 * exponentially from 0.0001, which spends most of its length below audibility
 * and then arrives all at once. A linear ramp has no such knee, and a bed fading
 * up over two and a half seconds is the case that cares most about that.
 */
export function loop({
	buffer,
	gain = 0.5,
	fadeIn = 2.0,
	space = 0,
	bus = 'music',
	crossfade = 0,
	loopStart = 0,
	loopEnd,
}: LoopOptions): LoopHandle | null {
	const voice = openVoice(bus);
	if (!voice) return null;
	const { audio, out, room } = voice;

	// The usable region, clamped into the file. A loopEnd written for a longer
	// track than the one actually decoded must not schedule silence.
	const from = Math.max(0, Math.min(loopStart, buffer.duration));
	const to = Math.min(loopEnd ?? buffer.duration, buffer.duration);
	const span = to - from;

	// A seam needs the region comfortably longer than two overlaps: a pass's fade
	// in must finish before its own fade out begins, or the two curves collide on
	// one param and the browser throws. Anything tighter falls back to the hard
	// wrap, which is ugly but always plays.
	const overlap = span > crossfade * 2 + 0.5 ? Math.max(0, crossfade) : 0;
	const period = span - overlap;

	// Same 5ms cushion the other voices take. See the note in tone().
	const start = audio.currentTime + 0.005;

	const env = audio.createGain();
	env.gain.setValueAtTime(0, start);
	env.gain.linearRampToValueAtTime(gain, start + fadeIn);
	env.connect(out);
	if (space > 0 && room) {
		const tap = audio.createGain();
		tap.gain.value = space;
		env.connect(tap);
		tap.connect(room);
	}

	let live = true;
	const sources = new Set<AudioBufferSourceNode>();

	/** Schedule one pass. Index 0 is the first, which needs no fade in. */
	function schedulePass(index: number, at: number) {
		const src = audio.createBufferSource();
		src.buffer = buffer;
		// Set even though each pass is stopped after exactly one span: if a stop
		// lands a block late, the source wraps back into the region instead of
		// running on into the outro the region was trimmed to avoid.
		src.loop = true;
		src.loopStart = from;
		src.loopEnd = to;

		const g = audio.createGain();
		// The first pass arrives through env's own fade up from silence. Fading it
		// in here as well would square the curve and make the bed crawl in.
		if (index === 0 || overlap === 0) g.gain.setValueAtTime(1, at);
		else fade(g.gain, true, at, overlap);
		if (overlap > 0) fade(g.gain, false, at + period, overlap);

		src.connect(g);
		g.connect(env);
		if (overlap === 0) {
			// One source wrapping forever, which is what a file authored to loop
			// actually wants. It must NOT be given an end: only stop() releases it.
			src.start(at, from);
		} else {
			// The third argument is the pass's own end, and it lands exactly where
			// the fade out curve reaches zero - so the source stops at silence and
			// there is no step edge to click. An explicit src.stop() here would be
			// a second, later end for the same pass, and stop() below could then no
			// longer be told apart from it.
			src.start(at, from, span);
		}
		src.onended = () => sources.delete(src);
		sources.add(src);
	}

	let nextIndex = 0;
	let nextStart = start;

	function pump() {
		if (!live) return;
		// A guard, not a schedule: period comes from a decoded duration, and a zero
		// would spin this loop forever on a corrupt single-sample buffer.
		if (period <= 0) return;
		const now = audio.currentTime;
		while (nextStart < now + LOOP_LOOKAHEAD) {
			schedulePass(nextIndex++, nextStart);
			// Zero overlap is one endless wrapping source, so there is never a
			// second pass to schedule. Without this the lookahead would happily
			// stack another copy of the track on top of it every period.
			if (overlap === 0) return;
			nextStart += period;
		}
	}

	pump();
	// No overlap means one wrapping source covers the whole loop, so there is
	// nothing to top up and no timer to leak.
	const timer = overlap > 0 ? setInterval(pump, LOOP_TICK_MS) : null;

	/**
	 * Take over from whatever ramp is in flight.
	 *
	 * cancelScheduledValues then pin the CURRENT value, rather than
	 * cancelAndHoldAtTime which is the tidier API and is missing from Firefox
	 * for most of its history. Without the pin, cancelling mid-fade-in drops the
	 * gain back to the last explicitly scheduled point - which is zero - and the
	 * bed audibly restarts on every scene change.
	 */
	const takeOver = (now: number) => {
		const current = env.gain.value;
		env.gain.cancelScheduledValues(now);
		env.gain.setValueAtTime(current, now);
	};

	return {
		setGain(next, seconds = 1.5) {
			if (!live) return;
			const now = audio.currentTime;
			takeOver(now);
			env.gain.linearRampToValueAtTime(next, now + seconds);
		},
		stop(fadeOut = 0.6) {
			if (!live) return;
			live = false;
			if (timer !== null) clearInterval(timer);
			const now = audio.currentTime;
			takeOver(now);
			env.gain.linearRampToValueAtTime(0, now + fadeOut);
			// A little past the end of the ramp: stopping ON it truncates the last
			// block and leaves a step edge, which is a click. Every pass gets this,
			// including ones scheduled ahead that have not sounded yet - re-stopping
			// a source at an earlier time is legal, and is what releases them.
			for (const src of sources) src.stop(now + fadeOut + 0.05);
			sources.clear();
		},
	};
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

export function thud({
	from = 180,
	to = 60,
	duration = 0.13,
	gain = 0.3,
	delay = 0,
	attack,
	bus = 'sfx',
}: {
	from?: number;
	to?: number;
	duration?: number;
	gain?: number;
	delay?: number;
	/** Override the default attack. Worth doing on short bodies: tone() would
	 *  otherwise take duration/4, so a 70ms body swells for 17ms and becomes the
	 *  latest-arriving thing in a cue that is supposed to feel struck. */
	attack?: number;
	bus?: AudioBusName;
} = {}) {
	tone({ from, to, duration, type: 'sine', gain, delay, attack, space: 0.1, jitter: 30, bus });
}
