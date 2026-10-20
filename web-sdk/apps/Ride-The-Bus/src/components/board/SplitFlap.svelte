<!-- A figure on a split-flap board, like a station's departures display: each
     character on its own flap, and a flap that changes flips (the owner's pick
     RW1, 2026-10-17). The running total under the cards.

     KEYED FROM THE RIGHT, so the units stay the units as a total grows from
     $9.90 to $19.80: only the flaps whose character changed flip, and a new
     digit arriving on the left is a new flap dropping in. Each flap is
     {#key}ed on its character, which is what replays its flip.

     PACED BY THE CARD: a flip takes half of --flip-dur, the card's own turn,
     so turbo shortens it with everything else and a slam (0s) puts the figure
     down at once. Reduced motion: no flip.

     FITTED, NOT CLIPPED. A long currency - TZS, UGX, XOF run to 24 characters -
     cannot have full-size flaps, so the flap width is the smaller of the
     parent's --flap-base and its --flap-room shared across the characters (a
     separator counts half, a space less). The ROW keeps the full flap height
     whatever the width, so a total growing a digit never moves the board
     (boardStill.test.ts's rule).

     Colour is the parent's: the digits are currentColor, so the bar's own
     states (win green, the spent ink of a bust, "At stake") carry over. The
     plain figure is there for a screen reader; the flaps are drawn for the eye.
     Styles live here (a parent's sheet never reaches a child's elements); the
     parent hands in --flap-base and --flap-room. -->
<script lang="ts">
  let { text }: { text: string } = $props();

  /** A grouping or decimal mark: a narrower flap. */
  const isMark = (c: string) => /^[.,'’·]$/.test(c);
  /** Any space, including the no-break and narrow no-break spaces Intl prints: a gap, not a flap. */
  const isGap = (c: string) => /^\s$/u.test(c);

  const cells = $derived.by(() => {
    const chars = Array.from(text);
    return chars.map((c, i) => ({ c, key: chars.length - i, kind: isGap(c) ? 'gap' : isMark(c) ? 'mark' : 'char' }));
  });
  /** The row's width in flaps, a mark counting half and a gap less. */
  const span = $derived(cells.reduce((sum, cell) => sum + (cell.kind === 'char' ? 1 : cell.kind === 'mark' ? 0.5 : 0.35), 0));
</script>

<span class="flaps" style={`--span: ${Math.max(span, 1)}`}>
  <span class="flaps-text">{text}</span>
  <span class="flaps-row" aria-hidden="true">
    {#each cells as cell (cell.key)}
      {#if cell.kind === 'gap'}
        <span class="flap-gap"></span>
      {:else}
        <span class="flap" class:is-mark={cell.kind === 'mark'}>
          {#key cell.c}<span class="flap-ch">{cell.c}</span>{/key}
        </span>
      {/if}
    {/each}
  </span>
</span>

<style>
  .flaps {
    /* One flap's width: full size, or a share of the room when the figure is long. */
    --cw: min(var(--flap-base, 22px), calc(var(--flap-room, 300px) / var(--span)));
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* The full flap height, always - see the note above. */
    height: calc(var(--flap-base, 22px) * 1.75);
  }

  .flaps-text {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* The board's well: the flaps are set into it. */
  .flaps-row {
    display: inline-flex;
    gap: calc(var(--cw) * 0.12);
    padding: calc(var(--cw) * 0.16);
    border-radius: calc(var(--cw) * 0.3);
    background: var(--flap-well);
    box-shadow:
      inset 0 calc(var(--cw) * 0.08) calc(var(--cw) * 0.25) rgba(var(--shadow-rgb), 0.9),
      0 1px 0 rgba(var(--ink-rgb), 0.12);
    perspective: calc(var(--cw) * 14);
  }

  /* A flap: two halves of dark stock with the hinge between them, the
     character printed across both. */
  .flap {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--cw);
    height: calc(var(--cw) * 1.42);
    border-radius: calc(var(--cw) * 0.16);
    overflow: hidden;
    background: linear-gradient(180deg, var(--flap-top) 0 49%, var(--flap-hinge) 49% 51%, var(--flap-bottom) 51%);
    font-family: var(--font-display);
    font-weight: 900;
    font-size: calc(var(--cw) * 1.08);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .flap.is-mark {
    width: calc(var(--cw) * 0.5);
  }

  .flap-gap {
    width: calc(var(--cw) * 0.35);
  }

  /* The flip: the character falls in from above the hinge, dimmed as it
     turns and lit as it lands. Half the card's turn (--flip-dur). */
  .flap-ch {
    display: block;
    transform-origin: 50% 50%;
    backface-visibility: hidden;
    animation: flap-down calc(var(--flip-dur, 0.5s) * 0.52) var(--ease-in-out) both;
  }

  @keyframes flap-down {
    from {
      transform: rotateX(90deg);
      filter: brightness(0.55);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .flap-ch {
      animation: none;
    }
  }
</style>
