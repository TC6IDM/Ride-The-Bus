// Russian. Keys are the English source strings - see en.ts.
export default {
	HOME: 'ГЛАВНАЯ',

	Balance: 'Баланс',
	'Last Win': 'Последний выигрыш',
	Bet: 'Ставка',

	Color: 'Цвет',
	Higher: 'Больше',
	Lower: 'Меньше',
	Inside: 'Внутри',
	Outside: 'Снаружи',
	Suit: 'Масть',

	Winning: 'Выигрыш',
	'Full Game Win!': 'Полная победа!',
	Banked: 'Сохранено',
	Busted: 'Проигрыш',
	'Revealing…': 'Открываем…',

	Deal: 'Сдать',
	Stop: 'Стоп',
	left: 'осталось',
	'Pick all 4 guesses': 'Выберите все 4 прогноза',
	'Enter a number of plays': 'Укажите количество раундов',
	'Enter a valid bet': 'Введите корректную ставку',
	'Set rounds': 'Задать раунды',
	Start: 'Старт',

	'Bet Menu': 'Меню ставок',
	'Quick Bets': 'Быстрые ставки',

	'Turbo Speed': 'Скорость турбо',
	Normal: 'Обычная',
	Instant: 'Мгновенная',
	'Off: full animation': 'Выкл.: полная анимация',
	'% faster': ' % быстрее',

	'Sound settings': 'Настройки звука',
	Sound: 'Звук',
	Music: 'Музыка',
	'Game Sounds': 'Звуки игры',
	'Mute music': 'Выключить музыку',
	'Unmute music': 'Включить музыку',
	'Mute game sounds': 'Выключить звуки игры',
	'Unmute game sounds': 'Включить звуки игры',

	Autoplay: 'Автоигра',
	'Number of Plays': 'Количество раундов',

	Advanced: 'Дополнительно',
	'Game Mode': 'Режим игры',
	'Choose game mode': 'Выбрать режим игры',
	Classic: 'Классический',
	'Second Chance': 'Второй шанс',
	'High Stakes': 'Высокие ставки',
	'This mode costs %c× your bet. Every mode returns the same %s over many rounds; what changes is how often a round pays and how much it can pay.':
		'Этот режим стоит %c× вашей ставки. Каждый режим возвращает те же %s за множество раундов; меняется лишь то, как часто раунд платит и сколько он может заплатить.',
	Forgiven: 'Прощено',
	// The intro's tagline and the first line of How to Play's Game modes.
	'%n ways to play': '%n способов играть',
	'Every combination of picks on a guess mode is its own bet, priced on its own odds.':
		'Каждая комбинация выборов в режиме угадывания — отдельная ставка, оценённая по своим собственным шансам.',
	'Game modes': 'Режимы игры',
	// Confirmation before a bet mode is activated - required by the approval
	// checklist, and worth having anyway: the guess families cost the same but
	// differ in what a miss keeps and how high they reach.
	'Switch mode?': 'Сменить режим?',
	Cancel: 'Отмена',
	Switch: 'Сменить',
	'Volatility %s of %t': 'Волатильность %s из %t',
	'Return to player (RTP) is %s on every game mode. The most this game can pay is %m your bet, on %f.':
		'Возврат игроку (RTP) составляет %s в каждом режиме. Максимум, который может выплатить игра, равен %m вашей ставки в режиме %f.',
	'A wrong first card ends the round. Later misses keep 30% of what you had built.':
		'Ошибка на первой карте завершает раунд. Последующие промахи сохраняют 30% накопленного.',
	'A wrong first card ends the round. After that your first miss is forgiven and play continues.':
		'Ошибка на первой карте завершает раунд. После неё первый промах прощается и игра продолжается.',
	'Card 1': 'Карта 1',
	'Your first wrong guess': 'Ваш первый промах',
	'Your second wrong guess': 'Ваш второй промах',
	'Guess all four right and the payout depends on how hard your picks were. Equal is the rarest guess, so rounds built on it pay the most; two Equal picks together is the most this mode can pay, at %m your bet.':
		'Угадайте все четыре, и выплата зависит от того, насколько сложными были ваши выборы. «Равно» является самым редким прогнозом, поэтому раунды на его основе платят больше всего; два «Равно» вместе дают максимум этого режима, %m вашей ставки.',
	'Only some guess combinations reach a mode’s maximum. Once your four are picked, their own ceiling is shown above.':
		'Лишь некоторые сочетания прогнозов достигают максимума режима. Когда все четыре выбраны, их собственный потолок показывается выше.',
	Playing: 'В игре',
	'Card 2, 3 or 4': 'Карта 2, 3 или 4',
	'A wrong first card ends the round. Later misses keep only 15%, so every correct guess is worth more.':
		'Ошибка на первой карте завершает раунд. Последующие промахи сохраняют лишь 15%, поэтому каждая верная догадка стоит дороже.',

	'How to Play': 'Как играть',
	'Guess your way through four cards:': 'Угадайте четыре карты подряд:',
	'Color: red or black for card 1.': 'Цвет: красная или чёрная для карты 1.',
	'Higher / Lower: versus card 1 (or =).': 'Больше / Меньше: относительно карты 1 (или =).',
	'Inside / Outside: between cards 1 & 2 (or =).': 'Внутри / Снаружи: между картами 1 и 2 (или =).',
	'Suit: the suit of card 4.': 'Масть: масть карты 4.',
	'Pick all four, set your bet and deal. Each right guess multiplies your win; get all four for a full game win. What a wrong guess costs you depends on the game mode, explained below.':
		'Выберите все четыре, задайте ставку и сдавайте. Каждый верный прогноз умножает выигрыш; угадайте все четыре, и это полная победа. Чего стоит промах, зависит от режима игры, см. ниже.',
	'Card order': 'Порядок карт',
	'Ace is low and King is high. Suit never affects rank: only the number counts for Higher / Lower and Inside / Outside.':
		'Туз является самой младшей картой, а король самой старшей. Масть никогда не влияет на старшинство: для «Больше / Меньше» и «Внутри / Снаружи» важно только значение.',
	Lowest: 'Младшая',
	Highest: 'Старшая',
	'Payouts follow the odds': 'Выплаты зависят от вероятности',
	'Every correct guess pays its true odds against the cards left in the deck, so the less likely your pick, the more it pays, and the same guess can pay differently from one round to the next.':
		'Каждый верный прогноз оплачивается по его реальной вероятности относительно карт, оставшихся в колоде: чем менее вероятен ваш выбор, тем больше выплата, и один и тот же прогноз может платить по-разному от раунда к раунду.',
	'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.':
		'Если на столе тройка, «Меньше» платит около %1×, потому что лишь 8 из 51 оставшейся карты младше, а «Больше» около %2×, потому что таких карт 40. Замените тройку на восьмёрку, и всё меняется: «Меньше» падает примерно до %3×, а «Больше» растёт до %4×. «Равно» всегда самый маловероятный вариант, около %5×.',
	'Payout table': 'Таблица выплат',
	Card: 'Карта',
	Pick: 'Выбор',
	Pays: 'Выплата',
	'Total':
		'Итого',
	'Red or Black': 'Красная или чёрная',
	'Any suit': 'Любая масть',
	'Stages multiply together at full precision, so the figures above are exact. Only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded the same way at each step, so mid-round it can read slightly under these figures.':
		'Этапы перемножаются с полной точностью, поэтому цифры выше точные. Округляется вниз, до одного знака после запятой, только итоговая выплата. Текущая сумма рядом с картами округляется так же на каждом шаге, поэтому по ходу раунда она может выглядеть чуть меньше этих значений.',
	'If you guess wrong': 'Если вы ошиблись',
	'Full game wins': 'Полные победы',
	'Speed and skip settings change only what you see, never the cards, the odds or the payout.':
		'Настройки скорости и пропуска меняют только то, что вы видите, но никогда не карты, шансы или выплату.',

	'Pick a color': 'Выберите цвет',
	'Higher, lower, or equal': 'Больше, меньше или равно',
	'Inside, outside, or equal': 'Внутри, снаружи или равно',
	'Pick a suit': 'Выберите масть',
	Red: 'Красный',
	Black: 'Чёрный',
	Equal: 'Равно',
	'Not possible after guessing Equal': 'Невозможно после выбора «Равно»',
	Heart: 'Червы',
	Diamond: 'Бубны',
	Club: 'Трефы',
	Spade: 'Пики',
	Mute: 'Выключить звук',
	Unmute: 'Включить звук',
	'How to play': 'Как играть',
	'Choose bet amount': 'Выбрать размер ставки',
	'Custom bet amount': 'Своя ставка',
	'Increase bet': 'Увеличить ставку',
	'Decrease bet': 'Уменьшить ставку',
	'Turbo speed': 'Скорость турбо',
	'Autoplay settings': 'Настройки автоигры',
	'Advanced settings': 'Дополнительные настройки',
	'Stop autoplay': 'Остановить автоигру',
	'Rounds must be %s seconds apart': 'Между раундами должно пройти %s с',
	'Round in progress': 'Раунд идёт',
	'Insufficient funds': 'Недостаточно средств',
	'Bet is below the minimum of %s': 'Ставка ниже минимума %s',
	'Bet is above the maximum of %s': 'Ставка выше максимума %s',
	'Bet is locked while autoplay runs': 'Ставка заблокирована во время автоигры',
	'Mode is locked while autoplay runs': 'Режим игры заблокирован во время автоигры',
	'Replays cannot be re-bet': 'На повтор нельзя сделать ставку заново',
	'Replay is view-only': 'Повтор только для просмотра',
	'No active game session': 'Нет активной игровой сессии',
	Error: 'Ошибка',
	Reload: 'Перезагрузить',
	'Something went wrong. Please try again.': 'Что-то пошло не так. Попробуйте ещё раз.',
	'That bet was rejected. Please adjust the amount and try again.':
		'Ставка отклонена. Измените сумму и попробуйте ещё раз.',
	'Not enough balance for that bet.': 'Недостаточно средств для этой ставки.',
	'Your session has expired. Please reload the game.': 'Сессия истекла. Перезагрузите игру.',
	'A gambling limit on your account has been reached.': 'Достигнут игровой лимит вашего аккаунта.',
	'This game is not available from your location.': 'Эта игра недоступна в вашем регионе.',
	'The game server had a problem. Please try again shortly.':
		'На игровом сервере произошла ошибка. Попробуйте немного позже.',
	'The game is under maintenance. Please try again shortly.':
		'Игра на техническом обслуживании. Попробуйте немного позже.',
	'Skip the reveal': 'Пропустить открытие',
	'Session information': 'Сведения о сессии',
	'Net Position': 'Чистый результат',
	RTP: 'RTP',
	Session: 'Сессия',
	Fast: 'Быстро',
	'Number of plays': 'Количество раундов',
	'Unlimited plays': 'Без ограничения раундов',
	'More plays': 'Больше раундов',
	'Fewer plays': 'Меньше раундов',
	'Stop autoplay on full game win': 'Останавливать автоигру при полной победе',
	'Close menu': 'Закрыть меню',
	Close: 'Закрыть',
	'Game information': 'Информация об игре',
	Disclaimer: 'Отказ от ответственности',
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.':
		'Сбой аннулирует все выигрыши и игры. Требуется стабильное интернет-соединение. При разрыве соединения перезагрузите игру, чтобы завершить незаконченные раунды. Ожидаемый возврат рассчитывается на большом числе игр. Экран игры не изображает какое-либо физическое устройство и приведён только для иллюстрации. Выигрыши рассчитываются по сумме, полученной от Remote Game Server, а не по событиям в браузере. TM и © 2026 Stake Engine.',
	'Loading replay…': 'Загрузка повтора…',
	'Loading Ride The Bus…': 'Загрузка Ride The Bus…',
	'Max Win': 'Макс. выигрыш',
	'Tap to continue': 'Нажмите, чтобы продолжить',
	'Round details': 'Детали раунда',
	'Play amount': 'Сумма ставки',
	Mode: 'Режим',
	'Game mode': 'Режим игры',
	Guesses: 'Прогнозы',
	Cards: 'Карты',
	'Round cost': 'Стоимость раунда',
	Event: 'Событие',
	Payout: 'Выплата',
	Play: 'Воспроизвести',

	// Rule additions (new)
	Controls: 'Управление',
	'Plus and minus set your bet. Tap the amount for the quick-bet menu.':
		'Плюс и минус задают ставку. Нажмите на сумму, чтобы открыть меню быстрых ставок.',
	'The speaker opens the sound settings. Music and game sounds mute separately.':
		'Динамик открывает настройки звука. Музыка и звуки игры отключаются по отдельности.',
	'The i button opens this screen.': 'Кнопка i открывает этот экран.',
	'The lightning button is Turbo: how fast the cards flip, from Normal to Instant.':
		'Кнопка с молнией включает Турбо: скорость переворота карт, от Обычной до Мгновенной.',
	'The circular arrows open autoplay, which deals the same bet again for a set number of rounds or unlimited. The counter sits on the button while it runs.':
		'Круговые стрелки открывают автоигру, которая повторяет ту же ставку заданное число раундов или без ограничения. Счётчик отображается на кнопке во время работы.',
	'The sliders button holds two autoplay options: stop on a full game win, and skip the win animations.':
		'Кнопка с ползунками содержит две настройки автоигры: остановка при полной победе и пропуск анимаций выигрыша.',
	'The large round button deals the round. So does the spacebar: tap for one round, hold to keep dealing. While autoplay runs the button becomes Stop, and the round in play finishes first.':
		'Большая круглая кнопка сдаёт раунд. Пробел делает то же самое: нажмите для одного раунда, удерживайте, чтобы сдавать дальше. Во время автоигры кнопка становится «Стоп», а текущий раунд сначала доигрывается.',
	'Mode opens the game-mode picker. Switching asks you to confirm before it applies.':
		'Режим открывает выбор режима игры. Смена требует подтверждения, прежде чем вступит в силу.',
	'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent deal: four cards on the guess modes, three on Three of a Kind.':
		'В этой игре нет бесплатных вращений, бонусных раундов, джекпотов и функций повторного запуска. Каждый раунд — одна независимая раздача: четыре карты в режимах с прогнозами, три в режиме «Тройка».',
	'Big Win': 'Крупный выигрыш',
	'Huge Win': 'Огромный выигрыш',
	'Mega Win': 'Мега-выигрыш',
	'Epic Win': 'Эпический выигрыш',
	'Tap to skip': 'Нажмите, чтобы пропустить',
	'Skip win animations on autoplay': 'Пропускать анимации выигрыша в автоигре',
	'Skip big win animations during autoplay':
		'Пропускать анимации крупных выигрышей во время автоигры',
	'Guess the color of card 1: red or black.': 'Угадайте цвет карты 1: красный или чёрный.',
	'Guess whether card 2 is higher or lower than card 1, or equal to it.':
		'Угадайте, будет ли карта 2 старше или младше карты 1, или равной ей.',
	'Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either. After Equal on step 2 there is nothing to fall between, so Inside is unavailable.':
		'Угадайте, окажется ли карта 3 между картами 1 и 2, вне их, или равной одной из них. После «Равно» на шаге 2 между ними ничего не может оказаться, поэтому «Внутри» недоступно.',
	'Guess the suit of card 4: hearts, diamonds, clubs or spades.':
		'Угадайте масть карты 4: черви, бубны, трефы или пики.',
	'You guessed Equal, so cards 1 and 2 share a rank. Nothing can fall between them, so Inside cannot win.':
		'Вы выбрали «Равно», значит карты 1 и 2 одного достоинства. Между ними ничего нет, поэтому «Внутри» не может выиграть.',
	'Your four guesses top out at %s your bet.':
		'Ваши четыре прогноза дают максимум %s от вашей ставки.',
	'Play Again': 'Воспроизвести снова',
	'The round ends and pays nothing.':
		'Раунд заканчивается и ничего не выплачивает.',
	'The round ends, keeping about %s% of what you had built.':
		'Раунд заканчивается, сохраняя около %s% накопленного.',
	'From card 2 on, it is forgiven: you keep %s% of what you had built and the round carries on.':
		'Начиная со второй карты промах прощается: вы сохраняете %s% накопленного, и раунд продолжается.',

	// Three of a Kind.
	'Three of a Kind':
		'Тройка',
	'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.':
		'Три карты из колоды в 12 карт: тузы, короли и дамы. Карты 2 и 3 должны совпасть с картой 1; всё остальное не платит ничего.',
	'Costs %c× your bet':
		'Стоимость %c× вашей ставки',
	'Any':
		'Любая',
	'Any card':
		'Любая карта',
	'A card that does not match':
		'Карта, которая не совпала',
	'If a card does not match':
		'Если карта не совпала',
	'Card 1 is dealt, not guessed. The deck holds one Ace, King and Queen of each suit, so card 2 matches 3 times in 11 and card 3 twice in 10.':
		'Карта 1 сдаётся, её не угадывают. В колоде по одному тузу, королю и даме каждой масти, поэтому карта 2 совпадает в 3 случаях из 11, а карта 3 — в 2 из 10.',
	'Each figure is the running total after that card, in multiples of your bet, exactly as the board shows it beside the cards. Only the last card pays.':
		'Каждое число — это накопленный итог после этой карты, в кратных вашей ставке, ровно так, как стол показывает его рядом с картами. Выплачивает только последняя карта.',
	'Three of a kind pays %m your bet, about one round in %n.':
		'Тройка платит %m вашей ставки, примерно один раунд из %n.',
	'%c× your base bet of %b':
		'%c× вашей базовой ставки %b',
	'*On %f. Each game mode has its own maximum win, shown in the mode picker and in How to Play.':
		'*В режиме %f. У каждого режима свой максимальный выигрыш, он показан в выборе режима и в разделе «Как играть».',
	'That mode costs %c× your bet.':
		'Этот режим стоит %c× вашей ставки.',
	'Card 2 must match card 1':
		'Карта 2 должна совпасть с картой 1',
	'Card 3 must match card 1':
		'Карта 3 должна совпасть с картой 1',
	'Needs %s':
		'Нужно: %s',
	'%n of %t':
		'%n из %t',
	'Last card':
		'Последняя карта',
	'Example round':
		'Пример раунда',
	'Tap the amount for the quick-bet menu.':
		'Нажмите на сумму, чтобы открыть меню быстрых ставок.',
	'Max win %s your bet':
		'Макс. выигрыш %s от вашей ставки',
};
