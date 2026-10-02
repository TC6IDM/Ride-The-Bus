/**
 * The court figures - fetched once, put in the page, drawn by <use>.
 *
 * static/cards/courts.svg holds all twelve (scripts/court-art.mjs builds it
 * from the CC0 masters in art-masters/courts/). It is 199 kB, 43 kB gzipped,
 * and it is FETCHED rather than imported for the reason bedAsset.ts gives for
 * the music: config-svelte's bundleStrategy "inline" would base64 an import
 * into index.html, the document that blocks first paint, and "optimised bundle
 * size" is a 3-star criterion. The courts are needed by the first round, not
 * the first frame, so they load behind the loader instead.
 *
 * WHY INTO THE PAGE AND NOT AN <img>. Each figure is coloured through six CSS
 * custom properties (--cf-p/g/l/t/d/b) that CardFace sets per suit colour from
 * tokens.css. An <img> is a separate document that no custom property reaches;
 * an inline <symbol> referenced by <use> inherits them from the <use>.
 *
 * WHY THE HOST IS NOT display:none. A clipPath (every court is half a figure,
 * clipped, and turned) inside a display:none <svg> does not apply in Chrome or
 * Firefox, so the figure would draw unclipped. The host is a zero-size box
 * instead.
 *
 * FAILS SOFT, like the music bed. No file, a 404, a parse error: `ready` stays
 * false and CardFace draws the court's frame, pips and index around a large
 * rank letter - a card, not a hole. Nothing is logged: Stake's network check
 * wants no game information in the console.
 */

export const courtArt = $state({ ready: false });

let started = false;

export function loadCourtArt(url: string): void {
	if (started || typeof document === 'undefined' || typeof fetch === 'undefined') return;
	started = true;
	fetch(url)
		.then((res) => (res.ok ? res.text() : Promise.reject(new Error(`courts ${res.status}`))))
		.then((text) => {
			const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
			const svg = doc.documentElement;
			if (svg.nodeName !== 'svg' || doc.getElementsByTagName('parsererror').length) throw new Error('courts: not an svg');
			const host = document.importNode(svg, true) as unknown as SVGSVGElement;
			host.setAttribute('aria-hidden', 'true');
			host.setAttribute('focusable', 'false');
			host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
			document.body.appendChild(host);
			courtArt.ready = true;
		})
		.catch(() => {
			// Stays false; CardFace draws the fallback. Retrying is not worth it:
			// a file that failed once on a static host will fail again.
		});
}
