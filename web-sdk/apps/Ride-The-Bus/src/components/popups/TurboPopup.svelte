<!-- The turbo speed slider.

     Split out of Game.svelte when each control-bar panel became its own file.
     The `{#if openPopup === 'turbo'}` that decides whether this is on screen
     stays with the parent - which panel is open is the component's own state -
     and this file is the panel itself.

     STYLES TRAVEL WITH THE MARKUP. A stylesheet is scoped to whichever
     component imports it (see the note atop ChoiceIcon.svelte), so
     styles/popup-turbo.css is imported here and nowhere else. Colour still comes
     in through the one --tint contract every menu wears; nothing below names a
     colour of its own.

     A BUMP (the owner's pick T1, 2026-10-17): the slider is the whole menu, so
     it opens over the turbo button rather than as a dialog in the middle of the
     screen, and has no header - its name is the dialog's label, and a tap
     anywhere else or Escape closes it. See popup-bump.css. -->
<script lang="ts">
  import RangeSlider from './RangeSlider.svelte';
  import { t } from '../../i18n/i18nDerived';
  import { jurisdiction, TURBO_CAP_WITHOUT_SUPER } from '../../game/jurisdiction/jurisdiction.svelte';
  import { onTurboInput, pacing } from '../../game/round/revealPacing.svelte';
  import { bump } from '../../game/ui/bumpAnchor';

</script>

  <div class="popup bump popup-turbo" role="dialog" aria-modal="true" tabindex="-1" aria-label={t('Turbo speed')} use:bump={'.cb-turbo'}>
    <div class="turbo-body">
      <div class="turbo-track">
        <span class="turbo-end">{t('Normal')}</span>
        <!-- The track's own max is capped when super turbo is barred, so the
             slider can't even be dragged to instant - the clamp above is the
             backstop, this is the affordance. -->
        <!-- The game's own slider, not the browser's - see RangeSlider.svelte. -->
        <RangeSlider
          min={0}
          max={jurisdiction.superTurboDisabled() ? TURBO_CAP_WITHOUT_SUPER : 1}
          step={0.05}
          bind:value={pacing.turboSpeed}
          oninput={onTurboInput}
          label={t('Turbo speed')}
        />
        <span class="turbo-end">{jurisdiction.superTurboDisabled() ? t('Fast') : t('Instant')}</span>
      </div>
      <div class="turbo-readout">{pacing.turboSpeed <= 0 ? t('Off: full animation') : pacing.turboSpeed >= 1 ? t('Instant') : `${Math.round(pacing.turboSpeed * 100)}${t('% faster')}`}</div>
    </div>
  </div>

<style>
  @import '../../styles/popups/popup-base.css';
  @import '../../styles/popups/popup-bump.css';
  @import '../../styles/popups/popup-turbo.css';
</style>
