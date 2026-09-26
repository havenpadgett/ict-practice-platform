#!/usr/bin/env python3
"""Audit detected candidates against the written curriculum, clause by clause.

For each rule, samples candidates evenly across the date range (seeded) and
re-checks every clause of the docs/CURRICULUM.md definition with code
written independently of detect.py — including the clauses detect.py
doesn't implement. Prints a markdown report.

  python3 scripts/audit_detection.py data/clean/nq_nyam_ctx.5m > docs/DETECTION-AUDIT.md
"""

from __future__ import annotations

import random
import statistics
import sys
from collections import defaultdict
from typing import Any, Dict, List

from common import load_clean, load_json, trading_date
from detect import group_indices, session_median_range
from setups import find_setup

SAMPLE = 20
SEED = 7


def swings(day: List[Dict[str, Any]], n: int = 2):
    """Independent fractal swings: strictly beyond n bars left, at least as far as n bars right."""
    hi, lo = [], []
    for i in range(n, len(day) - n):
        h, l = day[i]["high"], day[i]["low"]
        if all(h > day[j]["high"] for j in range(i - n, i)) and all(h >= day[j]["high"] for j in range(i + 1, i + n + 1)):
            hi.append(i)
        if all(l < day[j]["low"] for j in range(i - n, i)) and all(l <= day[j]["low"] for j in range(i + 1, i + n + 1)):
            lo.append(i)
    return hi, lo


def sample(cands: List[Dict[str, Any]], k: int = SAMPLE) -> List[Dict[str, Any]]:
    cands = sorted(cands, key=lambda c: c["anchor_timestamp"])
    rnd = random.Random(SEED)
    out = []
    for s in range(k):
        lo, hi = len(cands) * s // k, len(cands) * (s + 1) // k
        if hi > lo:
            out.append(cands[rnd.randrange(lo, hi)])
    return out


class Report:
    def __init__(self) -> None:
        self.rows: Dict[str, Dict[str, List[str]]] = defaultdict(lambda: defaultdict(list))

    def check(self, rule: str, clause: str, ok: bool, cid: str) -> None:
        self.rows[rule][clause].append("" if ok else cid)

    def table(self, rule: str, n: int) -> str:
        lines = ["| Clause | Holds | Fails (examples) |", "|---|---|---|"]
        for clause, results in self.rows[rule].items():
            fails = [r for r in results if r]
            ex = ", ".join(f"`{f}`" for f in fails[:3]) + (" …" if len(fails) > 3 else "")
            lines.append(f"| {clause} | {len(results) - len(fails)}/{len(results)} | {ex or '—'} |")
        return "\n".join(lines)


def real_ids() -> set:
    import glob
    import json
    out = set()
    for f in glob.glob(str(__import__("pathlib").Path(__file__).resolve().parent.parent / "src/data/real-scenarios/real-*.json")):
        out.add(json.load(open(f))["provenance"]["candidate_id"])
    return out


def main(stem: str, only_real: bool = False) -> int:
    data = load_clean(f"{stem}.clean.json")
    candles = data["candles"]
    cands = load_json(f"{stem}.candidates.json")["candidates"]
    params = load_json(f"{stem}.candidates.json")["meta"]["detection_params"]
    med = session_median_range(candles, params.get("range_window", 100))
    day_of = {}
    for idxs in group_indices(candles, trading_date).values():
        for i in idxs:
            day_of[i] = (idxs[0], idxs[-1])
    rep = Report()
    by_rule = defaultdict(list)
    keep = real_ids() if only_real else None
    for c in cands:
        if not c.get("context") and (keep is None or c["id"] in keep):
            by_rule[c["rule"]].append(c)
    counts = {}

    # ---- FVG
    s = sample(by_rule["fvg"]); counts["fvg"] = len(s)
    for c in s:
        a, b, d = c["involved_indices"]
        c1, c2, c3 = candles[a], candles[b], candles[d]
        bull = c["direction"] == "bullish"
        lo, hi = c["levels"]["price_low"], c["levels"]["price_high"]
        rep.check("fvg", "Candle 1 high below candle 3 low (bullish) / candle 1 low above candle 3 high (bearish)",
                  (c1["high"] < c3["low"]) if bull else (c1["low"] > c3["high"]), c["id"])
        rep.check("fvg", "Three consecutive bars of one session (no time gap)",
                  day_of[a] == day_of[d] and d - a == 2 and (c3["_dt"] - c1["_dt"]).total_seconds() == 2 * data["meta"]["timeframe_minutes"] * 60, c["id"])
        rep.check("fvg", "Gap ≥ 0.25 × trailing median bar range (CURRICULUM Detection Parameters)",
                  hi - lo >= 0.25 * med[a] - 1e-9, c["id"])
        rep.check("fvg", "Middle candle is the expansion candle, closing in the gap's direction (*not checked by detect.py*)",
                  (c2["close"] > c2["open"]) if bull else (c2["close"] < c2["open"]), c["id"])
        end = day_of[a][1]
        filled = any((x["low"] <= lo) if bull else (x["high"] >= hi) for x in candles[d + 1:end + 1])
        rep.check("fvg", "Still unfilled at the session's end — 'an unfilled imbalance' (*not checked by detect.py*)", not filled, c["id"])

    # ---- Equal highs / lows
    for rule in ("equal_highs", "equal_lows"):
        s = sample(by_rule[rule]); counts[rule] = len(s)
        buy = rule == "equal_highs"
        key = "high" if buy else "low"
        for c in s:
            touches = c["involved_indices"]
            start, end = day_of[touches[0]]
            day = candles[start:end + 1]
            hs, ls = swings(day)
            sw = set(x + start for x in (hs if buy else ls))
            prices = [candles[t][key] for t in touches]
            rep.check(rule, "Every touch is a swing point (lookback-2 fractal)", all(t in sw for t in touches), c["id"])
            rep.check(rule, "Touches within 0.05% of the first touch's price",
                      max(prices) - min(prices) <= prices[0] * params.get("equal_tolerance_pct", 0.05) / 100 + 1e-9, c["id"])
            beyond = any((candles[j]["high"] > max(prices)) if buy else (candles[j]["low"] < min(prices))
                         for j in range(touches[0] + 1, touches[-1]))
            rep.check(rule, "Nothing trades beyond the pool between the touches", not beyond, c["id"])
            taken = any((x["high"] > max(prices)) if buy else (x["low"] < min(prices)) for x in candles[touches[-1] + 1:end + 1])
            rep.check(rule, "Pool still resting at the session's end — 'resting stops' (*detect.py doesn't check; build_scenario.py does*)",
                      not taken, c["id"])

    # ---- MSS
    s = sample(by_rule["mss"]); counts["mss"] = len(s)
    for c in s:
        start, end = day_of[c["break_index"]]
        day = candles[start:end + 1]
        b = c["break_index"] - start
        sw = c["swing_index"] - start
        hs, ls = swings(day)
        bear = c["direction"] == "bearish"
        conf_h = [x for x in hs if x + 2 < b]
        conf_l = [x for x in ls if x + 2 < b]
        if bear:
            trend = len(conf_h) >= 2 and len(conf_l) >= 2 and day[conf_h[-1]]["high"] > day[conf_h[-2]]["high"] and day[conf_l[-1]]["low"] > day[conf_l[-2]]["low"]
            most_recent = conf_l and conf_l[-1] == sw
            level = day[sw]["low"]
            body = day[b]["close"] < level
            failed = max(x["high"] for x in day[sw:b + 1]) <= day[conf_h[-1]]["high"] if conf_h else False
            reversal = any(x["close"] > level for x in day[b + 1:b + 3])
        else:
            trend = len(conf_h) >= 2 and len(conf_l) >= 2 and day[conf_h[-1]]["high"] < day[conf_h[-2]]["high"] and day[conf_l[-1]]["low"] < day[conf_l[-2]]["low"]
            most_recent = conf_h and conf_h[-1] == sw
            level = day[sw]["high"]
            body = day[b]["close"] > level
            failed = min(x["low"] for x in day[sw:b + 1]) >= day[conf_l[-1]]["low"] if conf_l else False
            reversal = any(x["close"] < level for x in day[b + 1:b + 3])
        # "Structural, not minor internal": the leg from the broken swing to the
        # opposite extreme before it should be at least one typical bar range.
        opp = [x for x in (hs if bear else ls) if x < sw]
        leg = abs(day[sw]["low" if bear else "high"] - (day[opp[-1]]["high"] if bear else day[opp[-1]]["low"])) if opp else 0
        rep.check("mss", "Prevailing trend: last two swing highs and last two swing lows both in one direction", bool(trend), c["id"])
        rep.check("mss", "The broken level is the most recent higher low / lower high", bool(most_recent), c["id"])
        rep.check("mss", "Confirmed by a candle body close beyond the level", body, c["id"])
        rep.check("mss", "Price first failed to make a new higher high / lower low (*detect.py records it, doesn't require it*)", failed, c["id"])
        rep.check("mss", "The broken swing is structural, not minor: its leg ≥ 1 median bar range (*not checked; proxy*)",
                  leg >= med[c["break_index"]], c["id"])
        rep.check("mss", "No immediate reversal: the next two closes stay beyond the level (*not checked by detect.py*)", not reversal, c["id"])
        rep.check("mss", "Break inside the session (not the 07:00 context)", not candles[c["break_index"]].get("context"), c["id"])

    # ---- Order blocks
    s = sample(by_rule["order_block"]); counts["order_block"] = len(s)
    for c in s:
        ob, br = c["ob_index"], c["break_index"]
        bull = c["direction"] == "bullish"
        leg = range(ob + 1, br + 1)
        same = all((candles[k]["close"] > candles[k]["open"]) if bull else (candles[k]["close"] < candles[k]["open"]) for k in leg)
        opp = (candles[ob]["close"] < candles[ob]["open"]) if bull else (candles[ob]["close"] > candles[ob]["open"])
        move = abs(candles[br]["close"] - candles[ob + 1]["open"])
        start, end = day_of[br]
        day = candles[start:end + 1]
        hs, ls = swings(day)
        sw = c["swing_index"] - start
        conf = [x for x in (hs if bull else ls) if x + 2 < br - start]
        rep.check("order_block", "Candle before the move closes the opposite way (last opposing candle)", opp, c["id"])
        rep.check("order_block", "The move is 1–3 consecutive candles in its direction", same and 1 <= len(leg) <= 3, c["id"])
        rep.check("order_block", "Displacement ≥ 2 × median bar range", move >= 2 * med[br] - 1e-9, c["id"])
        rep.check("order_block", "Breaks the most recent confirmed swing with a body close",
                  bool(conf) and conf[-1] == sw and ((candles[br]["close"] > day[sw]["high"]) if bull else (candles[br]["close"] < day[sw]["low"])), c["id"])
        rep.check("order_block", "Zone is the candle's full high–low range",
                  c["levels"]["price_low"] == candles[ob]["low"] and c["levels"]["price_high"] == candles[ob]["high"], c["id"])
        rep.check("order_block", "Block and break inside the session", not candles[ob].get("context") and not candles[br].get("context"), c["id"])

    # ---- Dealing range
    s = sample(by_rule["dealing_range"]); counts["dealing_range"] = len(s)
    for c in s:
        i = c["anchor_index"]
        start, end = day_of[i]
        h_i, l_i = c["high_index"], c["low_index"]
        hi, lo = c["levels"]["high"], c["levels"]["low"]
        first = min(h_i, l_i)
        intact = all(x["high"] <= hi and x["low"] >= lo for x in candles[first:i + 1])
        pos = (candles[i]["close"] - lo) / (hi - lo)
        zone = "premium" if pos > 0.55 else "discount" if pos < 0.45 else "equilibrium"
        # "the most recent swing high and swing low that price has not traded beyond"
        rep.check("dealing_range", "Range still intact (price hasn't traded beyond either swing)", intact, c["id"])
        rep.check("dealing_range", "Zone matches last close vs 45–55% band", zone == c["direction"], c["id"])
        rep.check("dealing_range", "Range swings are session bars, not context", not candles[h_i].get("context") and not candles[l_i].get("context"), c["id"])

    # ---- Guided Entry setups (valid ones — the chain the real scenarios use)
    valid = []
    for idxs in group_indices(candles, trading_date).values():
        o = idxs[0]
        day = candles[o:idxs[-1] + 1]
        n_ctx = next((k for k, x in enumerate(day) if not x.get("context")), len(day))
        if n_ctx == len(day):
            continue
        st = find_setup(day, n_ctx, med[o:o + len(day)], params)
        if st["kind"] == "valid":
            valid.append((o, day, n_ctx, st))
    if only_real:
        dates = {c.split("-")[-1] for c in real_ids() if c.startswith("setup-valid")}
        valid = [v for v in valid if trading_date(v[1][v[2]]["_dt"]).strftime("%Y%m%d") in dates]
    counts["guided_setup"] = len(valid)
    for o, day, n_ctx, st in valid:
        cid = f"setup-{trading_date(day[n_ctx]['_dt'])}"
        bull = st["direction"] == "bullish"
        z = st["zone"]
        rep.check("guided_setup", "Entry is an FVG, IFVG or retest of the broken level (definition's list)", z["source"] == "fvg", cid)
        chart_end = min(len(day) - 1, z["formed_index"] + 3)
        mitigated = any((x["close"] < z["low"]) if bull else (x["close"] > z["high"]) for x in day[z["formed_index"] + 1:chart_end + 1])
        rep.check("guided_setup", "Entry level unmitigated on the chart shown", not mitigated, cid)
        rep.check("guided_setup", "Stop beyond the setup's swing extreme",
                  (st["stop"] < st["extreme_price"]) if bull else (st["stop"] > st["extreme_price"]), cid)
        hs, ls = swings(day)
        t = st["target_index"]
        opp = [x for x in (ls if bull else hs) if x < t]
        leg = abs(day[t]["high" if bull else "low"] - (day[opp[-1]]["low"] if bull else day[opp[-1]]["high"])) if opp else 0
        rep.check("guided_setup", "Target is 'not the next minor swing': its leg ≥ 1 median bar range (*not checked; proxy*)",
                  leg >= med[o + t], cid)
        rep.check("guided_setup", "R:R ≥ 2 from the entry midpoint", st["rr"] >= 2, cid)

    print(f"Data: `{stem}` ({data['meta']['start'][:10]} → {data['meta']['end'][:10]}), seed {SEED}.\n")
    titles = {"fvg": "Fair Value Gap", "equal_highs": "Equal highs", "equal_lows": "Equal lows", "mss": "Market Structure Shift",
              "order_block": "Order block", "dealing_range": "Premium / discount (dealing range)",
              "guided_setup": "Guided Entry setup chain (all valid sessions)"}
    for rule, title in titles.items():
        print(f"### {title} — {counts.get(rule, 0)} checked\n")
        print(rep.table(rule, counts.get(rule, 0)) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], "--real" in sys.argv))
