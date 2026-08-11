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
  forgivenessAvailable,
  partialMultiplier,
  quantizeMultiplier,
  stageRetention,
} from './payout.ts';
import { FAMILY_RULES, MODE_FAMILIES, familyOf, type ModeFamily } from './modes.ts';

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
    // to stay a unit test (all 192 modes x their full book counts is a
    // build-time job).
    for (const file of files) {
      // books_<mode>.jsonl.zst - the mode name carries its family prefix, and
      // the family decides retention, forgiveness and the cost the multiplier
      // is scaled by. Resolving every book as base was right while base was the
      // only family; it would silently mis-check every sc_ and hs_ book.
      const mode = file.slice('books_'.length, -'.jsonl.zst'.length);
      const rules = FAMILY_RULES[familyOf(mode)];
      for (const book of await readBooks(join(PUBLISH_DIR, file), 400)) {
        const reveals = (book.events || []).filter((e: any) => e.type === 'reveal');
        if (reveals.length < 4) continue;
        const stages = reveals.map((e: any) => ({ correct: Boolean(e.correct), payout: e.payout }));
        const got = computeFinalMultiplier(stages, rules);
        const want = book.payoutMultiplier / 100;
        if (Math.abs(got - want) > 1e-9) {
          if (mismatches.length < 5) {
            // A book that stops exactly at a round number while the client
            // computes more is the signature of the win cap clipping it:
            // events.py pays min(win, config.wincap), and run_sims loads that
            // from the mode's declared max_win. Saying so turns a puzzling
            // mismatch into a diagnosis - this is how High Stakes was caught
            // being clipped to 1400x when it reaches 3820.5x.
            const clipped = got > want && Number.isInteger(want) && want % 100 === 0;
            const hint = clipped
              ? ` - book stops at a round ${want}, which looks like the wincap for` +
                ` this family clipping it; check MODE_FAMILIES wincap and rebuild`
              : '';
            mismatches.push(`${file} id=${book.id}: client ${got} vs book ${want}${hint}`);
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

/**
 * The two new families, pinned to the figures the math design was chosen on.
 *
 * These numbers came out of a Monte Carlo mirror of gamestate.run_spin before
 * the books were built (see the commit that added MODE_FAMILIES). Asserting
 * them here is what stops the client and the Python drifting apart in the gap
 * between a math change and a rebuild - the client resolves every round
 * locally to draw it, so a divergence shows the player one number while the
 * RGS credits another.
 */
describe('mode families', () => {
  /** The rarest winning path: two Equal picks, all four correct. */
  const MAX_WIN_PROBABILITIES = [0.5, 3 / 51, 2 / 50, 12 / 49];

  const maxWinFor = (family: ModeFamily) => {
    const rules = FAMILY_RULES[family];
    const stages = MAX_WIN_PROBABILITIES.map((probability, stage) => ({
      correct: true,
      // No miss occurs on this path, so any forgiveness is still in hand and is
      // what every stage is priced against.
      payout: partialMultiplier(probability, stage, stageRetention(rules, stage, false)),
    }));
    return computeFinalMultiplier(stages, rules);
  };

  test('each family reaches the ceiling its design was chosen for', () => {
    assert.equal(maxWinFor('base'), 1354.2);
    assert.equal(maxWinFor('sc'), 585.2);
    assert.equal(maxWinFor('hs'), 1910.2);
  });

  test('the advertised max win is the one the maths reaches', () => {
    // FAMILY_RULES.maxWin is what the picker, the rules screen and the
    // disclaimer all print. Stake requires the maximum win to be stated per
    // mode, so a figure that drifts from the payout model is a compliance
    // failure, not just a typo - and this game has already shipped one
    // display/actual mismatch (1.99x priced, 1.90x shown).
    for (const family of MODE_FAMILIES) {
      assert.equal(
        FAMILY_RULES[family].maxWin,
        maxWinFor(family),
        `${family}: advertised max win disagrees with the payout maths`,
      );
    }
  });

  test('every max win is stated against the BET, not the cost', () => {
    // The unit that caused the 3820.5 / 1910.2 confusion. payoutMultiplier is
    // always against the base bet, so a 2x mode's ceiling must NOT be halved.
    assert.ok(
      FAMILY_RULES.hs.maxWin > FAMILY_RULES.base.maxWin,
      'High Stakes pays more per bet than Classic; expressing it per unit ' +
        'staked would make it look smaller',
    );
  });

  test('no family exceeds Stake 500,000x payout ceiling', () => {
    for (const family of MODE_FAMILIES) {
      assert.ok(maxWinFor(family) <= 500_000, `${family} pays too much`);
    }
  });

  test('base is untouched by the family work', () => {
    // Same call the game made before families existed, still the same answer.
    const stages = MAX_WIN_PROBABILITIES.map((probability, stage) => ({
      correct: true,
      payout: partialMultiplier(probability, stage),
    }));
    assert.equal(computeFinalMultiplier(stages), 1354.2);
  });

  test('a card 1 miss pays nothing in every family', () => {
    // Retention at stage 0 is zero everywhere, and no family forgives it.
    for (const family of MODE_FAMILIES) {
      const stages = [
        { correct: false, payout: 0 },
        { correct: true, payout: 5 },
        { correct: true, payout: 5 },
        { correct: true, payout: 5 },
      ];
      assert.equal(computeFinalMultiplier(stages, FAMILY_RULES[family]), 0, family);
    }
  });

  test('Second Chance plays on after a card 2 miss; the others do not', () => {
    const stages = [
      { correct: true, payout: 2 },
      { correct: false, payout: 0 },
      { correct: true, payout: 3 },
      { correct: true, payout: 4 },
    ];
    // sc: 1 * 2 * 0.5 (forgiven) * 3 * 4 = 12, and every family costs 1x.
    assert.equal(computeFinalMultiplier(stages, FAMILY_RULES.sc), 12);
    // base: busts, keeping 0.3 and the decay for the two stages never played.
    const base = computeFinalMultiplier(stages, FAMILY_RULES.base);
    assert.ok(base > 0 && base < 1, `base should bank a fraction, got ${base}`);
  });

  test('a second miss ends a Second Chance round', () => {
    const stages = [
      { correct: true, payout: 2 },
      { correct: false, payout: 0 },
      { correct: false, payout: 0 },
      { correct: true, payout: 99 },
    ];
    // The stage-4 payout must never be applied - the round ended at stage 3.
    const got = computeFinalMultiplier(stages, FAMILY_RULES.sc);
    assert.ok(got < 12, `forgiveness must only apply once, got ${got}`);
  });

  test('forgiveness is offered from card 2 and only once', () => {
    const sc = FAMILY_RULES.sc;
    assert.equal(forgivenessAvailable(sc, 0, false), false, 'card 1 is never forgiven');
    assert.equal(forgivenessAvailable(sc, 1, false), true);
    assert.equal(forgivenessAvailable(sc, 1, true), false, 'already spent');
    assert.equal(forgivenessAvailable(FAMILY_RULES.base, 1, false), false, 'base forgives nothing');
  });

  test('a stage is priced against the retention its miss would bank', () => {
    // The martingale identity, checked at every stage of every family in both
    // forgiveness states: p*m + (1-p)*retention === decay.
    for (const family of MODE_FAMILIES) {
      const rules = FAMILY_RULES[family];
      for (const spent of [false, true]) {
        for (let stage = 0; stage < 4; stage += 1) {
          const retention = stageRetention(rules, stage, spent);
          for (const p of [0.05, 0.25, 0.5, 0.8, 0.98]) {
            const m = partialMultiplier(p, stage, retention);
            assert.ok(
              Math.abs(p * m + (1 - p) * retention - DECAY) < 1e-12,
              `${family} stage ${stage} spent=${spent} p=${p} breaks the martingale`,
            );
          }
        }
      }
    }
  });
});
