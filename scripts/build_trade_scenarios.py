#!/usr/bin/env python3
"""Build real Guided Entry or Free Trade scenarios from detected setups.

Each session in the clean file (5m NY AM with 07:00 structure context) is
classified by setups.find_setup: valid, or a specific no-trade reason
(no_shift, no_sweep, no_entry, low_rr). --plan says how many of each kind
to build; picks are spread evenly across the date range (seeded), and a
session used by an existing scenario file is never reused. Every scenario
is written with provenance.human_reviewed = false and draft explanations,
and must be approved at /review before it can be practiced.

  guided   the chart runs from 07:00 to three bars after the entry level
           forms (or after the break / to the session end when there is
           none), so what price did next is not shown. Answer key: bias,
           entry/stop/target with tolerances, is_valid_setup.
  free     07:00-09:25 is the visible window; the 9:30-11:00 session is
           revealed one candle at a time. Answer key: intended bias, entry
           zone (earliest index = the bar after the zone forms), stop zone
           (the setup extreme to 1x the median bar range beyond it),
           target. Valid setups are only used when a later session candle
           closes inside the entry zone, so the trade was actually takeable.

Example:
  python3 scripts/build_trade_scenarios.py data/clean/nq_nyam_ctx.5m.clean.json \\
      data/clean/nq_nyam_ctx.5m.candidates.json --mode guided \\
      --plan valid=6,no_shift=1,no_sweep=1,no_entry=1,low_rr=1 --prefix real-guided
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from build_scenario import DEFAULT_OUTPUT_DIR, DRAFT_NOTE
from common import curriculum_versions, load_clean, load_json, round_price, trading_date, write_json
from detect import group_indices, session_median_range
from setups import MIN_RR, TICK, find_setup, tick

KINDS = ["valid", "no_shift", "no_sweep", "no_entry", "low_rr"]


def fmt(x: float) -> str:
    return f"{x:,.2f}".rstrip("0").rstrip(".")


def used_dates() -> set:
    out = set()
    for f in DEFAULT_OUTPUT_DIR.glob("real-*.json"):
        p = json.loads(f.read_text()).get("provenance", {})
        if p.get("detection_rule") in ("guided_setup", "free_trade_setup"):
            out.add(p.get("trading_date"))
    return out


def fillable(day: List[Dict[str, Any]], s: Dict[str, Any]) -> bool:
    z, bull = s["zone"], s["direction"] == "bullish"
    for c in day[s["zone"]["formed_index"] + 1:]:
        if z["low"] <= c["close"] <= z["high"]:
            return True
        if (c["low"] <= s["stop"]) if bull else (c["high"] >= s["stop"]):
            return False
    return False


def texts(s: Dict[str, Any]) -> Dict[str, str]:
    """Draft step explanations, generated from the detected levels."""
    kind = s["kind"]
    bull = s.get("direction") == "bullish"
    side, opp = ("sell-side", "buy-side") if bull else ("buy-side", "sell-side")
    lowhigh = "low" if bull else "high"
    if kind == "no_shift":
        bias = "No Market Structure Shift happens inside the session: no candle body closes beyond the most recent swing against the trend. Bias is unclear."
    elif kind == "no_sweep":
        bias = (f"A {s['direction']} Market Structure Shift closes beyond {fmt(s['broken_level'])}, but the setup {lowhigh} "
                f"({fmt(s['extreme_price'])}) never took the previous swing {lowhigh}"
                + (f" at {fmt(s['swept_price'])}" if "swept_price" in s else "")
                + f". Without {side} liquidity taken first, it's unclear which side is being targeted. Bias is unclear.")
    else:
        bias = (f"Price swept the previous swing {lowhigh} at {fmt(s['swept_price'])} (to {fmt(s['extreme_price'])}), taking the "
                f"{side} liquidity there, then a candle body closed {'above' if bull else 'below'} {fmt(s['broken_level'])}: a "
                f"{s['direction']} Market Structure Shift. Bias is {s['direction']}.")
    if kind in ("no_shift", "no_sweep"):
        entry = "With no clear bias there's no direction to look for an entry in."
        stop = "No entry means no stop."
        target = "No entry means no target."
    elif kind == "no_entry":
        entry = "The shift left no Fair Value Gap or order block to enter from, so there's no valid entry level: only open space."
        stop = "No entry means no stop."
        target = "No entry means no target."
    else:
        z = s["zone"]
        name = "Fair Value Gap" if z["source"] == "fvg" else "order block"
        entry = f"The move that broke structure left a {name} between {fmt(z['low'])} and {fmt(z['high'])}. Entry sits at its middle, about {fmt(s['entry'])}."
        stop = f"The idea is wrong if price goes back {'below' if bull else 'above'} the setup {lowhigh} at {fmt(s['extreme_price'])}. The stop sits just beyond it, about {fmt(s['stop'])}."
        target = f"The nearest untaken {opp} liquidity is the swing {'high' if bull else 'low'} at {fmt(s['target'])}."
    if kind == "valid":
        overall = f"A valid {s['direction']} setup at about {s['rr']:.1f}:1, clearing the {MIN_RR:g}:1 minimum."
    elif kind == "low_rr":
        overall = f"Every step lines up, but the nearest {opp} liquidity is too close: about {s['rr']:.1f}:1, below {MIN_RR:g}:1. No trade."
    elif kind == "no_entry":
        overall = "Bias is clear, but there is no level to enter from. No trade."
    else:
        overall = "Bias is unclear, so there is no trade."
    return {k: f"{DRAFT_NOTE} {v}" for k, v in {"bias": bias, "entry": entry, "stop": stop, "target": target, "overall": overall}.items()}


def difficulty(s: Dict[str, Any]) -> int:
    return {"valid": 1 if s.get("rr", 0) >= 3 else 2, "no_shift": 1, "no_entry": 2, "no_sweep": 3, "low_rr": 3}[s["kind"]]


def candles_out(bars: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{"time": c["_dt"].strftime("%H:%M"), "timestamp": c["timestamp"], "open": c["open"], "high": c["high"],
             "low": c["low"], "close": c["close"]} for c in bars]


def build(mode: str, exercise_id: str, day: List[Dict[str, Any]], n_ctx: int, s: Dict[str, Any],
          meta: Dict[str, Any], params: Dict[str, Any], number: int) -> Dict[str, Any]:
    t = texts(s)
    bull = s.get("direction") == "bullish"
    kind = s["kind"]
    provenance = {
        "data_source": meta["source"],
        "symbol": meta["symbol"],
        "date_range": None,
        "trading_date": trading_date(day[n_ctx]["_dt"]).isoformat(),
        "session": (meta.get("selection") or {}).get("session", "all"),
        "context_start": (meta.get("selection") or {}).get("context_start"),
        "timeframe": f"{meta['timeframe_minutes']}m",
        "detection_rule": "guided_setup" if mode == "guided" else "free_trade_setup",
        "curriculum_versions": curriculum_versions("guided_setup" if mode == "guided" else "free_trade_setup"),
        "candidate_id": f"setup-{kind}-{trading_date(day[n_ctx]['_dt']).strftime('%Y%m%d')}",
        "detection_params": params,
        "detection_notes": s["notes"],
        "input_sha256": meta["input_sha256"],
        "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "human_reviewed": False,
        "reviewed_by": None,
        "reviewed_at": None,
        "review_notes": None,
    }
    base = {
        "exercise_id": exercise_id,
        "instrument": f"{meta['symbol']} (real data)",
        "timeframe": provenance["timeframe"],
        "difficulty": difficulty(s),
        "explanation": t["overall"],
    }
    has_levels = kind in ("valid", "low_rr")
    if mode == "guided":
        if kind == "no_shift":
            end = len(day) - 1
        elif has_levels:
            end = min(len(day) - 1, s["zone"]["formed_index"] + 3)
        else:
            end = min(len(day) - 1, s["break_index"] + 3)
        window = day[:end + 1]
        provenance["date_range"] = {"start": window[0]["timestamp"], "end": window[-1]["timestamp"]}
        lvl = lambda p: {"price": round_price(p), "tolerance": s["level_tolerance"]}  # noqa: E731
        return {
            **base,
            "concept": "GuidedEntry",
            "answer_type": "guided",
            "answerLabel": "a valid trade setup",
            "prompt": "Work through the setup: bias, entry, stop, and target.",
            "answer": {
                "bias": s["direction"] if kind in ("valid", "low_rr", "no_entry") else "unclear",
                "entry": {"price": s["entry"], "tolerance": s["entry_tolerance"]} if has_levels else None,
                "stop": lvl(s["stop"]) if has_levels else None,
                "target": lvl(s["target"]) if has_levels else None,
                "min_rr": MIN_RR,
                "is_valid_setup": kind == "valid",
                "step_explanations": {k: t[k] for k in ("bias", "entry", "stop", "target")},
                "overall_explanation": t["overall"],
            },
            "provenance": provenance,
            "candles": candles_out(window),
        }
    # Free Trade
    provenance["date_range"] = {"start": day[0]["timestamp"], "end": day[-1]["timestamp"]}
    ext, m = s.get("extreme_price"), s.get("median_range")
    stop_zone = None
    if has_levels:
        stop_zone = ({"price_low": tick(ext - m), "price_high": round_price(ext - TICK)} if bull
                     else {"price_low": round_price(ext + TICK), "price_high": tick(ext + m)})
    return {
        **base,
        "concept": "FreeTrade",
        "answer_type": "free",
        "title": f"Real NY AM session {number}",
        "answerLabel": f"Real NY AM session {number}",
        "prompt": "Play the chart forward. Trade it if a valid setup forms — or don't.",
        "answer": {
            "intended_bias": ("long" if bull else "short") if kind in ("valid", "low_rr", "no_entry") else "none",
            "is_valid_setup": kind == "valid",
            "entry_zone": ({"price_low": s["zone"]["low"], "price_high": s["zone"]["high"],
                            "earliest_index": s["zone"]["formed_index"] + 1} if has_levels else None),
            "stop_zone": stop_zone,
            "target": s["target"] if has_levels else None,
            "min_rr": MIN_RR,
        },
        "provenance": provenance,
        "candles": candles_out(day[:n_ctx]),
        "hidden_candles": candles_out(day[n_ctx:]),
    }


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("clean")
    ap.add_argument("candidates", help="candidates JSON from detect.py (for its detection params)")
    ap.add_argument("--mode", choices=["guided", "free"], required=True)
    ap.add_argument("--plan", required=True, help="kind=count list, e.g. valid=6,no_shift=1,no_sweep=1,no_entry=1,low_rr=1")
    ap.add_argument("--prefix", required=True)
    ap.add_argument("--first", type=int, default=1)
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args(argv)

    plan = {k: int(v) for k, v in (p.split("=") for p in args.plan.split(","))}
    if any(k not in KINDS for k in plan):
        print(f"ERROR: plan kinds must be among {', '.join(KINDS)}")
        return 1
    data = load_clean(args.clean)
    candles, meta = data["candles"], data["meta"]
    params = load_json(args.candidates)["meta"].get("detection_params", {})
    med = session_median_range(candles, params.get("range_window", 100))
    taken = used_dates()

    sessions: Dict[str, List[Dict[str, Any]]] = {k: [] for k in KINDS}
    for idxs in group_indices(candles, trading_date).values():
        o = idxs[0]
        day = candles[o:idxs[-1] + 1]
        n_ctx = next((k for k, c in enumerate(day) if not c.get("context")), len(day))
        if n_ctx == len(day) or len(day) - n_ctx < 18:
            continue  # no full NY AM session that day
        if trading_date(day[n_ctx]["_dt"]).isoformat() in taken:
            continue
        s = find_setup(day, n_ctx, med[o:o + len(day)], params)
        if s["kind"] not in sessions:
            continue
        s["median_range"] = med[o + s.get("break_index", n_ctx)]
        if args.mode == "free" and s["kind"] == "valid" and not fillable(day, s):
            continue
        sessions[s["kind"]].append((day, n_ctx, s))

    rnd = random.Random(args.seed)
    picks = []
    for kind, count in plan.items():
        pool = sessions[kind]
        if len(pool) < count:
            print(f"ERROR: only {len(pool)} '{kind}' sessions available, plan asks for {count}")
            return 1
        for slot in range(count):  # one per equal slice of the pool's date order
            lo, hi = len(pool) * slot // count, len(pool) * (slot + 1) // count
            picks.append((kind, pool[rnd.randrange(lo, hi)]))
    picks.sort(key=lambda p: p[1][0][p[1][1]]["timestamp"])
    rnd.shuffle(picks)  # so the kind isn't guessable from the id order

    for i, (kind, (day, n_ctx, s)) in enumerate(picks):
        exercise_id = f"{args.prefix}-{args.first + i:03d}"
        path = DEFAULT_OUTPUT_DIR / f"{exercise_id}.json"
        if path.exists():
            print(f"ERROR: {path} already exists")
            return 1
        write_json(path, build(args.mode, exercise_id, day, n_ctx, s, meta, params, args.first + i))
        print(f"{exercise_id}: {s['notes']} ({trading_date(day[n_ctx]['_dt'])})")
    print(f"Wrote {len(picks)} {args.mode} scenario(s) with human_reviewed = false. Register them: python3 scripts/register_scenarios.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
