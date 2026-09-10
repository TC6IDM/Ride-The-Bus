/**
 * MAY we open an AudioContext yet, and if not, when?
 *
 * A different question from the one audioContext.ts answers. That module builds
 * the graph; this one decides the earliest legal moment to ask it to, so the
 * bed is playing under the loading and start screens rather than arriving with
 * the tap that leaves them.
 *
 * Permission is ASKED, never assumed, and no single API covers every browser -
 * the three-step probe below says why, and why the third step (a throwaway
 * context, constructed and closed) turned out to be safe despite the "not
 * allowed to start" warning it was avoided for.
 *
 * ONE WAY ONLY. This imports ensureContext; audioContext imports nothing from
 * here. watchVisibility stays over there on purpose - suspending a hidden tab
 * is the context's own lifecycle, not a permission question, and moving it
 * would have made the two modules a cycle.
 */
import { ensureContext } from './audioContext.ts';

/**
 * Whether this document may open an AudioContext without being touched first.
 *
 * THREE ANSWERS, CHEAPEST FIRST, because no one of them covers every browser.
 *
 * 1. getAutoplayPolicy. Chrome 110+ and Firefox 120+ answer directly and for
 *    free. Missing from Safari, and missing from the Chromium the audio lab
 *    runs, which is how the fallbacks below came to be needed at all.
 * 2. userActivation.hasBeenActive. Weaker - it says nothing about an embedder
 *    that granted autoplay - but never a false positive, and true on a remount.
 * 3. A THROWAWAY CONTEXT, which is the only thing that works on Safari and the
 *    only thing that sees an allow="autoplay" iframe. Build one, read its state,
 *    close it. This was avoided at first on the grounds that a blocked context
 *    logs "The AudioContext was not allowed to start" - a Stake build failure -
 *    but that was measured through CDP with Log.enable on, and a context that is
 *    CONSTRUCTED and closed without ever being resumed or scheduled logs
 *    nothing. Chrome emits that warning on a refused resume(), not on birth.
 *    Nothing renders through it either, so there is no tab badge.
 */
function autoplayPermitted(): boolean {
	if (typeof navigator === 'undefined') return false;
	const nav = navigator as Navigator & {
		getAutoplayPolicy?: (type: string) => string;
		userActivation?: { hasBeenActive?: boolean };
	};
	if (typeof nav.getAutoplayPolicy === 'function') {
		try {
			return nav.getAutoplayPolicy('audiocontext') === 'allowed';
		} catch {
			// An older signature, or an argument it does not know. Fall through to
			// the checks below rather than assuming either answer.
		}
	}
	if (nav.userActivation?.hasBeenActive === true) return true;

	if (typeof window === 'undefined') return false;
	const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
	if (!Ctor) return false;
	try {
		const probe: AudioContext = new Ctor();
		const allowed = probe.state === 'running';
		// Closed either way, and immediately. A kept probe would be a second
		// context competing for the per-page limit with the one that matters.
		void probe.close?.();
		return allowed;
	} catch {
		return false;
	}
}

/**
 * Every gesture that can legally unlock audio, including on iOS.
 *
 * `touchend` rather than `touchstart`: Safari has historically only counted a
 * completed touch, and a scroll that begins with a touchstart is not a gesture
 * anyone meant as one.
 */
const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

/**
 * Open the graph at the earliest moment the browser will allow, so the bed is
 * playing on the loading and start screens rather than arriving at the board.
 *
 * WHY THIS IS NEEDED AT ALL. Before it, the ONLY thing that ever built a context
 * was the cue book, on a real press - and there is nothing to press while the
 * loader is up. So the two screens before the board set a music scene that could
 * never sound, and the track arrived with the tap that left them. music.ts still
 * refuses to open a context itself, and that rule is intact: this is the GAME
 * asking for audio, not the music module reaching for it.
 *
 * TWO PATHS, because there are two situations:
 *
 *   1. The embedder allows autoplay - Stake's iframe with allow="autoplay", or a
 *      returning player Chrome already trusts. Then the context is built now,
 *      is born running, and the bed fades up under the loading screen.
 *   2. It does not. Then nothing is built, nothing is logged, and the FIRST
 *      gesture anywhere on the page opens it - a tap on the help badge, a key
 *      press, the tap on "Tap to continue" itself. Capture phase, so it lands
 *      before the button's own handler and the music starts on the same tap
 *      rather than one interaction later.
 *
 * A cold load in a strict embed still cannot make sound before the player
 * touches something. That is a browser rule, not a setting.
 *
 * Returns a teardown, because the listeners outlive nothing else here.
 */
export function primeAudio(): () => void {
	if (typeof document === 'undefined') return () => {};

	if (autoplayPermitted()) {
		ensureContext();
		return () => {};
	}

	const stop = () => {
		for (const type of UNLOCK_EVENTS) document.removeEventListener(type, unlock, true);
	};
	const unlock = () => {
		// Removed FIRST: ensureContext is re-entrant but three listeners firing off
		// one tap would call it three times, and the announce it triggers walks
		// every mixer listener each time.
		stop();
		ensureContext();
	};

	for (const type of UNLOCK_EVENTS) {
		document.addEventListener(type, unlock, { capture: true, passive: true });
	}
	return stop;
}
