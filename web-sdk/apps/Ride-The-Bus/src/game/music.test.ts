/**
 * The music bed, checked with a fake AudioContext and a fake network.
 *
 * The bed is one produced file, fetched at runtime. Five things about that are
 * worth pinning precisely because none of them is visible from the outside:
 *
 * 1. NOTHING IS DOWNLOADED that the player cannot hear. Muted, or before any
 *    cue has opened a context, the file must not be fetched at all. A test that
 *    only counts scheduled voices cannot see this - a muted game is silent
 *    whether or not it spent 400 kB first.
 *
 * 2. A MISSING OR BROKEN FILE DEGRADES QUIETLY. No throw, no console error, and
 *    no retry storm. Stake fails builds on console errors, and the game having
 *    no music is a far cheaper outcome than the game not starting.
 *
 * 3. THE CUES ARE INDEPENDENT. Turning music off must never touch the cue book,
 *    which is still entirely synthesised.
 *
 * 4. THE SEAM OVERLAPS. A produced track ends on a fade to silence, so the loop
 *    is not one source wrapping - it is passes laid over each other. The only
 *    way to see that from out here is a fake that knows what time it is, which
 *    is why the buffer source below tracks when it starts and when it stops.
 *
 * 5. THE SCENE LADDER IS A DIP. The bed is loudest with nothing happening and
 *    quietest under the fanfare. Every level lives on a gain node deep inside
 *    audioGraph, so music.level() is what makes the ranking assertable.
 *
 * What none of it can say is whether the track sounds good. That needs ears,
 * and `npm run audio` for everything in between.
 */
import assert from 'node:assert/strict';
import { test, describe, beforeEach, afterEach } from 'node:test';

/* ---- the fakes ----------------------------------------------------------- */

const created = { oscillators: 0, bufferSources: 0, loops: 0, loopsStopped: 0 };

/**
 * The network, faked at the one call music.ts makes.
 *
 * The request log is the point: "a muted player downloads nothing" is a
 * bandwidth claim, and only a count of requests can test it.
 */
const fetched: string[] = [];
let fetchSucceeds = true;
let decodeSucceeds = true;

(globalThis as Record<string, unknown>).fetch = (url: string) => {
	fetched.push(url);
	if (!fetchSucceeds) return Promise.resolve({ ok: false, status: 404 });
	return Promise.resolve({
		ok: true,
		status: 200,
		arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
	});
};

/**
 * A fresh URL per bed, because setBed short-circuits on an unchanged one and a
 * new URL is what resets the load state. Without this, whichever test loaded a
 * track first would leave it `ready` for every test after it.
 */
let bedSerial = 0;

/**
 * A bed spec over the fake 30-second buffer.
 *
 * The default region is 20s with a 6s overlap, so ONE pass falls inside loop()'s
 * 8s lookahead and the counts below stay about the track rather than about the
 * scheduler. The seam tests shorten it deliberately.
 */
const bedSpec = (over: Partial<{ crossfade: number; loopStart: number; loopEnd: number; trim: number }> = {}) => ({
	url: `/music/bed-${++bedSerial}.mp3`,
	crossfade: 6,
	loopStart: 0,
	loopEnd: 20,
	trim: 1,
	...over,
});

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
		// The seams are equal-power curves rather than ramps - see loop(). Present
		// here because every browser has it, so the ramp fallback beside it is for
		// a param that is NOT a browser's, and testing the path that does not ship
		// would be testing the wrong one.
		setValueCurveAtTime(curve: Float32Array) {
			this.value = curve[curve.length - 1] ?? this.value;
			return this;
		},
		// loop()'s cross-fade cancels whatever ramp is in flight before starting a
		// new one. Absent here, re-levelling on a scene change threw.
		cancelScheduledValues() {
			return this;
		},
	};
}

/**
 * The context clock, driven by hand, so the async load is stepped rather than
 * raced. A real clock would make this unrepeatable.
 */
let clock = 0;

/** Every looping source ever started, so the ones sounding NOW can be counted. */
type FakeLoop = { startedAt: number; stopAt: number };
const loopNodes: FakeLoop[] = [];

/** How many passes are audible at this instant. Two of them IS the seam. */
const soundingLoops = () => loopNodes.filter((n) => clock >= n.startedAt && clock < n.stopAt).length;

/**
 * Whether this fake browser lets a context start without being touched.
 *
 * FALSE BY DEFAULT, which is the strict case and the one most players are in.
 * A fake that is always born running models Stake's allow="autoplay" iframe and
 * nothing else - and it silently defeats primeAudio's throwaway probe, which
 * reads exactly this state to decide whether to wait for a gesture.
 */
let autoplayAllowed = false;

class FakeAudioContext {
	sampleRate = 48000;
	state: 'suspended' | 'running' = autoplayAllowed ? 'running' : 'suspended';

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
	// primeAudio builds a throwaway context to ask whether autoplay is permitted,
	// and closes it either way. Without this the probe threw.
	close() {
		this.state = 'suspended';
		return Promise.resolve();
	}

	createOscillator() {
		created.oscillators++;
		const node = {
			type: 'sine',
			frequency: param(),
			connect() {},
			start() {},
			stop() {},
		};
		return node;
	}

	createBufferSource() {
		created.bufferSources++;
		// `loop` is what tells the produced track apart from the cue book's noise
		// bursts, which never set it. Counting LOOPING sources is the only way to
		// assert "the track is playing" from out here.
		const node = {
			buffer: null as unknown,
			loop: false,
			loopStart: 0,
			loopEnd: 0,
			onended: null as null | (() => void),
			startedAt: 0,
			stopAt: Infinity,
			connect() {},
			// The THIRD argument is what makes the seam visible from out here: a
			// cross-faded pass is given its own end when it starts, where a plain
			// wrapping source is given none. Without it there is no way to ask which
			// passes are sounding at an instant, and the overlap is invisible.
			start(when = clock, _offset = 0, duration?: number) {
				node.startedAt = when;
				if (duration !== undefined) node.stopAt = when + duration;
				if (node.loop) {
					created.loops++;
					loopNodes.push(node);
				}
			},
			// Only ever a release. loop() ends a cross-faded pass with start()'s
			// duration rather than a scheduled stop, so a call here always means the
			// scene let go of the track.
			stop(when = clock) {
				node.stopAt = Math.min(node.stopAt, when);
				if (node.loop) created.loopsStopped++;
			},
		};
		return node;
	}

	decodeAudioData(bytes: ArrayBuffer) {
		if (decodeSucceeds) return Promise.resolve({ duration: 30, bytes });
		return Promise.reject(new Error('undecodable'));
	}

	createGain() {
		return { gain: param(1), connect() {} };
	}
	createBiquadFilter() {
		// gain is a real AudioParam on a BiquadFilterNode. Nothing on these buses
		// uses it since the music bus's shelf was removed, but a filter without it
		// is not a filter, and the cue book is free to add a peaking one.
		return { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0), connect() {} };
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
	removeEventListener: (type: string, fn: () => void) => {
		listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
	},
};

/** Fire whatever primeAudio registered for one gesture, as a real tap would. */
function tap(type: 'pointerdown' | 'keydown' | 'touchend' = 'pointerdown') {
	for (const fn of [...(listeners[type] ?? [])]) fn();
}

const graph = await import('./audioGraph.ts');
const { primeAudio } = graph;
const { sound } = await import('./sound.ts');
const { music } = await import('./music.ts');

/** Open the audio context the way the real game does: with a cue. */
function context() {
	// music deliberately never calls ensureContext, so a test that wants a
	// context has to play something first.
	sound.playPress('soft');
}

/** Step the clock forward, flushing the load promises between slices. */
async function advance(seconds: number) {
	const target = clock + seconds;
	while (clock < target) {
		clock = Math.min(target, clock + 0.025);
		await new Promise((r) => setTimeout(r, 1));
	}
}

beforeEach(() => {
	sound.setMuted(false);
	sound.setBusVolume('music', 75);
	sound.setBusVolume('sfx', 75);
	created.oscillators = 0;
	created.bufferSources = 0;
	created.loops = 0;
	created.loopsStopped = 0;
	loopNodes.length = 0;
	fetched.length = 0;
	fetchSucceeds = true;
	decodeSucceeds = true;
	autoplayAllowed = false;
});

afterEach(() => {
	music.stop();
});

/* ---- the tests ----------------------------------------------------------- */

/**
 * THIS BLOCK MUST RUN FIRST, AND IT IS ONE TEST ON PURPOSE.
 *
 * Two pieces of state here are one-shot for the whole file: the module keeps a
 * single AudioContext, and the bed is module-level with no way to unset it. So
 * "no context yet" and "no track yet" each exist exactly once - before the first
 * cue of the first test - and split across separate tests they would depend on
 * declaration order and on afterEach not having reset the scene. Written as one
 * sequence, the order is the point rather than an accident.
 */
describe('before anything has opened a context', () => {
	test('nothing is downloaded until there is both a track and a context', async () => {
		assert.equal(graph.contextTime(), null, 'a context existed before any cue');

		// 1. No track and no context. The state a build without the asset ships in.
		music.setScene('idle');
		await advance(1);
		assert.deepEqual(fetched, [], 'something was fetched with no track set');
		assert.equal(music.isBedPlaying(), false, 'a track played with none set');

		// 2. A track, but still nothing clicked. This is the real order on the start
		// screen: the scene is set while the loader is up, long before a player has
		// touched the page. Fetching here would spend their data on a game they have
		// not interacted with, and would arrive with no context to decode it on.
		music.setBed(bedSpec());
		music.setScene('lobby');
		await advance(1);
		assert.deepEqual(fetched, [], 'the track was fetched with no context to play it on');
		assert.equal(music.isBedPlaying(), false, 'a track played with no context');

		// 3. Priming WAITS. There is no autoplay permission in this environment, so
		// primeAudio must build nothing at all - a context constructed here would be
		// suspended, would log an autoplay warning, and would put a tab badge in
		// front of a player who has not touched the page. All it may do is listen.
		const stopPriming = graph.primeAudio();
		await advance(1);
		assert.equal(graph.contextTime(), null, 'priming forced a context open on its own');
		assert.deepEqual(fetched, [], 'priming downloaded the track with nothing to play it on');
		assert.ok(listeners.pointerdown?.length, 'priming registered no gesture listener to wake on');

		// 4. A TAP ANYWHERE opens it, and that is what makes the loading and start
		// screens audible: they carry nothing to press, so before this the bed could
		// only arrive with the tap that LEFT them. Chrome hands you a context already
		// 'running' when it is built inside a gesture handler, so nothing announces
		// unless ensureContext says so - and if that announcement is lost the track
		// never loads, with no error anywhere.
		tap();
		await advance(2);
		assert.ok(graph.contextTime() !== null, 'a tap did not open the context');
		assert.equal(fetched.length, 1, 'a context appeared and the track never loaded');
		assert.ok(music.isBedPlaying(), 'the track loaded but never started');

		// 5. One tap, once. Three listeners share one unlock, and a second gesture
		// must not walk the mixer again.
		stopPriming();
		tap();
		await advance(1);
		assert.equal(fetched.length, 1, 'a later gesture re-downloaded the track');
	});
});

describe('the produced bed', () => {
	/** Open a context, point at a fresh track, and land on a scene. */
	const load = async (scene: 'lobby' | 'idle' = 'idle', over = {}) => {
		context();
		music.setBed(bedSpec(over));
		music.setScene(scene);
		// The fetch and the decode are both promises; advance flushes them.
		await advance(2);
	};

	afterEach(() => {
		// Point the module at a track nothing will load, so a `ready` one cannot
		// leak into a later test.
		fetchSucceeds = false;
		music.setBed(bedSpec());
	});

	test('a silent music bus downloads nothing at all', async () => {
		context();
		sound.setBusMuted('music', true);
		music.setBed(bedSpec());
		music.setScene('idle');
		await advance(3);

		assert.deepEqual(fetched, [], 'a muted player was made to download the track');
		assert.equal(music.isBedPlaying(), false, 'a muted player got a track anyway');
	});

	test('a 404 leaves the game without music, and is not retried', async () => {
		fetchSucceeds = false;
		await load();

		assert.equal(fetched.length, 1, 'the track was not requested exactly once');
		assert.equal(music.isBedPlaying(), false, 'a failed load reported a playing track');

		// `failed` is terminal, so a player toggling the mixer cannot turn one
		// missing file into an unbounded number of requests.
		sound.setBusMuted('music', true);
		sound.setBusMuted('music', false);
		music.setScene('lobby');
		music.setScene('idle');
		await advance(3);

		assert.equal(fetched.length, 1, 'a failed track was retried');
	});

	test('an undecodable file falls back exactly as a missing one does', async () => {
		// A 200 carrying something that is not audio - a proxy's HTML error page is
		// the usual way - must not be louder than a 404.
		decodeSucceeds = false;
		await load();

		assert.equal(fetched.length, 1, 'the file was never requested');
		assert.equal(music.isBedPlaying(), false, 'an undecodable file reported as playing');
	});

	test('a loaded track starts exactly one looping source', async () => {
		await load();

		assert.equal(fetched.length, 1, 'the track was not requested');
		assert.ok(music.isBedPlaying(), 'the track loaded but never started');
		assert.equal(created.loops, 1, 'the track did not start exactly one looping pass');
	});

	test("scene 'none' releases the loop rather than leaving it running", async () => {
		await load();
		assert.ok(music.isBedPlaying(), 'the track never started');

		music.setScene('none');

		assert.equal(music.isBedPlaying(), false, "scene 'none' left the track playing");
		assert.equal(created.loopsStopped, 1, 'the looping pass was never released');
	});

	test('teardown releases it too', async () => {
		await load();
		assert.ok(music.isBedPlaying(), 'the track never started');

		music.stop();

		assert.equal(music.isBedPlaying(), false, 'teardown left the track playing');
		assert.equal(created.loopsStopped, 1, 'teardown never released the looping pass');
	});

	test('a scene change cross-fades rather than restarting the track', async () => {
		// Every scene is the same file at a different level, so the only correct
		// implementation re-levels the source it already has.
		await load('lobby');
		assert.equal(created.loops, 1, 'the lobby did not start the track');

		music.setScene('idle');
		await advance(2);

		assert.equal(created.loops, 1, 'moving to the board restarted the track');
		assert.equal(created.loopsStopped, 0, 'moving to the board cut the track off');
		assert.ok(music.isBedPlaying(), 'the track stopped on the way to the board');
	});

	test('muting releases the track; un-muting restores it without re-downloading', async () => {
		await load();
		assert.equal(created.loops, 1);

		sound.setBusMuted('music', true);
		assert.equal(music.isBedPlaying(), false, 'a muted bus kept the track running');

		sound.setBusMuted('music', false);
		await advance(1);

		assert.ok(music.isBedPlaying(), 'un-muting did not bring the track back');
		assert.equal(created.loops, 2, 'un-muting did not restart the track');
		// The decoded buffer is cached, so the second start costs no network.
		assert.equal(fetched.length, 1, 'un-muting re-downloaded the track');
	});

	test('a slider dragged to zero releases it as completely as the mute does', async () => {
		await load();
		assert.ok(music.isBedPlaying(), 'the track never started');

		sound.setBusVolume('music', 0);

		assert.equal(music.isBedPlaying(), false, 'a zeroed slider kept the track running');
	});

	test('re-declaring the same track keeps the running source and the download', async () => {
		await load();
		const url = fetched[0]!;
		assert.equal(created.loops, 1);

		// Game.svelte hands the bed over on every re-run of its setup. That must not
		// be a restart, or every hot reload and every remount would cut the room off
		// and fetch the file again.
		music.setBed({ url, crossfade: 6, loopStart: 0, loopEnd: 20, trim: 1 });
		await advance(1);

		assert.equal(created.loops, 1, 're-declaring the same track restarted it');
		assert.equal(fetched.length, 1, 're-declaring the same track re-downloaded it');
	});
});

/**
 * The seam.
 *
 * A produced track fades to silence at its end - all four candidates measure 12
 * to 17 seconds of decaying outro - so `src.loop = true` would play that decay
 * into a cold entry every few minutes. The loop is passes laid over each other
 * instead, and the only externally visible consequence is that TWO sources
 * sound at once for the length of the overlap.
 *
 * The regions here are short on purpose: loop() schedules 8 seconds ahead, so a
 * 6-second region puts the second pass inside the first scheduling pass and the
 * test needs no timer at all.
 */
describe('the loop seam', () => {
	const load = async (over: Record<string, number>) => {
		context();
		music.setBed(bedSpec(over));
		music.setScene('idle');
		await advance(2);
	};

	afterEach(() => {
		fetchSucceeds = false;
		music.setBed(bedSpec());
	});

	test('the tail of one pass overlaps the head of the next', async () => {
		// span 6, overlap 1 -> a new pass every 5s, each running 6s.
		await load({ loopStart: 0, loopEnd: 6, crossfade: 1 });

		assert.ok(created.loops >= 2, 'the loop scheduled only one pass, so it has a hard wrap');

		// RELATIVE to when the first pass actually started. The clock is module
		// scope and never rewinds between tests, so an absolute 2 here would be in
		// the past by the time this block runs and nothing would be sounding.
		const began = loopNodes[0]!.startedAt;

		// 2s in, one pass. At 5.5s the first has not ended (it runs to 6) and the
		// second has begun (it started at 5) - that instant IS the cross-fade.
		clock = began + 2;
		assert.equal(soundingLoops(), 1, 'two passes were sounding away from the seam');
		clock = began + 5.5;
		assert.equal(soundingLoops(), 2, 'the seam played one pass alone, which is the wrap this replaces');
	});

	test('a zero cross-fade falls back to a single wrapping source', async () => {
		// The escape hatch, for a file that really was authored to loop. It must
		// schedule nothing extra and leave no timer behind.
		await load({ loopStart: 0, loopEnd: 6, crossfade: 0 });

		assert.equal(created.loops, 1, 'a zero cross-fade still scheduled overlapping passes');
	});

	test('a region too short for its own overlap degrades instead of throwing', async () => {
		// The rise of a pass has to finish before its fall begins, or the two
		// curves collide on one gain param and the browser throws. Rather than
		// trusting the manifest, loop() drops to the hard wrap.
		await load({ loopStart: 0, loopEnd: 4, crossfade: 3 });

		assert.ok(music.isBedPlaying(), 'an over-long cross-fade silenced the track');
		assert.equal(created.loops, 1, 'an impossible overlap was scheduled anyway');
	});

	test('a loop region longer than the file is clamped to it', async () => {
		// The manifest is written against files on disk. A shorter one arriving -
		// a re-encode, a truncated download - must not schedule silence.
		await load({ loopStart: 0, loopEnd: 900, crossfade: 6 });

		assert.ok(music.isBedPlaying(), 'a too-long region left the track silent');
		assert.equal(created.loops, 1, 'a too-long region scheduled more than the file holds');
	});
});

/**
 * The scene ladder.
 *
 * One file cannot change what it plays, only how loud it plays, so every claim
 * about the bed getting out of the way is a claim about these numbers. The
 * ranking is what matters and is what is pinned; the absolute values are tuned
 * by ear with `npm run audio` and are free to move underneath it.
 */
describe('the scene ladder', () => {
	test('the bed is loudest with nothing happening and quietest under the fanfare', () => {
		const level = (s: 'loading' | 'lobby' | 'idle' | 'round' | 'celebration') => {
			music.setScene(s);
			return music.level();
		};

		const loading = level('loading');
		const lobby = level('lobby');
		const idle = level('idle');
		const round = level('round');
		const celebration = level('celebration');

		// The board with no round on it is the only moment the music has the room.
		assert.ok(idle > lobby, 'the board was not louder than the start screen');
		assert.ok(lobby > loading, 'the start screen was not louder than the loader');

		// THE DIP. A round is the busiest the cue book ever gets - four flips, three
		// stage wins, the bust - and the fanfare is louder still. Both must pull the
		// bed DOWN; a bed that rose here would fight the thing it is behind.
		assert.ok(round < idle, 'the bed did not duck for the round');
		assert.ok(celebration < round, 'the bed did not duck further for the celebration');

		// The takeover is the loudest moment in the game and the bed has to be the
		// quietest it ever is, below even the loading screen.
		assert.ok(celebration < loading, 'the bed under the fanfare was not the quietest scene');
	});

	test("scene 'none' asks for no level at all", () => {
		music.setScene('none');
		assert.equal(music.level(), 0, "scene 'none' still asked for a level");
	});

	test("a track's level match scales the whole ladder, not one scene of it", () => {
		// Switching candidates must not change how loud the game is. trim is the
		// only thing that may move all five together.
		music.setBed(bedSpec({ trim: 1 }));
		music.setScene('idle');
		const plain = music.level();
		music.setScene('round');
		const plainRound = music.level();

		music.setBed(bedSpec({ trim: 0.5 }));
		music.setScene('idle');
		assert.ok(Math.abs(music.level() - plain * 0.5) < 1e-9, 'trim did not scale the idle level');
		music.setScene('round');
		assert.ok(Math.abs(music.level() - plainRound * 0.5) < 1e-9, 'trim did not scale the round level');
	});
});

/**
 * Priming.
 *
 * The two screens before the board carry nothing to press, so before primeAudio
 * they set a music scene that could never be heard: the cue book was the only
 * thing that ever built a context, and it needs a press. Which branch primeAudio
 * takes is observable from out here even after a context exists, because the
 * branches differ in whether they leave a gesture listener behind.
 */
describe('opening the graph for the screens with nothing to press', () => {
	test('where autoplay is permitted it opens the graph and waits for nothing', () => {
		// Stake serves the game in an iframe and may set allow="autoplay"; a
		// returning player Chrome trusts is the other way in. Then the loading
		// screen has music with the player having touched nothing at all.
		autoplayAllowed = true;
		listeners.pointerdown = [];

		const stop = primeAudio();

		assert.equal(
			listeners.pointerdown.length,
			0,
			'autoplay was permitted and priming still sat waiting for a gesture',
		);
		stop();
	});

	test('where it is not, it waits rather than forcing a suspended context', () => {
		// The failure this avoids is not silence - it is a context that exists but
		// cannot play, which on some browsers puts an "audio playing" badge on the
		// tab of a player who has not touched the page.
		autoplayAllowed = false;
		listeners.pointerdown = [];
		listeners.keydown = [];
		listeners.touchend = [];

		const stop = primeAudio();

		assert.ok(listeners.pointerdown.length, 'no pointer gesture would ever start the music');
		// Keys and touches count too: a keyboard player and an iOS player each
		// reach the game by a route a pointerdown listener alone would miss.
		assert.ok(listeners.keydown.length, 'a keyboard player would never hear the music');
		assert.ok(listeners.touchend.length, 'an iOS player would never hear the music');

		stop();
		assert.equal(listeners.pointerdown.length, 0, 'teardown left its listener behind');
		assert.equal(listeners.keydown.length, 0, 'teardown left its key listener behind');
		assert.equal(listeners.touchend.length, 0, 'teardown left its touch listener behind');
	});
});

describe('the cue book is independent of the music', () => {
	test('turning music off leaves the cards audible', async () => {
		// The cues are still entirely synthesised and belong to the other bus. A
		// player who wants silence behind the game usually still wants to hear it.
		context();
		sound.setBusMuted('music', true);
		created.oscillators = 0;

		sound.playCardFlip();
		assert.ok(created.oscillators > 0, 'muting music silenced the cards');
	});

	test('the win fanfare survives the music being off', async () => {
		context();
		sound.setBusMuted('music', true);
		created.oscillators = 0;

		sound.playRoundWin();
		assert.ok(created.oscillators > 0, 'muting music silenced the win');
	});
});
