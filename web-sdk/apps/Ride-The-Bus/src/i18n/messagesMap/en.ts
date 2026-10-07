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
	'Full game win': 'Full game win',
	Busted: 'Busted',
	'Revealing…': 'Revealing…',

	// Deal button / action states
	Deal: 'Deal',
	Stop: 'Stop',
	left: 'left',
	'Pick all 4 guesses': 'Pick all 4 guesses',
	'Enter a number of plays': 'Enter a number of plays',
	'Enter a valid bet': 'Enter a valid bet',
	'Set rounds': 'Set rounds',
	Start: 'Start',

	// Bet menu
	'Bet menu': 'Bet menu',
	'Quick bets':
		'Quick bets',

	// Turbo popup
	Normal: 'Normal',
	Instant: 'Instant',
	'Off: full animation': 'Off: full animation',
	'% faster': '% faster',

	// Sound popup. Two buses, because a player who wants the music off usually
	// still wants to hear the cards.
	'Sound settings': 'Sound settings',
	Sound: 'Sound',
	Music: 'Music',
	'Game sounds':
		'Game sounds',
	'Mute music': 'Mute music',
	'Unmute music': 'Unmute music',
	'Mute game sounds': 'Mute game sounds',
	'Unmute game sounds': 'Unmute game sounds',

	// Autoplay popup
	Autoplay: 'Autoplay',

	// Bet mode picker. The three ways to buy the same four guesses - only what a
	// miss keeps differs - plus Three of a Kind, a different game at 250x the bet.
	// Blurbs quote the measured ceilings so the copy cannot drift from the maths.
	// Confirmation before a bet mode is activated - required by the approval
	// checklist ("high cost bet modes require confirmation": Three of a Kind is
	// 250x), and worth having anyway: the guess families cost the same but differ
	// in what a miss keeps and how high they reach.
	'Switch mode?': 'Switch mode?',
	Cancel: 'Cancel',
	Switch: 'Switch',
	// Read out in place of the bolt meter on each mode row. The bolts are
	// decorative one at a time and only mean anything as a count, so the meter
	// carries this instead of labelling five separate images.
	'Volatility %s of %t': 'Volatility %s of %t',
	'Return to player (RTP) is %s on every game mode. The most this game can pay is %m your bet, on %f.':
		'Return to player (RTP) is %s on every game mode. The most this game can pay is %m your bet, on %f.',
	// Shown on the card a Second Chance round let off.
	Forgiven: 'Forgiven',
	// The intro's tagline and the first line of How to Play's Game modes.
	'%n ways to play': '%n ways to play',
	'There are %n ways to play: every set of picks is its own bet, priced on its own odds.':
		'There are %n ways to play: every set of picks is its own bet, priced on its own odds.',
	'Game modes': 'Game modes',
	'Choose game mode': 'Choose game mode',
	Classic: 'Classic',
	'Second Chance': 'Second Chance',
	'High Stakes': 'High Stakes',
	'A wrong first card ends the round. Later misses keep 30% of your running total.':
		'A wrong first card ends the round. Later misses keep 30% of your running total.',
	'A wrong first card ends the round. After that your first miss is forgiven and play continues.':
		'A wrong first card ends the round. After that your first miss is forgiven and play continues.',
	'This mode costs %c× your bet. Every mode returns the same %s over many rounds; what changes is how often a round pays and how much it can pay.':
		'This mode costs %c× your bet. Every mode returns the same %s over many rounds; what changes is how often a round pays and how much it can pay.',

	'Card 1': 'Card 1',
	'Your first wrong guess': 'Your first wrong guess',
	'Your second wrong guess': 'Your second wrong guess',
	'A full game win pays more the harder your picks were. Equal is the rarest guess, so it pays the most, and two Equal picks reach this mode’s maximum: %m your bet.':
		'A full game win pays more the harder your picks were. Equal is the rarest guess, so it pays the most, and two Equal picks reach this mode’s maximum: %m your bet.',
	'Only some combinations reach the mode’s maximum. Once your four are picked, the most they can pay is shown above.':
		'Only some combinations reach the mode’s maximum. Once your four are picked, the most they can pay is shown above.',
	Playing: 'Playing',
	'Card 2, 3 or 4': 'Card 2, 3 or 4',
	'A wrong first card ends the round. Later misses keep only 15%, so every correct guess is worth more.':
		'A wrong first card ends the round. Later misses keep only 15%, so every correct guess is worth more.',

	// How to play
	'Guess your way through four cards:': 'Guess your way through four cards:',
	'Color: is card 1 red or black?':
		'Color: is card 1 red or black?',
	'Higher or Lower: is card 2 above or below card 1, or Equal to it?':
		'Higher or Lower: is card 2 above or below card 1, or Equal to it?',
	'Inside or Outside: is card 3 between cards 1 and 2 or outside them, or Equal to one of them?':
		'Inside or Outside: is card 3 between cards 1 and 2 or outside them, or Equal to one of them?',
	'Suit: which suit is card 4?':
		'Suit: which suit is card 4?',
	'Pick all four, set your bet and deal. Each right guess multiplies your win, and four right is a full game win. What a wrong guess costs depends on the game mode; see Game modes below.':
		'Pick all four, set your bet and deal. Each right guess multiplies your win, and four right is a full game win. What a wrong guess costs depends on the game mode; see Game modes below.',
	'Card order': 'Card order',
	'Ace is low and King is high. Suits have no rank: only the card’s value counts for Higher, Lower, Inside and Outside.':
		'Ace is low and King is high. Suits have no rank: only the card’s value counts for Higher, Lower, Inside and Outside.',
	Lowest: 'Lowest',
	Highest: 'Highest',
	'Payouts follow the odds': 'Payouts follow the odds',
	'Each right guess is priced on the cards still in the deck: the less likely it is, the more it pays. So the same guess can pay differently from one round to the next.':
		'Each right guess is priced on the cards still in the deck: the less likely it is, the more it pays. So the same guess can pay differently from one round to the next.',
	'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.':
		'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.',
	// Paytable. The rows themselves are generated from payout.ts; these are the
	// headings and the two pick names that are not already guess-selector labels.
	'Payout table': 'Payout table',
	Card: 'Card',
	Pick: 'Pick',
	Pays: 'Pays',
	'Total':
		'Total',
	'Red or Black': 'Red or Black',
	'Any suit': 'Any suit',
	'These figures are exact: the stages multiply at full precision, and only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded down as it goes, so mid-round it can read a little under them.':
		'These figures are exact: the stages multiply at full precision, and only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded down as it goes, so mid-round it can read a little under them.',
	'If you guess wrong': 'If you guess wrong',
	'Full game wins': 'Full game wins',
	'Turbo and skipping win animations change only what you see, never the cards, the odds or the payout.':
		'Turbo and skipping win animations change only what you see, never the cards, the odds or the payout.',

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
	'Stop autoplay': 'Stop autoplay',
	// %s is substituted at render time - keep it in translations. Deliberately
	// NOT {seconds}: Lingui parses braces as ICU placeholders and, with no
	// value passed, silently renders them as an empty string.
	'Rounds must be %s seconds apart': 'Rounds must be %s seconds apart',
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
	'Could not reach the game server. Check your connection, then reload.':
		'Could not reach the game server. Check your connection, then reload.',
	'Recent rounds':
		'Recent rounds',
	'No rounds yet this session.':
		'No rounds yet this session.',
	'Show recent rounds':
		'Show recent rounds',
	'Plus and minus set your bet. Click the amount for the quick-bet menu.':
		'Plus and minus set your bet. Click the amount for the quick-bet menu.',
	'Bolts show each mode before your Equal picks. Each Equal pick adds one.':
		'Bolts show each mode before your Equal picks. Each Equal pick adds one.',
	'Click to continue':
		'Click to continue',
	'Click to skip':
		'Click to skip',
	'Click the amount for the quick-bet menu.':
		'Click the amount for the quick-bet menu.',
	'These prices assume your forgiveness is unused. After a forgiven miss, the cards that follow are priced as on Classic, a little higher.':
		'These prices assume your forgiveness is unused. After a forgiven miss, the cards that follow are priced as on Classic, a little higher.',
	'The sign at the end of the bar names your game mode. Press it to choose another; switching asks you to confirm first.':
		'The sign at the end of the bar names your game mode. Press it to choose another; switching asks you to confirm first.',
	'Kept':
		'Kept',
	'Won':
		'Won',
	'At stake':
		'At stake',
	'Right':
		'Right',
	'Ace':
		'Ace',
	'King':
		'King',
	'Queen':
		'Queen',
	'Jack':
		'Jack',
	'Hearts':
		'Hearts',
	'Diamonds':
		'Diamonds',
	'Clubs':
		'Clubs',
	'Spades':
		'Spades',
	'%r of %s':
		'%r of %s',
	'Card %n: %c':
		'Card %n: %c',
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
	'Stop autoplay on full game win': 'Stop autoplay on full game win',
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
	'Game mode': 'Game mode',
	Guesses: 'Guesses',
	// The replay panel's caption on a family with no guesses (Three of a Kind:
	// the tokens say what each card had to be), and the round's cost on a mode
	// that multiplies the bet.
	Cards: 'Cards',
	'Round cost': 'Round cost',
	Event: 'Event',
	Payout: 'Payout',
	Play: 'Play',

	// Rule additions (new)
	'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent deal: four cards on the guess modes, three on Three of a Kind.':
		'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent deal: four cards on the guess modes, three on Three of a Kind.',

	// User interaction guide (new)
	Controls: 'Controls',
	'Plus and minus set your bet. Tap the amount for the quick-bet menu.':
		'Plus and minus set your bet. Tap the amount for the quick-bet menu.',
	'The speaker opens the sound settings. Music and game sounds mute separately.':
		'The speaker opens the sound settings. Music and game sounds mute separately.',
	'The i button opens this screen.': 'The i button opens this screen.',
	'The lightning button is Turbo: how fast the cards flip, from Normal to Instant.':
		'The lightning button is Turbo: how fast the cards flip, from Normal to Instant.',
	'The circular arrows open autoplay: the same bet, dealt again for a set number of rounds or without limit. The button counts down the rounds left.':
		'The circular arrows open autoplay: the same bet, dealt again for a set number of rounds or without limit. The button counts down the rounds left.',
	'The big round button deals. So does the spacebar: tap for one round, hold to keep dealing. During autoplay it becomes Stop, and the round in play finishes first.':
		'The big round button deals. So does the spacebar: tap for one round, hold to keep dealing. During autoplay it becomes Stop, and the round in play finishes first.',

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
	'Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either. After Equal on step 2 there is nothing to fall between, so Inside is unavailable.':
		'Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either. After Equal on step 2 there is nothing to fall between, so Inside is unavailable.',
	'Guess the suit of card 4: hearts, diamonds, clubs or spades.':
		'Guess the suit of card 4: hearts, diamonds, clubs or spades.',
	'Skip win animations on autoplay': 'Skip win animations on autoplay',
	'Skip big win animations during autoplay': 'Skip big win animations during autoplay',
	'Your four guesses top out at %s your bet.':
		'Your four guesses top out at %s your bet.',
	'Play Again': 'Play Again',
	'The round ends and pays nothing.':
		'The round ends and pays nothing.',
	'The round ends, and you keep about %s% of your running total.':
		'The round ends, and you keep about %s% of your running total.',
	'From card 2 on, it is forgiven: you keep %s% of your running total and play on.':
		'From card 2 on, it is forgiven: you keep %s% of your running total and play on.',

	// Three of a Kind - the fixed-combination family. 'Any' is the caption on
	// a dealt card's square and its badge on the replay screen; 'Any suit' above
	// is a different key (the four-guess paytable's stage-4 row).
	'Three of a Kind':
		'Three of a Kind',
	'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.':
		'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.',
	'Costs %c× your bet':
		'Costs %c× your bet',
	'Any':
		'Any',
	'Any card':
		'Any card',
	'A card that does not match':
		'A card that does not match',
	'If a card does not match':
		'If a card does not match',
	'Card 1 is dealt, not guessed. The deck holds one Ace, King and Queen of each suit, so card 2 matches 3 times in 11 and card 3 twice in 10.':
		'Card 1 is dealt, not guessed. The deck holds one Ace, King and Queen of each suit, so card 2 matches 3 times in 11 and card 3 twice in 10.',
	'Each figure is the running total after that card, in multiples of your bet, exactly as the board shows it beside the cards. Only the last card pays.':
		'Each figure is the running total after that card, in multiples of your bet, exactly as the board shows it beside the cards. Only the last card pays.',
	'Three of a kind pays %m your bet, about one round in %n.':
		'Three of a kind pays %m your bet, about one round in %n.',
	'%c× your base bet of %b':
		'%c× your base bet of %b',
	'*On %f. Each game mode has its own maximum win, shown in the mode picker and in How to Play.':
		'*On %f. Each game mode has its own maximum win, shown in the mode picker and in How to Play.',
	'That mode costs %c× your bet.':
		'That mode costs %c× your bet.',
	'Card 2 must match card 1':
		'Card 2 must match card 1',
	'Card 3 must match card 1':
		'Card 3 must match card 1',

	// Added 2026-09-23: the reveal's tension pass, How to Play's example round and
	// controls guide, and the per-mode ceiling wording.
	// How to Play's example round: how many cards left land the guess, %n of the %t still in the deck.
	'%n of %t':
		'%n of %t',
	// The readout label while the last card is held because a lot rides on it.
	'Last card':
		'Last card',
	// How to Play: the heading over the dealt example, whose figures are the mode's own.
	'Example round':
		'Example round',
	// The controls guide on a phone, where the bar has no plus and minus - the other line's second sentence alone.
	'Tap the amount for the quick-bet menu.':
		'Tap the amount for the quick-bet menu.',
	// A mode's ceiling as a multiple of the bet, in the picker, its confirmation and How to Play. It read "Max win 1354.2× Bet".
	'Max win %s your bet':
		'Max win %s your bet',
	// The autoplay panel's two stop limits: typed, in times the base bet or in money (game/round/autoplayLimits.ts).
	'Stop on a loss of':
		'Stop on a loss of',
	'Stop on a single win of':
		'Stop on a single win of',
	// How to Play, on a desk only: the keyboard's way to make the four picks (ControlBar.svelte, game/bet/guessKeys.ts).
	'On a keyboard, keys 1 to 4 change the four guesses.':
		'On a keyboard, keys 1 to 4 change the four guesses.',
	// How to Play, the autoplay line's second sentence: the stops that live in its panel.
	'It can stop by itself on a full game win, a loss limit or one big win.':
		'It can stop by itself on a full game win, a loss limit or one big win.',
	// The autoplay limits' unit: the note under the two fields, and the x button's spoken name.
	// BASE bet, not bet: on Three of a Kind a round costs 250x the base bet, and "10x your
	// bet" there read as ten rounds. The x is the multiplier the takeover prints.
	'× means times your base bet.':
		'× means times your base bet.',
	'Times your base bet':
		'Times your base bet',
	// Added 2026-09-27: Last Stop, the fourth guess family - its name, rule, ticket and ceiling line.
	// The fourth guess family's name - picker, tabs, the bar's MODE button, the ticket's band. A bus's last stop: the ride ends on a ticket.
	'Last Stop':
		'Last Stop',
	// Last Stop's one-line rule, in the picker and above its How to Play tab (FAMILY_BLURB.ls). Classic's two sentences, then the ticket that pays the suit card.
	'A wrong first card ends the round. Later misses keep 30% of your running total. A right suit draws a ticket that multiplies it by 2 to 10.':
		'A wrong first card ends the round. Later misses keep 30% of your running total. A right suit draws a ticket that multiplies it by 2 to 10.',
	// The replay details' row for the ticket a Last Stop round drew, and the ticket's spoken name on the board.
	'Ticket':
		'Ticket',
	// How to Play, Last Stop tab: the heading over the stack of 20.
	'The ticket':
		'The ticket',
	// How to Play, Last Stop tab: under The ticket, before the stack.
	'Drawn only when all four are right, from a stack of 20. It multiplies your running total.':
		'Drawn only when all four are right, from a stack of 20. It multiplies your running total.',
	// How to Play, Last Stop tab: above the payout table, whose suit row reads 2.00× – 10.00× - the ticket, not a price.
	'Cards 1 to 3 are priced exactly as on Classic. A right suit draws the ticket in place of a price.':
		'Cards 1 to 3 are priced exactly as on Classic. A right suit draws the ticket in place of a price.',
	// How to Play, Last Stop tab: after the example round, whose last total is the range the ticket decides - what the same four cards end at on Classic.
	'On Classic the same cards end at %s.':
		'On Classic the same cards end at %s.',
	// How to Play, Last Stop tab: Full game wins - the maximum needs the top ticket as well as the two Equals.
	'A full game win pays more the harder your picks were, and the ticket multiplies it. Two Equal picks and a ×10 ticket reach this mode’s maximum: %m your bet.':
		'A full game win pays more the harder your picks were, and the ticket multiplies it. Two Equal picks and a ×10 ticket reach this mode’s maximum: %m your bet.',
	// Added 2026-10-01: the table die.
	// The table die's accessible name (TableDie.svelte) - it picks all four guesses at random.
	'Roll the die for random guesses':
		'Roll the die for random guesses',
	// How to Play, Controls: the line for the table die. Each locale's own words for 'guesses' and 'deal'.
	'The die beside the guesses picks all four at random. Nothing is played until you deal.':
		'The die beside the guesses picks all four at random. Nothing is played until you deal.',
};
