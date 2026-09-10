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
	// "bet" is restricted, and so is "funds" - the table's replacement for "fund"
	// is "balance". Both are rephrased rather than dropped: these are the strings
	// that tell a player WHY the play button will not fire.
	'Insufficient funds': 'Insufficient balance',
	'Bet is below the minimum of %s': 'Play amount is below the minimum of %s',
	'Bet is above the maximum of %s': 'Play amount is above the maximum of %s',
	// "bet" is restricted, and so is "rebet" (the table's replacement for it is
	// "respin", which would be nonsense on a card game). Both are rephrased
	// around "play amount" instead, the same substitution used above.
	'Bet is locked while autoplay runs': 'Play amount is locked while auto play runs',
	'Replays cannot be re-bet': 'Replays cannot be played again',
	Start: 'Start',

	// Bet menu
	'Bet Menu': 'Play Menu',
	'Quick Bets': 'Quick Plays',

	// Autoplay popup
	Autoplay: 'Auto Play',
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
	'Full game wins': 'Full game wins',
	'Guess all four cards right and the payout depends on how hard your picks were:':
		'Guess all four cards right and the winnings depend on how hard your picks were:',

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
	'Every mode costs %s× your bet.': 'Every mode costs %s× your play amount.',
	'Equal is the rarest guess, so the rounds built on it carry the largest wins — and are the hardest to land. Two Equal picks landing together is the most this mode can pay, at %m your bet.':
		'Equal is the rarest guess, so the rounds built on it carry the largest winnings — and are the hardest to land. Two Equal picks landing together is the most this mode can win, at %m your play amount.',
	'A wrong first card ends the round. Later misses keep 30% of what you had built.':
		'A wrong first card ends the round. Later misses keep 30% of what you had built.',
	'Return to player (RTP) is %s on every game mode, and each returns that same figure over many rounds. The most this game can pay is %m your bet, on High Stakes.':
		'Return to player (RTP) is %s on every game mode, and each returns that same figure over many rounds. The most this game can win is %m your play amount, on High Risk.',
	'Every mode returns the same %s over many rounds. What changes is how often a round pays and how much it can pay.':
		'Every mode returns the same %s over many rounds. What changes is how often a round wins and how much it can win.',

	// Auto-slam toggle in the interaction guide. "payout" is prohibited; the
	// toggle's own label carries no restricted terms and passes through.
	'Skip card reveal on spacebar hold (the sliders button) plays rounds without the card animation while the spacebar is held. It changes only the animation, never the cards, the odds or the payout.':
		'Skip card reveal on spacebar (the sliders button) plays rounds started with the spacebar without the card animation. It changes only the animation, never the cards, the odds or the win.',
	'Skip card reveal on autoplay (the sliders button) runs autoplay without the card animation. It changes only the animation, never the cards, the odds or the payout.':
		'Skip card reveal on autoplay (the sliders button) runs autoplay without the card animation. It changes only the animation, never the cards, the odds or the win.',

	// Paytable. "Payout" and "Pays" are both on the prohibited list, so the
	// heading and the amount column need social wording. "Card", "Pick", "Red or
	// Black" and "Any suit" carry no restricted terms and pass through unchanged.
	'Payout table': 'Win table',
	Pays: 'Wins',
	'Each stage multiplies the one before it, and they compound at full precision — the figures above are exact, not rounded. Only the round’s final payout is rounded down, once, to one decimal place. The running total beside the cards is rounded the same way at each step, so during a round it can read slightly under these figures.':
		'Each stage multiplies the one before it, and they compound at full precision — the figures above are exact, not rounded. Only the round’s final win is rounded down, once, to one decimal place. The running total beside the cards is rounded the same way at each step, so during a round it can read slightly under these figures.',

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

	// Per-mode ceiling, shown beside the family figure. "bet" is restricted.
	'Your four guesses top out at %s your bet.':
		'Your four guesses top out at %s your play amount.',

	// "pays" is on Stake's prohibited list. This sentence used to be rendered
	// raw rather than through t(), so the social map could not reach it at all.
	'The round ends and pays nothing.':
		'The round ends and wins nothing.',
};

export default socialMessages;
