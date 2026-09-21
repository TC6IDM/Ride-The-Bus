/**
 * The DEV-ONLY local round generator.
 *
 * On localhost there is no /wallet/play, so the game deals its own cards and
 * prices its own stages to keep the UI exercisable. This mirrors the math-sdk's
 * per-stage true-odds pricing closely enough to play against, but it is NOT the
 * authority: a real session takes both its reveal events and its final
 * multiplier from the RGS.
 *
 * Extracted for two reasons.
 *
 * The first is that it is a hundred lines of pure card logic - no component
 * state, no reactivity - sitting in the middle of a Svelte component. Taking
 * the player's four choices as an argument was the only coupling it had.
 *
 * The second matters more: a real-money build should not ship a card generator,
 * even an unreachable one - it is the first thing an auditor reading the bundle
 * would query. Game.svelte imports this dynamically from inside an
 * `import.meta.env.DEV` branch, which Vite replaces with a literal false, so
 * the module can be dropped from a production build. That only holds while
 * nothing imports it statically.
 */
// `.ts` extensions so `node --test` can load this module - its ESM resolver
// will not resolve an extensionless relative import. See payoutTable.ts.
import { decayFor, forgivenessAvailable, partialMultiplier, stageRetention } from '../math/payout.ts';
import { FAMILY_RULES, FREE_CHOICE, type FamilyRules } from '../math/modes.ts';
import { rankValue, type Card } from './roundContract.ts';

export type RevealEvent = {
  stage: number;
  card: Card;
  choice: string;
  correct: boolean;
  payout: number;
};

export function localColorPayouts(remaining: Card[], retention?: number, decay?: number) {
  const total = remaining.length;
  const red = remaining.filter((card) => card.suit === '♥' || card.suit === '♦').length;
  const black = total - red;
  return { red: partialMultiplier(red / total, 0, retention, decay), black: partialMultiplier(black / total, 0, retention, decay) };
}

export function localHigherLowerPayouts(remaining: Card[], ref: number, retention?: number, decay?: number) {
  const total = remaining.length;
  const higher = remaining.filter((card) => rankValue[card.rank] > ref).length;
  const lower = remaining.filter((card) => rankValue[card.rank] < ref).length;
  const equal = total - higher - lower;
  return {
    higher: partialMultiplier(higher / total, 1, retention, decay),
    lower: partialMultiplier(lower / total, 1, retention, decay),
    equal: partialMultiplier(equal / total, 1, retention, decay),
  };
}

export function localInsideOutsidePayouts(remaining: Card[], a: number, b: number, retention?: number, decay?: number) {
  const total = remaining.length;
  const minVal = Math.min(a, b);
  const maxVal = Math.max(a, b);
  const inside = remaining.filter((card) => rankValue[card.rank] > minVal && rankValue[card.rank] < maxVal).length;
  const outside = remaining.filter((card) => rankValue[card.rank] < minVal || rankValue[card.rank] > maxVal).length;
  const equal = total - inside - outside;
  return {
    inside: partialMultiplier(inside / total, 2, retention, decay),
    outside: partialMultiplier(outside / total, 2, retention, decay),
    equal: partialMultiplier(equal / total, 2, retention, decay),
  };
}

export function localSuitPayouts(remaining: Card[], retention?: number, decay?: number) {
  const total = remaining.length;
  const counts = { heart: 0, diamond: 0, club: 0, spade: 0 };
  for (const card of remaining) {
    if (card.suit === '♥') counts.heart += 1;
    else if (card.suit === '♦') counts.diamond += 1;
    else if (card.suit === '♣') counts.club += 1;
    else counts.spade += 1;
  }
  return {
    heart: partialMultiplier(counts.heart / total, 3, retention, decay),
    diamond: partialMultiplier(counts.diamond / total, 3, retention, decay),
    club: partialMultiplier(counts.club / total, 3, retention, decay),
    spade: partialMultiplier(counts.spade / total, 3, retention, decay),
  };
}

const SUIT_NAME_MAP: Record<string, string> = { '♥': 'heart', '♦': 'diamond', '♣': 'club', '♠': 'spade' };

export function isCorrectGuess(stageIndex: number, choice: string, card: Card, ranks: number[]): boolean {
  // A free card is never wrong - there was nothing to get wrong.
  if (choice === FREE_CHOICE) return true;
  const value = rankValue[card.rank];
  if (stageIndex === 0) {
    const color = card.suit === '♥' || card.suit === '♦' ? 'red' : 'black';
    return choice === color;
  }
  if (stageIndex === 1) {
    const ref = ranks[0];
    if (value === ref) return choice === 'equal';
    return choice === (value > ref ? 'higher' : 'lower');
  }
  if (stageIndex === 2) {
    const minVal = Math.min(ranks[0], ranks[1]);
    const maxVal = Math.max(ranks[0], ranks[1]);
    if (value === minVal || value === maxVal) return choice === 'equal';
    return choice === (value > minVal && value < maxVal ? 'inside' : 'outside');
  }
  return choice === SUIT_NAME_MAP[card.suit];
}

// Mirrors games/ride_the_bus/gamestate.py:run_spin - draws the same 4
// cards from a deterministic local deck and resolves them against the
// player's pre-selected choices, exactly like the real math-sdk book does.
export function buildLocalRevealEvents(
  deck: Card[],
  choices: string[],
  rules: FamilyRules = FAMILY_RULES.base,
): RevealEvent[] {
  // One card per token: four on the four-guess ride, three on trips.
  const drawn = deck.slice(0, choices.length);
  const ranks = drawn.map((card) => rankValue[card.rank]);
  const decay = decayFor(rules);

  /** One stage's table, priced against the retention its miss would bank. */
  const tableFor = (index: number, retention: number): Record<string, number> => {
    let table: Record<string, number>;
    if (index === 0) table = localColorPayouts(deck.slice(0), retention, decay);
    else if (index === 1) table = localHigherLowerPayouts(deck.slice(1), ranks[0], retention, decay);
    else if (index === 2) table = localInsideOutsidePayouts(deck.slice(2), ranks[0], ranks[1], retention, decay);
    else table = localSuitPayouts(deck.slice(3), retention, decay);
    if (choices[index] === FREE_CHOICE) {
      // No guess: the card is shown and the stage pays decay (p = 1), which is
      // exactly 1.0 on the only family that uses it.
      table[FREE_CHOICE] = partialMultiplier(1, index, retention, decay);
    }
    return table;
  };

  // Walked stage by stage rather than built upfront: once a family can forgive,
  // the price of a stage depends on whether an earlier one has already missed,
  // which is not known until we get there. Mirrors the loop in
  // gamestate.py:run_spin.
  const events: RevealEvent[] = [];
  let busted = false;
  let forgivenessSpent = false;

  for (let index = 0; index < drawn.length; index += 1) {
    const card = drawn[index]!;
    const choice = choices[index]!;
    const retention = stageRetention(rules, index, forgivenessSpent);
    const correct = !busted && isCorrectGuess(index, choice, card, ranks);

    events.push({
      stage: index + 1,
      card,
      choice,
      correct,
      payout: tableFor(index, retention)[choice]!,
    });

    if (!busted && !correct) {
      if (forgivenessAvailable(rules, index, forgivenessSpent)) forgivenessSpent = true;
      else busted = true;
    }
  }

  return events;
}
