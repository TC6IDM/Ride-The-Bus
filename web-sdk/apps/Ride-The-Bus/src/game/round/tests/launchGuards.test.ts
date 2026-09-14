/**
 * Guards on the two ways a round can start that nothing in the UI tree can
 * express: a window-level key listener and a module function. Both are read as
 * TEXT, because what each protects fails silently - a bet placed behind a
 * panel, or a replay that quietly becomes a live round.
 *
 * Found in the pre-submission audit (2026-09-13); neither had a test because
 * neither had ever failed loudly.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { source } from '../../sources.testlib.ts';

const CONTROL_BAR = source('../components/board/ControlBar.svelte');
const ROUND_PLACE = source('./round/roundPlace.svelte.ts');

/** The body of one function, from its `function name(` to the next top-level `}`. */
const body = (text: string, name: string) => {
  const start = text.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `no function ${name} in source`);
  const end = text.indexOf('\n}', start);
  return text.slice(start, end);
};

describe('the spacebar cannot buy a round behind a panel', () => {
  // THE BUG. The footer is `inert` while a popup or the error dialog is up,
  // so the spin button cannot be clicked - but the Space handler is on
  // window, inert does not reach it, and the open panel takes focus onto its
  // own DIV, which spaceIsForUs() lets through. Reading How to Play and
  // pressing Space placed a bet behind the panel.
  test('onKeyDown returns on chromeInert before anything else can fire', () => {
    const keydown = body(CONTROL_BAR, 'onKeyDown');
    const guard = keydown.indexOf('if (chromeInert) return;');
    assert.ok(guard >= 0, 'onKeyDown has no chromeInert guard');
    for (const later of ['onSpin()', 'startAuto(', 'spinDisabled()']) {
      assert.ok(keydown.indexOf(later) > guard, `${later} runs before the chromeInert guard`);
    }
  });

  test('chromeInert is still a prop the bar receives', () => {
    assert.match(CONTROL_BAR, /chromeInert:\s*boolean/);
  });
});

describe('replay never becomes a live round', () => {
  // The only thing keeping this path closed used to be betIsValid() failing
  // on a replay's zero balance. An 'engine-replay' seed further down routes
  // into startGameEngineFlow, which POSTs /wallet/play.
  test('playRound refuses in replay mode before validating the bet', () => {
    const play = body(ROUND_PLACE, 'playRound');
    const guard = play.indexOf('if (stateUrlDerived.replay()) return false;');
    assert.ok(guard >= 0, 'playRound has no replay guard');
    assert.ok(play.indexOf('if (!betIsValid()') > guard, 'the replay guard must come first');
  });
});
