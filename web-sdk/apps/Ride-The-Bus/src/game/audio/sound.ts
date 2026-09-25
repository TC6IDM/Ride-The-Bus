/**
 * Ride The Bus cues - what each moment in a round actually sounds like.
 *
 * The output chain, the room, the variation machinery and mute all live in
 * audioGraph.ts, which music.ts shares. This file is only the cue book: which
 * voices fire, at what pitches, in what order. Game.svelte and
 * WinCelebration.svelte touch nothing but the `sound` object at the bottom.
 *
 * TWO THINGS THAT ARE EASY TO LOSE IN A LATER PASS
 *
 * 1. Nothing is ever played twice. Every cue jitters itself per trigger and
 *    every noise burst is a freshly generated buffer, so no two card flips are
 *    the same sample. Any cue added here should reach for `rand` and `shuffler`
 *    the way the ones below do; a cue that fires identically four times in a
 *    round is the machine-gun effect this was all built to avoid.
 *
 * 2. Buttons do not all sound alike. There are ~34 buttons in Game.svelte and
 *    they used to share a single click. playPress takes the KIND of control
 *    that was pressed, so committing to a guess, nudging the bet and dismissing
 *    a popup are audibly different actions.
 */

import { busVolume, isBusMuted, isBusSilent, isMuted, setBusMuted, setBusVolume, setMuted, toggleBusMuted, toggleMuted } from './audioMixer.ts';
import { rand, shuffler } from './audioVariation.ts';
import { noise, swell, thud, tone } from './audioVoices.ts';

export type { AudioBusName } from './audioMixer.ts';

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

/**
 * Win tiers, as far as the audio is concerned. Mirrors WinTierId in
 * game/math/winTiers.ts, redeclared rather than imported so this module stays a leaf
 * - sound.ts is imported by nearly everything and importing back up into game
 * logic would make that circular.
 */
export type WinTierSound = 'big' | 'huge' | 'mega' | 'epic' | 'max';

/**
 * How each tier's fanfare is built. Escalation is by density and range rather
 * than volume - see playWinFanfare.
 *
 * `arpeggio` entries are ratios against the root (C5): 1 = root, 1.26 = major
 * third, 1.5 = fifth, 2 = octave, and beyond that the same shape an octave up.
 */
const FANFARE: Record<
	WinTierSound,
	{ arpeggio: number[]; arpeggioStep: number; hold: number; shimmer: number; swell: boolean }
> = {
	big: { arpeggio: [1, 1.26, 1.5, 2], arpeggioStep: 0.075, hold: 0.8, shimmer: 2, swell: false },
	huge: { arpeggio: [1, 1.26, 1.5, 2, 2.52], arpeggioStep: 0.072, hold: 1.0, shimmer: 3, swell: false },
	mega: {
		arpeggio: [1, 1.26, 1.5, 2, 2.52, 3],
		arpeggioStep: 0.068,
		hold: 1.25,
		shimmer: 4,
		swell: true,
	},
	epic: {
		arpeggio: [1, 1.26, 1.5, 2, 2.52, 3, 4],
		arpeggioStep: 0.064,
		hold: 1.5,
		shimmer: 5,
		swell: true,
	},
	max: {
		arpeggio: [1, 1.26, 1.5, 2, 2.52, 3, 4, 5.04, 6],
		arpeggioStep: 0.06,
		hold: 1.9,
		shimmer: 7,
		swell: true,
	},
};

/**
 * The shortest climb the last-card hum will sing, in seconds. Below this the
 * turbo slider has shortened the hold to where the voices could not rise
 * before they were cut - a blip, not suspense - so the wait is left silent.
 *
 * Exported because it is also the line the reveal draws for the rest of the
 * hold's drama (roundReveal.svelte.ts): under it, no duck of the music and no
 * tunnel either, which would otherwise pump the bed and dim the room for a
 * blink on every held card of a fast autoplay run.
 */
export const HOLD_MIN_CLIMB = 0.25;

/**
 * The root of the stage-win chime at a stage: C5, a whole tone higher per
 * stage (playStageWin). Shared with the held last card, whose hum is tuned to
 * the chime that card would play if it lands - see playLastCardHold.
 */
export const stageWinRoot = (stageIndex: number) => 523.25 * Math.pow(2, (stageIndex * 2) / 12);

/**
 * The vowel "oh", as formants [Hz, Q, level]: the first two resonances of an
 * open "o" (F1 ~450, F2 ~800) and a trace of the third for presence. Wider
 * than one singer's (Q ~6-10), because a crowd's formants smear - every
 * throat is a slightly different size - and wider is also what keeps a
 * sawtooth through band-passes from whistling.
 *
 * The third formant is up from 0.14 to 0.2 for the phone: most of the crowd's
 * pitch sits under 200 Hz, below what a phone speaker plays at all, so what
 * carries it there is the upper formants' share of each voice's harmonics.
 */
const OH = [
	[450, 3.5, 1],
	[800, 5, 0.6],
	[2800, 7, 0.2],
] as const;

/**
 * The crowd: four voices a few cents either side of the pitch, and two an
 * octave up - the high voices in a crowd's "ohhh". Those two are at 0.65, up
 * from 0.4: they are the half of the crowd a phone speaker can actually play.
 */
const CROWD = [
	[0.985, 1],
	[0.996, 1],
	[1.004, 1],
	[1.014, 1],
	[1.993, 0.65],
	[2.009, 0.65],
] as const;

/** A few voices rather than a crowd - the Big-win hold. */
const SMALL_CROWD = [
	[0.992, 1],
	[1.008, 1],
	[2.0, 0.65],
] as const;

/**
 * How big the strike is, from the tier the held card could land:
 *   crack  the ripping crack and its body only - a Big win's
 *   storm  and thunder rolling under it - Huge to Epic
 *   full   and a sub hit for the weight - Max
 */
type StrikeWeight = 'crack' | 'storm' | 'full';

type HoldShape = {
	voices: readonly (readonly [number, number])[];
	gain: number;
	breath: number;
	strike: StrikeWeight;
	buzz: number[];
};

/**
 * Everything about a hold that scales with what rides on the card.
 *
 * WHY IT SCALES. A Big-win hold is the common one, and it used to be the whole
 * performance every time - six voices, the full strike - on a card that misses
 * three times in four. The biggest sound in a Big-win round was the strike, 4.5
 * dB over the Big fanfare it announced. A moment that is always at full size
 * stops being one; so Big gets a few voices and the crack, and the crowd, the
 * thunder and the sub hit are kept for the stakes that earn them.
 *
 * `buzz` is the haptic pattern that rides the strike - see haptic().
 */
const HOLD_SHAPE: Record<WinTierSound, HoldShape> = {
	big: { voices: SMALL_CROWD, gain: 0.15, breath: 0.8, strike: 'crack', buzz: [25] },
	huge: { voices: CROWD, gain: 0.2, breath: 1.2, strike: 'storm', buzz: [40] },
	mega: { voices: CROWD, gain: 0.2, breath: 1.2, strike: 'storm', buzz: [45] },
	epic: { voices: CROWD, gain: 0.2, breath: 1.2, strike: 'storm', buzz: [50] },
	max: { voices: CROWD, gain: 0.2, breath: 1.2, strike: 'full', buzz: [60, 40, 90] },
};

/**
 * Lightning: what the last-card hum ends on as the card turns. A crack that
 * RIPS - three bright bursts inside 45ms, each quieter, because a real strike
 * is a tearing, not a single click - then the crack's body; then, above a Big
 * win, thunder rolling under it, and on Max a sub hit for the weight. Every
 * part is fresh noise, so no two strikes are the same.
 *
 * THE THUNDER HAS TWO BANDS. The low roll (190 Hz down to 50) is the weight on
 * full-range speakers and is gone entirely on a phone, which plays almost
 * nothing under ~200 Hz; the band from 420 down to 170 is the same roll where a
 * phone can reproduce it.
 *
 * LEVEL. The first cut peaked at -6.2 dBFS against a fanfare of -11.4 and came
 * down 3 dB; measured again on 2026-09-25 it still sat 4.5 dB over the Big
 * fanfare and 1.3 dB over the Max one. The strike announces the win, it must
 * not outshout it: every weight is now scaled so the fanfare after it is the
 * louder of the two (checked with npm run audio at Big and at Max).
 */
function strike(weight: StrikeWeight) {
	const level = weight === 'crack' ? 0.5 : 0.72;
	[0, 0.018, 0.043].forEach((delay, i) => {
		noise({ duration: 0.16, gain: (0.21 - i * 0.05) * level, from: rand(5200, 7600), to: rand(2200, 3000), q: 0.45, curve: 3.2, delay, space: 0.55 }); // prettier-ignore
	});
	noise({ duration: 0.6, gain: 0.16 * level, from: 1700, to: 380, q: 0.55, curve: 2.1, space: 0.65 });
	if (weight === 'crack') return;
	noise({ duration: 1.6, gain: 0.3 * level, from: 190, to: 50, q: 0.8, pink: true, curve: 1.2, space: 0.45, delay: 0.02 }); // prettier-ignore
	noise({ duration: 1.1, gain: 0.2 * level, from: 420, to: 170, q: 0.7, pink: true, curve: 1.5, space: 0.5, delay: 0.03 }); // prettier-ignore
	if (weight === 'full') thud({ from: rand(100, 115), to: 34, duration: 0.6, gain: 0.1, attack: 0.001 });
}

/**
 * A short buzz under the strike, on the devices that have one.
 *
 * Only where it can be felt and was not declined: nothing when game sounds are
 * off (a player who silenced the game did not ask to be buzzed instead), and
 * nothing before the player has touched the page - Chrome logs an intervention
 * warning for a vibrate() without a user gesture, and the console is part of
 * what Stake inspects. iOS has no Vibration API; there this is a no-op.
 */
function haptic(pattern: number[]) {
	if (isBusSilent('sfx')) return;
	try {
		if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
		if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
		navigator.vibrate(pattern);
	} catch {
		// A frame that forbids it throws in some browsers; a missing buzz is not an error.
	}
}

// Fixed pitch sets per control kind, cycled without immediate repeats. Two
// presses in a row are therefore never the same note AND never the same detune,
// which is what stops a run of clicks sounding mechanical.
const softNotes = shuffler([380, 420, 460] as const);
const chipNotes = shuffler([2100, 2400, 2750, 3050] as const);
const toggleNotes = shuffler([520, 580] as const);

export const sound = {
	// The mixer lives in audioGraph.ts, because it gates the voices rather than
	// the cues and music has to obey the same switch. Re-exposed here so that
	// Game.svelte keeps one import for everything it can hear.
	isMuted,
	setMuted,
	toggleMuted,
	busVolume,
	setBusVolume,
	isBusMuted,
	isBusSilent,
	setBusMuted,
	toggleBusMuted,

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
	 * The music slider's own tick, on the MUSIC bus.
	 *
	 * A volume slider has to preview the bus it sets. Ticking it on the cue bus
	 * instead would be worse than silence - it would demonstrate a level the
	 * slider does not control. That matters more now, not less: the music bus
	 * carries a produced track that may not be loaded yet, or at all, so this
	 * tick is often the only thing the music slider can make a sound with.
	 *
	 * Softer and rounder than playSliderTick: sines rather than a triangle, a
	 * longer tail, more room. That is not decoration - it is what keeps the tick
	 * feeling like it belongs to the music bus rather than to the cues, so
	 * dragging the slider is a fair sample of what turning the music up will do.
	 * It also has to survive being heard on a bus the player may be setting to
	 * 5%, which is why it is not quiet.
	 */
	playMusicTick(position: number) {
		const clamped = Math.min(Math.max(position, 0), 1);

		// Same scale walk as the cue slider, so the two controls feel like one
		// family, but a fifth lower - the music bed lives below the cues and its
		// slider should not be the brightest thing in the panel.
		const semitones = clamped * 24;
		const octave = Math.floor(semitones / 12);
		const within = semitones - octave * 12;
		const degree = SCALE.reduce((best, d) => (Math.abs(d - within) < Math.abs(best - within) ? d : best)); // prettier-ignore
		const freq = 293.66 * Math.pow(2, (octave * 12 + degree) / 12);

		tone({ from: freq, duration: 0.16, type: 'sine', gain: 0.2, attack: 0.006, space: 0.7, jitter: 0, bus: 'music' }); // prettier-ignore
		tone({ from: freq * 2, duration: 0.1, type: 'sine', gain: 0.07, delay: 0.012, attack: 0.004, space: 0.6, jitter: 0, bus: 'music' }); // prettier-ignore
	},

	/**
	 * The last card, held: a crowd's "ohhhh" that climbs under the wait, holds
	 * at the top, and ends on a lightning strike as the card turns.
	 *
	 * The hold (lastCardHoldMs) was silent - the card lifted, the label read
	 * LAST CARD, and the room said nothing. This is the sound of the wait
	 * itself, in three parts, on the same clock as the card's own rise:
	 *   1. UP, in straight lines, for `climb` seconds: the voices slide an
	 *      octave, a 20 dB crescendo from a tenth of the top, the vibrato
	 *      quickening and widening.
	 *   2. AT THE TOP for what is left of the wait (holdClimbMs decides the
	 *      split) - the held breath before the reveal.
	 *   3. The STRIKE as the card turns: the voices drop an octave and are gone
	 *      under a crack - and, above a Big win, its thunder. See strike().
	 *
	 * TUNED TO THE CARD. The top of the climb is two octaves under the chime
	 * this card plays if it lands (stageWinRoot of its stage - F#5 for card 4,
	 * E5 for Three of a Kind's card 3), so a landing resolves the hum: the
	 * chime arrives on the note the crowd was reaching for. It topped out on G3
	 * before, a semitone off the card-4 chime's F#.
	 *
	 * SCALED BY THE STAKE. `tier` is the tier the card could land, from the
	 * stake alone (never whether it lands) - see HOLD_SHAPE: a few voices and a
	 * crack for a Big win, the whole crowd and the thunder above it.
	 *
	 * An open vowel, not a tone. Detuned sawtooths sung through the "oh"
	 * formants (OH), with breath through the same bank, are a crowd going
	 * "ohhhh"; the same sawtooths through a closing lowpass were a buzzy
	 * "mmmm", which is what the owner heard in the version before this. Five
	 * listens to get here: a steady pedal that barely rose stood still, a climb
	 * that sped up into the turn was the wrong shape, an even climb that faded
	 * out did not land, and a dive over a thud was too subtle an ending.
	 *
	 * RELEASED, NOT ENDED. The reveal calls the returned release the moment the
	 * card turns, however the wait ended - on time, slammed, or cut short by the
	 * turbo slider - so the strike always lands on the turn and the voices can
	 * never outlast the card.
	 */
	playLastCardHold(climb: number, tier: WinTierSound = 'max', stage = 3): () => void {
		if (!(climb >= HOLD_MIN_CLIMB)) return () => {};
		const shape = HOLD_SHAPE[tier];
		const top = stageWinRoot(stage) / 4;
		const release = swell({
			from: top / 2,
			to: top,
			climb,
			voices: shape.voices,
			type: 'sawtooth',
			gain: shape.gain,
			floor: 0.1,
			formants: OH,
			// Weight under the vowel, down from 0.35: this lowpassed path is almost
			// all under 200 Hz, which a phone throws away.
			body: 0.22,
			breath: shape.breath,
			vibrato: { rate: [rand(4.4, 4.8), rand(6, 6.6)], depth: [6, 20] },
			space: 0.5,
		});
		let struck = false;
		return () => {
			if (struck) return;
			struck = true;
			release({ seconds: 0.18, cents: -1200 });
			strike(shape.strike);
			haptic(shape.buzz);
		};
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
	playCardFlip(lead = 0) {
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
			delay: lead,
		});
		tone({
			from: rand(300, 360),
			to: rand(480, 560),
			duration: 0.055,
			type: 'triangle',
			gain: 0.094,
			space: 0.3,
			jitter: 40,
			delay: lead,
		});
		thud({ from: rand(150, 200), to: 65, duration: 0.11, gain: 0.105, delay: lead + rand(0.01, 0.025) });
	},

	/**
	 * A correct guess. Climbs with the stage so a streak audibly escalates: the
	 * root rises a whole tone per stage and the voicing opens from a bare fifth
	 * to a fifth plus octave, which brightens without just getting louder.
	 */
	playStageWin(stageIndex: number, lead = 0) {
		const root = stageWinRoot(stageIndex);
		tone({ from: root, duration: 0.16, type: 'triangle', gain: 0.3, space: 0.45, attack: 0.008, delay: lead }); // prettier-ignore
		tone({ from: root * 1.5, duration: 0.19, type: 'sine', gain: 0.2, delay: lead + 0.035, space: 0.5 });
		if (stageIndex >= 2) {
			tone({ from: root * 2, duration: 0.22, type: 'sine', gain: 0.13, delay: lead + 0.07, space: 0.55 });
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
	playBust(lead = 0) {
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
		tone({ from: root * fall[0]!, duration: 0.17, type: 'triangle', gain: 0.165, space: 0.45, attack: 0.008, delay: lead }); // prettier-ignore
		tone({ from: root * fall[1]!, duration: 0.2, type: 'sine', gain: 0.14, delay: lead + 0.085, space: 0.5 });
		tone({ from: root * fall[2]!, duration: 0.28, type: 'triangle', gain: 0.125, delay: lead + 0.17, space: 0.55 });

		// Weight underneath the last note - the floor giving way. Tonal, an
		// octave below where the figure lands, rather than a thump: it should
		// settle the phrase, not punctuate it.
		tone({ from: root * fall[2]! * 0.5, duration: 0.34, type: 'sine', gain: 0.082, delay: lead + 0.17, space: 0.4 });
	},

	/**
	 * A wrong guess that Second Chance forgave - the round carries on.
	 *
	 * This used to be playBust() verbatim, which quietly threw away the whole
	 * point of the family. cards.css is careful that the two marks differ ("a red
	 * cross says the round ended here, and this one carried on") and the audio
	 * was saying they were the same event.
	 *
	 * Built as the bust's deliberate opposite, on the same root and the same
	 * instrument so the pair is heard as related rather than as two unconnected
	 * sounds: F4, Ab4, C5 - the identical F minor triad playBust falls through,
	 * taken UPWARD and landing back on the root it started from. Still minor,
	 * because a guess was still missed; resolving, because the round did not end.
	 *
	 * Quieter than the bust and with no weight underneath it. The low octave in
	 * playBust is the floor giving way, and there is no floor giving way here.
	 */
	playForgiven(lead = 0) {
		const root = 523.25;
		const rise = [Math.pow(2, -7 / 12), Math.pow(2, -4 / 12), 1];

		tone({ from: root * rise[0]!, duration: 0.16, type: 'triangle', gain: 0.13, space: 0.45, attack: 0.008, delay: lead }); // prettier-ignore
		tone({ from: root * rise[1]!, duration: 0.18, type: 'sine', gain: 0.115, delay: lead + 0.075, space: 0.5 });
		tone({ from: root * rise[2]!, duration: 0.26, type: 'triangle', gain: 0.115, delay: lead + 0.15, space: 0.55 });

		// A soft breath of air on the landing rather than a body. The round is
		// being let off, which is a lifting sensation, not an impact.
		noise({ duration: 0.09, gain: 0.05, from: 1800, to: 3600, q: 1.2, delay: lead + 0.15, space: 0.6, curve: 0.7 }); // prettier-ignore
	},

	/**
	 * The hand being dealt, at the top of a round.
	 *
	 * The round used to begin in silence: the first thing a player heard was the
	 * first card landing, about 650ms after they pressed. This fills that gap
	 * with the thing that is actually happening - four cards coming off the deck
	 * - and gives the press somewhere to resolve to.
	 *
	 * Four riffles rather than one sound: it is a DEAL, and the count is the one
	 * detail that makes it read as this game's deal rather than a generic shuffle.
	 * Quieter and duller than playCardFlip, because these cards are going down
	 * face-down and that one is a card being turned over.
	 */
	playDeal() {
		for (let i = 0; i < 4; i++) {
			noise({
				duration: rand(0.045, 0.07),
				gain: rand(0.055, 0.08),
				from: rand(1400, 2100),
				to: rand(500, 800),
				q: rand(0.7, 1.2),
				delay: i * rand(0.052, 0.075),
				curve: 1.8,
				space: 0.4,
			});
		}
		// One low settle under the last of them - the deck being squared up.
		thud({ from: rand(120, 150), to: 58, duration: 0.13, gain: 0.07, delay: 0.21 });
	},

	/**
	 * A press the game refused - an unaffordable bet, one outside the operator's
	 * range, a control locked while a round is on the wire.
	 *
	 * ONE cue for every refusal, not one per reason. betBlockedReason() already
	 * distinguishes three cases in words, and the words are the part a player can
	 * act on; three different noises would be a second, vaguer ruler running
	 * alongside the first and saying less.
	 *
	 * Deliberately not a buzz or an error tone. It is the game declining to do
	 * something, not the game breaking: a short muted double-tap, the sound of a
	 * control that will not move.
	 */
	playBlocked() {
		tone({ from: 196, duration: 0.05, type: 'sine', gain: 0.11, attack: 0.002, space: 0.15 });
		tone({ from: 185, duration: 0.07, type: 'sine', gain: 0.095, delay: 0.075, attack: 0.002, space: 0.15 }); // prettier-ignore
		noise({ duration: 0.022, gain: 0.045, from: 900, q: 2.4, space: 0.1, curve: 3 });
	},

	/**
	 * An autoplay run starting and stopping.
	 *
	 * A run beginning is a state change the player should be able to hear without
	 * watching the button - they have just handed the game the next N rounds, and
	 * the confirmation of that should not be purely visual. The pair is one
	 * gesture in two directions: a rising fifth to hand over, a falling one to
	 * take it back.
	 */
	playAutoStart() {
		tone({ from: 392, duration: 0.1, type: 'triangle', gain: 0.13, attack: 0.004, space: 0.3 });
		tone({ from: 587.33, duration: 0.16, type: 'sine', gain: 0.11, delay: 0.08, space: 0.4 });
	},

	playAutoStop() {
		tone({ from: 587.33, duration: 0.1, type: 'triangle', gain: 0.115, attack: 0.004, space: 0.3 });
		tone({ from: 392, duration: 0.18, type: 'sine', gain: 0.1, delay: 0.08, space: 0.4 });
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

	/**
	 * The big-win takeover opening, escalating with the tier.
	 *
	 * Built from the same major-triad vocabulary as playFullWin rather than a
	 * new palette, so the celebration reads as the game getting louder about
	 * something it already says - not as a different game interrupting.
	 *
	 * Escalation is by DENSITY and RANGE, not just volume: each tier adds
	 * voices, reaches further up, and holds longer. Turning one sound up is how
	 * you get a louder version of the same event; adding voices is how you get a
	 * bigger one.
	 */
	playWinFanfare(tier: WinTierSound) {
		const shape = FANFARE[tier];
		const root = 523.25;

		// Rising arpeggio - the part that reads as "here it comes".
		shape.arpeggio.forEach((ratio, i) => {
			tone({
				from: root * ratio,
				duration: 0.3,
				gain: 0.26,
				delay: i * shape.arpeggioStep,
				space: 0.55,
				attack: 0.01,
			});
		});

		// Sustained chord underneath, arriving as the arpeggio lands.
		const held = shape.arpeggio.length * shape.arpeggioStep;
		[1, 1.26, 1.5, 2].forEach((ratio, i) => {
			tone({
				from: root * ratio,
				duration: shape.hold,
				type: 'sine',
				gain: 0.1,
				delay: held + i * 0.012,
				attack: 0.14,
				space: 0.7,
				jitter: 9,
			});
		});

		// Low swell. Only the top tiers get it - it is what makes a Max Win feel
		// like it has weight under it rather than just brightness on top.
		if (shape.swell) {
			thud({ from: 92, to: 58, duration: shape.hold * 0.8, gain: 0.16, attack: 0.09 });
		}

		// Shimmer, scaling in count with the tier.
		for (let i = 0; i < shape.shimmer; i++) {
			tone({
				from: root * (3 + i * 0.45),
				duration: 0.32,
				type: 'sine',
				gain: 0.05,
				delay: held + 0.1 + i * 0.075,
				space: 0.8,
				jitter: 30,
			});
		}
	},

	/**
	 * One step of the amount climbing.
	 *
	 * Pitch rises with progress but is SNAPPED TO THE MAJOR SCALE, for the same
	 * reason the turbo slider is: a continuous sweep across a count-up reads as
	 * a siren, where scale degrees read as a run. `progress` is 0..1 through the
	 * count, so the run resolves upward as the number settles.
	 */
	playWinCountTick(progress: number) {
		const clamped = Math.min(1, Math.max(0, progress));
		// Two octaves of the scale, so a long Max Win count has somewhere to go.
		const steps = SCALE.length * 2;
		const index = Math.min(steps - 1, Math.floor(clamped * steps));
		const octave = Math.floor(index / SCALE.length);
		const degree = SCALE[index % SCALE.length]!;
		const freq = 784 * 2 ** (octave + degree / 12);

		tone({
			from: freq,
			duration: 0.055,
			type: 'triangle',
			gain: 0.075,
			attack: 0.002,
			space: 0.3,
			jitter: 4,
		});
	},

	/**
	 * The title being promoted mid-count - Big to Huge, Huge to Mega, and so on.
	 *
	 * Deliberately short and bright, and deliberately NOT another fanfare: it
	 * lands on top of a count-up that is already ticking, so anything with a tail
	 * would smear across the ticks. A rising two-note stab reads as "up a level"
	 * in about a tenth of a second.
	 *
	 * The interval widens with the tier, so the later promotions - the ones a
	 * player almost never sees - are the ones that jump furthest.
	 */
	playWinTierUp(tier: WinTierSound) {
		const index = (['big', 'huge', 'mega', 'epic', 'max'] as const).indexOf(tier);
		const root = 659.25 * 2 ** (Math.max(0, index) / 12);
		const leap = 1.26 + Math.max(0, index) * 0.06;

		tone({ from: root, duration: 0.07, type: 'triangle', gain: 0.13, attack: 0.002, space: 0.3 });
		tone({
			from: root * leap,
			duration: 0.11,
			type: 'triangle',
			gain: 0.15,
			delay: 0.055,
			attack: 0.002,
			space: 0.42,
		});
	},

	/**
	 * The amount landing on its final figure - whether it counted all the way or
	 * the player tapped to skip. Always plays, because it is the cue that the
	 * number on screen is now the real one and the next tap will dismiss.
	 */
	playWinCountEnd(tier: WinTierSound) {
		const root = 523.25;
		const big = tier === 'epic' || tier === 'max';

		[1, 1.5, 2].forEach((ratio, i) => {
			tone({
				from: root * ratio,
				duration: big ? 0.6 : 0.38,
				type: 'sine',
				gain: 0.15,
				delay: i * 0.015,
				attack: 0.008,
				space: 0.6,
			});
		});

		thud({ from: 150, to: 84, duration: 0.14, gain: 0.12, attack: 0.003 });
	},
};
