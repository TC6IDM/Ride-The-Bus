/**
 * THE CHIPS (the owner's W1, 2026-10-18). The table's own chips, flat and seen
 * from above, stream out from BEHIND the hand for as long as the win is up,
 * thicker at every tier, and each tier lands with a burst. They replaced the
 * suit-mark burst, which the takeover audit (2026-10-17) found read as debris on
 * any still frame; the owner asked for chips "flying out from behind the cards",
 * then for a continuous stream that grows with the tier, then halved it and kept
 * it flat. The passes and what was set aside are in
 * design-archive/2026-10-17-visual-directions/DECISIONS.md.
 *
 * WHAT IS THE TIER'S AND WHAT IS NOT. How many chips a second, how many in a
 * tier's burst and how far they are thrown are the tier's knobs in
 * win-celebration.css (--wc-chip-rate, --wc-chip-burst, --wc-throw), so the
 * ladder stays one table and the .tier-* rules still set nothing but custom
 * properties. --wc-chip-share scales the lot down where the screen is small.
 * This module only flies them.
 *
 * The host is a zero-size point inside .wc-fan, under the cards, so a chip
 * leaves from behind the hand and passes behind the sign and the figure (the
 * body's text sits above the fan). Each chip is one element animated on
 * transform and opacity through the Web Animations API, then removed. Nothing
 * runs under reduced motion.
 */
import { reducedMotion } from './celebrationGestures.ts';

/** The table's five chip colours (tokens.css --chip-*), drawn by the stylesheet. */
export const CHIP_SETS = ['red', 'green', 'black', 'blue', 'white'] as const;

/**
 * The most chips in the air at once. Max's stream and burst peak around 37;
 * this is a ceiling for a slow device whose frames stretch the flights out,
 * not a number the design reaches.
 */
const MAX_IN_FLIGHT = 60;

export type ChipFlight = {
  /** Where it leaves from, relative to the fan's origin, in px. */
  x: number;
  y: number;
  /** Its diameter, in px. */
  size: number;
  frames: Keyframe[];
  duration: number;
  delay: number;
};

/**
 * One chip's flight. Pure: `rand` is injected so a test can pin it.
 *
 * `unit` is the takeover's --ui in px and `thrown` the tier's --wc-throw.
 * The chip leaves from somewhere behind the hand (the fan's cards hang about
 * 10 units up from its origin), rises on an arc to one side, falls past where
 * it started and fades over the last quarter of its flight, spinning flat as
 * it goes. It starts at 0.6 of its size and reaches full size quickly, so it
 * reads as coming out from behind the cards rather than appearing on them.
 */
export function chipFlight(rand: () => number, unit: number, thrown: number): ChipFlight {
  const side = rand() < 0.5 ? -1 : 1;
  const reach = side * unit * 34 * thrown * (0.3 + rand() * 0.7);
  const rise = unit * (5.7 + rand() * 9.5) * thrown;
  const drop = unit * 36;
  const spin = (0.6 + rand() * 1.2) * 360 * side;
  const tilt = (rand() - 0.5) * 360;
  const frames: Keyframe[] = Array.from({ length: 15 }, (_, i) => {
    const t = i / 14;
    const dx = reach * (1 - (1 - t) ** 1.5);
    const dy = -4 * rise * t * (1 - t) + drop * t * t;
    const scale = Math.min(1, 0.6 + t * 3);
    return {
      transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${(tilt + spin * t).toFixed(1)}deg) scale(${scale.toFixed(3)})`,
      opacity: t < 0.74 ? 1 : +(1 - (t - 0.74) / 0.26).toFixed(3),
    };
  });
  return {
    x: (rand() - 0.5) * unit * 14.6,
    y: -unit * 5.2 + (rand() - 0.5) * unit * 4.2,
    size: unit * 2.8 * (0.85 + rand() * 0.3),
    frames,
    duration: 1250 + rand() * 450,
    delay: 0,
  };
}

export type ChipStream = {
  /** Start streaming at the current level. */
  start(): void;
  /** Set the stream's rate and throw, and throw this level's burst. */
  level(ratePerSecond: number, burst: number, thrown: number): void;
  /** Stop throwing; chips in the air finish their flight. */
  stop(): void;
};

const NOTHING: ChipStream = { start() {}, level() {}, stop() {} };

/**
 * The emitter. `unit` is read at each throw, so a resize mid-takeover still
 * throws chips at the takeover's own scale.
 */
export function chipStream(host: HTMLElement | undefined, unit: () => number): ChipStream {
  if (!host || typeof document === 'undefined' || reducedMotion()) return NOTHING;
  let on = false;
  let rate = 0;
  let thrown = 1;
  let owed = 0;
  let last = 0;
  let frame = 0;

  const fly = (delay: number) => {
    if (host.childElementCount >= MAX_IN_FLIGHT) return;
    const flight = chipFlight(Math.random, unit(), thrown);
    const chip = document.createElement('i');
    chip.className = 'wc-chip';
    chip.dataset.set = CHIP_SETS[Math.floor(Math.random() * CHIP_SETS.length)]!;
    chip.style.cssText = `--d: ${flight.size.toFixed(1)}px; left: ${flight.x.toFixed(1)}px; top: ${flight.y.toFixed(1)}px`;
    host.appendChild(chip);
    const done = () => chip.remove();
    chip.animate(flight.frames, { duration: flight.duration, delay, easing: 'linear', fill: 'both' }).finished.then(done, done);
  };

  const tick = (now: number) => {
    if (!on) return;
    // Capped at a twentieth of a second, so a tab coming back from the
    // background does not pay out every chip it owes at once.
    owed += rate * Math.min(0.05, (now - last) / 1000);
    last = now;
    while (owed >= 1) {
      owed -= 1;
      fly(0);
    }
    frame = requestAnimationFrame(tick);
  };

  return {
    start() {
      if (on) return;
      on = true;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    },
    level(ratePerSecond, burst, throwBy) {
      rate = Math.max(0, ratePerSecond);
      thrown = throwBy > 0 ? throwBy : 1;
      // A burst is thrown over a beat, not one frame, so it fans out.
      for (let k = 0; k < burst; k += 1) fly(Math.random() * 140);
    },
    stop() {
      on = false;
      cancelAnimationFrame(frame);
    },
  };
}
