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
	import { bustRowsFor, payoutRowsFor } from '../../game/math/payoutTable';
	import { FAMILY_BLURB, FAMILY_RULES, MODE_FAMILIES, type ModeFamily } from '../../game/math/modes';
	import { FAMILIES_BY_VOLATILITY } from '../../game/math/volatility';
	import gameConfig from '../../game/platform/config';
	import { t } from '../../i18n/i18nDerived';
	import MarkIcon from '../icons/MarkIcon.svelte';

	/** The biggest figure any mode can pay, for the RTP statement below. */
	const maxWinOverall = Math.max(...MODE_FAMILIES.map((f) => FAMILY_RULES[f].maxWin));

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
	const rows = $derived(payoutRowsFor(viewingRules));
	const bustRules = $derived(bustRowsFor(viewingRules));
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
        <li>{t('Colour — red or black for card 1.')}</li>
        <li>{t('Higher / Lower — versus card 1 (or =).')}</li>
        <li>{t('Inside / Outside — between cards 1 & 2 (or =).')}</li>
        <li>{t('Suit — the suit of card 4.')}</li>
      </ol>
      <p>{t('Pick all four, set your bet, and hit Spin. Each correct guess multiplies your win; a wrong guess ends the round but you keep whatever you had banked so far. Guess all four to win the full game.')}</p>

      <h4 class="info-h">{t('Card order')}</h4>
      <p>{t('Ace is low and King is high — worth knowing, since plenty of card games play it the other way. Suit never affects rank; only the number counts for Higher / Lower and Inside / Outside.')}</p>
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
      <p>{t('Every correct guess pays its true odds, so the less likely your pick, the more it pays — and that depends on the cards already showing.')}</p>
      <p>{t('With a 3 on the table, Lower pays about 4.75× because only 8 of the 51 remaining cards are lower, while Higher pays about 1.19× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about 1.57× and Higher rises to about 2.08×. Equal is always the longest shot at roughly 12×.')}</p>
      <p>{t('Payouts are dynamic and change based on which cards remain in the deck — the less likely your pick, the higher it pays. The same guess can return different amounts from one round to the next.')}</p>

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
      <p>{t('Every mode costs %s× your bet.').replace('%s', String(viewingRules.cost))}</p>
      <!-- Interpolated from game/config.ts for the same reason as the RTP line
           further down: this used to write "96.00%" into the string itself, in
           all 17 locale files, so the one figure a reviewer checks against the
           math lived in seventeen places that no test compared. -->
      <p>
        {t('Every mode returns the same %s over many rounds. What changes is how often a round pays and how much it can pay.')
          .replace('%s', `${(gameConfig.rtp * 100).toFixed(2)}%`)}
      </p>

      <div class="mode-tabs" role="tablist" aria-label={t('Game modes')}>
        <!-- Volatility order, matching the mode picker's rows. These tabs draw
             no bolt meter of their own, so the ordering is not load-bearing
             here the way it is there - but the same three modes listed in two
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
        <p class="mode-panel-max">
          {t('Max win')} <strong>{viewingRules.maxWin}×</strong> {t('Bet')}
        </p>
        <!-- The figure above is the most this MODE can reach, which is the right
             headline for a mode a player is choosing between: some combination
             in it really does pay that. It is not what the bet in front of them
             pays. Every four-guess combination is its own published bet mode -
             192 of them - and only 8 of each family's 64 reach the family
             ceiling; the median Classic mode stops at 268.8x against a stated
             1354.2x. Stake asks for the maximum win to be stated per bet mode
             and to be realistically obtainable, so both numbers belong here,
             clearly labelled as different things.

             Suppressed when the two are equal, so the eight combinations that
             DO reach the ceiling are not told the same number twice. -->
        {#if pickedCeiling !== null && pickedCeiling !== viewingRules.maxWin}
          <p class="mode-panel-picked">
            {t('Your four guesses top out at %s your bet.').replace('%s', `${pickedCeiling}×`)}
          </p>
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
              <th scope="col" class="num">{t('Pays')}</th>
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
        <p>{t('Each stage multiplies the one before it, and they compound at full precision — the figures above are exact, not rounded. Only the round’s final payout is rounded down, once, to one decimal place. The running total beside the cards is rounded the same way at each step, so during a round it can read slightly under these figures.')}</p>

        <!-- Computed per mode. This was once a single fixed list saying both
             "Card 2 - you get 0.5x your bet back" AND "you keep 30%", which
             reads as a contradiction: both are true of Classic (30% of the
             running total at card 2 IS 0.5x the bet) and only of Classic. -->
        <h5 class="info-sub">{t('If you guess wrong')}</h5>
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
        <p>{t('Guess all four cards right and the payout depends on how hard your picks were:')}</p>
        <p>{t('Equal is the rarest guess, so the rounds built on it carry the largest wins — and are the hardest to land. Two Equal picks landing together is the most this mode can pay, at %m your bet.')
          .replace('%m', `${viewingRules.maxWin}×`)}</p>
      </div>

      <h4 class="info-h">{t('Speed and autoplay')}</h4>
      <ul>
        <li>{t('Turbo (the lightning button) slides from Normal to Instant and changes only how fast the cards flip. It never changes the cards, the odds or the payout.')}</li>
        <li>{t('Autoplay (the circular arrows) replays the same four guesses for a set number of rounds, or unlimited. The round counter sits on the button while it runs — press the red square to stop, and the round already in play finishes first.')}</li>
        <li>{t('Stop on full game win (the sliders button) ends an autoplay run the moment a round lands all four cards. It only stops the run; your bet never changes.')}</li>
        <li>{t('Skip card reveal on autoplay (the sliders button) runs autoplay without the card animation. It changes only the animation, never the cards, the odds or the payout.')}</li>
        <li>{t('Skip card reveal on spacebar hold (the sliders button) plays rounds without the card animation while the spacebar is held. It changes only the animation, never the cards, the odds or the payout.')}</li>
        <li>{t('Tap the spacebar to play one round, or hold it to keep spinning until you let go.')}</li>
      </ul>

      <h4 class="info-h">{t('Controls')}</h4>
      <ul>
        <li>{t('Use the bet display and the plus and minus buttons to set your play amount. Tap the bet amount to open the quick-select menu.')}</li>
        <li>{t('The speaker button mutes and unmutes the game sounds.')}</li>
        <li>{t('The i button opens this screen at any time.')}</li>
        <li>{t('The lightning button adjusts the speed of the card reveal.')}</li>
        <li>{t('The circular arrow button opens the autoplay settings.')}</li>
        <li>{t('The sliders button lets you toggle stop-on-full-win for autoplay runs.')}</li>
      </ul>

      <h4 class="info-h">{t('Game information')}</h4>
      <p>{t('This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent four-card draw.')}</p>
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
        {t('Return to player (RTP) is %s on every game mode, and each returns that same figure over many rounds. The most this game can pay is %m your bet, on High Stakes.')
          .replace('%s', `${(gameConfig.rtp * 100).toFixed(2)}%`)
          .replace('%m', `${maxWinOverall}×`)}
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
