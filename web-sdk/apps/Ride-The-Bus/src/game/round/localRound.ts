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
import { forgivenessAvailable, partialMultiplier, stageRetention } from '../math/payout.ts';
import { FAMILY_RULES, type FamilyRules } from '../math/modes.ts';
import { rankValue, type Card } from './roundContract.ts';

export type RevealEvent = {
  stage: number;
  card: Card;
  choice: string;
  correct: boolean;
  payout: number;
};

export function localColorPayouts(remaining: Card[], retention?: number) {
  const total = remaining.length;
  const red = remaining.filter((card) => card.suit === '♥' || card.suit === '♦').length;
  const black = total - red;
  return { red: partialMultiplier(red / total, 0, retention), black: partialMultiplier(black / total, 0, retention) };
}

export function localHigherLowerPayouts(remaining: Card[], ref: number, retention?: number) {
  const total = remaining.length;
  const higher = remaining.filter((card) => rankValue[card.rank] > ref).length;
  const lower = remaining.filter((card) => rankValue[card.rank] < ref).length;
  const equal = total - higher - lower;
  return {
    higher: partialMultiplier(higher / total, 1, retention),
    lower: partialMultiplier(lower / total, 1, retention),
    equal: partialMultiplier(equal / total, 1, retention),
  };
}

export function localInsideOutsidePayouts(remaining: Card[], a: number, b: number, retention?: number) {
  const total = remaining.length;
  const minVal = Math.min(a, b);
  const maxVal = Math.max(a, b);
  const inside = remaining.filter((card) => rankValue[card.rank] > minVal && rankValue[card.rank] < maxVal).length;
  const outside = remaining.filter((card) => rankValue[card.rank] < minVal || rankValue[card.rank] > maxVal).length;
  const equal = total - inside - outside;
  return {
    inside: partialMultiplier(inside / total, 2, retention),
    outside: partialMultiplier(outside / total, 2, retention),
    equal: partialMultiplier(equal / total, 2, retention),
  };
}

export function localSuitPayouts(remaining: Card[], retention?: number) {
  const total = remaining.length;
  const counts = { heart: 0, diamond: 0, club: 0, spade: 0 };
  for (const card of remaining) {
    if (card.suit === '♥') counts.heart += 1;
    else if (card.suit === '♦') counts.diamond += 1;
    else if (card.suit === '♣') counts.club += 1;
    else counts.spade += 1;
  }
  return {
    heart: partialMultiplier(counts.heart / total, 3, retention),
    diamond: partialMultiplier(counts.diamond / total, 3, retention),
    club: partialMultiplier(counts.club / total, 3, retention),
    spade: partialMultiplier(counts.spade / total, 3, retention),
  };
}

const SUIT_NAME_MAP: Record<string, string> = { '♥': 'heart', '♦': 'diamond', '♣': 'club', '♠': 'spade' };

export function isCorrectGuess(stageIndex: number, choice: string, card: Card, ranks: number[]): boolean {
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
  const drawn = deck.slice(0, 4);
  const ranks = drawn.map((card) => rankValue[card.rank]);

  /** One stage's table, priced against the retention its miss would bank. */
  const tableFor = (index: number, retention: number): Record<string, number> => {
    if (index === 0) return localColorPayouts(deck.slice(0), retention);
    if (index === 1) return localHigherLowerPayouts(deck.slice(1), ranks[0], retention);
    if (index === 2) return localInsideOutsidePayouts(deck.slice(2), ranks[0], ranks[1], retention);
    return localSuitPayouts(deck.slice(3), retention);
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
