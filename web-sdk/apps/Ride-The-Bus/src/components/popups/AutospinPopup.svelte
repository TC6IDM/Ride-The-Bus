<!-- The autoplay panel: presets, a count, what stops a run, and Start.

     Split out of Game.svelte when each control-bar panel became its own file.
     The `{#if openPopup === 'autospin'}` that decides whether this is on screen
     stays with the parent - which panel is open is the component's own state -
     and this file is the panel itself.

     STYLES TRAVEL WITH THE MARKUP. A stylesheet is scoped to whichever
     component imports it (see the note atop ChoiceIcon.svelte), so
     styles/popup-autospin.css is imported here and nowhere else. Colour still comes
     in through the one --tint contract every menu wears; nothing below names a
     colour of its own. -->
<script lang="ts">
  import MarkIcon from '../icons/MarkIcon.svelte';
  import { t } from '../../i18n/i18nDerived';
  import {
    AUTOSPIN_PRESETS,
    auto,
    autoRoundsValid,
    formatAutoRounds,
    setAutoRounds,
    stepAutoRounds,
    stops,
    toggleAutoInfinite,
  } from '../../game/round/autoplaySettings.svelte';
  import { parseLimit, type LimitSetting } from '../../game/round/autoplayLimits';
  import { currencySymbol } from '../../game/bet/currencySymbol';
  import { stateBet } from 'state-shared';
  import { stopAuto } from '../../game/round/autoplayLoop.svelte';
  import {
    allChoicesMade,
    betBlockedReason,
    betIsValid,
  } from '../../game/bet/betState.svelte';

  let {
    onclose,
    onstart,
  }: {
    onclose: () => void;
    /** Start the run. The parent closes this panel first. */
    onstart: () => void;
  } = $props();

  /** The two limit rows, in the order the panel draws them. */
  const LIMITS = [
    { key: 'lossLimit', id: 'autoplay-stop-loss', label: () => t('Stop on a loss of') },
    { key: 'winLimit', id: 'autoplay-stop-win', label: () => t('Stop on a single win of') },
  ] as const;

  /**
   * A field that stops parsing switches its limit off, so the toggle never
   * shows "on" over a figure that would not stop anything.
   */
  function onLimitInput(setting: LimitSetting) {
    if (parseLimit(setting.input) === null) setting.on = false;
  }
</script>

<!-- The three drawn glyphs this panel uses, DUPLICATED rather than passed down
     from Game.svelte as snippets.
     They are six lines of inline SVG each, and duplicating them is what lets
     the sizing travel with the markup: the bar's copies are sized by
     control-bar.css and these by popup-autospin.css. That retires the ordering
     hazard the old popups.css noted - "control-bar.css imports first and sizes
     its own" - because the two are now in different scopes entirely. -->
{#snippet iconInfinity()}
  <svg class="inf-icon" viewBox="0 0 24 12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path
      d="M12 6C10.5 3.6 8.7 2 6.6 2 4.1 2 2.6 3.8 2.6 6s1.5 4 4 4c2.1 0 3.9-1.6 5.4-4 1.5-2.4 3.3-4 5.4-4 2.5 0 4 1.8 4 4s-1.5 4-4 4c-2.1 0-3.9-1.6-5.4-4Z"
    />
  </svg>
{/snippet}

{#snippet iconPlus()}
  <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
    <path d="M12 4.5v15" />
    <path d="M4.5 12h15" />
  </svg>
{/snippet}

{#snippet iconMinus()}
  <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
    <path d="M4.5 12h15" />
  </svg>
{/snippet}


  <div class="popup popup-autospin" role="dialog" aria-modal="true" tabindex="-1" aria-label={t('Autoplay')}>
    <div class="popup-head"><span>{t('Autoplay')}</span><button class="popup-close" onclick={onclose} aria-label={t('Close')}><MarkIcon name="cross" /></button></div>
    <div class="autospin-body">
      <span class="popup-sub">{t('Number of plays')}</span>
      <div class="spin-grid">
        {#each AUTOSPIN_PRESETS as p}
          <button class="spin-pill" class:active={!auto.infinite && Math.floor(Number(auto.roundsInput)) === p} disabled={auto.running} onclick={() => setAutoRounds(p)}>{p}</button>
        {/each}
        <!-- Unlimited spans the last row: nine cells in a 4-column grid would
             otherwise leave a ragged single cell. -->
        <!-- A PEER pill, not a full-width bar. It used to span the whole last
             row because a ninth cell in a 4-column grid sat alone against
             three empty columns; the row wraps now, so unlimited is just the
             longest option in it. -->
        <button class="spin-pill spin-pill-inf" class:active={auto.infinite} disabled={auto.running} onclick={toggleAutoInfinite} aria-label={t('Unlimited plays')}>{@render iconInfinity()}</button>
      </div>
      <div class="rounds-selector autospin-input">
        <div class="rounds-field">
          {#if auto.infinite}
            <span class="rounds-infinite">{@render iconInfinity()}</span>
          {:else}
            <input class="rounds-input" name="autoplay-rounds" autocomplete="off" type="text" inputmode="numeric" bind:value={auto.roundsInput} onblur={formatAutoRounds} disabled={auto.running} aria-label={t('Number of plays')} />
          {/if}
        </div>
        <!-- Plus and minus, matching the bet steppers on the control bar. The
             chevrons that were here made this the build's SECOND way to nudge
             a number, three inches from the first. -->
        <div class="rounds-stepper">
          <button type="button" class="stepper-btn" disabled={auto.running} onclick={() => stepAutoRounds(1)} aria-label={t('More plays')}>{@render iconPlus()}</button>
          <button type="button" class="stepper-btn" disabled={auto.running} onclick={() => stepAutoRounds(-1)} aria-label={t('Fewer plays')}>{@render iconMinus()}</button>
        </div>
      </div>
      <!-- WHAT ENDS A RUN, all on this panel. Two of these used to be the whole
           of a separate "Advanced" panel behind a sliders button on the bar;
           that button is gone and MODE has its place (ControlBar.svelte).

           Every one is PASSIVE: it ends a run or shortens an animation and never
           touches the stake.

           THE TWO LIMITS are typed, not picked: a figure, its unit - x (times
           the BASE bet, the multiplier the game prints at the end of a round) or
           the player's currency - and a button to its right that arms it and
           stays pressed while it is armed. autoplayLimits.ts has the rule.
           The empty field shows a dash, not "0": a grey zero read as a limit
           already set to nothing, and zero is not a figure a limit accepts. -->
      {#each LIMITS as row (row.key)}
        {@const setting = stops[row.key]}
        {@const usable = parseLimit(setting.input) !== null}
        <div class="limit-group">
          <label class="control-label" for={row.id}>{row.label()}</label>
          <div class="limit-row">
            <div class="limit-field" class:is-on={setting.on}>
              <input
                id={row.id}
                name={row.id}
                class="limit-input"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                placeholder="—"
                bind:value={setting.input}
                oninput={() => onLimitInput(setting)}
              />
              <!-- The unit, inside the field it qualifies. x is times the base
                   bet; the other is the player's own currency symbol (never a
                   hardcoded $ - social mode's SC and GC print their codes). -->
              <div class="limit-unit" role="group">
                <button type="button" class="limit-unit-btn" class:active={setting.unit === 'x'} aria-pressed={setting.unit === 'x'} aria-label={t('Times your base bet')} onclick={() => (setting.unit = 'x')}>×</button>
                <button type="button" class="limit-unit-btn" class:active={setting.unit === 'cash'} aria-pressed={setting.unit === 'cash'} aria-label={stateBet.currency || currencySymbol()} onclick={() => (setting.unit = 'cash')}>{currencySymbol()}</button>
              </div>
            </div>
            <!-- Arms the limit. A toggle, pressed while armed; greyed until the
                 field holds a figure it could stop on. -->
            <button
              type="button"
              class="limit-toggle"
              class:on={setting.on && usable}
              aria-pressed={setting.on && usable}
              aria-label={row.label()}
              disabled={!usable}
              onclick={() => (setting.on = !setting.on)}
            ><MarkIcon name="check" /></button>
          </div>
        </div>
      {/each}
      <span class="limit-note">{t('× means times your base bet.')}</span>

      <!-- The two switches, one above the other in their order, directly above
           the panel's one action. The second changes only how the next
           celebration looks, never the round. -->
      <div class="stop-switches">
        <div class="stop-row">
          <span class="control-label">{t('Stop autoplay on full game win')}</span>
          <button type="button" class="switch" class:on={stops.onFullWin} role="switch" aria-checked={stops.onFullWin} aria-label={t('Stop autoplay on full game win')} onclick={() => (stops.onFullWin = !stops.onFullWin)}><span class="switch-knob"></span></button>
        </div>
        <div class="stop-row">
          <span class="control-label">{t('Skip win animations on autoplay')}</span>
          <button type="button" class="switch" class:on={stops.skipWinOnAuto} role="switch" aria-checked={stops.skipWinOnAuto} aria-label={t('Skip big win animations during autoplay')} onclick={() => (stops.skipWinOnAuto = !stops.skipWinOnAuto)}><span class="switch-knob"></span></button>
        </div>
      </div>
      <!-- One reason per failure, the same rule the spin button follows.
           This printed a flat "Enter a valid bet" for an unaffordable bet, a
           bet under the operator's floor and a bet over its ceiling alike -
           the exact boolean betBlockedReason() was written to replace, left
           behind in the one place that did not get the pass. And
           autoRoundsValid() was in `disabled` with no branch here at all, so
           an empty rounds field gave a dead button and no explanation. -->
      <!-- During a run the panel is open for its stops, which the loop reads
           every round; the count is spoken for, so it is locked above, and the
           one action is to end the run - the same Stop the deal button offers. -->
      {#if auto.running}
        <button class="action-button popup-start" onclick={() => { stopAuto(); onclose(); }}>{t('Stop autoplay')}</button>
      {:else}
        <button class="action-button popup-start" onclick={onstart} disabled={!betIsValid() || !allChoicesMade() || !autoRoundsValid()}>
          {#if !allChoicesMade()}{t('Pick all 4 guesses')}{:else if betBlockedReason()}{betBlockedReason()}{:else if !autoRoundsValid()}{t('Enter a number of plays')}{:else}{t('Start')}{/if}
        </button>
      {/if}
    </div>
  </div>

<style>
  @import '../../styles/popups/popup-base.css';
  @import '../../styles/popups/popup-autospin.css';
</style>
