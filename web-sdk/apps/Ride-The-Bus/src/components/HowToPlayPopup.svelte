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
	 * UI at any point during play. The RTP is interpolated from game/config.ts
	 * rather than written out, so the figure shown cannot drift from the one the
	 * math is built and reweighted to.
	 */
	// `ranks` is imported rather than the order being retyped here, so the strip
	// below can never drift from the order the game and the math-sdk actually use.
	import { ranks } from '../game/roundContract';
	import gameConfig from '../game/config';
	import { t } from '../i18n/i18nDerived';

	type Props = { onclose: () => void };

	const props: Props = $props();
</script>

  <div class="popup popup-info" role="dialog" aria-label={t('How to play')}>
    <div class="popup-head"><span>{t('How to Play')}</span><button class="popup-close" onclick={props.onclose} aria-label={t('Close')}>✕</button></div>
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

      <h4 class="info-h">{t('If you guess wrong')}</h4>
      <ul>
        <li>{t('Card 1 — the round pays nothing.')}</li>
        <li>{t('Card 2 — you get 0.5× your bet back.')}</li>
        <li>{t('Card 3 or 4 — you keep 30% of the multiplier you had built up, which ranges from 0.6× to 129×.')}</li>
      </ul>

      <h4 class="info-h">{t('Full game wins')}</h4>
      <p>{t('Guess all four cards right and the payout depends on how hard your picks were:')}</p>
      <ul>
        <li>{t('No Equal picks — averages 17.3×, up to 317.4×.')}</li>
        <li>{t('One Equal pick — averages 67.5×, up to 381.9×.')}</li>
        <li>{t('Two Equal picks — averages 1329.2×, up to 1354.2×, the most this game can pay.')}</li>
      </ul>
      <p>{t('Equal is the rarest guess, so the rounds built on it carry the largest wins — and are the hardest to land.')}</p>

      <h4 class="info-h">{t('Speed and autoplay')}</h4>
      <ul>
        <li>{t('Turbo (the lightning button) slides from Normal to Instant and changes only how fast the cards flip. It never changes the cards, the odds or the payout.')}</li>
        <li>{t('Autoplay (the circular arrows) replays the same four guesses for a set number of rounds, or unlimited. The round counter sits on the button while it runs — press the red square to stop, and the round already in play finishes first.')}</li>
        <li>{t('Stop on full game win (the sliders button) ends an autoplay run the moment a round lands all four cards. It only stops the run; your bet never changes.')}</li>
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
        {t('Return to player (RTP) is %s. Every combination of guesses costs 1x your bet and returns that same figure over many rounds. The most this game can pay is 1354.2x your bet.').replace('%s', `${(gameConfig.rtp * 100).toFixed(2)}%`)}
      </p>

      <h4 class="info-h">{t('Disclaimer')}</h4>
      <p>
        {t('Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and (c) 2026 Stake Engine.')}
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
	@import '../styles/popup-base.css';
	@import '../styles/popup-how-to-play.css';
</style>
