/**
 * The room the game is played in.
 *
 * WHY THIS IS AMBIENCE AND NOT A TUNE
 *
 * The obvious thing to build here - and what every procedural-music reference
 * reaches for first - is a looping melody with a bass line and a kick. That
 * would be wrong twice over. Stake names "over-reliance on generic AI-generated
 * assets" as a top cause of a 1-star rating, and a chiptune loop under a card
 * table is exactly the tell. More practically, this game's best work is the
 * hand-sampled table in table.css: a tune would sit on top of that scene rather
 * than belong to it, and a player who is about to hold their breath over four
 * cards does not need eight bars of anything.
 *
 * So: no drums, no tune to hum, nothing that resolves. But NOT nothing moving -
 * that was the second thing this got wrong. A drone under a slow pad with a long
 * reverb on it is the texture of melancholy whatever key it is in; "slow, low,
 * static and wet" IS how sad music is built, and swapping the chord from open
 * fifths to major pentatonic fixed the harmony while leaving all four of those
 * in place. It still came back as sad, and correctly.
 *
 * NOTHING IN HERE STRIKES A NOTE, AND THAT TOOK THREE GOES TO ACCEPT.
 *
 * Two pitched layers have been built here and removed. First a "sparkle" - one
 * bell-like sine around A5-C6 now and then. Then a plucked pentatonic arpeggio,
 * added to answer the bed sounding sad, and when that was called a ping too it
 * was moved down an octave and softened rather than dropped. That was hedging: a
 * pluck is a discrete pitched attack over a quiet room, which is the definition
 * of the thing being complained about, and lowering it only made it a lower one.
 *
 * The lesson is that a bed cannot have a foreground. Anything with an attack and
 * a pitch stops being background the moment the player notices it once, and from
 * then on they hear it every time.
 *
 * So the movement comes from things that have no attack and no pitch:
 *
 *   - the CHORD ITSELF changes. Pad voices overlap and are re-voiced often
 *     enough that the harmony is never quite the same, which is motion without
 *     anything ever being struck.
 *   - the ROOM is busier. Chips settling and cards moving on felt are the sound
 *     of a card table with people at it, and they are noise rather than notes,
 *     so no amount of them can ping. This is the layer to reach for if the bed
 *     ever feels flat again - NOT another melodic one.
 *
 * THE CHORD HAS A THIRD IN IT, AND IT USED NOT TO
 *
 * The first version deliberately left the third out - root, fourth, fifth, sixth
 * and ninth, on the reasoning that a minor pad would fight the major fanfare
 * every time a round paid, while a major one would sound cheerful under a round
 * about to lose, so committing to neither was the honest choice for a game whose
 * next event is a coin flip.
 *
 * That argument is fine on paper and it was wrong in the room. Stacked fifths
 * with no third do not read as NEUTRAL, they read as austere - it is the sound
 * of early church music, and under a warm brown card table with red cups on it
 * the game came out sounding bleak. "Dark and sad" was the verdict, and it was
 * right.
 *
 * It is C major pentatonic now - C D E G A. Warm because the third is there,
 * and safe because a pentatonic scale contains no semitone at all, so no two
 * notes the pad can pick are able to clash with each other or with the fanfare.
 * The worry about sounding cheerful under a loss turned out to be misplaced for
 * a simpler reason than the harmony: the loss cue is what says the round was
 * lost, and it is far louder than the room behind it.
 *
 * The register moved up with it. A drone on C1 is felt rather than heard and
 * pulls everything toward the floor; the bed now sits on C2/G2 with the pad
 * around E3-E4, which is where warmth actually lives.
 *
 * WHY THE TENSION BED CLIMBS ON THE NOTES IT DOES
 *
 * Stage 0-3 hold C3, D3, E3, F#3 - the same whole-tone walk the guess buttons
 * play an octave up, and the same step playStageWin uses between stages. By the
 * fourth card the bed is sitting on the F#, the one note outside the key, which
 * is why the last guess feels the least settled without anything having to say
 * so.
 *
 * SCHEDULING
 *
 * A look-ahead scheduler: a timer wakes every 25ms and schedules every step that
 * falls inside the next 100ms, at absolute context times. setInterval alone
 * drifts and is throttled to a crawl in a background tab; the Web Audio clock
 * does not, so the timer only has to be roughly on time for the audio to be
 * exactly on time.
 */
import { contextTime, isBusSilent, noise, onMixerChange, rand, shuffler, tone } from './audioGraph.ts';

/** Where the game is. 'none' stops the scheduler outright. */
export type MusicScene = 'none' | 'lobby' | 'table';

/** Seconds per step. Slow on purpose - this is a room, not a rhythm. */
const STEP = 0.5;
/** How far ahead of the clock notes are scheduled. */
const LOOKAHEAD = 0.1;
/** How often the timer wakes. Comfortably inside LOOKAHEAD. */
const TICK_MS = 25;

/**
 * Layer periods, in steps, chosen CO-PRIME.
 *
 * 16, 11, 7 and 5 share no factors, so the four layers only line up again after
 * their product - 6160 steps, over fifty minutes. The pad took the shortest of
 * them when the arpeggio was removed: re-voicing every 3.5s rather than every
 * 5.5s is what replaced the pulse, and it does it by changing the chord instead
 * of striking anything. Pick round numbers like 16/8/4
 * instead and every layer restarts together every 8 seconds, which is what makes
 * procedural ambience sound like a loop rather than like a place.
 */
const DRONE_STEPS = 16;
const PAD_STEPS = 7;
const TEXTURE_STEPS = 11;

/**
 * A second texture voice, on its own co-prime period. Chips settling under the
 * card-on-felt sound of the first, so the room has two things happening in it
 * rather than one repeated.
 */
const CHIP_STEPS = 5;

/**
 * Gains, from the bottom of the reference ranges rather than the middle.
 *
 * Background music is always quieter than it feels like it should be while you
 * are writing it, and this particular bed has to survive being heard for an hour
 * by someone who is concentrating on something else.
 */
const SCENES: Record<
	Exclude<MusicScene, 'none'>,
	{ drone: number; pad: number; texture: number; textureChance: number; chip: number; chipChance: number } // prettier-ignore
> = {
	// The loader and the intro. Barely more than a room tone: there is nothing
	// happening yet, and arriving into a full bed and then having it not change
	// when the game starts wastes the one transition this has.
	// The loader and the intro. The same material, thinner: fewer chips, a
	// narrower chord. Arriving at the table is then an opening-up rather than a
	// change of scene.
	lobby: { drone: 0.034, pad: 0.03, texture: 0.016, textureChance: 0.34, chip: 0.012, chipChance: 0.22 }, // prettier-ignore
	// The board.
	table: { drone: 0.042, pad: 0.05, texture: 0.03, textureChance: 0.68, chip: 0.026, chipChance: 0.5 }, // prettier-ignore
};

/**
 * C2 and G2. Still under the cue book so it never masks a card, but an octave
 * above where this started - a drone on C1 is felt rather than heard, and it
 * dragged the whole bed downward with it.
 */
const DRONE_ROOTS = [65.41, 98.0] as const;

/**
 * C major pentatonic across two octaves: G3, A3, C4, D4, E4, G4.
 *
 * Six pitches rather than five, and weighted upward rather than centred on the
 * root, because the root is already being held down there by the drone - the
 * pad's job is the warmth on top of it, not a second bass.
 *
 * It starts at G3 and not E3 for two reasons. E3 sits close enough to the G2
 * drone to muddy it, and - the one that is easy to break by accident - E3 is
 * also the tension bed's stage-2 root. Keeping the pad clear of C3/D3/E3/F#3
 * entirely means the bed's four notes belong to the bed alone, so a rising
 * reveal is never competing with the room for the same pitch. music.test.ts
 * asserts that separation directly.
 */
const PAD_PITCHES = [196.0, 220.0, 261.63, 293.66, 329.63, 392.0] as const;
const nextPad = shuffler(PAD_PITCHES);

/** Stage 0-3, an octave under CHOICE_ROOTS: C3, D3, E3, F#3. */
const TENSION_ROOTS = [130.81, 146.83, 164.81, 185.0] as const;

let scene: MusicScene = 'none';
/** 0-3 while the cards are being turned; null the rest of the time. */
let tensionStage: number | null = null;

let timer: ReturnType<typeof setTimeout> | null = null;
let nextStepAt = 0;
let stepIndex = 0;

/* ---- the layers ---------------------------------------------------------- */

function drone(at: number, gain: number) {
	// Two voices a beat apart rather than one, so the low end breathes instead of
	// sitting still. The detune is left to tone()'s own jitter.
	tone({ from: DRONE_ROOTS[0], duration: STEP * DRONE_STEPS * 1.1, type: 'sine', gain, at, attack: 1.6, space: 0.3, jitter: 6, bus: 'music' }); // prettier-ignore
	// The fifth above is a triangle, not a sine. Its odd harmonics are most of
	// what stops the low end reading as a test tone, and they are the only thing
	// down here that carries any brightness at all.
	tone({ from: DRONE_ROOTS[1], duration: STEP * DRONE_STEPS * 0.9, type: 'triangle', gain: gain * 0.42, at, delay: rand(0.05, 0.4), attack: 1.4, space: 0.5, jitter: 8, bus: 'music' }); // prettier-ignore
}

function pad(at: number, gain: number) {
	// Three notes from the set, never the same one twice running - a pentatonic
	// triad is warm where a bare two-note fifth is hollow, and no combination of
	// three can clash because the scale has no semitone in it.
	//
	// Duration longer than the period, so consecutive voicings overlap and the
	// chord changes by crossfade rather than by cutting. The attack is a little
	// over a second rather than the two-and-a-bit it started at: a pad that takes
	// too long to arrive stops sounding like a room and starts sounding like a
	// drone swelling at you.
	const hold = STEP * PAD_STEPS * 1.35;
	for (let i = 0; i < 3; i++) {
		tone({
			from: nextPad(),
			duration: hold,
			type: 'triangle',
			gain: gain * (i === 0 ? 1 : 0.66),
			at,
			delay: rand(0, 0.6),
			attack: 0.8,
			space: 0.75,
			jitter: 14,
			bus: 'music',
		});
	}
}

function texture(at: number, gain: number) {
	// Chips and felt. A short band-passed burst well up in the spectrum, placed
	// off the grid on purpose - a table noise that lands exactly on a beat stops
	// being a table noise.
	noise({
		duration: rand(0.05, 0.16),
		gain,
		from: rand(900, 2600),
		to: rand(400, 900),
		q: rand(1.4, 3.2),
		at,
		delay: rand(0, STEP * 0.9),
		space: 0.5,
		curve: rand(1.6, 3),
		bus: 'music',
	});
}

function chip(at: number, gain: number) {
	// A clay chip settling on another. Two very short noise bursts a few
	// milliseconds apart - the click of the edge and the body under it - band-
	// passed low and closed down fast.
	//
	// Noise, not a tone. Everything in this bed that had a PITCH and an ATTACK
	// ended up being heard as a ping and removed; a chip has an attack and no
	// pitch, so it lands as part of the room instead of on top of it.
	noise({ duration: rand(0.018, 0.032), gain, from: rand(320, 620), q: rand(1.2, 2.2), at, delay: rand(0, STEP * 0.8), space: 0.35, curve: rand(3, 5) }); // prettier-ignore
	noise({ duration: rand(0.03, 0.055), gain: gain * 0.7, from: rand(160, 300), q: rand(0.8, 1.6), at, delay: rand(0.012, 0.03), space: 0.3, curve: rand(2, 3.4) }); // prettier-ignore
}

function tension(at: number, stage: number) {
	const root = TENSION_ROOTS[Math.min(Math.max(stage, 0), TENSION_ROOTS.length - 1)]!;

	// A held tone at the stage's pitch, and its fifth a little quieter. Louder
	// per stage: by the fourth card this is the loudest thing the music does, and
	// it is still under the cues.
	const lift = 1 + stage * 0.28;
	tone({ from: root, duration: STEP * 2.1, type: 'triangle', gain: 0.026 * lift, at, attack: 0.5, space: 0.6, jitter: 10, bus: 'music' }); // prettier-ignore
	tone({ from: root * 1.5, duration: STEP * 1.7, type: 'sine', gain: 0.016 * lift, at, delay: 0.18, attack: 0.4, space: 0.7, jitter: 12, bus: 'music' }); // prettier-ignore
}

/* ---- the scheduler ------------------------------------------------------- */

function scheduleStep(index: number, at: number) {
	if (scene === 'none') return;
	const mix = SCENES[scene];

	if (index % DRONE_STEPS === 0) drone(at, mix.drone);
	if (mix.pad > 0 && index % PAD_STEPS === 0) pad(at, mix.pad);
	if (index % TEXTURE_STEPS === 0 && Math.random() < mix.textureChance) texture(at, mix.texture);
	if (index % CHIP_STEPS === 0 && Math.random() < mix.chipChance) chip(at, mix.chip);

	// Read rather than driven: setTension only sets a variable, so a slam-stop
	// that fires all four stages inside one frame leaves the last value here and
	// schedules ONE bed, instead of stacking four on the same millisecond.
	if (tensionStage !== null && index % 2 === 0) tension(at, tensionStage);
}

function tick() {
	timer = null;
	const now = contextTime();
	// Null when the bus is silent or there is no context - stop rather than spin.
	if (now === null || scene === 'none') {
		stop();
		return;
	}

	while (nextStepAt < now + LOOKAHEAD) {
		scheduleStep(stepIndex, nextStepAt);
		stepIndex++;
		nextStepAt += STEP;
	}

	timer = setTimeout(tick, TICK_MS);
}

function start() {
	if (timer !== null) return;
	const now = contextTime();
	if (now === null) return;
	// A small cushion so the first step is scheduled rather than already late.
	nextStepAt = now + 0.08;
	tick();
}

function stop() {
	if (timer !== null) clearTimeout(timer);
	timer = null;
	// stepIndex deliberately survives, so un-muting picks the room back up where
	// it was rather than restarting every layer together - which is the one thing
	// the co-prime periods exist to prevent.
}

/** Start or stop to match the scene and the mixer. */
function settle() {
	if (scene !== 'none' && !isBusSilent('music')) start();
	else stop();
}

// A player who un-mutes music mid-round should hear the room arrive, and one who
// mutes it should stop paying for the scheduler at all.
onMixerChange(settle);

export const music = {
	/** Where the game is. Changing scene never cuts a voice; the layers cross-fade. */
	setScene(next: MusicScene) {
		// Tension is a property of a round on the board, so leaving the board ends
		// it. Structural rather than something the reveal loop has to remember on
		// every exit path: the loop clears it at the end of a normal round, and
		// this catches the ones that never get there - a replay reset, an error
		// modal, a mode change mid-reveal.
		if (next !== 'table') tensionStage = null;
		scene = next;
		settle();
	},

	scene: () => scene,

	/**
	 * Whether the 25ms timer is actually running.
	 *
	 * Exposed for the test rather than for the game: "a muted room schedules no
	 * voices" is trivially true even when the scheduler is still waking forty
	 * times a second behind a zeroed gain, so counting voices cannot tell the two
	 * apart. This is the only thing that can.
	 */
	isScheduling: () => timer !== null,

	/**
	 * 0-3 while the cards are turning, null otherwise. Safe to call repeatedly
	 * and safe to call four times in one frame - see scheduleStep.
	 */
	setTension(stage: number | null) {
		tensionStage = stage;
	},

	/** Full stop, for teardown. */
	stop() {
		scene = 'none';
		tensionStage = null;
		stop();
	},
};
