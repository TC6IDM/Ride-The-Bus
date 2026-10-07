// Spanish. Keys are the English source strings - see en.ts.
export default {
	HOME: 'INICIO',

	Balance: 'Saldo',
	'Last Win': 'Última ganancia',
	Bet: 'Apuesta',

	Color: 'Color',
	Higher: 'Mayor',
	Lower: 'Menor',
	Inside: 'Dentro',
	Outside: 'Fuera',
	Suit: 'Palo',

	Winning: 'Ganancia',
	'Full game win': 'Juego completo',
	Busted: 'Fallaste',
	'Revealing…': 'Revelando…',

	Deal: 'Repartir',
	Stop: 'Parar',
	left: 'restantes',
	'Pick all 4 guesses': 'Elige las 4 predicciones',
	'Enter a number of plays': 'Introduce un número de jugadas',
	'Enter a valid bet': 'Introduce una apuesta válida',
	'Set rounds': 'Definir rondas',
	Start: 'Empezar',

	'Bet menu': 'Menú de apuestas',
	'Quick bets':
		'Apuestas rápidas',

	Normal: 'Normal',
	Instant: 'Instantáneo',
	'Off: full animation': 'Desactivado: animación completa',
	'% faster': ' % más rápido',

	'Sound settings': 'Ajustes de sonido',
	Sound: 'Sonido',
	Music: 'Música',
	'Game sounds':
		'Sonidos del juego',
	'Mute music': 'Silenciar música',
	'Unmute music': 'Activar música',
	'Mute game sounds': 'Silenciar sonidos del juego',
	'Unmute game sounds': 'Activar sonidos del juego',

	Autoplay: 'Juego automático',

	'Choose game mode': 'Elegir modo de juego',
	Classic: 'Clásico',
	'Second Chance': 'Segunda oportunidad',
	'High Stakes': 'Apuesta alta',
	'This mode costs %c× your bet. Every mode returns the same %s over many rounds; what changes is how often a round pays and how much it can pay.':
		'Este modo cuesta %c× tu apuesta. Todos los modos devuelven el mismo %s a lo largo de muchas rondas; lo que cambia es con qué frecuencia paga una ronda y cuánto puede pagar.',
	Forgiven: 'Perdonado',
	// The intro's tagline and the first line of How to Play's Game modes.
	'%n ways to play': '%n formas de jugar',
	'There are %n ways to play: every set of picks is its own bet, priced on its own odds.':
		'Hay %n formas de jugar: cada combinación de elecciones es una apuesta propia, con el precio de sus propias probabilidades.',
	'Game modes': 'Modos de juego',
	// Confirmation before a bet mode is activated - required by the approval
	// checklist, and worth having anyway: the guess families cost the same but
	// differ in what a miss keeps and how high they reach.
	'Switch mode?': '¿Cambiar de modo?',
	Cancel: 'Cancelar',
	Switch: 'Cambiar',
	'Volatility %s of %t': 'Volatilidad %s de %t',
	'Return to player (RTP) is %s on every game mode. The most this game can pay is %m your bet, on %f.':
		'El retorno al jugador (RTP) es del %s en todos los modos. Lo máximo que puede pagar este juego es %m tu apuesta, en %f.',
	'A wrong first card ends the round. Later misses keep 30% of your running total.':
		'Fallar la primera carta termina la ronda. Los fallos posteriores conservan el 30% de tu total acumulado.',
	'A wrong first card ends the round. After that your first miss is forgiven and play continues.':
		'Fallar la primera carta termina la ronda. Después, tu primer fallo se perdona y el juego continúa.',
	'Card 1': 'Carta 1',
	'Your first wrong guess': 'Tu primer fallo',
	'Your second wrong guess': 'Tu segundo fallo',
	'A full game win pays more the harder your picks were. Equal is the rarest guess, so it pays the most, and two Equal picks reach this mode’s maximum: %m your bet.':
		'Un juego completo paga más cuanto más difíciles eran tus predicciones. Igual es la predicción más rara, así que paga más, y dos Igual alcanzan el máximo de este modo: %m tu apuesta.',
	'Only some combinations reach the mode’s maximum. Once your four are picked, the most they can pay is shown above.':
		'Solo algunas combinaciones alcanzan el máximo del modo. Una vez elegidas tus cuatro, lo máximo que pueden pagar se muestra arriba.',
	Playing: 'En juego',
	'Card 2, 3 or 4': 'Carta 2, 3 o 4',
	'A wrong first card ends the round. Later misses keep only 15%, so every correct guess is worth more.':
		'Fallar la primera carta termina la ronda. Los fallos posteriores conservan solo el 15%, así que cada acierto vale más.',

	'Guess your way through four cards:': 'Adivina las cuatro cartas, una a una:',
	'Color: is card 1 red or black?':
		'Color: ¿la carta 1 es roja o negra?',
	'Higher or Lower: is card 2 above or below card 1, or Equal to it?':
		'Mayor o Menor: ¿la carta 2 está por encima o por debajo de la carta 1, o es Igual?',
	'Inside or Outside: is card 3 between cards 1 and 2 or outside them, or Equal to one of them?':
		'Dentro o Fuera: ¿la carta 3 cae entre las cartas 1 y 2 o fuera de ellas, o es Igual a una de ellas?',
	'Suit: which suit is card 4?':
		'Palo: ¿de qué palo es la carta 4?',
	'Pick all four, set your bet and deal. Each right guess multiplies your win, and four right is a full game win. What a wrong guess costs depends on the game mode; see Game modes below.':
		'Elige las cuatro, fija tu apuesta y reparte. Cada acierto multiplica tu ganancia, y cuatro aciertos son un juego completo. Lo que cuesta un fallo depende del modo de juego; consulta Modos de juego más abajo.',
	'Card order': 'Orden de las cartas',
	'Ace is low and King is high. Suits have no rank: only the card’s value counts for Higher, Lower, Inside and Outside.':
		'El as es la más baja y el rey la más alta. Los palos no tienen rango: solo cuenta el valor de la carta para Mayor, Menor, Dentro y Fuera.',
	Lowest: 'Más baja',
	Highest: 'Más alta',
	'Payouts follow the odds': 'Los pagos siguen las probabilidades',
	'Each right guess is priced on the cards still in the deck: the less likely it is, the more it pays. So the same guess can pay differently from one round to the next.':
		'Cada acierto se valora según las cartas que quedan en la baraja: cuanto menos probable, más paga. Así, la misma predicción puede pagar distinto de una ronda a otra.',
	'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.':
		'Con un 3 sobre la mesa, Menor paga unas %1× porque solo 8 de las 51 cartas restantes son menores, mientras que Mayor paga unas %2× porque 40 lo son. Cambia ese 3 por un 8 y se invierte: Menor baja a unas %3× y Mayor sube a unas %4×. Igual es siempre la apuesta más difícil, con unas %5×.',
	'Payout table': 'Tabla de pagos',
	Card: 'Carta',
	Pick: 'Elección',
	Pays: 'Paga',
	'Total':
		'Acumulado',
	'Red or Black': 'Rojo o negro',
	'Any suit': 'Cualquier palo',
	'These figures are exact: the stages multiply at full precision, and only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded down as it goes, so mid-round it can read a little under them.':
		'Estas cifras son exactas: las etapas se multiplican con precisión total y solo el pago final se redondea hacia abajo, a un decimal. El total acumulado junto a las cartas se redondea hacia abajo sobre la marcha, así que durante la ronda puede verse algo por debajo.',
	'If you guess wrong': 'Si fallas',
	'Full game wins': 'Juegos completos',
	'Turbo and skipping win animations change only what you see, never the cards, the odds or the payout.':
		'El Turbo y saltar las animaciones de ganancia solo cambian lo que ves, nunca las cartas, las probabilidades ni el pago.',

	'Pick a color': 'Elige un color',
	'Higher, lower, or equal': 'Mayor, menor o igual',
	'Inside, outside, or equal': 'Dentro, fuera o igual',
	'Pick a suit': 'Elige un palo',
	Red: 'Rojo',
	Black: 'Negro',
	Equal: 'Igual',
	'Not possible after guessing Equal': 'No es posible tras elegir Igual',
	Heart: 'Corazones',
	Diamond: 'Diamantes',
	Club: 'Tréboles',
	Spade: 'Picas',
	Mute: 'Silenciar',
	Unmute: 'Activar sonido',
	'How to play': 'Cómo jugar',
	'Choose bet amount': 'Elegir importe de la apuesta',
	'Custom bet amount': 'Importe personalizado',
	'Increase bet': 'Aumentar apuesta',
	'Decrease bet': 'Reducir apuesta',
	'Turbo speed': 'Velocidad turbo',
	'Autoplay settings': 'Ajustes del juego automático',
	'Stop autoplay': 'Parar el juego automático',
	'Rounds must be %s seconds apart': 'Las rondas deben separarse %s segundos',
	'Round in progress': 'Ronda en curso',
	'Insufficient funds': 'Saldo insuficiente',
	'Bet is below the minimum of %s': 'La apuesta está por debajo del mínimo de %s',
	'Bet is above the maximum of %s': 'La apuesta supera el máximo de %s',
	'Bet is locked while autoplay runs': 'La apuesta está bloqueada mientras se ejecuta el juego automático',
	'Mode is locked while autoplay runs': 'El modo de juego está bloqueado mientras se ejecuta el juego automático',
	'Replays cannot be re-bet': 'Las repeticiones no se pueden volver a apostar',
	'Replay is view-only': 'La repetición es solo de lectura',
	'No active game session': 'No hay sesión de juego activa',
	Error: 'Error',
	Reload: 'Recargar',
	'Something went wrong. Please try again.': 'Algo salió mal. Inténtalo de nuevo.',
	'That bet was rejected. Please adjust the amount and try again.':
		'Esa apuesta fue rechazada. Ajusta el importe e inténtalo de nuevo.',
	'Not enough balance for that bet.': 'Saldo insuficiente para esa apuesta.',
	'Your session has expired. Please reload the game.': 'Tu sesión ha caducado. Recarga el juego.',
	'Could not reach the game server. Check your connection, then reload.':
		'No se pudo conectar con el servidor del juego. Comprueba tu conexión y recarga.',
	'Recent rounds':
		'Rondas recientes',
	'No rounds yet this session.':
		'Aún no hay rondas en esta sesión.',
	'Show recent rounds':
		'Mostrar rondas recientes',
	'Plus and minus set your bet. Click the amount for the quick-bet menu.':
		'Más y menos fijan tu apuesta. Haz clic en el importe para abrir el menú de apuestas rápidas.',
	'Bolts show each mode before your Equal picks. Each Equal pick adds one.':
		'Los rayos muestran cada modo antes de tus elecciones de Igual. Cada Igual suma uno.',
	'Click to continue':
		'Haz clic para continuar',
	'Click to skip':
		'Haz clic para saltar',
	'Click the amount for the quick-bet menu.':
		'Haz clic en el importe para abrir el menú de apuestas rápidas.',
	'These prices assume your forgiveness is unused. After a forgiven miss, the cards that follow are priced as on Classic, a little higher.':
		'Estos precios suponen que el perdón no se ha usado. Tras un fallo perdonado, las cartas siguientes se pagan como en Clásico, algo más.',
	'The sign at the end of the bar names your game mode. Press it to choose another; switching asks you to confirm first.':
		'El letrero al final de la barra muestra tu modo de juego. Púlsalo para elegir otro; cambiar pide confirmación primero.',
	'Kept':
		'Conservado',
	'Won':
		'Ganaste',
	'At stake':
		'En juego',
	'Right':
		'Acierto',
	'Ace':
		'As',
	'King':
		'Rey',
	'Queen':
		'Reina',
	'Jack':
		'Jota',
	'Hearts':
		'Corazones',
	'Diamonds':
		'Diamantes',
	'Clubs':
		'Tréboles',
	'Spades':
		'Picas',
	'%r of %s':
		'%r de %s',
	'Card %n: %c':
		'Carta %n: %c',
	'A gambling limit on your account has been reached.':
		'Se ha alcanzado un límite de juego de tu cuenta.',
	'This game is not available from your location.':
		'Este juego no está disponible desde tu ubicación.',
	'The game server had a problem. Please try again shortly.':
		'El servidor del juego tuvo un problema. Inténtalo de nuevo en breve.',
	'The game is under maintenance. Please try again shortly.':
		'El juego está en mantenimiento. Inténtalo de nuevo en breve.',
	'Skip the reveal': 'Saltar la revelación',
	'Session information': 'Información de la sesión',
	'Net Position': 'Posición neta',
	RTP: 'RTP',
	Session: 'Sesión',
	Fast: 'Rápido',
	'Number of plays': 'Número de rondas',
	'Unlimited plays': 'Rondas ilimitadas',
	'More plays': 'Más rondas',
	'Fewer plays': 'Menos rondas',
	'Stop autoplay on full game win': 'Parar el juego automático al ganar el juego completo',
	'Close menu': 'Cerrar menú',
	Close: 'Cerrar',
	'Game information': 'Información del juego',
	Disclaimer: 'Aviso legal',
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.':
		'Cualquier fallo anula todas las ganancias y jugadas. Se requiere una conexión a internet estable. En caso de desconexión, vuelve a cargar el juego para terminar las rondas incompletas. El retorno esperado se calcula a lo largo de muchas jugadas. La representación del juego no corresponde a ningún dispositivo físico y es solo ilustrativa. Las ganancias se liquidan según el importe recibido del Remote Game Server y no según los eventos del navegador web. TM y © 2026 Stake Engine.',
	'Loading replay…': 'Cargando repetición…',
	'Loading Ride The Bus…': 'Cargando Ride The Bus…',
	'Max Win': 'Ganancia máx.',
	'Tap to continue': 'Toca para continuar',
	'Round details': 'Detalles de la ronda',
	'Play amount': 'Importe de la apuesta',
	'Game mode': 'Modo de juego',
	Guesses: 'Apuestas',
	Cards: 'Cartas',
	'Round cost': 'Coste de la ronda',
	Event: 'Evento',
	Payout: 'Pago',
	Play: 'Reproducir',

	// Rule additions (new)
	Controls: 'Controles',
	'Plus and minus set your bet. Tap the amount for the quick-bet menu.':
		'Más y menos fijan tu apuesta. Toca el importe para abrir el menú de apuestas rápidas.',
	'The speaker opens the sound settings. Music and game sounds mute separately.':
		'El altavoz abre los ajustes de sonido. La música y los sonidos del juego se silencian por separado.',
	'The i button opens this screen.': 'El botón i abre esta pantalla.',
	'The lightning button is Turbo: how fast the cards flip, from Normal to Instant.':
		'El botón del rayo es el Turbo: la velocidad a la que se voltean las cartas, de Normal a Instantáneo.',
	'The circular arrows open autoplay: the same bet, dealt again for a set number of rounds or without limit. The button counts down the rounds left.':
		'Las flechas circulares abren el juego automático: la misma apuesta, repartida de nuevo durante un número fijo de rondas o sin límite. El botón cuenta las rondas que quedan.',
	'The big round button deals. So does the spacebar: tap for one round, hold to keep dealing. During autoplay it becomes Stop, and the round in play finishes first.':
		'El botón redondo grande reparte. La barra espaciadora también: púlsala para una ronda o mantenla para seguir repartiendo. Durante el juego automático se convierte en Parar y la ronda en curso termina primero.',
	'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent deal: four cards on the guess modes, three on Three of a Kind.':
		'Este juego no tiene giros gratis, rondas de bonificación, botes ni funciones de reactivación. Cada ronda es un único reparto independiente: cuatro cartas en los modos de predicción, tres en Trío.',
	'Big Win': 'Gran Ganancia',
	'Huge Win': 'Ganancia Enorme',
	'Mega Win': 'Mega Ganancia',
	'Epic Win': 'Ganancia Épica',
	'Tap to skip': 'Toca para saltar',
	'Skip win animations on autoplay': 'Saltar animaciones de ganancia en juego automático',
	'Skip big win animations during autoplay':
		'Saltar las animaciones de grandes ganancias durante el juego automático',
	'Guess the color of card 1: red or black.': 'Adivina el color de la carta 1: rojo o negro.',
	'Guess whether card 2 is higher or lower than card 1, or equal to it.':
		'Adivina si la carta 2 es mayor o menor que la carta 1, o igual a ella.',
	'Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either. After Equal on step 2 there is nothing to fall between, so Inside is unavailable.':
		'Predice si la carta 3 cae entre las cartas 1 y 2, fuera de ellas, o es igual a una de las dos. Tras Igual en el paso 2 no hay nada que pueda caer entre ellas, así que Dentro no está disponible.',
	'Guess the suit of card 4: hearts, diamonds, clubs or spades.':
		'Adivina el palo de la carta 4: corazones, diamantes, tréboles o picas.',
	'You guessed Equal, so cards 1 and 2 share a rank. Nothing can fall between them, so Inside cannot win.':
		'Elegiste Igual, así que las cartas 1 y 2 tienen el mismo valor. Nada puede caer entre ellas, por lo que Dentro no puede ganar.',
	'Your four guesses top out at %s your bet.':
		'Tus cuatro predicciones alcanzan como máximo %s de tu apuesta.',
	'Play Again': 'Reproducir de nuevo',
	'The round ends and pays nothing.':
		'La ronda termina y no paga nada.',
	'The round ends, and you keep about %s% of your running total.':
		'La ronda termina y conservas aproximadamente el %s% de tu total acumulado.',
	'From card 2 on, it is forgiven: you keep %s% of your running total and play on.':
		'A partir de la carta 2 se perdona: conservas el %s% de tu total acumulado y sigues jugando.',

	// Three of a Kind.
	'Three of a Kind':
		'Trío',
	'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.':
		'Tres cartas de una baraja de 12 con ases, reyes y reinas. Las cartas 2 y 3 deben coincidir con la carta 1; cualquier otra cosa no paga nada.',
	'Costs %c× your bet':
		'Cuesta %c× tu apuesta',
	'Any':
		'Cualquiera',
	'Any card':
		'Cualquier carta',
	'A card that does not match':
		'Una carta que no coincide',
	'If a card does not match':
		'Si una carta no coincide',
	'Card 1 is dealt, not guessed. The deck holds one Ace, King and Queen of each suit, so card 2 matches 3 times in 11 and card 3 twice in 10.':
		'La carta 1 se reparte, no se adivina. La baraja tiene un as, un rey y una reina de cada palo, así que la carta 2 coincide 3 veces de 11 y la carta 3, 2 veces de 10.',
	'Each figure is the running total after that card, in multiples of your bet, exactly as the board shows it beside the cards. Only the last card pays.':
		'Cada cifra es el total acumulado tras esa carta, en múltiplos de tu apuesta, tal como lo muestra la mesa junto a las cartas. Solo la última carta paga.',
	'Three of a kind pays %m your bet, about one round in %n.':
		'El trío paga %m tu apuesta, aproximadamente una ronda de cada %n.',
	'%c× your base bet of %b':
		'%c× tu apuesta base de %b',
	'*On %f. Each game mode has its own maximum win, shown in the mode picker and in How to Play.':
		'*En %f. Cada modo de juego tiene su propio premio máximo, indicado en el selector de modo y en Cómo jugar.',
	'That mode costs %c× your bet.':
		'Ese modo cuesta %c× tu apuesta.',
	'Card 2 must match card 1':
		'La carta 2 debe coincidir con la carta 1',
	'Card 3 must match card 1':
		'La carta 3 debe coincidir con la carta 1',
	'%n of %t':
		'%n de %t',
	'Last card':
		'Última carta',
	'Example round':
		'Ronda de ejemplo',
	'Tap the amount for the quick-bet menu.':
		'Toca el importe para abrir el menú de apuestas rápidas.',
	'Max win %s your bet':
		'Ganancia máxima %s de tu apuesta',
	'Stop on a loss of':
		'Detener con una pérdida de',
	'Stop on a single win of':
		'Detener con una sola ganancia de',
	'On a keyboard, keys 1 to 4 change the four guesses.':
		'Con el teclado, las teclas 1 a 4 cambian las cuatro predicciones.',
	'It can stop by itself on a full game win, a loss limit or one big win.':
		'Puede parar solo al ganar el juego completo, al llegar a un límite de pérdidas o con una sola ganancia grande.',
	'× means times your base bet.':
		'× significa veces tu apuesta base.',
	'Times your base bet':
		'Veces tu apuesta base',
	'Last Stop':
		'Última parada',
	'A wrong first card ends the round. Later misses keep 30% of your running total. A right suit draws a ticket that multiplies it by 2 to 10.':
		'Fallar la primera carta termina la ronda. Los fallos posteriores conservan el 30% de tu total acumulado. Acertar el palo saca un billete que lo multiplica de 2 a 10 veces.',
	'Ticket':
		'Billete',
	'The ticket':
		'El billete',
	'Drawn only when all four are right, from a stack of 20. It multiplies your running total.':
		'Solo se saca cuando aciertas las cuatro, de un montón de 20. Multiplica tu total acumulado.',
	'Cards 1 to 3 are priced exactly as on Classic. A right suit draws the ticket in place of a price.':
		'Las cartas 1 a 3 tienen exactamente el mismo precio que en Clásico. Acertar el palo saca el billete en lugar de un precio.',
	'On Classic the same cards end at %s.':
		'En Clásico, las mismas cartas terminan en %s.',
	'A full game win pays more the harder your picks were, and the ticket multiplies it. Two Equal picks and a ×10 ticket reach this mode’s maximum: %m your bet.':
		'Un juego completo paga más cuanto más difíciles eran tus predicciones, y el billete lo multiplica. Dos Igual y un billete ×10 alcanzan el máximo de este modo: %m tu apuesta.',
	'Roll the die for random guesses':
		'Tira el dado para predicciones al azar',
	'The die beside the guesses picks all four at random. Nothing is played until you deal.':
		'El dado junto a las predicciones elige las cuatro al azar. No se juega nada hasta que repartes.',
};
