/**
 * Keys 1 to 4 step through the four guesses - a keyboard's way to make the
 * picks the board's squares make, for players at a desk and for anyone who
 * does not use a pointer. Space already deals (ControlBar.svelte), so a whole
 * round can be played from the keyboard.
 *
 * Pure: what the next pick in a column is. The listener lives beside the
 * spacebar's in ControlBar.svelte, which already knows when a key must not
 * reach the game (a panel open, the takeover up, the intro, a field focused),
 * and it sets the pick through the board's own setters, so every rule the
 * squares obey - Inside barred after Equal, the fixed family, a round in
 * flight - holds for a key too.
 */

/** Each column's options, in the order its square draws them. */
export const GUESS_COLUMNS = {
	color: ['black', 'red'],
	hl: ['higher', 'lower', 'equal'],
	io: ['inside', 'outside', 'equal'],
	suit: ['heart', 'spade', 'club', 'diamond'],
} as const;

export type GuessColumn = keyof typeof GUESS_COLUMNS;

/**
 * The key that steps each column: the column's number on the board.
 *
 * Matched on the PHYSICAL key (`KeyboardEvent.code`) first - Digit1..4 and the
 * numpad - because on a French AZERTY keyboard the unshifted top row types
 * & é " ' and the game ships in French. The printed digit is a fallback for a
 * device that reports no code.
 */
export const GUESS_KEY: Record<string, GuessColumn> = {
	Digit1: 'color', Digit2: 'hl', Digit3: 'io', Digit4: 'suit',
	Numpad1: 'color', Numpad2: 'hl', Numpad3: 'io', Numpad4: 'suit',
	'1': 'color', '2': 'hl', '3': 'io', '4': 'suit',
};

/** Which column a key event steps, if any. */
export const guessColumnFor = (event: { code?: string; key?: string }): GuessColumn | undefined =>
	(event.code ? GUESS_KEY[event.code] : undefined) ?? (event.key ? GUESS_KEY[event.key] : undefined);

/**
 * The option after `current`, skipping any `allowed` refuses, wrapping round.
 * From nothing it is the first allowed option. A key never CLEARS a pick (a
 * second tap on a square does): stepping is for choosing, and a column that
 * went empty on the fifth press would read as a key that stopped working.
 * Null only when nothing in the column is allowed at all.
 */
export function nextGuess<T extends string>(order: readonly T[], current: T | null, allowed: (option: T) => boolean = () => true): T | null {
	const start = current === null ? -1 : order.indexOf(current);
	for (let step = 1; step <= order.length; step++) {
		const option = order[(start + step) % order.length]!;
		if (allowed(option)) return option;
	}
	return null;
}
