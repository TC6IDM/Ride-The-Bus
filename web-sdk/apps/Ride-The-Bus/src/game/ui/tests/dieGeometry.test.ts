/**
 * The die's drawing (game/ui/dieGeometry.ts): the scene's camera, and a die
 * that is a die.
 *
 *   * THE CAMERA IS table.css's. --flat and --upright are the props'
 *     foreshortening; a die drawn at any other angle would sit on the table
 *     differently from the deck and the chips beside it.
 *   * THE FACES ARE A REAL DIE'S: the two sides shown with a top are never its
 *     opposite (opposites sum to 7) and touch each other, and every value has
 *     its pips inside its face.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DIE_VIEW, FLAT, PIPS, SIDES, UPRIGHT, dieFaces, dieOutline, faceValues } from '../dieGeometry.ts';
import { source } from '../../sources.testlib.ts';

describe('the camera', () => {
  test('is the table\'s: --flat and --upright, read off table.css', () => {
    const css = source('../styles/scene/table.css');
    assert.equal(Number(/--flat:\s*([\d.]+);/.exec(css)?.[1]), FLAT);
    assert.equal(Number(/--upright:\s*([\d.]+);/.exec(css)?.[1]), UPRIGHT);
    assert.ok(Math.abs(FLAT ** 2 + UPRIGHT ** 2 - 1) < 0.01, 'not one elevation');
  });
});

describe('the drawing', () => {
  test('shows the top and two sides, and fits its view box', () => {
    const faces = dieFaces();
    assert.deepEqual(faces.map((f) => f.name), ['front', 'right', 'top'], 'the top must be drawn last, over the sides');
    const points = dieOutline().split(' ').map((p) => p.split(',').map(Number));
    assert.equal(points.length, 6, 'a cube seen from above and the side has a six-sided outline');
    for (const [x, y] of points) assert.ok(x! >= 0 && x! <= DIE_VIEW && y! >= 0 && y! <= DIE_VIEW);
  });

  test('every face value has its pips inside its face', () => {
    for (let face = 1; face <= 6; face++) {
      assert.equal(PIPS[face]!.length, face);
      assert.ok(PIPS[face]!.every(([u, v]) => Math.abs(u) < 0.4 && Math.abs(v) < 0.4));
    }
  });

  test('the sides are a real die\'s: never the top\'s opposite, and touching each other', () => {
    for (let top = 1; top <= 6; top++) {
      const { front, right } = faceValues(top);
      assert.deepEqual(SIDES[top], [front, right]);
      for (const side of [front, right]) {
        assert.notEqual(side, top);
        assert.notEqual(side + top, 7, `${side} is opposite ${top}`);
      }
      assert.notEqual(front, right);
      assert.notEqual(front + right, 7, `${front} and ${right} are opposite faces`);
    }
  });
});
