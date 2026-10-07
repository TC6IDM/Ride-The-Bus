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
  import CardFace from '../cards/CardFace.svelte';
  import TicketFace from '../cards/TicketFace.svelte';
  import TableDie from './TableDie.svelte';
  import {
    familyRules,
    guesses,
    insideIsPossible,
    setColorChoice,
    setHlChoice,
    setIoChoice,
    setSuitChoice,
    allChoicesMade,
  } from '../../game/bet/betState.svelte';
  import { FREE_CHOICE, isCleanSweep, stageCount } from '../../game/math/modes';
  import { round } from '../../game/round/roundState.svelte';
  import type { Card } from '../../game/platform/typesBookEvent';
  import { t, type MessageKey } from '../../i18n/i18nDerived';
  import { suitName } from '../../game/ui/suitPaths';
  import { numberToCurrencyString } from 'utils-shared/amount';
  import { formatMultiplier, formatTicket } from '../../game/ui/formatMultiplier';

  import { choicesLocked } from '../../game/round/roundState.svelte';
  import { DEAL_REST_MS, flipDurSec, paceMs, pacing } from '../../game/round/revealPacing.svelte';
  import { reducedMotion } from '../../game/celebration/celebrationGestures';
  import { sound } from '../../game/audio/sound';
  import { untrack } from 'svelte';

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
   * Is the family one with no guesses? Three of a Kind deals three cards and
   * asks nothing: card 1 is dealt, cards 2 and 3 must match it. Its board is
   * a different shape - three slots, and two full-size Equal squares under
   * cards 2 and 3 in place of the four guess columns - rather than the
   * four-guess row with parts greyed out, which read as a broken control.
   *
   * `guesses` is neither read nor cleared while this is up: the picks from
   * the last four-guess mode stay parked and come back with it.
   */
  const fixed = $derived(familyRules().fixedChoices !== null);
  /** How many card slots this family deals - four, or three on trips. */
  const slots = $derived(stageCount(familyRules()));
  /**
   * Is this slot a FREE card - dealt, not guessed? Three of a Kind's card 1.
   * Its chip is not drawn: the running total after it is 1.00x times the
   * cost, i.e. the stake itself, and a green "250.00x" over a card nobody
   * guessed reads as a 250x win for doing nothing. The cue book already
   * treats the card this way ("the flip and nothing else"); the chip now
   * matches. Cards 2 and 3 keep theirs - those ARE won.
   */
  const isFreeSlot = (index: number) => familyRules().fixedChoices?.[index] === FREE_CHOICE;

  /**
   * What the board is SHOWING, which is not always what the round holds.
   *
   * Everything on this row LEAVES over time - a chip fades out over 0.2s
   * (cards.css) and a card turns back over `--flip-dur`, half a second by
   * default - while `resetForNewRound()` empties the round the instant the
   * next one is bought. Anything drawn straight off the live state therefore
   * changes in the middle of its own exit animation:
   *
   *   - a busted 0.00x chip lost its dim class (then `.is-zero`, then
   *     `.is-short`, now `.is-miss`) and flicked back to win green on its way
   *     out, which is a loss recoloured as a win for the length of the fade
   *     (reported);
   *   - a winning chip's figure snapped to 0.00x behind the same fade;
   *   - the card face and the bust cross vanished on the frame the flip
   *     started, so what turned back over was a blank white front.
   *
   * So the exit is given what it was already drawing: the settled board stays
   * here until the next round deals over it. Only the LIVE round decides
   * whether a card is face up (`flipped`) or a chip is on screen (`.show`) -
   * those must happen on cue; it is what they show that must not change as
   * they go.
   *
   * Held in a plain object rather than `$state` + `$effect` on purpose: an
   * effect runs after the DOM is patched, so the frame where a new card lands
   * would draw the previous round's.
   */
  type ShownBoard = {
    cards: (Card | null)[];
    multipliers: (number | null)[];
    busted: number | null;
    forgiven: number | null;
    /** Last Stop's ticket, face up - held like a card, so it turns back over
     *  with its value still printed rather than a blank front. */
    ticket: number | null;
  };
  let heldBoard: ShownBoard = {
    cards: [null, null, null, null],
    multipliers: [null, null, null, null],
    busted: null,
    forgiven: null,
    ticket: null,
  };
  const shown = $derived.by(() => {
    // One condition for the whole row: a chip only ever exists under a card
    // that has turned, so "anything dealt" is the same question for both.
    if (round.revealedCards.some((c) => c !== null)) {
      heldBoard = {
        cards: round.revealedCards.slice(),
        multipliers: round.stageMultipliers.slice(),
        busted: round.bustedIndex,
        forgiven: round.forgivenIndex,
        ticket: round.ticketShown,
      };
    }
    return heldBoard;
  });

  /**
   * Whether a card's chip sits over a MISS - the bust, or the miss a Second
   * Chance forgave. Neutral ink, never win green: a green figure over a red
   * cross read as a win for the wrong guess, even when the share it kept beat
   * the round's cost (the critique, 2026-10-05). Whether the ROUND came out
   * ahead is the readout's to say (isNetWin); the chip only marks the guess.
   * Read off `shown`, never live state, for the reason above.
   */
  const chipIsMiss = (index: number) => index === shown.busted || index === shown.forgiven;

  /**
   * Whether a card's chip is on screen. Not on a free card (see isFreeSlot), and
   * not on a bust that kept NOTHING: a card-1 miss, or any Three of a Kind miss,
   * printed "0.0x" over the cross - zero said twice, once by the cross and once
   * by a figure design.md says should not be there. Live state, because whether
   * a chip shows must happen on cue.
   */
  const chipShows = (index: number) => {
    const multiplier = round.stageMultipliers[index];
    return multiplier !== null && multiplier !== 0 && !isFreeSlot(index);
  };

  /** Three of a Kind keeps nothing on a miss: its running total is at stake, not kept. */
  const keepsNothing = $derived(familyRules().retention.every((share) => share === 0));

  /*
   * THE CARDS, SAID. The face is a drawing (CardFace is aria-hidden), so a
   * screen reader heard the four slots as nothing at all. Each dealt card is
   * named and judged - "Card 2: King of Clubs, Right" - off `shown`, so the
   * label leaves with the card like everything else on the row.
   */
  const RANK_KEY: Record<string, MessageKey> = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack' };
  const SUIT_KEY: Record<string, MessageKey> = { heart: 'Hearts', diamond: 'Diamonds', club: 'Clubs', spade: 'Spades' };
  const cardName = (card: Card) => {
    const rank = RANK_KEY[card.rank];
    const suit = SUIT_KEY[suitName(card.suit)];
    return t('%r of %s')
      .replace('%r', rank ? t(rank) : card.rank)
      .replace('%s', suit ? t(suit) : card.suit);
  };
  /** "Card 2: King of Clubs" - empty for a slot with nothing on it. */
  const cardTitle = (index: number | null) => {
    const face = index === null ? null : shown.cards[index];
    return face && index !== null ? t('Card %n: %c').replace('%n', String(index + 1)).replace('%c', cardName(face)) : '';
  };
  /** ...and how its guess went. A free card had no guess to judge. */
  const cardLabel = (index: number) => {
    const verdict =
      index === shown.busted ? t('Busted') : index === shown.forgiven ? t('Forgiven') : isFreeSlot(index) ? null : t('Right');
    return verdict ? `${cardTitle(index)}, ${verdict}` : cardTitle(index);
  };

  /**
   * The running-win bar, a beat behind the round.
   *
   * roundReveal commits a card's face, its stage multiplier and the new total
   * in one tick, and the card then takes `--flip-dur` to turn. Drawn straight
   * off the round, the bar printed the new total - and "Busted" or "Full Game
   * Win!", and the loss red - while the card still showed its back. So a
   * change that arrives with a newly dealt card waits until that card has
   * landed: 0.9 of the flip, the delay the chip, the bust cross and the
   * missed guess's ring already take. Everything else - a reset, the hold's
   * "Last card", a settle that comes after the card is down - shows at once.
   *
   * Presentation only. The round's own figures move on cue; settleRound, the
   * credit and the takeover never read this. Reduced motion has no flip, so
   * nothing waits.
   *
   * Last Stop's ticket is a landing too: it turns on the same --flip-dur, and
   * the total it brings - two to ten times the run - would otherwise print
   * while the ticket still showed its back, telling the player which ticket
   * before the ticket did (found in review, 2026-10-01).
   */
  type Readout = {
    state: typeof round.state;
    runningWin: number;
    held: boolean;
    hasPlayed: boolean;
    lastWinNet: boolean;
    wonAmount: number;
    initialBet: number;
  };
  const live = $derived<Readout>({
    state: round.state,
    runningWin: round.runningWin,
    held: round.holdIndex !== null,
    hasPlayed: round.hasPlayed,
    lastWinNet: round.lastWinNet,
    wonAmount: round.wonAmount,
    initialBet: round.initialBet,
  });
  let readout = $state<Readout>(untrack(() => live));
  let dealtBefore = 0;
  let ticketBefore: number | null = null;
  let landsAt = 0;
  $effect(() => {
    const next = live;
    const dealt = round.revealedCards.filter((c) => c !== null).length;
    const ticket = round.ticketShown;
    if (dealt > dealtBefore || (ticket !== null && ticketBefore === null)) {
      landsAt = reducedMotion() ? 0 : performance.now() + Number(flipDurSec()) * 900;
    } else if (dealt < dealtBefore) {
      landsAt = 0;
    }
    dealtBefore = dealt;
    ticketBefore = ticket;
    const wait = landsAt - performance.now();
    if (wait <= 0) {
      readout = next;
      return;
    }
    const timer = setTimeout(() => (readout = next), wait);
    return () => clearTimeout(timer);
  });

  /** The settled round's name for itself - the bar's label and the
   *  announcement below both read it, so the clean-sweep question is asked
   *  once here (modes.test.ts counts the sites that ask it).
   *
   *  Four words, one per way a round ends (the critique, 2026-10-05: "Banked"
   *  covered both a 19.1x Second Chance ride and $1.10 kept off a bust):
   *    Full game win - every guess right
   *    Won           - reached the end with a miss forgiven
   *    Kept          - busted after card 1 and kept a share. The SHARE is not
   *                    printed: it is the rule's 30% times the decay term,
   *                    floored to 0.1x, so "30%" over $3.90 -> $1.10 invites a
   *                    sum that does not come out - and it would be a second
   *                    unit beside the multiplier. The rule is stated where
   *                    the family is named.
   *    Busted        - kept nothing */
  const cleanSweep = $derived(isCleanSweep(round.bustedIndex, round.forgivenIndex));
  const resultLabel = $derived(
    readout.state === 'won'
      ? cleanSweep
        ? t('Full game win')
        : shown.busted === null
          ? t('Won')
          : t('Kept')
      : readout.state === 'lost'
        ? t('Busted')
        : null,
  );
  /** Whether the round paid anything. A bust that kept nothing has no
   *  multiplier worth printing: "Busted $0.00 0.0x" said zero twice. */
  const paid = $derived(readout.wonAmount > 0 && readout.initialBet > 0);

  /**
   * The result, said out loud. The bar prints it and a sighted player reads it
   * as the card lands; a screen reader was told nothing - no focus moves, and
   * the takeover's own label is only read if it is navigated to (WCAG 4.1.3,
   * Status Messages). One polite line per settled round, from the same latched
   * `readout` as the bar, so it too waits for the card to turn. Emptied while a
   * round plays, so two identical results in a row still announce twice.
   */
  const announcement = $derived(
    resultLabel === null
      ? ''
      : [
          resultLabel,
          // The card that ended it, by name - "Busted" alone never said which.
          cardTitle(shown.busted),
          readout.state === 'lost' ? '' : numberToCurrencyString(readout.runningWin),
          readout.state === 'lost' ? '' : formatMultiplier(readout.wonAmount / readout.initialBet),
        ]
          .filter((part) => part !== '')
          .join(', '),
  );

  /**
   * Before the first deal the readout's space is kept but has nothing in it -
   * on a phone, a band of empty table between the cards and the guesses. Until
   * the four are picked, it says the one thing there is to do. Once they are,
   * or once a round has been dealt, it goes: it is a first-deal prompt, not a
   * nag. Three of a Kind has nothing to pick, so it never shows there.
   */
  const showHint = $derived(
    !readout.hasPlayed &&
      !allChoicesMade() &&
      // The Inside tip opens in this same slot (choices-board.css); one
      // voice at a time.
      !(insideBlockedHover && !insideIsPossible()),
  );

  /** A card the round will never reach, once it has busted before it. */
  const isDead = (index: number) => round.bustedIndex !== null && index > round.bustedIndex;

  /**
   * Last Stop's ticket slot - present for every round on the family, face
   * down until a clean sweep turns it, so nothing arrives mid-round and the
   * board never moves (it is laid over the row, not in it).
   */
  const hasTicket = $derived(familyRules().ticket !== null);

  /**
   * THE ROUTE. Four stops under the four cards (three on Three of a Kind),
   * and on Last Stop the ticket under the last stop: the bus the game is named
   * for, drawn as the line the round travels. A stop lights as its card lands
   * right, a busted stop takes the loss colour, a forgiven one the amber, and
   * on Last Stop the ticket hangs under the last stop, where the bus waits
   * when it turns. Drawn only - the words for the
   * result are the readout's, and saying them twice would be two voices for
   * one fact. Laid over the gap under the cards, so it moves nothing.
   */
  const stopState = (index: number): 'right' | 'bust' | 'forgiven' | null => {
    if (round.revealedCards[index] === null) return null;
    if (index === round.bustedIndex) return 'bust';
    if (index === round.forgivenIndex) return 'forgiven';
    return 'right';
  };
  /** Where the bus is: the furthest stop reached, or at the ticket once it is up. */
  const busAt = $derived.by(() => {
    if (round.ticketShown !== null) return slots;
    let at = -1;
    for (let i = 0; i < slots; i += 1) if (round.revealedCards[i] !== null) at = i;
    return at;
  });

  /**
   * THE DEAL. The cards used to be there already and simply turn; now each
   * one comes off the deck on the table at the top of a round - the moment
   * sound.playDeal() has always filled with four riffles - gathering the last
   * round's cards back to the deck on the way. A transform on .card-block
   * only, through the Web Animations API, so the SLOT never moves (the board
   * is measured by its slots) and a replayed round restarts it cleanly. Scaled
   * by the flip's own duration, so turbo shrinks it with everything else and a
   * slam or turbo at the top of its range skips it; reduced motion has none.
   * Last Stop's ticket goes back to its stack the same way.
   *
   * Two legs with a REST between them (DEAL_REST_MS, the owner's call on
   * 2026-10-01): each card is swept onto the deck, sits there a beat, and is
   * dealt back out. The legs keep the split the single curve used to make -
   * that curve passed the deck about 17% of the way through - and each eases
   * out, because both now end at rest. The reveal holds card 1's turn back by
   * the same beat.
   *
   * ON THE PILE, NOT OVER IT (2026-10-01). A fixed scale(0.62) fitted the deck
   * at one size and hovered over it at others, and a full-brightness card on a
   * deck sunk to 60% reads as floating however well it fits. So each piece is
   * fitted to the prop it goes to - its centre, its angle, its foreshortened
   * width and height, measured off the prop - and fades into it as it lands,
   * staying out of sight for the rest and fading back as it leaves: the deck
   * is what the player sees take the cards back.
   *
   * MEASURED AT REST. getBoundingClientRect includes whatever transform is
   * running - a deal still in flight, the held card's lift easing back, the
   * bust knock - and a deal measured from a displaced card sent it to the
   * wrong place: under fast slams the cards ended up strewn over the board.
   * So the last deal is cancelled first, and what is left of any transform is
   * taken back out of the centre (restCentre). The ticket slot's own `rotate`
   * is applied BEFORE `transform`, so its offset is turned into the slot's
   * frame (it used to be aimed in screen space and land 6deg off its stack).
   *
   * A SLAM FINISHES IT. The skip button already makes every flip instant; the
   * deal is a Web Animation the flip duration does not reach once it has
   * started, so a slam finishes it outright (the $effect below) and every
   * piece is where it belongs at once.
   */
  let ticketEl = $state<HTMLElement | undefined>();
  let dealtFresh = false;
  let dealAnimations: Animation[] = [];
  $effect(() => {
    const fresh = round.state === 'playing' && round.revealedCards.every((c) => c === null);
    if (fresh && !dealtFresh) untrack(dealFromDeck);
    dealtFresh = fresh;
  });
  $effect(() => {
    if (pacing.slamRequested) untrack(() => settleDeal('finish'));
  });

  /** End the deal in flight: `finish` to put everything where it belongs, `cancel` to clear it before a new one. */
  function settleDeal(how: 'finish' | 'cancel') {
    for (const animation of dealAnimations) animation[how]();
    dealAnimations = [];
  }

  /** An element's `transform` as it stands this frame - animations and transitions included. */
  function matrixOf(element: Element) {
    const transform = getComputedStyle(element).transform;
    return new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
  }

  /** An element's own `rotate`, in radians - the ticket slot's tilt; 0 for a card. */
  function ownTurn(element: Element) {
    const turn = getComputedStyle(element).rotate;
    return turn && turn !== 'none' ? (parseFloat(turn) * Math.PI) / 180 : 0;
  }

  /** Where an element's centre sits when nothing is moving it - see MEASURED AT REST. */
  function restCentre(element: Element) {
    const box = element.getBoundingClientRect();
    const moved = matrixOf(element);
    const turn = ownTurn(element);
    return {
      x: box.left + box.width / 2 - (moved.e * Math.cos(turn) - moved.f * Math.sin(turn)),
      y: box.top + box.height / 2 - (moved.e * Math.sin(turn) + moved.f * Math.cos(turn)),
    };
  }

  /**
   * The face a piece lands on: its centre on screen, its angle (the prop's own
   * rotation) and its size as drawn - the ticket stack's face is squashed by
   * --flat in its own transform, so its height is read through that.
   */
  function pileFace(face: Element, prop: Element) {
    const box = face.getBoundingClientRect();
    const own = matrixOf(face);
    const turned = matrixOf(prop);
    const sized = face as HTMLElement;
    return {
      x: box.left + box.width / 2,
      y: box.top + box.height / 2,
      turn: Math.atan2(turned.b, turned.a),
      width: sized.offsetWidth * Math.hypot(own.a, own.b),
      height: sized.offsetHeight * Math.hypot(own.c, own.d),
    };
  }

  function dealFromDeck() {
    settleDeal('cancel');
    const seconds = Number(flipDurSec());
    if (!(seconds > 0) || reducedMotion()) return;
    const travel = seconds * 1300;
    const gather = travel * 0.17;
    const rest = paceMs(DEAL_REST_MS, 0);
    const duration = travel + rest;
    const landed = gather / duration;
    const leaves = (gather + rest) / duration;
    const ease = 'cubic-bezier(0.3, 0.7, 0.3, 1)';
    /** Onto the pile's face, a beat there out of sight, and back out to where it stands. */
    const viaPile = (element: HTMLElement, pile: ReturnType<typeof pileFace>, delay: number) => {
      const at = restCentre(element);
      const turn = ownTurn(element);
      // The offset in the element's own frame, which its `rotate` turns.
      const dx = pile.x - at.x;
      const dy = pile.y - at.y;
      const x = dx * Math.cos(-turn) - dy * Math.sin(-turn);
      const y = dx * Math.sin(-turn) + dy * Math.cos(-turn);
      const atPile =
        `translate(${x}px, ${y}px) rotate(${pile.turn - turn}rad) ` +
        `scale(${pile.width / element.offsetWidth}, ${pile.height / element.offsetHeight})`;
      dealAnimations.push(
        element.animate(
          [
            { transform: 'none', easing: ease },
            { transform: atPile, offset: landed },
            { transform: atPile, offset: leaves, easing: ease },
            { transform: 'none' },
          ],
          { duration, delay },
        ),
        element.animate(
          [
            { opacity: 1 },
            { opacity: 1, offset: landed * 0.45 },
            { opacity: 0, offset: landed },
            { opacity: 0, offset: leaves },
            { opacity: 1, offset: leaves + (1 - leaves) * 0.3 },
            { opacity: 1 },
          ],
          { duration, delay },
        ),
      );
    };
    const deck = document.querySelector('.p-deck');
    const deckFace = deck?.querySelector('.deck-face');
    if (deck && deckFace) {
      const pile = pileFace(deckFace, deck);
      slotEls.slice(0, slots).forEach((slot, index) => {
        const block = slot?.querySelector<HTMLElement>('.card-block');
        if (block) viaPile(block, pile, index * seconds * 90);
      });
    }
    const stack = document.querySelector('.p-tickets');
    const stackFace = stack?.querySelector('.tickets-face');
    if (stack && stackFace && ticketEl) viaPile(ticketEl, pileFace(stackFace, stack), slots * seconds * 90);
  }

  /**
   * Tunnel vision on the held last card: where the card is, so the dark can
   * close in on it. Measured once as the hold begins, with the card still at
   * rest, and kept after it so the tunnel opens from the same place it closed.
   */
  const slotEls: HTMLElement[] = $state([]);
  let tunnelAt = $state<{ x: number; y: number } | null>(null);
  $effect(() => {
    const index = round.holdIndex;
    if (index === null) return;
    const block = slotEls[index]?.querySelector('.card-block');
    if (!block) return;
    const box = block.getBoundingClientRect();
    tunnelAt = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  });

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
  <!-- As many slots as the family deals. roundState keeps four always; a
       three-card family simply never fills the fourth, and drawing it would
       show a card that never turns. -->
  <div class="card-row" class:has-ticket={hasTicket}>
    {#each round.revealedCards.slice(0, slots) as card, index}
      <!-- `card` is the LIVE round - it decides whether this slot is face up.
           `face` is what the slot draws, which outlives the round by one
           animation so the card turns back over with its face still on it.
           See the note on the latch. -->
      {@const face = shown.cards[index]}
      <!-- is-held: the last card, rising while it waits because a lot rides on
           it, for --hold-climb (the same climb its hum takes). is-lit: that
           card, lifted over the tunnel until the next deal, so the dark never
           touches it - not while closing in, not while opening again.
           is-dead: a card the round busted before reaching. is-bust: the card
           that ended it, which knocks once as its cross lands. -->
      <div
        class="card-slot"
        bind:this={slotEls[index]}
        class:is-held={round.holdIndex === index}
        class:is-lit={round.lastCardHeld && index === slots - 1}
        style:--hold-climb={round.holdIndex === index ? `${round.holdClimbMs}ms` : undefined}
        class:is-dead={isDead(index)}
        class:is-bust={round.bustedIndex === index}
      >
        <!-- is-miss: the chip over a bust or a forgiven miss, in neutral ink.
             See chipIsMiss and chipShows. Hidden from a screen reader until it
             shows: four "0.0x" were read out before the first deal. -->
        <div
          class="card-mult"
          class:show={chipShows(index)}
          class:is-miss={chipIsMiss(index)}
          aria-hidden={!chipShows(index)}
        >
          {formatMultiplier(shown.multipliers[index] ?? 0)}
        </div>
        <div class="card-block" role={card ? 'img' : undefined} aria-label={card ? cardLabel(index) : undefined} aria-hidden={card ? undefined : true}>
          <div class="card-inner" class:flipped={card}>
            <div class="card-back" aria-hidden="true"></div>
            <div class="card-front">
              {#if face}
                <!-- Pips, courts and aces as a casino deck prints them; the
                     paper, edge and shadow are .card-front's. -->
                <CardFace rank={face.rank} suit={face.suit} />
              {/if}
              {#if index === shown.busted}
                <div class="bust-x" aria-hidden="true"><MarkIcon name="cross" /></div>
              {:else if index === shown.forgiven}
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

    {#if hasTicket}
      <!-- Last Stop's ticket, hung under the last stop (card 4) and laid over
           the row rather than in it, so the four cards stand exactly where they
           stand on every other family and the row's width never changes.
           Face down all round, turned only by a clean sweep - a bust never
           shows what it would have won. -->
      <div
        class="ticket-slot"
        class:is-dead={round.bustedIndex !== null}
        bind:this={ticketEl}
        role="img"
        aria-label={round.ticketShown !== null ? `${t('Ticket')} ${formatTicket(round.ticketShown)}` : t('Last Stop')}
      >
        <div class="ticket-inner" class:flipped={round.ticketShown !== null}>
          <div class="ticket-back"><TicketFace value={null} /></div>
          <div class="ticket-front">
            {#if shown.ticket !== null}<TicketFace value={shown.ticket} />{/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- The route: see stopState. One stop per card slot; on Last Stop the
         ticket hangs under the last one. -->
    <div class="route-line" aria-hidden="true" style:--stops={slots}>
      {#each Array(slots) as _, index (index)}
        <span class="route-stop is-{stopState(index) ?? 'ahead'}" style:--i={index}></span>
      {/each}
      <!-- The bus: a filled mark, because it is read (where the round has
           got to) rather than pressed - design.md's lines-and-fills rule. -->
      <span
        class="route-bus"
        class:is-moving={busAt >= 0}
        style:--bus-x={busAt >= slots ? 'var(--bus-end)' : `calc(${Math.max(busAt, 0)} * var(--stop-pitch))`}
      >
        <svg viewBox="0 0 24 14" aria-hidden="true" focusable="false">
          <rect x="1" y="1" width="22" height="9.5" rx="2.4" />
          <rect class="bus-glass" x="3.4" y="3" width="4.2" height="3.2" rx="0.6" />
          <rect class="bus-glass" x="9" y="3" width="4.2" height="3.2" rx="0.6" />
          <rect class="bus-glass" x="14.6" y="3" width="6" height="3.2" rx="0.6" />
          <circle cx="6.5" cy="11" r="2.2" />
          <circle cx="17.5" cy="11" r="2.2" />
        </svg>
      </span>
    </div>
  </div>
{/snippet}

{#snippet runningWinBar()}
  <!-- Every figure and state here is `readout`, the round a card-flip behind
       - see the note on it in the script. -->
  <div
    class="running-win"
    class:is-idle={!readout.hasPlayed}
    aria-hidden={!readout.hasPlayed}
    class:is-win={readout.state === 'won' && readout.lastWinNet}
    class:is-partial={readout.state === 'won' && !readout.lastWinNet}
    class:is-loss={readout.state === 'lost'}
    class:is-at-stake={readout.state === 'playing' && keepsNothing}
  >
    <!-- "At stake" on a family that keeps nothing on a miss: Three of a Kind's
         $916.60 after card 2 read as money won, in win green, when a miss on
         card 3 forfeits all of it. -->
    <span class="running-win-label">
      {#if resultLabel !== null}{resultLabel}{:else if readout.state === 'playing'}{readout.held ? t('Last card') : keepsNothing ? t('At stake') : t('Revealing…')}{:else}{t('Winning')}{/if}
    </span>
    <!-- Laid over the three lines rather than in them, so it arriving or
         going moves nothing (cards.css). Mounted only while it shows: hidden
         text left in the readout would be read back by anything that reads
         the readout's text. -->
    {#if showHint}<span class="running-win-hint">{t('Pick all 4 guesses')}</span>{/if}
    <!-- No ceiling figure here before the first deal: "Pays up to X your bet"
         sat in this slot from 2026-09-27 and came out on the owner's call
         (2026-10-01). The picks' ceiling is stated in How to Play. -->
    <span class="running-win-amount">{numberToCurrencyString(readout.runningWin)}</span>
    <!-- Always rendered (a non-breaking space when there is nothing to say) so
         the multiplier appearing at the end of a round never grows the bar and
         shoves the cards / choices around. WRITTEN AS '\u00a0', NOT AS THE
         CHARACTER: it was once retyped as a plain space, which collapses, so
         the line had no height until something filled it - and the whole board
         jumped each time it did. cards.css gives the line a minimum height as
         well, so neither can happen alone (boardStill.test.ts). -->
    <span class="running-win-mult">{paid ? formatMultiplier(readout.wonAmount / readout.initialBet) : '\u00a0'}</span>
  </div>
{/snippet}

{@render cardRow()}
<!-- Always in the layout, and only SHOWN once the player has dealt. It used to
     mount on the first deal, which pushed the cards up and the guess squares
     down by its height just as the first card turned - and the table props had
     been placed against the pre-deal board, so on a phone the deck, a cup and
     a chip stack then sat on the cards and the squares for the rest of the
     session. One layout, before and after, is what table.css places against. -->
{@render runningWinBar()}
<!-- Visually hidden; see `announcement`. -->
<p class="round-announcer" role="status">{announcement}</p>

{#if fixed}
  <!-- Three of a Kind: no guesses to make. Two Equal squares under the gaps
       between the three cards - what the mode plays, stated by the controls
       themselves rather than by a caption over disabled ones, each labelled
       the way the four-guess columns are. The squares are read-only - the
       round is one bet mode, so there is nothing a press could change. -->
  <div class="choice-row trips-row" class:locked={choicesLocked()} aria-busy={choicesLocked()}>
    <div class="choice-column" class:is-missed={round.bustedIndex === 1} class:is-forgiven={round.forgivenIndex === 1}>
      <span class="choice-label"><span>{t('Equal')}</span></span>
      <div class="equal-slot" role="img" aria-label={t('Card 2 must match card 1')}>
        <span class="equal-btn equal-full selected">{@render iconEquals()}</span>
      </div>
    </div>
    <div class="choice-column" class:is-missed={round.bustedIndex === 2} class:is-forgiven={round.forgivenIndex === 2}>
      <span class="choice-label"><span>{t('Equal')}</span></span>
      <div class="equal-slot" role="img" aria-label={t('Card 3 must match card 1')}>
        <span class="equal-btn equal-full selected">{@render iconEquals()}</span>
      </div>
    </div>
  </div>
{:else}
<div class="choice-row" class:locked={choicesLocked()} aria-busy={choicesLocked()}>
  <div class="choice-column" class:is-missed={round.bustedIndex === 0} class:is-forgiven={round.forgivenIndex === 0}>
    <!-- The label's text sits in an inner span so the outer box can centre it:
         the two-word labels beside this one run to two lines, and a one-line
         label left at the top of the same box reads as sitting a line too
         high. See .choice-label in choices-board.css. -->
    <span class="choice-label"><span>{t('Color')}</span></span>
    <div class="choice-square color-square" role="group" aria-label={t('Pick a color')}>
      <button type="button" class="half-btn black-half" class:selected={guesses.color === 'black'} aria-pressed={guesses.color === 'black'} onclick={() => pick(setColorChoice, 'black')} aria-disabled={choicesLocked()} aria-label={t('Black')}></button>
      <button type="button" class="half-btn red-half" class:selected={guesses.color === 'red'} aria-pressed={guesses.color === 'red'} onclick={() => pick(setColorChoice, 'red')} aria-disabled={choicesLocked()} aria-label={t('Red')}></button>
    </div>
  </div>

  <div class="choice-column" class:is-missed={round.bustedIndex === 1} class:is-forgiven={round.forgivenIndex === 1}>
    <!-- "Higher / Lower", as the intro and How to Play name it. The no-break
         space holds the slash to the first word, so where the pair wraps it
         reads "Higher /" over "Lower", never "Higher" over "/ Lower". -->
    <span class="choice-label"><span>{t('Higher')}&nbsp;/ {t('Lower')}</span></span>
    <div class="choice-square hl-square" role="group" aria-label={t('Higher, lower, or equal')}>
      <button type="button" class="third-btn higher-third" class:selected={guesses.hl === 'higher'} aria-pressed={guesses.hl === 'higher'} onclick={() => pick(setHlChoice, 'higher')} aria-disabled={choicesLocked()} aria-label={t('Higher')}>{@render iconTriangleUp()}</button>
      <button type="button" class="third-btn lower-third" class:selected={guesses.hl === 'lower'} aria-pressed={guesses.hl === 'lower'} onclick={() => pick(setHlChoice, 'lower')} aria-disabled={choicesLocked()} aria-label={t('Lower')}>{@render iconTriangleDown()}</button>
      <button type="button" class="equal-btn" class:selected={guesses.hl === 'equal'} aria-pressed={guesses.hl === 'equal'} onclick={() => pick(setHlChoice, 'equal')} aria-disabled={choicesLocked()} aria-label={t('Equal')}>{@render iconEquals()}</button>
    </div>
  </div>

  <div class="choice-column" class:is-missed={round.bustedIndex === 2} class:is-forgiven={round.forgivenIndex === 2}>
    <span class="choice-label"><span>{t('Inside')}&nbsp;/ {t('Outside')}</span></span>
    <div class="choice-square io-square" role="group" aria-label={t('Inside, outside, or equal')}>
      <button
        type="button"
        class="half-btn inside-half"
        class:selected={guesses.io === 'inside'} aria-pressed={guesses.io === 'inside'}
        class:unavailable={!insideIsPossible()}
        onclick={onInsideClick}
        aria-disabled={choicesLocked() || !insideIsPossible()}
        aria-label={t('Inside')}
        onmouseenter={() => (insideBlockedHover = true)}
        onmouseleave={() => (insideBlockedHover = false)}
        onfocus={() => (insideBlockedHover = true)}
        onblur={() => (insideBlockedHover = false)}
      >{@render iconInside()}</button>
      <button type="button" class="half-btn outside-half" class:selected={guesses.io === 'outside'} aria-pressed={guesses.io === 'outside'} onclick={() => pick(setIoChoice, 'outside')} aria-disabled={choicesLocked()} aria-label={t('Outside')}>{@render iconOutside()}</button>
      <button type="button" class="equal-btn" class:selected={guesses.io === 'equal'} aria-pressed={guesses.io === 'equal'} onclick={() => pick(setIoChoice, 'equal')} aria-disabled={choicesLocked()} aria-label={t('Equal')}>{@render iconEquals()}</button>
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

  <div class="choice-column" class:is-missed={round.bustedIndex === 3} class:is-forgiven={round.forgivenIndex === 3}>
    <span class="choice-label"><span>{t('Suit')}</span></span>
    <div class="choice-square suit-square" role="group" aria-label={t('Pick a suit')}>
      <button type="button" class="quad-btn red-suit" class:selected={guesses.suit === 'heart'} aria-pressed={guesses.suit === 'heart'} onclick={() => pick(setSuitChoice, 'heart')} aria-disabled={choicesLocked()} aria-label={t('Heart')}><SuitIcon suit="heart" /></button>
      <button type="button" class="quad-btn" class:selected={guesses.suit === 'spade'} aria-pressed={guesses.suit === 'spade'} onclick={() => pick(setSuitChoice, 'spade')} aria-disabled={choicesLocked()} aria-label={t('Spade')}><SuitIcon suit="spade" /></button>
      <button type="button" class="quad-btn" class:selected={guesses.suit === 'club'} aria-pressed={guesses.suit === 'club'} onclick={() => pick(setSuitChoice, 'club')} aria-disabled={choicesLocked()} aria-label={t('Club')}><SuitIcon suit="club" /></button>
      <button type="button" class="quad-btn red-suit" class:selected={guesses.suit === 'diamond'} aria-pressed={guesses.suit === 'diamond'} onclick={() => pick(setSuitChoice, 'diamond')} aria-disabled={choicesLocked()} aria-label={t('Diamond')}><SuitIcon suit="diamond" /></button>
    </div>
  </div>
  <!-- The table die: all four picks at random, dealt only when the player
       deals. In the row, so the row's lock and dimming are its own. -->
  <TableDie />
</div>
{/if}

<!-- Tunnel vision: while the last card is held - and only when it could land a
     Huge win or bigger (round.holdTunnel, lastCardTunnels in winTiers.ts) - the
     room darkens and closes in on it, on the same clock as its rise and its hum
     (--hold-climb), and opens again on the strike. Last in the board so it lies
     over everything here but the held card, which .card-slot.is-lit lifts above
     it. Inside the play area, so the control bar, the title and the RG panel
     stay lit. -->
<div
  class="tunnel"
  class:is-closing={round.holdIndex !== null && round.holdTunnel}
  style:--tv-x={tunnelAt ? `${tunnelAt.x}px` : undefined}
  style:--tv-y={tunnelAt ? `${tunnelAt.y}px` : undefined}
  style:--hold-climb={`${round.holdClimbMs}ms`}
  aria-hidden="true"
></div>

<style>
  @import '../../styles/board/cards.css';
  @import '../../styles/board/choices.css';
  @import '../../styles/board/choices-board.css';
  /* Board only: the start screen never disables a choice. */
  @import '../../styles/board/choice-unavailable.css';
  @import '../../styles/board/responsive-board.css';
</style>
