// Japanese. Keys are the English source strings - see en.ts.
export default {
	HOME: 'ホーム',

	Balance: '残高',
	'Last Win': '直前の配当',
	Bet: 'ベット',

	Color: '色',
	Higher: 'ハイ',
	Lower: 'ロー',
	Inside: 'イン',
	Outside: 'アウト',
	Suit: 'スート',

	Winning: '配当',
	'Full Game Win!': 'フルゲーム達成！',
	Banked: '確保',
	Busted: '失敗',
	'Revealing…': 'めくり中…',

	Deal: 'ディール',
	Stop: '停止',
	left: '残り',
	'Pick all 4 guesses': '4つすべて選択してください',
	'Enter a number of plays': 'ラウンド数を入力してください',
	'Enter a valid bet': '有効なベット額を入力してください',
	'Set rounds': 'ラウンド数を設定',
	Start: '開始',

	'Bet Menu': 'ベットメニュー',
	'Quick Bets': 'クイックベット',

	'Turbo Speed': 'ターボ速度',
	Normal: '通常',
	Instant: '瞬時',
	'Off: full animation': 'オフ：通常アニメーション',
	'% faster': '％高速',

	'Sound settings': 'サウンド設定',
	Sound: 'サウンド',
	Music: '音楽',
	'Game Sounds': 'ゲーム音',
	'Mute music': '音楽をミュート',
	'Unmute music': '音楽をオンにする',
	'Mute game sounds': 'ゲーム音をミュート',
	'Unmute game sounds': 'ゲーム音をオンにする',

	Autoplay: 'オートプレイ',
	'Number of Plays': 'ラウンド数',

	Advanced: '詳細設定',
	'Game Mode': 'ゲームモード',
	'Choose game mode': 'ゲームモードを選択',
	Classic: 'クラシック',
	'Second Chance': 'セカンドチャンス',
	'High Stakes': 'ハイステークス',
	'Every mode costs %c× your bet and returns the same %s over many rounds. What changes is how often a round pays and how much it can pay.':
		'どのモードもベット額の%c倍で、多数のラウンドで同じ%sを還元します。変わるのは配当の頻度と大きさです。',
	Forgiven: '免除',
	'Game modes': 'ゲームモード',
	'Max win': '最大配当',
	// Confirmation before a bet mode is activated - required by the approval
	// checklist, and worth having anyway: the three families cost the same but
	// differ in what a miss keeps and how high they reach.
	'Switch mode?': 'モードを変更しますか？',
	Cancel: 'キャンセル',
	Switch: '変更する',
	'Volatility %s of %t': 'ボラティリティ %t段階中 %s',
	'Return to player (RTP) is %s on every game mode. The most this game can pay is %m your bet, on High Stakes.':
		'還元率（RTP）はどのゲームモードでも %s です。このゲームの最大配当はハイステークスでベットの %m です。',
	'A wrong first card ends the round. Later misses keep 30% of what you had built.':
		'1枚目を外すとラウンド終了。以降のミスは積み上げた分の30%を保持します。',
	'A wrong first card ends the round. After that your first miss is forgiven and play continues.':
		'1枚目を外すとラウンド終了。以降の最初のミスは免除され、続行します。',
	'Card 1': 'カード1',
	'Your first wrong guess': '最初のミス',
	'Your second wrong guess': '2度目のミス',
	'Guess all four right and the payout depends on how hard your picks were. Equal is the rarest guess, so rounds built on it pay the most; two Equal picks together is the most this mode can pay, at %m your bet.':
		'4枚すべて当てると、配当は予想の難しさで決まります。イコールは最も起こりにくい予想なので、それを含むラウンドの配当が最も高くなります。イコールを2つ同時に当てるのがこのモードの最大配当で、ベットの%mです。',
	'Only some guess combinations reach a mode’s maximum. Once your four are picked, their own ceiling is shown above.':
		'予想の組み合わせのうち、モードの最大配当に届くのは一部だけです。4つを選ぶと、その組み合わせ自体の上限が上に表示されます。',
	Playing: 'プレイ中',
	'Card 2, 3 or 4': 'カード2・3・4',
	'A wrong first card ends the round. Later misses keep only 20%, so every correct guess is worth more.':
		'1枚目を外すとラウンド終了です。以降のミスは20%しか残らないぶん、的中1つ1つの価値が高くなります。',

	'How to Play': '遊び方',
	'Guess your way through four cards:': '4枚のカードを順に予想します：',
	'Color: red or black for card 1.': '色：1枚目が赤か黒か。',
	'Higher / Lower: versus card 1 (or =).': 'ハイ / ロー：1枚目との比較（または＝）。',
	'Inside / Outside: between cards 1 & 2 (or =).': 'イン / アウト：1枚目と2枚目の間か外か（または＝）。',
	'Suit: the suit of card 4.': 'スート：4枚目のスート。',
	'Pick all four, set your bet and deal. Each right guess multiplies your win; get all four for a full game win. What a wrong guess costs you depends on the game mode, explained below.':
		'4つすべてを選び、ベット額を決めて配ります。的中するたびに配当が倍増し、4つすべて当てればフルゲーム達成です。外したときに失うものはゲームモードによって異なります。詳しくは下記をご覧ください。',
	'Card order': 'カードの強さ',
	'Ace is low and King is high. Suit never affects rank: only the number counts for Higher / Lower and Inside / Outside.':
		'エースが最も弱く、キングが最も強くなります。スートは強さに影響せず、ハイ / ロー とイン / アウトでは数字だけが関係します。',
	Lowest: '最弱',
	Highest: '最強',
	'Payouts follow the odds': '配当は確率に連動します',
	'Every correct guess pays its true odds against the cards left in the deck, so the less likely your pick, the more it pays, and the same guess can pay differently from one round to the next.':
		'的中はすべて、山札に残るカードに対する本来の確率どおりに支払われます。選択が起こりにくいほど配当は高くなり、同じ予想でもラウンドごとに配当が変わることがあります。',
	'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.':
		'場に3がある場合、残り51枚のうち3より小さいのは8枚だけなのでローは約%1倍、逆に大きいのは40枚あるためハイは約%2倍です。3が8になると関係は逆転し、ローは約%3倍、ハイは約%4倍になります。イコールは常に最も起こりにくく、およそ%5倍です。',
	'Payout table': '配当表',
	Card: 'カード',
	Pick: '予想',
	Pays: '配当',
	'Red or Black': '赤か黒',
	'Any suit': '任意のスート',
	'Stages multiply together at full precision, so the figures above are exact. Only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded the same way at each step, so mid-round it can read slightly under these figures.':
		'各ステージは完全な精度のまま掛け合わされるため、上記の数値は正確な値です。小数点 1 桁への切り捨ては最終配当に対してのみ行われます。カードの横に表示される進行中の合計も各段階で同じように切り捨てられるため、ラウンド中はこれらの数値よりわずかに少なく見えることがあります。',
	'If you guess wrong': '予想が外れた場合',
	'Full game wins': 'フルゲーム達成時の配当',
	'Speed and skip settings change only what you see, never the cards, the odds or the payout.':
		'速度とスキップの設定は表示だけを変えます。カード、確率、配当が変わることはありません。',

	'Pick a color': '色を選択',
	'Higher, lower, or equal': 'ハイ、ロー、またはイコール',
	'Inside, outside, or equal': 'イン、アウト、またはイコール',
	'Pick a suit': 'スートを選択',
	Red: '赤',
	Black: '黒',
	Equal: 'イコール',
	'Not possible after guessing Equal': 'イコールを選んだ後は選べません',
	Heart: 'ハート',
	Diamond: 'ダイヤ',
	Club: 'クラブ',
	Spade: 'スペード',
	Mute: 'ミュート',
	Unmute: 'ミュート解除',
	'How to play': '遊び方',
	'Choose bet amount': 'ベット額を選択',
	'Custom bet amount': 'カスタムベット額',
	'Increase bet': 'ベット額を上げる',
	'Decrease bet': 'ベット額を下げる',
	'Turbo speed': 'ターボ速度',
	'Autoplay settings': 'オートプレイ設定',
	'Advanced settings': '詳細設定',
	'Stop autoplay': 'オートプレイを停止',
	'Rounds must be %s seconds apart': 'ラウンドの間隔は%s秒必要です',
	'Round in progress': 'ラウンド進行中',
	'Insufficient funds': '残高が不足しています',
	'Bet is below the minimum of %s': 'ベットが最小額 %s を下回っています',
	'Bet is above the maximum of %s': 'ベットが最大額 %s を上回っています',
	'Bet is locked while autoplay runs': 'オートプレイ中はベットを変更できません',
	'Mode is locked while autoplay runs': 'オートプレイ中はゲームモードを変更できません',
	'Replays cannot be re-bet': 'リプレイに賭け直すことはできません',
	'Replay is view-only': 'リプレイは閲覧専用です',
	'No active game session': '有効なゲームセッションがありません',
	Error: 'エラー',
	Reload: '再読み込み',
	'Something went wrong. Please try again.': '問題が発生しました。もう一度お試しください。',
	'That bet was rejected. Please adjust the amount and try again.':
		'そのベットは拒否されました。金額を調整してもう一度お試しください。',
	'Not enough balance for that bet.': 'そのベットに必要な残高が足りません。',
	'Your session has expired. Please reload the game.':
		'セッションの有効期限が切れました。ゲームを再読み込みしてください。',
	'A gambling limit on your account has been reached.': 'アカウントのプレイ上限に達しました。',
	'This game is not available from your location.':
		'このゲームはお客様の地域ではご利用いただけません。',
	'The game server had a problem. Please try again shortly.':
		'ゲームサーバーで問題が発生しました。しばらくしてからお試しください。',
	'The game is under maintenance. Please try again shortly.':
		'ゲームはメンテナンス中です。しばらくしてからお試しください。',
	'Skip the reveal': 'めくりをスキップ',
	'Session information': 'セッション情報',
	'Net Position': '収支',
	RTP: 'RTP',
	Session: 'セッション',
	Fast: '高速',
	'Number of plays': 'ラウンド数',
	'Unlimited plays': '無制限',
	'More plays': 'ラウンドを増やす',
	'Fewer plays': 'ラウンドを減らす',
	'Stop autoplay on full game win': 'フルゲーム達成でオートプレイを停止',
	'Close menu': 'メニューを閉じる',
	Close: '閉じる',
	'Game information': 'ゲーム情報',
	Disclaimer: '免責事項',
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.':
		'不具合が発生した場合、すべての勝利とプレイは無効となります。安定したインターネット接続が必要です。接続が切断された場合は、ゲームを再読み込みして未完了のラウンドを終了してください。期待還元率は多数のプレイを通じて算出されます。ゲーム画面は実在の機器を表すものではなく、説明目的のみです。勝利金はウェブブラウザ内の事象ではなく、Remote Game Server から受信した金額に基づいて精算されます。TM および © 2026 Stake Engine.',
	'Loading replay…': 'リプレイを読み込み中…',
	'Loading Ride The Bus…': 'Ride The Bus を読み込み中…',
	'Max Win': '最大配当',
	'Tap to continue': 'タップして続行',
	'Round details': 'ラウンド詳細',
	'Play amount': 'ベット額',
	Mode: 'モード',
	'Game mode': 'ゲームモード',
	Guesses: '予想',
	Event: 'イベント',
	Payout: '配当',
	Play: '再生',

	// Rule additions (new)
	Controls: '操作方法',
	'Plus and minus set your bet. Tap the amount for the quick-bet menu.':
		'プラスとマイナスでベット額を設定します。金額をタップするとクイックベットのメニューが開きます。',
	'The speaker opens the sound settings. Music and game sounds mute separately.':
		'スピーカーでサウンド設定を開きます。音楽とゲーム音は別々にミュートできます。',
	'The i button opens this screen.': 'i ボタンでこの画面を開きます。',
	'The lightning button is Turbo: how fast the cards flip, from Normal to Instant.':
		'稲妻ボタンはターボです。カードがめくられる速さを通常から瞬時まで調整します。',
	'The circular arrows open autoplay, which repeats your four guesses for a set number of rounds or unlimited. The counter sits on the button while it runs.':
		'円形の矢印でオートプレイを開きます。4つの予想を指定ラウンド数または無制限に繰り返し、実行中はボタンにカウンターが表示されます。',
	'The sliders button holds two autoplay options: stop on a full game win, and skip the win animations.':
		'スライダーボタンにはオートプレイの設定が2つあります。フルゲーム達成で停止と、勝利演出のスキップです。',
	'The large round button deals the round. So does the spacebar: tap for one round, hold to keep dealing. While autoplay runs the button becomes Stop, and the round in play finishes first.':
		'大きな丸いボタンでラウンドを配ります。スペースキーでも同様で、押すと1ラウンド、押し続けると配り続けます。オートプレイ中はボタンが停止に変わり、進行中のラウンドが先に終了します。',
	'Mode opens the game-mode picker. Switching asks you to confirm before it applies.':
		'モードでゲームモードの選択画面を開きます。切り替えは適用前に確認を求めます。',
	'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent four-card draw.':
		'このゲームにはフリースピン、ボーナスラウンド、ジャックポット、再トリガー機能はありません。各ラウンドは独立した1回の4枚カードドローです。',
	'Big Win': '大当たり',
	'Huge Win': '特大当たり',
	'Mega Win': 'メガウィン',
	'Epic Win': 'エピックウィン',
	'Tap to skip': 'タップしてスキップ',
	'Skip win animations on autoplay': 'オートプレイ中は勝利演出をスキップ',
	'Skip big win animations during autoplay': 'オートプレイ中は大当たり演出をスキップします',
	'Guess the color of card 1: red or black.': 'カード1の色を予想します。赤か黒か。',
	'Guess whether card 2 is higher or lower than card 1, or equal to it.':
		'カード2がカード1より高いか低いか、または同じかを予想します。',
	'Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either. After Equal on step 2 there is nothing to fall between, so Inside is unavailable.':
		'カード3がカード1と2の間に入るか、その外側か、どちらかと同じかを予想します。ステップ2でイコールを選んだあとは間に入る数字がないため、インは選べません。',
	'Guess the suit of card 4: hearts, diamonds, clubs or spades.':
		'カード4のスートを予想します。ハート、ダイヤ、クラブ、スペード。',
	'You guessed Equal, so cards 1 and 2 share a rank. Nothing can fall between them, so Inside cannot win.':
		'イコールを選んだため、カード1と2は同じ数字です。その間には何も入らないので、インは当たりません。',
	'Your four guesses top out at %s your bet.': '選んだ4つの予想の上限はベット額の%sです。',
	'Play Again': 'もう一度再生',
	'The round ends and pays nothing.':
		'ラウンドは終了し、配当はありません。',
	'The round ends, keeping about %s% of what you had built.':
		'ラウンドが終了し、積み上げた分の約%s%が残ります。',
	'From card 2 on, it is forgiven: you keep %s% of what you had built and the round carries on.':
		'カード2以降は免除され、積み上げた分の%s%を残してラウンドが続きます。',
};
