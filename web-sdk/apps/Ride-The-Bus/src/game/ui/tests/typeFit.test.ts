/**
 * The type-fitting estimate, checked against real measurements.
 *
 * Split out of betChips.test.ts when labelEms moved to its own module: it is
 * used by the bet chips AND by the win takeover's amount now, and neither owns
 * it.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { labelEms } from '../typeFit.ts';
import { splitChipLabel } from '../../bet/betChips.ts';

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
  /**
   * string -> em width, Barlow 800, `tnum`, letter-spacing -0.01em.
   *
   * Summed from the shipped file's advance widths with fontTools (tabular
   * digits, no kerning - kerning only ever makes a run narrower, so a table
   * without it is the conservative one for the "never smaller" check below).
   * The Poppins table this replaces was measured off a probe span in the page;
   * the three "x,000" strings differed there because Poppins' "2", "5" and "0"
   * are different widths, and are identical here because tabular digits are.
   * The two longest are here because Barlow's figures are narrow enough that
   * only the long labels reach the range where the fit, not the disc's cap,
   * decides the size.
   */
  const REAL_EMS: Record<string, number> = {
    $1: 1.107,
    $25: 1.648,
    $100: 2.189,
    '$1,000': 2.985,
    '12,500': 2.96,
    '20,000': 2.96,
    '15,000': 2.96,
    '0.10': 1.88,
    NOK: 1.884,
    SC: 1.188,
    '¥1,000': 3.094,
    '1 234,50': 3.691,
    '$10,000': 3.526,
    '12,500,000': 4.838,
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
   * 20% rather than 15% because of the capitals. This face's common caps run
   * 0.56 ("F") to 0.69 ("A") and EM_CAP is one number at the top of that
   * range, so an all-narrow code like "SC" comes out 18% heavy. That costs
   * nothing in practice: capitals only ever appear in a currency CODE, which
   * takes its own line under a cap of its own, and that cap is what binds on a
   * short one.
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
   * Every digit costs the same. The chip value carries
   * `font-variant-numeric: tabular-nums`, and the body face ships `tnum`, so
   * "$1,111" and "$4,444" really do print the same width - an estimate that
   * still knew a narrow "1" (as it had to under Poppins, whose figures were
   * proportional because it shipped no tnum) would undersize one of them.
   */
  test('every digit is the same width as every other', () => {
    assert.equal(labelEms('1111'), labelEms('4444'));
    assert.equal(labelEms('1111'), labelEms('0000'));
  });

  /**
   * What still makes this a weighted table rather than a character count: the
   * separators are a third of a digit, and the two widest capitals run past
   * the cap figure. A code starting with "M" or "W" sized from EM_CAP alone
   * would print wider than the space it was fitted to.
   */
  test('separators are narrower than digits, and M and W wider than the cap', () => {
    assert.ok(labelEms(',') < labelEms('0'));
    assert.ok(labelEms('MXN') > labelEms('NOK'));
    assert.ok(labelEms('W') > labelEms('O'));
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
