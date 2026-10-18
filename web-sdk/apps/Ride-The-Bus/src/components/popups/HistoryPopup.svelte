<!-- The session's recent rounds - opened from the Last Win readout.

     There if the player wants it and nowhere if they do not: the board stays
     exactly as it was (no strip, no new control on the bar - Last Win was
     already the answer to "what happened last", so it is the way in to "and
     before that"). Display only; nothing here is a bet.

     Every figure speaks the game's one money unit: the payout in the player's
     currency and as a multiple of the BASE bet, beside what the round cost - the
     same pair the bar's Last Win and the takeover print. A partial return is
     neutral ink, never win colour (isNetWin, decided at settle).

     TICKET STUBS (the owner's pick R1, 2026-10-17): each round is a stub of
     the card stock, dimmed a step so the hand printed on it reads first - the
     cards are the real CardFace at their compact size, with the board's own
     marks (the cross, the forgiven arrow). Every stub says how the round
     ended in the board's four words, so a kept share is "Kept $0.50", never a
     bare figure that looked like a win.

     STYLES TRAVEL WITH THE MARKUP - styles/popups/popup-history.css, imported
     here and nowhere else; the colour comes in through the --tint contract. -->
<script lang="ts">
  import MarkIcon from '../icons/MarkIcon.svelte';
  import CardFace from '../cards/CardFace.svelte';
  import { t, type MessageKey } from '../../i18n/i18nDerived';
  import { numberToCurrencyString } from 'utils-shared/amount';
  import { formatMultiplier, formatTicket } from '../../game/ui/formatMultiplier';
  import { FAMILY_RULES, parseModeName } from '../../game/math/modes';
  import { volatilityColorVar } from '../../game/math/volatility';
  import { suitName } from '../../game/ui/suitPaths';
  import { history } from '../../game/round/roundHistory.svelte';
  import type { HistoryEntry } from '../../game/round/historyList';

  let { onclose }: { onclose: () => void } = $props();

  /** Each pick as the board's own buttons name it. */
  const PICK_KEY: Record<string, MessageKey> = {
    red: 'Red',
    black: 'Black',
    higher: 'Higher',
    lower: 'Lower',
    equal: 'Equal',
    inside: 'Inside',
    outside: 'Outside',
    heart: 'Heart',
    diamond: 'Diamond',
    club: 'Club',
    spade: 'Spade',
  };

  /** The four picks as the board names them - none on a family with no guesses. */
  function picks(entry: HistoryEntry): string[] {
    if (FAMILY_RULES[entry.family].fixedChoices || !entry.mode) return [];
    const parsed = parseModeName(entry.mode);
    if (!parsed) return [];
    return [parsed.color, parsed.higherLower, parsed.insideOutside, parsed.suit]
      .map((pick) => PICK_KEY[String(pick)])
      .filter((key): key is MessageKey => key !== undefined)
      .map((key) => t(key));
  }

  /** The suit spoken: the drawn mark is aria-hidden, so without this a card reads as its rank alone. */
  const suitSpoken = (suit: string) => {
    const key = PICK_KEY[suitName(suit)];
    return key ? ` ${t(key)}` : '';
  };

  /**
   * How the round ended, in the board's four words (GameBoard's resultLabel):
   * every guess right, a ride that finished with a miss forgiven, a bust that
   * kept a share, or a bust that kept nothing. `sweep` is isCleanSweep, taken
   * at settle; a round that paid without one either busted and kept a share
   * or was forgiven and finished.
   */
  function resultWord(entry: HistoryEntry): string {
    if (entry.won <= 0) return t('Busted');
    if (entry.sweep) return t('Full game win');
    return entry.bustedIndex !== null ? t('Kept') : t('Won');
  }

  /** The cost, as the bar's bet display prints it: "$250.00 ($1.00 × 250)" on Three of a Kind. */
  function cost(entry: HistoryEntry): string {
    const rules = FAMILY_RULES[entry.family];
    return rules.cost > 1
      ? `${numberToCurrencyString(entry.cost)} (${numberToCurrencyString(entry.bet)} × ${rules.cost})`
      : numberToCurrencyString(entry.cost);
  }
</script>

<div class="popup popup-history" role="dialog" aria-modal="true" tabindex="-1" aria-label={t('Recent rounds')}>
  <div class="popup-head">
    <span>{t('Recent rounds')}</span>
    <button class="popup-close" onclick={onclose} aria-label={t('Close')}><MarkIcon name="cross" /></button>
  </div>

  {#if history.rounds.length === 0}
    <p class="history-empty">{t('No rounds yet this session.')}</p>
  {:else}
    <ol class="history-list">
      {#each history.rounds as entry, order (entry.id)}
        {@const named = picks(entry)}
        <li class="history-row" class:is-net={entry.net} style={`--fam: ${volatilityColorVar(entry.family)}; --i: ${order}`}>
          <div class="history-head">
            <span class="history-family">{t(FAMILY_RULES[entry.family].label)}</span>
            <span class="history-cost"><span class="history-cap">{t('Bet')}</span> <span class="history-cost-figure">{cost(entry)}</span></span>
          </div>
          <div class="history-hand">
            {#each entry.cards as card, index (index)}
              {#if card}
                <span
                  class="history-card"
                  class:is-bust={index === entry.bustedIndex}
                  class:is-forgiven={index === entry.forgivenIndex}
                >
                  <CardFace rank={card.rank} suit={card.suit} />
                  {#if index === entry.bustedIndex}
                    <span class="history-mark is-bust" aria-hidden="true"><MarkIcon name="cross" /></span>
                  {:else if index === entry.forgivenIndex}
                    <span class="history-mark is-forgiven" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 3v5h-5" /></svg>
                    </span>
                  {/if}
                  <span class="visually-hidden">{card.rank}{suitSpoken(card.suit)}{#if index === entry.bustedIndex}, {t('Busted')}{:else if index === entry.forgivenIndex}, {t('Forgiven')}{/if}{', '}</span>
                </span>
              {/if}
            {/each}
            {#if entry.ticket !== null}
              <span class="history-ticket"><span class="visually-hidden">{t('Ticket')} </span>{formatTicket(entry.ticket)}</span>
            {/if}
            <span class="history-paid">
              <span class="history-word">{resultWord(entry)}</span>
              {#if entry.won > 0}
                <span class="history-amount">{numberToCurrencyString(entry.won)}</span> <span class="history-mult">{formatMultiplier(entry.multiplier)}</span>
              {/if}
            </span>
          </div>
          {#if named.length}
            <div class="history-picks">
              {#each named as pick, index (index)}{#if index > 0}<span class="history-sep"><span class="visually-hidden">{', '}</span></span>{/if}<span>{pick}</span>{/each}
            </div>
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  @import '../../styles/popups/popup-base.css';
  @import '../../styles/popups/popup-head.css';
  @import '../../styles/popups/popup-history.css';
</style>
