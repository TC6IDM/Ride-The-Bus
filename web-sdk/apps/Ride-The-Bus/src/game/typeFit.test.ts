/**
 * The type-fitting estimate, checked against real measurements.
 *
 * Split out of betChips.test.ts when labelEms moved to its own module: it is
 * used by the bet chips AND by the win takeover's amount now, and neither owns
 * it.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { labelEms } from './typeFit.ts';
import { splitChipLabel } from './betChips.ts';

/**
 * Fitting the figure to the disc.
 *
 * MEASURED, not assumed. Every number in REAL_EMS below is the width of that
 * string in the game's own face at the weight the chip uses, taken off a probe
 * span in the running page (canvas 2D cannot carry font-variant-numeric, so it
 * gives the wrong answer here). They are recorded so a future change to the
 * face or the weight has something to fail against.
 */
describe('the figure is fitted to the disc', () => {
  /** string -> em width, Poppins 800, letter-spacing -0.01em. */
  const REAL_EMS: Record<string, number> = {
    $1: 1.048,
    $25: 1.885,
    $100: 2.362,
    '$1,000': 3.332,
    '12,500': 3.238,
    '20,000': 3.51,
    '15,000': 3.267,
    '0.10': 2.002,
    NOK: 2.278,
    SC: 1.378,
    '¥1,000': 3.372,
    '1 234,50': 4.073,
  };

  /**
   * The estimate must never come in UNDER the real width, or the figure is
   * sized to a space it does not fit in and spills over the chip's spot ring.
   */
  test('the estimate is never smaller than the real width', () => {
    for (const [text, real] of Object.entries(REAL_EMS)) {
      assert.ok(
        labelEms(text) >= real,
        `"${text}": estimated ${labelEms(text)} em but it really prints ${real} em - it will overflow`,
      );
    }
  });

  /**
   * ...and not so far over that the type is needlessly small. A routine that
   * returned 99 for everything would pass the test above and print nothing
   * legible.
   *
   * 20% rather than 15% because of the capitals. This face's caps run 0.62
   * ("S") to 0.79 ("O") and EM_CAP is one number at the top of that range, so
   * an all-narrow code like "SC" comes out 16% heavy. That costs nothing in
   * practice: capitals only ever appear in a currency CODE, which takes its own
   * line under a cap of its own, and that cap is what binds on a short one.
   */
  test('and never more than 20% over', () => {
    for (const [text, real] of Object.entries(REAL_EMS)) {
      const over = labelEms(text) / real;
      assert.ok(
        over <= 1.2,
        `"${text}": estimated ${labelEms(text)} em against a real ${real} em (${Math.round((over - 1) * 100)}% heavy)`,
      );
    }
  });

  /**
   * The labels that actually BIND stay tight.
   *
   * Below about 2 em the disc's own cap decides the size, not the fit, so slack
   * in the estimate cannot be seen there - "$25" is 12% heavy and still prints
   * at the cap. From 2 em up the fit is what sets the figure, and that is where
   * a heavy estimate costs real legibility.
   */
  test('every label wide enough for the fit to bind is within 10%', () => {
    const binding = Object.entries(REAL_EMS).filter(([, real]) => real >= 2);
    assert.ok(binding.length >= 8, 'expected the sample to cover the binding range');
    for (const [text, real] of binding) {
      const over = labelEms(text) / real;
      assert.ok(over <= 1.1, `"${text}" is ${Math.round((over - 1) * 100)}% heavy`);
    }
  });

  /**
   * The reason this is a weighted table and not a character count. Poppins
   * ships no `tnum` feature, so the tabular-nums on the value is a no-op and
   * the figures stay proportional: "1" measures 0.387em against "0" at 0.657em.
   * Count characters instead and "$1,111" and "$4,444" get the same size, and
   * one of them runs off the face.
   */
  test('a 1 is not the same width as any other digit', () => {
    assert.ok(
      labelEms('1111') < labelEms('4444'),
      'the estimate treats every digit alike - see the note on EM_NARROW',
    );
  });

  test('adding a character never makes a label narrower', () => {
    let previous = 0;
    for (const text of ['1', '10', '100', '1,000', '$1,000', '$10,000']) {
      const ems = labelEms(text);
      assert.ok(ems > previous, `"${text}" (${ems}) is not wider than the label before it (${previous})`);
      previous = ems;
    }
  });

  /** The CSS divides by this. A zero would resolve font-size to infinity. */
  test('never returns zero, whatever it is handed', () => {
    for (const text of ['', ' ', '—', ' ']) {
      assert.ok(labelEms(text) >= 0.5, `"${text}" gave ${labelEms(text)}`);
    }
  });

  /** Every label the split routine can produce must be fittable. */
  test('every chip label the splitter produces has a usable width', () => {
    for (const formatted of ['$1.00', 'NOK 12,500.00', '¥1,000', '10.00 SC', '1 234,50 kr', 'KWD 1.000']) {
      const { currency, amount } = splitChipLabel(formatted);
      assert.ok(labelEms(amount) >= 0.5, `${formatted}: amount`);
      assert.ok(labelEms(currency + amount) >= 0.5, `${formatted}: inline`);
    }
  });
});
