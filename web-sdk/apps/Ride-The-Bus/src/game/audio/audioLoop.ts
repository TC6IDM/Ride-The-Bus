/**
 * The produced bed, played as OVERLAPPING PASSES rather than src.loop = true.
 *
 * A produced track ends on a fade to silence, so a hard wrap plays that decay
 * into a cold entry forever. Each pass is its own source started
 * `span - crossfade` after the last, and the seams are equal-power curves -
 * two uncorrelated bars sum as powers, so a linear pair dips 3 dB - while the
 * arrival fade stays linear. All of that is commented where it happens.
 *
 * ONE OF FIVE. audioGraph.ts was 1,197 lines; it is now audioMixer.ts (what the
 * player has set), audioContext.ts (the one graph, and when it may open),
 * audioVariation.ts (the randomness every cue borrows), audioVoices.ts (tone,
 * noise, thud) and audioLoop.ts (the produced bed's overlapping passes). The
 * whole-graph argument - why ONE context, one limiter, one room - is at the top
 * of audioContext.ts.
 */
import type { AudioBusName } from './audioMixer.ts';
import { openVoice } from './audioVoices.ts';

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
