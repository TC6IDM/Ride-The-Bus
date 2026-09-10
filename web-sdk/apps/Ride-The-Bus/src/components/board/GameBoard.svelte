<!-- The board: four cards, the running-win bar, and the four guess squares.

     Split out of Game.svelte. Needs NO props - it reads betState for the
     guesses and roundState for what has been dealt, so the parent hands it
     nothing at all.

     The <main class="play-area"> wrapper stays with the parent, which is what
     lets .play-area go on living in base.css beside .game-layout.

     Styles: cards.css for the four slots, choices.css for the squares (shared
     with IntroPanels), and choices-board.css / choice-unavailable.css for the
     parts only the board draws - the row, the columns, the labels, the tip and
     the disabled state. responsive-board last. -->
<script lang="ts">
  import ChoiceIcon from '../icons/ChoiceIcon.svelte';
  import MarkIcon from '../icons/MarkIcon.svelte';
  import SuitIcon from '../icons/SuitIcon.svelte';
  import {
    guesses,
    insideIsPossible,
    setColorChoice,
    setHlChoice,
    setIoChoice,
    setSuitChoice,
  } from '../../game/bet/betState.svelte';
  import { isCleanSweep } from '../../game/math/modes';
  import { round } from '../../game/round/roundState.svelte';
  import { t } from '../../i18n/i18nDerived';
  import { numberToCurrencyString } from 'utils-shared/amount';

  import { choicesLocked } from '../../game/round/roundState.svelte';
  import { sound } from '../../game/audio/sound';

  /**
   * Pointer or keyboard focus is on the barred Inside button.
   *
   * Tracked in state rather than with CSS :hover because the explanation has to
   * be rendered outside .choice-square - that box is overflow:hidden, so
   * anything positioned inside it gets clipped to the rounded square.
   */
  let insideBlockedHover = $state(false);

  /**
   * The barred Inside half, made answerable by a FINGER.
   *
   * The tip was raised by onmouseenter / onfocus only. On touch that is either
   * nothing at all - a browser may synthesise no mouseenter - or worse, a
   * mouseenter with no matching mouseleave until something else is tapped, so
   * the tip appears and sticks. Meanwhile the tap itself did nothing: the
   * button is aria-disabled rather than disabled, so the click lands and
   * setIoChoice refuses it without a word.
   *
   * A tap now shows the tip on a timer and sounds the refusal. Hover keeps its
   * untimed behaviour, because mouseleave genuinely does fire for a mouse.
   */
  const INSIDE_TIP_MS = 4200;
  let insideTipTimer: ReturnType<typeof setTimeout> | null = null;
  function flashInsideTip() {
    insideBlockedHover = true;
    if (insideTipTimer) clearTimeout(insideTipTimer);
    insideTipTimer = setTimeout(() => { insideBlockedHover = false; }, INSIDE_TIP_MS);
  }

  function onInsideClick() {
    if (!insideIsPossible()) { sound.playBlocked(); flashInsideTip(); return; }
    pick(setIoChoice, 'inside');
  }

  /**
   * Every guess press goes through here, because the row is LOCKED by opacity
   * and pointer-events rather than by the `disabled` attribute - and
   * pointer-events does not stop the keyboard. Tab + Enter during a reveal
   * therefore changed what the NEXT round would buy, silently, while the board
   * was still showing the last one. The setters in betState have no view of
   * round state and should not acquire one, so the guard belongs at the call
   * site, which is here.
   */
  function pick<T>(set: (value: T) => void, value: T) {
    if (choicesLocked()) { sound.playBlocked(); return; }
    set(value);
  }
</script>

<!-- Inside: the card lands BETWEEN the two bounds, so the arrows converge. -->
{#snippet iconInside()}
  <ChoiceIcon name="inside" />
{/snippet}

{#snippet iconOutside()}
  <ChoiceIcon name="outside" />
{/snippet}
{#snippet iconTriangleUp()}
  <ChoiceIcon name="triangleUp" />
{/snippet}
{#snippet iconTriangleDown()}
  <ChoiceIcon name="triangleDown" />
{/snippet}

{#snippet iconEquals()}
  <ChoiceIcon name="equals" />
{/snippet}

{#snippet cardRow()}
  <div class="card-row">
    {#each round.revealedCards as card, index}
      <div class="card-slot">
        <div class="card-mult" class:show={round.stageMultipliers[index] !== null}>
          {(round.stageMultipliers[index] ?? 0).toFixed(2)}×
        </div>
        <div class="card-block">
          <div class="card-inner" class:flipped={card}>
            <div class="card-back" aria-hidden="true"></div>
            <div class="card-front">
              {#if card}
                <div class="card-face" class:red-card={card.suit === '♥' || card.suit === '♦'} class:black-card={card.suit === '♠' || card.suit === '♣'}>
                  <div class="index top">
                    <span class="index-rank">{card.rank}</span>
                    <SuitIcon suit={card.suit} scale={0.66} />
                  </div>
                  <div class="suit center"><SuitIcon suit={card.suit} /></div>
                  <div class="index bottom">
                    <span class="index-rank">{card.rank}</span>
                    <SuitIcon suit={card.suit} scale={0.66} />
                  </div>
                </div>
              {/if}
              {#if index === round.bustedIndex}
                <div class="bust-x" aria-hidden="true"><MarkIcon name="cross" /></div>
              {:else if index === round.forgivenIndex}
                <!-- A Second Chance round survived this one. Marked
                     differently from a bust on purpose: the same cross
                     would say the round ended, when it carried on. -->
                <div class="forgiven-mark" aria-label={t('Forgiven')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
                    <path d="M20 3v5h-5" />
                  </svg>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet runningWinBar()}
  <div
    class="running-win"
    class:is-win={round.state === 'won' && round.wonAmount > 0}
    class:is-loss={round.state === 'lost'}
  >
    <span class="running-win-label">
      {#if round.state === 'won'}{isCleanSweep(round.bustedIndex, round.forgivenIndex) ? t('Full Game Win!') : t('Banked')}{:else if round.state === 'lost'}{t('Busted')}{:else if round.state === 'playing'}{t('Revealing…')}{:else}{t('Winning')}{/if}
    </span>
    <span class="running-win-amount">{numberToCurrencyString(round.runningWin)}</span>
    <!-- Always rendered (a non-breaking space when there's no result yet) so
         the multiplier appearing at the end of a round doesn't grow the bar
         and shove the cards / choices around. -->
    <span class="running-win-mult">{(round.state === 'won' || round.state === 'lost') && round.initialBet > 0 ? `${(round.wonAmount / round.initialBet).toFixed(2)}×` : ' '}</span>
  </div>
{/snippet}

{@render cardRow()}
{#if round.hasPlayed}{@render runningWinBar()}{/if}

<div class="choice-row" class:locked={choicesLocked()} aria-busy={choicesLocked()}>
  <div class="choice-column">
    <span class="choice-label">{t('Color')}</span>
    <div class="choice-square color-square" role="group" aria-label={t('Pick a color')}>
      <button type="button" class="half-btn black-half" class:selected={guesses.color === 'black'} onclick={() => pick(setColorChoice, 'black')} aria-disabled={choicesLocked()} aria-label={t('Black')}></button>
      <button type="button" class="half-btn red-half" class:selected={guesses.color === 'red'} onclick={() => pick(setColorChoice, 'red')} aria-disabled={choicesLocked()} aria-label={t('Red')}></button>
    </div>
  </div>

  <div class="choice-column">
    <span class="choice-label">{t('Higher')}<br />{t('Lower')}</span>
    <div class="choice-square hl-square" role="group" aria-label={t('Higher, lower, or equal')}>
      <button type="button" class="third-btn higher-third" class:selected={guesses.hl === 'higher'} onclick={() => pick(setHlChoice, 'higher')} aria-disabled={choicesLocked()} aria-label={t('Higher')}>{@render iconTriangleUp()}</button>
      <button type="button" class="third-btn lower-third" class:selected={guesses.hl === 'lower'} onclick={() => pick(setHlChoice, 'lower')} aria-disabled={choicesLocked()} aria-label={t('Lower')}>{@render iconTriangleDown()}</button>
      <button type="button" class="equal-btn" class:selected={guesses.hl === 'equal'} onclick={() => pick(setHlChoice, 'equal')} aria-disabled={choicesLocked()} aria-label={t('Equal')}>{@render iconEquals()}</button>
    </div>
  </div>

  <div class="choice-column">
    <span class="choice-label">{t('Inside')}<br />{t('Outside')}</span>
    <div class="choice-square io-square" role="group" aria-label={t('Inside, outside, or equal')}>
      <button
        type="button"
        class="half-btn inside-half"
        class:selected={guesses.io === 'inside'}
        class:unavailable={!insideIsPossible()}
        onclick={onInsideClick}
        aria-disabled={choicesLocked() || !insideIsPossible()}
        aria-label={t('Inside')}
        onmouseenter={() => (insideBlockedHover = true)}
        onmouseleave={() => (insideBlockedHover = false)}
        onfocus={() => (insideBlockedHover = true)}
        onblur={() => (insideBlockedHover = false)}
      >{@render iconInside()}</button>
      <button type="button" class="half-btn outside-half" class:selected={guesses.io === 'outside'} onclick={() => pick(setIoChoice, 'outside')} aria-disabled={choicesLocked()} aria-label={t('Outside')}>{@render iconOutside()}</button>
      <button type="button" class="equal-btn" class:selected={guesses.io === 'equal'} onclick={() => pick(setIoChoice, 'equal')} aria-disabled={choicesLocked()} aria-label={t('Equal')}>{@render iconEquals()}</button>
    </div>
    <!-- Why Inside is off, in words. Rendered here rather than inside the
         square because .choice-square is overflow:hidden and would clip it
         to the rounded box. -->
    {#if !insideIsPossible() && insideBlockedHover}
      <div class="choice-tip" role="status">
        {t('You guessed Equal, so cards 1 and 2 share a rank. Nothing can fall between them, so Inside cannot win.')}
      </div>
    {/if}
  </div>

  <div class="choice-column">
    <span class="choice-label">{t('Suit')}</span>
    <div class="choice-square suit-square" role="group" aria-label={t('Pick a suit')}>
      <button type="button" class="quad-btn red-suit" class:selected={guesses.suit === 'heart'} onclick={() => pick(setSuitChoice, 'heart')} aria-disabled={choicesLocked()} aria-label={t('Heart')}><SuitIcon suit="heart" /></button>
      <button type="button" class="quad-btn" class:selected={guesses.suit === 'spade'} onclick={() => pick(setSuitChoice, 'spade')} aria-disabled={choicesLocked()} aria-label={t('Spade')}><SuitIcon suit="spade" /></button>
      <button type="button" class="quad-btn" class:selected={guesses.suit === 'club'} onclick={() => pick(setSuitChoice, 'club')} aria-disabled={choicesLocked()} aria-label={t('Club')}><SuitIcon suit="club" /></button>
      <button type="button" class="quad-btn red-suit" class:selected={guesses.suit === 'diamond'} onclick={() => pick(setSuitChoice, 'diamond')} aria-disabled={choicesLocked()} aria-label={t('Diamond')}><SuitIcon suit="diamond" /></button>
    </div>
  </div>
</div>

<style>
  @import '../../styles/board/cards.css';
  @import '../../styles/board/choices.css';
  @import '../../styles/board/choices-board.css';
  /* Board only: the start screen never disables a choice. */
  @import '../../styles/board/choice-unavailable.css';
  @import '../../styles/board/responsive-board.css';
</style>
