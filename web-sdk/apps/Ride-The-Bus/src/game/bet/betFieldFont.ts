/**
 * Fit the control bar's bet field to its box.
 *
 * The sibling of fitValue.ts and deliberately not the same function: this one
 * MEASURES ON A CANVAS rather than reading scrollWidth, because the bet field
 * is an <input> whose value the player is still typing and whose overflow the
 * browser reports differently from a static readout's.
 *
 * Takes the element and the text rather than reaching for `betRowEl` and
 * `betDisplay()` the way it did inside the component, so it can be called from
 * anywhere and read on its own.
 */

// Auto-fit the "$amount" font to its box so the whole number is always
// visible, even a long maximum bet in a narrow sidebar - the currency symbol
// and the number share one font-size (set on the row) and shrink together,
// down to a floor, only as far as needed to avoid clipping. Re-runs on the
// value changing and on the box resizing (responsive breakpoints / window).
const MAX_BET_FONT = 20;
const MIN_BET_FONT = 9;
export function fitBetFont(el: HTMLElement | undefined, text: string) {
  if (!el || typeof document === 'undefined') return;
  // Start from the breakpoint's CSS font size (reset the inline override
  // first so we read the base), capped at MAX, then shrink to fit the width.
  el.style.fontSize = '';
  const style = getComputedStyle(el);
  const avail = el.clientWidth - 4; // small safety margin
  if (avail <= 0) return;
  const maxSize = Math.min(MAX_BET_FONT, Math.round(parseFloat(style.fontSize) || MAX_BET_FONT));
  const canvas = (fitBetFont as any)._c ?? ((fitBetFont as any)._c = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  let size = maxSize;
  for (; size > MIN_BET_FONT; size -= 1) {
    ctx.font = `800 ${size}px ${style.fontFamily}`;
    if (ctx.measureText(text).width <= avail) break;
  }
  el.style.fontSize = `${size}px`;
}
