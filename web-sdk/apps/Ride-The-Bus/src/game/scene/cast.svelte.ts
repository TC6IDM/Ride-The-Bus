/**
 * The two characters in the back room: which frame each is on, and the timers
 * that move them. The scripts (what each move is) are castScript.ts; the
 * markup and the two effects that start the moves are BackRoomCast.svelte.
 *
 * Reads roundState (between rounds?) and nothing reads it back but the
 * component, so it is a leaf.
 *
 * FAILS SOFT, like the court art and the music bed: the frames are fetched
 * (castAsset.ts), and until EVERY frame has decoded `ready` stays false and
 * the room is empty - a man popping in half-drawn mid-puff would be worse
 * than no man. Nothing is logged: Stake's network check wants no game
 * information in the console.
 *
 * REDUCED MOTION: both men stand still on their idle frames. No breathing or
 * smoke (cast.css), no blinks, no moves.
 */
import { sound } from '../audio/sound';
import { reducedMotion } from '../celebration/celebrationGestures';
import type { WinTier } from '../math/winTiers';
import { roundInProgress } from '../round/roundState.svelte';
import {
	BLINK_GAP_MS,
	BLINK_MS,
	BOSS_EARLY_PUFF_DELAY_MS,
	BOSS_EXHALE,
	BOTH_STAGGER_MS,
	PUFF_BREATH_EVERY_MS,
	PUFF_BREATH_FIRST_MS,
	reactionTo,
	BOSS_POSES,
	BOSS_PUFF,
	BOSS_SALUTE,
	FLOORMAN_HATTIP,
	FLOORMAN_POSES,
	GLANCE_GAP_MS,
	GLANCE_MS,
	gap,
	type BossPose,
	type FloormanPose,
	type Step,
} from './castScript';

export const cast = $state({
	/** Every frame decoded; the room draws nothing until then. */
	ready: false,
	boss: 'idle' as BossPose,
	floorman: 'idle' as FloormanPose,
	/** The Floorman leaning in toward the table while a held card is out. */
	lean: false,
	/** Bumped once per exhale; the component keys the plume on it. */
	plume: 0,
	/** Bumped for each small breath of smoke while he is puffing. */
	breath: 0,
	/** The cigar is at his lips, drawing - from the early puff or the hold to
	 *  the turn. */
	puffing: false,
});

/** The URL of one frame, for the component and the preloader alike. */
export function castFrameUrl(base: string, figure: 'boss' | 'floorman' | 'cart', pose: string): string {
	return `${base}/${figure}-${pose}.webp`;
}

export function castSmokeUrl(base: string, kind: 'wisp' | 'plume', n: number): string {
	return `${base}/smoke-${kind}-${n}.webp`;
}

// ---- loading ------------------------------------------------------------

let started = false;

export function loadCast(base: string): void {
	if (started || typeof Image === 'undefined') return;
	started = true;
	const urls = [
		...BOSS_POSES.map((p) => castFrameUrl(base, 'boss', p)),
		...FLOORMAN_POSES.map((p) => castFrameUrl(base, 'floorman', p)),
		castFrameUrl(base, 'cart', 'idle'),
		...[1, 2, 3].map((n) => castSmokeUrl(base, 'wisp', n)),
		castSmokeUrl(base, 'plume', 1),
	];
	Promise.all(
		urls.map((src) => {
			const img = new Image();
			img.decoding = 'async';
			img.src = src;
			return img.decode();
		}),
	)
		.then(() => (cast.ready = true))
		.catch(() => {
			// Stays false: the room is drawn without them. A file that failed
			// once on a static host will fail again, so there is no retry.
		});
}

// ---- playing a script -----------------------------------------------------

/** Each man's pending steps, so a new move cancels the one under way. */
const timers = { boss: [] as ReturnType<typeof setTimeout>[], floorman: [] as ReturnType<typeof setTimeout>[] };

function clear(who: 'boss' | 'floorman') {
	for (const t of timers[who]) clearTimeout(t);
	timers[who] = [];
}

function play<P extends string>(who: 'boss' | 'floorman', steps: readonly Step<P>[], onStep?: (pose: P) => void) {
	clear(who);
	for (const { pose, at } of steps) {
		const run = () => {
			(cast as Record<string, unknown>)[who] = pose;
			onStep?.(pose);
		};
		if (at === 0) run();
		else timers[who].push(setTimeout(run, at));
	}
}

// ---- the moves ------------------------------------------------------------

// ---- the puff -----------------------------------------------------------------

let breathing: ReturnType<typeof setInterval> | null = null;
let firstBreath: ReturnType<typeof setTimeout> | null = null;

function stopBreathing() {
	if (breathing) clearInterval(breathing);
	if (firstBreath) clearTimeout(firstBreath);
	breathing = null;
	firstBreath = null;
}

/** The cigar to his lips, and kept there, drawing, until the turn. Starting
 *  again while he is already puffing does nothing - he does not put it down
 *  to pick it up. */
function startPuffing() {
	if (cast.puffing) return;
	cast.puffing = true;
	play('boss', BOSS_PUFF);
	stopBreathing();
	firstBreath = setTimeout(() => {
		cast.breath++;
		breathing = setInterval(() => cast.breath++, PUFF_BREATH_EVERY_MS);
	}, BOSS_PUFF.at(-1)!.at + PUFF_BREATH_FIRST_MS);
}

/**
 * A held last card has gone out to be squeezed. The Boss draws on his cigar -
 * or, if he has been puffing since the deal, simply carries on - and the
 * Floorman leans in. Decided from the round's own hold (round.lastCardHeld -
 * from the stake, never the result); see castScript.ts.
 */
export function castOnHold(): void {
	if (!cast.ready || reducedMotion()) return;
	startPuffing();
	clear('floorman');
	cast.floorman = 'idle';
	cast.lean = true;
}

/**
 * The early puff: at the deal, on half the rounds whose last card will be
 * held (round.bossPuffsEarly, decided in roundReveal). The Boss alone - the
 * Floorman's lean stays the held card's. He keeps puffing to the turn.
 */
export function castEarlyPuff(): void {
	if (!cast.ready || reducedMotion()) return;
	clear('boss');
	timers.boss.push(setTimeout(startPuffing, BOSS_EARLY_PUFF_DELAY_MS));
}

/** The held card has turned - whatever it shows. Smoke out, straighten up. */
export function castOnTurn(): void {
	cast.lean = false;
	const wasPuffing = cast.puffing;
	cast.puffing = false;
	stopBreathing();
	if (!cast.ready || reducedMotion()) {
		cast.boss = 'idle';
		return;
	}
	if (!wasPuffing && cast.boss === 'idle') return;
	cast.plume++;
	// Behind the turn's own strike and chime, not on top of them.
	sound.playBossExhale(EXHALE_AFTER_TURN_S);
	play('boss', BOSS_EXHALE);
}

/** How far behind a held card's turn the Boss's breath comes, in seconds. */
const EXHALE_AFTER_TURN_S = 0.45;

/**
 * The round is over and he is still puffing - a predicted hold that turbo
 * shortened below the felt minimum, say, so no turn came. He breathes out
 * rather than sit with the cigar at his lips into the next round.
 */
export function castRoundOver(): void {
	if (cast.puffing) castOnTurn();
}

/** Takeovers since either man last reacted; "recently" is within two. */
let sinceReaction = Infinity;

/**
 * A takeover has just been dismissed: whether either man is impressed, by how
 * rare the win was (reactionTo in castScript.ts - sometimes one, sometimes
 * both, often neither; Max always both). After the win was shown, so it tells
 * nothing. When both react the Floorman goes first and the Boss answers him.
 */
export function castAfterTakeover(tier: WinTier): void {
	if (!cast.ready || reducedMotion()) return;
	const reaction = reactionTo(tier, sinceReaction < 2);
	sinceReaction = reaction === 'none' ? sinceReaction + 1 : 0;
	if (reaction === 'floorman' || reaction === 'both') play('floorman', FLOORMAN_HATTIP);
	if (reaction === 'boss') play('boss', BOSS_SALUTE);
	if (reaction === 'both') {
		clear('boss');
		timers.boss.push(setTimeout(() => play('boss', BOSS_SALUTE), BOTH_STAGGER_MS));
	}
}

// ---- the idle life ----------------------------------------------------------

const life = new Set<ReturnType<typeof setTimeout>>();

function later(ms: number, fn: () => void) {
	const t = setTimeout(() => {
		life.delete(t);
		fn();
	}, ms);
	life.add(t);
}

/**
 * Blinks for both, and the Floorman's occasional glance across the room
 * (between rounds only). Each only ever replaces the idle frame, so a blink
 * never lands mid-puff or mid-salute. Returns the stop, for the component's
 * teardown.
 */
export function startCastLife(): () => void {
	const blinkBoss = () =>
		later(gap(BLINK_GAP_MS), () => {
			if (cast.ready && !reducedMotion() && cast.boss === 'idle') {
				cast.boss = 'blink';
				later(BLINK_MS, () => {
					if (cast.boss === 'blink') cast.boss = 'idle';
				});
			}
			blinkBoss();
		});
	const blinkFloorman = () =>
		later(gap(BLINK_GAP_MS), () => {
			if (cast.ready && !reducedMotion() && cast.floorman === 'idle') {
				cast.floorman = 'blink';
				later(BLINK_MS, () => {
					if (cast.floorman === 'blink') cast.floorman = 'idle';
				});
			}
			blinkFloorman();
		});
	const glance = () =>
		later(gap(GLANCE_GAP_MS), () => {
			if (cast.ready && !reducedMotion() && cast.floorman === 'idle' && !cast.lean && !roundInProgress()) {
				cast.floorman = 'glance';
				later(GLANCE_MS, () => {
					if (cast.floorman === 'glance') cast.floorman = 'idle';
				});
			}
			glance();
		});
	blinkBoss();
	// Out of step with the Boss, or the two blink together like a sketch.
	later(gap([900, 2400]), blinkFloorman);
	glance();
	return () => {
		for (const t of life) clearTimeout(t);
		life.clear();
		clear('boss');
		clear('floorman');
	};
}
