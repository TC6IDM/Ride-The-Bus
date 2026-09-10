<!-- The turbo speed slider.

     Split out of Game.svelte when each control-bar panel became its own file.
     The `{#if openPopup === 'turbo'}` that decides whether this is on screen
     stays with the parent - which panel is open is the component's own state -
     and this file is the panel itself.

     STYLES TRAVEL WITH THE MARKUP. A stylesheet is scoped to whichever
     component imports it (see the note atop ChoiceIcon.svelte), so
     styles/popup-turbo.css is imported here and nowhere else. Colour still comes
     in through the one --tint contract every menu wears; nothing below names a
     colour of its own. -->
<script lang="ts">
  import MarkIcon from '../icons/MarkIcon.svelte';
  import { t } from '../../i18n/i18nDerived';
  import { jurisdiction, TURBO_CAP_WITHOUT_SUPER } from '../../game/jurisdiction/jurisdiction.svelte';
  import { onTurboInput, pacing } from '../../game/round/revealPacing.svelte';

  let { onclose }: { onclose: () => void } = $props();
</script>

  <div class="popup popup-turbo" role="dialog" aria-modal="true" tabindex="-1" aria-label={t('Turbo speed')}>
    <div class="popup-head"><span>{t('Turbo Speed')}</span><button class="popup-close" onclick={onclose} aria-label={t('Close')}><MarkIcon name="cross" /></button></div>
    <div class="turbo-body">
      <div class="turbo-track">
        <span class="turbo-end">{t('Normal')}</span>
        <!-- The track's own max is capped when super turbo is barred, so the
             slider can't even be dragged to instant - the clamp above is the
             backstop, this is the affordance. -->
        <input
          class="turbo-slider"
          type="range"
          min="0"
          max={jurisdiction.superTurboDisabled() ? TURBO_CAP_WITHOUT_SUPER : 1}
          step="0.05"
          bind:value={pacing.turboSpeed}
          oninput={onTurboInput}
          aria-label={t('Turbo speed')}
        />
        <span class="turbo-end">{jurisdiction.superTurboDisabled() ? t('Fast') : t('Instant')}</span>
      </div>
      <div class="turbo-readout">{pacing.turboSpeed <= 0 ? t('Off — full animation') : pacing.turboSpeed >= 1 ? t('Instant') : `${Math.round(pacing.turboSpeed * 100)}${t('% faster')}`}</div>
    </div>
  </div>

<style>
  @import '../../styles/popups/popup-base.css';
  @import '../../styles/popups/popup-turbo.css';
</style>
