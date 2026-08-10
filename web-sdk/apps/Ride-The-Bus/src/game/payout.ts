/**
 * The round's payout maths, mirroring math-sdk games/ride_the_bus.
 *
 * Extracted from Game.svelte so it can be unit-tested against the actual
 * published books: if this ever drifts from the Python, the game shows the
 * player a different number from the one the RGS credits. That is the single
 * most damaging bug this game could have, so it gets the strongest test.
 *
 * Deliberately free of Svelte, DOM and framework imports - it is plain,
 * synchronous arithmetic and stays runnable under `node --test`.
 *
 * Python counterparts:
 *   TARGET_RTP        -> game_config.py:target_rtp
 *   DECAY             -> game_calculations.py:target_rtp_decay
 *   STAGE_RETENTION   -> game_calculations.py:STAGE_RETENTION
 *   partialMultiplier -> game_calculations.py:partial_multiplier
 *   quantizeMultiplier-> game_calculations.py:quantize_multiplier
 *   stageRetention    -> the stage_retention branch in gamestate.py:run_spin
 *
 * STAGE_RETENTION below is the BASE family's table and stays the default, so
 * every existing caller behaves exactly as before. The other two families pass
 * their own rules from modes.ts.
 */
import { FAMILY_RULES, type FamilyRules } from './modes.ts';

/** Solved so decay**4 == target_rtp; see partialMultiplier. */
export const TARGET_RTP = 0.99;

/** Per-stage decay constant: decay**4 == TARGET_RTP. */
export const DECAY = Math.pow(TARGET_RTP, 0.25);

/**
 * Fraction of the running multiplier kept when a guess misses at each stage.
 * Stage 0 keeps nothing - a wrong first guess pays zero.
 */
export const STAGE_RETENTION = [0, 0.3, 0.3, 0.3];

/**
 * Win-multiplier for a correct guess at `stageIndex` whose true probability is
 * `probability`. Derived from requiring, for every p,
 *
 *     p*m + (1-p)*retention == decay
 *
 * i.e. the expected multiplicative change to the running multiplier is a fixed
 * constant regardless of how likely the guess was. That martingale property is
 * what pulls every one of the 64 modes' raw RTP toward decay**4, despite their
 * wildly different stage probabilities.
 *
 * Returns 0 for an impossible guess (p <= 0): the "correct" branch can never
 * fire, so the multiplier is never applied.
 */
export function partialMultiplier(
  probability: number,
  stageIndex: number,
  retention: number = STAGE_RETENTION[stageIndex],
): number {
  if (probability <= 0) return 0;
  return (DECAY - (1 - probability) * retention) / probability;
}

/**
 * The retention a miss at this stage would actually bank.
 *
 * Load-bearing for pricing: the martingale only holds if a stage's win
 * multiplier is solved against the SAME number its miss would keep. While a
 * Second Chance round still holds its forgiveness, that number is the
 * forgiveness value, not the bust table - price it against 0.3 while the miss
 * really keeps 0.5 and the mode's RTP drifts off target.
 *
 * Mirrors the stage_retention branch in math-sdk gamestate.py:run_spin.
 */
export function stageRetention(
  rules: Pick<FamilyRules, 'retention' | 'forgive' | 'forgiveFrom'>,
  stageIndex: number,
  forgivenessSpent: boolean,
): number {
  if (forgivenessAvailable(rules, stageIndex, forgivenessSpent)) return rules.forgive!;
  return rules.retention[stageIndex]!;
}

/** Can a miss at this stage still be forgiven? */
export function forgivenessAvailable(
  rules: Pick<FamilyRules, 'forgive' | 'forgiveFrom'>,
  stageIndex: number,
  forgivenessSpent: boolean,
): boolean {
  return rules.forgive !== null && !forgivenessSpent && stageIndex >= rules.forgiveFrom;
}

/**
 * Floor a final multiplier DOWN to the nearest 0.1x - the RGS only carries one
 * decimal place. Any surviving positive amount floors to at least 0.1x rather
 * than disappearing to zero.
 */
export function quantizeMultiplier(raw: number): number {
  if (raw <= 0) return 0;
  const quantized = Math.floor(raw * 10) / 10;
  return quantized > 0 ? quantized : 0.1;
}

export type PayoutStage = {
  /** Did this guess land? */
  correct: boolean;
  /** Multiplier credited for a correct guess at this stage. */
  payout: number;
};

/**
 * Compound a round's four stages into the final multiplier.
 *
 * A miss ends the round but keeps STAGE_RETENTION of whatever had accrued,
 * decayed by the stages that will now never be played - so a bust at stage i
 * is worth the same in expectation as playing on would have been.
 */
export function computeFinalMultiplier(
  stages: PayoutStage[],
  rules: Pick<FamilyRules, 'retention' | 'forgive' | 'forgiveFrom' | 'cost'> = FAMILY_RULES.base,
): number {
  let running = 1;
  let busted = false;
  let forgivenessSpent = false;
  for (let stage = 0; stage < stages.length; stage += 1) {
    const event = stages[stage];
    if (busted) break;
    if (event.correct) {
      running *= event.payout;
      continue;
    }
    if (forgivenessAvailable(rules, stage, forgivenessSpent)) {
      // Forgiven: bank the fraction and play on. No decay term - that stands in
      // for stages a bust skips, and this round will play them for real.
      running *= rules.forgive!;
      forgivenessSpent = true;
      continue;
    }
    running *= rules.retention[stage]!;
    running *= DECAY ** (3 - stage);
    busted = true;
  }
  // Scaled by cost BEFORE quantizing, matching gamestate.py. payoutMultiplier is
  // expressed against the base bet, so a 2x mode has to pay twice as much to
  // return the same RTP.
  return quantizeMultiplier(running * rules.cost);
}
