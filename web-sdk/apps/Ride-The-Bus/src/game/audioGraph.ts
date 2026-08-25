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
 * Everything here is synthesised - there are no audio assets and nothing is
 * downloaded. That is a deliberate fit for this build: config-svelte sets
 * bundleStrategy:"inline", so any asset Vite processes is base64-inlined into
 * index.html rather than fetched, which makes shipped audio disproportionately
 * expensive. If produced audio is commissioned later it belongs in static/ and
 * loads via `${base}/...` like logo.png does; only the bodies of sound.ts's
 * play* functions would change, because Game.svelte touches nothing but that
 * module's public API.
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
 * Anything that needs to know the mix moved. music.ts subscribes so its
 * scheduler can shut down the moment its bus goes silent rather than ticking
 * forever behind a zeroed gain - the same "off costs nothing" property the
 * cues get from returning before they build a node.
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
		buses.music.gain.connect(master);
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
		musicReverb.buffer = buildImpulse(ctx, 1.9);

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
		const musicWet = ctx.createGain();
		musicWet.gain.value = 0.32;

		musicSend = ctx.createGain();
		musicSend.gain.value = 1;
		musicSend.connect(musicReverb);
		musicReverb.connect(musicDamp);
		musicDamp.connect(musicWet);
		musicWet.connect(buses.music.gain);

		watchVisibility(ctx);
	}
	// Autoplay policy: the context starts suspended until a user gesture. The
	// announce() is what lets music.ts in: its scheduler refuses to run until a
	// context is actually running, and the first press of the game is what makes
	// that true - so the room arrives with the first thing the player clicks
	// rather than waiting for them to open the mixer.
	if (ctx.state === 'suspended') void ctx.resume().then(announce);
	return ctx;
}

/**
 * Release the audio hardware when the tab goes away, and take it back when the
 * player returns.
 *
 * Nothing in the cue book sustains, so before music this was merely tidy. It
 * stops being optional the moment a bed loops: a backgrounded tab otherwise
 * keeps its scheduler running and keeps playing, which is the single most
 * complained-about behaviour a browser game can have. Stake's own SDK tracks
 * the same two signals - see utils-sound/src/createSound.svelte.ts.
 */
function watchVisibility(audio: AudioContext) {
	if (typeof document === 'undefined') return;
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			if (audio.state === 'running') void audio.suspend();
		} else if (audio.state === 'suspended') {
			// announce() once it is actually running again, so a stopped music
			// scheduler picks the room back up rather than waiting for the player
			// to touch the mixer.
			void audio.resume().then(announce);
		}
	});
}

/**
 * The context clock, for anything scheduling onto a grid rather than reacting to
 * a click. Null until the graph exists, and null when the music bus is silent -
 * a sequencer must not be the thing that opens an AudioContext for a player who
 * has turned everything off.
 */
export function contextTime(): number | null {
	if (silent('music')) return null;
	// Deliberately does NOT call ensureContext. Music must never be the thing
	// that opens an AudioContext: nothing has been clicked yet when the loader is
	// on screen, so a scheduler that forced one into existence would put a
	// suspended context - and on some browsers an "audio playing" badge on the
	// tab - in front of a player who has not so much as touched the page. The cue
	// book opens the context on the first press, which is a real gesture, and the
	// room joins whatever is already there.
	//
	// Requiring 'running' rather than merely existing also means the scheduler
	// stops by itself when watchVisibility suspends a hidden tab.
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
	/**
	 * Absolute context time to start at, instead of "now plus delay".
	 *
	 * Cues fire in response to something the player just did, so `delay` off
	 * currentTime is exactly right for them. A sequencer is the other case: it
	 * decides at 100ms notice where a note belongs on a grid, and re-reading
	 * currentTime at the moment of scheduling would let every note drift by
	 * however long the tick took to run.
	 */
	at?: number;
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
	at,
}: ToneOptions) {
	const voice = openVoice(bus);
	if (!voice) return;
	const { audio, out, room } = voice;

	const wobble = drift(jitter);
	const start = (at ?? audio.currentTime) + delay;
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
	/** Shapes the amplitude decay. >1 snaps shut, <1 lingers. */
	curve?: number;
	/** Which bus this voice belongs to. Cues are 'sfx'; music.ts passes 'music'. */
	bus?: AudioBusName;
	/** Absolute context time to start at. See ToneOptions.at. */
	at?: number;
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
	bus = 'sfx',
	at,
}: NoiseOptions = {}) {
	const voice = openVoice(bus);
	if (!voice) return;
	const { audio, out, room } = voice;

	const start = (at ?? audio.currentTime) + delay;
	const frames = Math.max(1, Math.floor(audio.sampleRate * duration));
	const buffer = audio.createBuffer(1, frames, audio.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < frames; i++) {
		data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, curve);
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
