/**
 * The voices every cue in the book is built from: tone, noise and thud, which
 * are fire-and-forget, and swell, the one held voice, which hands back a
 * release because the moment it scores can end early.
 *
 * openVoice is the gate they all pass through, and it asks BOTH halves of the
 * split: audioContext for the graph, audioMixer for whether this bus would
 * produce anything. A muted bus returns null before a single node is built -
 * "off costs nothing" is a CPU claim as much as an audio one, because an
 * autoplay run on instant turbo drives hundreds of cues a minute past it.
 *
 * ONE OF FIVE. audioGraph.ts was 1,197 lines; it is now audioMixer.ts (what the
 * player has set), audioContext.ts (the one graph, and when it may open),
 * audioVariation.ts (the randomness every cue borrows), audioVoices.ts (tone,
 * noise, thud, swell) and audioLoop.ts (the produced bed's overlapping passes). The
 * whole-graph argument - why ONE context, one limiter, one room - is at the top
 * of audioContext.ts.
 */
import { type AudioBusName, buses, silent } from './audioMixer.ts';
import { ensureContext, roomFor } from './audioContext.ts';
import { drift } from './audioVariation.ts';

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
export function openVoice(name: AudioBusName) {
	if (silent(name)) return null;
	const audio = ensureContext();
	const out = buses[name].gain;
	if (!audio || !out) return null;
	return { audio, out, room: roomFor(name) };
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

type SwellOptions = {
	/** Pitch at the start and at the top of the climb, in Hz. */
	from: number;
	to?: number;
	/** Seconds to climb from `from` to `to`. The top is held after that, until
	 *  the release. */
	climb: number;
	/** The singers, as [ratio to the pitch, level]. A handful a few cents apart
	 *  is what turns one tone into a crowd. */
	voices?: readonly (readonly [number, number])[];
	type?: OscillatorType;
	/** Peak gain 0..1, before the bus gain. */
	gain?: number;
	/** Where the level starts, as a fraction of `gain`. The crescendo is the
	 *  distance from here to the top. */
	floor?: number;
	/** The vowel, as formants [Hz, Q, level]: every singer is heard through all
	 *  of them at once. None, and the singers are heard as they are. */
	formants?: readonly (readonly [number, number, number])[];
	/** A lowpassed path beside the formants, for weight: a formant bank takes
	 *  the fundamental away with everything else between its peaks. */
	body?: number;
	/** Breath: pink noise through the same formants, at this level beside the
	 *  singers. */
	breath?: number;
	/** Vibrato, [at the start, at the top] for its rate in Hz and its depth in
	 *  cents. */
	vibrato?: { rate: readonly [number, number]; depth: readonly [number, number] };
	space?: number;
	/** Maximum random detune of the whole crowd, in cents. */
	jitter?: number;
	bus?: AudioBusName;
};

/** Seconds a swell may go on sounding past the top when nothing releases it. */
const SWELL_CEILING = 4;

/** Seconds of breath, looped. Longer than any hold, so the loop is never heard. */
const BREATH_SECONDS = 2.5;

/**
 * How a swell ends: over `seconds`, falling `cents` in pitch as it goes. The
 * defaults are a plain 90ms fade; a large negative `cents` is a dive.
 */
export type SwellRelease = (end?: { seconds?: number; cents?: number }) => void;

/**
 * Seconds of pink noise in a fresh buffer, for a voice that has to BREATHE for
 * as long as it is held - noise()'s bursts are shaped to die away. Paul
 * Kellet's filter and normalisation, the same as noise() uses.
 */
function pinkBuffer(audio: BaseAudioContext, seconds: number): AudioBuffer {
	const frames = Math.max(1, Math.floor(audio.sampleRate * seconds));
	const buffer = audio.createBuffer(1, frames, audio.sampleRate);
	const data = buffer.getChannelData(0);
	let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; // prettier-ignore
	for (let i = 0; i < frames; i++) {
		const w = Math.random() * 2 - 1;
		b0 = 0.99886 * b0 + w * 0.0555179;
		b1 = 0.99332 * b1 + w * 0.0750759;
		b2 = 0.969 * b2 + w * 0.153852;
		b3 = 0.8665 * b3 + w * 0.3104856;
		b4 = 0.55 * b4 + w * 0.5329522;
		b5 = -0.7616 * b5 - w * 0.016898;
		data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
		b6 = w * 0.115926;
	}
	return buffer;
}

/**
 * A HELD voice - the one voice here that is not told how long it lasts.
 *
 * tone(), noise() and thud() are fire-and-forget: each knows its length and
 * schedules its own end. The last card's hold cannot work that way. The wait it
 * sits under can end early - a tap collapses the reveal to instant, and the
 * turbo slider can move mid-round - and a voice that outlived the card it was
 * building towards would be the one sound in the game that lied about what is
 * happening. So this climbs for `climb`, holds the top if nothing stops it, and
 * hands back a release.
 *
 * The release goes through a gain stage of its OWN, not the swell's envelope.
 * Cutting an envelope mid-ramp means knowing where the ramp had got to, and
 * `AudioParam.value` does not report that reliably across browsers
 * (cancelAndHoldAtTime, which would, is missing in Firefox) - guess wrong and
 * the level steps, which is a click. A second stage sitting at 1.0 has nothing
 * to cancel: it only ever falls from where it already is. The release can also
 * DIVE, through `detune`, which the climb never writes - so nothing scheduled is
 * cancelled there either, even when the wait was cut short mid-climb.
 *
 * WHAT IT SINGS. With `formants` it is a vowel rather than a tone: every
 * singer through a bank of band-passes at the vowel's resonances, which stay
 * put while the pitch moves - exactly what a mouth does, and why a voice
 * sliding up still sounds like the same word. Breath through the same bank and
 * a vibrato that widens as it climbs make the handful of detuned singers a
 * crowd. Without formants a sawtooth is a closed-mouth buzz, which is what the
 * last-card hum was until the owner asked for "more ohhhh, less mmmm".
 *
 * EVERYTHING CLIMBS IN A STRAIGHT LINE - pitch, level, vibrato - one
 * linearRampToValueAtTime each, in plain Hz and plain gain, and then holds the
 * top until released. The caller sets both times, so whatever lies between the
 * top and the release is the plateau.
 *
 * Nothing sounds past SWELL_CEILING after the top whatever the caller does, so
 * a release that never arrives - a reveal that threw, a closed game - still ends.
 */
export function swell({
	from,
	to = from,
	climb,
	voices = [[1, 1]],
	type = 'sawtooth',
	gain = 0.1,
	floor = 0.3,
	formants = [],
	body = 0,
	breath = 0,
	vibrato,
	space = 0.3,
	jitter = 8,
	bus = 'sfx',
}: SwellOptions): SwellRelease {
	const voice = openVoice(bus);
	if (!voice) return () => {};
	const { audio, out, room } = voice;

	const wobble = drift(jitter);
	// Same lead as tone(): a start inside the block being rendered is a click.
	const start = audio.currentTime + 0.005;
	const top = start + Math.max(climb, 0.05);

	/** Take `param` from `a` to `b` between two times, in a straight line. */
	const line = (param: AudioParam, a: number, b: number, begin: number, end: number) => {
		param.setValueAtTime(a, begin);
		param.linearRampToValueAtTime(b, end);
	};

	// Everything the singers make meets here, then goes out through the vowel.
	const mix = audio.createGain();

	// The swell: in quickly at `floor` of the top so it is there from the first
	// beat of the wait, then the rest of the way in a straight line.
	const attack = Math.min(0.12, climb / 4);
	const env = audio.createGain();
	env.gain.setValueAtTime(0.0001, start);
	env.gain.exponentialRampToValueAtTime(gain * floor, start + attack);
	line(env.gain, gain * floor, gain, start + attack, top);

	const gate = audio.createGain();
	gate.gain.value = 1;

	if (formants.length === 0) mix.connect(env);
	for (const [frequency, q, level] of formants) {
		const band = audio.createBiquadFilter();
		band.type = 'bandpass';
		band.frequency.value = frequency;
		band.Q.value = q;
		const weight = audio.createGain();
		weight.gain.value = level;
		mix.connect(band);
		band.connect(weight);
		weight.connect(env);
	}
	if (body > 0) {
		const low = audio.createBiquadFilter();
		low.type = 'lowpass';
		low.frequency.value = 320;
		low.Q.value = 0.7;
		const weight = audio.createGain();
		weight.gain.value = body;
		mix.connect(low);
		low.connect(weight);
		weight.connect(env);
	}

	const singers = voices.map(([ratio, level]) => {
		const osc = audio.createOscillator();
		osc.type = type;
		line(osc.frequency, from * ratio * wobble, to * ratio * wobble, start, top);
		const weight = audio.createGain();
		weight.gain.value = level;
		osc.connect(weight);
		weight.connect(mix);
		return osc;
	});

	const held: AudioScheduledSourceNode[] = [...singers];

	if (vibrato) {
		const lfo = audio.createOscillator();
		lfo.type = 'sine';
		line(lfo.frequency, vibrato.rate[0], vibrato.rate[1], start, top);
		const depth = audio.createGain();
		line(depth.gain, vibrato.depth[0], vibrato.depth[1], start, top);
		lfo.connect(depth);
		for (const osc of singers) depth.connect(osc.detune);
		held.push(lfo);
	}

	if (breath > 0) {
		const air = audio.createBufferSource();
		air.buffer = pinkBuffer(audio, BREATH_SECONDS);
		air.loop = true;
		const weight = audio.createGain();
		weight.gain.value = breath;
		air.connect(weight);
		weight.connect(mix);
		held.push(air);
	}

	env.connect(gate);
	gate.connect(out);
	if (space > 0 && room) {
		const tap = audio.createGain();
		tap.gain.value = space;
		gate.connect(tap);
		tap.connect(room);
	}

	for (const node of held) {
		node.start(start);
		node.stop(top + SWELL_CEILING);
	}

	let released = false;
	return ({ seconds = 0.09, cents = 0 } = {}) => {
		if (released) return;
		released = true;
		// The same lead as the start: a change scheduled at currentTime can land
		// inside the block already being rendered.
		const now = audio.currentTime + 0.005;
		const end = now + seconds;
		// A dive holds full level for its first quarter - a fall has to be HEARD -
		// and a plain fade goes at once.
		let hold = 0;
		if (cents !== 0) {
			hold = seconds * 0.25;
			for (const osc of singers) {
				osc.detune.setValueAtTime(0, now);
				osc.detune.linearRampToValueAtTime(cents, end);
			}
		}
		gate.gain.setValueAtTime(1, now + hold);
		// Five time constants in what is left: under 1% remains when the voices stop.
		gate.gain.setTargetAtTime(0, now + hold, (seconds - hold) / 5);
		for (const node of held) node.stop(end + 0.02);
	};
}
