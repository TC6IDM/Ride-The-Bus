"""
A live view of the math build, in a browser, for the 40 minutes it runs.

WHY. `run.py` is ~44M simulations across 193 bet modes and prints a scrolling
wall of text: which mode it is on, eight workers starting, eight finishing with
their own RTP, files being written, then a reweight, a verification and two
scans. All of it is there, none of it is legible - there is no way to see how
far in it is, which modes are done, how long is left, or whether a worker is
wedged. This serves the same run as 193 boxes, four stage bars and an ETA, and
keeps every line of output beside them.

HOW IT ATTACHES. `run.py` re-executes ITSELF as a child process when the
monitor is on (`RTB_BUILD_CHILD` unset), and this module is the parent: it
reads the child's stdout, parses it, and serves the page. That is deliberately
the dumbest arrangement that works:

  - the build process is untouched - no redirected file descriptors, no
    threads in it, nothing that could change what it computes or hang it;
  - the SIMULATION WORKERS are captured too. They are real
    `multiprocessing.Process` children (src/state/run_sims.py) that inherit
    the pipe, so "Thread 3 finished with 0.961 RTP" - the only per-worker
    signal the build produces - arrives here. An in-process stdout wrapper
    would have missed every one of them, because those lines are written by a
    different process;
  - if this file is broken or missing, `run.py` runs exactly as it did
    before (see the import guard there), and `RTB_BUILD_MONITOR=0` turns it
    off outright.

Everything the build prints is relayed to the real terminal unchanged, so the
console transcript a build has always produced is still produced.

TWO KINDS OF INPUT. Prose from the vendored SDK (`Creating books for ...`,
`Batch 2 of 4`, `Started thread 5`, `Saving LUTs for ...`, `[FAST PATH] ...`)
is parsed with the regexes in RULES - it is what it is, and it is not worth
editing the SDK to structure it. Anything this game's own code knows exactly -
the mode plan, the stage boundaries, per-mode reweight results - is emitted by
`run.py` as a `##RTB {json}` line through `emit()` below, because guessing at
structure from prose that could be reworded is how a monitor starts lying.

    python build_monitor.py --demo     # replay a synthetic build in ~40s,
                                       # which is how the page gets tested
                                       # without spending 40 minutes
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
PAGE_FILE = os.path.join(HERE, "build_monitor.html")
LIBRARY = os.path.join(HERE, "library")
PROGRESS_LOG = os.path.join(LIBRARY, "build_progress.jsonl")
TIMINGS_FILE = os.path.join(LIBRARY, "build_timings.json")

MARKER = "##RTB "
DEFAULT_PORT = int(os.environ.get("RTB_BUILD_MONITOR_PORT", "8765"))
# How long the page stays up after the build ends. The point of a monitor is
# to be looked at, and the last thing it shows - what every mode measured, what
# warned - is worth reading after the run rather than during it.
LINGER_SECONDS = float(os.environ.get("RTB_BUILD_MONITOR_LINGER", "900"))

STAGES = [
    ("simulate", "Simulate", "every mode in turn, split across the workers"),
    ("publish", "Publish & reweight", "every table onto one RTP, then the configs that hash them"),
    ("verify", "Verify", "books against tables, then the risk statistics"),
    ("scan", "Scan", "replay event IDs and the per-mode win ceilings"),
]
STAGE_IDS = [s[0] for s in STAGES]


# --------------------------------------------------------------------------
# The half of this that run.py calls
# --------------------------------------------------------------------------
def monitoring() -> bool:
    """Is this process the build, running under a monitor?"""
    return os.environ.get("RTB_BUILD_CHILD") == "1"


def emit(event: str, **data) -> None:
    """
    Tell the monitor something only the build knows.

    A no-op when the build was started directly, so a normal `python run.py`
    prints exactly what it always printed. Never raises: a monitor is an
    ornament on a 40-minute job and must not be able to end one.
    """
    if not monitoring():
        return
    try:
        print(MARKER + json.dumps({"e": event, **data}), flush=True)
    except Exception:  # pragma: no cover - defensive by design
        pass


# --------------------------------------------------------------------------
# The state the page renders
# --------------------------------------------------------------------------
class BuildState:
    """Everything known about the run, rebuilt line by line."""

    LOG_KEEP = 4000

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.started = time.time()
        self.finished: float | None = None
        self.exit_code: int | None = None
        self.threads = 0
        self.total_sims = 0
        self.modes: dict[str, dict] = {}
        self.order: list[str] = []
        self.families: dict[str, dict] = {}
        self.stages = {
            sid: {
                "id": sid,
                "label": label,
                "hint": hint,
                "state": "pending",
                "started": None,
                "finished": None,
                "done": 0.0,
                "total": 0.0,
                "unit": "modes",
                "note": "",
            }
            for sid, label, hint in STAGES
        }
        self.stages["simulate"]["unit"] = "sims"
        self.workers: list[dict] = []
        self.current_mode: str | None = None
        self.current_verify: str | None = None
        self.log: list[dict] = []
        self.log_base = 0  # absolute index of log[0], so cursors survive trimming
        self.warnings: list[dict] = []
        self.summary: list[str] = []
        # Stages still running when the build ended - i.e. it did not get
        # through them. Empty on a build that ran to the end.
        self.forced_closed: list[str] = []
        self.previous_timings = _load_timings()

    # ---- log ----
    def add_log(self, text: str, kind: str = "out") -> None:
        self.log.append({"i": self.log_base + len(self.log), "t": time.time(), "k": kind, "s": text})
        if len(self.log) > self.LOG_KEEP:
            drop = len(self.log) - self.LOG_KEEP
            self.log = self.log[drop:]
            self.log_base += drop

    # ---- the mode table ----
    def plan(self, data: dict) -> None:
        self.threads = int(data.get("threads") or 0)
        self.order = []
        self.modes = {}
        self.families = {}
        for entry in data.get("modes", []):
            name = entry["name"]
            family = entry.get("family", "base")
            sims = int(entry.get("sims") or 0)
            self.order.append(name)
            self.modes[name] = {
                "name": name,
                "family": family,
                "sims": sims,
                "cost": entry.get("cost", 1),
                # One record per stage. `state` is pending | running | done | warn.
                "simulate": {"state": "pending", "batch": 0, "batches": 0, "ms": None, "rtp": None, "threads": []},
                "publish": {"state": "pending", "rtp": None, "ms": None},
                "verify": {"state": "pending", "note": "", "ms": None},
                "scan": {"state": "pending"},
                "step": "",
                "warnings": [],
            }
            fam = self.families.setdefault(family, {"key": family, "modes": 0, "sims": 0, "label": family})
            fam["modes"] += 1
            fam["sims"] += sims
        for entry in data.get("families", []):
            fam = self.families.setdefault(entry["key"], {"key": entry["key"], "modes": 0, "sims": 0})
            fam["label"] = entry.get("label", entry["key"])
        self.total_sims = sum(m["sims"] for m in self.modes.values())
        self.stages["simulate"]["total"] = float(self.total_sims)
        for sid in ("publish", "verify", "scan"):
            self.stages[sid]["total"] = float(len(self.order))
        self.workers = [
            {"index": i, "state": "idle", "mode": None, "started": None, "rtp": None} for i in range(self.threads)
        ]

    def mode(self, name: str) -> dict | None:
        """A mode record, created on demand - the build is the authority on
        which modes exist, not the plan we were handed."""
        if name in self.modes:
            return self.modes[name]
        if not name:
            return None
        self.order.append(name)
        self.modes[name] = {
            "name": name,
            "family": _family_of(name),
            "sims": 0,
            "cost": 1,
            "simulate": {"state": "pending", "batch": 0, "batches": 0, "ms": None, "rtp": None, "threads": []},
            "publish": {"state": "pending", "rtp": None, "ms": None},
            "verify": {"state": "pending", "note": "", "ms": None},
            "scan": {"state": "pending"},
            "step": "",
            "warnings": [],
        }
        return self.modes[name]

    # ---- stages ----
    def stage_start(self, sid: str, note: str = "") -> None:
        st = self.stages.get(sid)
        if not st:
            return
        if st["state"] == "pending":
            st["started"] = time.time()
        st["state"] = "running"
        if note:
            st["note"] = note

    def stage_done(self, sid: str, note: str = "") -> None:
        st = self.stages.get(sid)
        if not st:
            return
        st["state"] = "done"
        st["finished"] = time.time()
        st["done"] = st["total"] or st["done"]
        if note:
            st["note"] = note

    # ---- serialisation ----
    def snapshot(self, cursor: int) -> dict:
        with self.lock:
            now = time.time()
            stages = {}
            for sid in STAGE_IDS:
                st = dict(self.stages[sid])
                st["eta"] = self._stage_eta(st, now)
                st["elapsed"] = (st["finished"] or now) - st["started"] if st["started"] else 0
                stages[sid] = st
            first = max(cursor - self.log_base, 0)
            return {
                "build": {
                    "started": self.started,
                    "finished": self.finished,
                    "exitCode": self.exit_code,
                    "elapsed": (self.finished or now) - self.started,
                    "threads": self.threads,
                    "totalSims": self.total_sims,
                    "modeCount": len(self.order),
                    "eta": self._overall_eta(now),
                    "progress": self._overall_progress(),
                    "linger": self._linger_left(now),
                },
                "stageOrder": STAGE_IDS,
                "stages": stages,
                "families": list(self.families.values()),
                "modes": [self.modes[name] for name in self.order],
                "workers": self.workers,
                "warnings": self.warnings[-40:],
                "summary": self.summary[-12:],
                "log": self.log[first:],
                "logCursor": self.log_base + len(self.log),
            }

    def _linger_left(self, now: float) -> float | None:
        if self.finished is None:
            return None
        return max(0.0, LINGER_SECONDS - (now - self.finished))

    def _stage_eta(self, st: dict, now: float) -> float | None:
        """Seconds left in this stage, from its own measured rate."""
        if st["state"] != "running" or not st["started"] or st["total"] <= 0 or st["done"] <= 0:
            return None
        elapsed = now - st["started"]
        if elapsed < 2:
            return None
        return max(0.0, elapsed * (st["total"] - st["done"]) / st["done"])

    def _stage_weights(self) -> dict[str, float]:
        """
        How much of the whole run each stage is worth.

        Measured from the LAST build when there is one (build_timings.json,
        written at the end of every monitored run) - the stages are wildly
        uneven and their split is a property of this machine, not something to
        guess at. The fallback shares are the 2026-09-22 build's, which is
        better than treating four stages as a quarter each.
        """
        previous = self.previous_timings or {}
        got = {sid: float(previous.get(sid, 0) or 0) for sid in STAGE_IDS}
        total = sum(got.values())
        if total > 30:
            return {sid: got[sid] / total for sid in STAGE_IDS}
        return {"simulate": 0.82, "publish": 0.07, "verify": 0.09, "scan": 0.02}

    def _overall_progress(self) -> float:
        weights = self._stage_weights()
        done = 0.0
        for sid in STAGE_IDS:
            st = self.stages[sid]
            share = weights.get(sid, 0.0)
            if st["state"] == "done":
                done += share
            elif st["total"] > 0:
                done += share * min(1.0, st["done"] / st["total"])
        return min(1.0, done)

    def _overall_eta(self, now: float) -> float | None:
        if self.finished is not None:
            return 0.0
        progress = self._overall_progress()
        elapsed = now - self.started
        if progress <= 0.005 or elapsed < 5:
            return None
        return max(0.0, elapsed * (1 - progress) / progress)

    def timings(self) -> dict:
        out = {}
        for sid in STAGE_IDS:
            st = self.stages[sid]
            if st["started"] and st["finished"]:
                out[sid] = st["finished"] - st["started"]
        return out


def _family_of(mode: str) -> str:
    for prefix in ("sc", "hs", "tr"):
        if mode.startswith(prefix + "_"):
            return prefix
    return "base"


def _load_timings() -> dict:
    try:
        with open(TIMINGS_FILE, "r", encoding="utf-8") as fh:
            return json.load(fh).get("stages", {})
    except Exception:
        return {}


def _save_timings(state: BuildState) -> None:
    """Record this run's stage durations so the NEXT run's ETA is weighted by
    what actually happened here rather than by a guess.

    ONLY from a build that got through all four passes. A run stopped twelve
    seconds in - Ctrl-C, or a worker that died - has a real duration for the
    pass it was in and nothing for the rest, and saving that would tell the
    next build that simulating is the whole job and everything after it is
    free. An aborted run leaves the previous, honest timings alone.
    """
    if state.exit_code != 0 or state.forced_closed:
        return
    if any(state.stages[sid]["finished"] is None for sid in STAGE_IDS):
        return
    try:
        os.makedirs(LIBRARY, exist_ok=True)
        with open(TIMINGS_FILE, "w", encoding="utf-8") as fh:
            json.dump(
                {
                    "finished": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "total": (state.finished or time.time()) - state.started,
                    "stages": state.timings(),
                },
                fh,
                indent=2,
            )
    except Exception:
        pass


# --------------------------------------------------------------------------
# Parsing the build's output
# --------------------------------------------------------------------------
def _handle_event(state: BuildState, data: dict) -> None:
    """A `##RTB` line: something the build knows exactly."""
    event = data.get("e")
    if event == "plan":
        state.plan(data)
    elif event == "stage":
        sid = data.get("id")
        if data.get("at") == "start":
            state.stage_start(sid, data.get("note", ""))
        else:
            state.stage_done(sid, data.get("note", ""))
    elif event == "reweight":
        mode = state.mode(data.get("mode", ""))
        if mode:
            mode["publish"]["state"] = "done"
            mode["publish"]["rtp"] = data.get("rtp")
            state.stages["publish"]["done"] = float(data.get("index", state.stages["publish"]["done"] + 1))
    elif event == "generator":
        note = data.get("product", "")
        state.stage_start("scan", note)
        if data.get("at") == "end":
            state.summary.append(f"{note}: {data.get('result', 'done')}")
    elif event == "mode_start":
        # direct_books: a worker has picked this mode up. `slot` is a worker
        # position the parent tracks, reused as modes finish.
        mode = state.mode(data.get("mode", ""))
        if mode:
            mode["simulate"]["state"] = "running"
            mode["simulate"]["startedAt"] = time.time()
            mode["step"] = "scoring"
        _worker(state, int(data.get("slot", 0))).update(
            {"state": "running", "mode": data.get("mode"), "started": time.time(), "rtp": None}
        )
        state.stage_start("simulate")
    elif event == "mode_done":
        mode = state.mode(data.get("mode", ""))
        if mode:
            mode["simulate"]["state"] = "done"
            mode["simulate"]["rtp"] = data.get("rtp")
            mode["simulate"]["ms"] = int(1000 * float(data.get("seconds") or 0))
            mode["step"] = ""
        _worker(state, int(data.get("slot", 0))).update(
            {"state": "done", "mode": data.get("mode"), "rtp": data.get("rtp")}
        )
        _recount_sim_progress(state)
    elif event == "summary":
        state.summary.append(str(data.get("text", "")))
    elif event == "done":
        state.stage_done("scan")


# Prose from the vendored SDK. Each rule is (compiled regex, handler).
def _rule(pattern):
    return re.compile(pattern)


R_MODE_START = _rule(r"^Creating books for \S+ in (\S+)")
R_BATCH = _rule(r"^Batch (\d+) of (\d+)")
R_THREAD_START = _rule(r"^Started thread (\d+)")
R_THREAD_DONE = _rule(r"^Thread (\d+) finished with ([\d.]+) RTP")
R_ONLINE = _rule(r"^All threads are online\.")
R_JOINED = _rule(r"^Finished joining threads\.")
R_SAVING = _rule(r"^Saving (books|force files|LUTs) for\s+(\S+) in (\S+)")
R_VERIFY_FILE = _rule(r"^Wrote verification file: .*books_(\S+)\.verification\.json")
R_BOOKS_DONE = _rule(r"^Finished creating books in (.+)\.")
R_VERIFY_OK = _rule(r"^\[FAST PATH\] (\S+): SHA-256 OK, payout hash OK, entries=(\d+)")
R_VERIFY_USING = _rule(r"^\[FAST PATH\] Using verification sidecar for (\S+)")
R_VERIFY_SLOW = _rule(r"^\[FALLBACK\] No verification sidecar for (\S+), reading books")
R_WARN_MODE = _rule(r"^Mode \[(\S+)\] fails")
R_VIOLATED = _rule(r"VIOLATED: (\w+)\s+VALUE:([\d.]+) --- LIMIT: ([\d.]+)")
R_SCAN_START = _rule(r"^Scanning (\d+) books for bust-win and second-chance rounds")
R_SCAN_PROGRESS = _rule(r"^\s+(\d+)/(\d+)\s*$")
R_SCAN_MODE = _rule(r"^\s+scanned (\S+) \((\d+)/(\d+)\)")
R_VERIFY_HEAD = _rule(r"^Verifying (\d+) modes across (\d+) workers")
R_VERIFY_COUNT = _rule(r"^\s+verified (\d+)/(\d+) modes")
R_CONFIG_STEP = _rule(r"^  (frontend config|backend config|math config|index manifest)(\.\.\.|written in .*)$")


def _handle_line(state: BuildState, line: str) -> str:
    """Parse one printed line. Returns the kind for the log pane."""
    text = line.rstrip()
    kind = "out"

    m = R_MODE_START.match(text)
    if m:
        name = m.group(1)
        state.current_mode = name
        mode = state.mode(name)
        if mode:
            mode["simulate"]["state"] = "running"
            mode["simulate"]["startedAt"] = time.time()
            mode["step"] = "simulating"
        state.stage_start("simulate")
        return "step"

    m = R_BATCH.match(text)
    if m and state.current_mode:
        mode = state.mode(state.current_mode)
        mode["simulate"]["batch"] = int(m.group(1))
        mode["simulate"]["batches"] = int(m.group(2))
        # Progress is counted in simulations so the bar moves at a rate a
        # player of 100k-sim modes and 800k-sim modes can both trust.
        _recount_sim_progress(state)
        return "step"

    m = R_THREAD_START.match(text)
    if m:
        index = int(m.group(1))
        _worker(state, index).update(
            {"state": "running", "mode": state.current_mode, "started": time.time(), "rtp": None}
        )
        return "thread"

    m = R_THREAD_DONE.match(text)
    if m:
        index, rtp = int(m.group(1)), float(m.group(2))
        worker = _worker(state, index)
        worker.update({"state": "done", "rtp": rtp, "finished": time.time()})
        if state.current_mode:
            record = state.mode(state.current_mode)["simulate"]
            record.setdefault("threads", []).append({"index": index, "rtp": rtp})
        return "thread"

    if R_ONLINE.match(text) or R_JOINED.match(text):
        if R_JOINED.match(text):
            for worker in state.workers:
                if worker["state"] == "done":
                    worker["state"] = "idle"
        return "thread"

    m = R_SAVING.match(text)
    if m:
        mode = state.mode(m.group(3))
        if mode:
            mode["step"] = {"books": "writing books", "force files": "writing force files", "LUTs": "writing tables"}[
                m.group(1)
            ]
        return "step"

    m = R_VERIFY_FILE.match(text)
    if m:
        mode = state.mode(m.group(1))
        if mode:
            # The books are on disk and hashed: this mode is simulated.
            mode["simulate"]["state"] = "done"
            mode["step"] = ""
            started = mode["simulate"].get("startedAt")
            if started:
                mode["simulate"]["ms"] = int((time.time() - started) * 1000)
            _recount_sim_progress(state, completed=True)
        return "step"

    m = R_BOOKS_DONE.match(text)
    if m:
        state.stage_done("simulate", f"took {m.group(1)}")
        state.stage_start("publish")
        for worker in state.workers:
            worker["state"] = "idle"
        return "step"

    m = R_VERIFY_USING.match(text) or R_VERIFY_SLOW.match(text)
    if m:
        name = m.group(1)
        state.current_verify = name
        mode = state.mode(name)
        if mode:
            mode["verify"]["state"] = "running"
            mode["verify"]["note"] = "sidecar" if "FAST" in text else "reading books"
        state.stage_start("verify")
        return "step"

    m = R_VERIFY_OK.match(text)
    if m:
        mode = state.mode(m.group(1))
        if mode:
            mode["verify"]["state"] = "done"
            mode["verify"]["note"] = f"{int(m.group(2)):,} entries"
        state.stages["verify"]["done"] = float(sum(1 for x in state.modes.values() if x["verify"]["state"] == "done"))
        return "step"

    m = R_WARN_MODE.match(text)
    if m:
        state.current_verify = m.group(1)
        kind = "warn"

    m = R_VIOLATED.search(text)
    if m:
        name = state.current_verify or ""
        entry = {"mode": name, "metric": m.group(1), "value": m.group(2), "limit": m.group(3)}
        state.warnings.append(entry)
        mode = state.mode(name)
        if mode:
            mode["verify"]["state"] = "warn"
            mode["warnings"].append(f"{m.group(1)} {m.group(2)} > {m.group(3)}")
        return "warn"

    m = R_SCAN_START.match(text)
    if m:
        state.stage_start("scan", "bust-win and second-chance rounds")
        state.stages["scan"]["total"] = float(m.group(1))
        state.stages["scan"]["done"] = 0.0
        return "step"

    m = R_SCAN_PROGRESS.match(text)
    if m and state.stages["scan"]["state"] == "running":
        state.stages["scan"]["done"] = float(m.group(1))
        state.stages["scan"]["total"] = float(m.group(2))
        return "step"

    m = R_SCAN_MODE.match(text)
    if m:
        mode = state.mode(m.group(1))
        if mode:
            mode["scan"]["state"] = "done"
        state.stage_start("scan", "bust-win and second-chance rounds")
        state.stages["scan"]["done"] = float(m.group(2))
        state.stages["scan"]["total"] = float(m.group(3))
        return "step"

    m = R_VERIFY_HEAD.match(text)
    if m:
        state.stage_start("verify", f"{m.group(1)} modes across {m.group(2)} workers")
        state.stages["verify"]["total"] = float(m.group(1))
        return "step"

    m = R_VERIFY_COUNT.match(text)
    if m and state.stages["verify"]["state"] == "running":
        state.stages["verify"]["done"] = max(state.stages["verify"]["done"], float(m.group(1)))
        return "step"

    m = R_CONFIG_STEP.match(text)
    if m:
        state.stage_start("publish", f"writing the {m.group(1)}")
        return "step"

    lowered = text.lower()
    if "warning" in lowered or "!" == text[:1] or "traceback" in lowered:
        kind = "warn"
    if "error" in lowered or "assert" in lowered:
        kind = "error"
    return kind


def _worker(state: BuildState, index: int) -> dict:
    while len(state.workers) <= index:
        state.workers.append({"index": len(state.workers), "state": "idle", "mode": None, "started": None, "rtp": None})
    if state.threads < len(state.workers):
        state.threads = len(state.workers)
    return state.workers[index]


def _recount_sim_progress(state: BuildState, completed: bool = False) -> None:
    """
    Simulations finished so far.

    A mode is worth its own simulation count, and a mode in flight is worth the
    share of it its current batch implies - which is the only progress signal
    the build gives inside a mode, and is why `Batch k of n` is parsed at all.
    """
    done = 0.0
    for mode in state.modes.values():
        record = mode["simulate"]
        if record["state"] == "done":
            done += mode["sims"]
        elif record["state"] == "running" and record["batches"]:
            done += mode["sims"] * max(0, record["batch"] - 1) / record["batches"]
    state.stages["simulate"]["done"] = done


# --------------------------------------------------------------------------
# The server
# --------------------------------------------------------------------------
def _make_handler(state: BuildState):
    class Handler(BaseHTTPRequestHandler):
        # The build's own output is the only thing worth printing; an access
        # log for a page that polls twice a second would bury it.
        def log_message(self, *args):
            pass

        def _send(self, body: bytes, content_type: str) -> None:
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass  # the tab was closed mid-poll

        def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler's spelling
            path = self.path.split("?")[0]
            if path in ("/", "/index.html"):
                try:
                    with open(PAGE_FILE, "rb") as fh:
                        self._send(fh.read(), "text/html; charset=utf-8")
                except OSError:
                    self._send(b"build_monitor.html is missing", "text/plain; charset=utf-8")
                return
            if path == "/state":
                cursor = 0
                if "?" in self.path:
                    for part in self.path.split("?", 1)[1].split("&"):
                        if part.startswith("log="):
                            try:
                                cursor = int(part[4:])
                            except ValueError:
                                cursor = 0
                self._send(json.dumps(state.snapshot(cursor)).encode("utf-8"), "application/json")
                return
            self.send_response(404)
            self.end_headers()

    return Handler


def _serve(state: BuildState, port: int) -> tuple[ThreadingHTTPServer, int]:
    last_error: Exception | None = None
    for candidate in range(port, port + 20):
        try:
            server = ThreadingHTTPServer(("127.0.0.1", candidate), _make_handler(state))
        except OSError as exc:  # port in use - a previous run's linger, usually
            last_error = exc
            continue
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        return server, candidate
    raise RuntimeError(f"no free port from {port}: {last_error}")


# --------------------------------------------------------------------------
# Running the build under it
# --------------------------------------------------------------------------
def run_with_monitor(command: list[str], cwd: str | None = None, demo: bool = False) -> int:
    """
    Run `command` as the build, serve the page, relay every line, return its
    exit code. The build is never blocked by any of this: the pipe is drained
    by this loop, and every parse is wrapped.
    """
    state = BuildState()
    try:
        server, port = _serve(state, DEFAULT_PORT)
    except Exception as exc:
        print(f"! build monitor could not start ({exc}); running without it")
        return subprocess.call(command, cwd=cwd)

    url = f"http://127.0.0.1:{port}/"
    print(f"\n  Build monitor  {url}\n")
    # RTB_BUILD_MONITOR_OPEN=0 serves the page without stealing focus - for a
    # build started over ssh, or from a session that is already watching it.
    if os.environ.get("RTB_BUILD_MONITOR_OPEN") != "0":
        try:
            webbrowser.open(url)
        except Exception:
            pass

    env = dict(os.environ)
    env["RTB_BUILD_CHILD"] = "1"
    env["PYTHONUNBUFFERED"] = "1"  # otherwise the page is minutes behind the build

    # A demo run must not leave its fingerprints on a real build's records:
    # build_timings.json is what the NEXT build's ETA is weighted by, and a
    # 40-second synthetic run would make a 40-minute one look nearly finished.
    progress_path = PROGRESS_LOG if not demo else PROGRESS_LOG.replace(".jsonl", ".demo.jsonl")
    progress = None
    try:
        os.makedirs(LIBRARY, exist_ok=True)
        progress = open(progress_path, "w", encoding="utf-8")
    except OSError:
        progress = None

    child = subprocess.Popen(
        command,
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        text=True,
        encoding="utf-8",
        errors="replace",
    )

    try:
        for raw in child.stdout:  # type: ignore[union-attr]
            line = raw.rstrip("\n")
            if line.startswith(MARKER):
                try:
                    data = json.loads(line[len(MARKER):])
                except Exception:
                    data = None
                if data is not None:
                    with state.lock:
                        try:
                            _handle_event(state, data)
                        except Exception as exc:
                            state.add_log(f"[monitor] could not read event: {exc}", "warn")
                    if progress:
                        progress.write(line + "\n")
                        progress.flush()
                    continue
            # Relay first, always: the terminal transcript is the thing that
            # has to survive a bug in anything below this line.
            print(line, flush=True)
            with state.lock:
                try:
                    kind = _handle_line(state, line)
                except Exception as exc:
                    kind = "out"
                    state.add_log(f"[monitor] could not parse line: {exc}", "warn")
                state.add_log(line, kind)
            if progress:
                try:
                    progress.write(json.dumps({"t": time.time(), "line": line}) + "\n")
                except Exception:
                    pass
    except KeyboardInterrupt:
        child.terminate()
    finally:
        code = child.wait()
        with state.lock:
            state.finished = time.time()
            state.exit_code = code
            state.forced_closed = [sid for sid in STAGE_IDS if state.stages[sid]["state"] == "running"]
            for sid in state.forced_closed:
                # Closed so the page stops drawing a bar that is still
                # counting. _save_timings reads forced_closed, because a stage
                # closed this way did not finish its work.
                state.stage_done(sid)
            state.add_log(f"[monitor] build finished with exit code {code}", "step")
        if progress:
            progress.close()
        if not demo:
            _save_timings(state)

    if LINGER_SECONDS > 0 and code == 0:
        left = f"{LINGER_SECONDS / 60:.0f} minutes" if LINGER_SECONDS >= 90 else f"{LINGER_SECONDS:.0f}s"
        print(f"\n  Build monitor still at {url} for {left} - Ctrl-C to close.\n")
        try:
            deadline = time.time() + LINGER_SECONDS
            while time.time() < deadline:
                time.sleep(0.5)
        except KeyboardInterrupt:
            pass
    server.shutdown()
    return code


# --------------------------------------------------------------------------
# Demo: the same pipeline, fed a synthetic transcript
# --------------------------------------------------------------------------
def _demo_child() -> None:
    """
    Print what a build prints, quickly.

    This is how the page gets developed and checked. Every line here is copied
    from the real thing - if a parser works on this it works on a build, and
    when the SDK reworders one of these lines this is where the change is made
    first.
    """
    import random

    # RTB_DEMO_PACE scales every sleep: 1 is a ~45s replay, 4 is slow enough
    # to watch a worker strip fill and empty.
    pace = float(os.environ.get("RTB_DEMO_PACE", "1"))
    families = [("base", ""), ("sc", "sc_"), ("hs", "hs_"), ("tr", "tr_")]
    colours = ["red", "black"]
    hl = ["higher", "lower", "equal"]
    io = ["inside", "outside", "equal"]
    suits = ["heart", "diamond", "club", "spade"]
    modes = []
    for family, prefix in families:
        if family == "tr":
            modes.append((f"{prefix}any_equal_equal", family, 800_000))
            continue
        for colour in colours:
            for a in hl:
                for b in io:
                    if a == "equal" and b == "inside":
                        continue
                    for suit in suits:
                        equals = sum(1 for c in (a, b) if c == "equal")
                        sims = {0: 100_000, 1: 200_000, 2: 800_000}[equals]
                        modes.append((f"{prefix}{colour}_{a}_{b}_{suit}", family, sims))
    # Ten of each family plus trips: enough to see the grouping, the colours
    # and the per-family tallies without a 40-minute transcript.
    sample = []
    for family, _prefix in families:
        sample.extend([m for m in modes if m[1] == family][:10])
    modes = sample

    emit(
        "plan",
        threads=8,
        modes=[{"name": n, "family": f, "sims": s, "cost": 250 if f == "tr" else 1} for n, f, s in modes],
        families=[
            {"key": "base", "label": "Classic"},
            {"key": "sc", "label": "Second Chance"},
            {"key": "hs", "label": "High Stakes"},
            {"key": "tr", "label": "Three of a Kind"},
        ],
    )
    print(f"Simulating {len(modes)} bet modes, {sum(m[2] for m in modes):,} simulations total:")
    print("\nDealing 800,000 shuffles once for the four-guess modes...")
    time.sleep(0.4 * pace)
    print("Deal cache written in 2.3s")
    emit("stage", id="simulate", at="start")
    print(f"\nScoring {len(modes)} modes against the deal across 8 workers...")
    # direct_books hands the biggest modes out first and reports each one as
    # a worker finishes it; the slots are reused in completion order.
    order = sorted(modes, key=lambda m: -m[2])
    running = {}
    queue = list(order)
    for slot in range(min(8, len(queue))):
        name, _family, sims = queue.pop(0)
        running[slot] = (name, sims, time.time())
        emit("mode_start", mode=name, slot=slot, sims=sims)
    done = 0
    while running:
        # the slot whose mode "finishes" next: a fake duration by size
        slot = min(running, key=lambda k: running[k][2] + running[k][1] / 400_000)
        name, sims, _t0 = running.pop(slot)
        time.sleep(0.02 * pace * sims / 100_000)
        done += 1
        rtp = round(random.uniform(0.78, 0.97), 3)
        print(f"  [{done:>3}/{len(modes)}] {name:<34} {sims:>7,} rounds   raw RTP {rtp:.3f}   {sims / 70_000:5.1f}s")
        print(f"Wrote verification file: library/configs/books_{name}.verification.json")
        emit("mode_done", mode=name, slot=slot, sims=sims, rtp=rtp, seconds=sims / 70_000)
        if queue:
            name, _family, sims = queue.pop(0)
            running[slot] = (name, sims, time.time())
            emit("mode_start", mode=name, slot=slot, sims=sims)
    print("\nFinished creating books in 1m 31.6s.\n")
    emit("stage", id="simulate", at="end")  # the real run.py sends no note: the
    # duration is parsed off "Finished creating books in ...", which is above.

    emit("stage", id="publish", at="start")
    print(f"\nReweighting all modes to 0.9600 RTP across 8 workers...")
    print("Each mode's published _0 table is rewritten from its segmented table:")
    for index, (name, _family, _sims) in enumerate(modes, start=1):
        rtp = round(random.uniform(0.9599, 0.9601), 6)
        print(
            f"  [{index:>3}/{len(modes)}] {name:<34} RTP {rtp * 100:8.4f}%   "
            f"1 in {random.uniform(1.9, 2.1):6.2f}   loss weight {random.randint(900_000, 2_000_000):>12,}   "
            f"800,000 rows   {random.uniform(0.3, 2.0):5.1f}s"
        )
        emit("reweight", mode=name, index=index, rtp=rtp)
        time.sleep(0.05 * pace)
    print("Reweighted 193 modes to 0.9600: realized RTP 96.0000%-96.0000% (spread 0.0000%)")
    print("\nWriting configuration files...")
    for label in ("frontend config", "backend config", "math config", "index manifest"):
        print(f"  {label}...")
        time.sleep(0.25 * pace)
        print(f"  {label} written in 0.3s")
    emit("stage", id="publish", at="end")

    emit("stage", id="verify", at="start")
    print("\nVerifying published files and writing stats_summary.json...")
    print(f"Verifying {len(modes)} modes across 8 workers...")
    for name, _family, _sims in modes:
        print(f"[FAST PATH] Using verification sidecar for {name}")
        time.sleep(0.05 * pace)
        print(f"[FAST PATH] {name}: SHA-256 OK, payout hash OK, entries=800000")
    print("\nMode [tr_any_equal_equal] fails 3-star volatility limits:")
    print("\tVIOLATED: cvar  VALUE:4583.3 --- LIMIT: 800")
    emit("stage", id="verify", at="end")

    emit("stage", id="scan", at="start")
    emit("generator", at="start", product="REPLAY_EVENTS.md")
    print("\nRegenerating REPLAY_EVENTS.md...")
    print(f"Scanning {len(modes)} books for bust-win and second-chance rounds, 8 at a time...")
    for done, (name, _family, _sims) in enumerate(modes, start=1):
        print(f"  scanned {name} ({done}/{len(modes)})")
        time.sleep(0.06 * pace)
    print(f"bust+win in {len(modes)}/{len(modes)} modes, 2nd chance in 64")
    emit("generator", at="end", product="REPLAY_EVENTS.md", result="written")
    emit("generator", at="start", product="modeCeilings.ts")
    print("\nRegenerating src/game/math/modeCeilings.ts...")
    time.sleep(0.6 * pace)
    print("wrote web-sdk/apps/Ride-The-Bus/src/game/math/modeCeilings.ts")
    emit("generator", at="end", product="modeCeilings.ts", result="written")
    emit("done")


if __name__ == "__main__":
    if "--demo-child" in sys.argv:
        _demo_child()
    elif "--demo" in sys.argv:
        sys.exit(
            run_with_monitor(
                [sys.executable, os.path.abspath(__file__), "--demo-child"], cwd=HERE, demo=True
            )
        )
    else:
        print(__doc__)
