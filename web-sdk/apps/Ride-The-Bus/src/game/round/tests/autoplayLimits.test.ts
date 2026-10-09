/**
 * Autoplay's stops, and what autoplay must never do.
 *
 * WHAT THIS GUARDS.
 *   - The two limits are TYPED, in times the BASE bet or in money, and reached
 *     AT the figure. x is the unit of every other "your bet" in the game, the
 *     multiplier the takeover prints, and what the Stake SDK multiplies. A first
 *     cut counted in the round's cost; on Three of a Kind that made the panel's
 *     "your bet" mean something 250x different from the mode picker's, and a
 *     25x-100x single-win limit could never fire on a mode whose only win is
 *     4583.3x. A field that does not parse is no limit, never zero.
 *   - The stake never moves during a run. An auto-bet that raised the bet after
 *     a loss (a martingale - "chasing losses") sat in the source behind a
 *     DEV-only flag until 2026-09-26. It could never ship and a reviewer reading
 *     the bundle would still have found it; this fails if it comes back.
 *   - The Advanced panel stays folded into autoplay, MODE stays in the slot its
 *     button left, and the autoplay panel stays reachable DURING a run - the
 *     old sliders button was, on purpose, and the stops live here now.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { limitAmount, limitReached, parseLimit, type LimitSetting } from '../autoplayLimits.ts';
import { source } from '../../sources.testlib.ts';

const armed = (input: string, unit: 'x' | 'cash' = 'x'): LimitSetting => ({ input, unit, on: true });

describe('what the player types', () => {
  test('a figure, with a decimal point or a decimal comma', () => {
    assert.equal(parseLimit('10'), 10);
    assert.equal(parseLimit(' 2.5 '), 2.5);
    assert.equal(parseLimit('2,5'), 2.5, 'half the shipped languages type a decimal comma');
    assert.equal(parseLimit('1,000'), 1000, 'three digits after a comma is a thousands comma');
    assert.equal(parseLimit('2,50,000'), 250000, 'the Indian lakh grouping Hindi players type');
    assert.equal(parseLimit('1,000.5'), 1000.5);
    assert.equal(parseLimit('1 000'), 1000);
    assert.equal(parseLimit('.5'), 0.5);
  });

  test('nothing usable is null - never zero, never a guess', () => {
    for (const bad of ['', '   ', '0', '-5', 'abc', '5x', '1e3', '1.2.3', '2,50,0']) {
      assert.equal(parseLimit(bad), null, `"${bad}" parsed`);
    }
  });
});

describe('the two limits', () => {
  test('x is times the BASE bet; money is money; off or unusable is no limit', () => {
    assert.equal(limitAmount(armed('10'), 2), 20, '10x on a $2 base bet is $20');
    assert.equal(limitAmount(armed('10', 'cash'), 2), 10, '$10 is $10 whatever the bet');
    assert.equal(limitAmount({ input: '10', unit: 'x', on: false }, 2), Infinity, 'not armed');
    assert.equal(limitAmount(armed(''), 2), Infinity, 'armed over an empty field');
    assert.equal(limitAmount(armed('10'), 0), Infinity, 'no base bet to multiply');
  });

  test('never stop a run when both are off, whatever happens', () => {
    assert.equal(limitReached(Infinity, Infinity, -1e9, 1e9), false);
  });

  test('a loss limit stops AT the figure', () => {
    const at = limitAmount(armed('10'), 1);
    assert.equal(limitReached(at, Infinity, -9.99, 0), false);
    assert.equal(limitReached(at, Infinity, -10, 0), true, 'ten bets down is the limit, not past it');
    // Three of a Kind on a $2 base bet: one lost round is -$500, which is 250
    // base bets - past a 10x limit after one round, as "10x your bet" reads on a
    // mode whose picker says it costs 250x your bet.
    assert.equal(limitReached(limitAmount(armed('10'), 2), Infinity, -500, 0), true);
  });

  test('a single-win limit reads the round, not the run - and fires on the multiplier the game shows', () => {
    const at = limitAmount(armed('25'), 1);
    assert.equal(limitReached(Infinity, at, 500, 24.9), false, 'a run far up is not one big win');
    assert.equal(limitReached(Infinity, at, -3, 25), true);
    // Three of a Kind's only win is 4583.3x the base bet - the figure the
    // takeover prints - so any x limit up to that must be able to stop on it.
    for (const n of ['5', '10', '25', '50', '100', '1000', '4583.3']) {
      assert.equal(limitReached(Infinity, limitAmount(armed(n), 1), 0, 4583.3), true, `${n}x never fires on a trips win`);
    }
  });

  test('the loop reads both limits against the base bet, every round, never the round cost', () => {
    const loop = source('./round/autoplayLoop.svelte.ts');
    for (const which of ['stops.lossLimit', 'stops.winLimit']) {
      const at = loop.indexOf(`limitAmount(${which},`);
      const call = at >= 0 ? loop.slice(at, loop.indexOf(')', at) + 1) : '';
      assert.ok(call.includes('round.initialBet'), `${which} is not measured in base bets: ${call}`);
      assert.ok(!call.includes('cost'), `${which} is measured in the round's cost again: ${call}`);
    }
    const body = loop.slice(loop.indexOf('while ('));
    assert.ok(body.indexOf('limitAmount(stops.lossLimit') > 0, 'the limits are not re-read inside the loop, so a mid-run change would not apply');
  });
});

describe('what autoplay must never do', () => {
  test('the stake never changes during a run', () => {
    const loop = source('./round/autoplayLoop.svelte.ts');
    const settings = source('./round/autoplaySettings.svelte.ts');
    for (const text of [loop, settings]) {
      for (const tell of ['onLossMode', 'onWinMode', 'onLossPct', 'ADVANCED_ENABLED', 'martingale(', 'nextBet']) {
        assert.ok(!text.includes(tell), `bet progression is back (${tell})`);
      }
    }
    assert.ok(!/bet\.input\s*=/.test(loop), 'the loop writes the bet');
  });

  test('the Advanced panel stays folded into autoplay, and MODE stays at the edge', () => {
    const bar = source('../components/board/ControlBar.svelte');
    const game = source('../components/Game.svelte');
    assert.ok(!game.includes('AdvancedPopup') && !bar.includes("'advanced'"), 'the Advanced panel is back');
    const panel = source('../components/popups/AutospinPopup.svelte');
    for (const k of ['stops.onFullWin', 'stops.skipWinOnAuto', 'lossLimit', 'winLimit']) {
      assert.ok(panel.includes(k), `the autoplay panel lost ${k}`);
    }
    const pill = bar.slice(bar.indexOf('class="cb-panel cb-panel-light"'), bar.indexOf('class="cb-readouts"'));
    assert.ok(!pill.includes('cb-mode-btn'), 'MODE is back inside the light pill');
    const slot = bar.slice(bar.indexOf('class="cb-mode-slot"'));
    assert.ok(slot.includes('cb-mode-btn') && slot.includes('cb-mode-tip'), 'MODE left its slot, or its slot lost the tip');
  });

  test('the stops can be changed during a run', () => {
    // The autoplay button is the only way to the stops now. The sliders button
    // it replaced stayed live mid-run on purpose - "flipping it mid-run takes
    // effect from the next one, which is exactly when a player wants it" - and
    // the loop reads `stops` every round.
    const bar = source('../components/board/ControlBar.svelte');
    const button = bar.slice(bar.indexOf('class="cb-round cb-autospin"'), bar.indexOf('>', bar.indexOf('class="cb-round cb-autospin"')));
    assert.ok(!button.includes('auto.running'), 'the autoplay panel cannot be opened during a run again');
    const panel = source('../components/popups/AutospinPopup.svelte');
    assert.ok(panel.includes('stopAuto'), 'a run in progress offers no way to stop it from its own panel');
  });
});

describe('the bar holds two rows on a phone with MODE at the edge', () => {
  // Measured, not reasoned: with MODE moved to the bar's edge, a narrow MOUSE
  // window (404-536px) put MODE on a third row by itself, and Russian did at
  // 401-408px on touch (412px is a common Android width). Swept every 4px from
  // 320 to 620 in all 17 languages, mouse and touch, after these rules: two
  // rows. Each is one line of CSS a tidy-up could "simplify" away.
  const bar = source('../styles/board/responsive-bar.css');
  const block = bar.slice(bar.indexOf('@media (max-width: 620px) {'), bar.indexOf('\n}\n', bar.indexOf('@media (max-width: 620px) {')));
  const popoutS = bar.slice(bar.indexOf('@media (orientation: landscape) and (max-height: 320px) and (max-width: 520px)'));

  test('row two is budgeted for EVERY pointer, not only touch', () => {
    assert.match(block, /\.control-bar\s*{[^}]*column-gap:\s*calc\(var\(--ui-bar\) \* 0\.55\)/, 'row two lost its tighter gaps');
    assert.match(block, /\.control-bar\s*{[^}]*padding-inline:\s*calc\(var\(--ui-bar\) \* 1\)/, 'row two lost its narrower side margin');
    assert.match(block, /\.cb-bet-display\s*{\s*min-width:\s*calc\(var\(--ui-bar\) \* 11\)/, 'the bet figure lost its trimmed reservation');
    assert.match(block, /\.cb-mode-slot \.cb-mode-btn\s*{[^}]*min-width:\s*calc\(var\(--ui-bar\) \* 8\.4\)/, 'the MODE sign lost its two-row width');
  });

  test('under 400px the stepper\'s width goes to the MODE sign (F-11)', () => {
    // The phone type floor is 9px, and at 7.4 units fitBlock fitted 11 family
    // names in six languages under it - Finnish "Toinen mahdollisuus" at 6.3px
    // on Mobile S. 8.4 units from 404px up and 9.4 with a thinner frame below
    // put every name in all 16 languages at 9px or more, swept every 4px from
    // 320 to 620, mouse and touch, with the bar still on two rows.
    const narrow = bar.slice(bar.indexOf('@media (max-width: 400px) and (orientation: portrait)'), bar.indexOf('\n}\n', bar.indexOf('@media (max-width: 400px) and (orientation: portrait)')));
    assert.match(narrow, /\.cb-betstep\s*{\s*display:\s*none/, 'the stepper no longer hides under 400px, so the sign has no width to take');
    assert.match(narrow, /\.cb-mode-slot \.cb-mode-btn\s*{[^}]*min-width:\s*calc\(var\(--ui-bar\) \* 9\.4\)[^}]*padding:\s*calc\(var\(--ui-bar\) \* 0\.2\)/, 'the MODE sign lost its narrow-phone width or its thinner frame');
    assert.match(narrow, /\.cb-blind\s*{\s*padding-inline:\s*calc\(var\(--ui-bar\) \* 0\.15\)/, 'the sign\'s window lost its narrower sides');
  });

  test('Popout S puts all four back, so it stays Popout L at half size', () => {
    for (const rule of [/column-gap:\s*calc\(var\(--ui-bar\) \* 0\.91\)/, /padding-inline:\s*calc\(var\(--ui-bar\) \* 1\.27\)/, /min-width:\s*calc\(var\(--ui-bar\) \* 11\.6\)/, /min-width:\s*calc\(var\(--ui-bar\) \* 8\.42\)/]) {
      assert.match(popoutS, rule, `Popout S no longer restores ${rule}`);
    }
  });
});
