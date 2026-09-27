/**
 * One multiplier format: one decimal, grouped like money, then "×".
 *
 * It was three - 17.2× in the round details, 17.20× on the board and the
 * takeover, 1354.20× ungrouped beside $1,354.20 - for a figure that is always
 * floored to 0.1 (quantizeMultiplier), so the second place was always a 0.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, test } from 'node:test';

import { multiplierString } from '../multiplier.ts';

describe('multiplierString', () => {
  test('one decimal, grouped, with the sign', () => {
    assert.equal(multiplierString(17.2), '17.2×');
    assert.equal(multiplierString(1354.2), '1,354.2×');
    assert.equal(multiplierString(4583.3), '4,583.3×');
    assert.equal(multiplierString(0), '0.0×');
  });

  test('float noise rounds to the tenth the round paid, never below it', () => {
    // 1354.2 is not exactly representable; a floor here would print 1,354.1.
    assert.equal(multiplierString(1354.1999999999998), '1,354.2×');
    assert.equal(multiplierString(0.30000000000000004), '0.3×');
  });

  test("groups and points in the caller's locale", () => {
    const de = (v: number, f: Intl.NumberFormatOptions) => new Intl.NumberFormat('de-DE', f).format(v);
    assert.equal(multiplierString(1354.2, de), '1.354,2×');
  });

  test('a formatter that throws still prints the figure', () => {
    const broken = () => {
      throw new RangeError('Incorrect locale information provided');
    };
    assert.match(multiplierString(17.2, broken), /^17[.,]2×$/);
  });

  test('a non-number prints 0.0×, not NaN×', () => {
    assert.equal(multiplierString(Number.NaN), '0.0×');
  });
});

describe('no component prints a payout multiplier by hand', () => {
  // Every PAYOUT goes through formatMultiplier. The one sanctioned exception is
  // How to Play's per-guess price range (payRange), which is not floored and so
  // keeps two places - it is named here rather than matched loosely.
  const components = resolve(import.meta.dirname, '../../../components');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.svelte')) files.push(path);
    }
  };
  walk(components);

  test('no toFixed() or bare interpolation sits in front of a ×', () => {
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/const payRange|min === max \? `\$\{min\.toFixed\(2\)\}×`/.test(line)) return;
          if (/toFixed\(\d\)\}?`?\s*×|\}×/.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
    assert.deepEqual(offenders, [], 'print multipliers with formatMultiplier:\n' + offenders.join('\n'));
  });
});
