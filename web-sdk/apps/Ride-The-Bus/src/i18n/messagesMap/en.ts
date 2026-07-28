// Source-of-truth English copy for every player-visible string in the game.
//
// The key IS the English text by convention in this SDK - translate(key) falls
// back to the key when a locale has no entry, so an untranslated locale degrades
// to readable English rather than a blank. Adding a language means adding one map
// beside this file and listing it in ./index.ts; no component changes.
//
// Deliberately NOT here: "Ride The Bus" and "by Takeover Casino" (brand names,
// which stay as-is in every locale) and currency amounts (formatted by
// numberToCurrencyString from the player's own currency).
export default {
	HOME: 'HOME',

	// Control bar readouts
	Balance: 'Balance',
	'Last Win': 'Last Win',
	Bet: 'Bet',

	// Guess selectors. Higher/Lower and Inside/Outside are two separate words per
	// label so each can wrap onto its own line.
	Color: 'Color',
	Higher: 'Higher',
	Lower: 'Lower',
	Inside: 'Inside',
	Outside: 'Outside',
	Suit: 'Suit',

	// Win readout above the guesses
	Winning: 'Winning',
	'Full Game Win!': 'Full Game Win!',
	Banked: 'Banked',
	Busted: 'Busted',
	'Revealing…': 'Revealing…',

	// Spin button / action states
	Spin: 'Spin',
	Stop: 'Stop',
	left: 'left',
	'Pick all 4 guesses': 'Pick all 4 guesses',
	'Enter a valid bet': 'Enter a valid bet',
	'Set rounds': 'Set rounds',
	Start: 'Start',

	// Bet menu
	'Bet Menu': 'Bet Menu',
	'Quick Bets': 'Quick Bets',

	// Turbo popup
	'Turbo Speed': 'Turbo Speed',
	Normal: 'Normal',
	Instant: 'Instant',
	'Off — full animation': 'Off — full animation',
	'% faster': '% faster',

	// Autoplay popup
	Autoplay: 'Autoplay',
	'Number of Spins': 'Number of Spins',

	// Advanced popup
	Advanced: 'Advanced',
	'Stop on full game win': 'Stop on full game win',

	// How to play
	'How to Play': 'How to Play',
	'Guess your way through four cards:': 'Guess your way through four cards:',
	'Colour — red or black for card 1.': 'Colour — red or black for card 1.',
	'Higher / Lower — versus card 1 (or =).': 'Higher / Lower — versus card 1 (or =).',
	'Inside / Outside — between cards 1 & 2 (or =).': 'Inside / Outside — between cards 1 & 2 (or =).',
	'Suit — the suit of card 4.': 'Suit — the suit of card 4.',
	'Pick all four, set your bet, and hit Spin. Each correct guess multiplies your win; a wrong guess ends the round but you keep whatever you had banked so far. Guess all four to win the full game.':
		'Pick all four, set your bet, and hit Spin. Each correct guess multiplies your win; a wrong guess ends the round but you keep whatever you had banked so far. Guess all four to win the full game.',
	'Use Turbo to speed up the reveal and Autoplay to run many rounds with the same guesses.':
		'Use Turbo to speed up the reveal and Autoplay to run many rounds with the same guesses.',

	// Accessible control names (screen readers)
	'Pick a color': 'Pick a color',
	'Higher, lower, or equal': 'Higher, lower, or equal',
	'Inside, outside, or equal': 'Inside, outside, or equal',
	'Pick a suit': 'Pick a suit',
	Red: 'Red',
	Black: 'Black',
	Equal: 'Equal',
	Heart: 'Heart',
	Diamond: 'Diamond',
	Club: 'Club',
	Spade: 'Spade',
	Mute: 'Mute',
	Unmute: 'Unmute',
	'How to play': 'How to play',
	'Choose bet amount': 'Choose bet amount',
	'Custom bet amount': 'Custom bet amount',
	'Increase bet': 'Increase bet',
	'Decrease bet': 'Decrease bet',
	'Turbo speed': 'Turbo speed',
	'Autoplay settings': 'Autoplay settings',
	'Advanced settings': 'Advanced settings',
	'Stop autoplay': 'Stop autoplay',
	'Number of spins': 'Number of spins',
	'Unlimited spins': 'Unlimited spins',
	'More spins': 'More spins',
	'Fewer spins': 'Fewer spins',
	'Stop autoplay on a full game win': 'Stop autoplay on a full game win',
	'Close menu': 'Close menu',
	Close: 'Close',
};
