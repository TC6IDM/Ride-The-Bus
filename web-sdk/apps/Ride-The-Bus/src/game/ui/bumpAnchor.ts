/**
 * A BUMP: a small panel grown out of the control that opened it, with a
 * pointer at that control (the owner's picks T1 / S1 / B1, 2026-10-17).
 *
 * A menu that holds one control - turbo's slider, the two sound levels, the
 * bet chips - used to open as a dialog in the middle of the screen, the same
 * shape as How to Play, so the slider sat a long way from the button that
 * opened it and the board went dark behind one number. A bump keeps the board
 * in view and says where it came from: it sits over its control and grows out
 * of it (origin-aware), and its pointer stays over the control even when the
 * bump has to shift to stay on screen.
 *
 * The placement is a pure function so it can be tested without a browser; the
 * action below only measures and applies it.
 */

export type Rect = { left: number; top: number; width: number; height: number };

export type BumpPlacement = {
  /** Panel's left edge and top edge, in viewport px. */
  left: number;
  top: number;
  /** Where the pointer sits, from the panel's left edge. */
  pointerX: number;
  /** The tallest the panel may be before it scrolls. */
  maxHeight: number;
};

/**
 * Over the control, centred on it, kept `margin` inside the viewport.
 * `gap` is the space between the control's top and the panel's bottom; the
 * pointer lives in it. The pointer is kept clear of the panel's rounded
 * corners (`cornerClear`), which is the only place it may part from the
 * control's centre - at the very edge of the screen.
 */
export function placeBump(
  control: Rect,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  { margin = 10, gap = 12, cornerClear = 18 } = {},
): BumpPlacement {
  const width = Math.min(panel.width, viewport.width - margin * 2);
  const centre = control.left + control.width / 2;
  const left = Math.max(margin, Math.min(centre - width / 2, viewport.width - margin - width));
  const maxHeight = Math.max(0, control.top - gap - margin);
  const height = Math.min(panel.height, maxHeight);
  const top = control.top - gap - height;
  const pointerX = Math.max(cornerClear, Math.min(centre - left, width - cornerClear));
  return { left, top, pointerX, maxHeight };
}

/**
 * Svelte action: place `node` as a bump over the first element matching
 * `selector`, and keep it there through a resize, a rotation or the panel's
 * own content changing size (the chip tray in another currency). The bar does
 * not move under an open panel, so the control is measured once per placement.
 */
export function bump(node: HTMLElement, selector: string) {
  let anchor = selector;
  const place = () => {
    const control = document.querySelector<HTMLElement>(anchor);
    if (!control) return;
    const r = control.getBoundingClientRect();
    // Let the panel take its natural height before measuring it.
    node.style.maxHeight = '';
    const p = placeBump(
      { left: r.left, top: r.top, width: r.width, height: r.height },
      { width: node.offsetWidth, height: node.scrollHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    node.style.left = `${p.left}px`;
    node.style.top = `${p.top}px`;
    node.style.maxHeight = `${p.maxHeight}px`;
    node.style.setProperty('--bump-pointer-x', `${p.pointerX}px`);
  };
  place();
  const resize = new ResizeObserver(place);
  resize.observe(node);
  window.addEventListener('resize', place);
  return {
    update(next: string) {
      anchor = next;
      place();
    },
    destroy() {
      resize.disconnect();
      window.removeEventListener('resize', place);
    },
  };
}
