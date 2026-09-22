<script lang="ts">
	/**
	 * The How to Play panel - rules, payouts, the UI guide, RTP and the legal
	 * disclaimer.
	 *
	 * Easily the largest single block of markup in the game and, at 86 lines,
	 * almost all of it static prose. It reads nothing from the round: the only
	 * things it needs are the translator, the published RTP, the rank order and
	 * a way to close itself. That made it the one popup worth pulling out on its
	 * own - the other four are small but wired into live bet and autoplay state,
	 * so they would cost a wide bindable surface for a fraction of the lines.
	 *
	 * Approval-relevant: this panel is what the `i` button opens, and Stake
	 * requires the RTP, the max win and the disclaimer to be reachable from the
	 * UI at any point during play. The RTP is interpolated from game/platform/config.ts
	 * rather than written out, so the figure shown cannot drift from the one the
	 * math is built and reweighted to.
	 */
	// `ranks` is imported rather than the order being retyped here, so the strip
	// below can never drift from the order the game and the math-sdk actually use.
	import { ranks } from '../../game/round/roundContract';
	// Derived from payout.ts rather than written out, so the paytable a player
	// reads cannot drift from what the RGS credits - see payoutTable.ts.
	import { bustRowsFor, oddsExampleFor, payoutColumnFor, payoutRowsFor } from '../../game/math/payoutTable';
	import { winTiersFor } from '../../game/math/winTiers';
	import { FAMILY_BLURB, FAMILY_RULES, MODE_FAMILIES, allPlayableModes, type ModeFamily } from '../../game/math/modes';
	import { FAMILIES_BY_VOLATILITY } from '../../game/math/volatility';
	import gameConfig from '../../game/platform/config';
	import { t } from '../../i18n/i18nDerived';
	import MarkIcon from '../icons/MarkIcon.svelte';

	/** The biggest figure any mode can pay, and WHICH mode, for the RTP
	 *  statement below. The mode is derived rather than written into the
	 *  sentence: it was "on High Stakes" for as long as High Stakes held the
	 *  ceiling, and stopped being true the day Three of a Kind arrived. */
	const maxWinFamily = MODE_FAMILIES.reduce((best, f) =>
		FAMILY_RULES[f].maxWin > FAMILY_RULES[best].maxWin ? f : best,
	);
	const maxWinOverall = FAMILY_RULES[maxWinFamily].maxWin;
	// Counted, not typed - see the same line on the intro (IntroPanels.svelte).
	const waysToPlay = allPlayableModes().length;

	/** "1.99×" for a fixed row, "1.04× – 9.19×" for one that swings. */
	const payRange = (min: number, max: number) =>
		min === max ? `${min.toFixed(2)}×` : `${min.toFixed(2)}× – ${max.toFixed(2)}×`;

	// The live bet mode. The paytable below is ITS table: retention is what every
	// stage's multiplier is solved against, so High Stakes genuinely pays
	// different figures, and showing Classic's to a player on another mode would
	// be the same mistake as pricing a stage one way and paying it another.
	type Props = {
		onclose: () => void;
		family?: ModeFamily;
		/**
		 * The most the four guesses currently on the board would pay on a given
		 * family, or null when they are not all picked yet.
		 *
		 * Passed in as a FUNCTION OF THE FAMILY rather than as a number, because
		 * the tabs below let a player read another mode's rules without leaving
		 * this panel - and the answer genuinely moves with the tab. High Stakes
		 * keeps less on a miss, so the same four guesses reach a different ceiling
		 * there than on Classic.
		 */
		ceilingFor?: (family: ModeFamily) => number | null;
	};

	const props: Props = $props();
	// Which mode's rules are on screen. Starts at the live one and is only
	// changed by the tabs; the component is destroyed on close, so reopening
	// always lands back on whatever the player is actually playing.
	let viewing = $state<ModeFamily>(props.family ?? 'base');
	const viewingRules = $derived(FAMILY_RULES[viewing]);
	// A family with no guesses is a different game on the same board, and its
	// panel says so: the deck it deals from, one bust rule, no worked example
	// (there is no Higher or Lower to work), and a full-game line that states
	// the one figure and how often it lands rather than "depends on your picks".
	const viewingFixed = $derived(Boolean(viewingRules.fixedChoices));
	const viewingOneIn = $derived(winTiersFor(viewing)[0]?.oneIn ?? 0);
	const rows = $derived(payoutRowsFor(viewingRules));
	const bustRules = $derived(bustRowsFor(viewingRules));
	// The worked example's five figures, for the family on screen. Substituted
	// in order for %1..%5 - the catalogues carry the placeholders, never the
	// numbers, so no locale can quote Classic's odds on another mode.
	const oddsExample = $derived(oddsExampleFor(viewingRules));
	const exampleText = $derived.by(() => {
		const o = oddsExample;
		const figures = [o.lowerOn3, o.higherOn3, o.lowerOn8, o.higherOn8, o.equal];
		return figures.reduce(
			(text, n, i) => text.replace(`%${i + 1}`, n.toFixed(2)),
			t('With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.'),
		);
	});
	// Null when the caller did not supply one (the popup is also reachable from
	// the start screen, where no guesses exist yet) or when the guesses are
	// incomplete. Either way the family figure stands alone.
	const pickedCeiling = $derived(props.ceilingFor?.(viewing) ?? null);
</script>

  <div class="popup popup-info" role="dialog" aria-modal="true" tabindex="-1" aria-label={t('How to play')}>
    <div class="popup-head"><span>{t('How to Play')}</span><button class="popup-close" onclick={props.onclose} aria-label={t('Close')}><MarkIcon name="cross" /></button></div>
    <div class="info-body">
      <p>{t('Guess your way through four cards:')}</p>
      <ol>
        <li>{t('Color: red or black for card 1.')}</li>
        <li>{t('Higher / Lower: versus card 1 (or =).')}</li>
        <li>{t('Inside / Outside: between cards 1 & 2 (or =).')}</li>
        <li>{t('Suit: the suit of card 4.')}</li>
      </ol>
      <!-- What a miss costs is deliberately NOT stated here: it is different in
           every family (nothing at card 1; 30% or 16% after; forgiven once on
           Second Chance; nothing at all on Three of a Kind), and a one-line
           summary that fits one of them is wrong for the others. The mode panel
           below says it per family. -->
      <p>{t('Pick all four, set your bet and deal. Each right guess multiplies your win; get all four for a full game win. What a wrong guess costs you depends on the game mode, explained below.')}</p>

      <h4 class="info-h">{t('Card order')}</h4>
      <p>{t('Ace is low and King is high. Suit never affects rank: only the number counts for Higher / Lower and Inside / Outside.')}</p>
      <!-- Rendered from the same `ranks` array the game runs on, so it cannot
           disagree with the real ordering. An ordered list because that is
           exactly what it is: lowest to highest. -->
      <ol class="rank-strip">
        {#each ranks as rank}
          <li class="rank-chip">{rank}</li>
        {/each}
      </ol>
      <div class="rank-ends" aria-hidden="true">
        <span>{t('Lowest')}</span>
        <span>{t('Highest')}</span>
      </div>

      <h4 class="info-h">{t('Payouts follow the odds')}</h4>
      <!-- One paragraph, not two. This used to be followed by a second one
           ("Payouts are dynamic and change based on which cards remain...")
           that said the same thing again in different words; the "dynamic
           payouts" statement Stake's checklist wants is the last clause here.
           The worked example ("with a 3 on the table, Lower pays about...")
           is inside the mode panel, under the paytable, because its numbers
           are that table's numbers and move with the family the same way. -->
      <p>{t('Every correct guess pays its true odds against the cards left in the deck, so the less likely your pick, the more it pays, and the same guess can pay differently from one round to the next.')}</p>

      <!-- ---- Game modes ------------------------------------------------
           One switchable block rather than three sections each fixed to the
           live mode. A player comparing modes should not have to close this,
           change mode, and reopen it - and a reviewer checking that every mode
           states its cost, ceiling and rules should not have to either.

           `viewing` is local and starts at the live mode. The popup is inside
           an {#if} in Game.svelte, so closing it destroys this component and
           reopening builds a fresh one - which is what makes it snap back to
           whatever the player is actually on, with no reset logic. -->
      <h4 class="info-h">{t('Game modes')}</h4>
      <!-- The tagline the intro leads its stats with, as the section's first
           line here, and what it counts said plainly: every set of four picks
           is priced as its own bet mode, which is why the list of modes the
           RGS publishes is 193 long and not 4. -->
      <p class="info-tagline">
        <strong>{t('%n ways to play').replace('%n', waysToPlay.toLocaleString())}</strong>
        {t('Every combination of picks on a guess mode is its own bet, priced on its own odds.')}
      </p>
      <!-- The cost and the RTP in ONE sentence. Stake's checklist wants the
           cost of every mode stated in the rules ("Game modes include
           description and cost information"). Both figures are interpolated
           rather than written into the string: they used to be typed into all
           17 locale files, where nothing could compare them to the cost the
           round is priced at or the RTP the math is reweighted to. "This
           mode", because the families stopped sharing a cost when Three of a
           Kind arrived at 250x - the sentence follows the tab, so the cost it
           states is always the one for the rules on screen. -->
      <p>
        {t('This mode costs %c× your bet. Every mode returns the same %s over many rounds; what changes is how often a round pays and how much it can pay.')
          .replace('%c', String(viewingRules.cost))
          .replace('%s', `${(gameConfig.rtp * 100).toFixed(2)}%`)}
      </p>

      <div class="mode-tabs" role="tablist" aria-label={t('Game modes')}>
        <!-- Volatility order, matching the mode picker's rows. These tabs draw
             no bolt meter of their own, so the ordering is not load-bearing
             here the way it is there - but the same four modes listed in two
             different orders on two screens a player moves between is its own
             small confusion, and the picker's is the order that means
             something. See FAMILIES_BY_VOLATILITY. -->
        {#each FAMILIES_BY_VOLATILITY as family}
          <button
            type="button"
            role="tab"
            class="mode-tab"
            class:selected={viewing === family}
            aria-selected={viewing === family}
            onclick={() => (viewing = family)}
          >
            {t(FAMILY_RULES[family].label)}
            {#if family === (props.family ?? 'base')}
              <span class="mode-tab-live">{t('Playing')}</span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="mode-panel">
        <p class="mode-panel-blurb">{t(FAMILY_BLURB[viewing])}</p>
        <!-- The odds, on the family that does not deal the standard 52. Only
             what the blurb above does not already say - it used to restate the
             deck and the match rule a second time - and stated before any
             figure, because every figure below follows from it. -->
        {#if viewingFixed}
          <p class="mode-panel-blurb">{t('Card 1 is dealt, not guessed. The deck holds one Ace, King and Queen of each suit, so card 2 matches 3 times in 11 and card 3 twice in 10.')}</p>
        {/if}
        <p class="mode-panel-max">
          {t('Max win')} <strong>{viewingRules.maxWin}×</strong> {t('Bet')}
        </p>
        <!-- The figure above is the most this MODE can reach, which is the right
             headline for a mode a player is choosing between: some combination
             in it really does pay that. It is not what the bet in front of them
             pays. Every four-guess combination is its own published bet mode -
             192 of the 193 - and only 8 of each family's 64 reach the family
             ceiling; the median Classic mode stops at 268.8x against a stated
             1354.2x. Stake asks for the maximum win to be stated per bet mode
             and to be realistically obtainable, so both numbers belong here,
             clearly labelled as different things.

             Shown whenever the guesses are complete, INCLUDING when the two
             agree. It used to hide itself for the eight combinations that DO
             reach the ceiling, so they were not told the same number twice -
             but from the player's side the line simply failed to appear for
             their pick, and the two figures agreeing IS the information. -->
        {#if pickedCeiling !== null && !viewingFixed}
          <p class="mode-panel-picked">
            {t('Your four guesses top out at %s your bet.').replace('%s', `${pickedCeiling}×`)}
          </p>
        {/if}
        <!-- Says in words what the conditional line above only shows by
             example: the family figure is a ceiling SOME combinations reach,
             and the bet in front of the player has its own. Without this a
             player opening the rules from the start screen - no guesses
             picked, so no line above - read the family figure as their own.
             Not on a family with no guesses: there its one figure IS the bet's. -->
        {#if !viewingFixed}
          <p class="mode-panel-picked">{t('Only some guess combinations reach a mode’s maximum. Once your four are picked, their own ceiling is shown above.')}</p>
        {/if}

        <!-- Approval requires payout amounts stated for every pick. There is no
             fixed paytable to print - each stage pays its true odds against the
             remaining deck - so what is stated is the range each pick can pay,
             generated from the same function the game pays out with. Retention
             differs per mode, so every figure here moves with the tab. -->
        <h5 class="info-sub">{t('Payout table')}</h5>
        <table class="pay-table">
          <thead>
            <tr>
              <th scope="col">{t('Card')}</th>
              <th scope="col">{t('Pick')}</th>
              <!-- "Pays" over per-pick factors; "Total" over the fixed family's
                   running totals - see PayoutRow.kind for why they differ. -->
              <th scope="col" class="num">{t(payoutColumnFor(viewingRules))}</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row}
              <tr>
                <td class="pay-stage">{row.stage}</td>
                <td>{t(row.label)}</td>
                <td class="pay-amount">{payRange(row.min, row.max)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <!-- The worked example, computed for this family - see oddsExampleFor.
             Two Higher/Lower figures and the Equal figure are stage-2 rows of
             the table above, so a player can check one against the other.
             Not on a family with no Higher or Lower to work. -->
        {#if !viewingFixed}
          <p>{exampleText}</p>
        {/if}
        <!-- WHY THIS PARAGRAPH IS SO EXACT ABOUT ROUNDING.
             The table above quotes 1.99x for the colour pick, and the chip
             beside card 1 reads 1.90x for the same pick - because that chip is
             quantizeMultiplier() applied to the running total for display, while
             the total the round is actually settled from is never touched. Two
             numbers for the same thing on two screens is exactly the mistake
             this game keeps making, so the paragraph states which is which
             rather than leaving a player to reconcile them.
             The figures in the table are the true factors and must stay at 2dp:
             rounding them to 1.9x would make the table WRONG, because two 1.99x
             stages compound to 3.96x, not 3.61x. -->
        {#if viewingFixed}
          <!-- The fixed family's rows ARE the running totals, so the
               reconciliation the paragraph below does for factors is not
               needed; what is worth saying is that these are the board's own
               numbers and that only the last one pays. -->
          <p>{t('Each figure is the running total after that card, in multiples of your bet, exactly as the board shows it beside the cards. Only the last card pays.')}</p>
        {:else}
          <p>{t('Stages multiply together at full precision, so the figures above are exact. Only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded the same way at each step, so mid-round it can read slightly under these figures.')}</p>
        {/if}

        <!-- Computed per mode. This was once a single fixed list saying both
             "Card 2 - you get 0.5x your bet back" AND "you keep 30%", which
             reads as a contradiction: both are true of Classic (30% of the
             running total at card 2 IS 0.5x the bet) and only of Classic. -->
        <!-- No guesses on the fixed family, so no "guess wrong" there either. -->
        <h5 class="info-sub">{viewingFixed ? t('If a card does not match') : t('If you guess wrong')}</h5>
        <ul>
          {#each bustRules as row}
            <!-- Through t(), like every other string here. It was rendered raw for
                 a long time, which left this section English in all sixteen other
                 locales and let "pays nothing" through in social mode. -->
            <li><strong>{t(row.label)}</strong> — {row.percent === null ? t(row.key) : t(row.key).replace('%s', String(row.percent))}</li>
          {/each}
        </ul>

        <!-- The per-Equal-count averages this used to list were Classic's, from
             an exhaustive enumeration of all 6,497,400 draws. They are wrong for
             the other modes and cannot be re-derived cheaply per family, so what
             is stated is the exact ceiling - which IS known exactly - and the
             ordering, which holds everywhere. -->
        <h5 class="info-sub">{t('Full game wins')}</h5>
        {#if viewingFixed}
          <!-- One figure, and how often. The frequency is the ladder's own
               `oneIn` - the recorded figure, after the reweighter - so the
               sentence cannot quote a rate the tables do not deal. -->
          <p>{t('Three of a kind pays %m your bet, about one round in %n.')
            .replace('%m', `${viewingRules.maxWin}×`)
            .replace('%n', String(viewingOneIn))}</p>
        {:else}
          <p>{t('Guess all four right and the payout depends on how hard your picks were. Equal is the rarest guess, so rounds built on it pay the most; two Equal picks together is the most this mode can pay, at %m your bet.')
            .replace('%m', `${viewingRules.maxWin}×`)}</p>
        {/if}
      </div>

      <!-- The user interaction guide Stake asks for: every button on the bar,
           one line each, in the order they sit on the bar. There used to be a
           "Speed and autoplay" section above this one that described the
           lightning, circular-arrow and sliders buttons a second time, at
           twice the length, with "it never changes the cards, the odds or the
           payout" repeated in three separate bullets. What those bullets said
           is folded into the button's own line here, and the reassurance is
           said once, at the end. -->
      <h4 class="info-h">{t('Controls')}</h4>
      <ul>
        <li>{t('The large round button deals the round. So does the spacebar: tap for one round, hold to keep dealing. While autoplay runs the button becomes Stop, and the round in play finishes first.')}</li>
        <li>{t('Mode opens the game-mode picker. Switching asks you to confirm before it applies.')}</li>
        <li>{t('Plus and minus set your bet. Tap the amount for the quick-bet menu.')}</li>
        <li>{t('The lightning button is Turbo: how fast the cards flip, from Normal to Instant.')}</li>
        <li>{t('The circular arrows open autoplay, which deals the same bet again for a set number of rounds or unlimited. The counter sits on the button while it runs.')}</li>
        <li>{t('The sliders button holds two autoplay options: stop on a full game win, and skip the win animations.')}</li>
        <li>{t('The speaker opens the sound settings. Music and game sounds mute separately.')}</li>
        <li>{t('The i button opens this screen.')}</li>
        <li>{t('Speed and skip settings change only what you see, never the cards, the odds or the payout.')}</li>
      </ul>

      <h4 class="info-h">{t('Game information')}</h4>
      <!-- "The cards it deals", not "four cards": Three of a Kind deals three,
           and this sentence is the one a reviewer checks the rules against. -->
      <p>{t('This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent deal: four cards on the guess modes, three on Three of a Kind.')}</p>
      <!-- Required for approval, and required HERE specifically: the rules /
           information popup must state the RTP and must carry the legal
           disclaimer, and this popup is what the `i` button opens, so it is
           reachable at any point during play.
           The RTP is interpolated from game/config.ts rather than written
           out, so the figure a player is shown cannot drift from the one the
           math is actually built and reweighted to. -->
      <p>
        <!-- The max win is interpolated from FAMILY_RULES, not written out.
             It used to state 1354.2x flatly, which stopped being true the
             moment High Stakes reached 3820.5x - and "the most this game can
             pay" is exactly the claim a reviewer checks. -->
        {t('Return to player (RTP) is %s on every game mode. The most this game can pay is %m your bet, on %f.')
          .replace('%s', `${(gameConfig.rtp * 100).toFixed(2)}%`)
          .replace('%m', `${maxWinOverall}×`)
          .replace('%f', t(FAMILY_RULES[maxWinFamily].label))}
      </p>

      <h4 class="info-h">{t('Disclaimer')}</h4>
      <p>
        {t('Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.')}
      </p>
    </div>
  </div>

<style>
	/* A stylesheet is scoped to whichever component imports it, so this panel
	   carries its own imports rather than relying on Game.svelte's.
	   It takes the shell it shares with the other popups and its own body rules,
	   but NOT popups.css - that is all bet-menu, turbo and autoplay controls
	   this panel has no markup for, and importing it meant 46 unused-selector
	   warnings. */
	@import '../../styles/popups/popup-base.css';
	@import '../../styles/popups/popup-how-to-play.css';
</style>
