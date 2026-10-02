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
	'Full game win': 'فوز كامل',
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

	'Bet menu': 'قائمة الرهان',
	'Quick bets':
		'رهانات سريعة',

	Normal: 'عادي',
	Instant: 'فوري',
	'Off: full animation': 'إيقاف: رسوم متحركة كاملة',
	'% faster': '٪ أسرع',

	'Sound settings': 'إعدادات الصوت',
	Sound: 'الصوت',
	Music: 'الموسيقى',
	'Game sounds':
		'أصوات اللعبة',
	'Mute music': 'كتم الموسيقى',
	'Unmute music': 'إلغاء كتم الموسيقى',
	'Mute game sounds': 'كتم أصوات اللعبة',
	'Unmute game sounds': 'إلغاء كتم أصوات اللعبة',

	Autoplay: 'اللعب التلقائي',

	'Choose game mode': 'اختر وضع اللعبة',
	Classic: 'كلاسيكي',
	'Second Chance': 'فرصة ثانية',
	'High Stakes': 'رهانات عالية',
	'This mode costs %c× your bet. Every mode returns the same %s over many rounds; what changes is how often a round pays and how much it can pay.':
		'هذا الوضع يكلّف %c× رهانك. كل الأوضاع تعيد نفس %s على مدى جولات كثيرة؛ ما يتغيّر هو كم مرة تدفع الجولة وكم يمكن أن تدفع.',
	Forgiven: 'مُتسامَح عنها',
	// The intro's tagline and the first line of How to Play's Game modes.
	'%n ways to play': '%n طريقة للعب',
	'There are %n ways to play: every set of picks is its own bet, priced on its own odds.':
		'عدد طرق اللعب: %n. كل مجموعة اختيارات هي رهان مستقل بذاته، يُسعَّر وفق احتمالاته الخاصة.',
	'Game modes': 'أوضاع اللعبة',
	// Confirmation before a bet mode is activated - required by the approval
	// checklist, and worth having anyway: the guess families cost the same but
	// differ in what a miss keeps and how high they reach.
	'Switch mode?': 'تغيير الوضع؟',
	Cancel: 'إلغاء',
	Switch: 'تغيير',
	'Volatility %s of %t': 'التقلب %s من %t',
	'Return to player (RTP) is %s on every game mode. The most this game can pay is %m your bet, on %f.':
		'نسبة العائد للاعب (RTP) هي %s في كل أوضاع اللعبة. وأقصى ما يمكن أن تدفعه هذه اللعبة هو %m من رهانك، في وضع %f.',
	'A wrong first card ends the round. Later misses keep 30% of your running total.':
		'خطأ في البطاقة الأولى ينهي الجولة. الأخطاء اللاحقة تحتفظ بنسبة 30% من إجماليك الجاري.',
	'A wrong first card ends the round. After that your first miss is forgiven and play continues.':
		'خطأ في البطاقة الأولى ينهي الجولة. بعدها يُسامَح أول تخمين خاطئ ويستمر اللعب.',
	'Card 1': 'البطاقة 1',
	'Your first wrong guess': 'أول تخمين خاطئ لك',
	'Your second wrong guess': 'ثاني تخمين خاطئ لك',
	'A full game win pays more the harder your picks were. Equal is the rarest guess, so it pays the most, and two Equal picks reach this mode’s maximum: %m your bet.':
		'يزداد ما يدفعه الفوز الكامل كلما كانت اختياراتك أصعب. «متساوٍ» هو أندر التخمينات، لذا يدفع الأكثر، واختياران «متساوٍ» يبلغان الحد الأقصى لهذا الوضع: %m من رهانك.',
	'Only some combinations reach the mode’s maximum. Once your four are picked, the most they can pay is shown above.':
		'بعض التركيبات فقط تبلغ الحد الأقصى للوضع. بعد اختيار تخميناتك الأربعة، يُعرض أعلاه أقصى ما يمكن أن تدفعه.',
	Playing: 'قيد اللعب',
	'Card 2, 3 or 4': 'البطاقة 2 أو 3 أو 4',
	'A wrong first card ends the round. Later misses keep only 15%, so every correct guess is worth more.':
		'خطأ في البطاقة الأولى ينهي الجولة. والأخطاء اللاحقة تحتفظ بنسبة 15% فقط، لذا تصبح كل تخمينة صحيحة أثمن.',

	'Guess your way through four cards:': 'خمّن البطاقات الأربع بالترتيب:',
	'Color: is card 1 red or black?':
		'اللون: هل البطاقة الأولى حمراء أم سوداء؟',
	'Higher or Lower: is card 2 above or below card 1, or Equal to it?':
		'أعلى أو أقل: هل البطاقة الثانية أعلى من الأولى أم أقل منها، أم «متساوٍ»؟',
	'Inside or Outside: is card 3 between cards 1 and 2 or outside them, or Equal to one of them?':
		'داخل أو خارج: هل تقع البطاقة الثالثة بين البطاقتين الأولى والثانية أم خارجهما، أم «متساوٍ» مع إحداهما؟',
	'Suit: which suit is card 4?':
		'النوع: ما نوع البطاقة الرابعة؟',
	'Pick all four, set your bet and deal. Each right guess multiplies your win, and four right is a full game win. What a wrong guess costs depends on the game mode; see Game modes below.':
		'اختر التخمينات الأربعة، حدّد رهانك ووزّع. كل تخمين صحيح يضاعف ربحك، وإصابة الأربعة فوز كامل. أما ما يكلفك التخمين الخاطئ فيعتمد على وضع اللعبة؛ انظر أوضاع اللعبة أدناه.',
	'Card order': 'ترتيب البطاقات',
	'Ace is low and King is high. Suits have no rank: only the card’s value counts for Higher, Lower, Inside and Outside.':
		'الآس هو الأدنى والملك هو الأعلى. لا ترتيب للأنواع: قيمة البطاقة وحدها هي ما يهم في أعلى وأقل وداخل وخارج.',
	Lowest: 'الأدنى',
	Highest: 'الأعلى',
	'Payouts follow the odds': 'المكافآت تتبع الاحتمالات',
	'Each right guess is priced on the cards still in the deck: the less likely it is, the more it pays. So the same guess can pay differently from one round to the next.':
		'كل تخمين صحيح يُسعَّر وفق البطاقات المتبقية في المجموعة: كلما قل احتماله زاد ما يدفعه. لذا قد يدفع التخمين نفسه مبلغًا مختلفًا من جولة إلى أخرى.',
	'With a 3 on the table, Lower pays about %1× because only 8 of the 51 remaining cards are lower, while Higher pays about %2× because 40 of them are. Turn that 3 into an 8 and it flips: Lower drops to about %3× and Higher rises to about %4×. Equal is always the longest shot at roughly %5×.':
		'مع وجود 3 على الطاولة، يدفع «أقل» نحو %1× لأن 8 فقط من البطاقات الـ51 المتبقية أقل منها، بينما يدفع «أعلى» نحو %2× لأن 40 منها أعلى. حوّل الـ3 إلى 8 فينقلب الأمر: ينخفض «أقل» إلى نحو %3× ويرتفع «أعلى» إلى نحو %4×. و«متساوٍ» هو دائمًا الأبعد احتمالًا بنحو %5×.',
	'Payout table': 'جدول الأرباح',
	Card: 'البطاقة',
	Pick: 'الاختيار',
	Pays: 'يدفع',
	'Total':
		'الإجمالي',
	'Red or Black': 'أحمر أو أسود',
	'Any suit': 'أي نوع',
	'These figures are exact: the stages multiply at full precision, and only the final payout is rounded down, to one decimal place. The running total beside the cards is rounded down as it goes, so mid-round it can read a little under them.':
		'هذه الأرقام دقيقة: تتضاعف الأدوار معًا بدقة كاملة، ولا يُقرَّب نزولاً إلى خانة عشرية واحدة إلا المكسب النهائي. ويُقرَّب الإجمالي الجاري بجانب الأوراق نزولاً أثناء الجولة، لذا قد يبدو أقل قليلاً.',
	'If you guess wrong': 'إذا خمّنت خطأ',
	'Full game wins': 'الفوز الكامل',
	'Turbo and skipping win animations change only what you see, never the cards, the odds or the payout.':
		'التيربو وتخطي مؤثرات الفوز يغيّران ما تراه فقط، لا البطاقات ولا الاحتمالات ولا المكسب أبدًا.',

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
	Cards: 'الأوراق',
	'Round cost': 'تكلفة الجولة',
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
	'The circular arrows open autoplay: the same bet, dealt again for a set number of rounds or without limit. The button counts down the rounds left.':
		'السهمان الدائريان يفتحان اللعب التلقائي: الرهان نفسه يُوزَّع مجددًا لعدد محدد من الجولات أو بلا حد. ويعدّ الزر الجولات المتبقية تنازليًا.',
	'The big round button deals. So does the spacebar: tap for one round, hold to keep dealing. During autoplay it becomes Stop, and the round in play finishes first.':
		'الزر الدائري الكبير يوزّع. ومفتاح المسافة كذلك: اضغطه لجولة واحدة أو اضغطه باستمرار لمواصلة التوزيع. أثناء اللعب التلقائي يتحول إلى إيقاف، وتُكمَل الجولة الجارية أولًا.',
	'Mode opens the game-mode picker. Switching asks you to confirm before it applies.':
		'زر الوضع يفتح قائمة أوضاع اللعبة. يطلب التبديل تأكيدك قبل تطبيقه.',
	'This game has no free spins, bonus rounds, jackpots, or re-trigger features. Every round is a single, independent deal: four cards on the guess modes, three on Three of a Kind.':
		'لا تحتوي هذه اللعبة على لفات مجانية أو جولات مكافأة أو جوائز كبرى أو ميزات إعادة التفعيل. كل جولة هي توزيع مستقل واحد: أربع أوراق في أوضاع التخمين، وثلاث في ثلاث متشابهة.',
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
	'The round ends, and you keep about %s% of your running total.':
		'تنتهي الجولة وتحتفظ بنحو %s% من إجماليك الجاري.',
	'From card 2 on, it is forgiven: you keep %s% of your running total and play on.':
		'من الورقة 2 فصاعدًا يُتجاوز عنه: تحتفظ بـ %s% من إجماليك الجاري وتواصل اللعب.',

	// Three of a Kind.
	'Three of a Kind':
		'ثلاث متشابهة',
	'Three cards from a 12-card deck of Aces, Kings and Queens. Cards 2 and 3 must match card 1; anything less pays nothing.':
		'ثلاث أوراق من مجموعة من 12 ورقة تضم الآسات والملوك والملكات. يجب أن تطابق الورقتان 2 و3 الورقة 1؛ وأي شيء أقل لا يدفع شيئًا.',
	'Costs %c× your bet':
		'التكلفة %c× رهانك',
	'Any':
		'أي',
	'Any card':
		'أي ورقة',
	'A card that does not match':
		'ورقة لا تطابق',
	'If a card does not match':
		'إذا لم تطابق ورقة',
	'Card 1 is dealt, not guessed. The deck holds one Ace, King and Queen of each suit, so card 2 matches 3 times in 11 and card 3 twice in 10.':
		'تُوزَّع الورقة 1 ولا تُخمَّن. تضم المجموعة آسًا وملكًا وملكة من كل نوع، لذا تطابق الورقة 2 في 3 من 11 مرة، والورقة 3 في 2 من 10.',
	'Each figure is the running total after that card, in multiples of your bet, exactly as the board shows it beside the cards. Only the last card pays.':
		'كل رقم هو الإجمالي المتراكم بعد تلك الورقة، بمضاعفات رهانك، تمامًا كما تعرضه الطاولة بجانب الأوراق. الورقة الأخيرة وحدها هي التي تدفع.',
	'Three of a kind pays %m your bet, about one round in %n.':
		'الثلاث المتشابهة تدفع %m من رهانك، أي نحو جولة واحدة من كل %n.',
	'%c× your base bet of %b':
		'%c× من رهانك الأساسي البالغ %b',
	'*On %f. Each game mode has its own maximum win, shown in the mode picker and in How to Play.':
		'*في وضع %f. لكل وضع لعب حده الأقصى للفوز، ويظهر في اختيار الوضع وفي طريقة اللعب.',
	'That mode costs %c× your bet.':
		'تكلفة هذا الوضع %c× رهانك.',
	'Card 2 must match card 1':
		'يجب أن تطابق الورقة 2 الورقة 1',
	'Card 3 must match card 1':
		'يجب أن تطابق الورقة 3 الورقة 1',
	'%n of %t':
		'%n من %t',
	'Last card':
		'البطاقة الأخيرة',
	'Example round':
		'مثال على جولة',
	'Tap the amount for the quick-bet menu.':
		'اضغط على المبلغ لفتح قائمة الرهانات السريعة.',
	'Max win %s your bet':
		'أقصى ربح %s من رهانك',
	'Stop on a loss of':
		'التوقف عند خسارة قدرها',
	'Stop on a single win of':
		'التوقف عند ربح واحد قدره',
	'On a keyboard, keys 1 to 4 change the four guesses.':
		'على لوحة المفاتيح، تغيّر المفاتيح من 1 إلى 4 التخمينات الأربعة.',
	'It can stop by itself on a full game win, a loss limit or one big win.':
		'ويمكنه التوقف تلقائيًا عند الفوز الكامل أو حد الخسارة أو ربح واحد كبير.',
	'× means times your base bet.':
		'× تعني مضاعفات رهانك الأساسي.',
	'Times your base bet':
		'مضاعفات رهانك الأساسي',
	'Last Stop':
		'المحطة الأخيرة',
	'A wrong first card ends the round. Later misses keep 30% of your running total. A right suit draws a ticket that multiplies it by 2 to 10.':
		'خطأ في البطاقة الأولى ينهي الجولة. الأخطاء اللاحقة تحتفظ بنسبة 30% من إجماليك الجاري. وإصابة النوع تسحب تذكرة تضربه في 2 إلى 10.',
	'Ticket':
		'تذكرة',
	'The ticket':
		'التذكرة',
	'Drawn only when all four are right, from a stack of 20. It multiplies your running total.':
		'تُسحب فقط عندما تصيب في الأربعة، من رزمة من 20 تذكرة. وتضرب إجماليك الجاري.',
	'Cards 1 to 3 are priced exactly as on Classic. A right suit draws the ticket in place of a price.':
		'البطاقات من 1 إلى 3 مسعّرة تمامًا كما في الوضع الكلاسيكي. وإصابة النوع تسحب التذكرة بدلًا من سعر.',
	'On Classic the same cards end at %s.':
		'في الوضع الكلاسيكي تنتهي البطاقات نفسها عند %s.',
	'A full game win pays more the harder your picks were, and the ticket multiplies it. Two Equal picks and a ×10 ticket reach this mode’s maximum: %m your bet.':
		'يزداد ما يدفعه الفوز الكامل كلما كانت اختياراتك أصعب، والتذكرة تضاعفه. اختياران «متساوٍ» وتذكرة ×10 يبلغان الحد الأقصى لهذا الوضع: %m من رهانك.',
	'Roll the die for random guesses':
		'ارمِ النرد لتخمينات عشوائية',
	'The die beside the guesses picks all four at random. Nothing is played until you deal.':
		'النرد بجانب التخمينات يختار الأربعة عشوائيًا. لا يُلعب شيء حتى توزّع.',
};
