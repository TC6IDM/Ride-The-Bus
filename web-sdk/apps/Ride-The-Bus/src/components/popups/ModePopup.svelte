<!-- The bet-mode picker, and the confirmation step approval asks for.

     Split out of Game.svelte when each control-bar panel became its own file.
     The `{#if openPopup === 'mode'}` that decides whether this is on screen
     stays with the parent - which panel is open is the component's own state -
     and this file is the panel itself.

     STYLES TRAVEL WITH THE MARKUP. A stylesheet is scoped to whichever
     component imports it (see the note atop ChoiceIcon.svelte), so
     styles/popup-mode.css is imported here and nowhere else. Colour still comes
     in through the one --tint contract every menu wears; nothing below names a
     colour of its own. -->
<script lang="ts">
  import BoltMeter from '../icons/BoltMeter.svelte';
  import MarkIcon from '../icons/MarkIcon.svelte';
  import gameConfig from '../../game/platform/config';
  import { t } from '../../i18n/i18nDerived';
  import { FAMILY_BLURB, FAMILY_RULES, stageCount } from '../../game/math/modes';
  import { clearBoard } from '../../game/round/roundState.svelte';
  import {
    FAMILIES_BY_VOLATILITY,
    FAMILY_BOLTS,
    VOLATILITY_BOLTS,
    volatilityColorRgbVar,
    volatilityColorVar,
  } from '../../game/math/volatility';
  import { bet, selectedCeiling, volatilityLabel } from '../../game/bet/betState.svelte';

  let { onclose }: { onclose: () => void } = $props();

  // The panel opens on its LIST, always. `bet.pending` survives a close - it
  // is bet state, not panel state, and the panel is destroyed and remade on
  // every open - so a mode confirmed, or a confirmation abandoned by closing
  // the panel, came back as that same confirmation the next time. Cleared on
  // mount rather than on close so every way of leaving is covered.
  bet.pending = null;
</script>

  <!-- Wears the family's own colour, the same one the MODE button that
       opened it is wearing. The ROWS inside still set their own per-family
       colour; this is the shell around them. -->
  <div
    class="popup popup-mode"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    aria-label={t('Game Mode')}
    style={`--tint: ${volatilityColorVar(bet.family)}; --tint-rgb: ${volatilityColorRgbVar(bet.family)}; --tint-strong: ${volatilityColorVar(bet.family)}`}
  >
    <div class="popup-head">
      <span>{bet.pending ? t('Switch mode?') : t('Game Mode')}</span>
      <button class="popup-close" onclick={onclose} aria-label={t('Close')}><MarkIcon name="cross" /></button>
    </div>

    {#if bet.pending}
      <!-- The confirmation step approval asks for. It restates what the
           player is about to buy - the mode, what a miss keeps, the ceiling
           and the volatility - from the same FAMILY_RULES and FAMILY_BLURB
           the list rows read, so the two can never describe a mode
           differently. -->
      {@const target = FAMILY_RULES[bet.pending]}
      {@const picked = selectedCeiling(bet.pending)}
      <div
        class="mode-confirm"
        style={`--vol-color: ${volatilityColorVar(bet.pending)}; --vol-rgb: ${volatilityColorRgbVar(bet.pending)}`}
      >
        <span class="mode-confirm-head">
          <span class="mode-confirm-name">{t(target.label)}</span>
          <span
            class="mode-option-vol"
            style={`--vol-color: ${volatilityColorVar(bet.pending)}`}
          >
            <BoltMeter
              lit={FAMILY_BOLTS[bet.pending]}
              total={VOLATILITY_BOLTS}
              label={volatilityLabel(FAMILY_BOLTS[bet.pending])}
            />
          </span>
        </span>
        <p class="mode-confirm-blurb">{t(FAMILY_BLURB[bet.pending])}</p>
        <!-- The cost, when it is not the base 1x. Stake's checklist wants a
             high-cost mode to state its cost before it is activated, and this
             confirmation IS that step. Formatted through the same %c the
             foot note uses so the two figures cannot disagree. -->
        {#if target.cost !== 1}
          <p class="mode-confirm-cost">{t('Costs %c× your bet').replace('%c', String(target.cost))}</p>
        {/if}
        <p class="mode-confirm-max">{t('Max win %s your bet').replace('%s', `${target.maxWin}×`)}</p>
        <!-- The family's ceiling is the headline above; this is what the four
             guesses already on the board would top out at if the switch goes
             through. Only 8 of a family's 64 combinations reach the headline,
             so without this line the confirmation overstates most switches by
             about five times.
             Shown whenever the guesses are complete, INCLUDING when the two
             figures agree. It used to hide itself in that case so the eight
             max-reaching combinations were not told the same number twice -
             but from the player's side that read as the line simply failing to
             appear for their pick, and the two figures agreeing IS the
             information.
             Not on a family with no guesses: "your four guesses" would be
             naming picks the player did not make, and its one figure IS the
             headline above. -->
        {#if picked !== null && !target.fixedChoices}
          <p class="mode-confirm-picked">
            {t('Your four guesses top out at %s your bet.').replace('%s', `${picked}×`)}
          </p>
        {/if}
        <!-- No "costs 1x" line on the three four-guess families: it restated
             what the bet readout already shows and read as though the switch
             carried a price. The cost line above appears only where the cost
             is real; the note at the foot of this panel and How to Play state
             it for every mode, which is where Stake's checklist looks. -->
        <div class="mode-confirm-actions">
          <button type="button" class="mode-confirm-cancel" onclick={() => (bet.pending = null)}>
            {t('Cancel')}
          </button>
          <button
            type="button"
            class="action-button mode-confirm-go"
            onclick={() => {
              const to = bet.pending!;
              // A switch that changes the number of cards dealt turns the
              // last round's cards back over - see clearBoard.
              if (stageCount(FAMILY_RULES[to]) !== stageCount(FAMILY_RULES[bet.family])) clearBoard();
              bet.family = to;
              bet.pending = null;
              onclose();
            }}
          >
            {t('Switch')}
          </button>
        </div>
      </div>
    {:else}
    <div class="mode-list">
      <!-- Volatility order, not publication order. MODE_FAMILIES is
           ['base','sc','hs','tr'] because that is what the math publishes, so
           these rows used to draw 3, 1, 5 bolts down the column - a ruler
           beside values in no order. See FAMILIES_BY_VOLATILITY. -->
      {#each FAMILIES_BY_VOLATILITY as family}
        {@const rules = FAMILY_RULES[family]}
        <button
          type="button"
          class="mode-option"
          class:selected={bet.family === family}
          {...bet.family === family ? { 'aria-current': 'true' } : {}}
          style={`--vol-color: ${volatilityColorVar(family)}; --vol-rgb: ${volatilityColorRgbVar(family)}`}
          onclick={() => {
            // Re-picking the mode already in play is a no-op, so it closes
            // rather than asking the player to confirm something that would
            // change nothing.
            if (family === bet.family) onclose();
            else bet.pending = family;
          }}
        >
          <span class="mode-option-head">
            <span class="mode-option-name">{t(rules.label)}</span>
            <!-- Volatility, opposite the name. Every mode returns the same
                 96.00%, so the ceiling on the row below is only half the
                 story - this is the other half, and the ordering behind it
                 holds for every guess combination, not on average. See
                 game/volatility.ts. -->
            <!-- The FAMILY's own rating, without the guesses. The bet display
                 adds one stop per Equal pick on top; this row is what the mode
                 contributes before any of that, which is the only part of the
                 number choosing a mode actually changes. Drawn on the same
                 seven stops as the bar so the two are one ruler. -->
            <!-- --vol-color now comes from the row itself, which needs it
                 for its own border and wash - so the meter simply inherits
                 it rather than carrying a second copy. -->
            <span class="mode-option-vol">
              <BoltMeter
                lit={FAMILY_BOLTS[family]}
                total={VOLATILITY_BOLTS}
                  label={volatilityLabel(FAMILY_BOLTS[family])}
              />
            </span>
          </span>
          <span class="mode-option-blurb">{t(FAMILY_BLURB[family])}</span>
          <!-- Approval requires the maximum win per mode. Read from
               FAMILY_RULES rather than written into the blurb, so the figure
               exists once and a test can pin it to the payout maths. -->
          <span class="mode-option-max">{t('Max win %s your bet').replace('%s', `${rules.maxWin}×`)}</span>
          <!-- And the cost, on the one family where it is not 1x. Approval
               wants "description and cost information" per mode; the other
               three carry it in the foot note, which says every mode. -->
          {#if rules.cost !== 1}
            <span class="mode-option-cost">{t('Costs %c× your bet').replace('%c', String(rules.cost))}</span>
          {/if}
        </button>
      {/each}
    </div>
    {/if}
    <!-- Cost and RTP in one sentence, both interpolated - from FAMILY_RULES
         and game/config.ts - rather than written into the string. They used
         to be baked into all 17 locale files, where nothing could compare
         them to the cost a round is priced at or the RTP the math is
         reweighted to. "This mode", not "Every mode": the families stopped
         sharing a cost when Three of a Kind arrived at 250x, which is the
         rewrite the old comment here said the word "Every" would need.
         The mode it names is the one BEING CONFIRMED when the confirmation is
         up, and the live one otherwise - it read the live family only, so a
         player confirming High Stakes from Three of a Kind was told "this mode
         costs 250x" about the mode they were leaving. -->
    <p class="mode-note">
      {t('This mode costs %c× your bet. Every mode returns the same %s over many rounds; what changes is how often a round pays and how much it can pay.')
        .replace('%c', String(FAMILY_RULES[bet.pending ?? bet.family].cost))
        .replace('%s', `${(gameConfig.rtp * 100).toFixed(2)}%`)}
    </p>
  </div>

<style>
  @import '../../styles/popups/popup-base.css';
  @import '../../styles/popups/popup-mode.css';
</style>
