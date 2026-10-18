<!-- The two-bus sound mixer.

     Split out of Game.svelte when each control-bar panel became its own file.
     The `{#if openPopup === 'sound'}` that decides whether this is on screen
     stays with the parent - which panel is open is the component's own state -
     and this file is the panel itself.

     STYLES TRAVEL WITH THE MARKUP. A stylesheet is scoped to whichever
     component imports it (see the note atop ChoiceIcon.svelte), so
     styles/popup-sound.css is imported here and nowhere else. Colour still comes
     in through the one --tint contract every menu wears; nothing below names a
     colour of its own.

     A BUMP (the owner's pick S1, 2026-10-17): two levels are the whole menu,
     so it opens over the sound button with no header, and the speakers are
     bare glyphs in the bar's voice - no box round them. See popup-bump.css. -->
<script lang="ts">
  import RangeSlider from './RangeSlider.svelte';
  import SoundIcon from '../icons/SoundIcon.svelte';
  import { t } from '../../i18n/i18nDerived';
  import {
    busSilent,
    mixer,
    onMusicInput,
    onSfxInput,
    toggleBus,
  } from '../../game/audio/soundSettings.svelte';
  import { bump } from '../../game/ui/bumpAnchor';
</script>

  <div class="popup bump popup-sound" role="dialog" aria-modal="true" tabindex="-1" aria-label={t('Sound settings')} use:bump={'.cb-sound'}>
    <div class="sound-body">
      <div class="sound-row" class:is-off={busSilent('music')}>
        <button
          type="button"
          class="sound-mute"
          class:off={busSilent('music')}
          onclick={() => toggleBus('music')}
          aria-pressed={busSilent('music')}
          aria-label={busSilent('music') ? t('Unmute music') : t('Mute music')}
        >
          <SoundIcon muted={busSilent('music')} />
        </button>
        <div class="sound-track">
          <span class="sound-label">{t('Music')}</span>
          <!-- The game's own slider, not the browser's - see RangeSlider.svelte.
               It takes the panel's --tint from the DOM; the handler reads the
               input's value off the event exactly as before. -->
          <RangeSlider
            min={0}
            max={100}
            step={1}
            value={mixer.musicVolume}
            oninput={onMusicInput}
            disabled={busSilent('music')}
            label={t('Music')}
          />
        </div>
        <!-- The STORED level, not the effective one. Printing 0 while the
             thumb sits at 75 put two different numbers for one bus on the
             same row - the readout said silent and the slider said
             three-quarters. The slash and the greyed bar carry "off"; this
             carries "the level you will come back to". -->
        <span class="sound-readout">{mixer.musicVolume}</span>
      </div>

      <div class="sound-row" class:is-off={busSilent('sfx')}>
        <button
          type="button"
          class="sound-mute"
          class:off={busSilent('sfx')}
          onclick={() => toggleBus('sfx')}
          aria-pressed={busSilent('sfx')}
          aria-label={busSilent('sfx') ? t('Unmute game sounds') : t('Mute game sounds')}
        >
          <SoundIcon muted={busSilent('sfx')} />
        </button>
        <div class="sound-track">
          <span class="sound-label">{t('Game sounds')}</span>
          <RangeSlider
            min={0}
            max={100}
            step={1}
            value={mixer.sfxVolume}
            oninput={onSfxInput}
            disabled={busSilent('sfx')}
            label={t('Game sounds')}
          />
        </div>
        <span class="sound-readout">{mixer.sfxVolume}</span>
      </div>
    </div>
  </div>

<style>
  @import '../../styles/popups/popup-base.css';
  @import '../../styles/popups/popup-bump.css';
  @import '../../styles/popups/popup-sound.css';
</style>
