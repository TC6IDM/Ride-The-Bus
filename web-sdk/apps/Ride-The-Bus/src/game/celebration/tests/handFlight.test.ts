/**
 * The takeover's hand is dealt out of the board's slots and flies back into
 * them (handFlight.ts). The arithmetic is checked by applying the transform it
 * returns to the card's centre, the way the browser does: about the card's own
 * origin, below its centre, inside a fan that may be scaled.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { FAN_ORIGIN_Y, slotTransform, type Box } from '../handFlight.ts';

/** Where `transform` (about the card's origin) puts the card's centre, on screen. */
function landedCentre(transform: string, rest: Box, unit: number, height: number): Box {
  const [, tx, ty, s] = transform.match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/)!.map(Number);
  // In the card's own pixels, the centre sits (0, (0.5 - origin) * h) from the origin.
  const fromOrigin = (0.5 - FAN_ORIGIN_Y) * height;
  const dy = s! * fromOrigin + ty! - fromOrigin;
  return { cx: rest.cx + tx! * unit, cy: rest.cy + dy * unit, width: rest.width * s! };
}

describe('the hand flies between the board and the fan', () => {
  test('a card lands centred on its slot, at the slot’s width', () => {
    const cases: Array<[Box, Box, number, number]> = [
      [{ cx: 600, cy: 180, width: 81 }, { cx: 420, cy: 232, width: 97 }, 1, 114],
      // .wc-fan scaled 1.22 on a phone, and 0.74 on Popout S
      [{ cx: 195, cy: 210, width: 66 }, { cx: 64, cy: 233, width: 79.5 }, 1.22, 76],
      [{ cx: 200, cy: 60, width: 22 }, { cx: 150, cy: 70, width: 24 }, 0.74, 40],
    ];
    for (const [rest, slot, unit, height] of cases) {
      const landed = landedCentre(slotTransform(rest, slot, unit, height), rest, unit, height);
      assert.ok(Math.abs(landed.cx - slot.cx) < 0.05, `x ${landed.cx} vs ${slot.cx}`);
      assert.ok(Math.abs(landed.cy - slot.cy) < 0.05, `y ${landed.cy} vs ${slot.cy}`);
      assert.ok(Math.abs(landed.width - slot.width) < 0.05, `width ${landed.width} vs ${slot.width}`);
    }
  });

  test('the origin it assumes is the one the stylesheet sets', () => {
    const css = readFileSync(resolve(import.meta.dirname, '../../../styles/scene/win-celebration.css'), 'utf8');
    const rule = css.match(/\n\.wc-fan-card,\s*\.wc-fan-ticket \{[\s\S]*?\n\}/)![0];
    assert.match(rule, new RegExp(`transform-origin: 50% ${FAN_ORIGIN_Y * 100}%`));
  });

  test('the takeover tags each fan card with its board slot and flies it both ways', () => {
    const component = readFileSync(resolve(import.meta.dirname, '../../../components/board/WinCelebration.svelte'), 'utf8');
    assert.match(component, /class="wc-fan-card"[\s\S]*?data-slot=\{slot\.index\}/);
    assert.match(component, /flyHand\(fanEl, 'in'\)/);
    assert.match(component, /flyHand\(fanEl, 'out'\)[\s\S]*?props\.ondismiss\(\)/);
  });
});
