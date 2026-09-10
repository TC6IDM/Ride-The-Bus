<!-- The floating control bar: the money, the mode, and the button that buys a
     round.

     Game.svelte's largest single piece. Splitting it became possible only after
     the state moved into modules - the bar reads betState, autoplaySettings,
     roundState, revealPacing and roundPlace's gate directly, so what would have
     been a forty-prop interface is one bindable `openPopup` and two callbacks.

     THE COLOURS ARE PUBLISHED ON THE FOOTER, and there are deliberately TWO
     rulers - the note below the script says which is which and why collapsing
     them was rejected. Nothing inside this file names a colour.

     Styles: control-bar.css, plus readout.css for the caption/figure pair that
     SessionReadouts renders too, plus responsive-bar.css last so its overrides
     win. -->
<script lang="ts">
  import BoltMeter from '../icons/BoltMeter.svelte';
  import ChoiceIcon from '../icons/ChoiceIcon.svelte';
  import MarkIcon from '../icons/MarkIcon.svelte';
  import SoundIcon from '../icons/SoundIcon.svelte';
  import { startAuto, stopAuto } from '../../game/round/autoplayLoop.svelte';
  import { advanced, auto, countDigits } from '../../game/round/autoplaySettings.svelte';
  import {
    allChoicesMade,
    bet,
    betBlockedReason,
    betIsValid,
    betLockedReason,
    modeLockedReason,
    betValue,
    familyRules,
    guesses,
    liveBolts,
    modeNameColor,
    modeRgb,
    roundCost,
    stepBet,
    volatilityLabel,
  } from '../../game/bet/betState.svelte';
  import { celebration } from '../../game/celebration/celebrationState.svelte';
  import { fitValue } from '../../game/ui/fitValue';
  import { jurisdiction } from '../../game/jurisdiction/jurisdiction.svelte';
  import { collapseRevealWaitToInstant, pacing } from '../../game/round/revealPacing.svelte';
  import { cooldownSecondsLabel, gate, resolveRoundSeed, runRound } from '../../game/round/roundPlace.svelte';
  import { replay } from '../../game/round/roundRestore.svelte';
  import { playRevealSequence } from '../../game/round/roundReveal.svelte';
  import { resetForNewRound, round } from '../../game/round/roundState.svelte';
  import { sound } from '../../game/audio/sound';
  import { allSilent } from '../../game/audio/soundSettings.svelte';
  import {
    FAMILY_BOLT_CEILING,
    VOLATILITY_BOLTS,
    volatilityColorRgbVar,
    volatilityColorVar,
  } from '../../game/math/volatility';
  import { t } from '../../i18n/i18nDerived';
  import { stateBet, stateUrlDerived } from 'state-shared';
  import { numberToCurrencyString } from 'utils-shared/amount';

  import { choicesLocked } from '../../game/round/roundState.svelte';

  let {
    openPopup = $bindable(),
    betRowEl = $bindable(),
    introPhase,
  }: {
    /** Which panel is open. The switchboard that renders them is the parent's. */
    openPopup:
      | null
      | 'bet'
      | 'mode'
      | 'turbo'
      | 'autospin'
      | 'advanced'
      | 'info'
      | 'sound';
    /** The bet row, so the parent's fit effects can still measure it. */
    betRowEl: HTMLElement | undefined;
    /** The intro phase, so the spin button can refuse before the board is up. */
    introPhase: 'loading' | 'start' | 'replay-info' | 'playing';
  } = $props();

  const IS_PROD = Boolean((import.meta as any).env?.PROD);

// --- Bottom control-bar handlers ---
function togglePopup(name: NonNullable<typeof openPopup>) {
  openPopup = openPopup === name ? null : name;
  // Leaving the picker abandons an unconfirmed pick. Without this, reopening
  // it would land straight back on a confirmation the player had already
  // walked away from once.
  bet.pending = null;
}

// The big spin button: acts as Stop while an auto run is live, otherwise
// plays exactly one round. Disabled (greyed) until a bet + all 4 guesses are
// valid.
// Can the button cut the current reveal short right now?
//
// Not offered during an auto run: there the button is Stop, and overloading a
// single control with "skip this round" and "end the whole run" would make
// the destructive one easy to hit by accident.
const canSlam = () =>
  round.state === 'playing' &&
  !pacing.slamRequested &&
  !auto.running &&
  !jurisdiction.slamstopDisabled();

const spinDisabled = () =>
  auto.running
    ? false
    : canSlam()
      ? false // it is a Skip button for the duration of the reveal
      : round.state === 'playing' ||
      round.isProcessing ||
      // The big-win takeover is covering the board.
      celebration.active !== null ||
      // An interrupted round is being replayed onto the board - the player
      // must not be able to buy a new one on top of it.
      round.resumeInProgress ||
      // Held open to satisfy the regulator's minimum round duration.
      gate.held ||
      // Replay: block while the intro sequence is still showing, and during
      // the initial reveal. Once the round has finished once, the spin
      // button replays it (see onSpin).
      (stateUrlDerived.replay() && !replay.ready) ||
      (stateUrlDerived.replay() && introPhase !== 'playing') ||
      // Normal (non-replay) mode guards.
      (!stateUrlDerived.replay() && (!betIsValid() || !allChoicesMade())) ||
      (!stateUrlDerived.replay() && IS_PROD && resolveRoundSeed().source === 'none');

// Why the spin button is dead right now, or null when it's live. Shown as a
// tooltip on hovering the wrapper, so a greyed button always explains itself
// instead of leaving the player guessing.
//
// Deliberately mirrors spinDisabled()'s conditions in the same order, so the
// two can't disagree - a disabled button with no reason (or a reason on a
// live button) would be worse than no tooltip at all. Ordered most-specific
// first: transient states before "you haven't finished setting up".
function spinBlockedReason(): string | null {
  if (auto.running) return null; // it's a Stop button; always live
  // Mid-reveal but slammable: the button is live as Skip, so there is no
  // blocked reason to explain. Without this it claimed "Round in progress"
  // over an enabled button.
  if (canSlam()) return null;
  if (stateUrlDerived.replay() && !replay.ready) return t('Loading replay…');
  if (stateUrlDerived.replay() && introPhase !== 'playing') return null; // button hidden behind overlay
  // Replay is view-only — these non-replay checks don't apply.
  if (stateUrlDerived.replay()) return null;
  if (gate.held) {
    return t('Spins must be %s seconds apart').replace('%s', cooldownSecondsLabel());
  }
  if (round.state === 'playing' || round.isProcessing || round.resumeInProgress) return t('Round in progress');
  if (!allChoicesMade()) return t('Pick all 4 guesses');
  const betReason = betBlockedReason();
  if (betReason) return betReason;
  if (IS_PROD && resolveRoundSeed().source === 'none') return t('No active game session');
  return null;
}

/**
 * Whether the button is truly INERT, as opposed to merely blocked.
 *
 * spinDisabled() used to drive the `disabled` attribute directly, and that made
 * every one of spinBlockedReason()'s seven strings unreachable on a phone: a
 * disabled button fires no pointer events, so nothing could raise the tip, and
 * .cb-cooldown-tip is only shown by :hover - which a finger does not have. The
 * result was the worst feedback in the game. A player taps the one button the
 * whole game is about, and gets no sound (pressCues skips disabled buttons), no
 * press state, and no explanation.
 *
 * So the button stays LIVE wherever there is something to say, and onSpin()
 * answers the tap. Exactly the trade .cb-bet-display already makes, with the
 * same reasoning: a greyed control tells a player the game is broken, where a
 * live one that answers back tells them why. It still LOOKS unavailable -
 * .cb-spin.blocked carries what :disabled used to.
 *
 * Inert is reserved for the two states with no reason to give, and in both the
 * board is behind a full-screen overlay anyway: the win takeover, and the replay
 * intro. spinDisabled() itself is unchanged and is still what onSpin() and the
 * spacebar guard test, so nothing can be bought in a blocked state.
 */
const spinInert = () => spinDisabled() && spinBlockedReason() === null;

/**
 * The blocked tip, flashed by a refused tap - the phone's only route to it.
 * Same shape and duration as flashBetTip() above; see the note there.
 */
let spinTipVisible = $state(false);
let spinTipTimer: ReturnType<typeof setTimeout> | null = null;
function flashSpinTip() {
  spinTipVisible = true;
  if (spinTipTimer) clearTimeout(spinTipTimer);
  spinTipTimer = setTimeout(() => { spinTipVisible = false; }, BET_TIP_MS);
}

/**
 * Replay mode, with the round already played through once.
 *
 * Stake's Bet Replay section asks for a "Play Again" button once a replay
 * finishes, and that is what the spin button becomes here - it already
 * re-runs the round (see onSpin), so this is the label catching up with the
 * behaviour rather than new behaviour. Kept as a predicate because three
 * things read it: the accessible name, the visible caption, and nothing else
 * may drift from either.
 */
const replayFinished = () =>
  stateUrlDerived.replay() && (round.state === 'won' || round.state === 'lost');

function onSpin() {
  // No playPress() here - the delegated click listener below already sounds
  // every button. The spacebar path, which isn't a click, sounds its own.
  if (auto.running) { stopAuto(); return; }
  // Mid-reveal: cut the animation short rather than starting a new round.
  // Every remaining pause drops to instant via paceMs, and the one already in
  // flight is re-timed to match - so a slam finishes the round on exactly the
  // maximum-turbo timeline, never quicker than the player could get by moving
  // the slider.
  if (canSlam()) {
    pacing.slamRequested = true;
    collapseRevealWaitToInstant();
    return;
  }
  // Replay mode: pressing the spin button after the round has finished (or
  // during the reveal) replays the same round from the start. The book events
  // are still in round.revealEvents from the first play-through.
  if (stateUrlDerived.replay() && (round.state === 'won' || round.state === 'lost')) {
    sound.playPress('primary');
    // Reset the board and replay the same events.
    pacing.slamRequested = false;
    resetForNewRound();
    playRevealSequence();
    return;
  }
  if (spinDisabled()) {
    // Refused, not ignored. The tip is the answer; the blocked cue is only what
    // says the press was heard. Both are reachable by tap now, which is the
    // whole point - see spinInert() above.
    if (spinBlockedReason()) { sound.playBlocked(); flashSpinTip(); }
    return;
  }
  runRound().catch((err) => console.error('[RideTheBus] play failed', err));
}
// Bet menu: choose a preset level then close.

/**
 * The tip is shown on hover on a pointer device, and FLASHED on a refused
 * tap - which is the only route a phone has to it.
 */
let betTipVisible = $state(false);
let betTipTimer: ReturnType<typeof setTimeout> | null = null;
const BET_TIP_MS = 2400;
function flashBetTip() {
  betTipVisible = true;
  if (betTipTimer) clearTimeout(betTipTimer);
  betTipTimer = setTimeout(() => { betTipVisible = false; }, BET_TIP_MS);
}

/**
 * The MODE button's blocked tip. The button used to be `disabled` outright on
 * choicesLocked(), which made it the one control in the bar that went grey with
 * no explanation on ANY pointer type - the bet group beside it has had
 * .cb-bet-tip for exactly this since it was written. Same trade as
 * .cb-bet-display and .cb-spin: live so a tap can be answered, and it still
 * looks unavailable.
 *
 * Replay keeps the hard `disabled`, where Stake's guidance asks for the bet
 * controls to be inert rather than merely talkative.
 */
let modeTipVisible = $state(false);
let modeTipTimer: ReturnType<typeof setTimeout> | null = null;
function flashModeTip() {
  modeTipVisible = true;
  if (modeTipTimer) clearTimeout(modeTipTimer);
  modeTipTimer = setTimeout(() => { modeTipVisible = false; }, BET_TIP_MS);
}

function onModeClick() {
  if (modeLockedReason()) { sound.playBlocked(); flashModeTip(); return; }
  togglePopup('mode');
}

function onBetDisplayClick() {
  // The tip is the answer; the cue is only what says a press was HEARD and
  // refused. On a phone the flash is the only route to the tip at all, so
  // without this a locked bet answers a tap with nothing for ~0 frames.
  if (betLockedReason()) { sound.playBlocked(); flashBetTip(); return; }
  togglePopup('bet');
}


// --- Spacebar: tap to spin, hold to keep spinning -------------------------
// Same shape as the SDK's EnableSpaceHold / OnHotkey pair: keydown spins once
// immediately, and if the key is still down after HOLD_MS the run continues
// until it is released. The hold run is bounded by the key being physically
// held, so it is not an unattended unlimited autoplay.
const SPACE_HOLD_MS = 400;
let spaceDown = false;
let spaceHoldTimer: ReturnType<typeof setTimeout> | null = null;

// Don't hijack Space while the player is typing a bet / round count, or
// operating a focused button (Space is that button's own activation key).
function spaceIsForUs(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return true;
  if (el.isContentEditable) return false;
  return !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName);
}

function onKeyDown(event: KeyboardEvent) {
  if (event.code !== 'Space' && event.key !== ' ') return;
  // The big-win takeover is up and owns the keyboard - it binds Space on
  // window in the capture phase, so this should already be unreachable. Kept
  // as a belt-and-braces guard: Space reaching the spin button from behind a
  // full-screen overlay would buy a round the player never asked for.
  if (celebration.active) return;
  // Regulator has barred the shortcut - leave Space to the browser.
  if (jurisdiction.spacebarDisabled()) return;
  if (!spaceIsForUs(event.target)) return;
  // Space scrolls the page by default.
  event.preventDefault();
  // Held keys auto-repeat; only the first keydown counts.
  if (event.repeat || spaceDown) return;
  spaceDown = true;

  // A live auto run treats Space like the Stop button.
  if (auto.running) { sound.playPress('primary'); onSpin(); return; }
  if (spinDisabled()) return;

  // Keyboard activation isn't a click, so it never reaches the delegated
  // handler - sound it here, as the primary control Space stands in for.
  sound.playPress('primary');
  onSpin(); // the tap: one round, straight away
  spaceHoldTimer = setTimeout(() => {
    spaceHoldTimer = null;
    // Still held, and the tap's round is done or nearly so — keep going.
    // Never start a hold-auto run during replay (view-only mode).
    if (spaceDown && !auto.running && !stateUrlDerived.replay()) startAuto({ hold: true });
  }, SPACE_HOLD_MS);
}

function onKeyUp(event: KeyboardEvent) {
  if (event.code !== 'Space' && event.key !== ' ') return;
  releaseSpace();
}

function releaseSpace() {
  spaceDown = false;
  if (spaceHoldTimer !== null) {
    clearTimeout(spaceHoldTimer);
    spaceHoldTimer = null;
  }
  // Ends the hold run after the in-flight round settles (a placed bet can't
  // be cancelled).
  auto.spaceHoldRunning = false;
}

// Space is the spin button being pressed, so its listeners live with the
// button. A lost focus or hidden tab never delivers the keyup, which would
// otherwise leave a hold run going with nobody holding anything.
$effect(() => {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseSpace);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', releaseSpace);
    releaseSpace();
  };
});
</script>

<!-- Lemniscate: two symmetric loops crossing at the centre. The viewBox hugs
     the drawing (2:1) rather than padding it into a square, so the CSS width
     maps straight onto the glyph's real size and it can be weighted against
     adjacent numerals. -->
{#snippet iconInfinity()}
  <svg class="inf-icon" viewBox="0 0 24 12" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path
      d="M12 6C10.5 3.6 8.7 2 6.6 2 4.1 2 2.6 3.8 2.6 6s1.5 4 4 4c2.1 0 3.9-1.6 5.4-4 1.5-2.4 3.3-4 5.4-4 2.5 0 4 1.8 4 4s-1.5 4-4 4c-2.1 0-3.9-1.6-5.4-4Z"
    />
  </svg>
{/snippet}

<!-- Bet nudge +/-, drawn to match rather than typed as "+" and U+2212. -->
{#snippet iconPlus()}
  <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
    <path d="M12 4.5v15" />
    <path d="M4.5 12h15" />
  </svg>
{/snippet}
{#snippet iconMinus()}
  <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true">
    <path d="M4.5 12h15" />
  </svg>
{/snippet}

<!-- Floating control bar: detached pill groups pulled toward the centre,
     with the turbo button and the advanced button floating free at the
     outer edges (slot-style). -->
<!-- The live mode's colours are published on the WHOLE bar, not just on the
     bet panel that used to carry them. Two groups read them now - the bet
     display with its steppers, and the MODE button over in the light pill -
     and those two are in different panels, so the nearest element that can
     reach both is the bar itself. Inheritance does the rest.

     Two rulers, deliberately, and they are not the same number:
       --vol-color / --vol-rgb   the FAMILY's own rating. What the MODE
                                 button and the mode picker wear, because
                                 they are about the mode being chosen.
       --mode-ink / --mode-rgb   the LIVE rating, family plus one stop per
                                 Equal pick, which can overflow to purple.
                                 What the bet group wears, because that is
                                 the round about to be bought.
     See the volatility notes in CLAUDE.md before collapsing them. -->
<footer
  class="control-bar"
  style={`--vol-color: ${volatilityColorVar(bet.family)}; --vol-rgb: ${volatilityColorRgbVar(bet.family)}; --mode-ink: ${modeNameColor()}; --mode-rgb: ${modeRgb()}`}
>
  <!-- Removed, not just disabled, when the regulator bars Turbo: a greyed
       control still advertises a feature the player may not have. -->
  {#if !jurisdiction.turboDisabled()}
    <button class="cb-float cb-turbo" class:active={pacing.turboSpeed > 0 || openPopup === 'turbo'} onclick={() => togglePopup('turbo')} aria-label={t('Turbo speed')}>
      <svg class="cb-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 2v11h3v9l7-12h-4l4-8z" /></svg>
    </button>
  {/if}

  <div class="cb-panel cb-panel-light" class:mode-locked={modeLockedReason() !== null}>
    <!-- Opens the mixer rather than toggling. Muting is two actions now
         instead of one, which is the price of having separate music and cue
         levels at all; the panel's two speaker buttons are what satisfy
         "an option to disable sounds". -->
    <button
      class="cb-icon cb-sound"
      class:active={openPopup === 'sound'}
      onclick={() => togglePopup('sound')}
      aria-haspopup="dialog"
      aria-expanded={openPopup === 'sound'}
      aria-label={t('Sound settings')}
    >
      <SoundIcon muted={allSilent()} />
    </button>
    <button class="cb-icon cb-info" class:active={openPopup === 'info'} onclick={() => togglePopup('info')} aria-label={t('How to play')}>
      <MarkIcon name="info" />
    </button>

    <!-- Bet mode. Locked during an auto run and in replay, like the bet
         itself: the run was started on one mode's odds, and a replay is a
         record of a round already played on one.
         Gold rather than the bar's usual slate so it reads as the one control
         that changes what a round IS, not how it looks. -->
    <button
      class="cb-icon cb-mode-btn"
      class:active={openPopup === 'mode'}
      class:blocked={modeLockedReason() !== null}
      onclick={onModeClick}
      disabled={stateUrlDerived.replay()}
      aria-label={t('Choose game mode')}
      title={t(familyRules().label)}
    >
      <span class="cb-mode-word">{t('Mode')}</span>
    </button>

    <!-- Why the MODE button is dead. Hosted on the PANEL rather than the button,
         for the reason .cb-bet-tip gives: in replay the button really is
         disabled and so receives no pointer events at all. Wrapping the button
         instead was rejected - the light pill is pinned to one line on a phone
         (flex-wrap: nowrap in responsive-bar.css) and a new flex item in it is
         the kind of change that breaks that. -->
    {#if modeLockedReason()}
      <span class="cb-mode-tip" class:is-shown={modeTipVisible} role="tooltip" aria-live="polite"
        >{modeLockedReason()}</span>
    {/if}

    <!-- `solo` when the balance is hidden (replay). One child under
         space-between sits at the START, so the Last Win readout ended up
         mid-pill with the freed width doing nothing, and the settled figure
         overflowed leftward across the MODE and info buttons. See
         .cb-readouts.solo. -->
    <div class="cb-readouts" class:solo={stateUrlDerived.replay()}>
      <!-- Hidden in replay. A replay is viewable without a session - the URL
           can be shared publicly - so there is no player whose balance this
           would be, and Stake's replay guidance asks for it to go. The Last
           Win beside it stays: the payout IS what a replay is showing. -->
      {#if !stateUrlDerived.replay()}
        <div class="cb-balance">
          <span class="cb-cap">{t('Balance')}</span>
          <!-- use:fitValue - the reservation beside this in control-bar.css
               was measured from "$99,999,999.00", and a high-denomination
               currency runs far past it. See fitToBox. -->
          <span class="cb-val" use:fitValue={stateBet.balanceAmount}>
            {numberToCurrencyString(stateBet.balanceAmount)}
          </span>
        </div>
      {/if}
      <!-- Always rendered (even before the first spin) so it can't pop into
           existence mid-session and shove the rest of the bar sideways. -->
      <div class="cb-lastwin" class:won={round.lastWinAmount > 0}>
        <span class="cb-cap">{t('Last Win')}</span>
        <!-- The multiplier chip is INSIDE the fitted box on purpose: the two
             shrink together, so the pair either both fit or both scale, and
             the chip can never be the thing that pushes the cash out. -->
        <span class="cb-val" use:fitValue={`${round.lastWinAmount}|${round.lastWinMultiplier}`}>
          {numberToCurrencyString(round.lastWinAmount)}
          <span class="cb-lastwin-mult">{round.lastWinMultiplier.toFixed(2)}×</span>
        </span>
      </div>
    </div>
  </div>

  <!-- The live rating is published to the whole bet panel, not just to the
       mode line inside it: the +/- steppers are SIBLINGS of the bet display,
       so a custom property set on the display could never reach them. Every
       control in this group now tints with the difficulty of the round it is
       about to buy. -->
  <!-- The tooltip lives on the PANEL rather than the button, for the same
       reason .cb-cooldown-tip lives on .cb-spin-wrap: a disabled button
       receives no pointer events, so a tooltip hosted on it would never be
       shown by the one state it exists to explain. The panel also spans the
       steppers, which are disabled by the same condition. -->
  <div class="cb-panel cb-panel-dark cb-bet" class:bet-locked={betLockedReason() !== null}>
    <!-- NOT disabled while autoplay runs, and that is deliberate: a greyed
         control tells a player the game is broken, where a live one that
         answers back tells them why. Only replay disables it outright, where
         Stake's own guidance asks for the bet controls to be inert. -->
    <button
      class="cb-bet-display"
      class:active={openPopup === 'bet'}
      onclick={onBetDisplayClick}
      disabled={stateUrlDerived.replay()}
      aria-label={t('Choose bet amount')}
    >
      <span class="cb-cap">{t('Bet')}</span>
      <!-- The figure shown IS what leaves the balance, so it is the round's
           cost rather than the base bet. On a multiplied mode it turns blue
           and the base bet moves to a line underneath: one number to read,
           coloured to say "this is not the plain bet", with the arithmetic
           available for anyone who wants it. -->
      <span
        class="cb-val"
        class:cb-val-multiplied={familyRules().cost !== 1}
        use:fitValue={roundCost()}
      >
        {numberToCurrencyString(roundCost() > 0 ? roundCost() : 0)}
      </span>
      {#if familyRules().cost !== 1}
        <span class="cb-bet-base">
          {numberToCurrencyString(betValue() > 0 ? betValue() : 0)} × {familyRules().cost}
        </span>
      {/if}
      <!-- The live mode, with its volatility. Shown on EVERY family, Classic
           included - it used to be hidden there on the grounds that "Classic"
           under every bet is noise, which was fair while the line was only a
           name. It now carries the volatility rating, and hiding that on the
           one mode most players never leave would be hiding it from most
           players. Showing it always also stops the bar changing height when
           the mode changes.

           Same 5-bolt ruler as the mode picker, deliberately: two lightning
           meters that counted differently would be the "two units on one
           screen" mistake this game has already made three times. -->
      <span class="cb-bet-mode">
        <BoltMeter
          lit={liveBolts()}
          total={VOLATILITY_BOLTS}
          overflowAfter={FAMILY_BOLT_CEILING}
          label={volatilityLabel(liveBolts())}
        />
        {t(familyRules().label)}
      </span>
    </button>
    <div class="cb-betstep">
      <!-- Same condition as the display beside them, so the whole bet group
           locks and unlocks together. They were on auto.running || replay
           only, which left them live while a round was in flight. -->
      <button class="cb-step" onclick={() => stepBet(1)} disabled={betLockedReason() !== null} aria-label={t('Increase bet')}>{@render iconPlus()}</button>
      <button class="cb-step" onclick={() => stepBet(-1)} disabled={betLockedReason() !== null} aria-label={t('Decrease bet')}>{@render iconMinus()}</button>
    </div>
    {#if betLockedReason()}
      <span class="cb-bet-tip" class:is-shown={betTipVisible} role="tooltip" aria-live="polite">
        {betLockedReason()}
      </span>
    {/if}
  </div>

  <div class="cb-panel cb-panel-dark cb-actions">
    {#if !jurisdiction.autoplayDisabled()}
      <button class="cb-round cb-autospin" class:active={openPopup === 'autospin'} onclick={() => togglePopup('autospin')} disabled={auto.running || stateUrlDerived.replay()} aria-label={t('Autoplay settings')}>
        <svg class="cb-svg cb-autospin-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8A5.87 5.87 0 0 1 6 12c0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
          <path d="M10.4 9.7 14.6 12l-4.2 2.3z" />
        </svg>
      </button>
    {/if}

    <!-- Wraps the spin button so the cooldown ring and tooltip have a host
         that still receives hover while the button itself is disabled. -->
    <div class="cb-spin-wrap">
    <button
      class="cb-spin"
      class:stopping={auto.running}
      class:slammable={canSlam()}
      class:blocked={spinBlockedReason() !== null}
      onclick={onSpin}
      disabled={spinInert()}
      aria-label={auto.running
        ? t('Stop autoplay')
        : canSlam()
          ? t('Skip the reveal')
          : replayFinished()
            ? t('Play Again')
            : t('Spin')}
    >
      {#if auto.running}
        <span class="cb-spin-square" aria-hidden="true"></span>
        <!-- Rounds left, inside the stop square. An unlimited run shows the
             infinity mark instead of a number; a space-hold run shows
             nothing, since it lasts only as long as the key is held.
             It also disappears the moment Stop is pressed: the bet already
             placed has to play out, so the button cannot stop instantly, and
             emptying the square is what tells the player the run is ending
             rather than leaving a count sitting there looking ignored. -->
        {#if !auto.spaceHoldRunning && !auto.stopRequested}
          <span
            class="cb-spin-count"
            class:is-long={countDigits() === 4}
            class:is-longer={countDigits() > 4}
          >
            {#if auto.infinite}{@render iconInfinity()}{:else}{auto.remaining}{/if}
          </span>
        {/if}
      {:else if canSlam()}
        <!-- Skip-to-end: two chevrons into a bar. Distinct from the spin
             arrows so the button's job is readable at a glance. -->
        <svg class="cb-spin-svg cb-slam-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 5.5 12 12 4 18.5z" />
          <path d="M11 5.5 19 12l-8 6.5z" />
          <rect x="19.6" y="5" width="2.4" height="14" rx="1.2" />
        </svg>
      {:else}
        <!-- A card coming off the deck, not two circular arrows.
             The arrows are the universal RELOAD mark, and they were the
             resting glyph on the primary bet button of a game where nothing
             rotates and nothing reels - four cards are dealt. Its two other
             states were already right: a fast-forward for skip and a square
             for stop, so the icon family was three metaphors deep.

             Two rounded rects: the deck square-on, and the card being dealt
             off it, tilted. Reads at 36px, which is the floor this button
             hits on a 320px phone. -->
        <svg class="cb-spin-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="2.6" y="7.4" width="9.2" height="12.6" rx="1.6"
            fill="currentColor" opacity="0.55"
          />
          <rect
            x="11.4" y="3.2" width="9.2" height="12.6" rx="1.6"
            fill="currentColor"
            transform="rotate(19 16 9.5)"
          />
        </svg>
      {/if}
    </button>

    <!-- Ring and tooltip live on the WRAPPER, not the button: the button is
         disabled whenever either is relevant, and a disabled button receives
         no mouse events, so :hover on it would never fire. -->
    {#if gate.held}
      <svg class="cb-cooldown" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="cb-cooldown-track" cx="50" cy="50" r="46" />
        <!-- Rotated -90deg so the sweep starts at 12 o'clock; dashoffset
             shrinks from the full circumference to 0 as it fills clockwise.
             2*pi*46 = 289.03 -->
        <circle
          class="cb-cooldown-fill"
          cx="50"
          cy="50"
          r="46"
          style={`stroke-dasharray: 289.03; stroke-dashoffset: ${(289.03 * (1 - gate.progress)).toFixed(2)}`}
        />
      </svg>
    {/if}
    <!-- "Play Again", which Stake's replay section asks for by name once a
         replay has finished. A CAPTION rather than a label inside the button:
         the button is a 44px disc and the words do not fit in it, and the
         deal glyph is still the right picture - it deals the same four cards
         again. Positioned like the tooltip above, on the wrapper and out of
         flow, so it cannot add a row to a bar whose height budget is already
         the tightest thing in the layout. -->
    {#if replayFinished()}
      <span class="cb-spin-caption">{t('Play Again')}</span>
    {/if}
    <!-- Any reason the button is dead, not just the cooldown. -->
    {#if spinBlockedReason()}
      <span class="cb-cooldown-tip" class:is-shown={spinTipVisible} role="tooltip" aria-live="polite"
        >{spinBlockedReason()}</span>
    {/if}
    </div>
  </div>

  <!-- Reachable during a replay. Every switch inside is autoplay-scoped and
       so cannot do anything there, but a dead button gives no feedback at
       all: the popup opens and says why instead. Stake's replay guidance is
       to hide AUTOPLAY SETTINGS, which the rows below honour by disabling
       themselves - the button itself is how a reviewer finds that out. -->
  <!-- Disabled in replay. Everything inside is autoplay-scoped and autoplay
       does not run in a replay, so the menu had nothing that could take
       effect. Stake's replay guidance is explicit about this class of
       control: "hide balance display, play buttons, bet amount selector,
       autoplay settings". The bet display, the steppers and the autoplay
       button were already disabled here; this was the one that was not. -->
  <button class="cb-float cb-advanced" class:active={openPopup === 'advanced'} onclick={() => togglePopup('advanced')} disabled={stateUrlDerived.replay()} aria-label={t('Advanced settings')}>
    <svg class="cb-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" /></svg>
  </button>
</footer>

<style>
  @import '../../styles/board/control-bar.css';
  /* The caption/figure pair, shared with SessionReadouts. */
  @import '../../styles/board/readout.css';
  @import '../../styles/board/responsive-bar.css';
</style>
