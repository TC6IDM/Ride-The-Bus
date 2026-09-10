/**
 * Which logo file to draw: the WebP, or the PNG for a browser that cannot read it.
 *
 * WHY THERE ARE TWO. logo.png is the only bitmap this game loads and it is
 * 743 kB at 710x710, drawn at 310 CSS px at the very largest (the loader). It is
 * also about a third of the whole payload, because config-svelte sets
 * bundleStrategy "inline" and everything else is already inside index.html. The
 * same artwork as WebP q90 is 81 kB - an 89% saving - and at the size the game
 * actually draws it the two are indistinguishable. "Optimised bundle size" is an
 * explicit 3-star criterion.
 *
 * WHY THE CHOICE IS MADE HERE RATHER THAN IN CSS. The obvious spelling is
 *
 *     background-image: url(logo.png);
 *     background-image: image-set(url(logo.webp) type("image/webp"), url(logo.png));
 *
 * and it does not work here, twice over. The six call sites pass the URL through
 * a custom property, and a `var()` that resolves to something the browser cannot
 * use is invalid AT COMPUTED-VALUE TIME - which resets the property to `none`
 * rather than falling back to the declaration above it, so the logo would simply
 * vanish. Wrapping it in `@supports` fixes that but tests the wrong thing:
 * Safari 14 through 16 read WebP perfectly well and do NOT support `image-set()`
 * with `type()`, so they would be handed the 743 kB file for no reason.
 *
 * So the capability is tested directly. The WebP is the default, which is what
 * makes the saving real: a capable browser (Chrome 32+, Firefox 65+, Safari 14+,
 * so effectively all of them) fetches 81 kB and nothing else. Only a browser
 * that genuinely cannot decode it pays for the second request, and Stake's
 * checklist line about older Android and iOS devices is what that path is for.
 *
 * NOT a canvas.toDataURL('image/webp') probe, which is the usual one-liner and
 * is wrong for exactly the browsers this exists to protect: Safari could DECODE
 * WebP from 14 but could not ENCODE it until 17, so the canvas test reports "no"
 * for three major versions that are perfectly fine.
 */
import { base } from '$app/paths';

const PNG = `${base}/logo.png`;
const WEBP = `${base}/logo.webp`;

/**
 * Read by every component that draws the mark - the loader, the start screen,
 * the card backs, the table's deck prop and the win celebration - as
 * `--logo-url: url(${logoAsset.url})`.
 *
 * Starts on the WebP and only ever moves once, and only downwards.
 */
export const logoAsset = $state({ url: WEBP });

/**
 * A 2x2 lossy WebP, 34 bytes. Small enough to be free and real enough that a
 * browser has to actually decode it to report success - a bare feature string
 * would not.
 */
const PROBE =
	'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

if (typeof Image !== 'undefined') {
	const probe = new Image();
	// onerror rather than onload: the default is already the WebP, so the only
	// thing worth reacting to is failure. A probe that never fires either way
	// (an exotic cache state, a blocked data: URI) therefore leaves the game on
	// the WebP, which is the right way round - it is the case that works.
	probe.onerror = () => {
		logoAsset.url = PNG;
	};
	probe.src = PROBE;
}
