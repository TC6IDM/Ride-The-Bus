/**
 * Guards on the two ways a round can start that nothing in the UI tree can
 * express: a window-level key listener and a module function. Both are read as
 * TEXT, because what each protects fails silently - a bet placed behind a
 * panel, or a replay that quietly becomes a live round.
 *
 * Found in the pre-submission audit (2026-09-13); neither had a test because
 * neither had ever failed loudly.
 *
 * The third block guards how a replay OPENS, for the same reason: an extra
 * screen in front of Play breaks nothing and fails no check here, it just
 * stops matching Stake's replay spec (2026-09-22 audit).
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { source } from '../../sources.testlib.ts';

const CONTROL_BAR = source('../components/board/ControlBar.svelte');
const ROUND_PLACE = source('./round/roundPlace.svelte.ts');
const GAME = source('../components/Game.svelte');

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

describe('a replay opens on its round details, not the intro', () => {
  // Stake's replay spec: "auto-load the event data without interaction, then
  // show a Play button". The intro used to sit in front of that Play, so every
  // replay cost two taps, and a reviewer checking a range of event IDs paid
  // the extra one on each.
  test('the loader hands a replay to replay-info and normal play to the intro', () => {
    const start = GAME.indexOf("if (introPhase !== 'loading') return;");
    assert.ok(start >= 0, 'no intro-loaded handoff in Game.svelte');
    const handoff = GAME.slice(start, GAME.indexOf('});', start));
    assert.match(handoff, /introPhase = stateUrlDerived\.replay\(\) \? 'replay-info' : 'start';/);
  });
});
