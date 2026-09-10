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
	'Enter a number of plays': 'Enter a number of plays',
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

	// Sound popup. Two buses, because a player who wants the music off usually
	// still wants to hear the cards.
	'Sound settings': 'Sound settings',
	Sound: 'Sound',
	Music: 'Music',
	'Game Sounds': 'Game Sounds',
	'Mute music': 'Mute music',
	'Unmute music': 'Unmute music',
	'Mute game sounds': 'Mute game sounds',
	'Unmute game sounds': 'Unmute game sounds',

	// Autoplay popup
	Autoplay: 'Autoplay',
	'Number of Plays': 'Number of Plays',

	// Bet mode picker. The three ways to buy the same four guesses; only what a
	// miss keeps differs. Blurbs quote the measured ceilings so the copy cannot
	// drift from the maths.
	'Game Mode': 'Game Mode',
	'Max win': 'Max win',
	// Confirmation before a bet mode is activated - required by the approval
	// checklist, and worth having anyway: the three families cost the same but
	// differ in what a miss keeps and how high they reach.
	'Switch mode?': 'Switch mode?',
	Cancel: 'Cancel',
	Switch: 'Switch',
	// Read out in place of the bolt meter on each mode row. The bolts are
	// decorative one at a time and only mean anything as a count, so the meter
	// carries this instead of labelling five separate images.
	'Volatility %s of %t': 'Volatility %s of %t',
	'Every mode costs %s× your bet.': 'Every mode costs %s× your bet.',
	'Return to player (RTP) is %s on every game mode, and each returns that same figure over many rounds. The most this game can pay is %m your bet, on High Stakes.':
		'Return to player (RTP) is %s on every game mode, and each returns that same figure over many rounds. The most this game can pay is %m your bet, on High Stakes.',
	// Shown on the card a Second Chance round let off.
	Forgiven: 'Forgiven',
	'Game modes': 'Game modes',
	'Choose game mode': 'Choose game mode',
	Classic: 'Classic',
	'Second Chance': 'Second Chance',
	'High Stakes': 'High Stakes',
	'A wrong first card ends the round. Later misses keep 30% of what you had built.':
		'A wrong first card ends the round. Later misses keep 30% of what you had built.',
	'Card 1 still ends the round. After that your first wrong guess is forgiven and play continues.':
		'Card 1 still ends the round. After that your first wrong guess is forgiven and play continues.',
	'Every mode returns the same %s over many rounds. What changes is how often a round pays and how much it can pay.':
		'Every mode returns the same %s over many rounds. What changes is how often a round pays and how much it can pay.',

	// Advanced popup
	Advanced: 'Advanced',
	'Skip card reveal on spacebar hold': 'Skip card reveal on spacebar hold',
	'Skip the card reveal while the spacebar is held':
		'Skip the card reveal while the spacebar is held',
	'Skip card reveal on spacebar hold (the sliders button) plays rounds without the card animation while the spacebar is held. It changes only the animation, never the cards, the odds or the payout.':
		'Skip card reveal on spacebar hold (the sliders button) plays rounds without the card animation while the spacebar is held. It changes only the animation, never the cards, the odds or the payout.',
	'Card 1': 'Card 1',
	'Your first wrong guess': 'Your first wrong guess',
	'Your second wrong guess': 'Your second wrong guess',
	'Equal is the rarest guess, so the rounds built on it carry the largest wins — and are the hardest to land. Two Equal picks landing together is the most this mode can pay, at %m your bet.':
		'Equal is the rarest guess, so the rounds built on it carry the largest wins — and are the hardest to land. Two Equal picks landing together is the most this mode can pay, at %m your bet.',
	Playing: 'Playing',
	'Card 2, 3 or 4': 'Card 2, 3 or 4',
	'A wrong first card ends the round. Later misses keep only 20%, so every correct guess is worth more.':
		'A wrong first card ends the round. Later misses keep only 20%, so every correct guess is worth more.',
	'Stop on full game win': 'Stop on full game win',

	// How to play
	'How to Play': 'How to Play',
	'Guess your way through four cards:': 'Guess your way through four cards:',
	'Colour — red or black for card 1.': 'Colour — red or black for card 1.',
	'Higher / Lower — versus card 1 (or =).': 'Higher / Lower — versus card 1 (or =).',
	'Inside / Outside — between cards 1 & 2 (or =).':
		'Inside / Outside — between cards 1 & 2 (or =).',
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
	// Paytable. The rows themselves are generated from payout.ts; these are the
	// headings and the two pick names that are not already guess-selector labels.
	'Payout table': 'Payout table',
	Card: 'Card',
	Pick: 'Pick',
	Pays: 'Pays',
	'Red or Black': 'Red or Black',
	'Any suit': 'Any suit',
	'Each stage multiplies the one before it, and they compound at full precision — the figures above are exact, not rounded. Only the round’s final payout is rounded down, once, to one decimal place. The running total beside the cards is rounded the same way at each step, so during a round it can read slightly under these figures.':
		'Each stage multiplies the one before it, and they compound at full precision — the figures above are exact, not rounded. Only the round’s final payout is rounded down, once, to one decimal place. The running total beside the cards is rounded the same way at each step, so during a round it can read slightly under these figures.',
	'If you guess wrong': 'If you guess wrong',
	'Full game wins': 'Full game wins',
	'Guess all four cards right and the payout depends on how hard your picks were:':
		'Guess all four cards right and the payout depends on how hard your picks were:',
	'Speed and autoplay': 'Speed and autoplay',
	'Turbo (the lightning button) slides from Normal to Instant and changes only how fast the cards flip. It never changes the cards, the odds or the payout.':
		'Turbo (the lightning button) slides from Normal to Instant and changes only how fast the cards flip. It never changes the cards, the odds or the payout.',
	'Autoplay (the circular arrows) replays the same four guesses for a set number of rounds, or unlimited. The round counter sits on the button while it runs — press the red square to stop, and the round already in play finishes first.':
		'Autoplay (the circular arrows) replays the same four guesses for a set number of rounds, or unlimited. The round counter sits on the button while it runs — press the red square to stop, and the round already in play finishes first.',
	'Stop on full game win (the sliders button) ends an autoplay run the moment a round lands all four cards. It only stops the run; your bet never changes.':
		'Stop on full game win (the sliders button) ends an autoplay run the moment a round lands all four cards. It only stops the run; your bet never changes.',
	'Skip card reveal on autoplay (the sliders button) runs autoplay without the card animation. It changes only the animation, never the cards, the odds or the payout.':
		'Skip card reveal on autoplay (the sliders button) runs autoplay without the card animation. It changes only the animation, never the cards, the odds or the payout.',
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
	'Not possible after guessing Equal': 'Not possible after guessing Equal',
	// Shown on hovering the barred Inside pick. The short label above stays as
	// the accessible name; this is the visible explanation.
	'You guessed Equal, so cards 1 and 2 share a rank. Nothing can fall between them, so Inside cannot win.':
		'You guessed Equal, so cards 1 and 2 share a rank. Nothing can fall between them, so Inside cannot win.',
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
	'Insufficient funds': 'Insufficient funds',
	'Bet is below the minimum of %s': 'Bet is below the minimum of %s',
	'Bet is above the maximum of %s': 'Bet is above the maximum of %s',
	'Bet is locked while autoplay runs': 'Bet is locked while autoplay runs',
	'Mode is locked while autoplay runs': 'Mode is locked while autoplay runs',
	'Replays cannot be re-bet': 'Replays cannot be re-bet',
	'Replay is view-only': 'Replay is view-only',
	'No active game session': 'No active game session',
	// Failure dialog. Codes are from docs/rgs_docs/RGS.md "Response Codes".
	Error: 'Error',
	Reload: 'Reload',
	'Something went wrong. Please try again.': 'Something went wrong. Please try again.',
	'That bet was rejected. Please adjust the amount and try again.':
		'That bet was rejected. Please adjust the amount and try again.',
	'Not enough balance for that bet.': 'Not enough balance for that bet.',
	'Your session has expired. Please reload the game.':
		'Your session has expired. Please reload the game.',
	'A gambling limit on your account has been reached.':
		'A gambling limit on your account has been reached.',
	'This game is not available from your location.':
		'This game is not available from your location.',
	'The game server had a problem. Please try again shortly.':
		'The game server had a problem. Please try again shortly.',
	'The game is under maintenance. Please try again shortly.':
		'The game is under maintenance. Please try again shortly.',
	'Skip the reveal': 'Skip the reveal',
	'Session information': 'Session information',
	'Net Position': 'Net Position',
	RTP: 'RTP',
	Session: 'Session',
	Fast: 'Fast',
	'Number of plays': 'Number of plays',
	'Unlimited plays': 'Unlimited plays',
	'More plays': 'More plays',
	'Fewer plays': 'Fewer plays',
	'Stop autoplay on a full game win': 'Stop autoplay on a full game win',
	'Close menu': 'Close menu',
	Close: 'Close',
	'Game information': 'Game information',
	Disclaimer: 'Disclaimer',
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.':
		'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.',

	// Start screen / replay additions
	'Loading replay…': 'Loading replay…',
	'Loading Ride The Bus…': 'Loading Ride The Bus…',
	'Max Win': 'Max Win',
	'Tap to continue': 'Tap to continue',
	'Round details': 'Round details',
	'Play amount': 'Play amount',
	Mode: 'Mode',
	'Game mode': 'Game mode',
	Guesses: 'Guesses',
	Event: 'Event',
	Payout: 'Payout',
	Play: 'Play',

	// Rule additions (new)
	'Payouts are dynamic and change based on which cards remain in the deck — the less likely your pick, the higher it pays. The same guess can return different amounts from one round to the next.':
		'Payouts are dynamic and change based on which cards remain in the deck — the less likely your pick, the higher it pays. The same guess can return different amounts from one round to the next.',
	'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent four-card draw.':
		'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent four-card draw.',

	// User interaction guide (new)
	Controls: 'Controls',
	'Use the bet display and the plus and minus buttons to set your play amount. Tap the bet amount to open the quick-select menu.':
		'Use the bet display and the plus and minus buttons to set your play amount. Tap the bet amount to open the quick-select menu.',
	'The speaker button mutes and unmutes the game sounds.':
		'The speaker button mutes and unmutes the game sounds.',
	'The i button opens this screen at any time.': 'The i button opens this screen at any time.',
	'The lightning button adjusts the speed of the card reveal.':
		'The lightning button adjusts the speed of the card reveal.',
	'The circular arrow button opens the autoplay settings.':
		'The circular arrow button opens the autoplay settings.',
	'The sliders button lets you toggle stop-on-full-win for autoplay runs.':
		'The sliders button lets you toggle stop-on-full-win for autoplay runs.',

	// Big-win takeover. Tier names are ordered by rarity - see game/math/winTiers.ts.
	// "Max Win" is deliberately reused from the start screen's stat row: it is
	// the same figure, and calling the ceiling two different things would be
	// confusing in any language.
	'Big Win': 'Big Win',
	'Huge Win': 'Huge Win',
	'Mega Win': 'Mega Win',
	'Epic Win': 'Epic Win',
	'Tap to skip': 'Tap to skip',

	// Start-screen "?" badges. One per stage, explaining what that pick means
	// before the player has ever seen a round.
	'Guess the color of card 1: red or black.': 'Guess the color of card 1: red or black.',
	'Guess whether card 2 is higher or lower than card 1, or equal to it.':
		'Guess whether card 2 is higher or lower than card 1, or equal to it.',
	'Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either of the first 2 cards. If you pick Equal on step 2, Inside becomes impossible: nothing can fall between two cards of the same rank.':
		'Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either of the first 2 cards. If you pick Equal on step 2, Inside becomes impossible: nothing can fall between two cards of the same rank.',
	'Guess the suit of card 4: hearts, diamonds, clubs or spades.':
		'Guess the suit of card 4: hearts, diamonds, clubs or spades.',
	'Skip card reveal on autoplay': 'Skip card reveal on autoplay',
	'Skip the card reveal during autoplay': 'Skip the card reveal during autoplay',
	'Skip win animations on autoplay': 'Skip win animations on autoplay',
	'Skip big win animations during autoplay': 'Skip big win animations during autoplay',
	'Your four guesses top out at %s your bet.':
		'Your four guesses top out at %s your bet.',
	'Play Again': 'Play Again',
	'The round ends and pays nothing.':
		'The round ends and pays nothing.',
	'The round ends, keeping %s% of what you had built.':
		'The round ends, keeping %s% of what you had built.',
	'From card 2 on, it is forgiven — you keep %s% of what you had built and the round carries on.':
		'From card 2 on, it is forgiven — you keep %s% of what you had built and the round carries on.',
};
