/**
 * The cue book, checked by building a fake AudioContext and counting what gets
 * scheduled onto it.
 *
 * WHY THIS EXISTS AT ALL
 *
 * sound.ts and audioGraph.ts were ~920 lines with no test of any kind, in a
 * repo that pins the win takeover's fan spread and the yen chip label. Audio
 * hides its regressions better than anything else here: a cue that stops firing
 * is silence, and silence is what a muted game and a broken game have in
 * common. Nobody notices until a reviewer plays with the sound on.
 *
 * WHY A FAKE CONTEXT RATHER THAN A BROWSER
 *
 * Both modules are already importable under Node - readStoredMute() guards on
 * `typeof localStorage`, ensureContext() on `typeof window` - so installing a
 * fake AudioContext on globalThis.window BEFORE the dynamic import below gives
 * the real code path with a recorder on the end of it. No browser, no headless
 * driver, runs in the same `node --test` as everything else.
 *
 * What this can and cannot say: it pins the SHAPE of what is scheduled - how
 * many voices, at what pitches, in what order, and whether anything is
 * scheduled at all. It says nothing about whether the result sounds good. That
 * judgement needs ears and the replay server, exactly as a visual change needs
 * a screenshot rather than a reading of the CSS.
 */
import assert from 'node:assert/strict';
import { test, describe, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PRESS_CUES_SOURCE, REVEAL_LOOP_SOURCE } from '../../sources.testlib.ts';

/* ---- the fake ------------------------------------------------------------ */

type OscRecord = { type: string; frequency: number };

/** Every gain node ever built, so the standing mix can be asserted. */
const gainNodes: { gain: { value: number } }[] = [];

const created = {
	oscillators: [] as OscRecord[],
	bufferSources: 0,
	gains: 0,
	filters: 0,
	compressors: 0,
	convolvers: 0,
	buffers: 0,
};

function resetCreated() {
	created.oscillators = [];
	created.bufferSources = 0;
	created.gains = 0;
	created.filters = 0;
	created.compressors = 0;
	created.convolvers = 0;
	created.buffers = 0;
}

/**
 * An AudioParam that remembers the value it STARTED at as well as its latest.
 *
 * The distinction is the whole test: tone() writes setValueAtTime(from) and
 * then exponentialRampToValueAtTime(to), so a param that kept only the last
 * write reported every falling cue at its destination pitch. The four guess
 * columns then all read as the same note and the climb looked broken when it
 * was not.
 */
function param(initial = 0) {
	return {
		value: initial,
		start: initial,
		started: false,
		setValueAtTime(v: number) {
			this.value = v;
			if (!this.started) {
				this.start = v;
				this.started = true;
			}
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

class FakeAudioContext {
	sampleRate = 48000;
	currentTime = 0;
	state: 'suspended' | 'running' = 'suspended';
	destination = { connect() {} };

	resume() {
		this.state = 'running';
		return Promise.resolve();
	}

	createOscillator() {
		// The frequency is read at start() rather than at creation, because tone()
		// sets it after building the node - and it is the START pitch that is read,
		// not the ramp target. See param() above.
		const record: OscRecord = { type: 'sine', frequency: 0 };
		created.oscillators.push(record);
		const node = {
			type: 'sine',
			frequency: param(),
			connect() {},
			start() {
				record.frequency = node.frequency.start;
				record.type = node.type;
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
		created.gains++;
		const node = { gain: param(1), connect() {} };
		gainNodes.push(node);
		return node;
	}

	createBiquadFilter() {
		created.filters++;
		// gain is a real AudioParam on a BiquadFilterNode - the shelf and
		// peaking types use it, and the music bus's air shelf does. Absent
		// here, building the graph threw "Cannot set properties of undefined".
		return { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0), connect() {} };
	}

	createDynamicsCompressor() {
		created.compressors++;
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
		created.convolvers++;
		return { buffer: null, connect() {} };
	}

	createBuffer(channels: number, frames: number) {
		created.buffers++;
		const data = Array.from({ length: channels }, () => new Float32Array(frames));
		return { getChannelData: (i: number) => data[i]! };
	}
}

const storage = new Map<string, string>();

(globalThis as Record<string, unknown>).window = { AudioContext: FakeAudioContext };
(globalThis as Record<string, unknown>).localStorage = {
	getItem: (k: string) => storage.get(k) ?? null,
	setItem: (k: string, v: string) => void storage.set(k, v),
};

const { sound } = await import('../sound.ts');

/** Fire a cue and report how many oscillator voices it scheduled. */
function voices(fire: () => void): number {
	resetCreated();
	fire();
	return created.oscillators.length;
}

/** Fire a cue and report the pitches it scheduled, lowest first. */
function pitches(fire: () => void): number[] {
	resetCreated();
	fire();
	return created.oscillators.map((o) => o.frequency).sort((a, b) => a - b);
}

/**
 * A FRESH MIXER over whatever storage currently holds.
 *
 * The five tests below are about loadBus() running at module init, so they
 * re-import the module that runs it. That module is audioMixer.ts since
 * audioGraph.ts was split five ways - and it has to be named directly, because
 * a query string only busts the module it names. Pointed at a barrel, or at any
 * module that merely re-exports this one, Node would serve the already-cached
 * mixer, loadBus() would never re-run, and all five of these would go on
 * passing while testing nothing. One of them exists because the obvious version
 * did exactly that and "every player installing the game got silence".
 */
type Mixer = typeof import('../audioMixer.ts');

const reload = (tag: string): Promise<Mixer> => {
	// ../ because the tests live one folder down now. This specifier must keep
	// naming audioMixer.ts DIRECTLY - a query string only busts the module it
	// names, so pointed at a barrel (or at the wrong file) loadBus() would never
	// re-run and all five of these would pass while testing nothing.
	const specifier = `../audioMixer.ts?${tag}`;
	return import(specifier);
};

beforeEach(() => {
	sound.setMuted(false);
	resetCreated();
});

/* ---- the tests ----------------------------------------------------------- */

describe('mute', () => {
	test('schedules nothing at all, rather than scheduling silence', () => {
		sound.setMuted(true);
		resetCreated();

		sound.playPress('choice', 0);
		sound.playCardFlip();
		sound.playStageWin(2);
		sound.playBust();
		sound.playRoundWin();
		sound.playFullWin();
		sound.playRoundLoss();
		sound.playWinFanfare('max');
		sound.playWinCountTick(0.5);
		sound.playWinTierUp('epic');
		sound.playWinCountEnd('max');
		sound.playSliderTick(0.5);
		sound.playForgiven();
		sound.playDeal();
		sound.playBlocked();
		sound.playAutoStart();
		sound.playAutoStop();

		// A CPU claim as much as an audio one: an autoplay run on instant turbo
		// drives hundreds of cues a minute past this check, and a player who
		// muted should be paying nothing for any of them.
		assert.equal(created.oscillators.length, 0, 'muted cues built oscillators');
		assert.equal(created.bufferSources, 0, 'muted cues built buffer sources');
		assert.equal(created.gains, 0, 'muted cues built gain nodes');
	});

	test('round-trips through storage so it survives a reload', () => {
		sound.setMuted(true);
		assert.equal(sound.isMuted(), true);
		assert.equal(storage.get('ride-the-bus:mute:sfx'), 'true');
		assert.equal(storage.get('ride-the-bus:mute:music'), 'true');

		assert.equal(sound.toggleMuted(), false);
		assert.equal(storage.get('ride-the-bus:mute:sfx'), 'false');
	});

	test('is derived from the buses, not tracked as a third flag', () => {
		// The bar icon reads this while the panel behind it sets the buses. A
		// separate global flag is how the two end up disagreeing.
		sound.setBusMuted('music', true);
		sound.setBusMuted('sfx', false);
		assert.equal(sound.isMuted(), false, 'one live bus still counts as unmuted');

		sound.setBusMuted('sfx', true);
		assert.equal(sound.isMuted(), true, 'both buses silent should read as muted');
	});
});

describe('the mixer', () => {
	test('defaults to the platform convention of 75 with nothing stored', async () => {
		// state-shared/src/stateSound.svelte.ts sets 75 for master, music and
		// effects alike; matching it means the panel behaves the way every other
		// Stake game's does.
		//
		// Asserted against a FRESH module over empty storage, because the obvious
		// version of this test - read the default off the already-imported module
		// - passed while the load path was returning zero. beforeEach un-mutes,
		// un-muting lifts a bus off the floor, and the bug was gone by the time
		// the assert ran. Every player installing the game got silence.
		storage.clear();
		const fresh = await reload('defaults');

		assert.equal(fresh.busVolume('sfx'), 75);
		assert.equal(fresh.busVolume('music'), 75);
		assert.equal(fresh.isBusSilent('sfx'), false, 'a fresh install came up silent');
		assert.equal(fresh.isBusSilent('music'), false);
	});

	test('a stored zero is honoured rather than treated as missing', async () => {
		storage.clear();
		storage.set('ride-the-bus:vol:sfx', '0');
		const fresh = await reload('stored-zero');

		assert.equal(fresh.busVolume('sfx'), 0);
		assert.equal(fresh.busVolume('music'), 75, 'the other bus should be untouched');
	});

	test('a corrupt stored level falls back to the default', async () => {
		storage.clear();
		storage.set('ride-the-bus:vol:sfx', 'loud');
		storage.set('ride-the-bus:vol:music', '900');
		const fresh = await reload('corrupt');

		assert.equal(fresh.busVolume('sfx'), 75);
		assert.equal(fresh.busVolume('music'), 75);
	});

	test('dragging a slider to zero also mutes, so the speaker cannot lie', () => {
		sound.setBusVolume('sfx', 0);
		assert.equal(sound.isBusMuted('sfx'), true);
		assert.equal(sound.isBusSilent('sfx'), true);
	});

	test('dragging back up un-mutes', () => {
		sound.setBusVolume('sfx', 0);
		sound.setBusVolume('sfx', 40);
		assert.equal(sound.isBusMuted('sfx'), false);
		assert.equal(sound.busVolume('sfx'), 40);
	});

	test('un-muting a slider parked at zero lifts it back to the last audible level', () => {
		// Otherwise the speaker button visibly does nothing, which reads as
		// broken rather than as muted.
		sound.setBusVolume('sfx', 30);
		sound.setBusVolume('sfx', 0);
		sound.setBusMuted('sfx', false);

		assert.equal(sound.busVolume('sfx'), 30, 'did not return to the chosen level');
		assert.equal(sound.isBusSilent('sfx'), false);
	});

	test('the speaker button leaves the slider where the player put it', () => {
		sound.setBusVolume('sfx', 60);
		sound.setBusMuted('sfx', true);
		assert.equal(sound.busVolume('sfx'), 60, 'muting moved the slider');

		sound.setBusMuted('sfx', false);
		assert.equal(sound.busVolume('sfx'), 60);
	});

	test('volumes are clamped rather than trusted', () => {
		sound.setBusVolume('sfx', 999);
		assert.equal(sound.busVolume('sfx'), 100);
		sound.setBusVolume('sfx', -50);
		assert.equal(sound.busVolume('sfx'), 0);
	});

	test('a silent bus schedules nothing, whether by mute or by level', () => {
		// The cheap-when-off property has to survive the split: a slider at zero
		// must skip the work as completely as the speaker button does.
		sound.setBusVolume('sfx', 0);
		resetCreated();
		sound.playCardFlip();
		sound.playWinFanfare('max');
		assert.equal(created.oscillators.length, 0, 'a zeroed bus still scheduled voices');
	});

	test('the default mix is exactly what the single bus used to produce', () => {
		// Before the split there was one bus at 0.42. Level 75 against a master
		// headroom of 0.56 lands on the same figure, so nobody upgrading hears
		// the game get quieter - and there is real headroom left above 75 rather
		// than the slider topping out at the old volume.
		sound.setBusVolume('sfx', 75);
		sound.playCardFlip();

		const levels = gainNodes.map((g) => g.gain.value);
		const master = levels.find((v) => Math.abs(v - 0.56) < 1e-9);
		const sfx = levels.find((v) => Math.abs(v - 0.75) < 1e-9);

		assert.ok(master !== undefined, `no master gain at 0.56 among ${levels.join(', ')}`);
		assert.ok(sfx !== undefined, `no sfx bus at 0.75 among ${levels.join(', ')}`);
		assert.ok(Math.abs(master! * sfx! - 0.42) < 1e-9, 'the default mix moved off 0.42');
	});

	test('the two buses are independent', () => {
		sound.setBusMuted('music', true);
		sound.setBusMuted('sfx', false);
		assert.ok(voices(() => sound.playCardFlip()) > 0, 'muting music silenced the cues');
	});
});

describe('the graph', () => {
	test('is built once and shared, not rebuilt per cue', () => {
		// Music will schedule onto this same bus. A second context would mean a
		// second limiter that knows nothing about the first, so a fanfare and a
		// music bed would each stay clean alone and clip against each other.
		sound.playCardFlip();
		const compressors = created.compressors;
		const convolvers = created.convolvers;

		sound.playCardFlip();
		sound.playWinFanfare('max');

		assert.equal(created.compressors, compressors, 'the limiter was rebuilt');
		assert.equal(created.convolvers, convolvers, 'the reverb was rebuilt');
		assert.ok(compressors <= 1, 'more than one limiter exists');
	});
});

describe('every cue actually makes a sound', () => {
	// The counterpart to the mute test above: that one proves silence is
	// reachable, this one proves it is not the default. Without it a fake that
	// quietly swallowed everything would pass the whole file.
	const cues: [string, () => void][] = [
		['playCardFlip', () => sound.playCardFlip()],
		['playStageWin', () => sound.playStageWin(0)],
		['playBust', () => sound.playBust()],
		['playRoundWin', () => sound.playRoundWin()],
		['playFullWin', () => sound.playFullWin()],
		['playRoundLoss', () => sound.playRoundLoss()],
		['playSliderTick', () => sound.playSliderTick(0.5)],
		['playWinCountTick', () => sound.playWinCountTick(0.5)],
		['playForgiven', () => sound.playForgiven()],
		['playDeal', () => sound.playDeal()],
		['playBlocked', () => sound.playBlocked()],
		['playAutoStart', () => sound.playAutoStart()],
		['playAutoStop', () => sound.playAutoStop()],
	];

	for (const [name, fire] of cues) {
		test(name, () => {
			assert.ok(voices(fire) > 0, `${name} scheduled no voices`);
		});
	}
});

describe('press kinds', () => {
	const KINDS = ['choice', 'equal', 'chip', 'primary', 'toggle', 'soft'] as const;

	for (const kind of KINDS) {
		test(`${kind} is audible`, () => {
			assert.ok(voices(() => sound.playPress(kind, 0)) > 0, `${kind} scheduled no voices`);
		});
	}

	test('the four guess columns climb, so a half-finished row sounds half-finished', () => {
		// CHOICE_ROOTS walks C4, D4, E4, F#4 - colour is the first decision and
		// suit the last, so pressing across the row is audibly progress.
		const roots = [0, 1, 2, 3].map((stage) => pitches(() => sound.playPress('choice', stage))[0]!);

		for (let i = 1; i < roots.length; i++) {
			assert.ok(roots[i]! > roots[i - 1]!, `column ${i} did not rise above column ${i - 1}`);
		}
	});

	test('an out-of-range column is clamped rather than throwing', () => {
		assert.ok(voices(() => sound.playPress('choice', 99)) > 0);
		assert.ok(voices(() => sound.playPress('choice', -1)) > 0);
	});
});

describe('the win ladder escalates', () => {
	const TIERS = ['big', 'huge', 'mega', 'epic', 'max'] as const;

	test('each tier schedules strictly more voices than the one below', () => {
		// Mirrors the --wc-fan-spread test in winCelebration.test.ts: the visual
		// ladder is pinned monotonic for exactly the same reason, which is that
		// an escalation nobody can measure is an escalation that quietly stops
		// escalating.
		const counts = TIERS.map((tier) => voices(() => sound.playWinFanfare(tier)));

		for (let i = 1; i < counts.length; i++) {
			assert.ok(
				counts[i]! > counts[i - 1]!,
				`${TIERS[i]} (${counts[i]}) did not exceed ${TIERS[i - 1]} (${counts[i - 1]})`,
			);
		}
	});

	test('every tier has a fanfare, a promotion and a landing', () => {
		for (const tier of TIERS) {
			assert.ok(voices(() => sound.playWinFanfare(tier)) > 0, `${tier} fanfare is silent`);
			assert.ok(voices(() => sound.playWinTierUp(tier)) > 0, `${tier} promotion is silent`);
			assert.ok(voices(() => sound.playWinCountEnd(tier)) > 0, `${tier} landing is silent`);
		}
	});
});

describe('nothing is ever played twice', () => {
	test('two card flips do not schedule identical pitches', () => {
		// The whole point of the per-trigger jitter. Four reveals in a round fire
		// this cue four times; identical repeats are the machine-gun effect the
		// jitter exists to prevent.
		const first = pitches(() => sound.playCardFlip());
		const second = pitches(() => sound.playCardFlip());

		assert.notDeepEqual(first, second, 'two flips scheduled identical pitches');
	});

	test('a fresh noise buffer is built per flip, not cached', () => {
		resetCreated();
		sound.playCardFlip();
		const buffers = created.buffers;
		assert.ok(buffers > 0, 'the card flip built no noise buffer');

		sound.playCardFlip();
		assert.ok(created.buffers > buffers, 'the noise buffer was reused between flips');
	});
});

// A query string gets a fresh module instance out of the ESM cache, so a
// load-time read can be re-run against different storage. TypeScript cannot
// resolve a specifier with a query on it, so the specifier is built as a value
// - which it does not try to check - and the shape is borrowed from the real
// module instead.
describe('upgrading from the single global mute', () => {
	test('a player who had muted stays muted', async () => {
		// The pre-split build stored one `ride-the-bus:muted`. Reading it as a
		// fallback only when the new keys are absent is the difference between
		// honouring that choice and silently turning the sound back on for
		// everyone who had switched it off.
		storage.clear();
		storage.set('ride-the-bus:muted', 'true');

		const fresh = await reload('migration');

		assert.equal(fresh.isBusMuted('sfx'), true, 'the legacy mute was dropped');
		assert.equal(fresh.isBusMuted('music'), true);
	});

	test('a per-bus setting wins over the legacy key', async () => {
		storage.clear();
		storage.set('ride-the-bus:muted', 'true');
		storage.set('ride-the-bus:mute:sfx', 'false');
		storage.set('ride-the-bus:vol:sfx', '40');

		const fresh = await reload('migration-superseded');

		assert.equal(fresh.isBusMuted('sfx'), false, 'the legacy key overrode a newer setting');
		assert.equal(fresh.busVolume('sfx'), 40);
		// Untouched by the newer keys, so it still follows the legacy mute.
		assert.equal(fresh.isBusMuted('music'), true);
	});
});

describe('forgiveness does not sound like a bust', () => {
	// This is the Second Chance family's whole identity. cards.css keeps the red
	// cross and the amber return arrow deliberately different - "a red cross says
	// the round ended here, and this one carried on" - and the audio used to call
	// sound.playBust() for both, which threw that away. The test exists because
	// the regression is silent in every sense.
	const pitchesOf = (fire: () => void) => {
		resetCreated();
		fire();
		return created.oscillators.map((o) => o.frequency);
	};

	test('they are not the same cue', () => {
		const bust = pitchesOf(() => sound.playBust());
		const forgiven = pitchesOf(() => sound.playForgiven());

		assert.notDeepEqual(
			bust.map(Math.round),
			forgiven.map(Math.round),
			'forgiveness scheduled the same pitches as a bust',
		);
	});

	test('the bust falls and the forgiven rises', () => {
		// Both walk the same F minor triad on the same root, so they read as a
		// matched pair rather than as two unrelated sounds. The direction is the
		// entire difference, and it is the thing that must not be lost.
		const first = (list: number[]) => list[0]!;
		const last = (list: number[]) => list[list.length - 1]!;

		const bust = pitchesOf(() => sound.playBust());
		const forgiven = pitchesOf(() => sound.playForgiven());

		assert.ok(last(bust) < first(bust), 'the bust did not fall');
		assert.ok(last(forgiven) > first(forgiven), 'forgiveness did not rise');
	});

	test('forgiveness is the quieter of the two', () => {
		// A bust ends the round and carries weight underneath it; being let off
		// should not land harder than being knocked out.
		const count = (fire: () => void) => {
			resetCreated();
			fire();
			return created.oscillators.length;
		};
		assert.ok(count(() => sound.playForgiven()) < count(() => sound.playBust()));
	});
});

/* ---- the grep guard ------------------------------------------------------ */

describe('the reveal loop is wired to the right cues', () => {
	// Grep tests, like the parsed.family pair in modes.test.ts, and for the same
	// stated reason: these fail SILENTLY. A forgiven card sounding like a bust is
	// a wrong sound, not a missing one, and a slammed round that still fires
	// per-card cues just comes out quieter - nobody files either.
	// One file, for the same reason as the pressKindFor slice below: this
	// region is cut out between two anchors, so it must not span files.
	const GAME = REVEAL_LOOP_SOURCE;

	// Comments stripped first. This region explains itself at length - including
	// a line reading "NOT playBust()" directly above the call that replaced it -
	// and a grep that reads prose as code reports the exact bug that prose is
	// there to say was fixed.
	//
	// ANCHORED ON BOTH ENDS, AND CHECKED. This used to end at
	// `const multiplier = engineFinalMultiplier`, which stopped existing when
	// the round state became an object - so indexOf returned -1, slice(start, -1)
	// ran to the end of the file, and "the reveal loop" quietly became every cue
	// in the module. It still passed: the four cues asserted below all live in
	// the real loop, so a wider net changed nothing it looked at. The settlement
	// is its own function now, so the loop ends where it hands over.
	const loopStart = GAME.indexOf('async function playRevealSequence');
	const loopEnd = GAME.indexOf('await settleRound();');
	const loop = GAME.slice(loopStart, loopEnd).replace(/\/\/.*$/gm, '');

	test('the reveal loop was found, so the rest of this means something', () => {
		assert.ok(loopStart >= 0, 'playRevealSequence is gone');
		assert.ok(loopEnd > loopStart, 'the loop no longer ends by handing over to settleRound()');
		assert.ok(loop.length > 500, `only matched ${loop.length} characters of the reveal loop`);
	});

	test('a forgiven card plays playForgiven, and a bust plays playBust', () => {
		const forgiven = loop.slice(loop.indexOf('forgivenIndex = i'), loop.indexOf('busted = true'));
		assert.match(forgiven, /playForgiven\(/, 'the forgiveness branch does not call playForgiven');
		assert.doesNotMatch(forgiven, /playBust\(/, 'the forgiveness branch still calls playBust');

		const bust = loop.slice(loop.indexOf('busted = true'));
		assert.match(bust, /playBust\(/, 'the bust branch does not call playBust');
	});

	test('the hand is dealt before the first card, not after it', () => {
		assert.ok(
			loop.indexOf('playDeal()') < loop.indexOf('playCardFlip('),
			'the deal is scheduled after the first flip',
		);
	});

	test('every per-card cue is staggered by cueLead', () => {
		// At maximum turbo, and on a slam, the gap between cards is 0ms - so
		// without this all four flips and all four stage wins fire on a single
		// millisecond and the limiter ducks them as one signal.
		//
		// The first attempt SUPPRESSED them instead, which was worse: an instant
		// round then played the deal and almost nothing, so the faster you played
		// the less game you got. The round still happened and is still owed its
		// sound; cueLead spaces it at playDeal's own riffle cadence rather than
		// removing it. A cue added to this loop later needs the same argument.
		for (const cue of ['playCardFlip', 'playStageWin', 'playForgiven', 'playBust']) {
			// Captures up to the first ')', which lands INSIDE cueLead(i) - hence
			// the open-paren match below rather than a balanced one.
			const calls = [...loop.matchAll(new RegExp(String.raw`sound\.${cue}\(([^)]*)`, 'g'))];
			assert.ok(calls.length > 0, `${cue} is no longer called in the reveal loop`);
			for (const call of calls) {
				assert.match(
					call[1]!,
					/cueLead\(i/,
					`sound.${cue}() does not pass cueLead(i), so an instant reveal stacks it`,
				);
			}
		}
	});

	test('the deal is NOT staggered - it is the cadence the rest falls in behind', () => {
		assert.match(loop, /sound\.playDeal\(\)/, 'the deal now takes an argument it should not');
	});
});

describe('pressKindFor maps onto classes that exist', () => {
	// Game.svelte:pressKindFor matches button classes as STRING LITERALS, so a
	// class renamed in a stylesheet does not break the build - it silently drops
	// that control to the quietest cue in the set. Same construction and same
	// reasoning as the parsed.family grep in modes.test.ts: the failure mode is
	// silence, and silence is what this whole file is about.
	const read = (rel: string) => readFileSync(resolve(import.meta.dirname, rel), 'utf8');

	// One file, not the concatenation: the slice below runs from 'function
	// pressKindFor' to the end of its body, and a slice that crosses a file
	// boundary reports on code this test is not about. sources.testlib.ts names
	// which file that is.
	const GAME = PRESS_CUES_SOURCE;
	// Each name carries its folder. styles/ is grouped now and these ten sheets
	// span two of those folders, so the single shared prefix this used to have
	// would still compile and simply read nothing.
	const CSS = [
		'popups/popup-mode', 'popups/popup-bet', 'popups/popup-turbo',
		'popups/popup-sound', 'popups/popup-autospin', 'popups/popup-advanced',
		'popups/popup-base',
		'board/control-bar', 'board/choices', 'board/cards',
	]
		.map((name) => read(`../../../styles/${name}.css`))
		.join('\n');

	const body = GAME.slice(GAME.indexOf('function pressKindFor'));
	const block = body.slice(0, body.indexOf('\n  }'));
	const classes = [...new Set([...block.matchAll(/'([^']+)'/g)].flatMap((m) => m[1]!.split(', ')))]
		.filter((c) => c.startsWith('.'))
		.map((c) => c.slice(1));

	test('finds a non-trivial number of classes to check', () => {
		assert.ok(classes.length >= 10, `only found ${classes.length} classes - did the parse break?`);
	});

	for (const cls of classes) {
		test(`.${cls} is still a real class`, () => {
			assert.ok(
				CSS.includes(`.${cls}`),
				`.${cls} is matched by pressKindFor but appears in no stylesheet`,
			);
		});
	}
});
