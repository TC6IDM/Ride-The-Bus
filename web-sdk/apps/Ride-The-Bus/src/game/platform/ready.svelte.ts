/**
 * Whether the game itself has mounted and is ready to be looked at.
 *
 * The loader lives in +layout.svelte, as a sibling of the game tree rather
 * than a parent of it, so it has no other way to know when <Game /> actually
 * appears. Without this the loader cleared on a timer alone and left roughly a
 * second of empty screen while <Authenticate> was still resolving.
 */
export const gameReady = $state({ value: false });

/**
 * Whether the loading screen has actually gone.
 *
 * Distinct from gameReady, which only says <Game /> has mounted. The loader
 * stays up for a minimum time after that (1400ms, plus 220ms for the filled bar
 * to register), and anything that starts animating in between plays out behind
 * a full-screen overlay where nobody can see it.
 *
 * That is exactly what replay and round-resume did: both begin as soon as
 * /wallet/authenticate hands back a round, and the first card turns about 650ms
 * later - comfortably inside the window where the loader is still covering the
 * table. On Stake's own replay view the round was half over by the time the
 * screen cleared.
 */
export const loaderGone = $state({ value: false });
