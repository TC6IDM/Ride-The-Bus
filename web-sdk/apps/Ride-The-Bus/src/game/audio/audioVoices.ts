/**
 * The three voices every cue in the book is built from: tone, noise, thud.
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
 * noise, thud) and audioLoop.ts (the produced bed's overlapping passes). The
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

