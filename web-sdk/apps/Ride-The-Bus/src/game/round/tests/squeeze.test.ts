/**
 * The squeeze (squeeze.svelte.ts) - the owner's rules of 2026-10-20, held as
 * text because each fails silently: an automatic peel from the wrong corner
 * shows no index, a manual peel on autoplay stalls a run, and a switch moved
 * out of the autoplay panel is simply somewhere else.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(import.meta.dirname, rel), 'utf8');
const SQUEEZE = read('../squeeze.svelte.ts');
const REVEAL = read('../roundReveal.svelte.ts');
const AUTOPLAY = read('../../../components/popups/AutospinPopup.svelte');
const SETTING = read('../peelSetting.svelte.ts');

describe('the squeeze, as the owner set it', () => {
  test('the automatic peel lifts the BOTTOM-LEFT corner', () => {
    // [0, h]: the left edge, the bottom edge.
    assert.match(SQUEEZE, /const autoCorner = \(\): Pt => \[0, squeeze\.h\];/);
  });

  test('nothing peels until the card has arrived in front', () => {
    const out = REVEAL.indexOf('await squeezeOut(');
    assert.ok(out > 0, 'the reveal no longer sends the card out');
    for (const peel of ['squeezePeel(', 'squeezeWaitForPlayer(']) {
      assert.ok(REVEAL.indexOf(peel, out) > out, `${peel} can start before the card has arrived`);
    }
  });

  test('automatic by default; the player peels only when they asked, and never on autoplay or in a real replay', () => {
    assert.match(SETTING, /localStorage\.getItem\(KEY\) === '1'/, 'the setting is no longer off by default');
    assert.match(REVEAL, /const manual = !auto\.running && \(stateUrlDerived\.replay\(\) \? devPeelInReplay\(\) : peel\.myself\);/);
    // A replay waits on a hand only in a DEV build, asked for by the local
    // replay page (?dev_peel=me) - never on Stake.
    assert.match(REVEAL, /return import\.meta\.env\.DEV && typeof location !== 'undefined' && new URLSearchParams\(location\.search\)\.get\('dev_peel'\) === 'me';/);
  });

  test('the switch is in the autoplay panel', () => {
    assert.match(AUTOPLAY, /aria-checked=\{peel\.myself\}/);
    assert.match(AUTOPLAY, /onclick=\{\(\) => setPeelMyself\(!peel\.myself\)\}/);
  });

  test('the last card answers the moment it turns in front - and only then', () => {
    const turn = REVEAL.indexOf('await squeezeTurnAndHome(');
    const back = REVEAL.indexOf('round.revealedCards[i] = event.card;', turn);
    const onTurn = REVEAL.slice(turn, back);
    for (const cue of ['sound.playStageWin(', 'sound.playBust(', 'sound.playForgiven(']) {
      assert.ok(onTurn.includes(cue), `${cue} no longer sounds on the squeeze's turn`);
    }
    // ...and the ordinary branches after it stay quiet for a squeezed card.
    assert.match(REVEAL, /FREE_CHOICE && !squeezed\) sound\.playStageWin\(/);
    assert.match(REVEAL, /if \(!squeezed\) sound\.playForgiven\(/);
    assert.match(REVEAL, /if \(!squeezed\) sound\.playBust\(/);
  });

  test('a card left for the player waits for them: nothing turns it on a timer', () => {
    // The owner, 2026-10-20: "dont automatically peel it after some time".
    const wait = SQUEEZE.slice(SQUEEZE.indexOf('export async function squeezeWaitForPlayer('), SQUEEZE.indexOf('/* ---- Space'));
    assert.ok(wait.length > 100, 'squeezeWaitForPlayer moved; re-anchor this test');
    assert.doesNotMatch(wait, /setTimeout|GIVE_UP|waitOrSlam\(/, 'the manual wait turns the card on a timer again');
  });

  test('Space peels a waiting card - a tap plays the automatic peel, a hold peels while held - before it can slam', () => {
    const BAR = read('../../../components/board/ControlBar.svelte');
    const take = BAR.indexOf('if (squeezeSpaceDown()) return;');
    assert.ok(take > 0, 'Space no longer peels a waiting card');
    assert.ok(take < BAR.indexOf('onSpin(); // the tap'), 'Space slams before it can peel');
    const release = BAR.slice(BAR.indexOf('function releaseSpace() {'), BAR.indexOf('auto.spaceHoldRunning = false;'));
    assert.ok(release.includes('squeezeSpaceUp();'), 'letting Space go does not end the peel');
    assert.match(SQUEEZE, /const autoCorner = \(\): Pt => \[0, squeeze\.h\];/);
    assert.match(SQUEEZE, /setFold\(autoCorner\(\), autoPoint\(space\.progress\), space\.progress\)/, 'Space does not play the automatic peel');
  });
});
