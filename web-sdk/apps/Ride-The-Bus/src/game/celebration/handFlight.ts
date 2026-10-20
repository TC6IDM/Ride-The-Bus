/**
 * THE HAND COMES OFF THE BOARD AND GOES BACK TO IT (the owner's pick W1,
 * 2026-10-18). The takeover's fan is the round's own cards brought forward, so
 * they are dealt OUT of the board's card slots when it opens and fly back INTO
 * them on Continue. Before this the fan rose out of nowhere and Continue removed
 * the whole screen in one frame: the cards vanished rather than going home, and
 * the board's numbers snapped back in under them.
 *
 * A FLIP across two trees, like introHandoff.ts: the board's row is still laid
 * out under the takeover (`.takeover-open .card-row` only hides it), so its
 * slots can be measured while the fan is up. Each fan card animates between its
 * fanned pose and the transform that lays it, square, over its slot.
 *
 * The arithmetic is here and pure (slotTransform), because it is the part that
 * is easy to get subtly wrong: the fan card turns about a point BELOW its own
 * centre (transform-origin 50% 130%), and it sits inside .wc-fan, which some
 * sizes scale - so a screen distance is not a transform distance.
 */
import { reducedMotion } from './celebrationGestures.ts';

/** A box measured on screen: its centre and its width, in CSS pixels. */
export type Box = { cx: number; cy: number; width: number };

/** .wc-fan-card's transform-origin, as a fraction of its height. */
export const FAN_ORIGIN_Y = 1.3;

/** The flight, and the beat between one card leaving and the next. */
export const HAND_IN_MS = 560;
export const HAND_OUT_MS = 460;
export const HAND_STAGGER_MS = 55;
/** tokens.css's --ease-in-out: things already on screen moving from A to B. */
export const HAND_EASE = 'cubic-bezier(0.45, 0, 0.25, 1)';

/**
 * The transform, in the fan card's own coordinates, that draws it unturned and
 * centred on `slot` at the slot's width.
 *
 *   rest   the card's box with its transform taken off, on screen
 *   unit   screen pixels per transform pixel (rest.width / offsetWidth): the
 *          scale .wc-fan puts on everything inside it
 *   height the card's untransformed height, in its own pixels
 *
 * `translate(t) scale(s)` about origin O maps the card's centre c to
 * O + s(c - O) + t, so landing c on the slot needs
 * t = (slot - rest) / unit + (1 - s)(c - O), where c - O is
 * (0, (0.5 - FAN_ORIGIN_Y) * height).
 */
export function slotTransform(rest: Box, slot: Box, unit: number, height: number): string {
  const s = slot.width / rest.width;
  const tx = (slot.cx - rest.cx) / unit;
  const ty = (slot.cy - rest.cy) / unit + (1 - s) * (0.5 - FAN_ORIGIN_Y) * height;
  return `translate(${round(tx)}px, ${round(ty)}px) scale(${round(s, 4)})`;
}

const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

const centre = (rect: DOMRect): Box => ({ cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, width: rect.width });

/**
 * Fly the hand between the board and the fan. 'in' starts each card on its
 * slot and lets it settle into the fan (the fan pose is the stylesheet's, so a
 * tier's re-spread is never fought); 'out' sends it from wherever it is back to
 * its slot and holds it there until the takeover unmounts.
 *
 * Resolves when the last card lands. Does nothing, and resolves at once, under
 * reduced motion or when either side is not on screen (a slot the board never
 * drew, a zero-size fan) - the takeover then simply appears and leaves.
 */
export function flyHand(fanEl: HTMLElement | undefined, direction: 'in' | 'out'): Promise<void> {
  if (!fanEl || typeof document === 'undefined' || reducedMotion()) return Promise.resolve();
  const cards = [...fanEl.querySelectorAll<HTMLElement>('.wc-fan-card')];
  const slots = [...document.querySelectorAll<HTMLElement>('.card-row .card-slot .card-block')];
  const flights = cards.map((card, i) => {
    const slotEl = slots[Number(card.dataset.slot)];
    if (!slotEl || !card.offsetWidth) return null;
    // A hop or a breath still running would be measured into the pose.
    if (direction === 'out') card.getAnimations().forEach((animation) => animation.cancel());
    const inline = card.style.transform;
    card.style.transform = 'none';
    const rest = centre(card.getBoundingClientRect());
    card.style.transform = inline;
    const slot = centre(slotEl.getBoundingClientRect());
    if (!rest.width || !slot.width) return null;
    const onSlot = slotTransform(rest, slot, rest.width / card.offsetWidth, card.offsetHeight);
    return direction === 'in'
      ? card.animate([{ transform: onSlot, offset: 0 }], {
          duration: HAND_IN_MS,
          delay: i * HAND_STAGGER_MS,
          easing: HAND_EASE,
          fill: 'backwards',
        })
      : card.animate([{ transform: onSlot, offset: 1 }], {
          duration: HAND_OUT_MS,
          delay: (cards.length - 1 - i) * (HAND_STAGGER_MS * 0.7),
          easing: HAND_EASE,
          fill: 'forwards',
        });
  });
  return Promise.all(flights.map((flight) => flight?.finished.catch(() => undefined))).then(() => undefined);
}
