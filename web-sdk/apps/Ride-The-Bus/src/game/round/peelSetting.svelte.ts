/**
 * "Peel the last card myself" (the owner, 2026-10-20): when the last card is
 * squeezed, the player grabs a corner and peels it instead of watching it peel
 * itself. Off by default - the automatic squeeze is the game's - and kept on
 * this device, like the sound levels, because it is how this player likes to
 * play rather than part of any one round. The switch is in the autoplay panel
 * (the owner's call), beside the other two. It holds on autoplay too since
 * 2026-10-23 - a run waits for the hand at each held card (roundReveal's
 * peelsByHand).
 */
const KEY = 'ride-the-bus:peel-myself';

function load(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const peel = $state({ myself: load() });

export function setPeelMyself(on: boolean) {
  peel.myself = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Private mode, or storage off: the switch still works for this session.
  }
}
