<!-- The bet-mode picker, and the confirmation step approval asks for.

     Split out of Game.svelte when each control-bar panel became its own file.
     The `{#if openPopup === 'mode'}` that decides whether this is on screen
     stays with the parent - which panel is open is the component's own state -
     and this file is the panel itself.

     A DEALT HAND (the owner's pick G3, 2026-10-17, after the Buy Bonus study).
     The five families are five oversized playing cards dealt over the table,
     in volatility order, fanned like a hand: each headed by its colour with
     its name and bolts, a picture made of the game's own pieces
     (FamilyVignette), its sentence, its maximum win as the one big figure and
     its cost where that is not 1x, and Switch - or "Playing" on the live one,
     which sits a little higher in the hand. Switch turns that card over: its
     BACK is the confirmation Stake asks for (what the mode is, what it costs,
     the most it pays and what the four picks on the board would top out at),
     with Cancel and Switch, while the rest of the hand steps back. On a phone
     the hand is a row that scrolls sideways, one card at a time.

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
    equalGuessCount,
    volatilityColorRgbVar,
    volatilityColorVar,
  } from '../../game/math/volatility';
  import { bet, guesses, selectedCeiling, volatilityLabel } from '../../game/bet/betState.svelte';

  let { onclose }: { onclose: () => void } = $props();

  // The panel opens on its HAND, always. `bet.pending` survives a close - it
  // is bet state, not panel state, and the panel is destroyed and remade on
  // every open - so a mode confirmed, or a confirmation abandoned by closing
  // the panel, came back as that same confirmation the next time. Cleared on
  // mount rather than on close so every way of leaving is covered.
  bet.pending = null;

  /** "Max win 1,354.2× your bet", split so the figure can be the card's one big number in any word order. */
  const maxWinParts = $derived(t('Max win %s your bet').split('%s'));

  /**
   * How high each card sits in the fan: the middle of the hand rides higher,
   * and the live family higher still, so the mode in play is the card raised
   * out of the hand. In units of the hand's own --hu.
   */
  const lift = (index: number, family: ModeFamily) =>
    -(2 - Math.abs(index - 2)) * 0.5 - (family === bet.family ? 2 : 0);

  let handEl = $state<HTMLElement>();

  // On a phone the hand scrolls sideways: open it on the live card, not on
  // whichever family happens to be first. A frame after mount, once the row
  // is laid out and can scroll (set at mount it was ignored, and the row
  // opened on the first card); scrollIntoView does the sideways sum, which
  // runs backwards in Arabic. Nothing else is scrolling yet, and the panel
  // does not scroll vertically on a phone, so only the row moves.
  $effect(() => {
    const hand = handEl;
    if (!hand) return;
    const frame = requestAnimationFrame(() => {
      const live = hand.querySelector<HTMLElement>('.mcard.live');
      if (live && hand.scrollWidth > hand.clientWidth) live.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  });

  // A card turned over takes focus to its safe answer, Cancel - so a keyboard
  // player lands on the confirmation, and a stray Enter does not switch.
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
    style={`--tint: ${volatilityColorVar(bet.family)}; --tint-rgb: ${volatilityColorRgbVar(bet.family)}; --tint-strong: ${volatilityColorVar(bet.family)}`}
  >
    <div class="popup-head mode-head">
      <!-- Always the panel's name: the question is asked on the card turned
           over, and asking it in both places read twice. -->
      <span>{t('Game mode')}</span>
      <button class="popup-close" onclick={onclose} aria-label={t('Close')}><MarkIcon name="cross" /></button>
    </div>

    <!-- Volatility order, not publication order. MODE_FAMILIES is
         ['base','sc','hs','tr'] because that is what the math publishes, so
         the cards would draw 3, 1, 5 bolts down the hand - a ruler beside
         values in no order. See FAMILIES_BY_VOLATILITY. -->
    <ul class="hand" bind:this={handEl}>
      {#each FAMILIES_BY_VOLATILITY as family, index (family)}
        {@const rules = FAMILY_RULES[family]}
        {@const turning = bet.pending === family}
        {@const picked = selectedCeiling(family)}
        <li
          class="mcard"
          class:live={bet.family === family}
          class:flip={turning}
          class:aside={bet.pending !== null && !turning}
          data-family={family}
          {...bet.family === family ? { 'aria-current': 'true' } : {}}
          style={`--fam: ${volatilityColorVar(family)}; --fam-rgb: ${volatilityColorRgbVar(family)}; --vol-color: var(--on-vol-ink); --i: ${index}; --fan: ${index - 2}; --lift: ${lift(index, family)}`}
        >
          <!-- The back is FIRST in the markup and the face second: the sides
               are stacked, so the order is invisible, and the inert side is
               out of the tab order and the accessibility tree either way. It
               keeps the switch handler ahead of every other Switch label,
               where modes.test.ts reads it. -->
          <!-- The BACK: the confirmation step approval asks for. It restates
               what the player is about to buy - the mode, its cost, the
               ceiling - from the same FAMILY_RULES and FAMILY_BLURB the front
               reads, so the two sides can never describe a mode differently. -->
          <div class="side back mode-confirm" inert={!turning}>
            <span class="mode-confirm-name">{t(rules.label)}</span>
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
              <!-- Turning the card back puts focus back on its Switch: the
                   button it was on goes inert with the back. -->
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
          <div class="side front" inert={turning}>
            <div class="band">
              <span class="nm">{t(rules.label)}</span>
              <!-- The FAMILY's own rating, without the guesses: the bet display
                   adds one stop per Equal pick on top, and this card is what
                   the mode contributes before that. Dark on the family's own
                   colour (--vol-color is set to the ink on the card). -->
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
                   others carry it in the note under the hand. -->
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
      <!-- Why these bolts and the MODE sign's can disagree. Each card is the
           family on its own; the sign adds one stop per Equal pick on the
           board (boltsFor). Said only when it is true. -->
      {#if !bet.pending && equalGuessCount(guesses.hl, guesses.io) > 0}
        <p class="mode-note">{t('Bolts show each mode before your Equal picks. Each Equal pick adds one.')}</p>
      {/if}
      <!-- Cost and RTP in one sentence, both interpolated - from FAMILY_RULES
           and game/config.ts - rather than written into the string. The mode
           it names is the one BEING CONFIRMED when a card is turned, and the
           live one otherwise. -->
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
