// Finnish. Keys are the English source strings - see en.ts.
export default {
	HOME: 'ETUSIVU',

	Balance: 'Saldo',
	'Last Win': 'Viimeisin voitto',
	Bet: 'Panos',

	Color: 'Väri',
	Higher: 'Suurempi',
	Lower: 'Pienempi',
	Inside: 'Välissä',
	Outside: 'Ulkopuolella',
	Suit: 'Maa',

	Winning: 'Voitto',
	'Full Game Win!': 'Täysi voitto!',
	Banked: 'Turvattu',
	Busted: 'Meni ohi',
	'Revealing…': 'Paljastetaan…',

	Deal: 'Jaa',
	Stop: 'Pysäytä',
	left: 'jäljellä',
	'Pick all 4 guesses': 'Valitse kaikki 4 arvausta',
	'Enter a number of plays': 'Syötä kierrosten määrä',
	'Enter a valid bet': 'Syötä kelvollinen panos',
	'Set rounds': 'Aseta kierrokset',
	Start: 'Aloita',

	'Bet Menu': 'Panosvalikko',
	'Quick bets':
		'Pikapanokset',

	'Turbo Speed': 'Turbonopeus',
	Normal: 'Normaali',
	Instant: 'Välitön',
	'Off: full animation': 'Pois: täysi animaatio',
	'% faster': ' % nopeampi',

	'Sound settings': 'Ääniasetukset',
	Sound: 'Ääni',
	Music: 'Musiikki',
	'Game sounds':
		'Peliäänet',
	'Mute music': 'Mykistä musiikki',
	'Unmute music': 'Palauta musiikki',
	'Mute game sounds': 'Mykistä peliäänet',
	'Unmute game sounds': 'Palauta peliäänet',

	Autoplay: 'Automaattipeli',

	'Game Mode': 'Pelitila',
	'Choose game mode': 'Valitse pelitila',
	Classic: 'Klassinen',
	'Second Chance': 'Toinen mahdollisuus',
	'High Stakes': 'Suuret panokset',
	'This mode costs %c× your bet. Every mode returns the same %s over many rounds; what changes is how often a round pays and how much it can pay.':
		'Tämä tila maksaa %c× panoksesi. Jokainen tila palauttaa saman %s monen kierroksen aikana; vain se muuttuu, kuinka usein kierros maksaa ja kuinka paljon.',
	Forgiven: 'Annettu anteeksi',
	// The intro's tagline and the first line of How to Play's Game modes.
	'%n ways to play': '%n tapaa pelata',
	'There are %n ways to play: every set of picks is its own bet, priced on its own odds.':
		'Pelaamiseen on %n tapaa: jokainen valintayhdistelmä on oma vetonsa, hinnoiteltu omien kertoimiensa mukaan.',
	'Game modes': 'Pelitilat',
	// Confirmation before a bet mode is activated - required by the approval
	// checklist, and worth having anyway: the guess families cost the same but
	// differ in what a miss keeps and how high they reach.
	'Switch mode?': 'Vaihdetaanko tila?',
	Cancel: 'Peruuta',
	Switch: 'Vaihda',
	'Volatility %s of %t': 'Volatiliteetti %s / %t',
	'Return to player (RTP) is %s on every game mode. The most this game can pay is %m your bet, on %f.':
		'Palautusprosentti (RTP) on %s jokaisessa pelitilassa. Eniten tämä peli voi maksaa %m panoksestasi, %f -tilassa.',
	'A wrong first card ends the round. Later misses keep 30% of your running total.':
		'Väärä ensimmäinen kortti päättää kierroksen. Myöhemmät virheet säilyttävät 30% juoksevasta summastasi.',
	'A wrong first card ends the round. After that your first miss is forgiven and play continues.':
		'Väärä ensimmäinen kortti päättää kierroksen. Sen jälkeen ensimmäinen virhe annetaan anteeksi ja peli jatkuu.',
	'Card 1': 'Kortti 1',
	'Your first wrong guess': 'Ensimmäinen virheesi',
	'Your second wrong guess': 'Toinen virheesi',
	'A full game win pays more the harder your picks were. Equal is the rarest guess, so it pays the most, and two Equal picks reach this mode’s maximum: %m your bet.':
		'Täysi voitto maksaa sitä enemmän, mitä vaikeampia valintasi olivat. Yhtä suuri on harvinaisin arvaus, joten se maksaa eniten, ja kaksi Yhtä suuri -valintaa yltää tämän tilan enimmäisvoittoon: %m panoksestasi.',
	'Only some combinations reach the mode’s maximum. Once your four are picked, the most they can pay is shown above.':
		'Vain osa yhdistelmistä yltää tilan enimmäisvoittoon. Kun neljä valintaasi on tehty, niiden suurin mahdollinen voitto näytetään yllä.',
	Playing: 'Pelissä',
	'Card 2, 3 or 4': 'Kortti 2, 3 tai 4',
	'A wrong first card ends the round. Later misses keep only 15%, so every correct guess is worth more.':
		'Väärä ensimmäinen kortti päättää kierroksen. Myöhemmät virheet säilyttävät vain 15%, joten jokainen oikea arvaus on arvokkaampi.',

	'How to Play': 'Näin pelaat',
	'Guess your way through four cards:': 'Arvaa neljä korttia järjestyksessä:',
	'Color: is card 1 red or black?':
		'Väri: onko kortti 1 punainen vai musta?',
	'Higher or Lower: is card 2 above or below card 1, or Equal to it?':
		'Suurempi tai Pienempi: onko kortti 2 korttia 1 suurempi vai pienempi, vai Yhtä suuri?',
	'Inside or Outside: is card 3 between cards 1 and 2 or outside them, or Equal to one of them?':
		'Välissä tai Ulkopuolella: osuuko kortti 3 korttien 1 ja 2 väliin vai niiden ulkopuolelle, vai onko se Yhtä suuri kuin toinen niistä?',
	'Suit: which suit is card 4?':
		'Maa: mikä on kortin 4 maa?',
	'Pick all four, set your bet and deal. Each right guess multiplies your win, and four right is a full game win. What a wrong guess costs depends on the game mode; see Game modes below.':
		'Valitse kaikki neljä, aseta panoksesi ja jaa. Jokainen oikea arvaus kertoo voittosi, ja neljä oikein on täysi voitto. Se, mitä väärä arvaus maksaa, riippuu pelitilasta; katso Pelitilat alta.',
	'Card order': 'Korttien järjestys',
	'Ace is low and King is high. Suits have no rank: only the card’s value counts for Higher, Lower, Inside and Outside.':
		'Ässä on pienin ja kuningas suurin. Mailla ei ole järjestystä: Suurempi, Pienempi, Välissä ja Ulkopuolella katsovat vain kortin arvoa.',
	Lowest: 'Pienin',
	Highest: 'Suurin',
	'Payouts follow the odds': 'Voitot seuraavat todennäköisyyksiä',
	'Each right guess is priced on the cards still in the deck: the less likely it is, the more it pays. So the same guess can pay differently from one round to the next.':
		'Jokainen oikea arvaus hinnoitellaan pakassa vielä olevien korttien mukaan: mitä epätodennäköisempi se on, sitä enemmän se maksaa. Siksi sama arvaus voi maksaa eri tavalla kierroksesta toiseen.',
	'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.':
		'Kun pöydällä on 3, Pienempi maksaa noin %1×, koska vain 8 jäljellä olevasta 51 kortista on pienempiä, kun taas Suurempi maksaa noin %2×, koska niitä on 40. Vaihda kolmonen kahdeksikoksi ja tilanne kääntyy: Pienempi laskee noin %3×:een ja Suurempi nousee noin %4×:een. Yhtä suuri on aina epätodennäköisin, noin %5×.',
	'Payout table': 'Maksutaulukko',
	Card: 'Kortti',
	Pick: 'Valinta',
	Pays: 'Maksaa',
	'Total':
		'Yhteensä',
	'Red or Black': 'Punainen tai musta',
	'Any suit': 'Mikä tahansa maa',
	'These figures are exact: the stages multiply at full precision, and only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded down as it goes, so mid-round it can read a little under them.':
		'Nämä luvut ovat tarkkoja: vaiheet kertautuvat täydellä tarkkuudella, ja vain lopullinen voitto pyöristetään alaspäin yhteen desimaaliin. Korttien vieressä näkyvä juokseva summa pyöristetään alaspäin matkan varrella, joten kierroksen aikana se voi näyttää hieman pienemmältä.',
	'If you guess wrong': 'Jos arvaat väärin',
	'Full game wins': 'Täydet voitot',
	'Turbo and skipping win animations change only what you see, never the cards, the odds or the payout.':
		'Turbo ja voittoanimaatioiden ohitus muuttavat vain sen, mitä näet, eivät koskaan kortteja, todennäköisyyksiä tai voittoa.',

	'Pick a color': 'Valitse väri',
	'Higher, lower, or equal': 'Suurempi, pienempi tai yhtä suuri',
	'Inside, outside, or equal': 'Välissä, ulkopuolella tai yhtä suuri',
	'Pick a suit': 'Valitse maa',
	Red: 'Punainen',
	Black: 'Musta',
	Equal: 'Yhtä suuri',
	'Not possible after guessing Equal': 'Ei mahdollista Yhtä suuri -valinnan jälkeen',
	Heart: 'Hertta',
	Diamond: 'Ruutu',
	Club: 'Risti',
	Spade: 'Pata',
	Mute: 'Mykistä',
	Unmute: 'Poista mykistys',
	'How to play': 'Näin pelaat',
	'Choose bet amount': 'Valitse panoksen suuruus',
	'Custom bet amount': 'Oma panos',
	'Increase bet': 'Kasvata panosta',
	'Decrease bet': 'Pienennä panosta',
	'Turbo speed': 'Turbonopeus',
	'Autoplay settings': 'Automaattipelin asetukset',
	'Stop autoplay': 'Pysäytä automaattipeli',
	'Rounds must be %s seconds apart': 'Kierrosten välillä on oltava %s sekuntia',
	'Round in progress': 'Kierros käynnissä',
	'Insufficient funds': 'Saldo ei riitä',
	'Bet is below the minimum of %s': 'Panos alittaa vähimmäismäärän %s',
	'Bet is above the maximum of %s': 'Panos ylittää enimmäismäärän %s',
	'Bet is locked while autoplay runs': 'Panos on lukittu automaattipelin ajaksi',
	'Mode is locked while autoplay runs': 'Pelitila on lukittu automaattipelin ajaksi',
	'Replays cannot be re-bet': 'Uusintoihin ei voi lyödä uutta panosta',
	'Replay is view-only': 'Uusinta on vain katseltavissa',
	'No active game session': 'Ei aktiivista pelisessiota',
	Error: 'Virhe',
	Reload: 'Lataa uudelleen',
	'Something went wrong. Please try again.': 'Jokin meni pieleen. Yritä uudelleen.',
	'That bet was rejected. Please adjust the amount and try again.':
		'Panos hylättiin. Muuta summaa ja yritä uudelleen.',
	'Not enough balance for that bet.': 'Saldo ei riitä tähän panokseen.',
	'Your session has expired. Please reload the game.':
		'Istuntosi on vanhentunut. Lataa peli uudelleen.',
	'A gambling limit on your account has been reached.': 'Tilisi pelirajoitus on saavutettu.',
	'This game is not available from your location.': 'Tämä peli ei ole käytettävissä sijainnistasi.',
	'The game server had a problem. Please try again shortly.':
		'Pelipalvelimessa oli ongelma. Yritä hetken kuluttua uudelleen.',
	'The game is under maintenance. Please try again shortly.':
		'Peli on huollossa. Yritä hetken kuluttua uudelleen.',
	'Skip the reveal': 'Ohita paljastus',
	'Session information': 'Istunnon tiedot',
	'Net Position': 'Nettotulos',
	RTP: 'RTP',
	Session: 'Istunto',
	Fast: 'Nopea',
	'Number of plays': 'Kierrosten määrä',
	'Unlimited plays': 'Rajattomasti kierroksia',
	'More plays': 'Lisää kierroksia',
	'Fewer plays': 'Vähemmän kierroksia',
	'Stop autoplay on full game win': 'Pysäytä automaattipeli täydellä voitolla',
	'Close menu': 'Sulje valikko',
	Close: 'Sulje',
	'Game information': 'Pelin tiedot',
	Disclaimer: 'Vastuuvapauslauseke',
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.':
		'Toimintahäiriö mitätöi kaikki voitot ja pelit. Vakaa internetyhteys vaaditaan. Jos yhteys katkeaa, lataa peli uudelleen viimeistelläksesi keskeneräiset kierrokset. Odotettu palautus lasketaan monen pelin ajalta. Pelin näkymä ei vastaa mitään fyysistä laitetta ja on vain havainnollistava. Voitot maksetaan Remote Game Serveriltä saadun summan mukaan eikä verkkoselaimen tapahtumien perusteella. TM ja © 2026 Stake Engine.',
	'Loading replay…': 'Ladataan uusintaa…',
	'Loading Ride The Bus…': 'Ladataan Ride The Bus…',
	'Max Win': 'Suurin voitto',
	'Tap to continue': 'Jatka napauttamalla',
	'Round details': 'Kierroksen tiedot',
	'Play amount': 'Panoksen määrä',
	Mode: 'Tila',
	'Game mode': 'Pelitila',
	Guesses: 'Arvaukset',
	Cards: 'Kortit',
	'Round cost': 'Kierroksen hinta',
	Event: 'Tapahtuma',
	Payout: 'Maksu',
	Play: 'Toista',

	// Rule additions (new)
	Controls: 'Ohjaimet',
	'Plus and minus set your bet. Tap the amount for the quick-bet menu.':
		'Plus ja miinus asettavat panoksesi. Napauta summaa avataksesi pikapanosvalikon.',
	'The speaker opens the sound settings. Music and game sounds mute separately.':
		'Kaiutin avaa ääniasetukset. Musiikki ja peliäänet mykistetään erikseen.',
	'The i button opens this screen.': 'i-painike avaa tämän näytön.',
	'The lightning button is Turbo: how fast the cards flip, from Normal to Instant.':
		'Salamapainike on Turbo: kuinka nopeasti kortit kääntyvät, Normaalista Välittömään.',
	'The circular arrows open autoplay: the same bet, dealt again for a set number of rounds or without limit. The button counts down the rounds left.':
		'Kiertävät nuolet avaavat automaattipelin: sama panos jaetaan uudelleen asetetun määrän kierroksia tai rajattomasti. Painike laskee jäljellä olevat kierrokset.',
	'The big round button deals. So does the spacebar: tap for one round, hold to keep dealing. During autoplay it becomes Stop, and the round in play finishes first.':
		'Suuri pyöreä painike jakaa. Niin myös välilyönti: napauta yhtä kierrosta varten, pidä pohjassa jakaaksesi lisää. Automaattipelin aikana siitä tulee Pysäytä, ja käynnissä oleva kierros pelataan ensin loppuun.',
	'Mode opens the game-mode picker. Switching asks you to confirm before it applies.':
		'Tila avaa pelitilan valinnan. Vaihto pyytää vahvistuksen ennen kuin se tulee voimaan.',
	'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent deal: four cards on the guess modes, three on Three of a Kind.':
		'Tässä pelissä ei ole ilmaiskierroksia, bonuskierroksia, jättipotteja eikä uudelleenlaukaisuominaisuuksia. Jokainen kierros on yksittäinen, itsenäinen jako: neljä korttia arvaustiloissa, kolme Kolmoset-tilassa.',
	'Big Win': 'Iso voitto',
	'Huge Win': 'Valtava voitto',
	'Mega Win': 'Megavoitto',
	'Epic Win': 'Eeppinen voitto',
	'Tap to skip': 'Ohita napauttamalla',
	'Skip win animations on autoplay': 'Ohita voittoanimaatiot automaattipelissä',
	'Skip big win animations during autoplay':
		'Ohita suurten voittojen animaatiot automaattipelin aikana',
	'Guess the color of card 1: red or black.': 'Arvaa kortin 1 väri: punainen vai musta.',
	'Guess whether card 2 is higher or lower than card 1, or equal to it.':
		'Arvaa, onko kortti 2 korkeampi vai matalampi kuin kortti 1, vai yhtä suuri.',
	'Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either. After Equal on step 2 there is nothing to fall between, so Inside is unavailable.':
		'Arvaa, osuuko kortti 3 korttien 1 ja 2 väliin, niiden ulkopuolelle vai onko se yhtä suuri kuin jompikumpi. Jos vaiheessa 2 valitsit Yhtä suuri, väliin ei mahdu mitään, joten Välissä ei ole käytettävissä.',
	'Guess the suit of card 4: hearts, diamonds, clubs or spades.':
		'Arvaa kortin 4 maa: hertta, ruutu, risti vai pata.',
	'You guessed Equal, so cards 1 and 2 share a rank. Nothing can fall between them, so Inside cannot win.':
		'Valitsit Yhtä suuri, joten korteilla 1 ja 2 on sama arvo. Niiden väliin ei mahdu mitään, joten Välissä ei voi voittaa.',
	'Your four guesses top out at %s your bet.':
		'Neljä arvaustasi yltävät enintään %s panoksestasi.',
	'Play Again': 'Toista uudelleen',
	'The round ends and pays nothing.':
		'Kierros päättyy eikä maksa mitään.',
	'The round ends, and you keep about %s% of your running total.':
		'Kierros päättyy, ja säilytät noin %s% juoksevasta summastasi.',
	'From card 2 on, it is forgiven: you keep %s% of your running total and play on.':
		'Kortista 2 alkaen se annetaan anteeksi: säilytät %s% juoksevasta summastasi ja peli jatkuu.',

	// Three of a Kind.
	'Three of a Kind':
		'Kolmoset',
	'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.':
		'Kolme korttia 12 kortin pakasta, jossa on ässät, kuninkaat ja kuningattaret. Korttien 2 ja 3 on vastattava korttia 1; mikään vähempi ei maksa mitään.',
	'Costs %c× your bet':
		'Maksaa %c× panoksesi',
	'Any':
		'Mikä tahansa',
	'Any card':
		'Mikä tahansa kortti',
	'A card that does not match':
		'Kortti, joka ei täsmää',
	'If a card does not match':
		'Jos kortti ei täsmää',
	'Card 1 is dealt, not guessed. The deck holds one Ace, King and Queen of each suit, so card 2 matches 3 times in 11 and card 3 twice in 10.':
		'Kortti 1 jaetaan, sitä ei arvata. Pakassa on jokaista maata yksi ässä, kuningas ja rouva, joten kortti 2 täsmää 3 kertaa 11:stä ja kortti 3 kahdesti 10:stä.',
	'Each figure is the running total after that card, in multiples of your bet, exactly as the board shows it beside the cards. Only the last card pays.':
		'Jokainen luku on juokseva summa kyseisen kortin jälkeen panoksesi kerrannaisina, täsmälleen kuten pöytä näyttää sen korttien vieressä. Vain viimeinen kortti maksaa.',
	'Three of a kind pays %m your bet, about one round in %n.':
		'Kolmoset maksaa %m panoksesi, noin yhdellä kierroksella %n:stä.',
	'%c× your base bet of %b':
		'%c× peruspanoksesi %b',
	'*On %f. Each game mode has its own maximum win, shown in the mode picker and in How to Play.':
		'*Tilassa %f. Jokaisella pelitilalla on oma maksimivoittonsa, joka näkyy tilavalinnassa ja Pelin ohjeissa.',
	'That mode costs %c× your bet.':
		'Se tila maksaa %c× panoksesi.',
	'Card 2 must match card 1':
		'Kortin 2 on vastattava korttia 1',
	'Card 3 must match card 1':
		'Kortin 3 on vastattava korttia 1',
	'%n of %t':
		'%n/%t',
	'Last card':
		'Viimeinen kortti',
	'Example round':
		'Esimerkkikierros',
	'Tap the amount for the quick-bet menu.':
		'Napauta summaa avataksesi pikapanosvalikon.',
	'Max win %s your bet':
		'Enimmäisvoitto %s panoksestasi',
	'Stop on a loss of':
		'Pysäytä, kun tappio on',
	'Stop on a single win of':
		'Pysäytä, kun yksittäinen voitto on',
	'On a keyboard, keys 1 to 4 change the four guesses.':
		'Näppäimistöllä näppäimet 1–4 vaihtavat neljä arvausta.',
	'It can stop by itself on a full game win, a loss limit or one big win.':
		'Se voi pysähtyä itsestään täydellä voitolla, tappiorajalla tai yhdellä suurella voitolla.',
	'× means times your base bet.':
		'× tarkoittaa peruspanoksesi kerrannaista.',
	'Times your base bet':
		'Peruspanoksesi kerrannainen',
};
