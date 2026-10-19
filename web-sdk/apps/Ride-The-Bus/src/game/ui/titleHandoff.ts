/**
 * THE NAME TRAVELS (the owner, 2026-10-19: the title "should move to that
 * position, not just teleport to it"). The loader, the intro and the board
 * draw one lockup - "Ride The Bus" over "by Takeover Casino" (CLAUDE.md, "One
 * wordmark, three screens") - in three places, and each handover used to cut
 * from one to the next. Now the name lifts off the screen that is leaving and
 * flies to where the next screen draws it, the way the intro's squares fly
 * down to the board's (introHandoff.ts).
 *
 * Two calls, because the loader leaves before the intro has mounted:
 *   liftTitle(parts)  - copies each part into a layer of its own at its place
 *                       on screen, styled from its computed values (the units
 *                       it is drawn in belong to the screen it leaves), and
 *                       hides the original.
 *   landTitle(parts)  - flies the held copies to these parts, which stay
 *                       hidden until their copy lands on them.
 * Paired by index: the name, then the credit line. Measured as TEXT (a Range),
 * not as boxes: a lockup's spans are as wide as their column on one screen and
 * shrink-wrapped on another, and the letters are what has to land.
 *
 * A copy nobody lands (the board's title is hidden on a short landscape
 * window, Popout S) fades where it is. Skipped under reduced motion: the
 * screens' own fades are the whole handover there.
 */
import { reducedMotion } from '../celebration/celebrationGestures';

/** The flight, a little longer than the squares' 560: the name travels furthest. */
const FLY_MS = 640;
/** tokens.css's --ease-in-out: something already on screen moving from A to B. */
const EASE = 'cubic-bezier(0.45, 0, 0.25, 1)';
/** How long a lifted name waits for a screen to land it before it fades. */
const WAIT_MS = 2500;

/** What the copy must carry: everything that draws the letters. */
const TYPE_PROPS = [
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-stretch',
  'font-variation-settings',
  'font-feature-settings',
  'font-variant-numeric',
  'letter-spacing',
  'word-spacing',
  'text-transform',
  'text-shadow',
  'color',
];

type Held = { copy: HTMLElement; text: DOMRect };
let held: Held[] = [];
let waiting: ReturnType<typeof setTimeout> | undefined;

/** The box the element's letters occupy. */
function textRect(el: HTMLElement): DOMRect {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rect = range.getBoundingClientRect();
  return rect.width ? rect : el.getBoundingClientRect();
}

/** How opaque the element is drawn, its ancestors included (the replay's lockup is dimmed). */
function shownOpacity(el: HTMLElement): number {
  let opacity = 1;
  for (let node: HTMLElement | null = el; node && node !== document.body; node = node.parentElement) {
    opacity *= Number(getComputedStyle(node).opacity) || 0;
  }
  return opacity;
}

function fadeAway(copy: HTMLElement): void {
  const done = () => copy.remove();
  copy.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: 'ease-out', fill: 'forwards' }).finished.then(done, done);
}

function dropHeld(): void {
  clearTimeout(waiting);
  held.forEach(({ copy }) => fadeAway(copy));
  held = [];
}

export function liftTitle(parts: Array<HTMLElement | null | undefined>): void {
  if (typeof document === 'undefined' || reducedMotion()) return;
  dropHeld();
  for (const el of parts) {
    if (!el) continue;
    const text = textRect(el);
    if (!text.width) continue;
    const style = getComputedStyle(el);
    const copy = document.createElement('span');
    copy.textContent = el.textContent;
    copy.setAttribute('aria-hidden', 'true');
    for (const prop of TYPE_PROPS) copy.style.setProperty(prop, style.getPropertyValue(prop));
    Object.assign(copy.style, {
      position: 'fixed',
      left: `${text.left}px`,
      top: `${text.top}px`,
      height: `${text.height}px`,
      lineHeight: `${text.height}px`,
      margin: '0',
      padding: '0',
      whiteSpace: 'nowrap',
      zIndex: 'var(--z-handoff)',
      pointerEvents: 'none',
      transformOrigin: '0 0',
    });
    document.body.appendChild(copy);
    el.style.visibility = 'hidden';
    held.push({ copy, text });
  }
  waiting = setTimeout(dropHeld, WAIT_MS);
}

export function landTitle(parts: Array<HTMLElement | null | undefined>): void {
  if (!held.length) return;
  clearTimeout(waiting);
  const flying = held;
  held = [];
  flying.forEach(({ copy, text: a }, index) => {
    const target = parts[index];
    // Its own entrance would move it while the copy flies at where it rests.
    if (target) target.style.animation = 'none';
    const b = target ? textRect(target) : null;
    if (!target || !b || !b.width || target.getClientRects().length === 0) {
      fadeAway(copy);
      return;
    }
    target.style.visibility = 'hidden';
    // Matched on width, which is what the letters set; centred on height, so
    // a lockup set to a different line height still lands on its middle.
    const scale = b.width / a.width;
    const dy = b.top + b.height / 2 - (a.top + (a.height * scale) / 2);
    const flight = copy.animate(
      [
        { transform: 'none', opacity: 1 },
        { transform: `translate(${b.left - a.left}px, ${dy}px) scale(${scale})`, opacity: shownOpacity(target) },
      ],
      { duration: FLY_MS, easing: EASE, fill: 'forwards' },
    );
    const land = () => {
      target.style.visibility = '';
      copy.remove();
    };
    flight.finished.then(land, land);
  });
}
