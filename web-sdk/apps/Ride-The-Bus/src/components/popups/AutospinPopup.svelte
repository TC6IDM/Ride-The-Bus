<!-- The autoplay panel: presets, a count and the stop switches.

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
  import { jurisdiction } from '../../game/jurisdiction/jurisdiction.svelte';
  import {
    AUTOSPIN_PRESETS,
    auto,
    autoRoundsValid,
    formatAutoRounds,
    setAutoRounds,
    stepAutoRounds,
    toggleAutoInfinite,
  } from '../../game/round/autoplaySettings.svelte';
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
      <span class="popup-sub">{t('Number of Plays')}</span>
      <div class="spin-grid">
        {#each AUTOSPIN_PRESETS as p}
          <button class="spin-pill" class:active={!auto.infinite && Math.floor(Number(auto.roundsInput)) === p} onclick={() => setAutoRounds(p)}>{p}</button>
        {/each}
        <!-- Unlimited spans the last row: nine cells in a 4-column grid would
             otherwise leave a ragged single cell. -->
        <!-- A PEER pill, not a full-width bar. It used to span the whole last
             row because a ninth cell in a 4-column grid sat alone against
             three empty columns; the row wraps now, so unlimited is just the
             longest option in it. -->
        <button class="spin-pill spin-pill-inf" class:active={auto.infinite} onclick={toggleAutoInfinite} aria-label={t('Unlimited plays')}>{@render iconInfinity()}</button>
      </div>
      <div class="rounds-selector autospin-input">
        <div class="rounds-field">
          {#if auto.infinite}
            <span class="rounds-infinite">{@render iconInfinity()}</span>
          {:else}
            <input class="rounds-input" type="text" inputmode="numeric" bind:value={auto.roundsInput} onblur={formatAutoRounds} aria-label={t('Number of plays')} />
          {/if}
        </div>
        <!-- Plus and minus, matching the bet steppers on the control bar. The
             chevrons that were here made this the build's SECOND way to nudge
             a number, three inches from the first. -->
        <div class="rounds-stepper">
          <button type="button" class="stepper-btn" onclick={() => stepAutoRounds(1)} aria-label={t('More plays')}>{@render iconPlus()}</button>
          <button type="button" class="stepper-btn" onclick={() => stepAutoRounds(-1)} aria-label={t('Fewer plays')}>{@render iconMinus()}</button>
        </div>
      </div>
      <!-- One reason per failure, the same rule the spin button follows.
           This printed a flat "Enter a valid bet" for an unaffordable bet, a
           bet under the operator's floor and a bet over its ceiling alike -
           the exact boolean betBlockedReason() was written to replace, left
           behind in the one place that did not get the pass. And
           autoRoundsValid() was in `disabled` with no branch here at all, so
           an empty rounds field gave a dead button and no explanation. -->
      <button class="action-button popup-start" onclick={onstart} disabled={!betIsValid() || !allChoicesMade() || !autoRoundsValid()}>
        {#if !allChoicesMade()}{t('Pick all 4 guesses')}{:else if betBlockedReason()}{betBlockedReason()}{:else if !autoRoundsValid()}{t('Enter a number of plays')}{:else}{t('Start')}{/if}
      </button>
    </div>
  </div>

<style>
  @import '../../styles/popups/popup-base.css';
  @import '../../styles/popups/popup-autospin.css';
</style>
