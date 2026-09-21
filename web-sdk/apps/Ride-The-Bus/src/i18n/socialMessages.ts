/**
 * Social-casino (Stake.US) vocabulary replacements.
 *
 * When ?social=true, every call to t(key) checks this map first. Only keys
 * that differ from regular English are listed - anything not found here
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

	// Deal button / action states. "Deal" carries no restricted term, so the
	// button keeps its name here; only the states below it change.
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
	'Stop autoplay on full game win': 'Stop auto play on full game won',

	// Accessible control names
	'Choose bet amount': 'Choose play amount',
	'Custom bet amount': 'Custom play amount',
	'Increase bet': 'Increase play',
	'Decrease bet': 'Decrease play',

	// Running win bar
	Winning: 'Won',
	'Full Game Win!': 'Full Game Won!',
	Banked: 'Banked',
	Busted: 'Busted',
	'Revealing…': 'Revealing…',

	// How to play - descriptions containing "bet", "win", "payout"
	'Guess your way through four cards:': 'Guess your way through four cards:',
	'Pick all four, set your bet and deal. Each right guess multiplies your win; get all four for a full game win. What a wrong guess costs you depends on the game mode, explained below.':
		'Pick all four, set your play amount and deal. Each right guess multiplies your win; get all four for a full game win. What a wrong guess costs you depends on the game mode, explained below.',
	'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.':
		'With a 3 on the table, Lower wins about %1× because only 8 of the 51 remaining cards are lower, while Higher wins about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.',
	'Payouts follow the odds': 'Winnings follow the odds',
	'Every correct guess pays its true odds against the cards left in the deck, so the less likely your pick, the more it pays, and the same guess can pay differently from one round to the next.':
		'Every correct guess wins at its true odds against the cards left in the deck, so the less likely your pick, the more it wins, and the same guess can win differently from one round to the next.',
	'If you guess wrong': 'If you guess wrong',
	'Full game wins': 'Full game wins',

	// Game information
	'Game information': 'Game information',

	// No free games statement (new key - also added to en.ts)
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
	'Guess all four right and the payout depends on how hard your picks were. Equal is the rarest guess, so rounds built on it pay the most; two Equal picks together is the most this mode can pay, at %m your bet.':
		'Guess all four right and the winnings depend on how hard your picks were. Equal is the rarest guess, so rounds built on it win the most; two Equal picks together is the most this mode can win, at %m your play amount.',
	'A wrong first card ends the round. Later misses keep 30% of what you had built.':
		'A wrong first card ends the round. Later misses keep 30% of what you had built.',
	'Return to player (RTP) is %s on every game mode. The most this game can pay is %m your bet, on %f.':
		'Return to player (RTP) is %s on every game mode. The most this game can win is %m your play amount, on %f.',
	// "costs" is not on the list, but "bet" is, and "can be played for" is the
	// wording the old stand-alone cost line already used here.
	'This mode costs %c× your bet. Every mode returns the same %s over many rounds; what changes is how often a round pays and how much it can pay.':
		'This mode can be played for %c× your play amount. Every mode returns the same %s over many rounds; what changes is how often a round wins and how much it can win.',

	// Paytable. "Payout" and "Pays" are both on the prohibited list, so the
	// heading and the amount column need social wording. "Card", "Pick", "Red or
	// Black" and "Any suit" carry no restricted terms and pass through unchanged.
	'Payout table': 'Win table',
	Pays: 'Wins',
	'Stages multiply together at full precision, so the figures above are exact. Only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded the same way at each step, so mid-round it can read slightly under these figures.':
		'Stages multiply together at full precision, so the figures above are exact. Only the final win is rounded down, to one decimal place. The running total beside the cards is rounded the same way at each step, so mid-round it can read slightly under these figures.',

	// Replay start screen
	Payout: 'Won',

	// User interaction guide. "bet" and "payout" are restricted, and "autoplay"
	// is spelled "auto play" everywhere else in social mode.
	'Plus and minus set your bet. Tap the amount for the quick-bet menu.':
		'Plus and minus set your play amount. Tap the amount for the quick-play menu.',
	'The large round button deals the round. So does the spacebar: tap for one round, hold to keep dealing. While autoplay runs the button becomes Stop, and the round in play finishes first.':
		'The large round button deals the round. So does the spacebar: tap for one round, hold to keep dealing. While auto play runs the button becomes Stop, and the round in play finishes first.',
	'The circular arrows open autoplay, which repeats your four guesses for a set number of rounds or unlimited. The counter sits on the button while it runs.':
		'The circular arrows open auto play, which repeats your four guesses for a set number of rounds or unlimited. The counter sits on the button while it runs.',
	'The sliders button holds two autoplay options: stop on a full game win, and skip the win animations.':
		'The sliders button holds two auto play options: stop on a full game win, and skip the win animations.',
	'Speed and skip settings change only what you see, never the cards, the odds or the payout.':
		'Speed and skip settings change only what you see, never the cards, the odds or the win.',

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
	// Three of a Kind. "Costs ... bet" and "pays ... bet" carry restricted
	// terms; the blurb, the deck sentence and the captions do not.
	'Costs %c× your bet': 'Can be played for %c× your play amount',
	// The How to Play tagline's second sentence. "bet" is restricted.
	'Every combination of picks on a guess mode is its own bet, priced on its own odds.':
		'Every combination of picks on a guess mode is its own play, priced on its own odds.',
	'Three of a kind pays %m your bet, about one round in %n.':
		'Three of a kind wins %m your play amount, about one round in %n.',
	// "pays nothing" and "base bet" carry restricted terms.
	'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.':
		'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less wins nothing.',
	'%c× your base bet of %b': '%c× your base play amount of %b',
};

export default socialMessages;
