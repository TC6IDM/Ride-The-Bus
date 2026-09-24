/**
 * What a card has to be for its guess to land, and how many of the cards still
 * in the deck are that.
 *
 * The reveal prints this under the running total before each card turns
 * ("Needs 8-K · 24 of 51"), and the rules screen's example round is built from
 * it. It is the SAME count the stage was priced on: every stage pays true odds
 * against the cards left in the deck (partialMultiplier), so a line that
 * disagreed with the price would be the display drifting from the maths. The
 * test replays published books through stagePrice() to prove it cannot.
 *
 * Nothing here decides a payout - the book does - it only explains one. Pure,
 * so node --test can load it, and deliberately separate from the DEV-only
 * dealer (round/localRound.ts), which must never be imported statically.
 */
// `.ts` extensions so `node --test` can load this module - see payoutTable.ts.
import { createDeck, rankValue, ranks as RANK_ORDER, type Card } from '../round/roundContract.ts';
import { FREE_CHOICE, type FamilyRules } from './modes.ts';
import { decayFor, partialMultiplier, stageRetention } from './payout.ts';

export type StageNeed =
  /** Three of a Kind's card 1: dealt, not guessed. */
  | { kind: 'free'; hits: number; total: number }
  | { kind: 'color'; color: 'red' | 'black'; hits: number; total: number }
  /** The ranks that land the guess, low to high. Empty when none can. */
  | { kind: 'ranks'; ranks: Card['rank'][]; hits: number; total: number }
  | { kind: 'suit'; suit: Card['suit']; hits: number; total: number };

const SUIT_OF: Record<string, Card['suit']> = { heart: '♥', diamond: '♦', club: '♣', spade: '♠' };
const isRed = (card: Card) => card.suit === '♥' || card.suit === '♦';

/** The family's deck with the cards already dealt taken out, one for one. */
export function remainingDeck(rules: Pick<FamilyRules, 'deck'>, dealt: readonly Card[]): Card[] {
  const deck = createDeck(rules.deck);
  for (const card of dealt) {
    const at = deck.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
    if (at >= 0) deck.splice(at, 1);
  }
  return deck;
}

/**
 * The rank test a guess at stage 1 or 2 makes. Mirrors isCorrectGuess in
 * localRound.ts and gamestate.py: Equal on card 2 is card 1's rank, Equal on
 * card 3 is either reference rank, and Inside / Outside are strict.
 */
function rankTest(stageIndex: number, choice: string, dealt: readonly Card[]): ((value: number) => boolean) | null {
  if (stageIndex === 1) {
    const ref = rankValue[dealt[0]!.rank];
    if (choice === 'higher') return (v) => v > ref;
    if (choice === 'lower') return (v) => v < ref;
    if (choice === 'equal') return (v) => v === ref;
  }
  if (stageIndex === 2) {
    const a = rankValue[dealt[0]!.rank];
    const b = rankValue[dealt[1]!.rank];
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (choice === 'inside') return (v) => v > lo && v < hi;
    if (choice === 'outside') return (v) => v < lo || v > hi;
    if (choice === 'equal') return (v) => v === lo || v === hi;
  }
  return null;
}

/**
 * What the card at `stageIndex` needs to be, given the cards dealt before it.
 *
 * `dealt` is every card turned so far in THIS round, in order; only the ones
 * before `stageIndex` are read. `total` is the deck left at that point - 52
 * minus the cards already out on the standard deck, 12 minus them on Three of
 * a Kind's - and `hits` how many of those land the guess.
 */
export function stageNeed(
  rules: Pick<FamilyRules, 'deck'>,
  stageIndex: number,
  choice: string,
  dealt: readonly Card[],
): StageNeed {
  const before = dealt.slice(0, stageIndex);
  const left = remainingDeck(rules, before);
  const total = left.length;

  if (choice === FREE_CHOICE) return { kind: 'free', hits: total, total };

  if (stageIndex === 0) {
    const color = choice === 'red' ? 'red' : 'black';
    const hits = left.filter((card) => isRed(card) === (color === 'red')).length;
    return { kind: 'color', color, hits, total };
  }

  if (stageIndex === 3) {
    const suit = SUIT_OF[choice] ?? '♥';
    return { kind: 'suit', suit, hits: left.filter((card) => card.suit === suit).length, total };
  }

  const test = rankTest(stageIndex, choice, before);
  if (!test) return { kind: 'ranks', ranks: [], hits: 0, total };
  // The family's own ranks, so Three of a Kind names only A, K or Q.
  const deckRanks = rules.deck ? RANK_ORDER.filter((rank) => rules.deck!.ranks.includes(rank)) : RANK_ORDER;
  return {
    kind: 'ranks',
    ranks: deckRanks.filter((rank) => test(rankValue[rank])),
    hits: left.filter((card) => test(rankValue[card.rank])).length,
    total,
  };
}

/**
 * The multiplier a correct guess at this stage pays - partialMultiplier on the
 * need's own odds, against the retention a miss here would bank. Equal to the
 * book's `payout` for the stage; stageOdds.test.ts holds it to that.
 */
export function stagePrice(
  rules: Pick<FamilyRules, 'retention' | 'forgive' | 'forgiveFrom' | 'targetRtp'>,
  stageIndex: number,
  need: StageNeed,
  forgivenessSpent: boolean,
): number {
  const probability = need.total > 0 ? need.hits / need.total : 0;
  return partialMultiplier(probability, stageIndex, stageRetention(rules, stageIndex, forgivenessSpent), decayFor(rules));
}

/**
 * A rank list as runs: "8–K", "A–3, 8–K", "4, 7", "5, 6". A run of three or
 * more is a range; two adjacent ranks read better named. An empty list - a
 * guess nothing left can land - is a dash.
 *
 * Ranks are ASCII and language-free (typography-and-assets.md), so this needs
 * no translation; the words around it do.
 */
export function formatRankRuns(list: readonly Card['rank'][]): string {
  if (!list.length) return '—';
  const values = [...new Set(list.map((rank) => rankValue[rank]))].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const value of values) {
    const last = runs[runs.length - 1];
    if (last && value === last[1] + 1) last[1] = value;
    else runs.push([value, value]);
  }
  const name = (value: number) => RANK_ORDER[value - 1]!;
  return runs
    .map(([lo, hi]) => (lo === hi ? name(lo) : hi === lo + 1 ? `${name(lo)}, ${name(hi)}` : `${name(lo)}–${name(hi)}`))
    .join(', ');
}
