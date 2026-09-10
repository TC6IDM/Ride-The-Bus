/**
 * The bet menu draws whatever the RGS sends.
 *
 * Stake's Bet Levels rule is that the frontend uses the levels from the
 * authenticate response, and the dev fallback - ten tidy values from 1 to 1000
 * - is the least interesting list this will ever see. These are the shapes a
 * real operator can send: three levels, thirteen, a currency where every
 * amount is five figures, and the degenerate one-level case.
 *
 * What is being pinned is that the colouring never gives up: it returns a real
 * chip for every index of every list, and it never goes backwards.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CHIP_COLOURS, chipColour, splitChipLabel } from '../betChips.ts';
import { GAME_MARKUP, POPUP_CSS } from '../../sources.testlib.ts';

/** Lists an operator could plausibly configure. */
const LISTS: Record<string, number[]> = {
  'dev fallback': [1, 5, 25, 50, 75, 100, 200, 500, 800, 1000],
  'three levels': [0.2, 1, 5],
  'two levels': [1, 1000],
  'one level': [4.2],
  'seven irregular': [0.1, 0.25, 0.5, 1.13, 7, 42.5, 999],
  'thirteen levels': [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377],
  'high-denomination currency': [1000, 5000, 25000, 100000, 500000],
  'sub-cent': [0.0001, 0.001, 0.01, 0.1],
  'exactly five': [1, 2, 3, 4, 5],
};

describe('every level gets a chip', () => {
  test('no list produces an undefined colour', () => {
    for (const [name, levels] of Object.entries(LISTS)) {
      for (let i = 0; i < levels.length; i++) {
        const colour = chipColour(i, levels.length);
        assert.ok(
          CHIP_COLOURS.includes(colour),
          `${name}: level ${i} of ${levels.length} got "${colour}"`,
        );
      }
    }
  });

  /**
   * A bigger bet must never be a paler chip than a smaller one. This is the
   * whole reading the colour carries, and an off-by-one in the banding would
   * break it silently on one list length and not another.
   */
  test('colour never goes backwards as the level rises', () => {
    for (const [name, levels] of Object.entries(LISTS)) {
      let previous = -1;
      for (let i = 0; i < levels.length; i++) {
        const rank = CHIP_COLOURS.indexOf(chipColour(i, levels.length));
        assert.ok(
          rank >= previous,
          `${name}: level ${i} (${chipColour(i, levels.length)}) is paler than the one below it`,
        );
        previous = rank;
      }
    }
  });

  /**
   * With enough levels the menu should actually USE the set - a list of ten
   * that came out all one colour would be worse than grey rectangles, because
   * it would imply every bet is the same size.
   */
  test('a list of five or more spans the whole set', () => {
    for (const [name, levels] of Object.entries(LISTS)) {
      if (levels.length < CHIP_COLOURS.length) continue;
      const used = new Set(levels.map((_, i) => chipColour(i, levels.length)));
      assert.equal(
        used.size,
        CHIP_COLOURS.length,
        `${name}: uses ${used.size} of ${CHIP_COLOURS.length} chips`,
      );
    }
  });

  test('the extremes are the extremes', () => {
    for (const [name, levels] of Object.entries(LISTS)) {
      if (levels.length < 2) continue;
      assert.equal(chipColour(0, levels.length), CHIP_COLOURS[0], `${name}: lowest`);
      assert.equal(
        chipColour(levels.length - 1, levels.length),
        CHIP_COLOURS[CHIP_COLOURS.length - 1],
        `${name}: highest`,
      );
    }
  });

  /**
   * One level has no rank to express. The middle chip says "a bet" without
   * also claiming to be the cheapest one on offer.
   */
  test('a single level takes the middle chip', () => {
    assert.equal(chipColour(0, 1), CHIP_COLOURS[2]);
  });

  test('an index outside the list is clamped rather than undefined', () => {
    assert.equal(chipColour(-3, 10), CHIP_COLOURS[0]);
    assert.equal(chipColour(99, 10), CHIP_COLOURS[CHIP_COLOURS.length - 1]);
  });
});

describe('the ramp itself', () => {
  test('runs pale to dark, and is the set the table is laid with', () => {
    assert.deepEqual([...CHIP_COLOURS], ['white', 'blue', 'green', 'red', 'black']);
  });
});

describe('what a chip can actually print', () => {
  /**
   * Every one of these is a string Intl really produces for a currency the RGS
   * supports. The NOK ones are the case that broke an earlier build: its level
   * list runs to about forty entries and the labels are thirteen characters,
   * which overflowed a fixed 4-column grid horizontally and left the highest
   * bets unreachable behind a scrollbar.
   */
  const CASES: [string, string, string][] = [
    // formatted            currency  amount
    ['NOK 12,500.00', 'NOK', '12,500'],
    ['NOK 15,000.00', 'NOK', '15,000'],
    ['NOK 0.10', 'NOK', '0.10'],
    ['$1.00', '$', '1'],
    ['$1,000.00', '$', '1,000'],
    ['$0.20', '$', '0.20'],
    ['10.00 SC', 'SC', '10'],
    ['1 234,50 kr', 'kr', '1 234,50'],
    ['1.000,50 kr', 'kr', '1.000,50'],
  ];

  for (const [formatted, currency, amount] of CASES) {
    test(`${formatted} -> "${currency}" over "${amount}"`, () => {
      assert.deepEqual(splitChipLabel(formatted), { currency, amount });
    });
  }

  /**
   * The bug this exists for. Yen has no subunit, so Intl gives "¥1,000" - and
   * reading that comma as a decimal point saw three zeros and rendered a
   * thousand-yen chip as "1". A trailing group of exactly three digits is a
   * thousand, not a fraction.
   */
  test('a grouped thousand is never mistaken for a zero fraction', () => {
    assert.equal(splitChipLabel('¥1,000').amount, '1,000');
    assert.equal(splitChipLabel('¥10,000').amount, '10,000');
    assert.equal(splitChipLabel('1.000 kr').amount, '1.000');
  });

  /** Understating is the safe direction: leave it long rather than wrong. */
  test('a three-decimal currency keeps its zeros rather than risking it', () => {
    assert.equal(splitChipLabel('KWD 1.000').amount, '1.000');
  });

  test('a sub-unit amount never collapses to zero', () => {
    for (const f of ['$0.10', '$0.01', '$0.0001', 'NOK 0.20']) {
      assert.notEqual(splitChipLabel(f).amount, '0', `${f} collapsed`);
      assert.ok(Number(splitChipLabel(f).amount.replace(/,/g, '')) > 0, `${f} is not positive`);
    }
  });

  test('a string with no digits at all does not throw', () => {
    assert.deepEqual(splitChipLabel('—'), { currency: '', amount: '—' });
  });
});

/**
 * The chrome pass, checked against the source.
 *
 * Same grep style as winCelebration.test.ts, and for the same reason: these
 * live in a stylesheet and a component that `node --test` cannot mount, and
 * each of them fails in a way a screenshot at a glance would not catch.
 */
describe('the chrome does not slide back', () => {
  const read = (rel: string) => readFileSync(resolve(import.meta.dirname, rel), 'utf8');
  // The six per-panel sheets popups.css became, joined - see sources.testlib.ts.
  const POPUPS = POPUP_CSS;
  const TOKENS = read('../../../styles/tokens.css');
  const TABLE = read('../../../styles/scene/table.css');
  const CHOICE_ICON = read('../../../components/icons/ChoiceIcon.svelte');
  const APP_CSS = read('../../../components/app.css');
  // Markup: the `--ems` publication is a style attribute on a bet chip, and
  // the chips moved into ControlPopups.svelte. See sources.testlib.ts.
  const GAME = GAME_MARKUP;

  /**
   * The game self-hosts Poppins and then printed its most-read numbers in
   * Arial for the whole life of the code.
   *
   * A <button> does not inherit font-family - the UA stylesheet's own
   * `font: 400 13.333px Arial` wins - so `html body { font-family }` reached
   * everything EXCEPT the controls. Measured in the running game before the
   * fix: the control bar's bet display and mode name, all three mode-picker
   * rows, How to Play's tabs, the autoplay pills, the panel action button and
   * every bet chip's value were Arial on a Poppins panel.
   *
   * Stake names "standard fonts" as a cause of a 1-star rating, and nothing
   * about this is visible in a stylesheet - only in the computed style of a
   * running page. So it is pinned here.
   */
  test('form controls draw in the game’s own face', () => {
    const at = APP_CSS.indexOf('button,');
    assert.ok(at >= 0, 'no form-control font reset in app.css - every button is back to Arial');
    const rule = APP_CSS.slice(at, APP_CSS.indexOf('}', at) + 1);
    for (const control of ['button', 'input', 'select', 'textarea']) {
      assert.ok(rule.includes(control), `the reset does not cover <${control}>`);
    }
    assert.ok(
      rule.includes('font-family: inherit'),
      'the form-control reset no longer sets font-family: inherit',
    );
  });

  /**
   * The value used to be a flat multiple of --ui-bar. Measured, that printed at
   * 9.6px on desktop and 3.4px at Popout S - smaller at every one of the seven
   * target sizes than the caption above it - while leaving a third of the face
   * empty on the longest label. The fix is to solve the size from the label's
   * own width, which only works if both halves are present.
   */
  test('the chip value is fitted to its label, not to a constant', () => {
    const at = POPUPS.indexOf('.bet-chip-value {');
    assert.ok(at >= 0, 'no .bet-chip-value rule');
    const rule = POPUPS.slice(at, POPUPS.indexOf('\n}', at));
    assert.ok(
      rule.includes('font-size: min(') && rule.includes('var(--ems'),
      'the chip value is back to a constant font-size',
    );
    assert.ok(
      GAME.includes('--ems: {labelEms('),
      'Game.svelte no longer publishes --ems, so every chip falls back to one size',
    );
  });

  /**
   * `.bet-grid, .spin-grid` shared one rule, so the bet picker and the autoplay
   * picker were literally one artefact - the stylesheet said so out loud.
   */
  test('the bet and autoplay pickers are not one selector', () => {
    // Anchored to a line start so the note explaining WHY the rule went does
    // not count as the rule coming back.
    assert.ok(
      !/^\.bet-grid/m.test(POPUPS),
      '.bet-grid is a selector again',
    );
    assert.ok(
      !/^\.bet-grid\s*,\s*\.spin-grid/m.test(POPUPS),
      'the two pickers share a rule again',
    );
    assert.ok(/^\.bet-chips/m.test(POPUPS), 'the chip row is gone');
    assert.ok(/^\.spin-grid/m.test(POPUPS), 'the autoplay row is gone');
  });

  /**
   * The chip palettes are used by the felt AND the bet menu now. A second
   * literal in either file is the drift tokens.css exists to stop - four
   * unrelated felt greens is what its absence produced last time.
   */
  test('chip colours resolve from tokens, and table.css declares none', () => {
    for (const name of ['red', 'green', 'black', 'blue', 'white']) {
      assert.ok(TOKENS.includes(`--chip-${name}:`), `tokens.css has no --chip-${name}`);
    }
    const literals = TABLE.match(/--chip(-face|-dark|-cream)?:\s*#[0-9a-fA-F]{3,8}/g) ?? [];
    assert.deepEqual(literals, [], `table.css still hardcodes: ${literals.join(', ')}`);
  });

  /**
   * WCAG 1.4.11. Two of these measured 2.10:1 and 2.30:1 and the fix is a dark
   * keyline rather than a repaint - the fills are the owner's call and stay.
   * A keyline is invisible in a thumbnail, so nothing but a test will notice
   * it going missing.
   */
  test('every choice icon carries the keyline', () => {
    assert.ok(
      /drop-shadow\(var\(--keyline\)/.test(CHOICE_ICON),
      'the choice icons lost their contrast keyline',
    );
    assert.ok(
      TOKENS.includes('--choice-icon-keyline:'),
      'the keyline colour is not a token',
    );
    // Four directions, or it is an offset shadow rather than an outline.
    const shadows = CHOICE_ICON.match(/drop-shadow\(var\(--keyline\)/g) ?? [];
    assert.equal(shadows.length, 4, `expected 4 keyline shadows, found ${shadows.length}`);
  });

  /** The fills are owner-decided. A repaint was tried and rejected. */
  test('the choice fills are untouched', () => {
    for (const [name, hex] of [
      ['higher', '#2ecc71'],
      ['lower', '#c0392b'],
      ['inside', '#00bcd4'],
      ['outside', '#d81ce0'],
    ] as const) {
      assert.ok(
        TOKENS.includes(`--choice-${name}: ${hex}`),
        `--choice-${name} moved off ${hex} - that repaint was rejected on the look`,
      );
    }
  });

  /** A coloured bloom around a coloured button on a dark panel is the tell. */
  test('the panel action button elevates by light, not by a coloured glow', () => {
    const rule = POPUPS.match(/^\.action-button\s*\{[^}]*\}/m);
    assert.ok(rule, 'no .action-button rule');
    assert.ok(
      !/box-shadow:[^;]*rgba\(var\(--tint-rgb\)/.test(rule[0]),
      'the action button is glowing in its own tint again',
    );
  });
});
