/**
 * The bump: a panel grown out of the control that opened it (T1 / S1 / B1).
 *
 * What fails silently here is placement: a bump that runs off the side of a
 * phone, or whose pointer drifts off its control when the panel has to shift,
 * still opens and still works - it just points at the wrong button. So the
 * arithmetic is pinned, and the three panels that are bumps are pinned to the
 * control each grows out of.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { placeBump } from '../bumpAnchor.ts';

const PHONE = { width: 390, height: 664 };
const DESK = { width: 1200, height: 675 };

test('a bump sits over its control, centred on it, with the pointer on its centre', () => {
  // Desktop bet display (measured 2026-10-17): [654, 600, 128, 41].
  const p = placeBump({ left: 654, top: 600, width: 128, height: 41 }, { width: 300, height: 120 }, DESK);
  assert.equal(p.left, 654 + 64 - 150);
  assert.equal(p.top, 600 - 12 - 120);
  assert.equal(p.left + p.pointerX, 654 + 64, 'the pointer is not over the control');
});

test('near the edge the panel shifts to stay on screen and the pointer stays on the control', () => {
  // Phone turbo button at the far left: [22, 606, 36, 36].
  const p = placeBump({ left: 22, top: 606, width: 36, height: 36 }, { width: 250, height: 80 }, PHONE);
  assert.equal(p.left, 10, 'the panel left the screen');
  assert.equal(p.left + p.pointerX, 40, 'the pointer left its control');
  // And at the right edge (the MODE sign's side).
  const q = placeBump({ left: 340, top: 606, width: 36, height: 36 }, { width: 250, height: 80 }, PHONE);
  assert.equal(q.left + 250, PHONE.width - 10);
  assert.equal(q.left + q.pointerX, 358);
});

test('the pointer never sits in a rounded corner, even for a control at the very edge', () => {
  const p = placeBump({ left: 0, top: 606, width: 8, height: 36 }, { width: 250, height: 80 }, PHONE, { cornerClear: 18 });
  assert.equal(p.pointerX, 18);
});

test('a bump taller than the room above its control is capped there, and scrolls inside', () => {
  // Popout S: 400 x 225, a bar near the bottom.
  const p = placeBump({ left: 180, top: 190, width: 40, height: 30 }, { width: 240, height: 400 }, { width: 400, height: 225 });
  assert.equal(p.maxHeight, 190 - 12 - 10);
  assert.equal(p.top, 10, 'a capped bump does not start at the screen edge margin');
});

test('a panel wider than the screen is held inside it', () => {
  const p = placeBump({ left: 150, top: 600, width: 90, height: 40 }, { width: 600, height: 200 }, { width: 320, height: 568 });
  assert.equal(p.left, 10);
});

test('turbo, sound and bet are the bumps, each grown from its own control', () => {
  const read = (rel: string) => readFileSync(resolve(import.meta.dirname, rel), 'utf8');
  for (const [file, anchor] of [
    ['TurboPopup', '.cb-turbo'],
    ['SoundPopup', '.cb-sound'],
    ['BetPopup', '.cb-bet-display'],
  ]) {
    const src = read(`../../../components/popups/${file}.svelte`);
    assert.ok(src.includes(`use:bump={'${anchor}'}`), `${file} no longer grows out of ${anchor}`);
    assert.match(src, /class="popup bump /, `${file} is not a bump`);
    assert.ok(src.includes("popups/popup-bump.css'"), `${file} does not import the bump's sheet`);
  }
  // The bar still renders all three anchors; a renamed class would leave a
  // bump with nothing to measure, and it would open at the top-left corner.
  const bar = read('../../../components/board/ControlBar.svelte');
  for (const cls of ['cb-turbo', 'cb-sound', 'cb-bet-display']) assert.match(bar, new RegExp(`class="[^"]*\\b${cls}\\b`), `.${cls} is gone from the bar`);
});

test('the bet bump keeps a field for typing any amount (the owner, 2026-10-17)', () => {
  const src = readFileSync(resolve(import.meta.dirname, '../../../components/popups/BetPopup.svelte'), 'utf8');
  assert.match(src, /<input[^>]*class="bet-entry-input"/, 'the typed bet field is gone');
  assert.ok(src.includes("t('Custom bet amount')"), 'the typed bet field lost its label');
});
