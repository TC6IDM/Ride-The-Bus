// Chinese (Simplified). Keys are the English source strings - see en.ts.
export default {
	HOME: '主页',

	Balance: '余额',
	'Last Win': '上次赢额',
	Bet: '投注',

	Color: '颜色',
	Higher: '更大',
	Lower: '更小',
	Inside: '之间',
	Outside: '之外',
	Suit: '花色',

	Winning: '赢额',
	'Full game win': '全中',
	Banked: '已锁定',
	Busted: '未中',
	'Revealing…': '翻牌中…',

	Deal: '发牌',
	Stop: '停止',
	left: '剩余',
	'Pick all 4 guesses': '请选择全部 4 项预测',
	'Enter a number of plays': '请输入游戏局数',
	'Enter a valid bet': '请输入有效的投注额',
	'Set rounds': '设置局数',
	Start: '开始',

	'Bet menu': '投注菜单',
	'Quick bets':
		'快速投注',

	Normal: '正常',
	Instant: '瞬间',
	'Off: full animation': '关闭：完整动画',
	'% faster': '％ 更快',

	'Sound settings': '声音设置',
	Sound: '声音',
	Music: '音乐',
	'Game sounds':
		'游戏音效',
	'Mute music': '静音音乐',
	'Unmute music': '开启音乐',
	'Mute game sounds': '静音游戏音效',
	'Unmute game sounds': '开启游戏音效',

	Autoplay: '自动游戏',

	'Choose game mode': '选择游戏模式',
	Classic: '经典',
	'Second Chance': '第二次机会',
	'High Stakes': '高额投注',
	'This mode costs %c× your bet. Every mode returns the same %s over many rounds; what changes is how often a round pays and how much it can pay.':
		'此模式费用为您投注的%c倍。所有模式在多局之后的回报率都是相同的%s；不同的只是每局赔付的频率与金额。',
	Forgiven: '已豁免',
	// The intro's tagline and the first line of How to Play's Game modes.
	'%n ways to play': '%n 种玩法',
	'There are %n ways to play: every set of picks is its own bet, priced on its own odds.':
		'共有 %n 种玩法：每一种选择组合都是一注独立的投注，按其自身赔率定价。',
	'Game modes': '游戏模式',
	// Confirmation before a bet mode is activated - required by the approval
	// checklist, and worth having anyway: the guess families cost the same but
	// differ in what a miss keeps and how high they reach.
	'Switch mode?': '切换模式？',
	Cancel: '取消',
	Switch: '切换',
	'Volatility %s of %t': '波动性 %t 级中的 %s',
	'Return to player (RTP) is %s on every game mode. The most this game can pay is %m your bet, on %f.':
		'所有游戏模式的返奖率（RTP）均为 %s。本游戏的最高赔付为投注额的 %m，出现在%f模式。',
	'A wrong first card ends the round. Later misses keep 30% of your running total.':
		'第一张牌猜错即结束本局。之后猜错保留累计金额的30%。',
	'A wrong first card ends the round. After that your first miss is forgiven and play continues.':
		'第一张牌猜错即结束本局。此后第一次猜错可获豁免并继续游戏。',
	'Card 1': '第一张牌',
	'Your first wrong guess': '你的第一次猜错',
	'Your second wrong guess': '你的第二次猜错',
	'A full game win pays more the harder your picks were. Equal is the rarest guess, so it pays the most, and two Equal picks reach this mode’s maximum: %m your bet.':
		'全中的赔付取决于你的选择有多难。相同是最罕见的猜测，因此赔付最高；两次选择相同即可达到本模式的最高赔付：投注额的 %m。',
	'Only some combinations reach the mode’s maximum. Once your four are picked, the most they can pay is shown above.':
		'只有部分组合能达到本模式的最高赔付。选好四项后，它们最多能赔付多少会显示在上方。',
	Playing: '游戏中',
	'Card 2, 3 or 4': '第二、三或四张牌',
	'A wrong first card ends the round. Later misses keep only 15%, so every correct guess is worth more.':
		'第一张牌猜错即结束本局。之后猜错仅保留15%，因此每一次猜对都更有价值。',

	'Guess your way through four cards:': '依次预测四张牌：',
	'Color: is card 1 red or black?':
		'颜色：第 1 张是红色还是黑色？',
	'Higher or Lower: is card 2 above or below card 1, or Equal to it?':
		'更大 / 更小：第 2 张比第 1 张大还是小，还是相同？',
	'Inside or Outside: is card 3 between cards 1 and 2 or outside them, or Equal to one of them?':
		'之间 / 之外：第 3 张落在第 1、2 张之间还是之外，还是与其中一张相同？',
	'Suit: which suit is card 4?':
		'花色：第 4 张是什么花色？',
	'Pick all four, set your bet and deal. Each right guess multiplies your win, and four right is a full game win. What a wrong guess costs depends on the game mode; see Game modes below.':
		'选好四项、设定投注并发牌。每猜中一次，奖金就会相乘；四项全中即为全中。猜错的代价取决于游戏模式，见下方“游戏模式”。',
	'Card order': '牌面大小',
	'Ace is low and King is high. Suits have no rank: only the card’s value counts for Higher, Lower, Inside and Outside.':
		'A 最小、K 最大。花色没有大小：更大、更小、之间与之外只看牌的点数。',
	Lowest: '最小',
	Highest: '最大',
	'Payouts follow the odds': '赔付取决于概率',
	'Each right guess is priced on the cards still in the deck: the less likely it is, the more it pays. So the same guess can pay differently from one round to the next.':
		'每次猜中都按牌堆中剩余的牌定价：越难出现，赔付越高。因此同一猜测在不同局的赔付可能不同。',
	'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.':
		'若桌上是 3，剩余 51 张牌中只有 8 张更小，因此「更小」约赔 %1 倍；而更大的有 40 张，因此「更大」仅约 %2 倍。把 3 换成 8，情况就反过来：「更小」降至约 %3 倍，「更大」升至约 %4 倍。「相同」始终是最难中的，约 %5 倍。',
	'Payout table': '赔付表',
	Card: '牌',
	Pick: '选择',
	Pays: '赔付',
	'Total':
		'合计',
	'Red or Black': '红色或黑色',
	'Any suit': '任意花色',
	'These figures are exact: the stages multiply at full precision, and only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded down as it goes, so mid-round it can read a little under them.':
		'这些数字是精确值：各阶段以完整精度累乘，只有最终赔付会向下取整到一位小数。牌旁的累计金额在过程中向下取整显示，因此局中可能看起来略低。',
	'If you guess wrong': '若猜错',
	'Full game wins': '全中赔付',
	'Turbo and skipping win animations change only what you see, never the cards, the odds or the payout.':
		'加速与跳过获胜动画只改变你看到的内容，绝不会改变牌、概率或赔付。',

	'Pick a color': '选择颜色',
	'Higher, lower, or equal': '更大、更小或相同',
	'Inside, outside, or equal': '之间、之外或相同',
	'Pick a suit': '选择花色',
	Red: '红色',
	Black: '黑色',
	Equal: '相同',
	'Not possible after guessing Equal': '选择“相同”后无法选择',
	Heart: '红桃',
	Diamond: '方块',
	Club: '梅花',
	Spade: '黑桃',
	Mute: '静音',
	Unmute: '取消静音',
	'How to play': '玩法说明',
	'Choose bet amount': '选择投注额',
	'Custom bet amount': '自定义投注额',
	'Increase bet': '增加投注额',
	'Decrease bet': '减少投注额',
	'Turbo speed': '加速档位',
	'Autoplay settings': '自动游戏设置',
	'Stop autoplay': '停止自动游戏',
	'Rounds must be %s seconds apart': '每局之间需间隔 %s 秒',
	'Round in progress': '本局进行中',
	'Insufficient funds': '余额不足',
	'Bet is below the minimum of %s': '投注低于最低限额 %s',
	'Bet is above the maximum of %s': '投注高于最高限额 %s',
	'Bet is locked while autoplay runs': '自动游戏进行时无法更改投注',
	'Mode is locked while autoplay runs': '自动游戏进行时无法更改游戏模式',
	'Replays cannot be re-bet': '回放无法重新投注',
	'Replay is view-only': '回放仅供查看',
	'No active game session': '没有有效的游戏会话',
	Error: '错误',
	Reload: '重新加载',
	'Something went wrong. Please try again.': '出错了，请重试。',
	'That bet was rejected. Please adjust the amount and try again.':
		'该投注被拒绝，请调整金额后重试。',
	'Not enough balance for that bet.': '余额不足，无法进行该投注。',
	'Your session has expired. Please reload the game.': '会话已过期，请重新加载游戏。',
	'A gambling limit on your account has been reached.': '您的账户已达到博彩限额。',
	'This game is not available from your location.': '您所在的地区无法使用本游戏。',
	'The game server had a problem. Please try again shortly.': '游戏服务器出现问题，请稍后重试。',
	'The game is under maintenance. Please try again shortly.': '游戏正在维护中，请稍后重试。',
	'Skip the reveal': '跳过翻牌',
	'Session information': '会话信息',
	'Net Position': '净盈亏',
	RTP: 'RTP',
	Session: '会话',
	Fast: '快速',
	'Number of plays': '局数',
	'Unlimited plays': '不限局数',
	'More plays': '增加局数',
	'Fewer plays': '减少局数',
	'Stop autoplay on full game win': '全中时停止自动游戏',
	'Close menu': '关闭菜单',
	Close: '关闭',
	'Game information': '游戏信息',
	Disclaimer: '免责声明',
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.':
		'故障将使所有奖金和游戏无效。需要稳定的网络连接。如果断开连接，请重新加载游戏以完成未结束的回合。预期回报是基于大量游戏计算得出的。游戏画面不代表任何实体设备，仅供示意。奖金依据从 Remote Game Server 收到的金额结算，而非依据网页浏览器中的事件。TM 和 © 2026 Stake Engine.',
	'Loading replay…': '正在加载回放…',
	'Loading Ride The Bus…': '正在加载 Ride The Bus…',
	'Max Win': '最高赔付',
	'Tap to continue': '点击继续',
	'Round details': '本局详情',
	'Play amount': '投注金额',
	Mode: '模式',
	'Game mode': '游戏模式',
	Guesses: '猜测',
	Cards: '牌',
	'Round cost': '本局费用',
	Event: '事件',
	Payout: '派彩',
	Play: '播放',

	// Rule additions (new)
	Controls: '操作说明',
	'Plus and minus set your bet. Tap the amount for the quick-bet menu.': '加减按钮设定投注。点击金额可打开快速投注菜单。',
	'The speaker opens the sound settings. Music and game sounds mute separately.':
		'喇叭打开声音设置。音乐与游戏音效可分别静音。',
	'The i button opens this screen.': 'i 按钮打开此界面。',
	'The lightning button is Turbo: how fast the cards flip, from Normal to Instant.':
		'闪电按钮是加速：控制翻牌快慢，从正常到瞬间。',
	'The circular arrows open autoplay: the same bet, dealt again for a set number of rounds or without limit. The button counts down the rounds left.':
		'环形箭头打开自动游戏：以同一投注按设定局数或无限次重新发牌。按钮会倒数剩余局数。',
	'The big round button deals. So does the spacebar: tap for one round, hold to keep dealing. During autoplay it becomes Stop, and the round in play finishes first.':
		'大圆形按钮发牌。空格键同样可以：轻按发一局，按住则持续发牌。自动游戏时它变为停止，进行中的一局会先结束。',
	'Mode opens the game-mode picker. Switching asks you to confirm before it applies.':
		'模式打开游戏模式选择器。切换前会要求确认。',
	'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent deal: four cards on the guess modes, three on Three of a Kind.':
		'本游戏没有免费旋转、奖励回合、累积奖池或重新触发功能。每一局都是独立的一次发牌：猜测模式为四张牌，三条为三张牌。',
	'Big Win': '大奖',
	'Huge Win': '巨额大奖',
	'Mega Win': '超级大奖',
	'Epic Win': '史诗大奖',
	'Tap to skip': '点击跳过',
	'Skip win animations on autoplay': '自动游戏时跳过获胜动画',
	'Skip big win animations during autoplay': '自动游戏期间跳过大奖动画',
	'Guess the color of card 1: red or black.': '猜第 1 张牌的颜色：红色还是黑色。',
	'Guess whether card 2 is higher or lower than card 1, or equal to it.':
		'猜第 2 张牌比第 1 张大还是小，或者相同。',
	'Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either. After Equal on step 2 there is nothing to fall between, so Inside is unavailable.':
		'猜第 3 张牌是在第 1、2 张之间、之外，还是与其中一张相同。第 2 步选了相同后，两张牌之间不可能有牌，因此之间不可选。',
	'Guess the suit of card 4: hearts, diamonds, clubs or spades.':
		'猜第 4 张牌的花色：红桃、方块、梅花或黑桃。',
	'You guessed Equal, so cards 1 and 2 share a rank. Nothing can fall between them, so Inside cannot win.':
		'你选择了相同，因此第 1、2 张牌点数一样。它们之间没有任何牌，所以之间无法获胜。',
	'Your four guesses top out at %s your bet.':
		'你选择的四个猜测最高可达投注额的 %s。',
	'Play Again': '再看一次',
	'The round ends and pays nothing.': '本局结束，不予派彩。',
	'The round ends, and you keep about %s% of your running total.':
		'本局结束，你保留累计金额的约 %s%。',
	'From card 2 on, it is forgiven: you keep %s% of your running total and play on.':
		'从第 2 张牌起可获宽恕：你保留累计金额的 %s%，继续游戏。',

	// Three of a Kind.
	'Three of a Kind':
		'三条',
	'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.':
		'从12张牌（A、K、Q）的牌组中发三张牌。第2、3张牌必须与第1张牌点数相同；否则没有任何赔付。',
	'Costs %c× your bet':
		'费用为您投注的%c倍',
	'Any':
		'任意',
	'Any card':
		'任意牌',
	'A card that does not match':
		'不匹配的牌',
	'If a card does not match':
		'如果牌不匹配',
	'Card 1 is dealt, not guessed. The deck holds one Ace, King and Queen of each suit, so card 2 matches 3 times in 11 and card 3 twice in 10.':
		'第1张牌是发出来的，无需猜测。牌组每种花色各有一张A、K、Q，因此第2张牌有11分之3的概率匹配，第3张牌有10分之2的概率匹配。',
	'Each figure is the running total after that card, in multiples of your bet, exactly as the board shows it beside the cards. Only the last card pays.':
		'每个数字都是到该牌为止的累计总额，以投注额的倍数表示，与牌桌上牌旁显示的一致。只有最后一张牌才派彩。',
	'Three of a kind pays %m your bet, about one round in %n.':
		'三条赔付您投注的%m，大约每%n局出现一次。',
	'%c× your base bet of %b':
		'基础投注%b的%c倍',
	'*On %f. Each game mode has its own maximum win, shown in the mode picker and in How to Play.':
		'*为%f的数值。每种游戏模式各有不同的最高赢取，见模式选择和游戏说明。',
	'That mode costs %c× your bet.':
		'该模式的费用为投注额的%c倍。',
	'Card 2 must match card 1':
		'第2张牌须与第1张牌相同',
	'Card 3 must match card 1':
		'第3张牌须与第1张牌相同',
	'%n of %t':
		'%t张中%n张',
	'Last card':
		'最后一张',
	'Example round':
		'示例回合',
	'Tap the amount for the quick-bet menu.':
		'点击金额可打开快速投注菜单。',
	'Max win %s your bet':
		'最高赔付 投注额的 %s',
	'Stop on a loss of':
		'亏损达到时停止',
	'Stop on a single win of':
		'单次赢取达到时停止',
	'On a keyboard, keys 1 to 4 change the four guesses.':
		'使用键盘时，按 1 至 4 键可切换四项预测。',
	'It can stop by itself on a full game win, a loss limit or one big win.':
		'也可设置在全中、达到亏损上限或单次大额赢取时自动停止。',
	'× means times your base bet.':
		'× 表示基础投注额的倍数。',
	'Times your base bet':
		'基础投注额的倍数',
};
