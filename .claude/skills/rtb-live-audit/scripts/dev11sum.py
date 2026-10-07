import json
import sys

flags = []
for path in sys.argv[1:]:
    for r in json.load(open(path, encoding="utf-8")):
        fams = r.get("fams", [])
        bars = {tuple(f["bar"]) for f in fams}
        btns = {tuple(f["btn"]) for f in fams}
        rows = {f["rows"] for f in fams}
        line = f'{r["lang"]:3} {r["name"]:8} prompt="{r.get("prompt")}" bars={sorted(bars)} btn={sorted(btns)} rows={sorted(rows)}'
        print(line)
        for f in fams:
            print(f'      {f["t"][:22]:22} fs={f["fs"]:5} bolts={f["bolts"]} over={f["over"]} out={f["outside"]} ink={f["ink"]} bet="{f["bet"]}"')
            if f["over"] or f["outside"] or f["scroll"]:
                flags.append(f'{r["lang"]} {r["name"]} {f["t"]} over/outside/scroll')
            if r["name"] != "popoutS" and f["bolts"] != 7:
                flags.append(f'{r["lang"]} {r["name"]} {f["t"]} bolts={f["bolts"]}')
            if r["name"] == "popoutS" and f["bolts"]:
                flags.append(f'{r["lang"]} {r["name"]} {f["t"]} bolts shown on Popout S')
        print("      label:", fams[-1]["label"] if fams else None)
        print("      type:", r.get("type"), "| quickBet:", r.get("quickBet"), "| err:", r.get("err"))
        if len(bars) > 1 or len(btns) > 1 or len(rows) > 1:
            flags.append(f'{r["lang"]} {r["name"]} bar/btn/rows change with family: {bars} {btns} {rows}')
print("FLAGS:", *flags, sep="\n  ")
