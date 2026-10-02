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
 *   decayFor          -> the same, for a family with its own target_rtp
 *   ticketValues      -> game_calculations.py:ticket_values
 *   STAGE_RETENTION   -> game_calculations.py:STAGE_RETENTION
 *   partialMultiplier -> game_calculations.py:partial_multiplier
 *   quantizeMultiplier-> game_calculations.py:quantize_multiplier
 *   stageRetention    -> the stage_retention branch in gamestate.py:score_stage
 *   TICKET_STAGE_PAYOUT / ticketStage -> gamestate.py's, and SpinPlan.ticket_stage
 *   applyBust         -> the bust branch in score_stage
 *
 * STAGE_RETENTION below is the BASE family's table and stays the default, so
 * every existing caller behaves exactly as before. The other families pass
 * their own rules from modes.ts.
 *
 * EVERY PRICE IN THE CLIENT GOES THROUGH guessPrice, AND EVERY BUST THROUGH
 * applyBust. The stage price used to be re-derived in four files (stageOdds,
 * localRound, payoutTable and here) and the bust in two (here and roundReveal,
 * which folded the retention and the decay into one factor and so rounded
 * differently from the Python's two multiplications). A copy that misses a
 * rule - Last Stop's ticket stage is the newest - shows one number while the
 * RGS credits another.
 */
import { FAMILY_RULES, type FamilyRules } from './modes.ts';

/** Solved so decay**4 == target_rtp; see partialMultiplier. */
export const TARGET_RTP = 0.99;

/** Per-stage decay constant: decay**4 == TARGET_RTP. */
export const DECAY = Math.pow(TARGET_RTP, 0.25);

/**
 * The decay a family is priced against. DECAY for the four-guess families;
 * exactly 1 for Three of a Kind, whose targetRtp is 1.0 so its free card pays
 * 1.00x. Mirrors target_rtp_decay(family) in game_calculations.py.
 */
export function decayFor(rules: Pick<FamilyRules, 'targetRtp'>): number {
  return Math.pow(rules.targetRtp, 0.25);
}

/** A ticket family's stack laid out as its 20 values, or null. */
export function ticketValues(rules: Pick<FamilyRules, 'ticket'>): number[] | null {
  if (!rules.ticket) return null;
  const values: number[] = [];
  for (const [value, count] of rules.ticket) for (let i = 0; i < count; i += 1) values.push(value);
  return values;
}

/** The biggest ticket in the stack - 1 for a family without one. */
export function topTicket(rules: Pick<FamilyRules, 'ticket'>): number {
  const values = ticketValues(rules);
  return values ? Math.max(...values) : 1;
}

/**
 * The ticket a book drew, or null - and a refusal for any book this game never
 * writes: a ticket on a family that has none, more than one, a ticket on a
 * round with a miss (gamestate.draw_ticket only draws on a clean sweep, and
 * showing the ticket a bust would have won is near-miss staging), a value
 * that is not in the stack, or a ticket family's clean sweep with NO ticket.
 * Refused loudly, like a book short of reveals, rather than shown.
 */
export function bookTicket(
  events: readonly { type?: unknown; correct?: unknown; value?: unknown }[],
  rules: Pick<FamilyRules, 'ticket'>,
): number | null {
  const tickets = events.filter((event) => event.type === 'ticket');
  const reveals = events.filter((event) => event.type === 'reveal');
  const swept = reveals.length > 0 && reveals.every((event) => event.correct === true);
  if (tickets.length === 0) {
    // The suit card's price IS the ticket, so a sweep without one would settle
    // at the run to card 3 - less than the RGS credited.
    if (rules.ticket && swept) throw new Error('Round swept and carried no ticket');
    return null;
  }
  if (!rules.ticket) throw new Error('Round carried a ticket, and this mode draws none');
  if (tickets.length > 1) throw new Error('Round carried more than one ticket');
  if (!swept) throw new Error('Round carried a ticket on a round that missed');
  const value = Number(tickets[0]!.value);
  if (!ticketValues(rules)!.includes(value)) throw new Error(`Round carried a ${value}x ticket, which is not in the stack`);
  return value;
}

/**
 * What a right guess on a ticket family's last card multiplies the running
 * total by: nothing. Last Stop's suit card has no price of its own - a right
 * suit is paid by the ticket, which the book carries as its own event and
 * computeFinalMultiplier applies once. The book's reveal for that card says
 * 1.0, and so does every price here. Mirrors gamestate.py.
 */
export const TICKET_STAGE_PAYOUT = 1;

/**
 * The card a ticket family's ticket pays for - its last - or -1 on a family
 * with no ticket. Mirrors SpinPlan.ticket_stage.
 */
export function ticketStage(rules: Pick<FamilyRules, 'ticket' | 'retention'>): number {
  return rules.ticket ? rules.retention.length - 1 : -1;
}

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
 * what pulls every mode's raw RTP toward decay**4, despite their
 * wildly different stage probabilities.
 *
 * Returns 0 for an impossible guess (p <= 0): the "correct" branch can never
 * fire, so the multiplier is never applied.
 */
export function partialMultiplier(
  probability: number,
  stageIndex: number,
  retention: number = STAGE_RETENTION[stageIndex],
  decay: number = DECAY,
): number {
  if (probability <= 0) return 0;
  return (decay - (1 - probability) * retention) / probability;
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

/**
 * The price of a correct guess at this stage, at this probability - the one
 * call every price in the client goes through. On a ticket family's last card
 * it is TICKET_STAGE_PAYOUT: that card is paid by the ticket, not priced.
 */
export function guessPrice(
  rules: Pick<FamilyRules, 'retention' | 'forgive' | 'forgiveFrom' | 'targetRtp' | 'ticket'>,
  stageIndex: number,
  probability: number,
  forgivenessSpent = false,
): number {
  if (stageIndex === ticketStage(rules)) return TICKET_STAGE_PAYOUT;
  return partialMultiplier(
    probability,
    stageIndex,
    stageRetention(rules, stageIndex, forgivenessSpent),
    decayFor(rules),
  );
}

/**
 * The running total after a bust at `stageIndex` in a round of `stages` cards:
 * the retention, then the decay for the cards the bust skips. Two
 * multiplications in that order, as the Python does them: folding them into
 * one factor would round differently.
 */
export function applyBust(
  running: number,
  rules: Pick<FamilyRules, 'retention' | 'targetRtp'>,
  stageIndex: number,
  stages: number,
): number {
  running *= rules.retention[stageIndex]!;
  running *= decayFor(rules) ** (stages - 1 - stageIndex);
  return running;
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
 *
 * `ticket` is the book's ticket event, if it has one: the price of Last Stop's
 * suit card, whose own stage payout is TICKET_STAGE_PAYOUT. It multiplies the
 * running total before the cost and the one floor - gamestate.settle_round's
 * order. A ticket family's clean sweep must carry one and nothing else may: a
 * ticket on a round with a bust or a forgiven miss, or a sweep without one, is
 * a book this game never writes, and is refused.
 */
export function computeFinalMultiplier(
  stages: PayoutStage[],
  rules: Pick<FamilyRules, 'retention' | 'forgive' | 'forgiveFrom' | 'cost' | 'targetRtp' | 'ticket'> = FAMILY_RULES.base,
  ticket: number | null = null,
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
    // The stages never played are counted from the round's own length, which is
    // three on Three of a Kind.
    running = applyBust(running, rules, stage, stages.length);
    busted = true;
  }
  if (ticket !== null) {
    if (!rules.ticket || busted || forgivenessSpent) {
      throw new Error('a ticket on a round that was not a clean sweep of a ticket family');
    }
    running *= ticket;
  } else if (rules.ticket && !busted && !forgivenessSpent && stages.length > 0) {
    throw new Error('a clean sweep of a ticket family with no ticket');
  }
  // Scaled by cost BEFORE quantizing, matching gamestate.py. payoutMultiplier is
  // expressed against the base bet, so a 2x mode has to pay twice as much to
  // return the same RTP.
  return quantizeMultiplier(running * rules.cost);
}
