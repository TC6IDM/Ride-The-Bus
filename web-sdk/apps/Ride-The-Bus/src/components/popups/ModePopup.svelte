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
  import { FAMILY_BLURB, FAMILY_RULES } from '../../game/math/modes';
  import {
    FAMILIES_BY_VOLATILITY,
    FAMILY_BOLTS,
    FAMILY_BOLT_CEILING,
    VOLATILITY_BOLTS,
    volatilityColorRgbVar,
    volatilityColorVar,
  } from '../../game/math/volatility';
  import { bet, selectedCeiling, volatilityLabel } from '../../game/bet/betState.svelte';

  let { onclose }: { onclose: () => void } = $props();
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
              overflowAfter={FAMILY_BOLT_CEILING}
              label={volatilityLabel(FAMILY_BOLTS[bet.pending])}
            />
          </span>
        </span>
        <p class="mode-confirm-blurb">{t(FAMILY_BLURB[bet.pending])}</p>
        <p class="mode-confirm-max">{t('Max win')} {target.maxWin}× {t('Bet')}</p>
        <!-- The family's ceiling is the headline above; this is what the four
             guesses already on the board would top out at if the switch goes
             through. Only 8 of a family's 64 combinations reach the headline,
             so without this line the confirmation overstates most switches by
             about five times. -->
        {#if picked !== null && picked !== target.maxWin}
          <p class="mode-confirm-picked">
            {t('Your four guesses top out at %s your bet.').replace('%s', `${picked}×`)}
          </p>
        {/if}
        <!-- The figure is interpolated from FAMILY_RULES, not written into the
             string - the same fix the RTP line below already had, and for the
             same reason: it was baked into all 17 locale files where nothing
             could compare it to the cost the round is actually priced at.
             The word "Every" is the half a placeholder cannot fix; if the
             families ever stop sharing a cost, this sentence needs rewriting,
             not just re-interpolating. -->
        <p class="mode-confirm-cost">
          {t('Every mode costs %s× your bet.').replace('%s', String(target.cost))}
        </p>
        <div class="mode-confirm-actions">
          <button type="button" class="mode-confirm-cancel" onclick={() => (bet.pending = null)}>
            {t('Cancel')}
          </button>
          <button
            type="button"
            class="action-button mode-confirm-go"
            onclick={() => { bet.family = bet.pending!; onclose(); }}
          >
            {t('Switch')}
          </button>
        </div>
      </div>
    {:else}
    <div class="mode-list">
      <!-- Volatility order, not publication order. MODE_FAMILIES is
           ['base','sc','hs'] because that is what the math publishes, so these
           rows used to draw 3, 1, 5 bolts down the column - a ruler beside
           three values in no order. See FAMILIES_BY_VOLATILITY. -->
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
                overflowAfter={FAMILY_BOLT_CEILING}
                label={volatilityLabel(FAMILY_BOLTS[family])}
              />
            </span>
          </span>
          <span class="mode-option-blurb">{t(FAMILY_BLURB[family])}</span>
          <!-- Approval requires the maximum win per mode. Read from
               FAMILY_RULES rather than written into the blurb, so the figure
               exists once and a test can pin it to the payout maths. -->
          <span class="mode-option-max">{t('Max win')} {rules.maxWin}× {t('Bet')}</span>
        </button>
      {/each}
    </div>
    {/if}
    <!-- Interpolated from game/config.ts, not written into the string. The
         figure used to be baked into all 17 locale files, where nothing could
         compare it to the RTP the math is actually reweighted to. -->
    <p class="mode-note">
      {t('Every mode returns the same %s over many rounds. What changes is how often a round pays and how much it can pay.')
        .replace('%s', `${(gameConfig.rtp * 100).toFixed(2)}%`)}
    </p>
  </div>

<style>
  @import '../../styles/popups/popup-base.css';
  @import '../../styles/popups/popup-mode.css';
</style>
