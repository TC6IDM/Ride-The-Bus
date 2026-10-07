import re
p = r"C:\Users\tcand\Desktop\Ride-The-Bus-monorepo\RGS_TEST_PLAN.md"
s = open(p, encoding="utf-8").read()
TAG = "**Live 2026-10-05** (front v71 = a177bf85, math v13, Studio demo session):"
R = {
 "BET-14": (True, "on a $300,000 USD session, the $250,000 chip (base $1,000 = maxBet) sent amount 1,000,000,000 with tr_any_equal_equal; accepted; balance fell by exactly 250 x base. The cap is on the BASE amount. Note: this demo template allows a $250,000 round cost, over the 2-star $100,000 maximum bet cost - the bet-level template Stake applies must keep trips under it. On trips the bet menu lists chips by round COST ($2.50 to $250,000)."),
 "RND-05": (True, "went offline right after an active play response: the reveal finished as Banked 0.6x with no error shown; back online, a frame reload returned the open round in authenticate, the game sent the missing end-round (200, exact credit) and the next round played. No ERR_VAL lock."),
 "JUR-01": (True, "SIMULATED - authenticate's jurisdiction block rewritten in the browser only (the uploaded build reads it): disabledAutoplay removes the autoplay control; disabledSuperTurbo caps the turbo slider at 0.8; disabledTurbo removes Turbo; disabledSpacebar - a Space tap plays nothing; disabledSlamstop - the spin never becomes Skip; displayRTP / NetPosition / SessionTimer show the RG plate (NET POSITION, RTP 96.00%, SESSION). No page errors."),
 "JUR-02": (True, "SIMULATED - the jurisdiction block deleted from authenticate: everything permitted (Turbo to 1, autoplay, Space, Skip), no page errors, rounds play."),
 "JUR-03": (True, "SIMULATED - minimumRoundDuration 2500 with turbo at Instant, Skip pressed and Deal/Space hammered: next play 2.56 s after the last; tooltip \"Rounds must be 2.5 seconds apart\"."),
 "CUR-03": (True, "social session (currency XSC): \"Balance 1000.00 SC\", \"Play 1.00 SC\" - suffix, no $. Minor: SC amounts are not digit-grouped (\"4583.30 SC\" beside \"4,583.3x\")."),
 "CUR-05": (True, "USD, 42 levels: $0.01 and $1,000.00 both selected and PLAYED ($1,000 accepted, 0.5x credited $500.00 exactly); the bet panel scrolls inside itself, the frame never does."),
 "WIN-11": (True, "How to Play on Red/Higher/Outside/Heart: \"Max win 1,354.2x your bet\" plus \"Your four guesses top out at 68.2x your bet\" (= REPLAY_EVENTS win cap). BUT on Red/Equal/Equal/Heart the second line is NOT suppressed (\"top out at 1,354.2x\" under \"Max win 1,354.2x\") - finding F-7."),
 "REP-01": (True, "Studio-format replay URLs (game UUID 019f7e00-fa38-78fa-9ea7-b4933e75765b, version 13): Classic #82 (1.1x), #2484 (68.2x), trips #2 (4583.3x), ls #9426 (200.3x, x10 ticket), sc #128 (19.1x forgiven) - board chips and payout match the /bet/replay book every time."),
 "REP-02": (True, "RESOLVED. The Studio's own Replay panel builds amount=10000 for $0.01 - micro-units, which is what the game assumes; the details panel reads Play amount $0.01 / $1.00 exactly as sent. The 1000x gap seen earlier was not this path."),
 "REP-03": (True, "zero /wallet calls across six replays and a Play Again; Increase/Decrease bet, Autoplay and Mode all disabled."),
 "REP-06": (True, "Play Again appears with the result kept on screen; it stays disabled while a takeover is up and enables the moment it closes; it re-runs the round with no /wallet call."),
 "REP-07": (True, "#82 at 400 x 225: Play Again reachable and enabled, no frame scroll."),
 "REP-09": (True, "trips #2: \"Play amount $1.00 / Round cost $250.00 (x250) / Game mode Three of a Kind / Cards Any Equal Equal / Payout 4,583.3x\"; three cards; chips 916.6x / 4,583.3x."),
 "LNG-05": (True, "en_US, zz!!, en;a, empty and absent all render English with every money figure; po renders Polish (\"Saldo 526,39 USD\"); no console errors beyond F-5's fonts."),
 "CMP-01": (True, "96.00% on all five How to Play tabs, reachable at any time from the i button."),
 "CMP-02": (True, "family ceilings stated: 1,354.2x / 585.2x / 4,301.9x / 2,237.3x / 4,583.3x - match the build."),
 "CMP-03": (True, "malfunction voids, connection required, reload to finish, expected return over many plays, display illustrative, settled by the Remote Game Server."),
 "CMP-05": (True, "providerName 'Takeover Casino' (game/platform/config.ts)."),
 "CMP-06": (True, "six pay-range rows per guess tab, with \"These figures are exact: the stages multiply at full precision...\"."),
 "CMP-07": (True, "five tabs; each states blurb, ceiling and \"This mode costs 1x your bet\" (250x on Three of a Kind)."),
 "CMP-08": (True, "Controls names the deal button and Space, MODE, plus/minus, Turbo, autoplay and its stops, the speaker, i, the die and keys 1-4."),
 "CMP-09": (True, "Music and Game sounds mute independently without moving their sliders (75 stays 75); the bar's speaker crosses only when both are muted; all four settings survive a reload (localStorage ride-the-bus:* works inside Stake's iframe). Ears still needed for 'muted is silent'."),
 "CMP-10": (True, "one Space tap = one round; Space with the bet field focused = no round (it types a trailing space into the field); with How to Play open = no round; during a takeover the first Space does nothing, the second dismisses it, neither deals."),
 "CMP-11": (True, "no frame scroll at all seven sizes (phones touch-emulated), idle, with the bet menu open (it scrolls internally) and with How to Play open."),
 "CMP-16": (True, "one track, static/music/A.mp3, is the only music request; ASSET_LICENCES.md carries its paid-tier row and hash; mute works (CMP-09). Ears still needed on real speakers."),
 "DEV-01": (True, "EMULATED Mobile M (375 x 667, touch, coarse pointer) on the live build: picks, bet and a full round played (/wallet/play 200, bust shown with its cross and ring). Real-phone sign-off still owed."),
 "SOC-01": (True, "social session swept against Stake's prohibited-term table (the socialMessages.test.ts list): intro, board, bet menu, autoplay panel, sound panel, mode picker and confirmation, all five How to Play tabs, a settled round - no hits. Copy defect: \"Stop auto play on full game won\" / \"Full game won\" - finding F-10."),
 "SOC-02": (True, "High Stakes reads \"High Risk\" in the picker and the tabs."),
 "SOC-03": (True, "social + lang=de renders English, dir=ltr."),
 "SOC-04": (True, "\"1000.00 SC\" suffix everywhere, no $ prefix."),
 "SOC-05": (True, "social replay of trips #2: \"Play amount 1.00 SC / Round cost 250.00 SC (x250) / Won 4,583.3x\"; takeover \"Max Win 4583.30 SC\" - no prohibited word."),
 "REP-05": (True, "sc #128 details: \"Game mode Second Chance / Guesses Red Higher Equal Spade\" - no raw slug."),
 "REP-10": (True, "ls #9426 details carry \"Ticket x10\"; the takeover lays the x10 ticket on the hand."),
 "CMP-04": (True, "\"This game has no free spins, bonus rounds, jackpots, or re-trigger features.\""),
 "WIN-06": (True, "Space dismisses the takeover (second press) without dealing."),
}
n = 0
for tid, (ok, note) in R.items():
    pat = re.compile(r"^- \[ \] (\*\*" + re.escape(tid) + r" ·[^\n]*)$", re.M)
    m = pat.search(s)
    if not m: print("missing", tid); continue
    s = s[:m.start()] + f"- {'[x]' if ok else '[ ]'} {m.group(1)}\n  {TAG} {note}" + s[m.end():]
    n += 1
open(p, "w", encoding="utf-8", newline="\n").write(s)
print(n, "recorded")
