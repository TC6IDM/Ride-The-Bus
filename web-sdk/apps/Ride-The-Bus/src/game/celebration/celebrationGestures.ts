/**
 * How the takeover MOVES: the pop, the hand's hop, and the reduced-motion gate.
 *
 * Every one of these takes an element or nothing, so none of them needed to be
 * inside the component. Two carry an argument worth keeping intact:
 *
 *   easePop reads --ease-pop off the document rather than restating the curve.
 *   The literal that used to sit in the call was a second, slightly different
 *   overshoot living one file away from the token - the same near-duplicate
 *   drift that made --ctl-turbo-rgb a different amber from --ctl-turbo.
 *
 *   hopFan needs composite: 'add'. Without it the keyframes overwrite
 *   `transform` outright and every card snaps to the centre of the fan for the
 *   length of the hop, because the tilt and the offset live in that same
 *   property. See the note on hopFan itself.
 */

export function promoteTitle(titleEl: HTMLElement | undefined) {
	pop(titleEl, 1.22, 560);
}

/** The same treatment for the amount as it settles on a band ceiling. */
export function popAmount(amountEl: HTMLElement | undefined) {
	pop(amountEl, 1.12, 520);
}

/**
 * The hand hops on every promotion.
 *
 * Driven through element.animate() for the same reason promoteTitle is, and
 * it is the same trap: the cards are already carrying wc-fan-deal with
 * `both`, so setting `animation` on them from a class would REPLACE that fill
 * and drop each card back to its undealt transform the moment the hop ended.
 * A Web Animations call composites over the CSS animation instead of
 * replacing it.
 *
 * composite: 'add' is what makes that work. Without it the keyframes would
 * overwrite `transform` outright and every card would snap to the centre of
 * the fan for the length of the hop - the tilt and offset live in the same
 * property. Adding leaves the fan's own geometry alone and layers a
 * translation on top of it.
 *
 * Staggered left to right, and by a hair - the hand should read as one
 * object catching a bump, not as four cards taking turns.
 */
export function hopFan(fanEl: HTMLElement | undefined) {
	if (!fanEl || reducedMotion()) return;
	const cards = fanEl.querySelectorAll<HTMLElement>('.wc-fan-card');
	cards.forEach((card, i) => {
		card.animate(
			[
				{ transform: 'translateY(0)' },
				{ transform: `translateY(calc(var(--ui) * -1.6))`, offset: 0.34 },
				{ transform: 'translateY(0)' },
			],
			{
				duration: 620,
				delay: i * 55,
				easing: easePop(),
				composite: 'add',
			},
		);
	});
}

/**
 * Read from the stylesheet rather than restated here. The literal that used
 * to sit in this call was a second, slightly different overshoot living one
 * file away from --ease-pop - the same near-duplicate-value drift that made
 * --ctl-turbo-rgb a different amber from --ctl-turbo.
 */
export function easePop(): string {
	if (typeof window === 'undefined') return 'ease-out';
	const declared = getComputedStyle(document.documentElement)
		.getPropertyValue('--ease-pop')
		.trim();
	return declared || 'ease-out';
}

export function pop(element: HTMLElement | undefined, scale: number, duration: number) {
	if (!element || reducedMotion()) return;
	element.animate(
		[
			{ transform: 'scale(1)' },
			{ transform: `scale(${scale})`, offset: 0.38 },
			{ transform: 'scale(1)' },
		],
		{ duration, easing: easePop() },
	);
}


export const reducedMotion = () =>
	typeof window !== 'undefined' &&
	window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
