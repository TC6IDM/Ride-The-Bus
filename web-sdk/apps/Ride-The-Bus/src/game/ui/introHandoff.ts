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
 * chipForBet). So each chip in flight turns into its board chip on the way
 * down - the board's own chip laid over it and faded in across the flight -
 * rather than changing colour in one frame as it lands (the owner,
 * 2026-10-19).
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

export function flyIntroSquaresToBoard(): void {
  if (typeof document === 'undefined' || reducedMotion()) return;
  const from = [...document.querySelectorAll<HTMLElement>('.ss-step .choice-square')];
  const to = [...document.querySelectorAll<HTMLElement>('.choice-row:not(.trips-row) .choice-square')];
  if (from.length !== 4 || to.length !== 4) return;

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
    // A frame later: Continue adopts the intro's picks in the same click, so
    // the board's chips are not drawn yet when this measures.
    requestAnimationFrame(() => {
      const boardChips = [...target.querySelectorAll<HTMLElement>('.pick-chip')];
      chips.forEach((chip, at) => {
        const boardChip = boardChips[at];
        if (!boardChip || !chip.isConnected || boardChip.className === chip.className) return;
        const next = boardChip.cloneNode(true) as HTMLElement;
        next.style.animation = 'none';
        chip.after(next);
        next.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: FLY_MS * 0.7,
          delay: index * STAGGER_MS + FLY_MS * 0.1,
          easing: 'ease-in-out',
          fill: 'both',
        });
      });
    });
    document.body.appendChild(copy);

    // The board's square waits, hidden, for its copy to land on it.
    target.style.visibility = 'hidden';

    const flight = copy.animate(
      [
        { transform: 'none' },
        { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width}, ${b.height / a.height})` },
      ],
      { duration: FLY_MS, delay: index * STAGGER_MS, easing: EASE, fill: 'forwards' },
    );
    const land = () => {
      target.style.visibility = '';
      copy.remove();
    };
    flight.finished.then(land, land);
  });
}
