<!-- The bet menu: a free-entry field and the chip rack.

     Split out of Game.svelte when each control-bar panel became its own file.
     The `{#if openPopup === 'bet'}` that decides whether this is on screen
     stays with the parent - which panel is open is the component's own state -
     and this file is the panel itself.

     STYLES TRAVEL WITH THE MARKUP. A stylesheet is scoped to whichever
     component imports it (see the note atop ChoiceIcon.svelte), so
     styles/popup-bet.css is imported here and nowhere else. Colour still comes
     in through the one --tint contract every menu wears; nothing below names a
     colour of its own. -->
<script lang="ts">
  import MarkIcon from '../icons/MarkIcon.svelte';
  import { t } from '../../i18n/i18nDerived';
  import { numberToCurrencyString } from 'utils-shared/amount';
  import { chipColour, splitChipLabel } from '../../game/bet/betChips';
  import { labelEms } from '../../game/ui/typeFit';
  import { currencySymbol } from '../../game/bet/currencySymbol';
  import {
    bet,
    betLevels,
    betValue,
    familyRules,
    formatBetInput,
    modeNameColor,
    modeRgb,
    roundCost,
  } from '../../game/bet/betState.svelte';

  let {
    onclose,
    onpick,
    oncommit,
  }: {
    onclose: () => void;
    /** Chosen from the rack. The parent also closes this panel. */
    onpick: (level: number) => void;
    /** Enter in the entry field: snap the amount, then close. */
    oncommit: (event: KeyboardEvent) => void;
  } = $props();
</script>

  <!-- The live rating, matching the bet display and its steppers exactly -
       this panel is what that control opens. -->
  <div
    class="popup popup-bet"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    aria-label={t('Bet Menu')}
    style={`--tint: ${modeNameColor()}; --tint-rgb: ${modeRgb()}; --tint-strong: ${modeNameColor()}`}
  >
    <div class="popup-head"><span>{t('Bet Menu')}</span><button class="popup-close" onclick={onclose} aria-label={t('Close')}><MarkIcon name="cross" /></button></div>
    <div class="bet-entry">
      <span class="bet-entry-cur">{currencySymbol()}</span>
      <!-- Enter commits. Typing an amount and pressing Enter is what every
           text field in a form does, and without it the only way out of this
           field was to tap the panel's close button - which reads as
           cancelling, not confirming, so a typed amount felt unsafe. -->
      <input
        class="bet-entry-input"
        type="text"
        inputmode="decimal"
        bind:value={bet.input}
        onblur={formatBetInput}
        onkeydown={oncommit}
        placeholder="0.00"
        aria-label={t('Custom bet amount')}
      />
    </div>
    <span class="popup-sub">{t('Quick Bets')}</span>
    <!-- Quick picks show what the round will COST, matching the control bar.
         Showing the base bet here and the cost there would leave a player
         tapping "10.00" and being charged 20.00 with no way to connect the
         two. The base bet is on the second line where the mode multiplies. -->
    <!-- CHIPS, not a grid of cells. The table this popup floats over is laid
         with five sampled chip denominations, and the bet picker used to be
         grey rectangles - a card-and-chips game choosing its money out of a
         generic UI grid. Same colours as the felt (tokens.css), drawn
         top-down rather than in the table's perspective.

         A wrapping ROW, not a grid: betLevels() is the RGS's list and can be
         any length, and the old 4-across grid left a ragged 4/4/2 last row.
         Chips wrap ragged without looking broken. -->
    <div class="bet-chips">
      {#each betLevels() as lv, index}
        {@const label = splitChipLabel(numberToCurrencyString(roundCost(lv)))}
        <button
          class="bet-chip chip-{chipColour(index, betLevels().length)}"
          class:active={Math.abs(betValue() - lv) < 1e-9}
          aria-pressed={Math.abs(betValue() - lv) < 1e-9}
          aria-label={numberToCurrencyString(roundCost(lv))}
          onclick={() => onpick(lv)}
        >
          <!-- --ems is how wide this label prints, so the CSS can solve a
               font-size that FILLS the face rather than every chip sharing
               one constant sized for a worst case that never arrives. See
               labelEms() and the note on .bet-chip-value. -->
          <span class="bet-chip-face" class:has-cur={label.currency.length > 1}>
            <!-- A SYMBOL rides with the number - "$1,000" is what a chip in
                 this currency says. A CODE cannot: "NOK 12,500" is ten
                 characters and there is no legible size for that on a disc,
                 so it takes its own line above. Either way the figure keeps
                 its money sign. -->
            {#if label.currency.length > 1}
              <span class="bet-chip-cur" style="--cur-ems: {labelEms(label.currency)}">
                {label.currency}
              </span>
              <span
                class="bet-chip-value"
                class:cb-val-multiplied={familyRules().cost !== 1}
                style="--ems: {labelEms(label.amount)}"
              >
                {label.amount}
              </span>
            {:else}
              <span
                class="bet-chip-value"
                class:cb-val-multiplied={familyRules().cost !== 1}
                style="--ems: {labelEms(label.currency + label.amount)}"
              >
                {label.currency}{label.amount}
              </span>
            {/if}
          </span>
        </button>
      {/each}
    </div>
  </div>

<style>
  @import '../../styles/popups/popup-base.css';
  @import '../../styles/popups/popup-bet.css';
</style>
