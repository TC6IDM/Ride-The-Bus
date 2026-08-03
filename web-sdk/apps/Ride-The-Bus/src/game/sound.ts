/**
 * Ride The Bus sound.
 *
 * Everything here is synthesised with the Web Audio API - there are no audio
 * assets and nothing is downloaded. That is a deliberate fit for this build:
 * config-svelte sets bundleStrategy:"inline", so any asset Vite processes is
 * base64-inlined into index.html rather than fetched, which makes shipped audio
 * disproportionately expensive. If produced audio is commissioned later it
 * belongs in static/ and loads via `${base}/...` like logo.png does; only the
 * bodies of the play* functions below would change, because Game.svelte touches
 * nothing but this module's public API.
 *
 * WHAT MAKES IT SOUND LIKE A GAME RATHER THAN A TEST TONE
 *
 * 1. A real output chain. Every voice runs into a shared bus with a limiter on
 *    the end, so overlapping cues - four card flips landing over a win fanfare -
 *    duck each other instead of clipping into distortion.
 *
 * 2. A room. A short generated impulse response on a reverb send puts the cues
 *    in a space. Dry oscillators are what made the previous version sound like
 *    a calculator; the wet path is quiet (this is a card table, not a cathedral)
 *    but removing it is instantly audible.
 *
 * 3. Nothing is ever played twice. Every cue is jittered per trigger - pitch by
 *    a few cents, timing by a few milliseconds, filters by a few hundred hertz -
 *    and every noise burst is a freshly generated buffer, so no two card flips
 *    are the same sample. This is the fix for the machine-gun effect you get
 *    when one identical cue fires four times in a round.
 *
 * 4. Buttons do not all sound alike. There are 34 buttons in Game.svelte and
 *    they used to share a single click. playPress now takes the KIND of control
 *    that was pressed, so committing to a guess, nudging the bet and dismissing
 *    a popup are audibly different actions.
 *
 * Browsers block audio until the user interacts with the page, so the context is
 * built lazily on the first cue and resumed on demand.
 */

const MUTE_STORAGE_KEY = 'ride-the-bus:muted';

let ctx: AudioContext | null = null;
/** Everything lands here; the limiter sits between this and the speakers. */
let bus: GainNode | null = null;
/** Reverb send. Voices tap this in parallel with their dry path. */
let send: GainNode | null = null;

function readStoredMute(): boolean {
	if (typeof localStorage === 'undefined') return false;
	try {
		return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

let muted = readStoredMute();

/**
 * A short plate-ish impulse response, generated rather than loaded.
 *
 * Two channels of noise decaying exponentially, with the very start left almost
 * silent so the reverb reads as a room around the cue rather than a doubling of
 * it. Kept to a third of a second: a card table is a small space, and anything
 * longer smears consecutive cues into each other.
 */
function buildImpulse(audio: AudioContext): AudioBuffer {
	const seconds = 0.32;
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

		bus = ctx.createGain();
		bus.gain.value = 0.42; // headroom - these are UI cues, not music
		bus.connect(limiter);

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
		wet.connect(bus);
	}
	// Autoplay policy: the context starts suspended until a user gesture.
	if (ctx.state === 'suspended') void ctx.resume();
	return ctx;
}

/* ---- variation ----------------------------------------------------------- */

/** Uniform random in [min, max). */
function rand(min: number, max: number): number {
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
function shuffler<T>(items: readonly T[]) {
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
};

function tone({
	from,
	to,
	duration,
	type = 'triangle',
	gain = 0.6,
	delay = 0,
	attack,
	space = 0.25,
	jitter = 12,
}: ToneOptions) {
	const audio = ensureContext();
	if (!audio || !bus || !send || muted) return;

	const wobble = drift(jitter);
	const start = audio.currentTime + delay;
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
	env.connect(bus);
	if (space > 0) {
		const tap = audio.createGain();
		tap.gain.value = space;
		env.connect(tap);
		tap.connect(send);
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
};

/**
 * Filtered noise burst - the papery part of a card, the transient on a chip.
 *
 * The buffer is regenerated on every call rather than cached. That costs a few
 * hundred microseconds and means two consecutive flips are genuinely different
 * noise, which is most of why the four reveals in a round no longer sound like
 * the same sample fired four times.
 */
function noise({
	duration = 0.09,
	gain = 0.35,
	from = 1800,
	to,
	q = 0.8,
	delay = 0,
	space = 0.3,
	curve = 1,
}: NoiseOptions = {}) {
	const audio = ensureContext();
	if (!audio || !bus || !send || muted) return;

	const start = audio.currentTime + delay;
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
	env.connect(bus);
	if (space > 0) {
		const tap = audio.createGain();
		tap.gain.value = space;
		env.connect(tap);
		tap.connect(send);
	}

	src.start(start);
}

/**
 * The low body under a hit - a fast downward sine sweep.
 * Sub content is what separates a card LANDING from a card being described.
 */
function thud({
	from = 180,
	to = 60,
	duration = 0.13,
	gain = 0.3,
	delay = 0,
}: { from?: number; to?: number; duration?: number; gain?: number; delay?: number } = {}) {
	tone({ from, to, duration, type: 'sine', gain, delay, space: 0.1, jitter: 30 });
}

/* ---- cues ---------------------------------------------------------------- */

/**
 * Which sort of control was pressed. Game.svelte maps its button classes onto
 * these so that the ~34 buttons stop sharing one click.
 */
export type PressKind =
	/** Committing to one of the four guesses - the important press. */
	| 'choice'
	/** Bet steppers and bet-level cells - a chip being nudged. */
	| 'chip'
	/** Spin / autospin / turbo - the round-driving controls. */
	| 'primary'
	/** Mute, info, switches - two-state controls. */
	| 'toggle'
	/** Everything else, notably dismissing a popup. */
	| 'soft';

// Fixed pitch sets per control kind, cycled without immediate repeats. Two
// presses in a row are therefore never the same note AND never the same detune,
// which is what stops a run of clicks sounding mechanical.
const softNotes = shuffler([380, 420, 460] as const);
const choiceNotes = shuffler([300, 340, 380] as const);
const chipNotes = shuffler([2100, 2400, 2750, 3050] as const);
const toggleNotes = shuffler([520, 580] as const);

export const sound = {
	isMuted: () => muted,

	setMuted(next: boolean) {
		muted = next;
		try {
			localStorage?.setItem(MUTE_STORAGE_KEY, String(next));
		} catch {
			/* storage unavailable (private mode) - mute still applies this session */
		}
	},

	toggleMuted() {
		sound.setMuted(!muted);
		return muted;
	},

	/**
	 * Any button / toggle press. `kind` decides what it sounds like; the default
	 * keeps old call sites working and is the quietest of the set.
	 */
	playPress(kind: PressKind = 'soft') {
		switch (kind) {
			case 'choice': {
				// A card being put down: a click with a body under it, so
				// committing to a guess feels heavier than browsing the UI.
				const root = choiceNotes();
				noise({ duration: 0.045, gain: 0.16, from: rand(1500, 2100), to: 900, curve: 1.8, space: 0.2 });
				tone({ from: root, to: root * 0.72, duration: 0.075, type: 'triangle', gain: 0.22, space: 0.3 });
				thud({ from: 150, to: 70, duration: 0.1, gain: 0.16 });
				break;
			}
			case 'chip': {
				// Clay on clay. Two short partials a rough fifth apart with a
				// scrap of noise on the front - the ring is what says "chip"
				// rather than "button".
				const top = chipNotes();
				noise({ duration: 0.02, gain: 0.14, from: 4200, curve: 2.2, space: 0.15 });
				tone({ from: top, duration: 0.05, type: 'sine', gain: 0.14, space: 0.35, jitter: 25 });
				tone({ from: top * 0.67, duration: 0.07, type: 'sine', gain: 0.1, space: 0.35, jitter: 25 });
				break;
			}
			case 'primary': {
				// The round-starting controls. Rising rather than falling, which
				// reads as committing to something instead of dismissing it.
				tone({ from: 300, to: 480, duration: 0.09, type: 'triangle', gain: 0.22, space: 0.3 });
				thud({ from: 170, to: 85, duration: 0.11, gain: 0.18 });
				break;
			}
			case 'toggle': {
				const root = toggleNotes();
				tone({ from: root, to: root * 0.8, duration: 0.045, type: 'square', gain: 0.12, space: 0.2 });
				break;
			}
			default: {
				const root = softNotes();
				tone({ from: root, to: root * 0.72, duration: 0.05, type: 'square', gain: 0.13, space: 0.2 });
			}
		}
	},

	/**
	 * A card turning face up.
	 *
	 * Three layers: the riffle (noise swept downward through a bandpass, which
	 * is the sound of the card releasing off the thumb), a short mid tone for
	 * the card's own body, and a soft thud as it lands on the felt. Every
	 * parameter is randomised within a range, so the four reveals in a round are
	 * four different flips rather than one flip four times.
	 */
	playCardFlip() {
		const bright = rand(2600, 3400);
		noise({
			duration: rand(0.07, 0.1),
			gain: rand(0.22, 0.3),
			from: bright,
			to: rand(800, 1200),
			q: rand(0.6, 1.1),
			curve: 1.4,
			space: 0.35,
		});
		tone({
			from: rand(300, 360),
			to: rand(480, 560),
			duration: 0.055,
			type: 'triangle',
			gain: 0.17,
			space: 0.3,
			jitter: 40,
		});
		thud({ from: rand(150, 200), to: 65, duration: 0.11, gain: 0.19, delay: rand(0.01, 0.025) });
	},

	/**
	 * A correct guess. Climbs with the stage so a streak audibly escalates: the
	 * root rises a whole tone per stage and the voicing opens from a bare fifth
	 * to a fifth plus octave, which brightens without just getting louder.
	 */
	playStageWin(stageIndex: number) {
		const root = 523.25 * Math.pow(2, (stageIndex * 2) / 12);
		tone({ from: root, duration: 0.16, type: 'triangle', gain: 0.3, space: 0.45, attack: 0.008 });
		tone({ from: root * 1.5, duration: 0.19, type: 'sine', gain: 0.2, delay: 0.035, space: 0.5 });
		if (stageIndex >= 2) {
			tone({ from: root * 2, duration: 0.22, type: 'sine', gain: 0.13, delay: 0.07, space: 0.55 });
		}
	},

	/**
	 * A wrong guess. A sawtooth dragged down under a noise scrape, with the
	 * bottom falling out beneath it - the point is that it should land badly.
	 */
	playBust() {
		tone({ from: rand(300, 330), to: 92, duration: 0.36, type: 'sawtooth', gain: 0.24, space: 0.4 });
		noise({ duration: 0.22, gain: 0.12, from: 1400, to: 260, q: 1.4, curve: 0.7, space: 0.4 });
		thud({ from: 130, to: 45, duration: 0.3, gain: 0.24, delay: 0.04 });
	},

	/** Round settled with a payout (partial or full). */
	playRoundWin() {
		[0, 1, 2].forEach((step) => {
			const freq = 620 * Math.pow(2, (step * 4) / 12);
			tone({
				from: freq,
				duration: 0.2,
				gain: 0.26,
				delay: step * 0.085 + rand(0, 0.012),
				space: 0.5,
				attack: 0.01,
			});
			tone({ from: freq * 2, duration: 0.16, type: 'sine', gain: 0.09, delay: step * 0.085 + 0.02, space: 0.55 });
		});
	},

	/**
	 * All four guesses correct. A major triad arpeggiated and then held, with
	 * the held voices detuned a few cents against each other so the chord
	 * shimmers instead of sitting there as a dead stack of sines.
	 */
	playFullWin() {
		const root = 523.25;
		const chord = [1, 1.26, 1.5, 2] as const;

		chord.forEach((ratio, i) => {
			tone({
				from: root * ratio,
				duration: 0.26,
				gain: 0.26,
				delay: i * 0.085,
				space: 0.55,
				attack: 0.012,
			});
		});

		// The sustained pad underneath, arriving as the arpeggio finishes.
		chord.forEach((ratio, i) => {
			tone({
				from: root * ratio,
				duration: 0.85,
				type: 'sine',
				gain: 0.1,
				delay: 0.3 + i * 0.01,
				attack: 0.12,
				space: 0.7,
				jitter: 9,
			});
		});

		// Shimmer on top - quiet, high, and late enough to read as sparkle.
		[0.42, 0.54, 0.66].forEach((delay, i) => {
			tone({
				from: root * (3 + i * 0.5),
				duration: 0.3,
				type: 'sine',
				gain: 0.055,
				delay,
				space: 0.8,
				jitter: 30,
			});
		});
	},

	/** Round settled with nothing back. Soft, low, and over quickly. */
	playRoundLoss() {
		tone({ from: rand(235, 250), to: 148, duration: 0.28, type: 'sine', gain: 0.2, space: 0.4, attack: 0.03 });
		tone({ from: rand(196, 205), to: 124, duration: 0.34, type: 'sine', gain: 0.12, delay: 0.05, space: 0.45 });
	},
};
