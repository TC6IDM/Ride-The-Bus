<!-- The bet-mode picker, and the confirmation step approval asks for.

     Split out of Game.svelte when each control-bar panel became its own file.
     The `{#if openPopup === 'mode'}` that decides whether this is on screen
     stays with the parent - which panel is open is the component's own state -
     and this file is the panel itself.

     A RACK OF DESTINATION BLINDS (the owner's pick G1, 2026-10-18 - it
     replaced G3's dealt hand the same day; both are in the design archive).
     The five families are five cards in a row, in volatility order, each
     headed by the MODE sign itself: the family's name lettered in its colour
     on the recessed dark sign the bar shows, with the seven bolts. Under it a
     picture made of the game's own pieces (FamilyVignette), its sentence, its
     maximum win as the one big figure and its cost where that is not 1x, and
     Switch - or "Playing" on the live one. Switch TURNS THE CARD OVER where it
     stands (G3's turn, kept on G1's cards by the owner's call of 2026-10-19 -
     in place, not to the middle of the table): its back is the confirmation
     Stake asks for (what it costs, the most it pays, what the four picks on
     the board would top out at), with Cancel and Switch. The other four stay
     as they are - nothing dims (the same call). Dealt up from the table as
     the panel opens. On a phone the five are rows, scrolling under the
     heading.

     STYLES TRAVEL WITH THE MARKUP. A stylesheet is scoped to whichever
     component imports it (see the note atop ChoiceIcon.svelte), so
     styles/popup-mode.css is imported here and nowhere else. Colour comes in
     through the family tokens; nothing below names a colour of its own. -->
<script lang="ts">
  import BoltMeter from '../icons/BoltMeter.svelte';
  import MarkIcon from '../icons/MarkIcon.svelte';
  import FamilyVignette from './FamilyVignette.svelte';
  import gameConfig from '../../game/platform/config';
  import { t } from '../../i18n/i18nDerived';
  import { formatMultiplier } from '../../game/ui/formatMultiplier';
  import { FAMILY_BLURB, FAMILY_RULES, stageCount, type ModeFamily } from '../../game/math/modes';
  import { clearBoard } from '../../game/round/roundState.svelte';
  import {
    FAMILIES_BY_VOLATILITY,
    FAMILY_BOLTS,
    VOLATILITY_BOLTS,
    volatilityColorRgbVar,
    volatilityColorVar,
  } from '../../game/math/volatility';
  import { bet, selectedCeiling, volatilityLabel } from '../../game/bet/betState.svelte';
  import { titleFaceFor } from '../../game/ui/displayFace';
  import { fitBlock } from '../../game/ui/fitValue';

  let { onclose }: { onclose: () => void } = $props();

  // The panel opens on its HAND, always. `bet.pending` survives a close - it
  // is bet state, not panel state, and the panel is destroyed and remade on
  // every open - so a mode confirmed, or a confirmation abandoned by closing
  // the panel, came back as that same confirmation the next time. Cleared on
  // mount rather than on close so every way of leaving is covered.
  bet.pending = null;

  /** "Max win 1,354.2× your bet", split so the figure can be the card's one big number in any word order. */
  const maxWinParts = $derived(t('Max win %s your bet').split('%s'));

  let handEl = $state<HTMLElement>();

  /**
   * A click OFF the cards closes the panel, like the backdrop does for every
   * other panel. This one fills the screen (it scrolls under its heading on a
   * small one), so it sits over its own backdrop and swallowed every click
   * meant for it - the owner: "clicking outside the bet modes should dismiss
   * it", 2026-10-23. A click inside a card, the heading or the notes stays.
   *
   * A pointer convenience, attached here rather than as an onclick on the
   * dialog: its keyboard equivalent is Escape, which Game.svelte already
   * gives every panel, and a click handler in the markup made svelte-check
   * ask for a second, redundant key handler on a non-interactive element.
   */
  let panelEl = $state<HTMLElement>();
  $effect(() => {
    const panel = panelEl;
    if (!panel) return;
    const closeOnEmpty = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('.mcard, .mode-head, .mode-notes')) return;
      onclose();
    };
    panel.addEventListener('click', closeOnEmpty);
    return () => panel.removeEventListener('click', closeOnEmpty);
  });

  // A card asked to confirm takes focus to its safe answer, Cancel - so a
  // keyboard player lands on the confirmation, and a stray Enter does not switch.
  $effect(() => {
    const pending = bet.pending;
    if (!pending || !handEl) return;
    queueMicrotask(() => handEl?.querySelector<HTMLElement>(`.mcard[data-family="${pending}"] .mode-confirm-cancel`)?.focus());
  });
</script>

  <div
    class="popup popup-mode"
    class:confirming={bet.pending !== null}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    aria-label={t('Game mode')}
    bind:this={panelEl}
    style={`--tint: ${volatilityColorVar(bet.family)}; --tint-rgb: ${volatilityColorRgbVar(bet.family)}; --tint-strong: ${volatilityColorVar(bet.family)}`}
  >
    <div class="popup-head mode-head">
      <!-- Always the panel's name: the question is asked on the card itself,
           and asking it in both places read twice. -->
      <span>{t('Game mode')}</span>
      <button class="popup-close" onclick={onclose} aria-label={t('Close')}><MarkIcon name="cross" /></button>
    </div>

    <!-- Volatility order, not publication order. MODE_FAMILIES is
         ['base','sc','hs','tr'] because that is what the math publishes, so
         the cards would draw 3, 1, 5 bolts along the rack - a ruler beside
         values in no order. See FAMILIES_BY_VOLATILITY. -->
    <ul class="rack" bind:this={handEl}>
      {#each FAMILIES_BY_VOLATILITY as family, index (family)}
        {@const rules = FAMILY_RULES[family]}
        {@const turning = bet.pending === family}
        {@const picked = selectedCeiling(family)}
        <li
          class="mcard"
          class:live={bet.family === family}
          class:chosen={turning}
          data-family={family}
          {...bet.family === family ? { 'aria-current': 'true' } : {}}
          style={`--fam: ${volatilityColorVar(family)}; --fam-rgb: ${volatilityColorRgbVar(family)}; --i: ${index}`}
        >
          <!-- The confirmation is FIRST in the markup: it is the card's BACK,
               turned away until the card turns over, so the order is
               invisible, and while it is not asked it is inert. It keeps the
               switch handler ahead of every other Switch label, where
               modes.test.ts reads it.

               The confirmation step approval asks for. It restates what the
               player is about to buy - its cost, its ceiling, what the picks
               reach - from the same FAMILY_RULES the card reads, so the two
               can never describe a mode differently. -->
          <div class="mode-confirm" inert={!turning}>
            <span class="mode-confirm-name face-{titleFaceFor(t(rules.label))}">{t(rules.label)}</span>
            <span class="mode-confirm-q">{t('Switch mode?')}</span>
            <!-- The cost, when it is not the base 1x. Stake's checklist wants a
                 high-cost mode to state its cost before it is activated, and
                 this confirmation IS that step. -->
            {#if rules.cost !== 1}
              <p class="mode-confirm-cost">{t('Costs %c× your bet').replace('%c', String(rules.cost))}</p>
            {/if}
            <p class="mode-confirm-max">{t('Max win %s your bet').replace('%s', formatMultiplier(rules.maxWin))}</p>
            <!-- The family's ceiling is the headline above; this is what the
                 four guesses already on the board would top out at if the
                 switch goes through. Only 8 of a family's 64 combinations reach
                 the headline, so without it the confirmation overstates most
                 switches about fivefold. Shown whenever the guesses are
                 complete, including when the two agree - the two agreeing IS
                 the information. Not on a family with no guesses: "your four
                 guesses" would name picks the player did not make. -->
            {#if picked !== null && !rules.fixedChoices}
              <p class="mode-confirm-picked">
                {t('Your four guesses top out at %s your bet.').replace('%s', formatMultiplier(picked))}
              </p>
            {/if}
            <div class="mode-confirm-actions">
              <!-- Cancelling puts focus back on the card's Switch, which the
                   confirmation covered. -->
              <button
                type="button"
                class="mode-confirm-cancel"
                onclick={() => {
                  bet.pending = null;
                  queueMicrotask(() => handEl?.querySelector<HTMLElement>(`.mcard[data-family="${family}"] .mode-switch`)?.focus());
                }}
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                class="action-button mode-confirm-go"
                onclick={() => {
                  const to = bet.pending!;
                  // A switch that changes the number of cards dealt turns the
                  // last round's cards back over - see clearBoard.
                  if (stageCount(FAMILY_RULES[to]) !== stageCount(FAMILY_RULES[bet.family])) clearBoard();
                  bet.family = to;
                  bet.pending = null;
                  onclose();
                }}
              >
                {t('Switch')}
              </button>
            </div>
          </div>
          <div class="front" inert={turning}>
            <!-- THE MODE SIGN, at card size: the name lettered in the family's
                 colour on the recessed dark sign, the seven bolts under it -
                 the same blind the bar shows. The FAMILY's own rating, without
                 the guesses: the bet display adds one stop per Equal pick. -->
            <div class="sign">
              <span class="nm face-{titleFaceFor(t(rules.label))}" use:fitBlock={t(rules.label)}>{t(rules.label)}</span>
              <span class="bolts">
                <BoltMeter lit={FAMILY_BOLTS[family]} total={VOLATILITY_BOLTS} label={volatilityLabel(FAMILY_BOLTS[family])} />
              </span>
            </div>
            <div class="vig"><FamilyVignette {family} /></div>
            <p class="bl">{t(FAMILY_BLURB[family])}</p>
            <!-- Approval requires the maximum win per mode. Read from
                 FAMILY_RULES rather than written into the blurb, so the figure
                 exists once and a test can pin it to the payout maths. -->
            <p class="fg">
              <span class="fg-cap">{maxWinParts[0]}</span><b class="fg-fig">{formatMultiplier(rules.maxWin)}</b><span class="fg-cap">{maxWinParts[1] ?? ''}</span>
              <!-- And the cost, on the family where it is not 1x. Approval
                   wants "description and cost information" per mode; the
                   others carry it in the note under the rack. -->
              {#if rules.cost !== 1}
                <em class="fg-cost">{t('Costs %c× your bet').replace('%c', String(rules.cost))}</em>
              {/if}
            </p>
            <div class="ac">
              {#if bet.family === family}
                <span class="now">{t('Playing')}</span>
              {:else}
                <button type="button" class="action-button mode-switch" onclick={() => (bet.pending = family)}>{t('Switch')}</button>
              {/if}
            </div>
          </div>

        </li>
      {/each}
    </ul>

    <div class="mode-notes">
      <!-- Cost and RTP in one sentence, both interpolated - from FAMILY_RULES
           and game/config.ts - rather than written into the string. The mode
           it names is the one BEING CONFIRMED when a card asks, and the live
           one otherwise. -->
      <p class="mode-note">
        {t('This mode costs %c× your bet. Every mode returns the same %s over many rounds; what changes is how often a round pays and how much it can pay.')
          .replace('%c', String(FAMILY_RULES[bet.pending ?? bet.family].cost))
          .replace('%s', `${(gameConfig.rtp * 100).toFixed(2)}%`)}
      </p>
    </div>
  </div>

<style>
  @import '../../styles/popups/popup-base.css';
  @import '../../styles/popups/popup-head.css';
  @import '../../styles/popups/popup-mode.css';
</style>
