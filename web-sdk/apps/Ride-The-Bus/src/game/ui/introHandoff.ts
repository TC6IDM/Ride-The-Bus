/**
 * THE INTRO BECOMES THE BOARD (the owner's pick C1, as they changed it,
 * 2026-10-17): the intro's four panels each teach one guess with a working
 * square, and on Continue those four squares fly down and BECOME the board's
 * guess squares - the controls the panels taught are the controls the player
 * then uses. It replaced a hard cut, the overlay gone in one frame and the
 * board simply there.
 *
 * A FLIP across two trees. Continue unmounts the intro in the same frame it
 * is pressed, and the board is already built underneath (inert behind it), so
 * this measures both sets of squares first, lifts a copy of each intro square
 * into its own layer above the intro, and flies the copies to the board's
 * squares while the intro fades. Each board square stays hidden until its copy
 * lands on it, then takes over and the copy goes. The copies fly WITH their
 * picks and chips (the owner's call, 2026-10-18): the intro's picks are the
 * board's now (IntroPanels' continueWithPicks), and the chips lie in the same
 * spots on both (chipSpot.ts), so the square that lands is the square that
 * left. They flew unpicked while the intro's picks were only a demo.
 *
 * The intro's chips are the house's red; the board's are the bet's (betChips.ts
 * chipForBet). The chips ride down red WITH their squares, and once every
 * square has landed they TURN OVER, one at a time: each lifts off its square,
 * rises a little toward the eye as it tips over edge-on, and comes down
 * showing its other side - which is the bet's chip (the owner, 2026-10-23:
 * "the chips one by one do a flipping animation, where they go up in the air
 * a bit and turn over and show their bottom side, which turns out to actually
 * be the user's chip colour"), SIDEWAYS - round its upright axis, the way a
 * coin turns on its edge, not end over end (the owner, the same day). It replaced a crossfade across the flight
 * (2026-10-19), which itself replaced a colour change in one frame on landing.
 *
 * Skipped - the intro just fades - under reduced motion, on Three of a Kind
 * (no four squares to land on), or if either set is not on screen.
 */
import { reducedMotion } from '../celebration/celebrationGestures';

/** The flight, and the beat between one square leaving and the next. */
const FLY_MS = 560;
const STAGGER_MS = 55;
/** tokens.css's --ease-in-out: things already on screen moving from A to B. */
const EASE = 'cubic-bezier(0.45, 0, 0.25, 1)';
/** The chips' turn: a beat after the last square lands, then each chip's
 *  half-turns (up and over to edge-on, then over and down), one chip starting
 *  this long after the one before. */
export const FLIP_AFTER_LAND_MS = 160;
export const FLIP_HALF_MS = 230;
export const FLIP_STAGGER_MS = 170;
/** How high a chip rises as it turns over, as a share of its own width, and
 *  how much nearer it comes. */
const FLIP_RISE = 0.7;
const FLIP_GROW = 1.18;

export function flyIntroSquaresToBoard(): void {
  if (typeof document === 'undefined' || reducedMotion()) return;
  const from = [...document.querySelectorAll<HTMLElement>('.ss-step .choice-square')];
  const to = [...document.querySelectorAll<HTMLElement>('.choice-row:not(.trips-row) .choice-square')];
  if (from.length !== 4 || to.length !== 4) return;

  /** Each square's copy, its red chips, and the board square it becomes. */
  const flown: { copy: HTMLElement; target: HTMLElement; chips: HTMLElement[] }[] = [];
  const landings: Promise<unknown>[] = [];

  from.forEach((source, index) => {
    const target = to[index]!;
    const a = source.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    if (!a.width || !b.width) return;

    const copy = source.cloneNode(true) as HTMLElement;
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    // The units the square is drawn in come from its ancestors on the intro,
    // which the copy leaves behind: carry the measured ones with it.
    const sourceStyle = getComputedStyle(source);
    const badge = source.querySelector<HTMLElement>('.equal-btn');
    Object.assign(copy.style, {
      position: 'fixed',
      left: `${a.left}px`,
      top: `${a.top}px`,
      width: `${a.width}px`,
      height: `${a.height}px`,
      margin: '0',
      zIndex: 'var(--z-handoff)',
      pointerEvents: 'none',
      transformOrigin: '0 0',
      boxShadow: sourceStyle.boxShadow,
    });
    copy.style.setProperty('--choice-size', `${a.width}px`);
    // The marks' sizes too: the suit square's pips shrank to dots in flight
    // without --quad-fs, which the intro sets on an ancestor.
    for (const unit of ['--ui', '--choice-fs', '--quad-fs']) {
      const value = sourceStyle.getPropertyValue(unit);
      if (value) copy.style.setProperty(unit, value);
    }
    if (badge) copy.style.setProperty('--equal-size', `${badge.getBoundingClientRect().width}px`);
    // The copy is a new element, so its chips would replay their drop: still them.
    const chips = [...copy.querySelectorAll<HTMLElement>('.pick-chip')];
    chips.forEach((chip) => (chip.style.animation = 'none'));
    document.body.appendChild(copy);

    // The board's square waits, hidden, for its copy - and its chips' turn.
    target.style.visibility = 'hidden';

    const flight = copy.animate(
      [
        { transform: 'none' },
        { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width}, ${b.height / a.height})` },
      ],
      { duration: FLY_MS, delay: index * STAGGER_MS, easing: EASE, fill: 'forwards' },
    );
    flown.push({ copy, target, chips });
    landings.push(flight.finished.catch(() => undefined));
  });

  // Every square down: now the chips turn over, one after another.
  void Promise.all(landings).then(() => turnTheChips(flown));
}

/**
 * The chips' turn. For each red chip on a landed copy: it rises and tips over
 * to edge-on; at that moment the board's own chip (the bet's colour, cloned
 * into the copy at the same spot) takes its place edge-on, and turns the rest
 * of the way over as it comes back down. When the last one is down, every
 * board square takes over from its copy - the same chips, now its own.
 */
function turnTheChips(flown: { copy: HTMLElement; target: HTMLElement; chips: HTMLElement[] }[]): void {
  const done: Promise<unknown>[] = [];
  let order = 0;
  for (const { target, chips } of flown) {
    const boardChips = [...target.querySelectorAll<HTMLElement>('.pick-chip')];
    chips.forEach((chip, at) => {
      const boardChip = boardChips[at];
      if (!boardChip || !chip.isConnected) return;
      const next = boardChip.cloneNode(true) as HTMLElement;
      next.style.animation = 'none';
      next.style.visibility = 'hidden';
      chip.after(next);
      const delay = FLIP_AFTER_LAND_MS + order++ * FLIP_STAGGER_MS;
      const up = `translateY(${-FLIP_RISE * 100}%) scale(${FLIP_GROW})`;
      // Up and over to edge-on: the red side turning away.
      const away = chip.animate(
        [
          { transform: 'perspective(40em) translateY(0) rotateY(0deg) scale(1)' },
          { transform: `perspective(40em) ${up} rotateY(90deg)` },
        ],
        { duration: FLIP_HALF_MS, delay, easing: 'cubic-bezier(0.3, 0, 0.6, 1)', fill: 'forwards' },
      );
      // Over and down: the other side - the bet's chip - turning toward the
      // eye, landing with a small settle.
      const back = next.animate(
        [
          { transform: `perspective(40em) ${up} rotateY(-90deg)`, visibility: 'visible' },
          { transform: 'perspective(40em) translateY(4%) rotateY(0deg) scale(1)', visibility: 'visible', offset: 0.82 },
          { transform: 'perspective(40em) translateY(0) rotateY(0deg) scale(1)', visibility: 'visible' },
        ],
        { duration: FLIP_HALF_MS * 1.3, delay: delay + FLIP_HALF_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
      );
      away.finished.then(() => (chip.style.visibility = 'hidden'), () => undefined);
      done.push(back.finished.catch(() => undefined));
    });
  }
  const land = () => {
    for (const { copy, target } of flown) {
      target.style.visibility = '';
      copy.remove();
    }
  };
  void Promise.all(done).then(land, land);
}
