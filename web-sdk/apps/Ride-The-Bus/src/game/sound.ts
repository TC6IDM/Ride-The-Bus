/**
 * Ride The Bus sound.
 *
 * The SDK's shared sound system (utils-sound -> Howler) plays sprites out of a
 * pre-produced `sounds.mp3` / `sounds.ogg` pair, the way apps/lines does. This
 * game has no such asset, and the previous contents of this file were the slot
 * template's ~50 reel/scatter/tumble sound names - none of which apply here, and
 * none of which were ever imported.
 *
 * So the cues below are synthesised with the Web Audio API instead: short tones
 * and noise bursts, no asset files needed. That gives the game genuine,
 * mute-able audio today. If produced audio is commissioned later, swap the
 * bodies of the play* functions for utils-sound calls - Game.svelte only touches
 * this module's public API, so nothing else has to change.
 *
 * Browsers block audio until the user interacts with the page, so the context is
 * created lazily on the first cue and resumed on demand.
 */

const MUTE_STORAGE_KEY = 'ride-the-bus:muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function readStoredMute(): boolean {
	if (typeof localStorage === 'undefined') return false;
	try {
		return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

let muted = readStoredMute();

/** Lazily build the audio graph. Returns null when audio isn't available. */
function ensureContext(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (!ctx) {
		const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
		if (!Ctor) return null;
		ctx = new Ctor();
		master = ctx.createGain();
		master.gain.value = 0.35; // headroom - these are UI cues, not music
		master.connect(ctx.destination);
	}
	// Autoplay policy: the context starts suspended until a user gesture.
	if (ctx.state === 'suspended') void ctx.resume();
	return ctx;
}

type ToneOptions = {
	/** Start frequency in Hz. */
	from: number;
	/** End frequency in Hz; omit for a steady tone. */
	to?: number;
	/** Seconds. */
	duration: number;
	type?: OscillatorType;
	/** Peak gain 0..1, before the master gain. */
	gain?: number;
	/** Seconds to wait before starting - used to build small arpeggios. */
	delay?: number;
};

function tone({ from, to, duration, type = 'triangle', gain = 0.6, delay = 0 }: ToneOptions) {
	const audio = ensureContext();
	if (!audio || !master || muted) return;

	const start = audio.currentTime + delay;
	const osc = audio.createOscillator();
	const env = audio.createGain();

	osc.type = type;
	osc.frequency.setValueAtTime(from, start);
	if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);

	// Quick attack, smooth decay - avoids the click a raw start/stop makes.
	env.gain.setValueAtTime(0.0001, start);
	env.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.02, duration / 4));
	env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

	osc.connect(env);
	env.connect(master);
	osc.start(start);
	osc.stop(start + duration + 0.02);
}

/** Short filtered noise burst - the papery part of a card flip. */
function noise({ duration = 0.09, gain = 0.35 }: { duration?: number; gain?: number } = {}) {
	const audio = ensureContext();
	if (!audio || !master || muted) return;

	const frames = Math.floor(audio.sampleRate * duration);
	const buffer = audio.createBuffer(1, frames, audio.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < frames; i++) {
		data[i] = (Math.random() * 2 - 1) * (1 - i / frames); // decaying white noise
	}

	const src = audio.createBufferSource();
	src.buffer = buffer;

	const band = audio.createBiquadFilter();
	band.type = 'bandpass';
	band.frequency.value = 1800;
	band.Q.value = 0.8;

	const env = audio.createGain();
	env.gain.value = gain;

	src.connect(band);
	band.connect(env);
	env.connect(master);
	src.start();
}

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

	/** Any button / toggle press. */
	playPress() {
		tone({ from: 420, to: 300, duration: 0.05, type: 'square', gain: 0.18 });
	},

	/** A card turning face up. */
	playCardFlip() {
		noise({ duration: 0.085, gain: 0.3 });
		tone({ from: 320, to: 520, duration: 0.06, type: 'triangle', gain: 0.22 });
	},

	/** A correct guess - pitch climbs with the stage so a streak rises. */
	playStageWin(stageIndex: number) {
		const base = 520 + stageIndex * 110;
		tone({ from: base, to: base * 1.5, duration: 0.13, gain: 0.4 });
	},

	/** A wrong guess. */
	playBust() {
		tone({ from: 300, to: 110, duration: 0.34, type: 'sawtooth', gain: 0.3 });
	},

	/** Round settled with a payout (partial or full). */
	playRoundWin() {
		[0, 0.09, 0.18].forEach((delay, i) => {
			tone({ from: 620 + i * 180, duration: 0.16, gain: 0.34, delay });
		});
	},

	/** All four guesses correct. */
	playFullWin() {
		[523, 659, 784, 1047].forEach((freq, i) => {
			tone({ from: freq, duration: 0.24, gain: 0.36, delay: i * 0.1 });
		});
	},

	/** Round settled with nothing back. */
	playRoundLoss() {
		tone({ from: 240, to: 150, duration: 0.26, type: 'sine', gain: 0.24 });
	},
};
