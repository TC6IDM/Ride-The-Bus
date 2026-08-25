/**
 * Arabic is the one right-to-left locale the RGS can request, and every defect
 * it produced was invisible in the source.
 *
 * Mirroring the board is correct and is what `dir="rtl"` on <html> buys: the
 * cards, the guess squares and the control-bar panels all belong in reading
 * order. What broke was everything the mirror does NOT reach - a physical
 * `right`, a four-value `border-radius`, a rotation, a glyph that means "next"
 * - plus the figures, which the bidi algorithm reordered inside their own
 * boxes. Measured against English at all seven target sizes, the intro screen
 * gained a horizontal scrollbar from 63px over at Desktop to 170px at Mobile L,
 * which is a Stake PreCheck failure on its own ("main game frame should not be
 * scrollable").
 *
 * None of it can be caught by rendering English, and none of it shows in a type
 * check. So the fixes are pinned here by reading the source: each one is a
 * single line that a later edit could quietly spell physically again.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { splitChipLabel } from './betChips.ts';
import { isRtl } from '../i18n/direction.ts';
import en from '../i18n/messagesMap/en.ts';

const SRC = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf8');

describe('only Arabic mirrors', () => {
  // Every language the RGS can send (RGS.md, "Language"). "po" is Stake's own
  // code for Polish; utils-shared/language.ts aliases it to pl.
  const LANGS = 'ar de en es fi fr hi id ja ko po pt ru tr zh vi'.split(' ');

  test('ar is right-to-left and nothing else is', () => {
    assert.deepEqual(LANGS.filter(isRtl), ['ar']);
  });
});

describe('figures are laid out left to right whatever the locale', () => {
  const appCss = read('components/app.css');

  /**
   * The readouts that print a figure on its own. Anything added to this list in
   * app.css has to still exist in the markup, and anything RENAMED in the
   * markup has to be renamed here - a stale selector in a global stylesheet
   * fails silently and only in Arabic.
   */
  const markup = [
    'components/Game.svelte',
    'components/HowToPlayPopup.svelte',
    'components/StartScreen.svelte',
    'components/WinCelebration.svelte',
  ]
    .map(read)
    .join('\n');

  const block = appCss.slice(appCss.indexOf('Money and multipliers are read left to right'));

  test('the rule is still there', () => {
    assert.ok(block.includes('direction: ltr'), 'app.css lost `direction: ltr`');
    assert.ok(block.includes('unicode-bidi: isolate'), 'app.css lost `unicode-bidi: isolate`');
  });

  test('every class it names is still rendered', () => {
    const selectors = block
      .slice(block.indexOf('*/'))
      .split('{')[0]!
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.startsWith('.'))
      .map((s) => s.slice(1));

    assert.ok(selectors.length >= 10, `only found ${selectors.length} selectors`);
    const missing = selectors.filter((c) => !new RegExp(`\\b${c}\\b`).test(markup));
    assert.deepEqual(missing, [], `app.css styles classes nothing renders: ${missing.join(', ')}`);
  });

  test('the last-win readout is covered, not just the balance', () => {
    // .cb-lastwin prints an amount AND a multiplier chip in one box, which is
    // the case that scrambled into "xUS$ 0.00 0.00". The chip is a child of
    // .cb-val and inherits from it, so covering .cb-val covers both.
    assert.ok(block.includes('.cb-val'), '.cb-val must be in the list');
  });
});

describe('the guess squares keep their own corners in both directions', () => {
  const css = read('styles/choices.css');

  test('the halves and quadrants use logical corner radii', () => {
    // A four-value border-radius is physical, so it stayed put while grid order
    // swapped the segments over - every square rounded its inner corners and
    // squared its outer ones.
    for (const rule of [
      '.color-square .half-btn.black-half',
      '.color-square .half-btn.red-half',
      '.io-square .half-btn.inside-half',
      '.io-square .half-btn.outside-half',
      '.suit-square .quad-btn:nth-child(1)',
      '.suit-square .quad-btn:nth-child(4)',
    ]) {
      const at = css.indexOf(rule);
      assert.ok(at > 0, `${rule} is gone`);
      const body = css.slice(at, css.indexOf('}', at));
      assert.ok(
        /border-(start|end)-(start|end)-radius/.test(body),
        `${rule} is back on a physical border-radius`,
      );
    }
  });

  test('the Inside/Outside icon nudge flips with the halves', () => {
    // Each half pushes its icon toward its OUTER edge, which is a physical
    // direction; unflipped, both icons were shoved into the seam and under the
    // equal badge - the collision the nudge exists to prevent.
    assert.ok(
      /:global\(\[dir='rtl'\]\)\s*\.io-square\s*\.inside-half/.test(css),
      'choices.css lost the right-to-left --io-icon-shift flip',
    );
  });
});

describe('the intro screen fits the frame in Arabic', () => {
  const css = read('styles/start-screen.css');

  test('the help tooltip is anchored logically', () => {
    // --tip-room below counts the panels BEFORE this one in reading order.
    // Anchored with `right`, a mirrored row put those panels on the other side,
    // so the last panel's tip was handed four panels of room and had none: it
    // ran off the edge and .ss-overlay (overflow-y: auto) started scrolling
    // sideways.
    const at = css.indexOf('.ss-tip {');
    assert.ok(at > 0);
    const body = css.slice(at, css.indexOf('}', at));
    assert.ok(body.includes('inset-inline-end:'), '.ss-tip lost inset-inline-end');
    assert.ok(
      !/^\s*right:/m.test(body),
      '.ss-tip is anchored with a physical `right` again',
    );
  });

  test('the dealt fan is re-dealt the other way', () => {
    // rotate is physical and nth-child counts DOM order, so a mirrored row gave
    // every panel the angle belonging to the opposite end and the arc inverted.
    const flips = css.match(/:global\(\[dir='rtl'\]\)\s*\.ss-step:nth-child\([^)]+\)/g) ?? [];
    // Four for the row of four, plus the odd/even pair the phone layout needs.
    assert.ok(flips.length >= 6, `only ${flips.length} right-to-left tilt rules`);
  });

  test('the index and the help badge sit in opposite corners, logically', () => {
    // The number is a card index and is read first, so it belongs at the corner
    // the reading starts from; the badge takes the other one. Physical left and
    // right pinned both to the same side of a mirrored panel, which also put
    // the badge on the opposite side from the tooltip it opens (.ss-tip is
    // anchored with inset-inline-end and says it repeats the badge's inset).
    for (const [rule, prop] of [
      ['.ss-step-n {', 'inset-inline-start:'],
      ['.ss-help {', 'inset-inline-end:'],
    ] as const) {
      const at = css.indexOf(rule);
      assert.ok(at > 0, `${rule} is gone`);
      const body = css.slice(at, css.indexOf('}', at));
      assert.ok(body.includes(prop), `${rule} lost ${prop}`);
    }
  });

  test('nothing in the intro is aligned physically', () => {
    assert.equal(
      (css.match(/text-align:\s*(left|right)\b/g) ?? []).length,
      0,
      'start-screen.css has a physical text-align again',
    );
    assert.equal(
      (css.match(/margin-(left|right):/g) ?? []).length,
      0,
      'start-screen.css has a physical margin again',
    );
  });
});

describe('the loader deals from the side the row is dealt into', () => {
  const css = read('styles/loader.css');

  test('the deal offset and tilt take a direction factor', () => {
    // .gl-cards is flex and already lays the four out right to left in Arabic,
    // but loader-deal's own offset and angle are physical, so the hand flew in
    // from the left and crossed the row it was being dealt into.
    assert.ok(
      /:global\(\[dir='rtl'\]\)\s*\.gl-cards\s*{\s*--gl-hand:\s*-1/.test(css),
      'loader.css lost the right-to-left deal flip',
    );
    for (const prop of ['--gl-deal-x', '--gl-deal-tilt']) {
      const decl = (css.match(new RegExp(`${prop}:[^;]*`)) ?? [])[0];
      assert.ok(decl, `${prop} is gone`);
      assert.ok(decl.includes('var(--gl-hand, 1)'), `${prop} misses the flip: ${decl}`);
    }
    // The keyframe has to read them rather than restate the numbers, because it
    // is shared by all four cards and --gl-hand is inherited per element.
    const at = css.indexOf('@keyframes loader-deal');
    const frames = css.slice(at, css.indexOf('\n}', at));
    assert.ok(frames.includes('var(--gl-deal-x)'), 'loader-deal restated its own offset');
    assert.ok(frames.includes('var(--gl-deal-tilt)'), 'loader-deal restated its own tilt');
  });

  test('the progress bar still empties from the right edge', () => {
    // The rule that was already here, and the precedent every other flip cites.
    assert.ok(
      /:global\(\[dir='rtl'\]\)\s*\.gl-bar-fill\s*{\s*transform-origin: right/.test(css),
      'loader.css lost the right-to-left progress-bar origin',
    );
  });
});

describe('the takeover holds the hand the same way round as the board', () => {
  const css = read('styles/win-celebration.css');

  test('the fan is mirrored by one factor, not by a second set of offsets', () => {
    // .card-row is flex and mirrors on its own; the fan is absolutely positioned
    // off the FAN constant and did not, so the same round showed card 1 on the
    // right of the board and on the left of the celebration.
    assert.ok(
      /:global\(\[dir='rtl'\]\)\s*\.wc-fan\s*{\s*--wc-hand:\s*-1/.test(css),
      'win-celebration.css lost the right-to-left hand flip',
    );
    for (const prop of ['--fan-tilt', '--fan-x']) {
      const uses = css.match(new RegExp(`${prop}:[^;]*`, 'g')) ?? [];
      assert.ok(uses.length >= 2, `${prop} is declared ${uses.length} times, expected the base + the Popout S override`);
      for (const use of uses) {
        assert.ok(use.includes('var(--wc-hand, 1)'), `${prop} misses the flip: ${use}`);
      }
    }
  });

  test('the corner index follows the overlap', () => {
    // Mirroring the hand mirrors which side each card is covered from, and a
    // physical `left` then buried the rank and pip of every card but the top
    // one. cards.css: the index is in the corner precisely so the card stays
    // readable when it is overlapped.
    const at = css.indexOf('.wc-fan-index {');
    assert.ok(at > 0, '.wc-fan-index is gone');
    const body = css.slice(at, css.indexOf('}', at));
    assert.ok(body.includes('inset-inline-start:'), '.wc-fan-index lost inset-inline-start');
    assert.ok(!/^\s*left:/m.test(body), '.wc-fan-index is back on a physical left');
  });

  test('the drop is left alone', () => {
    // --drop is |offset| - symmetric about the middle of the hand already, so
    // flipping it would do nothing but invite someone to "fix" it later.
    const y = css.match(/--fan-y:[^;]*/g) ?? [];
    assert.equal(y.length, 1);
    assert.ok(!y[0]!.includes('--wc-hand'), '--fan-y should not be flipped');
  });
});

describe('the marks that mean a direction turn round', () => {
  const svelte = read('components/MarkIcon.svelte');

  test('the arrow flips and the verdicts do not', () => {
    assert.ok(
      svelte.includes("class:is-directional={props.name === 'arrow'}"),
      'MarkIcon no longer marks the arrow as directional',
    );
    assert.ok(
      /:global\(\[dir='rtl'\]\)\s*\.is-directional\s*{\s*transform: scaleX\(-1\)/.test(svelte),
      'MarkIcon lost the right-to-left arrow flip',
    );
    // A cross and a tick are verdicts on the card beside them. Mirroring those
    // would only make the tick point the wrong way.
    assert.ok(
      !/:global\(\[dir='rtl'\]\)\s*\.mark-icon\s*{/.test(svelte),
      'the flip is being applied to every mark, not just the arrow',
    );
  });
});

describe('the readouts and the pay table align logically', () => {
  for (const file of ['styles/control-bar.css', 'styles/popup-how-to-play.css', 'styles/popups.css']) {
    test(`${file} has no physical text-align`, () => {
      const css = read(file);
      assert.deepEqual(css.match(/text-align:\s*(left|right)\b/g) ?? [], []);
    });
  }

  test('the last-win multiplier is spaced logically', () => {
    const css = read('styles/control-bar.css');
    assert.ok(css.includes('.cb-lastwin-mult'), '.cb-lastwin-mult is gone');
    assert.ok(
      !/\.cb-lastwin-mult[^}]*margin-left:/.test(css),
      '.cb-lastwin-mult is back on margin-left',
    );
  });
});

describe('a chip label survives an Arabic currency string', () => {
  // Intl renders every amount in an Arabic locale behind U+200F, and some
  // currency symbols carry a mark of their own. They are invisible and they
  // are not whitespace, so trim() leaves them in.
  const RLM = '‏';

  test('the right-to-left mark is dropped', () => {
    const split = splitChipLabel(`${RLM}12,500.00 US$`);
    assert.equal(split.currency, 'US$');
    assert.equal(split.amount, '12,500');
  });

  test('a one-character symbol still rides inline', () => {
    // The chip puts a CODE on its own line and keeps a SYMBOL with the figure,
    // and it decides on length. With the mark left in, the euro measured 2 and
    // took the two-line layout.
    const split = splitChipLabel(`${RLM}12,500.00 €`);
    assert.equal(split.currency, '€');
    assert.equal(split.currency.length, 1);
  });

  test('a symbol that carries its own mark is cleaned too', () => {
    // Kuwait: "د.ك." followed by a mark of its own, so there is one at each end
    // of the string. The fraction still drops the way dropZeroFraction says it
    // does when both separators are present.
    const split = splitChipLabel(`${RLM}12,500.000 د.ك.${RLM}`);
    assert.equal(split.currency, 'د.ك.');
    assert.equal(split.amount, '12,500');
  });

  test('an English label is untouched', () => {
    assert.deepEqual(splitChipLabel('$1,000.00'), { currency: '$', amount: '1,000' });
    assert.deepEqual(splitChipLabel('NOK 12,500.00'), { currency: 'NOK', amount: '12,500' });
  });
});

describe('the autoplay panel counts plays, not spins', () => {
  test('no key in the panel says "spin"', () => {
    // Nothing here spins. Every translation already said "rounds" - German
    // "Anzahl der Runden", Japanese "ラウンド数" - so English was the odd one
    // out, and social mode had to override all four of these to reach the same
    // word Stake's own terminology table asks for.
    for (const key of ['Number of Plays', 'Number of plays', 'Unlimited plays', 'More plays', 'Fewer plays']) {
      assert.ok(key in en, `${key} is missing from the English catalogue`);
    }
    for (const key of ['Number of Spins', 'Number of spins', 'Unlimited spins', 'More spins', 'Fewer spins']) {
      assert.ok(!(key in en), `${key} is back`);
    }
  });

  test('the panel renders the renamed keys', () => {
    const game = read('components/Game.svelte');
    for (const key of ['Number of Plays', 'Number of plays', 'Unlimited plays', 'More plays', 'Fewer plays']) {
      assert.ok(game.includes(`t('${key}')`), `Game.svelte does not render t('${key}')`);
    }
  });
});
