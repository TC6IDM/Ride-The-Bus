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

	Spin: 'スピン',
	Stop: '停止',
	left: '残り',
	'Pick all 4 guesses': '4つすべて選択してください',
	'Enter a valid bet': '有効なベット額を入力してください',
	'Set rounds': 'ラウンド数を設定',
	Start: '開始',

	'Bet Menu': 'ベットメニュー',
	'Quick Bets': 'クイックベット',

	'Turbo Speed': 'ターボ速度',
	Normal: '通常',
	Instant: '瞬時',
	'Off — full animation': 'オフ — 通常アニメーション',
	'% faster': '％高速',

	Autoplay: 'オートプレイ',
	'Number of Spins': 'ラウンド数',

	Advanced: '詳細設定',
	'Stop on full game win': 'フルゲーム達成で停止',

	'How to Play': '遊び方',
	'Guess your way through four cards:': '4枚のカードを順に予想します：',
	'Colour — red or black for card 1.': '色 — 1枚目が赤か黒か。',
	'Higher / Lower — versus card 1 (or =).': 'ハイ / ロー — 1枚目との比較（または＝）。',
	'Inside / Outside — between cards 1 & 2 (or =).':
		'イン / アウト — 1枚目と2枚目の間か外か（または＝）。',
	'Suit — the suit of card 4.': 'スート — 4枚目のスート。',
	'Pick all four, set your bet, and hit Spin. Each correct guess multiplies your win; a wrong guess ends the round but you keep whatever you had banked so far. Guess all four to win the full game.':
		'4つすべてを選び、ベット額を決めてスピンを押します。予想が当たるたびに配当が倍増し、外れるとラウンドは終了しますが、それまでに確保した分は残ります。4つすべて当てるとフルゲーム達成です。',
	'Card order': 'カードの強さ',
	'Ace is low and King is high — worth knowing, since plenty of card games play it the other way. Suit never affects rank; only the number counts for Higher / Lower and Inside / Outside.':
		'エースが最も弱く、キングが最も強くなります。逆のルールのカードゲームも多いので覚えておいてください。スートは強さに影響せず、ハイ / ロー とイン / アウトでは数字だけが関係します。',
	Lowest: '最弱',
	Highest: '最強',
	'Payouts follow the odds': '配当は確率に連動します',
	'Every correct guess pays its true odds, so the less likely your pick, the more it pays — and that depends on the cards already showing.':
		'的中はすべて本来の確率どおりに支払われます。選択が起こりにくいほど配当は高くなり、それは場に出ているカードによって決まります。',
	'With a 3 on the table, Lower pays about 4.75× because only 8 of the 51 remaining cards are lower, while Higher pays about 1.19× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about 1.57× and Higher rises to about 2.08×. Equal is always the longest shot at roughly 12×.':
		'場に3がある場合、残り51枚のうち3より小さいのは8枚だけなのでローは約4.75倍、逆に大きいのは40枚あるためハイは約1.19倍です。3が8になると関係は逆転し、ローは約1.57倍、ハイは約2.08倍になります。イコールは常に最も起こりにくく、およそ12倍です。',
	'If you guess wrong': '予想が外れた場合',
	'Card 1 — the round pays nothing.': '1枚目 — 配当はありません。',
	'Card 2 — you get 0.5× your bet back.': '2枚目 — ベット額の0.5倍が戻ります。',
	'Card 3 or 4 — you keep 30% of the multiplier you had built up, which ranges from 0.6× to 129×.':
		'3枚目または4枚目 — それまでに積み上げた倍率の30％が残り、0.6倍から129倍の範囲になります。',
	'Full game wins': 'フルゲーム達成時の配当',
	'Guess all four cards right and the payout depends on how hard your picks were:':
		'4枚すべて的中した場合、配当は選択の難しさによって変わります：',
	'No Equal picks — averages 17.3×, up to 317.4×.': 'イコールなし — 平均17.3倍、最大317.4倍。',
	'One Equal pick — averages 67.5×, up to 381.9×.': 'イコール1つ — 平均67.5倍、最大381.9倍。',
	'Two Equal picks — averages 1329.2×, up to 1354.2×, the most this game can pay.':
		'イコール2つ — 平均1329.2倍、最大1354.2倍。このゲームの上限です。',
	'Equal is the rarest guess, so the rounds built on it carry the largest wins — and are the hardest to land.':
		'イコールは最も珍しい予想なので、それを含むラウンドは配当が最も大きく、同時に最も達成が困難です。',
	'Speed and autoplay': '速度とオートプレイ',
	'Turbo (the lightning button) slides from Normal to Instant and changes only how fast the cards flip. It never changes the cards, the odds or the payout.':
		'ターボ（稲妻のボタン）は通常から瞬時まで調整でき、カードがめくれる速さだけを変えます。カードや確率、配当が変わることはありません。',
	'Autoplay (the circular arrows) replays the same four guesses for a set number of rounds, or unlimited. The round counter sits on the button while it runs — press the red square to stop, and the round already in play finishes first.':
		'オートプレイ（円形の矢印）は同じ4つの予想を指定回数または無制限に繰り返します。実行中はボタン上に残りラウンド数が表示されます。赤い四角を押すと停止しますが、進行中のラウンドは最後まで実行されます。',
	'Stop on full game win (the sliders button) ends an autoplay run the moment a round lands all four cards. It only stops the run; your bet never changes.':
		'「フルゲーム達成で停止」（スライダーのボタン）は、4枚すべて的中した時点でオートプレイを終了します。停止するだけで、ベット額が変わることはありません。',
	'Tap the spacebar to play one round, or hold it to keep spinning until you let go.':
		'スペースキーを押すと1ラウンド、押し続けると離すまで連続してプレイします。',

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
	'Spins must be %s seconds apart': 'ラウンドの間隔は%s秒必要です',
	'Round in progress': 'ラウンド進行中',
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
	'Number of spins': 'ラウンド数',
	'Unlimited spins': '無制限',
	'More spins': 'ラウンドを増やす',
	'Fewer spins': 'ラウンドを減らす',
	'Stop autoplay on a full game win': 'フルゲーム達成でオートプレイを停止',
	'Close menu': 'メニューを閉じる',
	Close: '閉じる',
	'Game information': 'ゲーム情報',
	'Return to player (RTP) is %s. Every combination of guesses costs 1x your bet and returns that same figure over many rounds. The most this game can pay is 1354.2x your bet.':
		'還元率（RTP）は %s です。どの予想の組み合わせもベット額の1倍で、多数のラウンドを通じて同じ還元率になります。このゲームの最大配当はベット額の1354.2倍です。',
	Disclaimer: '免責事項',
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and (c) 2026 Stake Engine.':
		'不具合が発生した場合、すべての勝利とプレイは無効となります。安定したインターネット接続が必要です。接続が切断された場合は、ゲームを再読み込みして未完了のラウンドを終了してください。期待還元率は多数のプレイを通じて算出されます。ゲーム画面は実在の機器を表すものではなく、説明目的のみです。勝利金はウェブブラウザ内の事象ではなく、Remote Game Server から受信した金額に基づいて精算されます。TM および (c) 2026 Stake Engine.',
	'Loading replay…': 'リプレイを読み込み中…',
	'Max Win': '最大配当',
	'Tap to continue': 'タップして続行',
	'Round details': 'ラウンド詳細',
	'Play amount': 'ベット額',
	Mode: 'モード',
	Event: 'イベント',
	Payout: '配当',
	Play: '再生',

	// Rule additions (new)
	'Payouts are dynamic and change based on which cards remain in the deck — the less likely your pick, the higher it pays. The same guess can return different amounts from one round to the next.':
		'配当は動的で、デッキに残っているカードによって変化します。予想が起こりにくいほど配当は高くなります。同じ予想でもラウンドごとに異なる金額になることがあります。',
	Controls: '操作方法',
	'Use the bet display and the plus and minus buttons to set your play amount. Tap the bet amount to open the quick-select menu.':
		'ベット表示とプラス・マイナスボタンでベット額を設定します。ベット額をタップするとクイック選択メニューが開きます。',
	'The speaker button mutes and unmutes the game sounds.':
		'スピーカーボタンでゲーム音のミュートと解除を切り替えます。',
	'The i button opens this screen at any time.': 'i ボタンでいつでもこの画面を開けます。',
	'The lightning button adjusts the speed of the card reveal.':
		'稲妻ボタンでカードがめくられる速度を調整します。',
	'The circular arrow button opens the autoplay settings.':
		'円形矢印ボタンでオートプレイ設定を開きます。',
	'The sliders button lets you toggle stop-on-full-win for autoplay runs.':
		'スライダーボタンでオートプレイ中のフルウィン時停止を切り替えられます。',
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
	'Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either of the first 2 cards. If you pick Equal on step 2, Inside becomes impossible: nothing can fall between two cards of the same rank.':
		'カード3がカード1と2の間か、その外側か、最初の2枚のどちらかと同じかを予想します。ステップ2でイコールを選ぶとインサイドは不可能になります。同じ数字の2枚のあいだには何も入りません。',
	'Guess the suit of card 4: hearts, diamonds, clubs or spades.':
		'カード4のスートを予想します。ハート、ダイヤ、クラブ、スペード。',
	'You guessed Equal, so cards 1 and 2 share a rank. Nothing can fall between them, so Inside cannot win.':
		'イコールを選んだため、カード1と2は同じ数字です。その間には何も入らないので、インサイドは当たりません。',
};
