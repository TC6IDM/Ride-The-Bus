<!-- The session's recent rounds - opened from the Last Win readout.

     There if the player wants it and nowhere if they do not: the board stays
     exactly as it was (no strip, no new control on the bar - Last Win was
     already the answer to "what happened last", so it is the way in to "and
     before that"). Display only; nothing here is a bet.

     Every figure speaks the game's one money unit: the payout in the player's
     currency and as a multiple of the BASE bet, beside what the round cost - the
     same pair the bar's Last Win and the takeover print. A partial return is
     neutral ink, never win colour (isNetWin, decided at settle).

     STYLES TRAVEL WITH THE MARKUP - styles/popups/popup-history.css, imported
     here and nowhere else; the colour comes in through the --tint contract. -->
<script lang="ts">
  import MarkIcon from '../icons/MarkIcon.svelte';
  import SuitIcon from '../icons/SuitIcon.svelte';
  import { t, type MessageKey } from '../../i18n/i18nDerived';
  import { numberToCurrencyString } from 'utils-shared/amount';
  import { formatMultiplier, formatTicket } from '../../game/ui/formatMultiplier';
  import { FAMILY_RULES, parseModeName } from '../../game/math/modes';
  import { volatilityColorVar } from '../../game/math/volatility';
  import { isRedSuit, suitName } from '../../game/ui/suitPaths';
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
      {#each history.rounds as entry (entry.id)}
        {@const named = picks(entry)}
        <li class="history-row" class:is-net={entry.net}>
          <div class="history-head">
            <span class="history-family" style={`--fam: ${volatilityColorVar(entry.family)}`}>{t(FAMILY_RULES[entry.family].label)}</span>
            <span class="history-cost"><span class="history-cap">{t('Bet')}</span> <span class="history-cost-figure">{cost(entry)}</span></span>
          </div>
          <div class="history-hand">
            {#each entry.cards as card, index (index)}
              {#if card}
                <span
                  class="history-card"
                  class:is-red={isRedSuit(card.suit)}
                  class:is-bust={index === entry.bustedIndex}
                  class:is-forgiven={index === entry.forgivenIndex}
                  >{card.rank}<SuitIcon suit={card.suit} scale={0.9} /><span class="visually-hidden">{suitSpoken(card.suit)}</span>{#if index === entry.bustedIndex}<span class="visually-hidden">, {t('Busted')}</span>{:else if index === entry.forgivenIndex}<span class="visually-hidden">, {t('Forgiven')}</span>{/if}<span class="visually-hidden">{', '}</span></span
                >
              {/if}
            {/each}
            {#if entry.ticket !== null}
              <span class="history-ticket"><span class="visually-hidden">{t('Ticket')} </span>{formatTicket(entry.ticket)}</span>
            {/if}
            <span class="history-paid">
              {#if entry.won > 0}
                <span class="history-amount">{numberToCurrencyString(entry.won)}</span> <span class="history-mult">{formatMultiplier(entry.multiplier)}</span>
              {:else}
                {t('Busted')}
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
  @import '../../styles/popups/popup-history.css';
</style>
