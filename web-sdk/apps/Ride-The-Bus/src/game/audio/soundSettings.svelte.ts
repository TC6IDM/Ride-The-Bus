/**
 * The sound panel's state: what the mixer is set to, and how the panel writes
 * to it.
 *
 * A rune module rather than component state because audioGraph.ts is a plain
 * module - it owns the real gain nodes and knows nothing about reactivity - so
 * something has to MIRROR the mixer for the controls to be drawn from. The
 * mirror is what makes a slider that also clears a mute, and a mute that also
 * lifts a slider, stay in step.
 *
 * `mixer` is one $state object rather than four exported `let`s because an
 * exported `let` cannot be reassigned across a module boundary. That is the
 * same shape ready.svelte.ts and jurisdiction.svelte.ts use.
 *
 * The two silence questions are FUNCTIONS, not stored flags. They were a
 * $derived in the component, which cannot cross a module boundary either, and
 * a stored copy would be a third thing to keep in step with the other two.
 */
import { sound, type AudioBusName } from './sound';

// Seeded from the persisted preference so mute survives a reload.
// Mirrors of the mixer, because audioGraph.ts is a plain module rather than a
// rune - the panel writes through the setters below and reads back, so a
// slider that also clears a mute (and a mute that also lifts a slider) stays
// in step with the controls drawn from it.
export const mixer = $state({
  musicVolume: sound.busVolume('music'),
  sfxVolume: sound.busVolume('sfx'),
  musicMuted: sound.isBusMuted('music'),
  sfxMuted: sound.isBusMuted('sfx'),
});

/**
 * The bar icon's state: crossed only when there is nothing left to hear.
 * Derived from the mirrors rather than read from sound.isMuted() so that it
 * tracks the panel - a plain call would not re-run when a slider moved.
 */
export const allSilent = () =>
  (mixer.musicMuted || mixer.musicVolume <= 0) && (mixer.sfxMuted || mixer.sfxVolume <= 0);

/** Whether one bus has nothing left to hear - the state each row's icon draws. */
export const busSilent = (bus: AudioBusName) =>
  bus === 'music'
    ? mixer.musicMuted || mixer.musicVolume <= 0
    : mixer.sfxMuted || mixer.sfxVolume <= 0;

export function syncSound() {
  mixer.musicVolume = sound.busVolume('music');
  mixer.sfxVolume = sound.busVolume('sfx');
  mixer.musicMuted = sound.isBusMuted('music');
  mixer.sfxMuted = sound.isBusMuted('sfx');
}

export function setBusVolume(bus: AudioBusName, value: number) {
  sound.setBusVolume(bus, value);
  syncSound();
}

export function toggleBus(bus: AudioBusName) {
  sound.toggleBusMuted(bus);
  syncSound();
  // Turning a bus back on should be audible on that bus. Music has nothing to
  // preview yet, so only the cue bus answers.
  if (bus === 'sfx' && !sound.isBusSilent('sfx')) sound.playPress('toggle');
}

// A range input fires `input` for pointer movement inside the current step
// too, so without this the same tick retriggers while the thumb is merely
// nudged - the guard onTurboInput already carries, for the same reason.
let lastSfxTick = -1;
export function onSfxInput(event: Event) {
  const value = Number((event.currentTarget as HTMLInputElement).value);
  if (!Number.isFinite(value)) return;
  setBusVolume('sfx', value);
  if (value === lastSfxTick) return;
  lastSfxTick = value;
  // Each slider previews its own bus - see onMusicInput.
  sound.playSliderTick(value / 100);
}

let lastMusicTick = -1;
export function onMusicInput(event: Event) {
  const value = Number((event.currentTarget as HTMLInputElement).value);
  if (!Number.isFinite(value)) return;
  setBusVolume('music', value);
  if (value === lastMusicTick) return;
  lastMusicTick = value;
  // On the MUSIC bus, not the cue bus. A slider has to preview the thing it
  // sets: ticking this one with a card sound would be demonstrating the wrong
  // level entirely, and it is the reason this slider was silent until there
  // was any music for it to speak for.
  sound.playMusicTick(value / 100);
}
