/**
 * The session's recent rounds, as plain data - the pure half of roundHistory.
 *
 * Display only. Nothing here is read back into a bet: Stake Engine bets are
 * stateless, and this list is what the player has already seen settle, kept so
 * they can look back at it (the Last Win readout opens it). Session-only: it
 * is not stored, so a reload starts it empty.
 *
 * SNAPSHOTTED, never referenced. `round.revealedCards` is reused by the next
 * deal; an entry that pointed at it would rewrite every past row the moment a
 * new card turned - the same reason the win takeover snapshots its hand.
 */
import type { ModeFamily } from '../math/modes.ts';

/** The last ten rounds - as many as a phone panel shows without feeling like a ledger. */
export const HISTORY_CAP = 10;

export type HistoryCard = { rank: string; suit: string } | null;

export type HistoryEntry = {
  id: number;
  family: ModeFamily;
  /** The mode slug the round was bought on, or null if it could not be built. */
  mode: string | null;
  cards: HistoryCard[];
  bustedIndex: number | null;
  forgivenIndex: number | null;
  /** Last Stop's ticket, when one was drawn. */
  ticket: number | null;
  /** The base bet, and what the round actually cost (250x it on Three of a Kind). */
  bet: number;
  cost: number;
  /** The payout, and the same as a multiple of the BASE bet - the unit every other figure uses. */
  won: number;
  multiplier: number;
  /** Paid more than it cost (isNetWin) - the only rows shown in win colour. */
  net: boolean;
  /** isCleanSweep: every guess right, forgiven ones excepted. */
  sweep: boolean;
};

/** A copy of the dealt cards that the next deal cannot reach. */
export function snapshotCards(cards: readonly ({ rank: string; suit: string } | null | undefined)[]): HistoryCard[] {
  return cards.map((card) => (card ? { rank: card.rank, suit: card.suit } : null));
}

/** The list with `entry` added at the top, cut to `cap`. Never mutates `list`. */
export function pushRound(list: readonly HistoryEntry[], entry: HistoryEntry, cap = HISTORY_CAP): HistoryEntry[] {
  return [entry, ...list].slice(0, Math.max(0, cap));
}
