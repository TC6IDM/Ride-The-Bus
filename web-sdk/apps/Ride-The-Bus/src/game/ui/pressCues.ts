/**
 * Which cue a pressed control gets, read off the control itself.
 *
 * Lifted out of Game.svelte unchanged, and the reason it is worth having as
 * its own module is the note below on STRING LITERALS: this maps CSS class
 * names onto press cues, nothing type-checks that mapping, and a class renamed
 * in a stylesheet silently drops its control to the quietest cue in the set.
 * sound.test.ts greps every class named here against every stylesheet that
 * could define it - which it had to do by slicing the component's source, and
 * can now do by reading one file.
 */
import { sound, type PressKind } from '../audio/sound';

// --- Click sound on every button ------------------------------------------
// Delegated rather than a sound.playPress() in each of the ~40 onclick
// handlers: one place to change, nothing to forget, and buttons added later
// are covered for free. Capture phase so the cue fires before the handler
// runs - notably the mute button, which should still be audible as it mutes.
//
// The kind is read off the button's own class, because all 34 of them sharing
// one identical click was the single most mechanical thing about the audio.
// Committing to a guess, nudging the bet and closing a popup are different
// sorts of action and now sound like it. Anything unrecognised falls through
// to 'soft', so a button added later is still covered - just generically.
// Which guess column a button sits in: 0 colour, 1 higher/lower, 2 inside/
// outside, 3 suit. The press cue climbs a whole tone per column, so the row
// is audibly a sequence rather than four interchangeable taps. -1 for
// anything outside the guess row, where the stage means nothing.
export const CHOICE_SQUARES = ['.color-square', '.hl-square', '.io-square', '.suit-square'];

export function choiceStageFor(el: HTMLElement): number {
  return CHOICE_SQUARES.findIndex((selector) => el.closest(selector));
}

export function pressKindFor(el: HTMLElement): PressKind {
  // Checked before the halves and thirds, because an equal badge overlaps
  // them and is the more specific match.
  if (el.closest('.equal-btn')) return 'equal';
  if (el.closest('.half-btn, .third-btn, .quad-btn')) return 'choice';
  if (el.closest('.cb-step, .stepper-btn, .bet-chip, .spin-pill, .cb-bet-display')) return 'chip';
  if (el.closest('.cb-spin, .cb-round, .cb-float, .popup-start')) return 'primary';
  if (el.closest('.switch, .cb-icon')) return 'toggle';
  return 'soft';
}

export function onDocumentClick(event: MouseEvent) {
  const el = (event.target as HTMLElement | null)?.closest?.('button');
  // Disabled buttons don't dispatch clicks at all, but a click landing on a
  // child of one can still bubble here, and a dead control shouldn't sound.
  if (!el || (el as HTMLButtonElement).disabled) return;
  const target = el as HTMLElement;
  sound.playPress(pressKindFor(target), Math.max(0, choiceStageFor(target)));
}
