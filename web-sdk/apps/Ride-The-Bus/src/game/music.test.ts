/**
 * The room, checked the same way the cue book is: a fake AudioContext, and a
 * count of what actually gets scheduled onto it.
 *
 * The two things worth pinning here are both invisible in the source:
 *
 * 1. The scheduler must not run when nobody can hear it. A 25ms timer left
 *    ticking behind a muted bus is the sort of thing that never shows up until
 *    a reviewer's battery does.
 *
 * 2. The layers must not line up. Co-prime periods are the whole reason this
 *    sounds like a place rather than a loop, and "16, 11 and 7 share no
 *    factors" is exactly the kind of claim that survives a refactor into
 *    "16, 8 and 4" without anyone noticing until they have listened for a
 *    minute.
 *
 * What it cannot say is whether the result is pleasant. That needs ears.
 */
import assert from 'node:assert/strict';
import { test, describe, beforeEach, afterEach } from 'node:test';

/* ---- the fake ------------------------------------------------------------ */

const created = { oscillators: 0, bufferSources: 0 };

/**
 * Every oscillator, with the pitch it started on and the peak gain of the
 * envelope tone() built for it.
 *
 * Counting TOTAL voices cannot measure the tension bed: the drone fires every
 * 8s and the pad every 5.5s, so any window short enough to be a quick test
 * varies by more than the bed adds, and the comparison comes out flaky. Pitch
 * can, because the bed's notes are its own - stage 3 sits on F#3/185Hz, which
 * appears nowhere in the pad set.
 */
const voiceLog: { freq: number; gain: number }[] = [];
let pendingVoice: { freq: number; gain: number } | null = null;

function param(initial = 0) {
	return {
		value: initial,
		setValueAtTime(v: number) {
			this.value = v;
			return this;
		},
		exponentialRampToValueAtTime(v: number) {
			this.value = v;
			return this;
		},
		linearRampToValueAtTime(v: number) {
			this.value = v;
			return this;
		},
	};
}

/**
 * The context clock, driven by hand.
 *
 * A module-level value read through a getter rather than a field on the
 * instance, so the test never has to get hold of the context object the graph
 * built for itself. A real clock would make the look-ahead window unrepeatable,
 * and the whole point here is exactly how many steps land in a known span.
 */
let clock = 0;

class FakeAudioContext {
	sampleRate = 48000;
	state: 'suspended' | 'running' = 'running';

	get currentTime() {
		return clock;
	}

	destination = { connect() {} };

	resume() {
		this.state = 'running';
		return Promise.resolve();
	}
	suspend() {
		this.state = 'suspended';
		return Promise.resolve();
	}

	createOscillator() {
		created.oscillators++;
		const record = { freq: 0, gain: 0 };
		voiceLog.push(record);
		// tone() builds the envelope immediately after the oscillator, so the next
		// createGain belongs to this voice.
		pendingVoice = record;
		const node = {
			type: 'sine',
			frequency: param(),
			connect() {},
			start() {
				record.freq = node.frequency.value;
			},
			stop() {},
		};
		return node;
	}
	createBufferSource() {
		created.bufferSources++;
		return { buffer: null, connect() {}, start() {} };
	}
	createGain() {
		const owner = pendingVoice;
		pendingVoice = null;
		const node = { gain: param(1), connect() {} };
		if (owner) {
			// The peak the envelope ramps up to is this voice's loudness.
			const raw = node.gain;
			node.gain = {
				...raw,
				exponentialRampToValueAtTime(v: number) {
					if (v > owner.gain) owner.gain = v;
					return raw.exponentialRampToValueAtTime.call(this, v);
				},
			} as typeof raw;
		}
		return node;
	}
	createBiquadFilter() {
		return { type: 'lowpass', frequency: param(350), Q: param(1), connect() {} };
	}
	createDynamicsCompressor() {
		return {
			threshold: param(),
			knee: param(),
			ratio: param(),
			attack: param(),
			release: param(),
			connect() {},
		};
	}
	createConvolver() {
		return { buffer: null, connect() {} };
	}
	createBuffer(channels: number, frames: number) {
		const data = Array.from({ length: channels }, () => new Float32Array(frames));
		return { getChannelData: (i: number) => data[i]! };
	}
}

const storage = new Map<string, string>();
const listeners: Record<string, (() => void)[]> = {};

(globalThis as Record<string, unknown>).window = { AudioContext: FakeAudioContext };
(globalThis as Record<string, unknown>).localStorage = {
	getItem: (k: string) => storage.get(k) ?? null,
	setItem: (k: string, v: string) => void storage.set(k, v),
};
(globalThis as Record<string, unknown>).document = {
	visibilityState: 'visible',
	addEventListener: (type: string, fn: () => void) => {
		(listeners[type] ??= []).push(fn);
	},
};

const graph = await import('./audioGraph.ts');
const { sound } = await import('./sound.ts');
const { music } = await import('./music.ts');

/** Open the audio context the way the real game does: with a cue. */
function context() {
	// music deliberately never calls ensureContext, so a test that wants the
	// scheduler running has to play something first.
	sound.playPress('soft');
}

/** Run the scheduler forward by `seconds` of context time. */
async function advance(seconds: number) {
	const target = clock + seconds;
	// The scheduler wakes on a 25ms timer, so step the clock in comparable slices
	// and let the pending timers fire between them.
	while (clock < target) {
		clock = Math.min(target, clock + 0.025);
		await new Promise((r) => setTimeout(r, 1));
	}
}

beforeEach(() => {
	sound.setMuted(false);
	sound.setBusVolume('music', 75);
	sound.setBusVolume('sfx', 75);
	music.setTension(null);
	created.oscillators = 0;
	created.bufferSources = 0;
	voiceLog.length = 0;
	pendingVoice = null;
});

afterEach(() => {
	music.stop();
});

/* ---- the tests ----------------------------------------------------------- */

describe('the scheduler', () => {
	test('does not run until something has opened a context', async () => {
		// music never calls ensureContext: nothing has been clicked while the
		// loader is on screen, and a scheduler that forced a context into
		// existence would put a suspended one - and on some browsers an "audio
		// playing" tab badge - in front of a player who has not touched the page.
		assert.equal(graph.contextTime(), null, 'a context existed before any cue');
	});

	test('schedules once a cue has opened one', async () => {
		context();
		music.setScene('table');
		await advance(4.5);

		assert.ok(created.oscillators > 0, 'the room scheduled nothing');
	});

	test('stops when its bus is muted, rather than ticking behind a zeroed gain', async () => {
		context();
		music.setScene('table');
		await advance(1.0);

		sound.setBusMuted('music', true);
		created.oscillators = 0;
		created.bufferSources = 0;
		await advance(3.0);

		assert.equal(created.oscillators, 0, 'a muted room still built voices');
		assert.equal(created.bufferSources, 0, 'a muted room still built noise');
		// The load-bearing half. Without it this test passes just as happily with
		// a timer waking forty times a second behind a zeroed gain, because a
		// scheduler that returns early builds no voices either way.
		assert.equal(music.isScheduling(), false, 'the timer kept running while muted');
	});

	test('a slider dragged to zero stops it as completely as the mute does', async () => {
		context();
		music.setScene('table');
		await advance(1.0);

		sound.setBusVolume('music', 0);
		created.oscillators = 0;
		await advance(3.0);

		assert.equal(created.oscillators, 0, 'a zeroed room still built voices');
		assert.equal(music.isScheduling(), false, 'the timer kept running at zero');
	});

	test('picks back up when the bus comes back', async () => {
		context();
		music.setScene('table');
		sound.setBusMuted('music', true);
		await advance(1.0);

		sound.setBusMuted('music', false);
		created.oscillators = 0;
		// Long enough to contain a pad entry whatever step the scheduler resumes
		// on - it re-voices every 7 steps, i.e. 3.5s, and stepIndex deliberately
		// survives a stop so the layers do not all restart together. A shorter
		// window here passed only while there was an arpeggio firing every step.
		await advance(4.5);

		assert.ok(music.isScheduling(), 'un-muting did not restart the timer');
		assert.ok(created.oscillators > 0, 'un-muting did not restart the room');
	});

	test("scene 'none' stops it", async () => {
		context();
		music.setScene('table');
		await advance(1.0);

		music.setScene('none');
		created.oscillators = 0;
		await advance(3.0);

		assert.equal(created.oscillators, 0, "scene 'none' kept building voices");
		assert.equal(music.isScheduling(), false, "scene 'none' kept the timer running");
	});

	test('the cue bus is untouched by the music bus being off', async () => {
		context();
		music.setScene('table');
		sound.setBusMuted('music', true);
		created.oscillators = 0;

		sound.playCardFlip();
		assert.ok(created.oscillators > 0, 'muting music silenced the cards');
	});
});

describe('the layers do not line up', () => {
	test('the three periods are pairwise co-prime', async () => {
		// Read off the source rather than re-declared here, so a refactor to
		// 16/8/4 - which is what this sounds like when it goes wrong - fails
		// instead of passing against a copy of the old numbers.
		const { readFileSync } = await import('node:fs');
		const { resolve } = await import('node:path');
		const src = readFileSync(resolve(import.meta.dirname, './music.ts'), 'utf8');

		const read = (name: string) => {
			const m = src.match(new RegExp(`const ${name} = (\\d+);`));
			assert.ok(m, `could not find ${name}`);
			return Number(m![1]);
		};

		const periods = [
			read('DRONE_STEPS'),
			read('PAD_STEPS'),
			read('TEXTURE_STEPS'),
			read('CHIP_STEPS'),
		];
		const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

		for (let i = 0; i < periods.length; i++) {
			for (let j = i + 1; j < periods.length; j++) {
				assert.equal(
					gcd(periods[i]!, periods[j]!),
					1,
					`${periods[i]} and ${periods[j]} share a factor - the layers will restart together`,
				);
			}
		}
	});

	test('the loop is far longer than the 30 seconds a listener can hold', async () => {
		const { readFileSync } = await import('node:fs');
		const { resolve } = await import('node:path');
		const src = readFileSync(resolve(import.meta.dirname, './music.ts'), 'utf8');

		const num = (name: string) => Number(src.match(new RegExp(`const ${name} = ([\\d.]+);`))![1]);
		const product =
			num('DRONE_STEPS') * num('PAD_STEPS') * num('TEXTURE_STEPS') * num('CHIP_STEPS');

		assert.ok(product * num('STEP') > 30, 'the layers realign inside 30s');
	});
});

describe('tension', () => {
	/** Stage 0-3 hold C3, D3, E3, F#3 - see TENSION_ROOTS. */
	const ROOTS = [130.81, 146.83, 164.81, 185.0];

	/** Voices within 2% of a pitch. tone()'s jitter is +/-12 cents, ~0.7%. */
	const at = (hz: number) => voiceLog.filter((v) => Math.abs(v.freq / hz - 1) < 0.02);

	/**
	 * Measure on the TABLE, and rely on the bed's pitches being its own.
	 *
	 * An earlier version measured in the lobby because that scene had no pad and
	 * stage 0's C3 collided with the pad's lowest note - pad voices at a higher
	 * gain made the ladder read as going DOWN from card 1 to card 2. The pad has
	 * since moved up to E3-E4 and the lobby has gained one, so neither half of
	 * that still holds: none of C3, D3, E3, F#3 appears in the pad set now, which
	 * is a better guarantee than picking a scene that happened to be quiet. The
	 * last test in this block checks that separation directly.
	 */
	const isolate = () => {
		context();
		music.setScene('table');
	};

	/** Long enough to guarantee at least two firings: the bed plays every 1.0s. */
	const runWith = async (stage: number | null, seconds = 3.1) => {
		music.setTension(stage);
		voiceLog.length = 0;
		await advance(seconds);
	};

	test('each stage sounds its own note, and the fourth is the one outside the key', async () => {
		isolate();

		for (let stage = 0; stage < ROOTS.length; stage++) {
			await runWith(stage);
			assert.ok(
				at(ROOTS[stage]!).length > 0,
				`stage ${stage} scheduled nothing at ${ROOTS[stage]}Hz`,
			);
		}

		// Nothing else in the room plays these pitches, which is what makes the
		// assertions above mean anything at all. Checked for every stage rather
		// than just the last, because the pad moving would break it silently.
		await runWith(null);
		for (const root of ROOTS) {
			assert.equal(at(root).length, 0, `something other than the bed plays ${root}Hz`);
		}
	});

	test('gets louder with each card rather than merely appearing', async () => {
		isolate();

		const loudness: number[] = [];
		for (let stage = 0; stage < ROOTS.length; stage++) {
			await runWith(stage);
			loudness.push(Math.max(...at(ROOTS[stage]!).map((v) => v.gain)));
		}

		for (let i = 1; i < loudness.length; i++) {
			assert.ok(
				loudness[i]! > loudness[i - 1]!,
				`card ${i + 1} (${loudness[i]}) was no louder than card ${i} (${loudness[i - 1]})`,
			);
		}
	});

	test('four stages inside one frame schedule one bed, not four', async () => {
		// The slam-stop case. setTension only writes a variable and the scheduler
		// reads it, so a round that resolves in a single frame collapses to the
		// last stage instead of stacking four beds on the same millisecond.
		isolate();
		voiceLog.length = 0;

		music.setTension(0);
		music.setTension(1);
		music.setTension(2);
		music.setTension(3);

		assert.equal(voiceLog.length, 0, 'setTension scheduled a voice by itself');

		await advance(1.6);
		// Only the last stage should be heard; the three it passed through leave
		// nothing behind.
		assert.ok(at(185.0).length > 0, 'the final stage never sounded');
		for (const dead of [130.81, 146.83, 164.81]) {
			assert.equal(at(dead).length, 0, `a bed was stacked at ${dead}Hz`);
		}
	});

	test('leaving the board ends it, whatever the reveal loop did', async () => {
		// A replay reset, an error modal or a mode change mid-reveal never reaches
		// the loop's own setTension(null), so the scene change has to be what
		// clears it.
		context();
		music.setScene('table');

		await runWith(3);
		assert.ok(at(185.0).length > 0, 'the bed never rose, so this test proves nothing');

		// Leave the board and come back WITHOUT setting tension again.
		music.setScene('lobby');
		music.setScene('table');
		voiceLog.length = 0;
		await advance(3.1);

		assert.equal(at(185.0).length, 0, 'the bed survived leaving the board');
	});
});
