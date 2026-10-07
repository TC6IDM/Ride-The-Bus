/**
 * The session's recent rounds, for the history panel the Last Win readout
 * opens. The data shape and the list rules are historyList.ts (pure, tested);
 * this holds the one reactive list and the call that adds to it.
 *
 * Downstream of the round: roundSettle records into it, the panel reads it,
 * and nothing here reaches back into a round or a bet.
 */
import { HISTORY_CAP, pushRound, type HistoryEntry } from './historyList';

export const history = $state({ rounds: [] as HistoryEntry[] });

let sequence = 0;

/** Add a settled round at the top of the list. */
export function recordRound(entry: Omit<HistoryEntry, 'id'>) {
  sequence += 1;
  history.rounds = pushRound(history.rounds, { ...entry, id: sequence }, HISTORY_CAP);
}
