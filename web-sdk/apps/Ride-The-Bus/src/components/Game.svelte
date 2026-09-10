<script lang="ts">
  import { logoAsset } from '../game/ui/logoAsset.svelte';
  import './app.css';
  // TYPE ONLY, deliberately - this line erases at build time.
  //
  // The card GENERATOR now lives in roundShuffler.ts, reached only by the
  // dynamic import inside the DEV-only branch of playRound, which is what lets
  // Vite drop it from a production build. Splitting the two was the point:
  // while the shuffler shared this module, the paytable and the rules screen
  // imported it statically for `ranks` and `rankValue`, so the module was in
  // the graph regardless and a real-money bundle still carried a shuffler.
  // Vite warned about exactly this on every build.
  import {
    stateBet,
    stateUrlDerived,
    stateMeta,
    stateModal,
  } from 'state-shared';
  import ErrorModal from './popups/ErrorModal.svelte';
  import StartScreen from './intro/StartScreen.svelte';
  // The guess icons live in one component so the board and the start screen's
  // how-to-play cannot drift apart - see ChoiceIcon.svelte.
  import ChoiceIcon from './icons/ChoiceIcon.svelte';
  // Suits and the mute button are drawn, not typed: see SuitIcon.svelte for why
  // a font glyph was the wrong tool for the most important mark in a card game.
  import SuitIcon from './icons/SuitIcon.svelte';
  import MarkIcon from './icons/MarkIcon.svelte';
  import SoundIcon from './icons/SoundIcon.svelte';
  import TableScene from './board/TableScene.svelte';
  import HowToPlayPopup from './popups/HowToPlayPopup.svelte';
  import ControlBar from './board/ControlBar.svelte';
  import GameBoard from './board/GameBoard.svelte';
  import SessionReadouts from './board/SessionReadouts.svelte';
  import AdvancedPopup from './popups/AdvancedPopup.svelte';
  import AutospinPopup from './popups/AutospinPopup.svelte';
  import BetPopup from './popups/BetPopup.svelte';
  import ModePopup from './popups/ModePopup.svelte';
  import SoundPopup from './popups/SoundPopup.svelte';
  import TurboPopup from './popups/TurboPopup.svelte';
  import BoltMeter from './icons/BoltMeter.svelte';
  import WinCelebration from './board/WinCelebration.svelte';
  // Of the five documented RGS endpoints this game uses three: authenticate
  // (via <Authenticate>), play and end-round. The other two are deliberately
  // not called, recorded here so the omissions read as decisions:
  //
  //   /bet/event   - tracks how far through a round the player has got, for
  //                  resuming after a disconnect. This round is atomic: all
  //                  four guesses are locked in before the bet, so there are no
  //                  in-round player actions to track, and the outcome is fixed
  //                  the moment /wallet/play returns. Reporting it would mean
  //                  one call per book event - five per round, so ~5,000 extra
  //                  requests across a 1,000-round autoplay - to buy a resume
  //                  that starts mid-reveal instead of replaying the round,
  //                  which is arguably worse to watch anyway.
  //
  //   /wallet/balance - "useful for periodic balance updates" (RGS.md). NOW
  //                  USED, by refreshBalance() below. It was skipped on the
  //                  grounds that play and end-round already refresh the balance
  //                  and between them "cover every way this game can change
  //                  it" - which is true and is the wrong test. The player can
  //                  change it too: a deposit made on Stake with the game open
  //                  left a stale figure on the bar until the next round
  //                  settled, and a player who has just topped up and still
  //                  cannot afford a bet has no way to tell that the game simply
  //                  has not looked. The SDK ships no helper, so this one is
  //                  posted through rgsFetcher directly.
  import { requestBalance } from 'rgs-requests';
  import { pacedRequest } from '../game/round/rgsPacing';
  import { sound } from '../game/audio/sound';
  import { music, type MusicScene } from '../game/audio/music';
  import { primeAudio } from '../game/audio/audioAutoplay';
  import { MUSIC_BED } from '../game/audio/bedAsset';
  import {
    ceilingFor,
  } from '../game/math/modes';
  import { fitValue } from '../game/ui/fitValue';
  import { fitBetFont } from '../game/bet/betFieldFont';
  import { onDocumentClick } from '../game/ui/pressCues';
  import { applyDevSession } from '../game/dev/devSession';
  import {
    flipDurSec,
    pacing,
  } from '../game/round/revealPacing.svelte';
  import {
    advanced,
    auto,
    autoRoundsValid,
  } from '../game/round/autoplaySettings.svelte';
  import {
    engineRound,
    round,
    roundInProgress,
  } from '../game/round/roundState.svelte';
  import {
    celebration,
    celebrationAutoSkipMs,
    dismissCelebration,
  } from '../game/celebration/celebrationState.svelte';
  import {
    allChoicesMade,
    bet,
    betDisplay,
    betIsValid,
    betLevels,
    betLockedReason,
    formatBetInput,
    guesses,
    selectedCeiling,
  } from '../game/bet/betState.svelte';
  import {
    configureRoundFlow,
    gate,
  } from '../game/round/roundPlace.svelte';
  import { animateRoundFromEvents, waitForLoaderGone } from '../game/round/roundReveal.svelte';
  import { startAuto, stopAuto } from '../game/round/autoplayLoop.svelte';
  import { replay, restoreReplay, restoreResume } from '../game/round/roundRestore.svelte';
  import { gameReady, loaderGone } from '../game/platform/ready.svelte';
  import { jurisdiction } from '../game/jurisdiction/jurisdiction.svelte';
  // Sourced from the shared config rather than retyped, so a displayed RTP can
  // never drift from the one the math is actually built and reweighted to.
  import gameConfig from '../game/platform/config';
  import { t } from '../i18n/i18nDerived';
  import { numberToCurrencyString } from 'utils-shared/amount';
  import { API_AMOUNT_MULTIPLIER } from 'constants-shared/bet';

  // Stake Engine requires every bet to be a single, independent, stateless
  // outcome - no continuation, no early cashout (Key Restrictions in Stake's
  // approval docs). So the player picks all 4 guesses up front; pressing
  // Start places ONE bet (mode encodes the full choice combination - see
  // math-sdk games/ride_the_bus/game_calculations.py:mode_name) that
  // resolves completely in a single /wallet/play call. Everything after
  // that is just animating the already-fully-determined result.

  type Props = { roundSeed?: string };

  const fallbackRoundSeed = 'ride-the-bus-local-round';
  let { roundSeed = fallbackRoundSeed }: Props = $props();

  const IS_PROD = Boolean((import.meta as any).env?.PROD);

  /** Dev-only ?bet= seed, applied below and consumed by bet.input's initialiser. */
  let devStartBet: number | null = null;

  // Local dev stands in for /wallet/authenticate - the currency, balance,
  // opening bet and the three bet limits, all driven from the URL. See
  // game/dev/devSession.ts, and game/dev/devOverrides.ts for the jurisdiction block.
  //
  // Written as an `import.meta.env.DEV` literal, which Vite replaces with
  // `false` in a production build, so the module is dropped from the bundle
  // and a real session can only be configured by the RGS.
  if (import.meta.env.DEV) {
    devStartBet = applyDevSession().startBet;
  }

  // This game has no "BASE" bet mode - every one of its 192 modes encodes a
  // full guess combination in one of three families (see math-sdk mode_name:
  // 64 combinations x base / sc_ / hs_). The shared bet state
  // defaults activeBetModeKey to 'BASE', and the framework's bet-cost
  // helpers (stateBetDerived.betCostMultiplier -> activeBetMode().type)
  // dereference the looked-up mode without a null guard - so once the RGS
  // loads our modes, 'BASE' resolves to null and Set Bet / any cost check
  // throws "Cannot read properties of null (reading 'type')". Keep the active
  // key pointed at a mode that actually exists in betModeMeta. Every one of the
  // 192 costs 1.0x, so any of them is fine for cost purposes - and that is not
  // an accident, it is why this guard can stay this simple. The real per-round
  // mode, family prefix and all, is sent explicitly to /wallet/play in
  // startGameEngineFlow.
  $effect(() => {
    const meta = stateMeta.betModeMeta ?? {};
    const key = stateBet.activeBetModeKey ?? '';
    const resolves = meta[key] || meta[key.toUpperCase?.()] || meta[key.toLowerCase?.()];
    if (!resolves) {
      const firstMode = Object.keys(meta)[0];
      if (firstMode) stateBet.activeBetModeKey = firstMode;
    }
  });

  // Local dev has no RGS to authenticate against, so Authenticate always fails
  // and posts an error modal. That's expected here - this game deliberately
  // falls back to a locally-generated round - and the modal would otherwise
  // cover the board on every load. Deliberately narrow: a production build, or
  // any real session, keeps the modal, because an auth failure there is
  // something the player genuinely needs to see.
  //
  // REPLAY IS EXEMPT. A replay failure in dev is not the ambient "there is no
  // RGS on localhost" noise this exists to silence - it is the one thing that
  // has actually gone wrong, and swallowing it leaves the game sitting on
  // "Loading replay…" forever with no clue why. That is exactly how a bad
  // rgs_url, an unreachable replay server and a refused certificate all
  // presented: as a hang.
  $effect(() => {
    if (IS_PROD || stateUrlDerived.sessionID() || stateUrlDerived.replay()) return;
    if (stateModal.modal?.name === 'error') stateModal.modal = null;
  });

  // Intro / start-screen state. On every page load the loader clears first,
  // then the start screen appears. In normal play, clicking "Tap to Continue"
  // dismisses it and the game begins. In replay mode, the same click advances
  // to the replay-info popup; clicking "Play" starts the reveal.
  let introPhase = $state<'loading' | 'start' | 'replay-info' | 'playing'>('loading');
  let introDismissed = $state(false);
  // Replay data arrives before the intro sequence finishes — park it here.
  // Payout multiplier from the replay RGS response, shown on the info popup.

  let betRowEl = $state<HTMLElement>();

  // The regulator can bar Turbo outright, or bar only its instant end
  // ("super turbo"). Clamp continuously rather than just at startup: the
  // jurisdiction block arrives with /wallet/authenticate, and this also
  // re-corrects if a stale value was restored from a previous session.
  $effect(() => {
    // The cap and the clamping rule live in game/jurisdiction/jurisdictionRules.ts, so the
    // slider's max attribute below and this backstop can't disagree.
    const clamped = jurisdiction.clampTurbo(pacing.turboSpeed);
    if (clamped !== pacing.turboSpeed) pacing.turboSpeed = clamped;
    // A barred control must not sit open either.
    if (jurisdiction.turboDisabled() && openPopup === 'turbo') openPopup = null;
  });

  // Same for autoplay: bar the control, and stop any run already going.
  $effect(() => {
    if (!jurisdiction.autoplayDisabled()) return;
    if (openPopup === 'autospin') openPopup = null;
    if (auto.running) stopAuto();
  });

  // Bottom control-bar UI: which popup (if any) is open, plus mute state.
  let openPopup = $state<null | 'bet' | 'mode' | 'turbo' | 'autospin' | 'advanced' | 'info' | 'sound'>(null);
  /**
   * The simulation ID to print on the round-details panel.
   *
   * The RGS's own answer first, the URL parameter second. In production those
   * are always the same thing - Stake documents `event` as the unique
   * simulation ID and a real replay URL carries one - so the fallback is the
   * normal path and this looks like a no-op.
   *
   * It is not a no-op locally. scripts/replay-server.mjs accepts four aliases
   * (max / big / win / loss) that resolve against the mode's lookup table, so
   * `event=max` is a real request whose ID only the server knows; echoing the
   * URL made the panel read "Event #max". The server returns the ID it served
   * as `bookId` and this prefers it.
   *
   * Preferring the response is also the more correct rule in general: the panel
   * should name the round that was actually played, not the string that was
   * asked for.
   */
  function replayEventId(): string {
    const served = (stateBet.betToResume as { bookId?: unknown } | undefined)?.bookId;
    if (typeof served === 'number' || (typeof served === 'string' && served !== '')) {
      return String(served);
    }
    return stateUrlDerived.event() || '';
  }

  // Keep the shared bet state in sync with the live input so "Current Bet" and
  // the play call always reflect what's shown.
  $effect(() => {
    const raw = `${bet.input ?? ''}`.trim();
    const v = Number(raw);
    stateBet.betAmount = raw !== '' && !isNaN(v) && v >= 0 ? v : 0;
  });

  /**
   * Enter in the bet field: snap the amount and close the menu.
   *
   * formatBetInput already runs on blur and does the snapping, but a keydown
   * fires BEFORE the field loses focus - so this calls it directly rather than
   * relying on the blur that closing the popup happens to cause. Escape is left
   * to the popup's own handler.
   */
  function onBetInputKey(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    formatBetInput();
    closePopup();
  }

  /**
   * A panel that can no longer do anything closes itself.
   *
   * The buttons that open these are disabled once a round is in flight, but a
   * panel already OPEN when the round starts would stay up showing controls
   * that silently refuse - which is worse than a greyed button, because it
   * looks like it should work. Covers every entry point (the spin button, the
   * spacebar, an autoplay run) rather than each one remembering to tidy up.
   */
  $effect(() => {
    if (roundInProgress() && (openPopup === 'bet' || openPopup === 'mode')) {
      openPopup = null;
    }
  });

  $effect(() => {
    bet.input; // re-fit whenever the shown amount changes
    fitBetFont(betRowEl, betDisplay());
  });

  $effect(() => {
    const el = betRowEl;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fitBetFont(el, betDisplay()));
    ro.observe(el);
    return () => ro.disconnect();
  });

  // Once (when the RGS's levels arrive) nudge an out-of-range starting bet to
  // the nearest valid level, so the player opens on a playable amount.
  //
  // betLevels() so "valid" means the same thing here as it does on the chips:
  // the raw list can carry levels the same authenticate response puts out of
  // range, and seeding the opening bet from one of those opens the game on an
  // amount the spin button will not take.
  $effect(() => {
    if (bet.defaulted || !stateUrlDerived.sessionID()) return;
    const levels = betLevels();
    if (levels && levels.length) {
      const v = Number(bet.input);
      const lo = Math.min(...levels);
      const hi = Math.max(...levels);
      if (!(v >= lo && v <= hi)) {
        bet.input = String(levels.reduce((best, l) => (Math.abs(l - v) < Math.abs(best - v) ? l : best), levels[0]));
      }
      bet.defaulted = true;
    }
  });

  configureRoundFlow({
    roundSeed: () => roundSeed,
    fallbackRoundSeed,
    // openPopup is this component's, so closing the bet menu is too.
    closeBetMenu: () => {
      if (openPopup === 'bet') openPopup = null;
    },
  });

  // ONE ROUND, start to finish - placing the bet, turning the four cards and
  // settling it - lives in game/roundFlow.svelte.ts, and the autoplay loop
  // that repeats it in game/round/autoplayLoop.svelte.ts.
  //
  // The two $effects that restore an interrupted or replayed round stay here,
  // below: $effect only runs inside a component, and keeping the pair side by
  // side is what lets modes.test.ts check there are exactly two of them and
  // that both apply parsed.family.

  // Both restore paths live in game/round/roundRestore.svelte.ts. $effect only runs
  // inside a component, so the two effects stay here and the bodies do not.
  $effect(() => restoreReplay());
  $effect(() => restoreResume());

  // --- Intro / start-screen transitions ------------------------------------
  // Called when the player clicks "Tap to Continue" on the start screen.
  // In normal play this dismisses the overlay and the game begins. In replay
  // mode it advances to the replay-info popup instead.
  function onStartContinue() {
    if (stateUrlDerived.replay()) {
      introPhase = 'replay-info';
    } else {
      introPhase = 'playing';
      introDismissed = true;
    }
  }

  // Called when the player clicks "Play" on the replay-info popup.
  // Builds the reveal events from the parked replay data and starts the
  // animation. The spin button will replay the round from here on.
  function onReplayPlay() {
    introPhase = 'playing';
    introDismissed = true;
    const resume = stateBet.betToResume as any;
    if (!resume?.state) return;
    animateRoundFromEvents(
      resume.state,
      `${resume.roundID ?? stateUrlDerived.event()}`,
      'engine-replay',
      'Replay returned no round state for this event.',
    ).catch((err) => {
      console.error('[RideTheBus] replay failed', err);
      stateModal.modal = { name: 'error', error: err };
    });
  }

  // --- Intro-loaded handoff -------------------------------------------------
  // Once the loader clears and the game tree has mounted, the start screen
  // replaces it. This used to be handled by the replay $effect calling
  // waitForLoaderGone() directly — now the intro transitions drive it.
  $effect(() => {
    if (introPhase !== 'loading') return;
    // The replay data might arrive before the loader clears, and the normal
    // flow needs neither. Only flip to 'start' once the loader is actually
    // gone — everything else is handled by onStartContinue / onReplayPlay.
    if (!loaderGone.value) return;
    introPhase = 'start';
  });

  // The bar's own behaviour - the spin button, the popup toggles and the bet
  // tip - moved with it into ControlBar.svelte. These three stayed: they are
  // what the POPUPS call, and the switchboard that renders them is here.
  function closePopup() {
    openPopup = null;
    // Leaving the picker abandons an unconfirmed pick. Without this, reopening
    // it would land straight back on a confirmation the player had already
    // walked away from.
    bet.pending = null;
  }

  function setBetLevel(v: number) {
    // Belt and braces. The chips are unreachable while the bet is locked - the
    // panel that holds them cannot be opened - but a run can also START with
    // the menu already open, and this is the one line that has to hold for the
    // bet actually to be safe.
    if (betLockedReason()) return;
    bet.input = String(v);
    openPopup = null;
  }

  /** Autoplay popup Start: close it and kick off the run. */
  function startAutoFromPopup() {
    if (!betIsValid() || !allChoicesMade() || !autoRoundsValid()) return;
    openPopup = null;
    startAuto();
  }

  // The spacebar shortcut moved into ControlBar.svelte: a tap on it is a
  // press of the spin button, so it belongs with the button.

  // DEV ONLY: let ?dev_* query params stand in for the RGS config, so the
  // jurisdiction rules and bet grid can be exercised on localhost where there
  // is no /wallet/authenticate. Written as an `import.meta.env.DEV` literal so
  // Vite drops the whole thing - and devOverrides itself - from a production
  // build.
  if (import.meta.env.DEV) {
    $effect(() => {
      void import('../game/dev/devOverrides').then(({ applyDevOverrides }) => {
        const applied = applyDevOverrides(window.location.search);
        if (applied.length) console.log('[RideTheBus] dev overrides:', applied.join(', '));
      });
    });
  }

  // Tell the loader the board is actually on screen. It sits outside this
  // component's tree (see game/platform/ready.svelte.ts), and clearing on a timer alone
  // left a gap of empty screen while <Authenticate> was still resolving.
  $effect(() => {
    gameReady.value = true;
  });

  // The produced track, handed over rather than imported by music.ts - it needs
  // `${base}`, and a module reaching $app/* cannot be unit tested. Before this,
  // or if the file is missing, the room is fully synthesised.
  music.setBed(MUSIC_BED);

  // Open the audio graph as early as the browser allows, so the bed is playing
  // UNDER the loading and start screens rather than arriving with the tap that
  // leaves them. Where autoplay is blocked this builds nothing and waits for the
  // first gesture anywhere on the page - see primeAudio, which carries the whole
  // argument. The cue book still opens a context on its own presses; this only
  // makes the two screens with nothing to press stop being silent.
  $effect(() => primeAudio());

  /**
   * Where the bed thinks the player is.
   *
   * ONE derivation rather than a line at each of the five introPhase
   * assignments and both ends of the round, because it cannot then be forgotten
   * at a sixth. Everything it reads is $state, so the effect below re-runs on
   * its own; music.setScene ignores a repeat.
   *
   * THE ORDER IS THE RANKING, and only one pair of it is subtle: a celebration
   * is checked BEFORE the round, because the round flow awaits the takeover's
   * dismissal and so is still "in progress" underneath it. Tested the other way
   * round, a big win would score itself at the round level and never duck for
   * its own fanfare.
   *
   * 'loading' and 'lobby' DO sound now, which they did not before primeAudio
   * above: nothing is pressed while the loader and the intro are up, so there
   * was no running AudioContext for the scheduler to join and both screens set
   * a scene that could never be heard. Where the embedder blocks autoplay they
   * are still silent until the first gesture, which is a browser rule rather
   * than something to chase.
   */
  const musicScene = (): MusicScene => {
    if (introPhase === 'loading') return 'loading';
    if (introPhase !== 'playing') return 'lobby';
    if (celebration.active) return 'celebration';
    if (roundInProgress()) return 'round';
    return 'idle';
  };

  $effect(() => {
    music.setScene(musicScene());
  });

  $effect(() => {
    return () => music.stop();
  });

  /**
   * Pull the wallet balance from the RGS.
   *
   * Only ever RAISES confidence in the displayed figure - it overwrites with the
   * server's own number, and decides nothing. Skipped while a round is in
   * flight: play and end-round are authoritative there and a poll landing
   * between them would put a pre-settlement figure back on the bar.
   */
  async function refreshBalance() {
    if (!stateUrlDerived.sessionID() || !stateUrlDerived.rgsUrl()) return;
    if (stateUrlDerived.replay() || roundInProgress() || engineRound.open) return;
    try {
      const data = await pacedRequest('balance', () =>
        requestBalance({
          rgsUrl: stateUrlDerived.rgsUrl(),
          sessionID: stateUrlDerived.sessionID(),
        }),
      );
      const amount = (data as any)?.balance?.amount;
      // Same guard as end-round, and for the same reason: null divided by the
      // multiplier is 0, which would zero the bar rather than leave it stale.
      if (typeof amount === 'number' && Number.isFinite(amount)) {
        stateBet.balanceAmount = amount / API_AMOUNT_MULTIPLIER;
      }
    } catch {
      // A balance poll is a convenience. An RGS that does not answer it, or a
      // network blip, must never surface an error over a game that is otherwise
      // working - the next play or end-round response corrects the figure.
    }
  }

  /**
   * Poll while idle, and immediately whenever the tab comes back.
   *
   * The visibility half is the one that matters. Topping up means leaving this
   * tab for the cashier and coming back, so returning focus is both the moment
   * the balance is most likely to be wrong and the moment the player is most
   * likely to be looking at it. The interval is the fallback for a deposit made
   * on a phone or a second device with the game still on screen.
   */
  const BALANCE_POLL_MS = 15_000;

  $effect(() => {
    if (!stateUrlDerived.sessionID() || stateUrlDerived.replay()) return;
    const timer = setInterval(refreshBalance, BALANCE_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshBalance();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  });

  // The delegated click cue is the whole page's, so it stays here.
  $effect(() => {
    document.addEventListener('click', onDocumentClick, true);
    return () => document.removeEventListener('click', onDocumentClick, true);
  });

  // The DEV-only local dealer lives in game/round/localRound.ts, imported
  // dynamically below so it can be dropped from a production build.

</script>

<!-- Start / intro screen overlay. Shown on every page load after the loader
     clears. In normal play a single "Tap to Continue" dismisses it. In replay
     mode the same tap opens a replay-info popup, and tapping "Play" starts the
     reveal. The game board builds behind it the whole time. -->
{#if introPhase === 'start' || introPhase === 'replay-info'}
  <StartScreen
    phase={introPhase}
    mode={stateUrlDerived.mode() || ''}
    betAmount={round.initialBet}
    eventId={replayEventId()}
    payoutMultiplier={replay.payoutMultiplier}
    oncontinue={onStartContinue}
    onplay={onReplayPlay}
  />
{/if}

<!-- Big-win takeover. Keyed on the tier so a second celebration in an auto run
     remounts rather than reusing the first one's count-up state. -->
{#if celebration.active}
  {#key `${celebration.active.tier.id}-${celebration.active.amount}`}
    <WinCelebration
      tier={celebration.active.tier}
      amount={celebration.active.amount}
      multiplier={celebration.active.multiplier}
      tiers={celebration.active.tiers}
      cards={celebration.active.cards}
      bustedIndex={celebration.active.bustedIndex}
      forgivenIndex={celebration.active.forgivenIndex}
      autoSkipMs={celebrationAutoSkipMs()}
      ondismiss={dismissCelebration}
    />
  {/key}
{/if}

<!-- The backdrop is drawn in CSS, always. There used to be a second path here
     that painted a 1.9 MB bitmap instead, selected by a BACKDROP constant in
     game/backdrop.ts; both the switch and the image are gone. -->
<!-- takeover-open hides the two NUMERIC READOUTS while the win takeover counts
     up - nothing else. See the rule in cards.css: the whole point of the
     segmented climb is that the total is not known yet, and the running-win bar
     and the four stage chips were printing it behind a 5px blur the entire
     time. The table, the cards, the chips and the cups all stay: blacking out
     the scene at the moment of payoff is the mistake win-celebration.css opens
     by warning against. -->
<div
  class="game-layout"
  class:takeover-open={celebration.active !== null}
  style={`--flip-dur: ${flipDurSec()}s; --logo-url: url(${logoAsset.url})`}
>

  <!-- The table and its props. Decorative only - see TableScene.svelte. -->
  <TableScene />

  <SessionReadouts />

  <!-- Game name over the casino's, stacked. The logo deliberately stays out of
       this plate - it is the hero on the loader and sits on every card back,
       which is enough branding once play has started. -->
  <div class="game-title" aria-hidden="true">
    <span class="game-title-main">Ride The Bus</span>
    <span class="game-title-sub">by Takeover Casino</span>
  </div>

  <main class="play-area">
    <GameBoard />
  </main>
  <ControlBar bind:openPopup bind:betRowEl {introPhase} />

  {#if openPopup}
    <button class="popup-backdrop" aria-label={t('Close menu')} onclick={closePopup}></button>
  {/if}

  <!-- Bet mode. Approval requires each mode's cost and what it buys to be
       stated, so the cost sits on every row and the trade-off is spelled out
       rather than left to the paytable. -->
  {#if openPopup === 'mode'}
    <ModePopup onclose={closePopup} />
  {/if}

  {#if openPopup === 'bet'}
    <BetPopup onclose={closePopup} onpick={setBetLevel} oncommit={onBetInputKey} />
  {/if}

  {#if openPopup === 'turbo' && !jurisdiction.turboDisabled()}
    <TurboPopup onclose={closePopup} />
  {/if}

  <!-- Sound. Two buses on one panel, each with a speaker beside its slider:
       the speaker toggles mute and leaves the level alone, and dragging to zero
       mutes as well, so the glyph can never claim sound is on over a silent bus.
       No jurisdiction gate - "an option to disable sounds" is a blocker
       everywhere, so this panel is the one that must always be reachable. -->
  {#if openPopup === 'sound'}
    <SoundPopup onclose={closePopup} />
  {/if}

  {#if openPopup === 'autospin' && !jurisdiction.autoplayDisabled()}
    <AutospinPopup onclose={closePopup} onstart={startAutoFromPopup} />
  {/if}

  {#if openPopup === 'advanced'}
    <AdvancedPopup onclose={closePopup} />
  {/if}

  {#if openPopup === 'info'}
    <HowToPlayPopup
      family={bet.family}
      ceilingFor={selectedCeiling}
      onclose={closePopup}
    />
  {/if}
</div>

<!-- Our own failure dialog, NOT the SDK's <Modals> bundle.

     This is load-bearing: Authenticate and the bet flow report failures by
     setting stateModal.modal to { name: 'error', ... }, and with nothing
     mounted to read that, a player hitting an auth or session failure just
     sees a stuck screen.

     <Modals> would mount eight others alongside it, including ModalPayTable
     and ModalGameRules, whose bodies are the template's literal "ADD YOUR PAY
     TABLE" / "ADD YOUR GAME RULES" - and those strings were shipping in the
     production bundle. Nothing can open them here: the only triggers are
     ButtonPayTable / ButtonGameRules in components-ui-pixi, the SDK UI this
     game replaced, and there is no postMessage channel for the platform to
     reach them either. This game's rules and payouts live in How to Play.

     ModalError itself is not reused because it renders `<p>{error}</p>` for
     anything lacking both .error and .message - and an RGS failure body is
     { error: 'ERR_IS', status: {...} }, so it showed the player the literal
     text "[object Object]". ErrorModal maps the documented codes instead. -->
<ErrorModal />

<style>
  /* Styles live in src/styles/*.css and are pulled in here so they stay
     SCOPED to this component (vitePreprocess runs Vite's CSS pipeline, which
     resolves these @imports before Svelte scopes the result). Import order
     matters: responsive.css last so its overrides win. */
  @import '../styles/base.css';
  /* Only the backdrop is left: each panel's own rules travel with its
     component now, in styles/popup-*.css. */
  @import '../styles/popups/popup-backdrop.css';
  @import '../styles/responsive.css';
</style>
