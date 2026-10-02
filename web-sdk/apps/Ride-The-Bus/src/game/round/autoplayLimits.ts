/**
 * The two autoplay limits - how far down a run may go, and how big one win may
 * be - as the rule the loop applies. Plain TypeScript on purpose: the settings
 * live in a rune module (autoplaySettings.svelte.ts), which node's test runner
 * cannot import, and this is the part worth a test.
 *
 * A limit is what the player TYPED, in one of two units, and whether they have
 * switched it on (the button beside the field):
 *
 *   x     multiples of the BASE bet - the unit every other "your bet" in the
 *         game is written in ("Costs 250x your bet", "Max win 4583.3x your
 *         bet") and the multiplier the takeover and Last Win print at the end,
 *         so "stop on a single win of 100x" means the 100.00x the player would
 *         see. It is also what the Stake SDK multiplies (its start button sets
 *         each limit to stateBet.betAmount * multiplier, and betAmount is the
 *         base bet - components-ui-html, AutoSpinsStartButton.svelte).
 *   cash  an amount of the player's own currency, as the balance shows it.
 *
 * NEVER the round's cost. An earlier cut counted in cost, which on Three of a
 * Kind made "your bet" mean 250x what it means everywhere else - the two-units
 * bug CLAUDE.md names - and left a 25x-100x win limit unable to fire on a mode
 * whose only win is 4583.3x.
 */

export type LimitUnit = 'x' | 'cash';

export type LimitSetting = { input: string; unit: LimitUnit; on: boolean };

/**
 * The typed figure, or null when there is nothing usable in the field. Takes
 * a decimal comma as well as a point - "2,5" is how half the shipped languages
 * type two and a half - but only when it cannot be a grouping comma. Grouping
 * is accepted only as grouping: "1,000" (thousands) and "2,50,000" (the Indian
 * lakh, which Hindi players type); a comma anywhere else ("2,50,0") is not a
 * number, and the field says so by refusing to arm rather than guessing.
 */
export function parseLimit(raw: string): number | null {
  let s = `${raw ?? ''}`.trim().replace(/\s+/g, '');
  if (s === '') return null;
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else if (s.includes(',')) {
    if (!/^\d{1,3}(,\d{2,3})*(\.\d+)?$/.test(s) || !/,\d{3}(\.\d+)?$/.test(s)) return null;
    s = s.replace(/,/g, '');
  }
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * The limit as an amount of money, or Infinity when it is off or unusable. A
 * limit switched on over a field that no longer parses is OFF - it never stops
 * a run on a figure the player cannot see.
 */
export function limitAmount(setting: LimitSetting, baseBet: number): number {
  if (!setting.on) return Infinity;
  const v = parseLimit(setting.input);
  if (v === null) return Infinity;
  if (setting.unit === 'cash') return v;
  return baseBet > 0 ? v * baseBet : Infinity;
}

/**
 * Whether the run ends on this round. `lossAt` and `winAt` are limitAmount()s;
 * `netSoFar` is the run's winnings minus its stakes INCLUDING this round; `won`
 * is what this round paid. Reached AT the figure, not past it - "stop on a loss
 * of 10x" stops the round the run is 10 base bets down, as the SDK does.
 */
export function limitReached(lossAt: number, winAt: number, netSoFar: number, won: number): boolean {
  const eps = (x: number) => 1e-9 * Math.max(1, Math.abs(x));
  if (Number.isFinite(lossAt) && -netSoFar >= lossAt - eps(lossAt)) return true;
  if (Number.isFinite(winAt) && won >= winAt - eps(winAt)) return true;
  return false;
}
