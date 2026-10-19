/**
 * WHERE A PICK'S CHIP LIES (the owner's pick E3 and its rules, 2026-10-17,
 * with the owner's notes of 2026-10-18). A pick sets a chip down on the section
 * chosen. It lies INSIDE the section and clear of the section's mark, set down
 * by hand: a little jitter and a spin each time. On "=" it lies partly on the
 * badge along the seam.
 *
 * WHERE THE PLAYER CLICKED (2026-10-18): a pick made with a pointer lands the
 * chip near the click, pulled into the room the rules allow - never onto the
 * mark, never off the section - so a chip goes roughly where the player put
 * it. A pick made any other way (the die, keys 1-4, a restore) is thrown by
 * hand as before.
 *
 * ONE SPOT PER PICK, SHARED. The intro's squares become the board's
 * (introHandoff.ts) and carry their picks, so a chip set down on the intro
 * must lie in the same place when its square lands on the board. Spots are
 * remembered per column and pick, here, and both read them.
 *
 * Fractions of the SEGMENT the chip is in (the half, third, quarter or badge),
 * x from its inline start so the same numbers serve Arabic; k is the chip's
 * width as a share of the whole square.
 */

export type ChipSpot = { x: number; y: number; k: number; spin: number };
export type ChipColumn = 'color' | 'hl' | 'io' | 'suit';
/** A click, as fractions of the segment clicked, x from its inline start. */
export type ChipClick = { x: number; y: number };

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/**
 * "=": partly on the badge, on the seam (E3's rule). Beside the badge on
 * Higher / Lower, under it on Inside / Outside - a little further out than
 * half-on since 2026-10-18 (the owner: "a bit more to the right" and "a bit
 * more lower"), so more of the chip shows and less of the badge is covered.
 */
export const EQUAL_SPOT: Record<'hl' | 'io', { x: number; y: number }> = {
  hl: { x: 1.18, y: 0.5 },
  io: { x: 0.5, y: 1.18 },
};

/**
 * The suit's quarters: the chip's default is the quarter's outer corner, and a
 * click may put it anywhere at least SUIT_CLEAR from the quarter's middle,
 * where its mark is. Outer edges may be overhung a little - the suit square
 * lets a chip sit over its border (choices.css) - so it is never cut off.
 */
const SUIT_CORNER: Record<string, [number, number]> = { heart: [0.2, 0.2], spade: [0.8, 0.2], club: [0.2, 0.8], diamond: [0.8, 0.8] };
export const SUIT_CLEAR = 0.34;

/** The spot, from a click if there was one, else thrown by hand. Pure. */
export function chipSpot(column: ChipColumn, pick: string, click: ChipClick | null, rand: () => number = Math.random): ChipSpot {
  const jitter = (amount: number) => (rand() - 0.5) * 2 * amount;
  const spin = Math.round(rand() * 90);
  const eitherSide = (near: number) => (rand() < 0.5 ? near : 1 - near);

  if (pick === 'equal' && (column === 'hl' || column === 'io')) return { ...EQUAL_SPOT[column], k: 0.26, spin };

  switch (column) {
    case 'color':
      // A half has no mark: anywhere in its middle, clear of the edges.
      return click
        ? { x: clamp(click.x, 0.34, 0.66), y: clamp(click.y, 0.24, 0.76), k: 0.3, spin }
        : { x: 0.5 + jitter(0.16), y: 0.5 + jitter(0.24), k: 0.3, spin };
    case 'hl': {
      // Either side of the triangle, nearer the outer edge than the seam; the
      // click picks the side.
      const base = pick === 'higher' ? 0.44 : 0.56;
      if (!click) return { x: eitherSide(0.18) + jitter(0.03), y: base + jitter(0.05), k: 0.28, spin };
      const x = click.x < 0.5 ? clamp(click.x, 0.14, 0.24) : clamp(click.x, 0.76, 0.86);
      return { x, y: clamp(click.y, base - 0.08, base + 0.08), k: 0.28, spin };
    }
    case 'io': {
      // Above or below the card mark, which runs across the half's middle; the
      // click picks which.
      if (!click) return { x: 0.5 + jitter(0.07), y: eitherSide(0.17) + jitter(0.03), k: 0.26, spin };
      const y = click.y < 0.5 ? clamp(click.y, 0.12, 0.22) : clamp(click.y, 0.78, 0.88);
      return { x: clamp(click.x, 0.36, 0.64), y, k: 0.26, spin };
    }
    case 'suit': {
      const corner = SUIT_CORNER[pick] ?? [0.2, 0.2];
      if (!click) return { x: corner[0] + jitter(0.03), y: corner[1] + jitter(0.03), k: 0.18, spin };
      let x = clamp(click.x, 0.12, 0.88);
      let y = clamp(click.y, 0.12, 0.88);
      // Pushed out from the mark in the middle, along the line to the click;
      // a click dead on the mark gives no line, so it goes to the corner.
      const dx = x - 0.5;
      const dy = y - 0.5;
      const r = Math.hypot(dx, dy);
      if (r < 0.01) return { x: corner[0], y: corner[1], k: 0.18, spin };
      if (r < SUIT_CLEAR) {
        x = 0.5 + (dx / r) * SUIT_CLEAR;
        y = 0.5 + (dy / r) * SUIT_CLEAR;
      }
      return { x, y, k: 0.18, spin };
    }
  }
}

/* ---- The shared memory -------------------------------------------------- */

const placed = new Map<string, ChipSpot>();
const key = (column: ChipColumn, pick: string) => `${column}:${pick}`;

/** A pointer pick: place the chip at the click and remember it. */
export function placeChip(column: ChipColumn, pick: string, click: ChipClick | null): ChipSpot {
  const spot = chipSpot(column, pick, click);
  placed.set(key(column, pick), spot);
  return spot;
}

/**
 * Where a pick's chip lies: where it was set down, or thrown by hand now and
 * remembered. Safe inside a $derived - the memory is a plain Map, not state.
 */
export function chipAt(column: ChipColumn, pick: string | null): ChipSpot | null {
  if (!pick) return null;
  return placed.get(key(column, pick)) ?? placeChip(column, pick, null);
}

/**
 * The click as fractions of the segment pressed, x from the inline start. Null
 * for a press that was not a pointer's (Enter or Space reports detail 0), so a
 * keyboard pick is thrown by hand.
 */
export function clickIn(event: MouseEvent): ChipClick | null {
  const el = event.currentTarget as HTMLElement | null;
  if (!el || event.detail === 0) return null;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const rtl = getComputedStyle(el).direction === 'rtl';
  return {
    x: clamp((rtl ? rect.right - event.clientX : event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}
