/**
 * "Tap" or "Click" - whichever the player is actually doing.
 *
 * The prompts said "Tap to continue" to a desktop player holding a mouse (the
 * critique, 2026-10-05). The primary pointer decides: a finger taps, a mouse
 * clicks. A touch laptop that reports its finger as primary gets "Tap", which
 * is still something it can do. With no matchMedia to ask (a test, a server
 * render) the answer is the finger, the one the game is played with most.
 */
export function fingerPointer(): boolean {
  if (typeof matchMedia === 'undefined') return true;
  return matchMedia('(pointer: coarse)').matches;
}
