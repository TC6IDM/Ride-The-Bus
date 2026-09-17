// Arabic. Keys are the English source strings - see en.ts.
// The only right-to-left locale here; i18n/direction.ts sets dir="rtl".
export default {
	HOME: 'الرئيسية',

	Balance: 'الرصيد',
	'Last Win': 'آخر فوز',
	Bet: 'الرهان',

	Color: 'اللون',
	Higher: 'أعلى',
	Lower: 'أقل',
	Inside: 'داخل',
	Outside: 'خارج',
	Suit: 'النوع',

	Winning: 'الربح',
	'Full Game Win!': 'فوز كامل!',
	Banked: 'محفوظ',
	Busted: 'خسارة',
	'Revealing…': 'جارٍ الكشف…',

	Deal: 'وزّع',
	Stop: 'إيقاف',
	left: 'متبقٍ',
	'Pick all 4 guesses': 'اختر التخمينات الأربعة',
	'Enter a number of plays': 'أدخل عدد الجولات',
	'Enter a valid bet': 'أدخل رهانًا صالحًا',
	'Set rounds': 'حدد عدد الجولات',
	Start: 'ابدأ',

	'Bet Menu': 'قائمة الرهان',
	'Quick Bets': 'رهانات سريعة',

	'Turbo Speed': 'سرعة التيربو',
	Normal: 'عادي',
	Instant: 'فوري',
	'Off: full animation': 'إيقاف: رسوم متحركة كاملة',
	'% faster': '٪ أسرع',

	'Sound settings': 'إعدادات الصوت',
	Sound: 'الصوت',
	Music: 'الموسيقى',
	'Game Sounds': 'أصوات اللعبة',
	'Mute music': 'كتم الموسيقى',
	'Unmute music': 'إلغاء كتم الموسيقى',
	'Mute game sounds': 'كتم أصوات اللعبة',
	'Unmute game sounds': 'إلغاء كتم أصوات اللعبة',

	Autoplay: 'اللعب التلقائي',
	'Number of Plays': 'عدد الجولات',

	Advanced: 'متقدم',
	'Game Mode': 'وضع اللعبة',
	'Choose game mode': 'اختر وضع اللعبة',
	Classic: 'كلاسيكي',
	'Second Chance': 'فرصة ثانية',
	'High Stakes': 'رهانات عالية',
	'Every mode costs %c× your bet and returns the same %s over many rounds. What changes is how often a round pays and how much it can pay.':
		'كل وضع يكلّف %c× من رهانك ويعيد النسبة نفسها %s على مدى جولات كثيرة. ما يتغير هو عدد مرات الربح ومقداره.',
	Forgiven: 'مُتسامَح عنها',
	'Game modes': 'أوضاع اللعبة',
	'Max win': 'أقصى ربح',
	// Confirmation before a bet mode is activated - required by the approval
	// checklist, and worth having anyway: the three families cost the same but
	// differ in what a miss keeps and how high they reach.
	'Switch mode?': 'تغيير الوضع؟',
	Cancel: 'إلغاء',
	Switch: 'تغيير',
	'Volatility %s of %t': 'التقلب %s من %t',
	'Return to player (RTP) is %s on every game mode. The most this game can pay is %m your bet, on High Stakes.':
		'نسبة العائد للاعب (RTP) هي %s في كل أوضاع اللعبة. وأقصى ما يمكن أن تدفعه هذه اللعبة هو %m من رهانك، في وضع الرهانات العالية.',
	'A wrong first card ends the round. Later misses keep 30% of what you had built.':
		'خطأ في البطاقة الأولى ينهي الجولة. الأخطاء اللاحقة تحتفظ بنسبة 30% مما جمعته.',
	'A wrong first card ends the round. After that your first miss is forgiven and play continues.':
		'خطأ في البطاقة الأولى ينهي الجولة. بعدها يُسامَح أول تخمين خاطئ ويستمر اللعب.',
	'Card 1': 'البطاقة 1',
	'Your first wrong guess': 'أول تخمين خاطئ لك',
	'Your second wrong guess': 'ثاني تخمين خاطئ لك',
	'Guess all four right and the payout depends on how hard your picks were. Equal is the rarest guess, so rounds built on it pay the most; two Equal picks together is the most this mode can pay, at %m your bet.':
		'أصب البطاقات الأربع كلها ويعتمد المكسب على صعوبة اختياراتك. «متساوٍ» هو أندر التخمينات، لذا فالجولات المبنية عليه تدفع الأكثر؛ واجتماع اختيارين «متساوٍ» هو أقصى ما يمكن أن يدفعه هذا الوضع، %m من رهانك.',
	'Only some guess combinations reach a mode’s maximum. Once your four are picked, their own ceiling is shown above.':
		'بعض تركيبات التخمينات فقط تبلغ الحد الأقصى للوضع. بعد اختيار تخميناتك الأربع، يُعرض سقفها الخاص أعلاه.',
	Playing: 'قيد اللعب',
	'Card 2, 3 or 4': 'البطاقة 2 أو 3 أو 4',
	'A wrong first card ends the round. Later misses keep only 20%, so every correct guess is worth more.':
		'خطأ في البطاقة الأولى ينهي الجولة. والأخطاء اللاحقة تحتفظ بنسبة 20% فقط، لذا تصبح كل تخمينة صحيحة أثمن.',

	'How to Play': 'كيفية اللعب',
	'Guess your way through four cards:': 'خمّن البطاقات الأربع بالترتيب:',
	'Color: red or black for card 1.': 'اللون: أحمر أو أسود للبطاقة الأولى.',
	'Higher / Lower: versus card 1 (or =).': 'أعلى / أقل: مقارنة بالبطاقة الأولى (أو =).',
	'Inside / Outside: between cards 1 & 2 (or =).':
		'داخل / خارج: بين البطاقتين الأولى والثانية (أو =).',
	'Suit: the suit of card 4.': 'النوع: نوع البطاقة الرابعة.',
	'Pick all four, set your bet and deal. Each right guess multiplies your win; get all four for a full game win. What a wrong guess costs you depends on the game mode, explained below.':
		'اختر التخمينات الأربعة، حدّد رهانك ووزّع. كل تخمين صحيح يضاعف ربحك؛ أصب الأربعة كلها لتحقق فوزًا كاملًا. أما ما يكلفك التخمين الخاطئ فيعتمد على وضع اللعبة، انظر أدناه.',
	'Card order': 'ترتيب البطاقات',
	'Ace is low and King is high. Suit never affects rank: only the number counts for Higher / Lower and Inside / Outside.':
		'الآس هو الأدنى والملك هو الأعلى. النوع لا يؤثر في الترتيب أبدًا: الرقم وحده هو ما يهم في أعلى / أقل وداخل / خارج.',
	Lowest: 'الأدنى',
	Highest: 'الأعلى',
	'Payouts follow the odds': 'المكافآت تتبع الاحتمالات',
	'Every correct guess pays its true odds against the cards left in the deck, so the less likely your pick, the more it pays, and the same guess can pay differently from one round to the next.':
		'كل تخمين صحيح يُدفع وفق احتمالاته الحقيقية مقابل البطاقات المتبقية في المجموعة، فكلما قل احتمال اختيارك زاد ما يدفعه، وقد يدفع التخمين نفسه مبلغًا مختلفًا من جولة إلى أخرى.',
	'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.':
		'مع وجود 3 على الطاولة، يدفع «أقل» نحو %1× لأن 8 فقط من البطاقات الـ51 المتبقية أقل منها، بينما يدفع «أعلى» نحو %2× لأن 40 منها أعلى. حوّل الـ3 إلى 8 فينقلب الأمر: ينخفض «أقل» إلى نحو %3× ويرتفع «أعلى» إلى نحو %4×. و«متساوٍ» هو دائمًا الأبعد احتمالًا بنحو %5×.',
	'Payout table': 'جدول الأرباح',
	Card: 'البطاقة',
	Pick: 'الاختيار',
	Pays: 'يدفع',
	'Red or Black': 'أحمر أو أسود',
	'Any suit': 'أي نوع',
	'Stages multiply together at full precision, so the figures above are exact. Only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded the same way at each step, so mid-round it can read slightly under these figures.':
		'تتضاعف الأدوار معًا بدقة كاملة، لذا فالأرقام أعلاه دقيقة. يُقرّب المكسب النهائي وحده نزولاً إلى خانة عشرية واحدة. ويُقرّب الإجمالي الظاهر بجانب الأوراق بالطريقة نفسها في كل خطوة، لذا قد يبدو أقل قليلاً من هذه الأرقام أثناء الجولة.',
	'If you guess wrong': 'إذا خمّنت خطأ',
	'Full game wins': 'الفوز الكامل',
	'Speed and skip settings change only what you see, never the cards, the odds or the payout.':
		'إعدادات السرعة والتخطي تغيّر ما تراه فقط، لا البطاقات ولا الاحتمالات ولا المكسب أبدًا.',

	'Pick a color': 'اختر لونًا',
	'Higher, lower, or equal': 'أعلى أو أقل أو متساوٍ',
	'Inside, outside, or equal': 'داخل أو خارج أو متساوٍ',
	'Pick a suit': 'اختر نوعًا',
	Red: 'أحمر',
	Black: 'أسود',
	Equal: 'متساوٍ',
	'Not possible after guessing Equal': 'غير ممكن بعد اختيار متساوٍ',
	Heart: 'قلب',
	Diamond: 'ديناري',
	Club: 'سباتي',
	Spade: 'بستوني',
	Mute: 'كتم الصوت',
	Unmute: 'إلغاء كتم الصوت',
	'How to play': 'كيفية اللعب',
	'Choose bet amount': 'اختر قيمة الرهان',
	'Custom bet amount': 'قيمة رهان مخصصة',
	'Increase bet': 'زيادة الرهان',
	'Decrease bet': 'خفض الرهان',
	'Turbo speed': 'سرعة التيربو',
	'Autoplay settings': 'إعدادات اللعب التلقائي',
	'Advanced settings': 'الإعدادات المتقدمة',
	'Stop autoplay': 'إيقاف اللعب التلقائي',
	'Rounds must be %s seconds apart': 'يجب أن يفصل بين الجولات %s ثانية',
	'Round in progress': 'الجولة جارية',
	'Insufficient funds': 'الرصيد غير كافٍ',
	'Bet is below the minimum of %s': 'الرهان أقل من الحد الأدنى %s',
	'Bet is above the maximum of %s': 'الرهان أعلى من الحد الأقصى %s',
	'Bet is locked while autoplay runs': 'الرهان مقفل أثناء تشغيل اللعب التلقائي',
	'Mode is locked while autoplay runs': 'وضع اللعبة مقفل أثناء تشغيل اللعب التلقائي',
	'Replays cannot be re-bet': 'لا يمكن إعادة الرهان على الإعادة',
	'Replay is view-only': 'الإعادة للعرض فقط',
	'No active game session': 'لا توجد جلسة لعب نشطة',
	Error: 'خطأ',
	Reload: 'إعادة التحميل',
	'Something went wrong. Please try again.': 'حدث خطأ ما. يُرجى المحاولة مرة أخرى.',
	'That bet was rejected. Please adjust the amount and try again.':
		'تم رفض هذا الرهان. يُرجى تعديل المبلغ والمحاولة مرة أخرى.',
	'Not enough balance for that bet.': 'الرصيد غير كافٍ لهذا الرهان.',
	'Your session has expired. Please reload the game.':
		'انتهت صلاحية جلستك. يُرجى إعادة تحميل اللعبة.',
	'A gambling limit on your account has been reached.': 'تم بلوغ أحد حدود المقامرة في حسابك.',
	'This game is not available from your location.': 'هذه اللعبة غير متاحة من موقعك.',
	'The game server had a problem. Please try again shortly.':
		'حدثت مشكلة في خادم اللعبة. يُرجى المحاولة بعد قليل.',
	'The game is under maintenance. Please try again shortly.':
		'اللعبة قيد الصيانة. يُرجى المحاولة بعد قليل.',
	'Skip the reveal': 'تخطي الكشف',
	'Session information': 'معلومات الجلسة',
	'Net Position': 'صافي المركز',
	RTP: 'نسبة العائد',
	Session: 'الجلسة',
	Fast: 'سريع',
	'Number of plays': 'عدد الجولات',
	'Unlimited plays': 'جولات بلا حد',
	'More plays': 'جولات أكثر',
	'Fewer plays': 'جولات أقل',
	'Stop autoplay on full game win': 'إيقاف اللعب التلقائي عند الفوز الكامل',
	'Close menu': 'إغلاق القائمة',
	Close: 'إغلاق',
	'Game information': 'معلومات اللعبة',
	Disclaimer: 'إخلاء المسؤولية',
	'Malfunction voids all wins and plays. A consistent internet connection is required. In the event of a disconnection, reload the game to finish any uncompleted rounds. The expected return is calculated over many plays. The game display is not representative of any physical device and is for illustrative purposes only. Winnings are settled according to the amount received from the Remote Game Server and not from events within the web browser. TM and © 2026 Stake Engine.':
		'أي خلل يلغي جميع المكاسب والجولات. يلزم اتصال إنترنت مستقر. في حالة انقطاع الاتصال، أعد تحميل اللعبة لإكمال أي جولات غير منتهية. يُحسب العائد المتوقع على مدى عدد كبير من الجولات. لا تمثل شاشة اللعبة أي جهاز فعلي وهي لأغراض توضيحية فقط. تتم تسوية المكاسب وفقًا للمبلغ الوارد من خادم اللعبة البعيد وليس وفقًا للأحداث داخل متصفح الويب. TM و © 2026 Stake Engine.',
	'Loading replay…': 'جارٍ تحميل الإعادة…',
	'Loading Ride The Bus…': 'جارٍ تحميل Ride The Bus…',
	'Max Win': 'أقصى ربح',
	'Tap to continue': 'اضغط للمتابعة',
	'Round details': 'تفاصيل الجولة',
	'Play amount': 'مبلغ الرهان',
	Mode: 'الوضع',
	'Game mode': 'وضع اللعبة',
	Guesses: 'التخمينات',
	Event: 'الحدث',
	Payout: 'العائد',
	Play: 'تشغيل',

	// Rule additions (new)
	Controls: 'أدوات التحكم',
	'Plus and minus set your bet. Tap the amount for the quick-bet menu.':
		'زرا الزائد والناقص يحددان رهانك. اضغط على المبلغ لفتح قائمة الرهانات السريعة.',
	'The speaker opens the sound settings. Music and game sounds mute separately.':
		'مكبر الصوت يفتح إعدادات الصوت. تُكتم الموسيقى وأصوات اللعبة كلٌّ على حدة.',
	'The i button opens this screen.': 'زر i يفتح هذه الشاشة.',
	'The lightning button is Turbo: how fast the cards flip, from Normal to Instant.':
		'زر البرق هو التيربو: مدى سرعة قلب البطاقات، من عادي إلى فوري.',
	'The circular arrows open autoplay, which repeats your four guesses for a set number of rounds or unlimited. The counter sits on the button while it runs.':
		'السهمان الدائريان يفتحان اللعب التلقائي، الذي يكرر تخميناتك الأربعة لعدد محدد من الجولات أو بلا حد. يظهر العدّاد على الزر أثناء التشغيل.',
	'The sliders button holds two autoplay options: stop on a full game win, and skip the win animations.':
		'زر المنزلقات يضم خيارين للعب التلقائي: التوقف عند الفوز الكامل، وتخطي مؤثرات الفوز.',
	'The large round button deals the round. So does the spacebar: tap for one round, hold to keep dealing. While autoplay runs the button becomes Stop, and the round in play finishes first.':
		'الزر الدائري الكبير يوزّع الجولة. ومفتاح المسافة كذلك: اضغطه لجولة واحدة أو اضغطه باستمرار لمواصلة التوزيع. أثناء اللعب التلقائي يتحول الزر إلى إيقاف، وتُكمَل الجولة الجارية أولًا.',
	'Mode opens the game-mode picker. Switching asks you to confirm before it applies.':
		'زر الوضع يفتح قائمة أوضاع اللعبة. يطلب التبديل تأكيدك قبل تطبيقه.',
	'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent four-card draw.':
		'لا تحتوي هذه اللعبة على لفات مجانية أو جولات مكافأة أو جوائز كبرى أو ميزات إعادة التفعيل. كل جولة هي سحب مستقل واحد لأربع بطاقات.',
	'Big Win': 'فوز كبير',
	'Huge Win': 'فوز ضخم',
	'Mega Win': 'فوز هائل',
	'Epic Win': 'فوز أسطوري',
	'Tap to skip': 'اضغط للتخطي',
	'Skip win animations on autoplay': 'تخطي مؤثرات الفوز أثناء اللعب التلقائي',
	'Skip big win animations during autoplay': 'تخطي مؤثرات الفوز الكبير أثناء اللعب التلقائي',
	'Guess the color of card 1: red or black.': 'خمّن لون البطاقة الأولى: أحمر أم أسود.',
	'Guess whether card 2 is higher or lower than card 1, or equal to it.':
		'خمّن ما إذا كانت البطاقة الثانية أعلى أم أقل من الأولى، أو مساوية لها.',
	'Guess whether card 3 lands between cards 1 and 2, outside them, or equal to either. After Equal on step 2 there is nothing to fall between, so Inside is unavailable.':
		'خمّن ما إذا كانت البطاقة 3 ستقع بين البطاقتين 1 و2، أو خارجهما، أو مساوية لإحداهما. بعد اختيار «متساوٍ» في الخطوة 2 لا يوجد ما يقع بينهما، لذا يصبح «داخل» غير متاح.',
	'Guess the suit of card 4: hearts, diamonds, clubs or spades.':
		'خمّن نوع البطاقة الرابعة: قلوب أو ديناري أو سباتي أو بستوني.',
	'You guessed Equal, so cards 1 and 2 share a rank. Nothing can fall between them, so Inside cannot win.':
		'اخترت متساوٍ، لذا فالبطاقتان الأولى والثانية لهما القيمة نفسها. لا شيء يقع بينهما، لذلك لا يمكن أن يفوز «داخل».',
	'Your four guesses top out at %s your bet.':
		'تخميناتك الأربعة تصل إلى حد أقصى قدره %s من رهانك.',
	'Play Again': 'تشغيل مرة أخرى',
	'The round ends and pays nothing.':
		'تنتهي الجولة ولا تدفع شيئًا.',
	'The round ends, keeping about %s% of what you had built.':
		'تنتهي الجولة مع الاحتفاظ بنحو %s% مما جمعته.',
	'From card 2 on, it is forgiven: you keep %s% of what you had built and the round carries on.':
		'من الورقة 2 فصاعدًا يُتجاوز عنه: تحتفظ بـ %s% مما جمعته وتستمر الجولة.',
};
