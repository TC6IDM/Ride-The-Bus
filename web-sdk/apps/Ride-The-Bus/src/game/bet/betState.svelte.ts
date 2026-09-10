/**
 * What is being bet: the amount, the family, and the four guesses.
 *
 * These belong together because between them they ARE the bet. The mode string
 * sent to /wallet/play is the family prefix plus the four guesses; the amount
 * decides what the round costs at that family's multiplier. They were spread
 * over thirteen separate places in Game.svelte, from line 266 to line 1814,
 * with the round flow, the intro and the audio wiring interleaved between them.
 *
 * Two $state objects rather than eight exported `let`s, because an exported
 * `let` cannot be reassigned across a module boundary.
 *
 * WHAT IS NOT HERE. Anything whose second job is to close a panel: setBetLevel
 * and onBetInputKey stay in the component, because `openPopup` is the
 * component's. betLockedReason IS here, because three of the writers below have
 * to ask it before they touch the amount, and that check is the thing actually
 * keeping the bet safe.
 */
import { stateBet, stateConfig, stateUrlDerived } from 'state-shared';
import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';
import { currencyDecimals, numberToCurrencyString } from 'utils-shared/amount';

import {
  betDecimals,
  betWithinRange,
  clampToMaximum,
  snapBetToGrid,
  snapToStep,
} from './betLimits';
import { currencySymbol } from './currencySymbol';
import { FAMILY_RULES, isCombinationPlayable, modeName, type ModeFamily } from '../math/modes';
import { MODE_CEILINGS } from '../math/modeCeilings';
import { t } from '../../i18n/i18nDerived';
import {
  FAMILY_BOLT_CEILING,
  VOLATILITY_BOLTS,
  boltsFor,
  volatilityColorRgbVar,
  volatilityColorVar,
} from '../math/volatility';
import { winTiersFor } from '../math/winTiers';

import { auto } from '../round/autoplaySettings.svelte';
import { roundInProgress } from '../round/roundState.svelte';

export type ColorChoice = 'red' | 'black' | null;
export type HigherLowerChoice = 'higher' | 'lower' | 'equal' | null;
export type InsideOutsideChoice = 'inside' | 'outside' | 'equal' | null;
export type SuitChoice = 'heart' | 'diamond' | 'club' | 'spade' | null;

/**
 * The four guesses, picked BEFORE the round.
 *
 * All four go into the mode name sent to /wallet/play, which is why they sit
 * with the bet rather than in roundState: they are what is being bought, and
 * they outlive any one round.
 */
export const guesses = $state({
  color: null as ColorChoice,
  hl: null as HigherLowerChoice,
  io: null as InsideOutsideChoice,
  suit: null as SuitChoice,
});

/**
 * The amount and the family - between them, what a round costs.
 *
 * `input` is the raw STRING the player is typing, not a number: the field is
 * live and a half-typed amount has to survive in it. betValue() is the reading.
 */
export const bet = $state({
  input: '1',
  /** Whether the opening bet has already been nudged onto the operator's rack. */
  defaulted: false,
  family: 'base' as ModeFamily,
  /**
   * A mode the player has picked but not yet confirmed.
   *
   * Stake's approval checklist requires a confirmation step before a bet mode
   * is activated. It is worth having here on its own merits too: the three
   * families cost the same but pay very differently - what a miss keeps, what
   * the ceiling is, how wild the ride gets - so switching is not the sort of
   * change a player should be able to make by brushing a row on the way past.
   *
   * Null means the picker is showing its list. Non-null means it is showing
   * the confirmation for that family instead, and bet.family has NOT moved yet.
   */
  pending: null as ModeFamily | null,
});

// Fallback bet levels for the bet menu when no RGS session has supplied any
// (local dev). On a real session stateConfig.betAmountOptions drives it.
export const DEFAULT_BET_LEVELS = [1, 5, 25, 50, 75, 100, 200, 500, 800, 1000];
/**
 * The levels a player can actually stake: the RGS's list, sorted, with
 * anything outside [minBet, maxBet] removed.
 *
 * THE LIST AND THE LIMITS ARE TWO SEPARATE FIELDS of the authenticate
 * response and nothing makes them agree. betLevels is the operator's rack;
 * minBet/maxBet are enforced per bet. A chip outside the range is a control
 * that looks live, takes a tap, sets the bet, and then cannot be played -
 * the spin button refuses it and betBlockedReason() has to explain a bet the
 * game itself just offered. Stake's Bet Levels rule is that the frontend
 * respects what authenticate sends, and a level the same response forbids is
 * not something to put on screen.
 *
 * It also closes the gap between local dev and a real session, which is where
 * this was noticed: the dev betLimits stand-in caps at 200.00 while
 * DEFAULT_BET_LEVELS runs to 1000, so the last three chips were unplayable on
 * every local run. Filtering here fixes both at once rather than editing one
 * literal to match the other.
 *
 * Never returns empty. If every level is out of range the configuration is
 * broken in a way this cannot repair, and an empty bet menu is worse than a
 * full one - the entry field and the clamp still keep the played amount
 * legal.
 */
export const betLevels = () => {
  const lv = stateConfig.betAmountOptions;
  const all = lv && lv.length ? [...lv].sort((a, b) => a - b) : DEFAULT_BET_LEVELS;
  const playable = all.filter((v) =>
    betWithinRange(v, stateConfig.betLimits, API_AMOUNT_MULTIPLIER),
  );
  return playable.length ? playable : all;
};

// The bet is live now (no Set button): the input + / - drive it directly and
// the Start button only enables when the amount is actually playable.
export const betValue = () => Number(bet.input);
/* ---- Bet mode family ---------------------------------------------------
   Which of the three ways to buy the same four guesses. See FAMILY_RULES.
   Only the family's COST touches the money: a 2x mode debits twice the bet
   shown, and the payout multiplier is expressed against the bet, not the
   cost - so everything below that spends money uses roundCost(), and
   everything that pays out still multiplies by the bet. */
export const familyRules = () => FAMILY_RULES[bet.family];
/** What one round actually costs at the current bet. */
export const roundCost = (amount: number = betValue()) => amount * familyRules().cost;

/**
 * Volatility of the bet as it currently stands - the mode plus the guesses.
 *
 * Reads the live choices, so it climbs the moment an Equal is picked and drops
 * again if it is cleared. Before those two guesses are made the Equal count is
 * zero, which is not a placeholder: no Equal picked IS the calm end of the
 * scale, and the meter is showing the family's own floor honestly.
 */
export const liveBolts = () => boltsFor(bet.family, guesses.hl, guesses.io);
/**
 * The colour the live mode name is written in - the rating's own colour
 * rather than a fixed gold, so the word and the bolts beside it agree.
 *
 * Past FAMILY_BOLT_CEILING it goes to the overflow purple, which in practice
 * means High Stakes with one or two Equal picks and nothing else: the
 * families sit at 1 / 3 / 5 against a ceiling of 5, so only the 5 can be
 * pushed over it. That is the same threshold BoltMeter uses to recolour the
 * stops, passed to it as overflowAfter, so the word can never disagree with
 * the meter.
 *
 * The -ink variant, not --vol-overflow itself: this is 9.5px text and wants
 * 4.5:1 where a bolt only needs 3:1. See tokens.css.
 */
export const modeNameColor = () =>
  liveBolts() > FAMILY_BOLT_CEILING
    ? 'var(--vol-overflow-ink)'
    : volatilityColorVar(bet.family);
/**
 * The same colour as an rgb triplet, for the washes and glows on the bet
 * panel's own controls. Derived through the same ceiling test as
 * modeNameColor so the two can never name different colours.
 */
export const modeRgb = () =>
  liveBolts() > FAMILY_BOLT_CEILING
    ? 'var(--vol-overflow-ink-rgb)'
    : volatilityColorRgbVar(bet.family);
/** The meter's screen-reader text. Both stops are substituted so the sentence
 *  cannot go stale if the ruler ever gains a stop. */
export const volatilityLabel = (lit: number) =>
  t('Volatility %s of %t')
    .replace('%s', String(lit))
    .replace('%t', String(VOLATILITY_BOLTS));

// The celebration ladder for the mode in play. EVERY band is per family, not
// just the top one: a tier is a claim about rarity, and the three families
// spread their payouts differently enough that one shared set of thresholds
// made the same word mean different things - see winTiers.ts for the measured
// table. The Max band sits on this family's own ceiling.
export const winTiers = () => winTiersFor(bet.family);

/**
 * Why the current bet cannot be played, or null when it can.
 *
 * One function per FAILURE, not one boolean: "Enter a valid bet" was shown
 * for a bet of zero, a bet the player cannot afford and a bet under the
 * operator's floor alike, and only the first of those three is something the
 * player can act on by reading it. The other two tell them nothing about what
 * is wrong or by how much.
 *
 * Ordered cheapest-to-most-specific, and affordability BEFORE the range:
 * a player who cannot afford the round needs to hear that first, even if the
 * amount also happens to sit under the minimum.
 */
export function betBlockedReason(): string | null {
  const v = betValue();
  if (!(v > 0)) return t('Enter a valid bet');
  // Affordability is against the COST, not the bet: at 2x a player with $10
  // cannot buy a $6 round, and letting them try just earns an RGS rejection.
  if (roundCost(v) > stateBet.balanceAmount) return t('Insufficient funds');

  // On a real session the RGS enforces minBet/maxBet, so check against those
  // rather than the min/max of betLevels - betLevels is a suggestion list and
  // need not span the full allowed range. Divisibility by stepBet is NOT
  // checked here: normalizeBet snaps the amount onto the grid at play time,
  // so an off-grid figure in the input is correctable, not invalid.
  const limits = stateConfig.betLimits;
  const micro = Math.round(v * API_AMOUNT_MULTIPLIER);
  if (limits && limits.minBet > 0 && micro < limits.minBet) {
    return t('Bet is below the minimum of %s').replace(
      '%s',
      numberToCurrencyString(limits.minBet / API_AMOUNT_MULTIPLIER),
    );
  }
  if (limits && limits.maxBet > 0 && micro > limits.maxBet) {
    return t('Bet is above the maximum of %s').replace(
      '%s',
      numberToCurrencyString(limits.maxBet / API_AMOUNT_MULTIPLIER),
    );
  }
  return null;
}

export const betIsValid = () => betBlockedReason() === null;

export const betDisplay = () => `${currencySymbol()}${`${bet.input ?? ''}`.trim() || '0.00'}`;

// When the field loses focus, snap the amount onto the operator's step grid
// and tidy the decimals. Typing is left untouched while the field is focused.
//
// Snapping HERE rather than only at spin time is deliberate: the RGS rejects
// an off-grid bet, so the amount has to change either way - doing it now means
// the player sees what they will actually be staked while they can still
// change their mind, instead of watching 1.37 become 1.30 after they commit.
//
// The MAXIMUM is clamped here; the minimum deliberately is not. See
// clampToMaximum in game/bet/betLimits.ts - clamping down stakes a player less
// than they asked, clamping up stakes them more, and only one of those is
// something a frontend may do on its own. A below-minimum amount stays as
// typed and the spin button names the floor.
//
// Clamp BEFORE snapping, so the grid always has the last word: clamping to a
// maxBet that is not itself on the step grid would otherwise leave an
// unplayable figure in the field.
export function formatBetInput() {
  if (betLockedReason()) return;
  const raw = `${bet.input ?? ''}`.trim();
  const v = Number(raw);
  if (raw === '' || isNaN(v) || v <= 0) return;
  const clamped = clampToMaximum(v, stateConfig.betLimits, API_AMOUNT_MULTIPLIER);
  const stepped = snapToStep(clamped, stateConfig.betLimits, API_AMOUNT_MULTIPLIER);
  // snapToStep floors onto the grid, so anything under ONE step floors to
  // zero: with a 1,000 step, typing 500 came back as 0.00 and the spin button
  // said "Enter a valid bet" - which is true of zero and says nothing about
  // the 500 the player actually typed. Below-minimum amounts are allowed to
  // stand precisely so the button can name the floor, and a figure snapped
  // out of existence cannot be described. Keep what they typed; it is
  // unplayable either way, and betBlockedReason explains why.
  const snapped = stepped > 0 ? stepped : v;
  bet.input = snapped.toFixed(
    // The currency's own precision is the floor, not 2 - a yen bet field has
    // no decimals to offer.
    betDecimals(stateConfig.betLimits, API_AMOUNT_MULTIPLIER, currencyDecimals(stateBet.currency)),
  );
}

export const allChoicesMade = () => Boolean(guesses.color && guesses.hl && guesses.io && guesses.suit);

// --- The one impossible pairing --------------------------------------------
// Stage 2 "equal" ties card 2 to card 1's rank, which leaves nothing strictly
// between them for stage 3 "inside" to land on. The math does not publish that
// combination (64 per family, not 72 - see game/math/modes.ts), so the client must not
// offer it either: the mode string is built by concatenating the four choices,
// and naming a mode that does not exist gets the bet rejected by the RGS.
//
// It survived this long because it is invisible locally - without a sessionID
// and rgs_url the game deals from roundContract and never sends a mode at all.
export const insideIsPossible = () => isCombinationPlayable(guesses.hl, 'inside');

// --- Picking, and un-picking -----------------------------------------------
// Every choice toggles: clicking the option already selected clears it. There
// is no other way to undo a guess - the four groups have no "none" button -
// so without this a misclick could only be corrected by choosing one of the
// other options in that group, and never by changing your mind back to
// undecided. Clearing any one choice disables Start, which is correct: the
// bet mode needs all four.
function toggle<T>(current: T | null, next: T): T | null {
  return current === next ? null : next;
}


export function setColorChoice(next: ColorChoice) {
  guesses.color = toggle(guesses.color, next);
}

export function setSuitChoice(next: SuitChoice) {
  guesses.suit = toggle(guesses.suit, next);
}

export function setIoChoice(next: InsideOutsideChoice) {
  // Load-bearing, not defensive. The Inside button is marked aria-disabled
  // rather than disabled, so that it still receives hover and can explain why
  // it is off - and an aria-disabled button is fully clickable. Without this
  // the player could select equal + inside, which is the one combination the
  // math publishes no bet mode for, and the /wallet/play would be rejected.
  if (!isCombinationPlayable(guesses.hl, next)) return;
  guesses.io = toggle(guesses.io, next);
}

// Choosing Equal at stage 2 retires Inside at stage 3. If it was already
// picked it is cleared rather than silently left selected-but-impossible,
// which would leave the Start button enabled on a bet that cannot be placed.
// Un-picking Equal makes Inside available again, which falls out of
// insideIsPossible() reading guesses.hl directly.
export function setHlChoice(next: HigherLowerChoice) {
  guesses.hl = toggle(guesses.hl, next);
  if (!isCombinationPlayable(guesses.hl, guesses.io)) guesses.io = null;
}

// Bring a raw bet into what the RGS will actually accept.
//
// Per the RGS spec ("Bet Levels") the predefined betLevels are only
// *suggestions* - free-form amounts are allowed - but two rules are hard:
// the bet must sit within [minBet, maxBet] AND be divisible by stepBet. So
// we don't snap to a level (that needlessly turned 11 -> 10); we snap to the
// operator's step grid, which keeps free typing while guaranteeing the bet
// is one the RGS accepts. Without this, typing 1.37 against a 0.10 step is
// rejected with ERR_VAL.
//
// All arithmetic is in the RGS's own micro-units (integers), because doing
// it in decimal dollars drifts: 0.1 * 3 !== 0.3 in binary floating point,
// and an off-by-one-micro-unit bet is exactly what ERR_VAL catches.
export function normalizeBet(value: number): number {
  // Keyed on whether limits are actually known rather than on the presence of
  // a session: snapBetToGrid falls back to cent-rounding when they are all
  // zero (local dev), and this way the dev_* URL overrides can exercise the
  // real grid logic without a live RGS.
  return snapBetToGrid(value, stateConfig.betLimits, API_AMOUNT_MULTIPLIER);
}

// Stake-style +/- stepper: step to the next / previous suggested bet level
// relative to whatever is currently shown, so the increment scales sensibly
// across the range. It just rewrites the live input - typing any amount still
// works. Falls back to +/-1 when no levels are known (local dev before
// authenticate).
//
// betLevels(), not stateConfig.betAmountOptions: the stepper walks the same
// rack the chips draw, so it cannot step onto a level the operator's own
// maxBet forbids and leave the spin button refusing a figure the + button
// just produced.
export function stepBet(direction: 1 | -1) {
  if (betLockedReason()) return;
  const shown = Number(bet.input);
  const current = !isNaN(shown) && shown > 0 ? shown : stateBet.betAmount;
  const sorted = betLevels();
  if (sorted.length) {
    const next =
      direction > 0
        ? sorted.find((l) => l > current + 1e-9)
        : [...sorted].reverse().find((l) => l < current - 1e-9);
    if (next !== undefined) bet.input = String(next);
  } else {
    bet.input = String(Math.max(1, current + direction));
  }
}

/**
 * Why the bet cannot be changed right now, or null when it can.
 *
 * Autoplay stakes the SAME amount every round - that is the whole contract
 * the player agreed to when they confirmed the run - so letting the amount
 * move underneath it would either restake them without a fresh confirmation
 * or silently do nothing, and both are worse than refusing.
 *
 * Same shape as spinBlockedReason(): a control that is dead has to say why,
 * or the player is left guessing at a greyed button.
 */
export function betLockedReason(): string | null {
  if (auto.running) return t('Bet is locked while autoplay runs');
  if (stateUrlDerived.replay()) return t('Replays cannot be re-bet');
  // A round already bought cannot be re-priced. The guesses have been locked
  // for this window since choicesLocked was written, but the bet and the mode
  // were not - so the amount and the family could both still be changed while
  // a round was on the wire, which is the same class of mistake for the same
  // reason: you would be looking at a board that no longer describes the round
  // being settled.
  if (roundInProgress()) return t('Round in progress');
  return null;
}

/**
 * Why the MODE button is dead right now, or null when it is live.
 *
 * Same three conditions as choicesLocked(), which is what used to drive the
 * button's `disabled` attribute - and that left it the one control in the bar
 * that went grey with no explanation on any pointer type at all. The bet group
 * beside it has had .cb-bet-tip for exactly this since it was written.
 *
 * Its own string rather than betLockedReason()'s, because that one names the
 * BET: "Bet is locked while autoplay runs" over the mode button would be
 * answering a question nobody asked. The other two branches genuinely are the
 * same sentence, so they are shared.
 */
export function modeLockedReason(): string | null {
  if (auto.running) return t('Mode is locked while autoplay runs');
  if (stateUrlDerived.replay()) return t('Replays cannot be re-bet');
  if (roundInProgress()) return t('Round in progress');
  return null;
}

/**
 * The most the four guesses currently picked can actually pay, on `family`.
 *
 * NOT FAMILY_RULES[family].maxWin, and the difference is the point. That is
 * the most the family can reach and belongs on a mode a player is choosing
 * between; this is the most THIS BET can reach, and for 56 of each family's
 * 64 combinations it is a great deal lower - the median Classic mode stops at
 * 268.8x against a stated 1354.2x. Stake asks for the maximum win to be
 * stated per bet mode and to be obtainable, and every combination here IS a
 * published bet mode.
 *
 * Null until all four guesses are in, and null for equal+inside, which the
 * math never published - so the caller shows the family figure alone rather
 * than an invented one.
 */
export function selectedCeiling(family: ModeFamily): number | null {
  if (!guesses.color || !guesses.hl || !guesses.io || !guesses.suit) return null;
  if (!isCombinationPlayable(guesses.hl, guesses.io)) return null;
  return MODE_CEILINGS[modeName(guesses.color, guesses.hl, guesses.io, guesses.suit, family)] ?? null;
}
