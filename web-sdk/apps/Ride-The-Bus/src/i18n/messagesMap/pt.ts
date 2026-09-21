// Portuguese. Keys are the English source strings - see en.ts.
export default {
	HOME: 'INÍCIO',

	Balance: 'Saldo',
	'Last Win': 'Último ganho',
	Bet: 'Aposta',

	Color: 'Cor',
	Higher: 'Maior',
	Lower: 'Menor',
	Inside: 'Dentro',
	Outside: 'Fora',
	Suit: 'Naipe',

	Winning: 'Ganho',
	'Full Game Win!': 'Jogo completo!',
	Banked: 'Garantido',
	Busted: 'Errou',
	'Revealing…': 'Revelando…',

	Deal: 'Distribuir',
	Stop: 'Parar',
	left: 'restantes',
	'Pick all 4 guesses': 'Escolha os 4 palpites',
	'Enter a number of plays': 'Insira um número de rodadas',
	'Enter a valid bet': 'Insira uma aposta válida',
	'Set rounds': 'Definir rodadas',
	Start: 'Iniciar',

	'Bet Menu': 'Menu de apostas',
	'Quick Bets': 'Apostas rápidas',

	'Turbo Speed': 'Velocidade turbo',
	Normal: 'Normal',
	Instant: 'Instantâneo',
	'Off: full animation': 'Desligado: animação completa',
	'% faster': ' % mais rápido',

	'Sound settings': 'Configurações de som',
	Sound: 'Som',
	Music: 'Música',
	'Game Sounds': 'Sons do jogo',
	'Mute music': 'Silenciar música',
	'Unmute music': 'Ativar música',
	'Mute game sounds': 'Silenciar sons do jogo',
	'Unmute game sounds': 'Ativar sons do jogo',

	Autoplay: 'Jogo automático',
	'Number of Plays': 'Número de rodadas',

	Advanced: 'Avançado',
	'Game Mode': 'Modo de Jogo',
	'Choose game mode': 'Escolher modo de jogo',
	Classic: 'Clássico',
	'Second Chance': 'Segunda Oportunidade',
	'High Stakes': 'Apostas Altas',
	'This mode costs %c× your bet. Every mode returns the same %s over many rounds; what changes is how often a round pays and how much it can pay.':
		'Este modo custa %c× a sua aposta. Todos os modos devolvem o mesmo %s ao longo de muitas rodadas; o que muda é a frequência com que uma rodada paga e quanto pode pagar.',
	Forgiven: 'Perdoado',
	// The intro's tagline and the first line of How to Play's Game modes.
	'%n ways to play': '%n formas de jogar',
	'Every combination of picks on a guess mode is its own bet, priced on its own odds.':
		'Cada combinação de escolhas num modo de palpite é uma aposta própria, precificada pelas suas próprias probabilidades.',
	'Game modes': 'Modos de jogo',
	'Max win': 'Ganho máximo',
	// Confirmation before a bet mode is activated - required by the approval
	// checklist, and worth having anyway: the three families cost the same but
	// differ in what a miss keeps and how high they reach.
	'Switch mode?': 'Mudar de modo?',
	Cancel: 'Cancelar',
	Switch: 'Mudar',
	'Volatility %s of %t': 'Volatilidade %s de %t',
	'Return to player (RTP) is %s on every game mode. The most this game can pay is %m your bet, on %f.':
		'O retorno ao jogador (RTP) é de %s em todos os modos. O máximo que este jogo pode pagar é %m sua aposta, em %f.',
	'A wrong first card ends the round. Later misses keep 30% of what you had built.':
		'Errar a primeira carta termina a rodada. Erros seguintes mantêm 30% do acumulado.',
	'A wrong first card ends the round. After that your first miss is forgiven and play continues.':
		'Errar a primeira carta termina a rodada. Depois, seu primeiro erro é perdoado e o jogo continua.',
	'Card 1': 'Carta 1',
	'Your first wrong guess': 'Seu primeiro erro',
	'Your second wrong guess': 'Seu segundo erro',
	'Guess all four right and the payout depends on how hard your picks were. Equal is the rarest guess, so rounds built on it pay the most; two Equal picks together is the most this mode can pay, at %m your bet.':
		'Acerte as quatro e o pagamento depende de quão difíceis foram seus palpites. Igual é o palpite mais raro, por isso as rodadas construídas sobre ele pagam mais; dois Igual juntos é o máximo que este modo pode pagar, %m sua aposta.',
	'Only some guess combinations reach a mode’s maximum. Once your four are picked, their own ceiling is shown above.':
		'Só algumas combinações de palpites atingem o máximo de um modo. Depois de escolher seus quatro, o limite próprio deles é mostrado acima.',
	Playing: 'Em jogo',
	'Card 2, 3 or 4': 'Carta 2, 3 ou 4',
	'A wrong first card ends the round. Later misses keep only 16%, so every correct guess is worth more.':
		'Errar a primeira carta termina a rodada. Erros seguintes mantêm apenas 16%, por isso cada acerto vale mais.',

	'How to Play': 'Como jogar',
	'Guess your way through four cards:': 'Adivinhe as quatro cartas, uma a uma:',
	'Color: red or black for card 1.': 'Cor: vermelho ou preto para a carta 1.',
	'Higher / Lower: versus card 1 (or =).': 'Maior / Menor: em relação à carta 1 (ou =).',
	'Inside / Outside: between cards 1 & 2 (or =).': 'Dentro / Fora: entre as cartas 1 e 2 (ou =).',
	'Suit: the suit of card 4.': 'Naipe: o naipe da carta 4.',
	'Pick all four, set your bet and deal. Each right guess multiplies your win; get all four for a full game win. What a wrong guess costs you depends on the game mode, explained below.':
		'Escolha as quatro, defina sua aposta e distribua. Cada acerto multiplica seu ganho; acerte as quatro para um jogo completo. O que um erro custa depende do modo de jogo, explicado abaixo.',
	'Card order': 'Ordem das cartas',
	'Ace is low and King is high. Suit never affects rank: only the number counts for Higher / Lower and Inside / Outside.':
		'O ás é a mais baixa e o rei a mais alta. O naipe nunca afeta a ordem: só o número conta para Maior / Menor e Dentro / Fora.',
	Lowest: 'Mais baixa',
	Highest: 'Mais alta',
	'Payouts follow the odds': 'Os pagamentos seguem as probabilidades',
	'Every correct guess pays its true odds against the cards left in the deck, so the less likely your pick, the more it pays, and the same guess can pay differently from one round to the next.':
		'Cada acerto paga conforme suas probabilidades reais face às cartas que restam no baralho, então quanto menos provável a sua escolha, mais ela paga, e o mesmo palpite pode pagar de forma diferente de uma rodada para a outra.',
	'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.':
		'Com um 3 na mesa, Menor paga cerca de %1× porque apenas 8 das 51 cartas restantes são menores, enquanto Maior paga cerca de %2× porque 40 delas são. Troque esse 3 por um 8 e tudo se inverte: Menor cai para cerca de %3× e Maior sobe para cerca de %4×. Igual é sempre a aposta mais improvável, em torno de %5×.',
	'Payout table': 'Tabela de pagamentos',
	Card: 'Carta',
	Pick: 'Escolha',
	Pays: 'Paga',
	'Red or Black': 'Vermelho ou preto',
	'Any suit': 'Qualquer naipe',
	'Stages multiply together at full precision, so the figures above are exact. Only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded the same way at each step, so mid-round it can read slightly under these figures.':
		'As etapas multiplicam-se com precisão total, por isso os valores acima são exatos. Apenas o pagamento final é arredondado para baixo, para uma casa decimal. O total corrente ao lado das cartas é arredondado da mesma forma a cada passo, portanto durante a rodada pode aparecer um pouco abaixo destes valores.',
	'If you guess wrong': 'Se você errar',
	'Full game wins': 'Vitórias completas',
	'Speed and skip settings change only what you see, never the cards, the odds or the payout.':
		'As configurações de velocidade e de pulo mudam apenas o que você vê, nunca as cartas, as probabilidades ou o pagamento.',

	'Pick a color': 'Escolha uma cor',
	'Higher, lower, or equal': 'Maior, menor ou igual',
	'Inside, outside, or equal': 'Dentro, fora ou igual',
	'Pick a suit': 'Escolha um naipe',
	Red: 'Vermelho',
	Black: 'Preto',
	Equal: 'Igual',
	'Not possible after guessing Equal': 'Não é possível depois de escolher Igual',
	Heart: 'Copas',
	Diamond: 'Ouros',
	Club: 'Paus',
	Spade: 'Espadas',
	Mute: 'Silenciar',
	Unmute: 'Ativar som',
	'How to play': 'Como jogar',
	'Choose bet amount': 'Escolher valor da aposta',
	'Custom bet amount': 'Valor personalizado',
	'Increase bet': 'Aumentar aposta',
	'Decrease bet': 'Diminuir aposta',
	'Turbo speed': 'Velocidade turbo',
	'Autoplay settings': 'Configurações do jogo automático',
	'Advanced settings': 'Configurações avançadas',
	'Stop autoplay': 'Parar jogo automático',
	'Rounds must be %s seconds apart': 'As rodadas devem ter %s segundos de intervalo',
	'Round in progress': 'Rodada em andamento',
	'Insufficient funds': 'Saldo insuficiente',
	'Bet is below the minimum of %s': 'A aposta está abaixo do mínimo de %s',
	'Bet is above the maximum of %s': 'A aposta excede o máximo de %s',
	'Bet is locked while autoplay runs': 'A aposta fica bloqueada enquanto o jogo automático roda',
	'Mode is locked while autoplay runs': 'O modo de jogo fica bloqueado enquanto o jogo automático roda',
	'Replays cannot be re-bet': 'As repetições não podem receber novas apostas',
	'Replay is view-only': 'A repetição é apenas para visualização',
	'No active game session': 'Nenhuma sessão de jogo ativa',
	Error: 'Erro',
	Reload: 'Recarregar',
	'Something went wrong. Please try again.': 'Algo deu errado. Tente novamente.',
	'That bet was rejected. Please adjust the amount and try again.':
		'Essa aposta foi recusada. Ajuste o valor e tente novamente.',
	'Not enough balance for that bet.': 'Saldo insuficiente para essa aposta.',
	'Your session has expired. Please reload the game.': 'Sua sessão expirou. Recarregue o jogo.',
	'A gambling limit on your account has been reached.':
		'Um limite de jogo da sua conta foi atingido.',
	'This game is not available from your location.':
		'Este jogo não está disponível na sua localização.',
	'The game server had a problem. Please try again shortly.':
		'O servidor do jogo teve um problema. Tente novamente em instantes.',
	'The game is under maintenance. Please try again shortly.':
		'O jogo está em manutenção. Tente novamente em instantes.',
	'Skip the reveal': 'Pular a revelação',
	'Session information': 'Informações da sessão',
	'Net Position': 'Posição líquida',
	RTP: 'RTP',
	Session: 'Sessão',
	Fast: 'Rápido',
	'Number of plays': 'Número de rodadas',
	'Unlimited plays': 'Rodadas ilimitadas',
	'More plays': 'Mais rodadas',
	'Fewer plays': 'Menos rodadas',
	'Stop autoplay on full game win': 'Parar o jogo automático ao vencer o jogo completo',
	'Close menu': 'Fechar menu',
	Close: 'Fechar',
	'Game information': 'Informações do jogo',
	Disclaimer: 'Aviso legal',
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.':
		'Qualquer falha anula todos os ganhos e jogadas. É necessária uma conexão de internet estável. Em caso de desconexão, recarregue o jogo para concluir as rodadas não finalizadas. O retorno esperado é calculado ao longo de muitas jogadas. A exibição do jogo não representa nenhum dispositivo físico e é apenas ilustrativa. Os ganhos são liquidados de acordo com o valor recebido do Remote Game Server e não com os eventos ocorridos no navegador web. TM e © 2026 Stake Engine.',
	'Loading replay…': 'Carregando repetição…',
	'Loading Ride The Bus…': 'Carregando Ride The Bus…',
	'Max Win': 'Ganho máx.',
	'Tap to continue': 'Toque para continuar',
	'Round details': 'Detalhes da rodada',
	'Play amount': 'Valor da aposta',
	Mode: 'Modo',
	'Game mode': 'Modo de jogo',
	Guesses: 'Palpites',
	Event: 'Evento',
	Payout: 'Pagamento',
	Play: 'Reproduzir',

	// Rule additions (new)
	Controls: 'Controles',
	'Plus and minus set your bet. Tap the amount for the quick-bet menu.':
		'Mais e menos definem sua aposta. Toque no valor para abrir o menu de apostas rápidas.',
	'The speaker opens the sound settings. Music and game sounds mute separately.':
		'O alto-falante abre as configurações de som. A música e os sons do jogo são silenciados separadamente.',
	'The i button opens this screen.': 'O botão i abre esta tela.',
	'The lightning button is Turbo: how fast the cards flip, from Normal to Instant.':
		'O botão do raio é o Turbo: a rapidez com que as cartas viram, de Normal a Instantâneo.',
	'The circular arrows open autoplay, which repeats your four guesses for a set number of rounds or unlimited. The counter sits on the button while it runs.':
		'As setas circulares abrem o jogo automático, que repete seus quatro palpites por um número definido de rodadas ou sem limite. O contador fica no botão enquanto ele roda.',
	'The sliders button holds two autoplay options: stop on a full game win, and skip the win animations.':
		'O botão dos controles deslizantes reúne duas opções do jogo automático: parar ao vencer o jogo completo e pular as animações de ganho.',
	'The large round button deals the round. So does the spacebar: tap for one round, hold to keep dealing. While autoplay runs the button becomes Stop, and the round in play finishes first.':
		'O botão redondo grande distribui a rodada. A barra de espaço também: toque para uma rodada, mantenha pressionada para continuar distribuindo. Enquanto o jogo automático roda, o botão vira Parar e a rodada em andamento termina primeiro.',
	'Mode opens the game-mode picker. Switching asks you to confirm before it applies.':
		'Modo abre o seletor de modo de jogo. Mudar pede confirmação antes de se aplicar.',
	'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent four-card draw.':
		'Este jogo não tem rodadas grátis, rodadas de bônus, jackpots ou funções de reativação. Cada rodada é um único sorteio independente de quatro cartas.',
	'Big Win': 'Grande Ganho',
	'Huge Win': 'Ganho Enorme',
	'Mega Win': 'Mega Ganho',
	'Epic Win': 'Ganho Épico',
	'Tap to skip': 'Toque para pular',
	'Skip win animations on autoplay': 'Pular animações de ganho no jogo automático',
	'Skip big win animations during autoplay':
		'Pular animações de grandes ganhos durante o jogo automático',
	'Guess the color of card 1: red or black.': 'Adivinhe a cor da carta 1: vermelho ou preto.',
	'Guess whether card 2 is higher or lower than card 1, or equal to it.':
		'Adivinhe se a carta 2 é maior ou menor que a carta 1, ou igual a ela.',
	'Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either. After Equal on step 2 there is nothing to fall between, so Inside is unavailable.':
		'Adivinhe se a carta 3 cai entre as cartas 1 e 2, fora delas, ou é igual a uma das duas. Depois de Igual no passo 2 nada pode cair entre elas, por isso Dentro não está disponível.',
	'Guess the suit of card 4: hearts, diamonds, clubs or spades.':
		'Adivinhe o naipe da carta 4: copas, ouros, paus ou espadas.',
	'You guessed Equal, so cards 1 and 2 share a rank. Nothing can fall between them, so Inside cannot win.':
		'Você escolheu Igual, então as cartas 1 e 2 têm o mesmo valor. Nada pode cair entre elas, portanto Dentro não pode ganhar.',
	'Your four guesses top out at %s your bet.':
		'Os seus quatro palpites atingem no máximo %s da sua aposta.',
	'Play Again': 'Reproduzir novamente',
	'The round ends and pays nothing.': 'A rodada termina e não paga nada.',
	'The round ends, keeping about %s% of what you had built.':
		'A rodada termina e você mantém cerca de %s% do acumulado.',
	'From card 2 on, it is forgiven: you keep %s% of what you had built and the round carries on.':
		'A partir da carta 2 ele é perdoado: você mantém %s% do acumulado e a rodada continua.',

	// Three of a Kind.
	'Three of a Kind':
		'Trinca',
	'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.':
		'Três cartas de um baralho de 12 cartas com ases, reis e damas. As cartas 2 e 3 têm de coincidir com a carta 1; qualquer outra coisa não paga nada.',
	'Costs %c× your bet':
		'Custa %c× a sua aposta',
	'Any':
		'Qualquer',
	'Any card':
		'Qualquer carta',
	'Any wrong guess':
		'Qualquer palpite errado',
	'Played from a 12-card deck: the Ace, King and Queen of each suit. Card 1 is dealt; cards 2 and 3 must match its rank. Three cards, one win.':
		'Jogado com um baralho de 12 cartas: o ás, o rei e a dama de cada naipe. A carta 1 é distribuída; as cartas 2 e 3 têm de igualar o seu valor. Três cartas, um prémio.',
	'Three of a kind pays %m your bet, about one round in %n.':
		'A trinca paga %m a sua aposta, cerca de uma rodada em cada %n.',
	'%c× your base bet of %b':
		'%c× a sua aposta base de %b',
	'*On %f. Each game mode has its own maximum win, shown in the mode picker and in How to Play.':
		'*Em %f. Cada modo de jogo tem o seu próprio prémio máximo, indicado no seletor de modo e em Como jogar.',
	'Card 2 must match card 1':
		'A carta 2 tem de coincidir com a carta 1',
	'Card 3 must match card 1':
		'A carta 3 tem de coincidir com a carta 1',
};
