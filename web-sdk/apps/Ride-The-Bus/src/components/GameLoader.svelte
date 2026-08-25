<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { logoAsset } from '../game/logoAsset.svelte';
  import { gameReady, loaderGone } from '../game/ready.svelte';
  // The loader renders before /wallet/authenticate returns, but t() needs no
  // session - it reads ?lang= off the URL and the catalogues are static
  // imports - so the very first thing a screen reader announces is localised
  // too. This label was the one hardcoded English string left in the app.
  import { t } from '../i18n/i18nDerived';

  type Props = { oncomplete?: () => void };
  const props: Props = $props();

  // Floor, so the loader can't flash past on a warm cache and read as a glitch.
  const MIN_MS = 1400;
  // Ceiling. Neither a backdrop that never loads (offline, 404, corrupt file)
  // nor an auth call that never returns may strand the player on a loading
  // screen, so past this we hand over regardless and let the game's own error
  // handling take it from there.
  const MAX_MS = 8000;

  let visible = $state(true);
  let progress = $state(0);

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

  // Wait for the bitmaps the game needs, so nothing pops in behind the player a
  // beat after the loader clears. That is just the logo now - the title plate
  // and every card back use it. The backdrop used to be preloaded here too,
  // back when it could be a 1.9 MB bitmap; it is drawn in CSS and downloads
  // nothing.
  function preloadArt(): Promise<unknown> {
    return Promise.all([decode(logoAsset.url)]);
  }

  // <Game /> is a sibling tree, so poll the flag it sets on mount. Polled
  // rather than watched with an effect: this runs inside the setup below, and
  // a tracked read of gameReady there would make the whole setup re-run the
  // moment the flag flipped - restarting the timer and resetting the bar.
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
    const started = performance.now();
    let done = false;
    let raf = 0;

    // Creep toward 90% on elapsed time and leave the last 10% for everything
    // actually being ready, so a full bar means ready rather than "probably".
    const tick = () => {
      if (done) return;
      progress = Math.min(0.9, (performance.now() - started) / MIN_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      progress = 1;
      // Let the filled bar register before the fade starts.
      setTimeout(() => {
        visible = false;
        // Anything that must not animate behind the overlay waits on this -
        // notably replay and round-resume, which otherwise start the reveal
        // while this is still covering the table. Set alongside `visible`
        // rather than in oncomplete so it holds however the loader is used.
        loaderGone.value = true;
        props.oncomplete?.();
      }, 220);
    };

    const cap = setTimeout(finish, MAX_MS);

    void Promise.all([
      preloadArt(),
      waitForGame(),
      new Promise((r) => setTimeout(r, MIN_MS)),
    ]).then(finish);

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      clearTimeout(cap);
    };
  });
</script>

{#if visible}
  <!-- `game-loader`, not `loader`: the SDK's own LoaderImage already puts
       class="loader" on its <img>, and a shared name makes anything selecting
       by class ambiguous. -->
  <div
    class="game-loader"
    style={`--logo-url: url(${logoAsset.url})`}
    transition:fade={{ duration: 320 }}
    role="status"
    aria-label={t('Loading Ride The Bus…')}
  >
    <!-- Logo as the hero, with the game's name and the casino's stacked below
         it, matching the in-game title plate. -->
    <!-- Decorative: the title beneath it already names the game, so a screen
         reader announcing the mark as well would say it twice. The cards and
         the progress bar below carry the same attribute for the same reason. -->
    <div class="gl-logo" aria-hidden="true"></div>
    <div class="gl-title">
      <span class="gl-title-main">Ride The Bus</span>
      <span class="gl-title-sub">by Takeover Casino</span>
    </div>

    <div class="gl-cards" aria-hidden="true">
      <div class="gl-card"></div>
      <div class="gl-card"></div>
      <div class="gl-card"></div>
      <div class="gl-card"></div>
    </div>

    <div class="gl-bar" aria-hidden="true">
      <div class="gl-bar-fill" style={`transform: scaleX(${progress.toFixed(3)})`}></div>
    </div>
  </div>
{/if}

<style>
  @import '../styles/loader.css';
</style>
