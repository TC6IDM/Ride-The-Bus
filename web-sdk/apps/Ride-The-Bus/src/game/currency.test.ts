/**
 * Sub-cent payout display.
 *
 * Stake's submission checklist requires that sub-cent payouts display
 * correctly. Money on the RGS carries six decimal places, and this game hands
 * back fractions of the bet on a miss - 0.5x on card 2, then 30% of whatever
 * multiplier had been built - so at small bets a real, credited payout lands
 * below one cent. Formatted at the currency's own precision that renders as
 * "$0.00", which tells the player they won nothing.
 *
 * Imported by relative path from the SDK package: the helpers deliberately live
 * in utils-shared/currency.ts rather than amount.ts precisely so this file can
 * reach them without dragging in state-shared.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import {
  RGS_DECIMALS,
  currencyDecimals,
  displayFractionDigits,
} from '../../../../packages/utils-shared/currency.ts';

/** Micro-units, as the RGS sends them: 1_000_000 === 1.00 */
const API_AMOUNT_MULTIPLIER = 1_000_000;

describe('RGS_DECIMALS', () => {
  test('matches the RGS amount multiplier', () => {
    // currency.ts writes 6 out literally to stay import-free, so the agreement
    // with constants-shared/bet has to be asserted rather than derived.
    assert.equal(10 ** RGS_DECIMALS, API_AMOUNT_MULTIPLIER);
  });
});

describe('displayFractionDigits', () => {
  test('leaves ordinary amounts at the currency precision', () => {
    for (const value of [1, 1.5, 0.01, 12345.67, -4.2]) {
      assert.equal(displayFractionDigits(value, 2), 2, `${value} should stay at 2dp`);
    }
  });

  test('zero stays at the currency precision', () => {
    assert.equal(displayFractionDigits(0, 2), 2);
    assert.equal(displayFractionDigits(0, 0), 0);
  });

  test('an amount exactly on the rounding threshold still displays', () => {
    // 0.005 rounds to 0.01 at 2dp, so it is visible and needs no widening.
    assert.equal(displayFractionDigits(0.005, 2), 2);
  });

  test('widens just enough for sub-cent amounts', () => {
    assert.equal(displayFractionDigits(0.004, 2), 3);
    assert.equal(displayFractionDigits(0.0004, 2), 4);
    assert.equal(displayFractionDigits(0.00004, 2), 5);
    assert.equal(displayFractionDigits(0.000004, 2), 6);
  });

  test('widens for negative sub-cent amounts too', () => {
    // Net position can go negative and is rendered through the same formatter.
    assert.equal(displayFractionDigits(-0.004, 2), 3);
  });

  test('never exceeds the RGS resolution', () => {
    assert.equal(displayFractionDigits(1e-9, 2), RGS_DECIMALS);
  });

  test('handles zero-decimal currencies', () => {
    // JPY has no subunit: 10 shows as "10", but a sub-unit payout must not
    // collapse to "0".
    assert.equal(displayFractionDigits(10, 0), 0);
    assert.equal(displayFractionDigits(0.4, 0), 1);
    assert.equal(displayFractionDigits(0.04, 0), 2);
  });

  test('never returns less than the currency precision', () => {
    // Callers pass this as maximumFractionDigits while leaving
    // minimumFractionDigits to Intl; a maximum below the minimum is a
    // RangeError, so this is what stops the formatter throwing.
    for (const places of [0, 2, 3]) {
      for (const value of [0, 1e-9, 0.004, 1, -12.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.ok(
          displayFractionDigits(value, places) >= places,
          `displayFractionDigits(${value}, ${places}) dropped below the currency precision`,
        );
      }
    }
  });

  test('non-finite values fall back to the currency precision', () => {
    assert.equal(displayFractionDigits(Number.NaN, 2), 2);
    assert.equal(displayFractionDigits(Number.POSITIVE_INFINITY, 2), 2);
  });
});

describe('currencyDecimals follows Stake, not ISO', () => {
  test('the five currencies Stake shows without a minor unit resolve to 0', () => {
    for (const currency of ['JPY', 'IDR', 'KRW', 'VND', 'CLP']) {
      assert.equal(currencyDecimals(currency), 0, `${currency} should have no decimal places`);
    }
  });

  test('ordinary currencies resolve to 2', () => {
    for (const currency of ['USD', 'EUR', 'BRL', 'CAD', 'TRY', 'NOK', 'SGD']) {
      assert.equal(currencyDecimals(currency), 2, `${currency} should have 2 decimal places`);
    }
  });

  /**
   * The nine currencies where Intl (ISO 4217) and Stake's published table
   * disagree. Reading precision out of Intl got all nine wrong, which is why
   * this no longer defers to it.
   */
  test('the five ISO-3-decimal currencies are shown to 2, per Stake', () => {
    for (const currency of ['KWD', 'JOD', 'TND', 'OMR', 'BHD']) {
      const iso = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits;
      assert.equal(iso, 3, `${currency} is ISO 3dp - if this changed, revisit the override`);
      assert.equal(currencyDecimals(currency), 2, `${currency} should follow Stake's table`);
    }
  });

  test('the four ISO-0-decimal currencies Stake shows with decimals resolve to 2', () => {
    for (const currency of ['PKR', 'ISK', 'UGX', 'XOF']) {
      const iso = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits;
      assert.equal(iso, 0, `${currency} is ISO 0dp - if this changed, revisit the override`);
      assert.equal(currencyDecimals(currency), 2, `${currency} should follow Stake's table`);
    }
  });

  test('case is ignored and unknown codes fall back to 2', () => {
    assert.equal(currencyDecimals('jpy'), 0);
    assert.equal(currencyDecimals('NOT_A_CURRENCY'), 2);
    assert.equal(currencyDecimals(''), 2);
  });
});

describe('rendered amounts', () => {
  /** Exactly what numberToCurrencyString does, minus the state lookup. */
  const format = (value: number, currency: string) => {
    const places = currencyDecimals(currency);
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: places,
      maximumFractionDigits: displayFractionDigits(value, places),
    }).format(value);
  };

  test('a sub-cent payout is no longer shown as zero', () => {
    // The bug this fixes: Intl at 2dp renders 0.004 as "$0.00".
    assert.equal(
      new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(0.004),
      '$0.00',
    );
    assert.equal(format(0.004, 'USD'), '$0.004');
  });

  test('ordinary amounts keep their trailing zeros', () => {
    assert.equal(format(1.5, 'USD'), '$1.50');
    assert.equal(format(10, 'JPY'), '¥10');
    assert.equal(format(1234.5, 'USD'), '$1,234.50');
  });

  test('a 3-decimal ISO currency formats to 2 without throwing', () => {
    // Intl's default minimum for KWD is 3; a maximum of 2 under it is a
    // RangeError, which is why numberToCurrencyString sets both.
    assert.doesNotThrow(() => format(10, 'KWD'));
    assert.ok(format(10, 'KWD').includes('10.00'), format(10, 'KWD'));
  });

  test('every currency on Stake’s list formats without throwing', () => {
    const all = [
      'USD', 'CAD', 'JPY', 'EUR', 'RUB', 'CNY', 'PHP', 'INR', 'IDR', 'KRW', 'BRL', 'MXN',
      'DKK', 'PLN', 'VND', 'TRY', 'CLP', 'ARS', 'PEN', 'NGN', 'SAR', 'ILS', 'AED', 'TWD',
      'NOK', 'KWD', 'JOD', 'CRC', 'TND', 'SGD', 'MYR', 'OMR', 'QAR', 'BHD', 'PKR', 'EGP',
      'NZD', 'BOB', 'GHS', 'KES', 'MAD', 'BAM', 'ISK', 'TZS', 'UGX', 'XOF',
    ];
    for (const currency of all) {
      for (const value of [0, 0.004, 10, 1234.5]) {
        assert.doesNotThrow(() => format(value, currency), `${currency} @ ${value}`);
      }
    }
  });
});

describe('social currency formatting', () => {
  /** The NO_LOCALISATION_CURRENCY_MAP branch of numberToCurrencyString. */
  const formatSocial = (value: number, label: string) =>
    `${Number.parseFloat(`${value}`).toFixed(displayFractionDigits(value, 2))} ${label}`;

  test('the label is a suffix, per Stake’s currency table', () => {
    assert.equal(formatSocial(10, 'GC'), '10.00 GC');
    assert.equal(formatSocial(10, 'SC'), '10.00 SC');
  });

  test('no "$" prefix appears', () => {
    assert.ok(!formatSocial(10, 'SC').includes('$'));
  });

  test('sub-cent social payouts are not shown as zero', () => {
    assert.equal(formatSocial(0.004, 'SC'), '0.004 SC');
  });
});
