/**
 * Whether the game itself has mounted and is ready to be looked at.
 *
 * The loader lives in +layout.svelte, as a sibling of the game tree rather
 * than a parent of it, so it has no other way to know when <Game /> actually
 * appears. Without this the loader cleared on a timer alone and left roughly a
 * second of empty screen while <Authenticate> was still resolving.
 */
export const gameReady = $state({ value: false });
