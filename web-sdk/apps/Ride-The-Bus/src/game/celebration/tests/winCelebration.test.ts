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
import { FAN } from '../celebrationScene.ts';
import { BREATH_STAGGER_MS, breatheHand, hopFan } from '../celebrationGestures.ts';
import { CHIP_SETS, chipFlight } from '../chipStream.ts';

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
      '--wc-chip-rate',
      '--wc-chip-burst',
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
   * THE CHIPS (the owner's W1, 2026-10-18) replaced the suit-mark burst. Every
   * tier throws them - escalation is intensity, never presence - and every
   * step up throws more of them, further: a ladder that went backwards would
   * be invisible in review.
   */
  test('every tier throws chips, and each step up throws more, further', () => {
    const order = ['big', 'huge', 'mega', 'epic', 'max'];
    const knob = (id: string, name: string) => {
      const rule = CSS.match(new RegExp(`^\\.tier-${id}\\s*\\{[^}]*\\}`, 'm'));
      assert.ok(rule, `no .tier-${id} rule`);
      const match = rule[0].match(new RegExp(`${name}:\\s*([\\d.]+)`));
      assert.ok(match, `.tier-${id} has no ${name}`);
      return Number(match[1]);
    };
    for (const name of ['--wc-chip-rate', '--wc-chip-burst', '--wc-throw']) {
      const values = order.map((id) => knob(id, name));
      assert.ok(values[0]! > 0, `Big throws no chips (${name} is ${values[0]})`);
      for (let i = 1; i < values.length; i++) {
        assert.ok(values[i]! > values[i - 1]!, `${order[i]} does not raise ${name} over ${order[i - 1]}`);
      }
    }
  });

  test('a chip leaves from behind the hand, arcs out to a side, falls and fades', () => {
    // A seeded generator, so the flight is pinned rather than sampled.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const unit = 10;
    const sides = new Set<number>();
    for (let n = 0; n < 40; n++) {
      const flight = chipFlight(rand, unit, 1.75);
      const at = flight.frames.map((f) => {
        const m = String(f.transform).match(/translate\((-?[\d.]+)px, (-?[\d.]+)px\).*scale\(([\d.]+)\)/)!;
        return { x: Number(m[1]), y: Number(m[2]), scale: Number(m[3]), opacity: Number(f.opacity) };
      });
      // From behind the cards: above the fan's origin, within the hand's width.
      assert.ok(flight.y < 0 && Math.abs(flight.x) <= unit * 7.3, `starts at ${flight.x}, ${flight.y}`);
      assert.ok(at[0]!.scale < 1 && at[0]!.opacity === 1, 'a chip should start small and lit, coming out from behind');
      assert.ok(Math.min(...at.map((p) => p.y)) < 0, 'a chip never rises - it should arc');
      assert.ok(at.at(-1)!.y > 0, 'a chip should fall past where it started');
      assert.equal(at.at(-1)!.opacity, 0, 'a chip must be gone by the end of its flight');
      sides.add(Math.sign(at.at(-1)!.x));
    }
    assert.ok(sides.has(-1) && sides.has(1), 'the chips all go one way');
    assert.deepEqual([...CHIP_SETS], ['red', 'green', 'black', 'blue', 'white']);
    for (const set of CHIP_SETS) {
      assert.match(CSS, new RegExp(`data-set='${set}'\\]\\)\\s*\\{[^}]*--cc: var\\(--chip-${set}-cream\\)`), `the ${set} chip lost its table colours`);
    }
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

  test('the choice row steps back under the takeover even while it is locked', () => {
    // A takeover only opens while a round is in flight, so the row is always
    // .locked under it - and `.choice-row.locked { opacity: 0.5 }`
    // (choices-board.css) has the same specificity as the takeover's dim and
    // loads after it. It won: the row sat at 0.5 under every win screen, and on
    // a phone - no backdrop blur there - the captions printed on the same line
    // as the takeover's multiplier. Naming .locked is what out-ranks it.
    assert.match(
      CARDS_CSS,
      /:global\(\.takeover-open\) \.choice-row\.locked\s*\{[^}]*opacity:\s*0\.16/,
      'the takeover dim must name .choice-row.locked, or the lock (0.5) wins',
    );
    // And its labels leave outright. Even at 0.16 they printed, faint but
    // legible, on the same line as the win's multiplier on a portrait phone.
    assert.ok(
      read('../../../styles/board/choices-board.css').includes(':global(.takeover-open) .choice-label'),
      '.choice-label is text beside the win figure and must be hidden under .takeover-open',
    );
  });

  test('Game.svelte sets takeover-open for exactly as long as the overlay lives', () => {
    assert.ok(
      /class:takeover-open=\{celebration\.active !== null\}/.test(GAME),
      'the layout root must carry takeover-open, bound to the same state that mounts the overlay',
    );
  });
});

describe('motion', () => {
  test('the hand hops as one, and Last Stop’s ticket rides the bump with its middle', () => {
    // Owner's call, 2026-10-01: the ticket laid on the hand stayed put while
    // the cards around it hopped. Driven with stand-in elements that record
    // what hopFan asks of them.
    const made = (label: string, calls: { label: string; delay: number; composite?: string }[]) => ({
      animate: (_frames: Keyframe[], options: KeyframeAnimationOptions) =>
        calls.push({ label, delay: Number(options.delay), composite: options.composite }),
    });
    const hand = (withTicket: boolean) => {
      const calls: { label: string; delay: number; composite?: string }[] = [];
      const cards = [0, 1, 2, 3].map((i) => made(`card${i}`, calls));
      const ticket = withTicket ? made('ticket', calls) : null;
      const fan = {
        querySelectorAll: (selector: string) => (selector === '.wc-fan-card' ? cards : []),
        querySelector: (selector: string) => (selector === '.wc-fan-ticket' ? ticket : null),
      };
      hopFan(fan as unknown as HTMLElement);
      return calls;
    };

    const swept = hand(true);
    assert.deepEqual(swept.map((c) => c.label), ['card0', 'card1', 'card2', 'card3', 'ticket']);
    assert.ok(swept.every((c) => c.composite === 'add'), 'a hop that replaces the transform drops the deal');
    // Between the second and third cards' starts: it sits over the middle.
    assert.equal(swept.at(-1)!.delay, (swept[1]!.delay + swept[2]!.delay) / 2);
    assert.deepEqual(hand(false).map((c) => c.label), ['card0', 'card1', 'card2', 'card3']);
  });

  test('the hand breathes on top of the fan, not instead of it, the ticket with its middle', () => {
    // The owner's call, 2026-10-18. Layered with composite 'add' like the hop,
    // or the breath would replace the fan's tilt and offset.
    const calls: { label: string; delay: number; composite?: string; iterations?: number }[] = [];
    const made = (label: string) => ({
      animate: (_frames: Keyframe[], options: KeyframeAnimationOptions) =>
        calls.push({ label, delay: Number(options.delay), composite: options.composite, iterations: options.iterations }),
    });
    const cards = [0, 1, 2, 3].map((i) => made(`card${i}`));
    const ticket = made('ticket');
    breatheHand({
      querySelectorAll: (selector: string) => (selector === '.wc-fan-card' ? cards : []),
      querySelector: (selector: string) => (selector === '.wc-fan-ticket' ? ticket : null),
    } as unknown as HTMLElement);
    assert.deepEqual(calls.map((c) => c.label), ['card0', 'card1', 'card2', 'card3', 'ticket']);
    assert.ok(calls.every((c) => c.composite === 'add'), 'a breath that replaces the transform drops the fan');
    assert.ok(calls.every((c) => c.iterations === Infinity));
    assert.deepEqual(calls.slice(0, 4).map((c) => c.delay), [0, 1, 2, 3].map((i) => i * BREATH_STAGGER_MS));
    assert.equal(calls.at(-1)!.delay, 1.5 * BREATH_STAGGER_MS);
  });

  /**
   * The chip stream is a loop by the owner's request (2026-10-18), and the one
   * loop the takeover has besides the breath - so it must stop the moment the
   * player continues, and every promotion must re-level it from the tier's
   * knobs rather than from numbers in the script.
   */
  test('the chips stream from the tier’s knobs and stop on Continue', () => {
    assert.match(COMPONENT, /function dismiss\(\)[\s\S]*?chips\?\.stop\(\)[\s\S]*?flyHand\(fanEl, 'out'\)/);
    assert.match(COMPONENT, /void activeTier\.id;[\s\S]*?--wc-chip-rate[\s\S]*?--wc-chip-burst[\s\S]*?--wc-throw/);
    assert.match(COMPONENT, /<div class="wc-fan"[^>]*>\s*(<!--[\s\S]*?-->\s*)?<div class="wc-chips"/, 'the chips must leave from inside the fan, under the cards');
  });

  /**
   * The title must NOT be keyed - keying replayed its entrance on every
   * promotion (the bug promoteTitle once replaced; the sign now rolls instead),
   * and it is one careless edit away from coming back now that the burst next
   * to it legitimately is keyed.
   */
  test('the title is still not keyed', () => {
    assert.ok(
      !/\{#key[^}]*\}\s*<div class="wc-title"/.test(COMPONENT),
      'keying .wc-title replays its entrance on every promotion - the blind rolls instead',
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
    assert.ok(hidden, 'reduced motion hides nothing at all - expected the chips and the sweep');
    assert.ok(hidden[1]!.includes('.wc-chips'), 'the chips still fly under reduced motion');
    for (const kept of ['.wc-fan', '.wc-beam']) {
      assert.ok(
        !hidden[1]!.includes(kept),
        `${kept} is display:none under reduced motion - it is the scene, not the motion`,
      );
    }
  });
});
