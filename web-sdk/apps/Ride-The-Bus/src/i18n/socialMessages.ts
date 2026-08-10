/**
 * Social-casino (Stake.US) vocabulary replacements.
 *
 * When ?social=true, every call to t(key) checks this map first. Only keys
 * that differ from regular English are listed — anything not found here
 * falls through to the normal translation.
 *
 * The replacements follow Stake's prohibited-terms table exactly
 * (see the Jurisdiction Requirements in Stake Engine's submission docs).
 */
import type { MessageKey } from './i18nDerived';

const socialMessages: Partial<Record<MessageKey, string>> = {
	// Control bar readouts
	Balance: 'Balance',
	'Last Win': 'Last Won',
	Bet: 'Play',

	// Spin button / action states
	Spin: 'Play',
	Stop: 'Stop',
	'Pick all 4 guesses': 'Pick all 4 guesses',
	'Enter a valid bet': 'Enter a valid play amount',
	Start: 'Start',

	// Bet menu
	'Bet Menu': 'Play Menu',
	'Quick Bets': 'Quick Plays',

	// Autoplay popup
	Autoplay: 'Auto Play',
	'Number of Spins': 'Number of Plays',
	'Autoplay settings': 'Auto Play settings',
	'Stop autoplay': 'Stop auto play',

	// Advanced popup
	'Stop on full game win': 'Stop on full game won',
	'Stop autoplay on a full game win': 'Stop auto play on a full game won',

	// Accessible control names
	'Choose bet amount': 'Choose play amount',
	'Custom bet amount': 'Custom play amount',
	'Increase bet': 'Increase play',
	'Decrease bet': 'Decrease play',
	'More spins': 'More plays',
	'Fewer spins': 'Fewer plays',
	'Unlimited spins': 'Unlimited plays',
	'Spins must be %s seconds apart': 'Plays must be %s seconds apart',

	// Running win bar
	Winning: 'Won',
	'Full Game Win!': 'Full Game Won!',
	Banked: 'Banked',
	Busted: 'Busted',
	'Revealing…': 'Revealing…',

	// How to play — descriptions containing "bet", "win", "payout"
	'Guess your way through four cards:': 'Guess your way through four cards:',
	'Pick all four, set your bet, and hit Spin. Each correct guess multiplies your win; a wrong guess ends the round but you keep whatever you had banked so far. Guess all four to win the full game.':
		'Pick all four, set your play amount, and hit Play. Each correct guess multiplies your winnings; a wrong guess ends the round but you keep whatever you had banked so far. Guess all four to win the full game.',
	'With a 3 on the table, Lower pays about 4.75× because only 8 of the 51 remaining cards are lower, while Higher pays about 1.19× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about 1.57× and Higher rises to about 2.08×. Equal is always the longest shot at roughly 12×.':
		'With a 3 on the table, Lower wins about 4.75× because only 8 of the 51 remaining cards are lower, while Higher wins about 1.19× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about 1.57× and Higher rises to about 2.08×. Equal is always the longest shot at roughly 12×.',
	'Payouts follow the odds': 'Winnings follow the odds',
	'Every correct guess pays its true odds, so the less likely your pick, the more it pays — and that depends on the cards already showing.':
		'Every correct guess wins at its true odds, so the less likely your pick, the more it wins — and that depends on the cards already showing.',
	'If you guess wrong': 'If you guess wrong',
	'Card 1 — the round pays nothing.': 'Card 1 — the round wins nothing.',
	'Card 2 — you get 0.5× your bet back.': 'Card 2 — you get 0.5× of your play amount back.',
	'Card 3 or 4 — you keep 30% of the multiplier you had built up, which ranges from 0.6× to 129×.':
		'Card 3 or 4 — you keep 30% of the multiplier you had built up, which ranges from 0.6× to 129×.',
	'Full game wins': 'Full game wins',
	'Guess all four cards right and the payout depends on how hard your picks were:':
		'Guess all four cards right and the winnings depend on how hard your picks were:',
	'No Equal picks — averages 17.3×, up to 317.4×.':
		'No Equal picks — averages 17.3×, up to 317.4×.',
	'One Equal pick — averages 67.5×, up to 381.9×.':
		'One Equal pick — averages 67.5×, up to 381.9×.',
	'Two Equal picks — averages 1329.2×, up to 1354.2×, the most this game can pay.':
		'Two Equal picks — averages 1329.2×, up to 1354.2×, the most this game can win.',
	'Equal is the rarest guess, so the rounds built on it carry the largest wins — and are the hardest to land.':
		'Equal is the rarest guess, so the rounds built on it carry the largest winnings — and are the hardest to land.',

	// Speed and autoplay
	'Speed and autoplay': 'Speed and auto play',
	'Turbo (the lightning button) slides from Normal to Instant and changes only how fast the cards flip. It never changes the cards, the odds or the payout.':
		'Turbo (the lightning button) slides from Normal to Instant and changes only how fast the cards flip. It never changes the cards, the odds or the winnings.',
	'Autoplay (the circular arrows) replays the same four guesses for a set number of rounds, or unlimited. The round counter sits on the button while it runs — press the red square to stop, and the round already in play finishes first.':
		'Auto Play (the circular arrows) replays the same four guesses for a set number of rounds, or unlimited. The round counter sits on the button while it runs — press the red square to stop, and the round already in play finishes first.',
	'Stop on full game win (the sliders button) ends an autoplay run the moment a round lands all four cards. It only stops the run; your bet never changes.':
		'Stop on full game win (the sliders button) ends an auto play run the moment a round lands all four cards. It only stops the run; your play amount never changes.',
	'Tap the spacebar to play one round, or hold it to keep spinning until you let go.':
		'Tap the spacebar to play one round, or hold it to keep playing until you let go.',

	// Game information
	'Game information': 'Game information',
	'Return to player (RTP) is %s. Every combination of guesses costs 1x your bet and returns that same figure over many rounds. The most this game can pay is 1354.2x your bet.':
		'Return to player (RTP) is %s. Every combination of guesses costs 1x your play amount and returns that same figure over many rounds. The most this game can win is 1354.2× your play amount.',

	// Dynamic payout statement (new key — also added to en.ts)
	'Payouts are dynamic and change based on which cards remain in the deck — the less likely your pick, the higher it pays. The same guess can return different amounts from one round to the next.':
		'Winnings are dynamic and change based on which cards remain in the deck — the less likely your pick, the higher it wins. The same guess can return different amounts from one round to the next.',

	// No free games statement (new key — also added to en.ts)
	'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent four-card draw.':
		'This game has no free rounds, bonus features, jackpots, or re-trigger features. Every round is a single, independent four-card draw.',

	// Error dialog. "bet" and "gambling" are both on the prohibited list, and
	// these are the only restricted terms that reach the player through a
	// failure path rather than the rules screen - easy to miss in review, and
	// just as visible when they fire.
	'That bet was rejected. Please adjust the amount and try again.':
		'That play was rejected. Please adjust the amount and try again.',
	'Not enough balance for that bet.': 'Not enough balance for that play.',
	'A gambling limit on your account has been reached.':
		'A play limit on your account has been reached.',

	// Bet mode picker.
	//
	// Two of these the prohibited-terms regex does NOT catch, and they are here
	// anyway: "High Stakes" and "staked" both derive from "stake", which is on
	// Stake's list, but \bstake\b does not match either. A word-boundary check
	// is a guard against the obvious cases, not a substitute for reading the
	// copy - a US reviewer is looking at the words, not the regex.
	'High Stakes': 'High Risk',
	'A wrong first card ends the round. Later misses keep 30%. Up to 1354.2× your bet.':
		'A wrong first card ends the round. Later misses keep 30%. Up to 1354.2× your play amount.',
	'Card 1 still ends the round, but after that your first wrong guess is forgiven and play continues. Up to 438.6× per unit staked.':
		'Card 1 still ends the round, but after that your first wrong guess is forgiven and play continues. Up to 438.6× per unit played.',
	'Misses keep only 20%, so correct guesses are worth more. Up to 1910.2× per unit staked.':
		'Misses keep only 20%, so correct guesses are worth more. Up to 1910.2× per unit played.',
	'Every mode returns the same 96.00% over many rounds. What changes is how often a round pays and how much it can pay.':
		'Every mode returns the same 96.00% over many rounds. What changes is how often a round wins and how much it can win.',

	// Auto-slam toggle in the interaction guide. "payout" is prohibited; the
	// toggle's own label carries no restricted terms and passes through.
	'Skip card reveal on autoplay (the sliders button) runs autoplay without the card animation. It changes only the animation, never the cards, the odds or the payout.':
		'Skip card reveal on autoplay (the sliders button) runs autoplay without the card animation. It changes only the animation, never the cards, the odds or the win.',

	// Paytable. "Payout" and "Pays" are both on the prohibited list, so the
	// heading and the amount column need social wording. "Card", "Pick", "Red or
	// Black" and "Any suit" carry no restricted terms and pass through unchanged.
	'Payout table': 'Win table',
	Pays: 'Wins',
	'Each stage multiplies the one before it, so the four combine into the round’s final payout. The running total shown beside the cards is rounded down to one decimal place, so it can read a little under these figures.':
		'Each stage multiplies the one before it, so the four combine into the round’s final win. The running total shown beside the cards is rounded down to one decimal place, so it can read a little under these figures.',

	// Replay start screen
	Payout: 'Won',

	// User interaction guide
	'Use the bet display and the plus and minus buttons to set your play amount. Tap the bet amount to open the quick-select menu.':
		'Use the play amount display and the plus and minus buttons to set your play amount. Tap the play amount to open the quick-select menu.',
	'The circular arrow button opens the autoplay settings.':
		'The circular arrow button opens the auto play settings.',
	'The sliders button lets you toggle stop-on-full-win for autoplay runs.':
		'The sliders button lets you toggle stop-on-full-win for auto play runs.',

	// Big-win takeover. The tier names need no replacement - "win" is one of the
	// table's REPLACEMENT words, not a restricted one - but "autoplay" is spelled
	// "auto play" everywhere else in social mode, so these follow suit.
	'Skip win animations on autoplay': 'Skip win animations on auto play',
	'Skip big win animations during autoplay': 'Skip big win animations during auto play',
};

export default socialMessages;
