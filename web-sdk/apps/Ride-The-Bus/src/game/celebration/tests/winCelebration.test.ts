/**
 * The win takeover's structural invariants, checked against the source.
 *
 * These are grep tests, like the mode-restore test at the bottom of
 * modes.test.ts, and for the same reason: the things they guard live in a
 * .svelte component and a stylesheet that `node --test` cannot mount, and every
 * one of them fails SILENTLY. A dropped prop shows an empty space where the
 * hand should be; a tier that stops drawing a layer looks like a different,
 * unfinished screen; a readout left visible behind the overlay spoils the only
 * suspense mechanic the game has, and does it in a way nobody notices unless
 * they happen to look at that part of the blur.
 *
 * Crude, and worth it. This is the screen a Stake reviewer screenshots.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { GAME_MARKUP, GAME_SOURCES } from '../../sources.testlib.ts';
import { BURST, BURST_COUNT, FAN, SUIT_CYCLE } from '../celebrationScene.ts';

const read = (rel: string) => readFileSync(resolve(import.meta.dirname, rel), 'utf8');

const CSS = read('../../../styles/scene/win-celebration.css');
const COMPONENT = read('../../../components/board/WinCelebration.svelte');
const CARDS_CSS = read('../../../styles/board/cards.css');

// Two different questions, so two different nets. The <WinCelebration> call
// site and `takeover-open` are MARKUP and stay with the board; the snapshot
// literal showWinCelebration builds is SCRIPT and moved out with the rest of
// the takeover state. See sources.testlib.ts.
const GAME = GAME_MARKUP;
const GAME_SCRIPT = GAME_SOURCES;

describe('escalation is intensity, never presence', () => {
  /**
   * The rule CLAUDE.md states and this file's own header restates: every tier
   * draws the whole scene, and the .tier-* rules only turn it up.
   *
   * It has been broken once already. A pass gave Big and Huge a bounded "plate"
   * and left the higher tiers full-bleed, and the ladder read as two different
   * unfinished screens rather than one escalating one. The shape of that
   * mistake is a .tier-* rule that sets something other than a variable.
   */
  test('every .tier-* rule sets custom properties and nothing else', () => {
    const rules = CSS.match(/^\.tier-[a-z]+\s*\{[^}]*\}/gm) ?? [];
    assert.equal(rules.length, 5, 'expected exactly five tier palettes');

    for (const rule of rules) {
      const name = rule.slice(0, rule.indexOf('{')).trim();
      const body = rule.slice(rule.indexOf('{') + 1, -1);
      const declarations = body
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .filter((d) => !d.startsWith('/*'));

      for (const declaration of declarations) {
        assert.ok(
          declaration.startsWith('--'),
          `${name} sets "${declaration.split(':')[0]!.trim()}", which is a property, not a knob. ` +
            'A tier may be turned down; it may not have a layer taken away from it.',
        );
      }
    }
  });

  /**
   * Every tier must actually SET each knob, or it silently inherits the
   * fallback baked into the rule that consumes it - which is how a tier ends up
   * identical to another one without anybody editing it.
   */
  test('every tier sets every knob', () => {
    const knobs = [
      '--wc-hot-rgb',
      '--wc-cool',
      '--wc-beam-op',
      '--wc-fan-spread',
      '--wc-throw',
    ];
    for (const rule of CSS.match(/^\.tier-[a-z]+\s*\{[^}]*\}/gm) ?? []) {
      const name = rule.slice(0, rule.indexOf('{')).trim();
      for (const knob of knobs) {
        assert.ok(rule.includes(`${knob}:`), `${name} never sets ${knob}`);
      }
    }
  });

  /**
   * --wc-fan-spread is the rung a player can see, so it has to be monotonic.
   * The knobs it replaced moved by amounts nobody could perceive; a ladder that
   * went backwards would be worse than that, and invisible in review.
   */
  test('the fan opens wider at every step up the ladder', () => {
    const order = ['big', 'huge', 'mega', 'epic', 'max'];
    const spreads = order.map((id) => {
      const rule = CSS.match(new RegExp(`^\\.tier-${id}\\s*\\{[^}]*\\}`, 'm'));
      assert.ok(rule, `no .tier-${id} rule`);
      const match = rule[0].match(/--wc-fan-spread:\s*([\d.]+)/);
      assert.ok(match, `.tier-${id} has no --wc-fan-spread`);
      return Number(match[1]);
    });

    for (let i = 1; i < spreads.length; i++) {
      assert.ok(
        spreads[i]! > spreads[i - 1]!,
        `${order[i]} (${spreads[i]}) does not open wider than ${order[i - 1]} (${spreads[i - 1]})`,
      );
    }
  });
});

describe('the takeover is built out of the round', () => {
  /**
   * The same failure class as the parsed.family bug: a prop dropped at the call
   * site produces no error, no warning and no type complaint that survives a
   * refactor - just a celebration with a hole in the middle of it.
   */
  test('Game.svelte passes the round’s cards to the takeover', () => {
    const call = GAME.match(/<WinCelebration[\s\S]*?\/>/);
    assert.ok(call, 'no <WinCelebration> call site found in Game.svelte');
    assert.ok(
      call[0].includes('cards={celebration.active.cards}'),
      'the <WinCelebration> call site does not pass cards - the fan will render empty',
    );
  });

  /**
   * A LIVE reference would be emptied by the next round's reset while the
   * overlay is still up, which is reachable during an auto run.
   */
  test('the cards are snapshotted, not referenced', () => {
    assert.ok(
      /cards:\s*\[\.{3}(?:round\.)?revealedCards\]/.test(GAME_SCRIPT),
      'showWinCelebration must copy revealedCards, not hand over the live array',
    );
  });

  /**
   * A round can reach this screen without being a clean sweep - a bust on the
   * last card, or a spent Second Chance - and four cards that all look equally
   * good would tell the player they got four right when they did not.
   */
  test('the takeover is told which card busted and which was forgiven', () => {
    const call = GAME.match(/<WinCelebration[\s\S]*?\/>/);
    assert.ok(call, 'no <WinCelebration> call site found in Game.svelte');

    // The object literal showWinCelebration builds, so this checks the SNAPSHOT
    // rather than merely that the identifiers appear somewhere in the file -
    // they also appear as the live board state, which is the thing not to hand
    // over.
    // Two spaces or four: the literal sits at function-body depth in
    // celebrationState.svelte.ts and sat one level deeper inside the component.
    const snapshot = GAME_SCRIPT.match(/celebration\.active = \{[\s\S]*?\n {2,4}\};/);
    assert.ok(snapshot, 'no celebration snapshot literal found');

    for (const prop of ['bustedIndex', 'forgivenIndex']) {
      assert.ok(
        call[0].includes(`${prop}={celebration.active.${prop}}`),
        `the call site does not pass ${prop} - the fan cannot mark the round`,
      );
      // Named explicitly rather than by shorthand now that the source is
      // `round`, which is still the point: the value is READ OFF the round
      // here, at snapshot time, not referenced for later.
      assert.ok(
        snapshot[0].includes(`${prop}: round.${prop},`),
        `${prop} is not snapshotted into celebration`,
      );
    }
  });

  /**
   * The marks are the BOARD'S, not new ones. cards.css is careful that a red
   * cross and an amber return arrow mean different things - "a red cross says
   * the round ended here, and this one carried on" - and a celebration that
   * invented its own pair would undo that.
   */
  test('the fan reuses the board’s two marks, and keeps them distinct', () => {
    assert.ok(
      /class="wc-fan-mark is-bust"><MarkIcon name="cross"/.test(COMPONENT),
      'the bust mark is not the board’s cross',
    );
    assert.ok(
      /class="wc-fan-mark is-forgiven"/.test(COMPONENT),
      'no forgiven mark on the fan',
    );
    assert.ok(
      /\{#if slot\.index === props\.bustedIndex\}[\s\S]*?\{:else if slot\.index === props\.forgivenIndex\}/.test(
        COMPONENT,
      ),
      'the two marks must be exclusive - one card cannot be both',
    );
    assert.ok(
      /\.wc-fan-mark\.is-bust\s*\{[^}]*--loss/.test(CSS),
      'the bust mark should take --loss, the colour the board uses',
    );
    assert.ok(
      /\.wc-fan-mark\.is-forgiven\s*\{[^}]*--forgiven/.test(CSS),
      'the forgiven mark should take --forgiven, not --loss',
    );
  });

  /**
   * Dimming the forgiven card too would read as a second bust. The round went
   * on past it, and that is the whole distinction the two marks carry.
   */
  test('only the busted card is dimmed', () => {
    assert.ok(
      /\.wc-fan-card\.is-busted\s*\{[^}]*filter:\s*saturate/.test(CSS),
      'the busted card should recede',
    );
    assert.ok(
      /\.wc-fan-card\.is-forgiven\s*\{[^}]*filter:\s*none/.test(CSS),
      'the forgiven card must NOT be dimmed - it did not end the round',
    );
  });

  test('the component declares the prop and draws all four slots', () => {
    assert.ok(
      /cards:\s*readonly \(Card \| null\)\[\]/.test(COMPONENT),
      'WinCelebration does not declare the cards prop',
    );
    // IMPORTED, not grepped. The geometry moved into celebrationScene.ts when
    // the component was split, and being a plain module means these can be
    // asserted as arithmetic rather than as a `length: 4 }` string that any
    // unrelated four-item Array.from in the file would also have satisfied.
    assert.equal(FAN.length, 4, 'the fan no longer builds four slots');
  });

  /**
   * The fan's shape, checked as numbers.
   *
   * It hangs symmetrically about a centre that is deliberately BETWEEN two
   * cards - no middle card sitting dead-straight looking like the odd one out -
   * and the outer pair ride lower, the way a real fan does.
   */
  test('the fan is symmetric, centred between cards, and hangs at the edges', () => {
    const tilts = FAN.map((c) => c.tilt);
    assert.ok(
      tilts.every((t) => t !== 0),
      'a card sits dead-straight - the fan is centred ON a card again',
    );
    assert.deepEqual(
      tilts.map((t) => +t.toFixed(2)),
      tilts.map((t) => -t).reverse().map((t) => +t.toFixed(2)),
      'the fan is not symmetric about its centre',
    );
    assert.ok(
      FAN[0]!.drop > FAN[1]!.drop && FAN[3]!.drop > FAN[2]!.drop,
      'the outer cards no longer ride lower than the inner pair',
    );
    // Dealt left to right, so a later card cannot arrive before an earlier one.
    for (let i = 1; i < FAN.length; i++) {
      assert.ok(FAN[i]!.delay > FAN[i - 1]!.delay, `card ${i} deals out of order`);
    }
  });

  /**
   * The burst is suit marks off the fan, and no one suit may dominate it - the
   * marks come from the game's own deck, which is the whole reason they are
   * marks rather than the generic particle sparks they replaced.
   */
  test('the burst spreads its suits and its angles', () => {
    assert.equal(BURST.length, BURST_COUNT);
    const perSuit = new Map<string, number>();
    for (const m of BURST) perSuit.set(m.suit, (perSuit.get(m.suit) ?? 0) + 1);
    assert.equal(perSuit.size, SUIT_CYCLE.length, 'the burst dropped a suit');
    const counts = [...perSuit.values()];
    assert.ok(
      Math.max(...counts) - Math.min(...counts) <= 1,
      `one suit dominates the burst: ${JSON.stringify([...perSuit])}`,
    );
    // Jittered off the exact spokes, so the ring does not read as a circle.
    const spoke = 360 / BURST_COUNT;
    assert.ok(
      BURST.every((m, i) => Math.abs(m.angle - i * spoke) > 0.001),
      'a mark sits on its exact spoke angle - the ring is a perfect circle again',
    );
  });
});

describe('the takeover does not spoil its own count-up', () => {
  /**
   * The board prints the settled figure in three places, and the overlay is
   * semi-transparent over all of them. Before this rule the segmented climb ran
   * from $0.00 while "FULL GAME WIN! $1,354.20" sat legibly behind it.
   *
   * Named individually rather than by counting, because the failure mode is a
   * FOURTH readout being added later and nobody thinking about this file.
   */
  test('every board readout that prints a figure is hidden under .takeover-open', () => {
    // TWO SHEETS, and :global(). .takeover-open sits on the layout root in
    // Game.svelte, so once the bar and the board became their own components
    // the ancestor stopped being visible to either of their scopes - the rule
    // has to be :global() or Svelte scopes it to nothing, and .cb-lastwin
    // moved to the bar's sheet with the readout it hides. svelte-check caught
    // that as an unused selector; this pins the fix.
    const HIDDEN = [CARDS_CSS, read('../../../styles/board/control-bar.css')].join('\n');
    for (const selector of ['.card-mult', '.running-win', '.cb-lastwin']) {
      assert.ok(
        HIDDEN.includes(`:global(.takeover-open) ${selector}`),
        `${selector} prints a figure but is not hidden while the takeover is open`,
      );
    }
  });

  test('Game.svelte sets takeover-open for exactly as long as the overlay lives', () => {
    assert.ok(
      /class:takeover-open=\{celebration\.active !== null\}/.test(GAME),
      'the layout root must carry takeover-open, bound to the same state that mounts the overlay',
    );
  });
});

describe('motion', () => {
  /**
   * The burst is an event, not an ambience. Looping it was what made sixteen
   * marks sit at sixteen unrelated radii and read as dust; the one-shot only
   * works because WinCelebration keys the container on the tier.
   */
  test('the burst fires once and is re-fired by keying, not by looping', () => {
    const mark = CSS.match(/^\.wc-mark\s*\{[^}]*\}/m);
    assert.ok(mark, 'no .wc-mark rule');
    assert.ok(
      !/animation:[^;]*infinite/.test(mark[0]),
      '.wc-mark loops - a burst that repeats forever is ambience, not a gesture',
    );
    assert.ok(
      /\{#key activeTier\.id\}[\s\S]*?class="wc-burst"/.test(COMPONENT),
      'the burst container is not keyed on the tier, so a promotion cannot re-fire it',
    );
  });

  /**
   * The title must NOT be keyed - that is the bug promoteTitle exists to
   * replace, and it is one careless edit away from coming back now that the
   * burst next to it legitimately is keyed.
   */
  test('the title is still not keyed', () => {
    assert.ok(
      !/\{#key[^}]*\}\s*<div class="wc-title"/.test(COMPONENT),
      'keying .wc-title replays its entrance on every promotion - use promoteTitle',
    );
  });

  /**
   * Reduced motion may stop the scene moving; it may not take the scene away.
   * The overlay carries a settled payout, so what is left has to still look
   * like a celebration rather than text on a scrim.
   */
  test('reduced motion keeps the fan and the beam', () => {
    const block = CSS.match(/@media \(prefers-reduced-motion: reduce\)[\s\S]*$/);
    assert.ok(block, 'no prefers-reduced-motion block');

    const hidden = block[0].match(/([^{}]*)\{\s*display:\s*none;\s*\}/);
    assert.ok(hidden, 'reduced motion hides nothing at all - expected the burst and the sweep');
    for (const kept of ['.wc-fan', '.wc-beam']) {
      assert.ok(
        !hidden[1]!.includes(kept),
        `${kept} is display:none under reduced motion - it is the scene, not the motion`,
      );
    }
  });
});
