/**
 * The payout maths, checked against the ACTUAL published books.
 *
 * Run with `npm test` (node:test, no extra dependencies).
 *
 * The headline test decompresses real books out of
 * math-sdk/games/ride_the_bus/library/publish_files and replays each one's
 * reveal events through the client's own computeFinalMultiplier, asserting the
 * result equals the book's payoutMultiplier exactly. That is the invariant
 * that matters: if the client's arithmetic ever drifts from the Python, the
 * game shows a player a different number from the one the RGS credits.
 */
import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { readdirSync, existsSync, createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';

import {
  DECAY,
  STAGE_RETENTION,
  TARGET_RTP,
  computeFinalMultiplier,
  partialMultiplier,
  quantizeMultiplier,
} from './payout.ts';

describe('constants match the math-sdk', () => {
  test('DECAY**4 === target_rtp', () => {
    assert.ok(Math.abs(DECAY ** 4 - TARGET_RTP) < 1e-12);
  });

  test('a first-guess miss pays nothing', () => {
    assert.equal(STAGE_RETENTION[0], 0);
  });

  test('later misses keep 30%', () => {
    assert.deepEqual(STAGE_RETENTION.slice(1), [0.3, 0.3, 0.3]);
  });
});

describe('partialMultiplier', () => {
  test('is a martingale: p*m + (1-p)*retention === decay, for any p', () => {
    for (const stage of [1, 2, 3]) {
      for (const p of [0.02, 0.05, 0.15, 0.33, 0.5, 0.78, 0.96]) {
        const m = partialMultiplier(p, stage);
        const expected = p * m + (1 - p) * STAGE_RETENTION[stage];
        assert.ok(
          Math.abs(expected - DECAY) < 1e-12,
          `stage ${stage}, p=${p}: got ${expected}, want ${DECAY}`,
        );
      }
    }
  });

  test('an impossible guess pays 0 rather than dividing by zero', () => {
    assert.equal(partialMultiplier(0, 1), 0);
    assert.equal(partialMultiplier(-0.1, 2), 0);
  });

  test('rarer guesses pay more', () => {
    assert.ok(partialMultiplier(0.1, 1) > partialMultiplier(0.5, 1));
    assert.ok(partialMultiplier(0.5, 1) > partialMultiplier(0.9, 1));
  });

  test('stage 0 (colour) is always the same 50/50 price', () => {
    assert.ok(Math.abs(partialMultiplier(26 / 52, 0) - DECAY / 0.5) < 1e-12);
  });
});

describe('quantizeMultiplier', () => {
  test('floors to one decimal place', () => {
    assert.equal(quantizeMultiplier(1.99), 1.9);
    assert.equal(quantizeMultiplier(2.0), 2.0);
    assert.equal(quantizeMultiplier(1354.29), 1354.2);
  });

  test('zero and negatives collapse to 0', () => {
    assert.equal(quantizeMultiplier(0), 0);
    assert.equal(quantizeMultiplier(-5), 0);
  });

  test('a surviving sliver floors to 0.1x, not 0', () => {
    assert.equal(quantizeMultiplier(0.04), 0.1);
  });
});

describe('computeFinalMultiplier', () => {
  const hit = (payout: number) => ({ correct: true, payout });
  const miss = { correct: false, payout: 0 };

  test('a miss on card 1 pays nothing', () => {
    assert.equal(computeFinalMultiplier([miss, hit(2), hit(2), hit(2)]), 0);
  });

  test('a miss on card 2 always pays exactly 0.5x', () => {
    // colour is always 26/52, so the running multiplier entering stage 1 is
    // fixed - this is why the help text can state a flat 0.5x.
    const colour = partialMultiplier(26 / 52, 0);
    assert.equal(computeFinalMultiplier([hit(colour), miss, hit(2), hit(2)]), 0.5);
  });

  test('stages after a bust are ignored', () => {
    const colour = partialMultiplier(26 / 52, 0);
    const withHits = computeFinalMultiplier([hit(colour), miss, hit(99), hit(99)]);
    const withMisses = computeFinalMultiplier([hit(colour), miss, miss, miss]);
    assert.equal(withHits, withMisses);
  });

  test('four correct guesses compound', () => {
    assert.equal(computeFinalMultiplier([hit(2), hit(2), hit(2), hit(2)]), 16);
  });
});

// ---------------------------------------------------------------------------
// Parity with the published books.
// ---------------------------------------------------------------------------

const PUBLISH_DIR = resolve(
  import.meta.dirname,
  '../../../../../math-sdk/games/ride_the_bus/library/publish_files',
);

type Book = { id: number; payoutMultiplier: number; events: any[] };

/**
 * Read the first `limit` books out of a compressed mode file.
 *
 * Streamed and stopped early rather than decompressed whole: a single mode is
 * 215k rounds, which blows past V8's maximum string length (ERR_STRING_TOO_LONG).
 */
async function readBooks(file: string, limit: number): Promise<Book[]> {
  const stream = createReadStream(file).pipe(createZstdDecompress());
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  const out: Book[] = [];
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      out.push(JSON.parse(line));
      if (out.length >= limit) break;
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  return out;
}

describe('parity with the published books', () => {
  const available = existsSync(PUBLISH_DIR);

  test('publish_files exists (skip parity if the math has not been built)', () => {
    if (!available) {
      console.warn(`  ! ${PUBLISH_DIR} missing - run the math build to enable parity tests`);
    }
    assert.ok(true);
  });

  test('client arithmetic reproduces each book payoutMultiplier exactly', { skip: !available }, async () => {
    const files = readdirSync(PUBLISH_DIR).filter((f) => f.startsWith('books_') && f.endsWith('.jsonl.zst'));
    assert.ok(files.length > 0, 'no book files found');

    let checked = 0;
    const mismatches: string[] = [];

    // A slice of every mode - enough to catch a formula change, fast enough
    // to stay a unit test (all 64 modes x 215k rounds is a build-time job).
    for (const file of files) {
      for (const book of await readBooks(join(PUBLISH_DIR, file), 400)) {
        const reveals = (book.events || []).filter((e: any) => e.type === 'reveal');
        if (reveals.length < 4) continue;
        const stages = reveals.map((e: any) => ({ correct: Boolean(e.correct), payout: e.payout }));
        const got = computeFinalMultiplier(stages);
        const want = book.payoutMultiplier / 100;
        if (Math.abs(got - want) > 1e-9) {
          if (mismatches.length < 5) {
            mismatches.push(`${file} id=${book.id}: client ${got} vs book ${want}`);
          }
        }
        checked += 1;
      }
    }

    assert.equal(
      mismatches.length,
      0,
      `${mismatches.length} payout mismatches across ${checked} books:\n  ${mismatches.join('\n  ')}`,
    );
    assert.ok(checked > 1000, `only ${checked} books checked`);
    console.log(`    verified ${checked.toLocaleString()} published books across ${files.length} modes`);
  });
});
