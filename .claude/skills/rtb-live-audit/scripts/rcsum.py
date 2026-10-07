import json
import sys

d = json.load(open(sys.argv[1], encoding="utf-8"))
for c in d:
    b = c["book"] or {}
    print("==", c["tag"], "| pm", b.get("pm"), "cost", b.get("cost"), "| wallet calls", c["walletCalls"])
    print("   book:", (b.get("events") or "")[:220])
    print("   details:", (c["details"] or "")[:200])
    print("   fan:", c["fan"], "| stake seen:", c.get("stake"))
    print("   climb:", [(x.get("title"), x.get("amount"), x.get("lastAmount"), x.get("lastMult")) if "NEGATIVE" not in x else x for x in c["climb"]][:6])
    e = c["end"]
    print("   end:", e["readout"], "| ink", e.get("labelInk"), "| chips", e["chips"])
    print("   chipInk:", e.get("chipInk"))
    print("   cards:", e["cards"], "| ticket", e["ticket"])
    print("   names:", e.get("cardNames"))
    print("   announce:", e.get("announce"))
    print("   bar:", e["lastWin"], "| lastWinButton", e.get("lastWinButton"), "|", e["bet"], "|", e["caption"], "| scroll", e["scroll"], "| dir", e["dir"], e["lang"])
