/**
 * The squeeze's fold (cardFold.ts): the flap must be the real face, folded -
 * never mirrored, and landing exactly where the lifted corner went.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';

import { autoPeelPoint, cardCorners, clipPolygon, flapMatrix, foldCard, polygonArea, type Pt } from '../cardFold.ts';

const W = 97;
const H = 144;
const apply = (m: number[], [u, v]: Pt): Pt => [m[0]! * u + m[2]! * v + m[4]!, m[1]! * u + m[3]! * v + m[5]!];
const near = (a: Pt, b: Pt, msg: string) => assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6, `${msg}: ${a} vs ${b}`);

describe('the flap is the face, folded', () => {
  test('the face corner under the lifted corner lands where the corner was taken', () => {
    // Under the back's bottom-left corner lies the face's bottom-right corner.
    for (const reach of [5, 20, 40]) {
      const C: Pt = [0, H];
      const P = autoPeelPoint(H, reach);
      near(apply(flapMatrix(W, C, P), [W, H]), P, `reach ${reach}`);
    }
  });

  test('every corner, dragged anywhere: the corner face point follows the pointer', () => {
    for (const C of cardCorners(W, H)) {
      for (const P of [[40, 60], [10, 130], [90, 20], [W / 2, H / 2]] as Pt[]) {
        // The face point under back corner C is (W - Cx, Cy).
        near(apply(flapMatrix(W, C, P), [W - C[0], C[1]]), P, `corner ${C} to ${P}`);
      }
    }
  });

  test('never mirrored: the map is a rotation (determinant +1)', () => {
    for (const P of [[30, 100], [12, 140], [50, 50]] as Pt[]) {
      const [a, b, c, d] = flapMatrix(W, [0, H], P);
      assert.ok(Math.abs(a * d - b * c - 1) < 1e-9);
    }
  });

  test('nothing lifted until the corner moves; the lifted share grows with the fold', () => {
    assert.deepEqual(foldCard(W, H, [0, H], [0, H]), { back: null, flap: null, lifted: 0 });
    const shares = [10, 25, 40].map((r) => foldCard(W, H, [0, H], autoPeelPoint(H, r)).lifted);
    assert.ok(shares[0]! > 0 && shares[0]! < shares[1]! && shares[1]! < shares[2]!);
    // A 45-degree fold reaching r in along each edge lifts a triangle of r^2 / 2.
    assert.ok(Math.abs(shares[1]! - (25 * 25) / 2 / (W * H)) < 1e-9);
  });

  test('the clip helpers', () => {
    const square: Pt[] = [[0, 0], [10, 0], [10, 10], [0, 10]];
    assert.equal(polygonArea(square), 100);
    assert.equal(polygonArea(clipPolygon(square, ([x]) => 5 - x)), 50);
  });
});
