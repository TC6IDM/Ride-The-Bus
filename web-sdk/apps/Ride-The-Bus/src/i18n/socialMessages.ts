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
	// "win" is NOT a restricted term - Stake's table uses win/won as the
	// REPLACEMENTS for pay/paid. "Last Win", "Winning" and "Full game win" used to be
	// rewritten to "Last Won", "Won" (mid-round, the wrong tense) and "Full game won",
	// which only made the copy ungrammatical (live pass, 2026-10-05). They render
	// in plain English now.
	Balance: 'Balance',
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
	'Bet menu': 'Play menu',
	'Quick bets': 'Quick plays',

	// Autoplay popup
	Autoplay: 'Auto Play',
	'Autoplay settings': 'Auto Play settings',
	'Stop autoplay': 'Stop auto play',

	// Autoplay popup, what ends a run
	'Stop autoplay on full game win': 'Stop auto play on full game win',
	'× means times your base bet.': '× means times your base play amount.',
	'Times your base bet': 'Times your base play amount',

	// Accessible control names
	'Choose bet amount': 'Choose play amount',
	'Custom bet amount': 'Custom play amount',
	'Increase bet': 'Increase play',
	'Decrease bet': 'Decrease play',

	// Running win bar
	Kept: 'Kept',
	// "stake" is restricted (play amount); Three of a Kind's live total rides.
	'At stake': 'In play',
	Busted: 'Busted',
	'Revealing…': 'Revealing…',

	// How to play - descriptions containing "bet", "win", "payout"
	'Guess your way through four cards:': 'Guess your way through four cards:',
	'Pick all four, set your bet and deal. Each right guess multiplies your win, and four right is a full game win. What a wrong guess costs depends on the game mode; see Game modes below.':
		'Pick all four, set your play amount and deal. Each right guess multiplies your win, and four right is a full game win. What a wrong guess costs depends on the game mode; see Game modes below.',
	'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.':
		'With a 3 on the table, Lower wins about %1× because only 8 of the 51 remaining cards are lower, while Higher wins about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.',
	'Payouts follow the odds': 'Winnings follow the odds',
	'Each right guess is priced on the cards still in the deck: the less likely it is, the more it pays. So the same guess can pay differently from one round to the next.':
		'Each right guess is priced on the cards still in the deck: the less likely it is, the more it wins. So the same guess can win differently from one round to the next.',
	'If you guess wrong': 'If you guess wrong',
	'Full game wins': 'Full game wins',

	// Game information
	'Game information': 'Game information',

	// No free games statement (new key - also added to en.ts)
	'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent deal: four cards on the guess modes, three on Three of a Kind.':
		'This game has no free rounds, bonus features, jackpots, or re-trigger features. Every round is a single, independent deal: four cards on the guess modes, three on Three of a Kind.',

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
	'A full game win pays more the harder your picks were. Equal is the rarest guess, so it pays the most, and two Equal picks reach this mode’s maximum: %m your bet.':
		'A full game win is worth more the harder your picks were. Equal is the rarest guess, so it wins the most, and two Equal picks reach this mode’s maximum: %m your play amount.',
	'A wrong first card ends the round. Later misses keep 30% of your running total.':
		'A wrong first card ends the round. Later misses keep 30% of your running total.',
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
	'These figures are exact: the stages multiply at full precision, and only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded down as it goes, so mid-round it can read a little under them.':
		'These figures are exact: the stages multiply at full precision, and only the final win is rounded down, to one decimal place. The running total beside the cards is rounded down as it goes, so mid-round it can read a little under them.',

	// Replay start screen
	Payout: 'Won',

	// User interaction guide. "bet" and "payout" are restricted, and "autoplay"
	// is spelled "auto play" everywhere else in social mode.
	'Plus and minus set your bet. Tap the amount for the quick-bet menu.':
		'Plus and minus set your play amount. Tap the amount for the quick-play menu.',
	'Plus and minus set your bet. Click the amount for the quick-bet menu.':
		'Plus and minus set your play amount. Click the amount for the quick-play menu.',
	'The big round button deals. So does the spacebar: tap for one round, hold to keep dealing. During autoplay it becomes Stop, and the round in play finishes first.':
		'The big round button deals. So does the spacebar: tap for one round, hold to keep dealing. During auto play it becomes Stop, and the round in play finishes first.',
	'The circular arrows open autoplay: the same bet, dealt again for a set number of rounds or without limit. The button counts down the rounds left.':
		'The circular arrows open auto play: the same play amount, dealt again for a set number of rounds or without limit. The button counts down the rounds left.',
	'Turbo and skipping win animations change only what you see, never the cards, the odds or the payout.':
		'Turbo and skipping win animations change only what you see, never the cards, the odds or the win.',

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
	'There are %n ways to play: every set of picks is its own bet, priced on its own odds.':
		'There are %n ways to play: every set of picks is its own play, priced on its own odds.',
	'Only some combinations reach the mode’s maximum. Once your four are picked, the most they can pay is shown above.':
		'Only some combinations reach the mode’s maximum. Once your four are picked, the most they can win is shown above.',
	'Three of a kind pays %m your bet, about one round in %n.':
		'Three of a kind wins %m your play amount, about one round in %n.',
	'Each figure is the running total after that card, in multiples of your bet, exactly as the board shows it beside the cards. Only the last card pays.':
		'Each figure is the running total after that card, in multiples of your play amount, exactly as the board shows it beside the cards. Only the last card wins.',
	'That mode costs %c× your bet.':
		'That mode costs %c× your play amount.',
	// "pays nothing" and "base bet" carry restricted terms.
	'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.':
		'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less wins nothing.',
	'%c× your base bet of %b': '%c× your base play amount of %b',
	'Tap the amount for the quick-bet menu.':
		'Tap the amount for the quick-play menu.',
	'Click the amount for the quick-bet menu.':
		'Click the amount for the quick-play menu.',
	'Max win %s your bet':
		'Max win %s your play amount',
	// Last Stop: "pays" and "bet" are restricted. Its blurb, the Classic-pricing
	// line and the example's ending were written without either, so they need no
	// entry here; the one below is How to Play's full-win line.
	'A full game win pays more the harder your picks were, and the ticket multiplies it. Two Equal picks and a ×10 ticket reach this mode’s maximum: %m your bet.':
		'A full game win is worth more the harder your picks were, and the ticket multiplies it. Two Equal picks and a ×10 ticket reach this mode’s maximum: %m your play amount.',
};

export default socialMessages;
