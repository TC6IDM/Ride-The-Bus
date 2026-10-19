<script lang="ts">
  /**
   * THE DESTINATION BLIND (the owner's pick A2, 2026-10-17). The game loads on
   * the front of a bus: a recessed sign, the MODE sign's own recipe at hero
   * size, whose blind rolls through the route's stops as the game gets ready -
   * Red / Black, Higher / Lower, Inside / Outside, the four suits - and lands
   * on the game's name, which drops its frame and stands as the lockup. Under
   * it a route of five stops lights stop by stop, the bus riding along it.
   * Behind it, the room and the empty table the intro opens on, so the
   * handover is not a change of scene.
   *
   * It replaced a centred splash whose progress bar crept to 90% on a timer
   * and then sat there while the real work finished, and four card backs that
   * never landed anywhere (the Phase 1 audit, 2026-10-16). A stop here is a
   * MILESTONE, never a timer: the art decoded, the game mounted, the floor
   * passed. A slow authenticate holds the blind where it is.
   */
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import TableScene from '../board/TableScene.svelte';
  import SuitIcon from '../icons/SuitIcon.svelte';
  import { logoAsset } from '../../game/ui/logoAsset.svelte';
  import { gameReady, loaderGone } from '../../game/platform/ready.svelte';
  import { reducedMotion } from '../../game/celebration/celebrationGestures';
  import { liftTitle } from '../../game/ui/titleHandoff';
  // The loader renders before /wallet/authenticate returns, but t() needs no
  // session - it reads ?lang= off the URL and the catalogues are static
  // imports - so the very first thing a screen reader announces is localised
  // too, and so are the stops on the blind.
  import { t } from '../../i18n/i18nDerived';

  type Props = { oncomplete?: () => void };
  const props: Props = $props();

  // Floor, so the loader can't flash past on a warm cache and read as a glitch.
  const MIN_MS = 1400;
  // Ceiling. Neither art that never loads nor an auth call that never returns
  // may strand the player on a loading screen, so past this we hand over
  // regardless. Kept just ABOVE Authenticate.svelte's launch timeout (10 s),
  // so its error dialog is already up when this clears.
  const MAX_MS = 10_500;
  /** The least a stop is shown for, so the blind can be read as it rolls. */
  const STOP_MS = 380;
  /** The name held, its frame gone, before the screen hands over. */
  const LANDED_MS = 650;

  /** The blind's stops: the four guesses in the order they are made, then the name. */
  const LAST_STOP = 4;
  const SUITS = ['heart', 'spade', 'club', 'diamond'] as const;

  let visible = $state(true);
  /** The stop the blind shows. */
  let stop = $state(0);
  /** The name is up and the sign has dropped its frame. */
  let landed = $state(false);

  // Decode one image; resolves (never rejects) on error, because a missing
  // picture is cosmetic and must not block play.
  function decode(src: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = src;
    });
  }

  // <Game /> is a sibling tree, so poll the flag it sets on mount. Polled
  // rather than watched with an effect: a tracked read of gameReady inside the
  // setup below would re-run the whole setup the moment it flipped.
  function waitForGame(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (gameReady.value) resolve();
        else requestAnimationFrame(check);
      };
      check();
    });
  }

  // onMount, not $effect: this setup has no reactive inputs and must run
  // exactly once.
  onMount(() => {
    let done = false;
    /** The furthest stop the work so far has earned. */
    let earned = 0;
    const earn = (s: number) => {
      earned = Math.max(earned, s);
    };

    // The milestones, in the order they are usually met. Each earns a stop;
    // the stepper below shows them one at a time, never skipping one, so the
    // blind always rolls through all four guesses.
    setTimeout(() => earn(1), STOP_MS);
    void decode(logoAsset.url).then(() => earn(2));
    void waitForGame().then(() => earn(3));
    const floor = new Promise((r) => setTimeout(r, MIN_MS));
    void Promise.all([decode(logoAsset.url), waitForGame(), floor]).then(() => earn(LAST_STOP));

    const land = () => {
      if (done) return;
      done = true;
      landed = true;
      setTimeout(() => {
        // The name lifts off and flies to the intro's (titleHandoff.ts).
        liftTitle([document.querySelector('.gl-title-main'), document.querySelector('.gl-title-sub')]);
        visible = false;
        // Anything that must not animate behind the overlay waits on this -
        // notably replay and round-resume, which otherwise start the reveal
        // while this is still covering the table. Set alongside `visible`
        // rather than in oncomplete so it holds however the loader is used.
        loaderGone.value = true;
        props.oncomplete?.();
      }, reducedMotion() ? 200 : LANDED_MS);
    };

    // One stop at a time, each held at least STOP_MS.
    const stepper = setInterval(() => {
      if (done) return;
      if (stop < earned) stop += 1;
      if (stop === LAST_STOP) {
        clearInterval(stepper);
        setTimeout(land, STOP_MS);
      }
    }, STOP_MS);

    // The ceiling: whatever has not arrived, hand over.
    const cap = setTimeout(() => {
      stop = LAST_STOP;
      land();
    }, MAX_MS);

    return () => {
      done = true;
      clearInterval(stepper);
      clearTimeout(cap);
    };
  });
</script>

{#if visible}
  <!-- `game-loader`, not `loader`: the SDK's own LoaderImage already puts
       class="loader" on its <img>, and a shared name makes anything selecting
       by class ambiguous. -->
  <div class="game-loader" transition:fade={{ duration: 320 }} role="status" aria-label={t('Loading Ride The Bus…')}>
    <!-- The room and the empty table the intro opens on. -->
    <TableScene showProps={false} />

    <!-- Decorative: the status above already names the game and says it is
         loading, so the sign and the route are not read out. -->
    <div class="gl-sign" class:landed aria-hidden="true" style={`--stop: ${stop}`}>
      <div class="gl-window">
        <div class="gl-roll">
          <span class="gl-stop">{t('Red')}&nbsp;/ {t('Black')}</span>
          <span class="gl-stop">{t('Higher')}&nbsp;/ {t('Lower')}</span>
          <span class="gl-stop">{t('Inside')}&nbsp;/ {t('Outside')}</span>
          <span class="gl-stop gl-suits">
            {#each SUITS as suit (suit)}<span class="gl-suit" class:red={suit === 'heart' || suit === 'diamond'}><SuitIcon {suit} /></span>{/each}
          </span>
          <!-- The lockup the loader, the intro and the board share (CLAUDE.md,
               "One wordmark, three screens"). A proper name: not translated. -->
          <span class="gl-stop gl-name">
            <span class="gl-title-main">Ride The Bus</span>
            <span class="gl-title-sub">by Takeover Casino</span>
          </span>
        </div>
      </div>
      <div class="gl-route">
        <span class="gl-line"></span>
        {#each [0, 1, 2, 3, 4] as at (at)}
          <span class="gl-dot" class:lit={at <= stop} class:end={at === LAST_STOP} style={`--at: ${at}`}></span>
        {/each}
        <!-- The bus, at the stop the blind shows. -->
        <svg class="gl-bus" viewBox="0 0 26 14">
          <rect class="gl-bus-body" x="1" y="1" width="24" height="10" rx="2.5" />
          <rect class="gl-bus-glass" x="4" y="3" width="4" height="3" />
          <rect class="gl-bus-glass" x="10" y="3" width="4" height="3" />
          <rect class="gl-bus-glass" x="16" y="3" width="6" height="3" />
          <circle class="gl-bus-wheel" cx="7" cy="11.5" r="2" />
          <circle class="gl-bus-wheel" cx="19" cy="11.5" r="2" />
        </svg>
      </div>
    </div>
  </div>
{/if}

<style>
  @import '../../styles/intro/loader.css';
</style>
