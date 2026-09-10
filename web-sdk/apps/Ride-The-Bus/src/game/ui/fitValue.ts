/**
 * Fit a readout's type to its own box.
 *
 * Lifted out of Game.svelte unchanged. It closes over nothing in the
 * component - it measures the node it is handed and writes a font-size back -
 * so it was only ever in there because that is where it was written.
 *
 * The Svelte action is exported alongside the measurement because they are one
 * idea, and the action's three triggers are the whole argument for it: see the
 * note on fitValue itself. `labelEms` in typeFit.ts is the other half of this
 * problem - an ESTIMATE from a string, for the places that cannot measure.
 */

/**
 * Shrink an element's type until its content fits its own box.
 *
 * WHY. The control bar's three readouts - balance, last win, bet - reserve
 * fixed widths, and control-bar.css records what they were measured from:
 * "$99,999,999.00", "$5,000,000.00", "$1,000,000.00". Every one of those is a
 * USD assumption, and the RGS supports currencies whose units are worth a
 * thousandth as much. Measured in the running game at a 2,000,000 NGN cap,
 * the settled figure is "NGN 11,461,200,000.00" - which wanted 152px of a
 * 119px box on Mobile L and simply spilled, and on Laptop and Popout L
 * shoved the whole bar onto a second row.
 *
 * Neither a wider reservation nor a smaller constant can fix that: there is
 * no fixed width that is right for both "$1.00" and a twelve-figure naira
 * amount. The type has to give.
 *
 * MEASURES THE REAL BOX rather than estimating from the string, unlike the
 * bet chips and the win amount. Those hold one run of text; a readout can
 * hold a value AND an inline multiplier chip at a different size, and
 * summing two estimates at two scales is a ratio nobody will maintain.
 * scrollWidth against clientWidth is exact and composes for free.
 *
 * The caller must keep the box from growing - see the max-width beside each
 * reservation in control-bar.css. A flex child that can widen will widen,
 * and then there is no overflow to detect and the bar wraps instead.
 */
/**
 * The floor is RELATIVE, not an absolute pixel count.
 *
 * An absolute floor was tried at 9px and is wrong for this layout: every size
 * in the bar is a multiple of --ui-bar, and at Popout S the base readout is
 * 5.9px, so a 9px floor sat ABOVE the unfitted size and nothing could shrink
 * at all - the one viewport that most needed the fit was the one it refused
 * to touch. It also missed Mobile S by a tenth of a pixel.
 *
 * 0.55 keeps the readout in proportion with the caption above it and the
 * controls beside it at every viewport, which is the invariant this bar
 * actually has. On desktop that bottoms out around 9px, and only for a
 * currency whose settled figure runs to twelve figures.
 *
 * Shrinking rather than abbreviating is deliberate: "NGN 11.46B" would fit
 * easily, and Stake's checklist asks for final win amounts to be clearly
 * shown. An exact figure in small type is a figure; a rounded one is not.
 */
const FIT_FLOOR_RATIO = 0.55;
export function fitToBox(el: HTMLElement) {
  if (typeof document === 'undefined') return;
  // Reset first: the previous fit must not be the baseline for this one, or
  // the type ratchets down and never comes back when the value shortens.
  el.style.fontSize = '';
  if (el.scrollWidth <= el.clientWidth + 0.5) return;
  const base = parseFloat(getComputedStyle(el).fontSize) || 0;
  if (!base) return;
  const floor = base * FIT_FLOOR_RATIO;
  // Proportional steps, not fixed half-pixels: 0.5px is a 3% step on desktop
  // and an 8% step at Popout S, so a fixed step overshoots on exactly the
  // viewport with the least room to give.
  const step = Math.max(base * 0.02, 0.1);
  let size = base;
  while (size > floor && el.scrollWidth > el.clientWidth + 0.5) {
    size -= step;
    el.style.fontSize = `${size}px`;
  }
}

/**
 * Svelte action wrapper. `deps` is read so the action re-runs whenever the
 * value it prints changes; the ResizeObserver covers the box changing under
 * a fixed value (a breakpoint, a rotation).
 */
export function fitValue(node: HTMLElement, _deps: unknown) {
  const run = () => fitToBox(node);
  run();
  // THREE triggers, and the MutationObserver is the one that matters.
  //
  // The action's own `update` was the only trigger at first and the fit
  // simply never re-ran: the readout kept its mount-time size, and a settled
  // figure long enough to overflow painted straight over the MODE and info
  // buttons beside it. Rather than depend on when a framework chooses to call
  // an action back, watch the DOM: any text change under this node re-fits,
  // whatever caused it.
  //
  // Watching characterData and childList only - NOT attributes - so the
  // style.fontSize this writes cannot re-trigger it into a loop.
  const mo =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver(run)
      : null;
  mo?.observe(node, { characterData: true, childList: true, subtree: true });
  // The box changing under a fixed value: a breakpoint, a rotation, the bar
  // re-flowing onto another row.
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(run) : null;
  ro?.observe(node);
  return {
    update() { run(); },
    destroy() { mo?.disconnect(); ro?.disconnect(); },
  };
}
