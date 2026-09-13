<!-- The responsible-gambling readouts, shown only where the regulator asks.

     Split out of Game.svelte with the control bar. A distinct feature rather
     than a piece of the bar - the note below on why it is pinned top-right
     instead of living in the bar is the whole reason it is separate.

     It renders .cb-cap and .cb-val, which is why those two are in
     readout.css rather than in the bar's own sheet. See that file's header. -->
<script lang="ts">
  import gameConfig from '../../game/platform/config';
  import { jurisdiction } from '../../game/jurisdiction/jurisdiction.svelte';
  import { round, sessionClock } from '../../game/round/roundState.svelte';
  import { t } from '../../i18n/i18nDerived';
  import { numberToCurrencyString } from 'utils-shared/amount';
  import Figure from './Figure.svelte';
</script>

<!-- Responsible-gambling readouts, rendered only where the player's regulator
     asks for them (displayNetPosition / displayRTP / displaySessionTimer).
     Pinned top-right rather than sitting in the control bar: in the bar it
     pushed the row count to five and took 40% of the viewport height on a
     400x225 popout, squeezing the play area. Up here it costs the layout
     nothing, and it is reference information rather than a control. -->
{#if jurisdiction.showAnyReadout()}
  <aside class="rg-panel" aria-label={t('Session information')}>
    {#if jurisdiction.showNetPosition()}
      <div class="rg-item" class:up={round.sessionNet > 0} class:down={round.sessionNet < 0}>
        <span class="cb-cap">{t('Net Position')}</span>
        <span class="cb-val">{numberToCurrencyString(round.sessionNet)}</span>
      </div>
    {/if}
    {#if jurisdiction.showRTP()}
      <div class="rg-item">
        <span class="cb-cap">{t('RTP')}</span>
        <span class="cb-val">{(gameConfig.rtp * 100).toFixed(2)}%</span>
      </div>
    {/if}
    {#if jurisdiction.showSessionTimer()}
      <div class="rg-item">
        <span class="cb-cap">{t('Session')}</span>
        <!-- Through Figure: the clock ticks once a second on a plate pinned to
             the right edge, and with Poppins' proportional digits every "1"
             that came or went moved the plate's left edge. See Figure.svelte
             and the note on .rg-item .cb-val in session-readouts.css. -->
        <span class="cb-val"><Figure text={sessionClock()} /></span>
      </div>
    {/if}
  </aside>
{/if}

<style>
  @import '../../styles/board/session-readouts.css';
  /* The caption/figure pair, shared with the control bar. */
  @import '../../styles/board/readout.css';
</style>
