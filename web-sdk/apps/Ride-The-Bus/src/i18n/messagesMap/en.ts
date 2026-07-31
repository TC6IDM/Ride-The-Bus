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
	'Card order': 'Card order',
	'Ace is low and King is high — worth knowing, since plenty of card games play it the other way. Suit never affects rank; only the number counts for Higher / Lower and Inside / Outside.':
		'Ace is low and King is high — worth knowing, since plenty of card games play it the other way. Suit never affects rank; only the number counts for Higher / Lower and Inside / Outside.',
	Lowest: 'Lowest',
	Highest: 'Highest',
	'Payouts follow the odds': 'Payouts follow the odds',
	'Every correct guess pays its true odds, so the less likely your pick, the more it pays — and that depends on the cards already showing.':
		'Every correct guess pays its true odds, so the less likely your pick, the more it pays — and that depends on the cards already showing.',
	'With a 3 on the table, Lower pays about 4.75× because only 8 of the 51 remaining cards are lower, while Higher pays about 1.19× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about 1.57× and Higher rises to about 2.08×. Equal is always the longest shot at roughly 12×.':
		'With a 3 on the table, Lower pays about 4.75× because only 8 of the 51 remaining cards are lower, while Higher pays about 1.19× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about 1.57× and Higher rises to about 2.08×. Equal is always the longest shot at roughly 12×.',
	'If you guess wrong': 'If you guess wrong',
	'Card 1 — the round pays nothing.': 'Card 1 — the round pays nothing.',
	'Card 2 — you get 0.5× your bet back.': 'Card 2 — you get 0.5× your bet back.',
	'Card 3 or 4 — you keep 30% of the multiplier you had built up, which ranges from 0.6× to 129×.':
		'Card 3 or 4 — you keep 30% of the multiplier you had built up, which ranges from 0.6× to 129×.',
	'Full game wins': 'Full game wins',
	'Guess all four cards right and the payout depends on how hard your picks were:':
		'Guess all four cards right and the payout depends on how hard your picks were:',
	'No Equal picks — averages 17.3×, up to 317.4×.': 'No Equal picks — averages 17.3×, up to 317.4×.',
	'One Equal pick — averages 67.5×, up to 381.9×.': 'One Equal pick — averages 67.5×, up to 381.9×.',
	'Two Equal picks — averages 1329.2×, up to 1354.2×, the most this game can pay.':
		'Two Equal picks — averages 1329.2×, up to 1354.2×, the most this game can pay.',
	'Equal is the rarest guess, so the rounds built on it carry the largest wins — and are the hardest to land.':
		'Equal is the rarest guess, so the rounds built on it carry the largest wins — and are the hardest to land.',
	'Speed and autoplay': 'Speed and autoplay',
	'Turbo (the lightning button) slides from Normal to Instant and changes only how fast the cards flip. It never changes the cards, the odds or the payout.':
		'Turbo (the lightning button) slides from Normal to Instant and changes only how fast the cards flip. It never changes the cards, the odds or the payout.',
	'Autoplay (the circular arrows) replays the same four guesses for a set number of rounds, or unlimited. The round counter sits on the button while it runs — press the red square to stop, and the round already in play finishes first.':
		'Autoplay (the circular arrows) replays the same four guesses for a set number of rounds, or unlimited. The round counter sits on the button while it runs — press the red square to stop, and the round already in play finishes first.',
	'Stop on full game win (the sliders button) ends an autoplay run the moment a round lands all four cards. It only stops the run; your bet never changes.':
		'Stop on full game win (the sliders button) ends an autoplay run the moment a round lands all four cards. It only stops the run; your bet never changes.',
	'Tap the spacebar to play one round, or hold it to keep spinning until you let go.':
		'Tap the spacebar to play one round, or hold it to keep spinning until you let go.',

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
	// %s is substituted at render time - keep it in translations. Deliberately
	// NOT {seconds}: Lingui parses braces as ICU placeholders and, with no
	// value passed, silently renders them as an empty string.
	'Spins must be %s seconds apart': 'Spins must be %s seconds apart',
	'Round in progress': 'Round in progress',
	'Replay is view-only': 'Replay is view-only',
	'No active game session': 'No active game session',
	'Net Position': 'Net Position',
	RTP: 'RTP',
	Session: 'Session',
	Fast: 'Fast',
	'Number of spins': 'Number of spins',
	'Unlimited spins': 'Unlimited spins',
	'More spins': 'More spins',
	'Fewer spins': 'Fewer spins',
	'Stop autoplay on a full game win': 'Stop autoplay on a full game win',
	'Close menu': 'Close menu',
	Close: 'Close',
};
