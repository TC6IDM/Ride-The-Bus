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
	attack,
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
} = {}) {
	tone({ from, to, duration, type: 'sine', gain, delay, attack, space: 0.1, jitter: 30 });
}

/* ---- cues ---------------------------------------------------------------- */

/**
 * Which sort of control was pressed. Game.svelte maps its button classes onto
 * these so that the ~34 buttons stop sharing one click.
 */
export type PressKind =
	/** Committing to one of the four guesses - the important press. */
	| 'choice'
	/** The two "equal" guesses, which are their own thing - see below. */
	| 'equal'
	/** Bet steppers and bet-level cells - a chip being nudged. */
	| 'chip'
	/** Spin / autospin / turbo - the round-driving controls. */
	| 'primary'
	/** Mute, info, switches - two-state controls. */
	| 'toggle'
	/** Everything else, notably dismissing a popup. */
	| 'soft';

/**
 * The four guess columns climb, left to right.
 *
 * Colour is the first thing you decide and suit is the last, so pressing across
 * the row walks up a whole-tone scale: C4, D4, E4, F#4. The player hears their
 * progress through the four decisions without anything having to say so, and a
 * half-finished selection is audibly half-finished.
 *
 * A whole tone per column on purpose, because that is exactly the step
 * playStageWin uses between stages. The press is the same interval an octave
 * down, so choosing the stage-3 guess previews the pitch that stage pays out on.
 */
const CHOICE_ROOTS = [261.63, 293.66, 329.63, 369.99] as const;

/** Guards the array lookup, and keeps an unknown column on the first note. */
function choiceRoot(stage: number): number {
	return CHOICE_ROOTS[Math.min(Math.max(stage, 0), CHOICE_ROOTS.length - 1)]!;
}

/**
 * Major scale, in semitones. Used by the turbo slider so a drag runs up a scale
 * instead of sweeping.
 *
 * Pentatonic was the first choice, on the grounds that having no semitones in it
 * meant no two consecutive notes could clash. That argument does not hold: the
 * slider plays one short blip at a time, never two together, so a semitone step
 * is a perfectly ordinary melodic move. What pentatonic did cost was
 * RESOLUTION - five notes per octave over two octaves is eleven pitches for
 * twenty-one slider steps, so half of all moves produced a tick at the pitch it
 * had just played, which defeats the point of the pitch meaning anything.
 * Seven per octave tracks the slider far more closely and still lands in key.
 */
const SCALE = [0, 2, 4, 5, 7, 9, 11] as const;

// Fixed pitch sets per control kind, cycled without immediate repeats. Two
// presses in a row are therefore never the same note AND never the same detune,
// which is what stops a run of clicks sounding mechanical.
const softNotes = shuffler([380, 420, 460] as const);
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
	 *
	 * `stage` is the guess column, 0 for colour through 3 for suit. It only means
	 * anything to 'choice' and 'equal', which use it to climb - see CHOICE_ROOTS.
	 */
	playPress(kind: PressKind = 'soft', stage = 0) {
		switch (kind) {
			case 'choice': {
				// Committing to a guess. Sine voices, a plain octave, and no
				// noise anywhere: this used to be a broadband transient under a
				// triangle glided down a minor third, and between the grit of
				// the noise and the buzz of a triangle sliding in pitch it came
				// out rough - a boop with sand on it. The pitch is steady now,
				// because the fall was doing most of that work.
				//
				// It is deliberately the same instrument as the equal bell
				// below, so the guess row sounds like one set of controls, but
				// plainer: a HARMONIC octave rather than an inharmonic partial,
				// half the length, and less room. The bell stays the special one
				// by being special, not by being the only tuned thing here.
				//
				// The root rises a whole tone per column, so the row reads left
				// to right as a climb rather than as four identical taps.
				// TIMING, not timbre, is what makes this feel soft or crisp. An
				// earlier pass tried to fix "dull" by stacking bright partials
				// on top and it only made the cue harsh - the voices were never
				// the problem. Measured, the loudest moment of that version
				// arrived about 30ms AFTER the press: the cue swelled instead of
				// striking, which is what soft actually means here. Three causes,
				// all of them envelope:
				//   - the body defaulted to a duration/4 attack, so the lowest
				//     and heaviest voice was also the slowest to arrive;
				//   - 4ms is already a swell on a sine, not a strike;
				//   - a 0.4 reverb send fills straight in behind the onset and
				//     smears the edge off it.
				// So: near-instant attacks, a shorter tail, and much less room.
				// Same voices, same pitches, same instrument.
				const root = choiceRoot(stage);
				// Gains are up a little on the wetter version this replaces:
				// cutting the reverb send takes real loudness out with it, and
				// the dry cue has to make that back or "crisper" just arrives as
				// "quieter".
				tone({ from: root * 2, duration: 0.085, type: 'sine', gain: 0.2, attack: 0.0012, space: 0.18 });
				tone({ from: root, duration: 0.115, type: 'sine', gain: 0.14, delay: 0.004, space: 0.22 });
				// A little weight underneath so the press still lands rather
				// than floating. Climbs with the row, but by less than the tone
				// does - a fixed body would drag the higher columns back down
				// and flatten the climb the tone is making.
				thud({ from: 118 + stage * 10, to: 74, duration: 0.06, gain: 0.08, attack: 0.001 });
				break;
			}
			case 'equal': {
				// The two "equal" guesses are the long shots - a rank tie at
				// stage 2, or the card landing exactly on a reference at stage 3
				// - and they pay accordingly. They get a struck bell rather than
				// a click: a bright fundamental with an INHARMONIC partial at
				// 2.76x, which is roughly where a real bell's first overtone
				// sits and is what stops a stack of sines sounding like an
				// organ. Longer, higher and wetter than its neighbours, so
				// reaching for it is audibly reaching for something else.
				//
				// It climbs with the row too: the equal at stage 3 rings a whole
				// tone above the one at stage 2, so it belongs to its column as
				// well as to its own family.
				// Gains run higher than the plain choice click because pure sines
				// with no transient under them measure far quieter than a
				// click-plus-thud at the same nominal level: written to match on
				// paper, the bell came out at half the peak of its neighbours,
				// which is the wrong way round for the cue that is supposed to
				// feel like the interesting one.
				const root = choiceRoot(stage) * 2;
				noise({ duration: 0.014, gain: 0.11, from: rand(4600, 5600), curve: 3, space: 0.3 });
				tone({ from: root, duration: 0.19, type: 'sine', gain: 0.21, attack: 0.004, space: 0.6 });
				tone({ from: root * 2.76, duration: 0.13, type: 'sine', gain: 0.08, space: 0.65, jitter: 22 });
				tone({ from: root * 1.5, duration: 0.24, type: 'sine', gain: 0.095, delay: 0.022, space: 0.65 });
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
	 * The turbo slider, one tick per step of travel.
	 *
	 * `position` is the slider's own 0..1 value and the pitch follows it
	 * directly, so dragging right climbs and dragging left falls - the sound is
	 * the position rather than a reaction to it, which is what makes it readable
	 * without looking.
	 *
	 * Two deliberate departures from every other cue here:
	 *
	 * NO JITTER. Everything else is detuned a few cents per trigger so repeats
	 * do not sound mechanical. This must not be: the whole point is that pitch
	 * MEANS something, and random detune would blur the very thing being
	 * reported. Two ticks at the same slider position should be the same pitch.
	 *
	 * VERY short and quiet. A range input fires on every step, so a full drag is
	 * about twenty of these in well under a second. At the length of a button
	 * press that would be a machine gun; at 45ms they run together into a sweep.
	 *
	 * SNAPPED TO A SCALE, not swept continuously. A straight exponential map of
	 * position to frequency is a siren - and down at the bottom of it, a short
	 * sine blip at 330Hz is just a bloop, which is what the first version of
	 * this sounded like. Rounding each step to the nearest degree of a major
	 * scale means a drag plays a RUN: every note lands in key, and it reads as a
	 * game rather than as a test oscillator.
	 *
	 * Two octaves up from A4, which keeps the whole range clear of the low
	 * register where short blips sound blunt. Where a jurisdiction caps the
	 * slider below 1 the top notes are simply never reached, which is correct:
	 * less available speed, lower top note.
	 */
	playSliderTick(position: number) {
		const clamped = Math.min(Math.max(position, 0), 1);

		// Nearest scale degree to where the slider actually sits.
		const semitones = clamped * 24;
		const octave = Math.floor(semitones / 12);
		const within = semitones - octave * 12;
		const degree = SCALE.reduce((best, d) => (Math.abs(d - within) < Math.abs(best - within) ? d : best));
		const freq = 440 * Math.pow(2, (octave * 12 + degree) / 12);

		// Triangle rather than sine for the carrying voice: its odd harmonics
		// are what make a short blip read as a game sound instead of a tone
		// generator. The octave above adds sparkle and is gone almost at once.
		tone({ from: freq, duration: 0.055, type: 'triangle', gain: 0.085, attack: 0.0015, space: 0.22, jitter: 0 });
		tone({ from: freq * 2, duration: 0.03, type: 'sine', gain: 0.03, attack: 0.001, space: 0.2, jitter: 0 });
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
		// Held at roughly 55% of the level the other layers were originally
		// written at. The flip is the most FREQUENT cue in the game - four of
		// them in a clean round, against one of anything else - and at equal
		// level a cue that repeats that often stops reading as punctuation and
		// starts reading as noise. All three layers are scaled together so the
		// balance between the riffle, the body and the landing is unchanged;
		// only the whole thing sits further back.
		const bright = rand(2600, 3400);
		noise({
			duration: rand(0.07, 0.1),
			gain: rand(0.12, 0.165),
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
			gain: 0.094,
			space: 0.3,
			jitter: 40,
		});
		thud({ from: rand(150, 200), to: 65, duration: 0.11, gain: 0.105, delay: rand(0.01, 0.025) });
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
	 * A wrong guess - the moment it goes wrong, not the verdict on the round.
	 *
	 * This used to be a sawtooth dragged from 300Hz down to 92 over 360ms. The
	 * problem was not the sound in isolation, it was that playRoundLoss arrives
	 * about 1.2 seconds later and is ALSO a slow downward glide, in an
	 * overlapping register, over a near-identical span. Two slow falls in a row
	 * read as one long descending noise rather than as an event and its
	 * consequence, which is why the reveal felt like it had a single "loss"
	 * sound in it.
	 *
	 * So this is the mirror of playStageWin rather than a new kind of noise -
	 * the same triangle and sine voices, the same note lengths, the same amount
	 * of room, built on the same C5 root. The win climbs away from that root and
	 * opens up; the bust falls away from it through a minor triad and settles.
	 * Heard next to each other they are obviously two halves of one idea, which
	 * a struck percussive hit never was: an earlier pass here used a broadband
	 * transient and a tritone, and it sat outside the rest of the game's voice
	 * entirely.
	 *
	 * It still separates from playRoundLoss, and on the axis that matters most:
	 * this steps between discrete notes, where the settle cue GLIDES. Stepped
	 * against slid is what stops them reading as one long descent, and it does
	 * not require them to be different instruments.
	 */
	playBust() {
		// Deliberately the SAME root the stage win is built on, so the two are
		// heard as a matched pair: the win climbs away from C, the bust falls
		// away from it.
		const root = 523.25;
		// C5, Ab4, F4 - an F minor triad taken downward. Minor because it has to
		// read as a loss, a triad rather than a dissonance because the rest of
		// the game is consonant and a clash would stand outside it.
		const fall = [1, Math.pow(2, -4 / 12), Math.pow(2, -7 / 12)];

		// The gains are lower than the single-note cues elsewhere because these
		// three overlap - each note is still sounding when the next arrives -
		// and the low octave lands on top of the third. Written at stage-win
		// levels the stack measured 0.185, which made losing a stage the second
		// loudest thing in the game, above a stage win and above a payout.
		tone({ from: root * fall[0]!, duration: 0.17, type: 'triangle', gain: 0.165, space: 0.45, attack: 0.008 });
		tone({ from: root * fall[1]!, duration: 0.2, type: 'sine', gain: 0.14, delay: 0.085, space: 0.5 });
		tone({ from: root * fall[2]!, duration: 0.28, type: 'triangle', gain: 0.125, delay: 0.17, space: 0.55 });

		// Weight underneath the last note - the floor giving way. Tonal, an
		// octave below where the figure lands, rather than a thump: it should
		// settle the phrase, not punctuate it.
		tone({ from: root * fall[2]! * 0.5, duration: 0.34, type: 'sine', gain: 0.082, delay: 0.17, space: 0.4 });
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
