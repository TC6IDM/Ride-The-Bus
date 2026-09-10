/**
 * Every supported currency, walked.
 *
 * The game formats through Intl, so it "supports" any ISO code without a list -
 * which is exactly why nothing ever checked. These walk the real set and assert
 * the three things that actually break: a code Intl rejects outright, a code
 * that renders as itself because there is no symbol for it, and a settled
 * figure so long the control bar cannot hold it.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CURRENCIES, CURRENCY_CODES } from '../currencies.ts';
import { currencyDecimals } from '../../../../../../packages/utils-shared/currency.ts';
import { labelEms } from '../../ui/typeFit.ts';
import { GAME_MARKUP, GAME_SOURCES } from '../../sources.testlib.ts';

/** The social three are not ISO codes and are formatted by hand, not by Intl. */
const SOCIAL = new Set(['XGC', 'XSC', 'XEC']);
const ISO = CURRENCY_CODES.filter((c) => !SOCIAL.has(c));

const format = (code: string, value: number) =>
  new Intl.NumberFormat('en', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: currencyDecimals(code),
    maximumFractionDigits: currencyDecimals(code),
  }).format(value);

describe('the list itself', () => {
  test('no duplicates', () => {
    assert.equal(new Set(CURRENCY_CODES).size, CURRENCY_CODES.length);
  });

  test('every code is three upper-case letters', () => {
    for (const { code } of CURRENCIES) {
      assert.match(code, /^[A-Z]{3}$/, code);
    }
  });

  test('every code has a name', () => {
    for (const { code, name } of CURRENCIES) {
      assert.ok(name.trim().length > 2, `${code} has no name`);
    }
  });

  /**
   * The five Stake shows without a minor unit. Pinned against the list rather
   * than against Intl, because utils-shared/currency records that Stake's own
   * table disagrees with ISO on nine currencies.
   */
  test('exactly five currencies are zero-decimal', () => {
    const zero = ISO.filter((c) => currencyDecimals(c) === 0);
    assert.deepEqual(zero.sort(), ['CLP', 'IDR', 'JPY', 'KRW', 'VND']);
  });
});

describe('every currency formats', () => {
  test('Intl accepts all of them', () => {
    for (const code of ISO) {
      assert.doesNotThrow(() => format(code, 1234.5), `${code} threw`);
    }
  });

  /**
   * A currency that renders as its own code in the middle of a sentence is a
   * missing symbol, not a formatting choice. Several legitimately do this in an
   * English locale (NOK, BAM, ISK...), which is why the bet chips give a
   * multi-character code its own line - this pins how many, so a change in that
   * count is noticed rather than discovered on a chip.
   */
  test('most currencies render as a bare code, and that is the normal case', () => {
    const bare = ISO.filter((c) => format(c, 1).includes(c));
    // 31 of 46, measured. Most of these have no distinct glyph in an English
    // locale, so the chip's two-line "CODE over number" layout is the COMMON
    // path and the inline-symbol one is the exception - the opposite of what
    // the dollar-shaped default suggests.
    assert.ok(
      bare.length >= ISO.length / 2,
      `only ${bare.length} of ${ISO.length} render as a bare code - the chip layout assumes most do`,
    );
    // The ones that do have a glyph must keep it: these are the currencies the
    // inline-symbol branch of splitChipLabel exists for.
    for (const code of ['USD', 'EUR', 'JPY', 'INR', 'KRW', 'VND', 'PHP', 'ILS']) {
      assert.ok(!format(code, 1).includes(code), `${code} lost its symbol`);
    }
  });

  test('a sub-unit amount never renders as zero', () => {
    for (const code of ISO) {
      if (currencyDecimals(code) === 0) continue;
      const out = format(code, 0.01);
      assert.ok(/[1-9]/.test(out), `${code}: 0.01 rendered as ${out}`);
    }
  });
});

/**
 * The width the control bar and the win takeover have to survive.
 *
 * High Stakes' cap is 1910.20x, and an operator sets maxBet in the currency's
 * own units - so a weak unit produces a very long settled figure. These do not
 * assert a layout (a test cannot see one); they assert that the estimate the
 * layout is driven from stays inside the range the CSS was built for, so a new
 * currency with a wilder shape shows up here rather than on a phone.
 */
describe('the widest figure each currency can settle on', () => {
  const HIGH_STAKES_CAP = 1910.2;
  /** A $500,000-equivalent cap, order of magnitude only. */
  const UNITS_PER_USD: Record<string, number> = {
    IDR: 15900, VND: 25400, KRW: 1380, CLP: 960, NGN: 1600, UGX: 3700,
    TZS: 2700, CRC: 520, ARS: 1000, PKR: 278, ISK: 139, KES: 130, JPY: 157,
    XOF: 605, PHP: 58, EGP: 49, INR: 84, TWD: 32, TRY: 34, RUB: 98,
  };

  /**
   * The worst three, measured: TZS, UGX and XOF all reach 24 characters and
   * 14.72 ems at a $500,000-equivalent cap - "TZS 2,578,770,000,000.00", and
   * XOF with its five-character "F CFA " prefix. NGN is fourth. VND and IDR
   * have weaker units still but no minor unit, which saves them three
   * characters.
   */
  test('the worst three are the ones the layout was built against', () => {
    const widest = ISO.map((code) => ({
      code,
      ems: labelEms(format(code, 500_000 * (UNITS_PER_USD[code] ?? 1) * HIGH_STAKES_CAP)),
    }))
      .sort((a, b) => b.ems - a.ems)
      .slice(0, 3)
      .map((r) => r.code)
      .sort();
    assert.deepEqual(widest, ['TZS', 'UGX', 'XOF']);
  });

  test('none exceeds the width the takeover is built to fit', () => {
    // .wc-amount solves its font from 88vw / ems, with a floor set by the
    // font-size caps above it. Past about 26 ems the type would be driven
    // below what those caps leave, so that is the line worth knowing about.
    const LIMIT_EMS = 26;
    for (const code of ISO) {
      const cap = 500_000 * (UNITS_PER_USD[code] ?? 1);
      const text = format(code, cap * HIGH_STAKES_CAP);
      const ems = labelEms(text);
      assert.ok(ems <= LIMIT_EMS, `${code}: "${text}" is ${ems} ems, over ${LIMIT_EMS}`);
    }
  });

  test('the estimate is finite and positive for every one', () => {
    for (const code of ISO) {
      const ems = labelEms(format(code, 1234567.89));
      assert.ok(Number.isFinite(ems) && ems > 0, `${code} gave ${ems}`);
    }
  });
});

/**
 * The control bar's fit, checked against the stylesheet.
 *
 * These are grep tests in the style of winCelebration.test.ts, and for the same
 * reason: they guard a mechanism that fails SILENTLY. When it broke, the last
 * win simply painted across the balance - no error, no warning, and only on a
 * currency nobody develops in.
 */
describe('the control bar can still fit a long figure', () => {
  const read = (rel: string) => readFileSync(resolve(import.meta.dirname, rel), 'utf8');
  // The bar's own sheet PLUS readout.css: .cb-cap and .cb-val moved there when
  // the bar became its own component, because the responsible-gambling panel
  // renders them too. Joined, so the assertions below still ask what they
  // always asked - and so moving a rule between the two cannot make one pass
  // vacuously.
  const BAR = [read('../../../styles/board/control-bar.css'), read('../../../styles/board/readout.css')].join('\n');
  // The BAR's responsive sheet: responsive.css split three ways when the bar
  // and the board became their own components, and every assertion below is
  // about .cb-* rules. Both slice anchors - the 620px block and the touch-target
  // header - travelled here with them.
  const RESPONSIVE = read('../../../styles/board/responsive-bar.css');
  // Two of these assertions are about SCRIPT (the observer inside fitValue,
  // which lives in game/ui/fitValue.ts) and one is about MARKUP (how many
  // readouts carry use:fitValue). They are kept apart because the third
  // assertion below is a NEGATIVE - `attributes: true` must appear nowhere -
  // and a negative run against a wider net than the code it is about starts
  // failing on unrelated files. See sources.testlib.ts.
  const GAME = GAME_SOURCES;
  const GAME_TEMPLATE = GAME_MARKUP;

  /**
   * One rule's body, found by a selector ANCHORED TO A LINE START.
   *
   * It used to be a bare indexOf, which is a substring match: `.cb-val {`
   * also occurs inside `.cb-lastwin .cb-val {`. That was harmless only while
   * the standalone rule happened to come first in the file, and stopped being
   * harmless the moment .cb-val moved into readout.css and the descendant
   * variants were read first.
   */
  const rule = (css: string, selector: string) => {
    const at = css.indexOf(`\n${selector} {`);
    assert.ok(at >= 0, `no ${selector} rule`);
    return css.slice(at + 1, css.indexOf('\n}', at));
  };

  /**
   * THE one that broke. .cb-lastwin is a flex column with align-items:
   * flex-end, and a flex child under anything but `stretch` sizes to its own
   * content - so the value box grew past the readout's max-width, which meant
   * overflow:hidden clipped nothing and fitToBox saw scrollWidth ===
   * clientWidth and shrank nothing.
   */
  test('the value box cannot outgrow its readout', () => {
    const val = rule(BAR, '.cb-val');
    assert.ok(
      val.includes('max-width: 100%'),
      '.cb-val lost max-width:100% - under align-items:flex-end it will size to its ' +
        'text again, and both the clip and the fit go quiet',
    );
    assert.ok(val.includes('overflow: hidden'), '.cb-val lost its clipping guard');
    assert.ok(
      val.includes('white-space: nowrap'),
      '.cb-val may wrap again - a wrapped line has no horizontal overflow to measure',
    );
  });

  /**
   * A reservation without a ceiling lets the readout widen and the bar wrap.
   *
   * All THREE, named individually. .cb-bet-display was the one missed when the
   * other two were capped, and the failure was a 2-14px overspill that broke
   * the Advanced button onto a second row at every landscape width from 660 to
   * 1100 - invisible in dollars, because the reservation was measured in them.
   */
  test('both readouts are capped, not just reserved', () => {
    for (const selector of ['.cb-balance', '.cb-lastwin', '.cb-bet-display']) {
      assert.ok(
        rule(BAR, selector).includes('max-width:'),
        `${selector} has no max-width - it will widen instead of fitting, and the bar wraps`,
      );
    }
  });

  /**
   * The fit must not depend on the framework choosing to call an action back.
   * It did at first, and never re-ran after mount.
   */
  test('the fit re-runs on the text changing, not on an action update alone', () => {
    assert.ok(
      GAME.includes('new MutationObserver'),
      'fitValue no longer watches the DOM - it will keep its mount-time size',
    );
    assert.ok(
      /characterData:\s*true/.test(GAME),
      'the observer does not watch characterData, so a value change is invisible to it',
    );
    assert.ok(
      !/attributes:\s*true/.test(GAME),
      'watching attributes would re-trigger the fit on the font-size it writes',
    );
  });

  test('all three readouts are fitted', () => {
    const uses = GAME_TEMPLATE.match(/use:fitValue=\{/g) ?? [];
    assert.equal(uses.length, 3, `expected balance, last win and bet to be fitted, found ${uses.length}`);
  });

  /**
   * The phone bar is ONE line inside the light pill: sound, info, MODE,
   * Balance, Last Win.
   *
   * The readouts used to be reserved at a fixed 16 units each, which is wider
   * than what three icon buttons leave, so .cb-panel-light's flex-wrap dropped
   * them onto a second line inside the pill - a whole extra line of bar on
   * every phone, in every currency, to buy headroom for the worst one. The
   * call is the single row, with the figure shrinking instead.
   *
   * Greps rather than renders, like the rest of this block: the failure is a
   * layout that still LOOKS fine in dollars and only wraps on a currency
   * nobody develops in.
   */
  test('the phone pill keeps its readouts on the icons row', () => {
    const phone = RESPONSIVE.slice(
      RESPONSIVE.indexOf('@media (max-width: 620px)'),
      RESPONSIVE.indexOf('/* ---- Touch targets on phones'),
    );
    assert.ok(phone.length > 0, 'the 620px phone block has moved or gone');
    assert.ok(
      /\.cb-panel-light\s*\{[^}]*flex-wrap:\s*nowrap/.test(phone),
      '.cb-panel-light may wrap again on a phone - the balance drops onto its own ' +
        'line under the buttons instead of sitting beside them',
    );
  });

  /**
   * The companion to "both readouts are capped": on a phone the cap is lifted,
   * because 13.09 and 17 units are both wider than the row can give. What
   * replaces it has to bound the box just as hard, or use:fitValue goes quiet
   * again - scrollWidth === clientWidth on a box that simply widened, which is
   * the exact silent failure the cap exists to prevent.
   *
   * A zero-basis flex item cannot grow past its share of the row, so it is a
   * bound. `max-width: none` on its own is not.
   */
  test('lifting the readout cap on a phone replaces it with a flex bound', () => {
    const phone = RESPONSIVE.slice(
      RESPONSIVE.indexOf('@media (max-width: 620px)'),
      RESPONSIVE.indexOf('/* ---- Touch targets on phones'),
    );
    const readouts = phone.slice(phone.indexOf('.cb-lastwin,'));
    if (!/max-width:\s*none/.test(readouts)) return; // cap still in force; nothing to bound
    assert.ok(
      /flex:\s*1\s+1\s+0/.test(readouts),
      'the readouts have max-width:none with no zero-basis flex to bound them - ' +
        'they will widen, the fit will see nothing to shrink, and the pill will ' +
        'run off both edges of the screen',
    );
    assert.ok(
      /min-width:\s*0/.test(readouts),
      'without min-width:0 a flex item cannot shrink below its content, so the ' +
        'zero basis above buys nothing',
    );
  });
});
