<!-- The gated advanced bet-progression panel.

     Split out of Game.svelte when each control-bar panel became its own file.
     The `{#if openPopup === 'advanced'}` that decides whether this is on screen
     stays with the parent - which panel is open is the component's own state -
     and this file is the panel itself.

     STYLES TRAVEL WITH THE MARKUP. A stylesheet is scoped to whichever
     component imports it (see the note atop ChoiceIcon.svelte), so
     styles/popup-advanced.css is imported here and nowhere else. Colour still comes
     in through the one --tint contract every menu wears; nothing below names a
     colour of its own. -->
<script lang="ts">
  import MarkIcon from '../icons/MarkIcon.svelte';
  import { t } from '../../i18n/i18nDerived';
  import { stateUrlDerived } from 'state-shared';
  import { stops } from '../../game/round/autoplaySettings.svelte';

  let { onclose }: { onclose: () => void } = $props();
</script>

  <div class="popup popup-advanced" role="dialog" aria-modal="true" tabindex="-1" aria-label={t('Advanced')}>
    <div class="popup-head"><span>{t('Advanced')}</span><button class="popup-close" onclick={onclose} aria-label={t('Close')}><MarkIcon name="cross" /></button></div>
    <div class="advanced-body">
      <!-- No replay branch here any more. Every row below is autoplay-scoped
           and autoplay does not run in a replay, so this popup had nothing to
           offer one - it used to open anyway and explain itself with a note
           above two dead switches. The BUTTON is disabled in replay instead,
           which is the same information delivered before the click rather
           than after it. The per-switch `disabled` guards stay: they also
           cover auto.running, which is a live state. -->
      <!-- Live during a run, like the row below it. The loop reads this at the
           END of each round (see the `break` in startAuto), so flipping it
           mid-run takes effect from the next one - which is exactly when a
           player wants it: they are watching a run they no longer want to
           leave unattended. Only the UI was refusing; the behaviour always
           supported it. Replay still disables it, because autoplay does not
           run in a replay at all. -->
      <div class="advanced-row">
        <span class="control-label">{t('Stop autoplay on full game win')}</span>
        <button type="button" class="switch" class:on={stops.onFullWin} role="switch" aria-checked={stops.onFullWin} aria-label={t('Stop autoplay on full game win')} disabled={stateUrlDerived.replay()} onclick={() => (stops.onFullWin = !stops.onFullWin)}><span class="switch-knob"></span></button>
      </div>
      <!-- Unlike the row above, this one is NOT disabled mid-run: it changes
           only how the next celebration behaves, so flipping it during a run
           is both safe and the moment a player is most likely to want it. -->
      <div class="advanced-row">
        <span class="control-label">{t('Skip win animations on autoplay')}</span>
        <button type="button" class="switch" class:on={stops.skipWinOnAuto} role="switch" disabled={stateUrlDerived.replay()} aria-checked={stops.skipWinOnAuto} aria-label={t('Skip big win animations during autoplay')} onclick={() => (stops.skipWinOnAuto = !stops.skipWinOnAuto)}><span class="switch-knob"></span></button>
      </div>
      <!-- Two switches, not four. "Skip card reveal on autoplay" and "Skip
           card reveal on spacebar hold" used to sit below these. Both set the
           slam flag, and a slam collapses the reveal to EXACTLY the instant end
           of the turbo scale (see paceMs in revealPacing.svelte.ts) - so each
           was the turbo slider at maximum, applied to a subset of rounds, and
           two more switches for a result one existing control already gives
           was not worth the panel space or the explaining. -->
    </div>
  </div>

<style>
  @import '../../styles/popups/popup-base.css';
  @import '../../styles/popups/popup-advanced.css';
</style>
