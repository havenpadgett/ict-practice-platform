#!/usr/bin/env python3
"""Turn one detected candidate plus a window of candles into an exercise.

The answer key is derived from the candidate's detected levels - never typed
by hand - and the scenario is written with a provenance block marked
human_reviewed: false. Unreviewed scenarios are filtered out of practice by
the app; a human promotes one by reviewing it against docs/CURRICULUM.md and
docs/SCENARIO-VALIDATION.md.

Rule -> exercise mapping:
  fvg                             FVG, zone answer
  order_block                     OrderBlock, zone answer
  equal_highs / equal_lows        Liquidity, level answer (buy/sell side)
  mss                             MSS, level answer (the broken swing)
  previous_day_*, ny_am_*, weekly_*   TimeLiquidity, level answer

Example:
  python3 scripts/build_scenario.py data/nq_5m.clean.json data/nq_5m.candidates.json \\
      --candidate fvg-bullish-20260303T0945 --exercise-id real-fvg-001 --difficulty 2
"""

from __future__ import annotations

import argparse
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from common import load_clean, load_json, round_price, trading_date, write_json
from detect import session_median_range

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent.parent / "src" / "data" / "real-scenarios"

TIME_RULES = {
    "previous_day_high": ("Previous Day High", "Mark the previous trading day's high.", "No previous day high visible"),
    "previous_day_low": ("Previous Day Low", "Mark the previous trading day's low.", "No previous day low visible"),
    "ny_am_high": ("NY AM Session High", "Mark the high of the New York AM session (9:30-11:00 ET).", "No NY AM session high visible"),
    "ny_am_low": ("NY AM Session Low", "Mark the low of the New York AM session (9:30-11:00 ET).", "No NY AM session low visible"),
    "weekly_high": ("Previous Week High", "Mark the previous trading week's high.", "No previous week high visible"),
    "weekly_low": ("Previous Week Low", "Mark the previous trading week's low.", "No previous week low visible"),
}

# Rules that read structure from context bars (docs/CURRICULUM.md, MSS and
# Order Blocks), so their windows include them.
STRUCTURE_RULES = ("mss", "order_block")

DRAFT_NOTE = "[DRAFT - generated from the detection rule; rewrite in plain language during review.]"


def timeframe_label(minutes: int) -> str:
    if minutes % 1440 == 0:
        return f"{minutes // 1440}D"
    if minutes % 60 == 0:
        return f"{minutes // 60}h"
    return f"{minutes}m"


def default_window(cand: Dict[str, Any], before: int, after: int) -> Tuple[int, int]:
    start = min(cand["involved_indices"]) - before
    end = cand["anchor_index"] + after
    return start, end


def map_exercise(cand: Dict[str, Any], start: int) -> Dict[str, Any]:
    """Concept, answer_type, answer key and copy for a candidate, with candle
    indices made relative to the window start."""
    rule, levels = cand["rule"], cand["levels"]
    if rule == "fvg":
        k = cand["involved_indices"][1] - start
        return {
            "concept": "FVG",
            "answer_type": "zone",
            "answerLabel": "Fair Value Gap",
            "prompt": "Identify the Fair Value Gap, if there is one.",
            "noAnswerLabel": "No FVG present",
            "answer": {
                "type": cand["direction"],
                "price_low": levels["price_low"],
                "price_high": levels["price_high"],
                "candle_start": k - 1,
                "candle_end": k + 1,
                "key_candle_index": k,
            },
            "explanation": (
                f"{DRAFT_NOTE} A {cand['direction']} Fair Value Gap: the first candle's "
                f"{'high' if cand['direction'] == 'bullish' else 'low'} and the third candle's "
                f"{'low' if cand['direction'] == 'bullish' else 'high'} leave the range "
                f"{levels['price_low']:g}-{levels['price_high']:g} untraded."
            ),
        }
    if rule == "order_block":
        k = cand["ob_index"] - start
        return {
            "concept": "OrderBlock",
            "answer_type": "zone",
            "answerLabel": "Order Block",
            "prompt": "Identify the Order Block, if there is one.",
            "noAnswerLabel": "No Order Block present",
            "answer": {
                "type": cand["direction"],
                "price_low": levels["price_low"],
                "price_high": levels["price_high"],
                "candle_start": k,
                "candle_end": k,
                "key_candle_index": k,
            },
            "explanation": f"{DRAFT_NOTE} {cand['notes']}.",
        }
    if rule in ("equal_highs", "equal_lows"):
        buy = rule == "equal_highs"
        label = "Buy-Side Liquidity" if buy else "Sell-Side Liquidity"
        return {
            "concept": "Liquidity",
            "answer_type": "level",
            "answerLabel": label,
            "prompt": f"Mark the strongest {label}, if there is one.",
            "noAnswerLabel": f"No {label} present",
            "answer": {"type": "buy_side" if buy else "sell_side", "price": levels["price"]},
            "explanation": (
                f"{DRAFT_NOTE} {len(cand['involved_indices'])} {'highs' if buy else 'lows'} land within "
                f"{max(cand['touch_prices']) - min(cand['touch_prices']):g} points of each other around "
                f"{levels['price']:g}, stacking resting stops into one larger pool."
            ),
        }
    if rule == "mss":
        return {
            "concept": "MSS",
            "answer_type": "level",
            "answerLabel": "Market Structure Shift",
            "prompt": "Mark the swing level whose break confirmed the Market Structure Shift, if one occurred.",
            "noAnswerLabel": "No Market Structure Shift present",
            "answer": {"type": cand["direction"], "price": levels["price"]},
            "explanation": (
                f"{DRAFT_NOTE} A {cand['direction']} Market Structure Shift: a candle body closed beyond the swing "
                f"at {levels['price']:g}, against the prevailing trend."
            ),
        }
    if rule in TIME_RULES:
        label, prompt, no_answer = TIME_RULES[rule]
        return {
            "concept": "TimeLiquidity",
            "answer_type": "level",
            "answerLabel": label,
            "prompt": prompt,
            "noAnswerLabel": no_answer,
            "answer": {"type": rule, "price": levels["price"]},
            "explanation": f"{DRAFT_NOTE} {cand['notes']}.",
        }
    sys.exit(f"ERROR: no exercise mapping for rule '{rule}'.")


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("clean", help="clean JSON from ingest.py")
    ap.add_argument("candidates", help="candidates JSON from detect.py")
    ap.add_argument("--candidate", required=True, help="candidate id to build from")
    ap.add_argument("--exercise-id", required=True, help="id for the new exercise, e.g. real-fvg-001")
    ap.add_argument("--difficulty", type=int, choices=[1, 2, 3], default=2)
    ap.add_argument("--before", type=int, default=30, help="bars before the earliest involved candle (default 30)")
    ap.add_argument("--after", type=int, default=10, help="bars after the anchor candle (default 10)")
    ap.add_argument("--window", choices=["bars", "session"],
                    help="'session' = the candidate's whole session (with its context bars for mss); "
                         "'bars' = --before/--after (default: session for session-only data, else bars)")
    ap.add_argument("--visible-gap-mult", type=float, default=0.1,
                    help="fvg: refuse a window holding any other three-candle gap at least this multiple of the "
                         "trailing median bar range, even one below detection's minimum (default 0.1)")
    ap.add_argument("--start", help="window start timestamp (overrides --before)")
    ap.add_argument("--end", help="window end timestamp (overrides --after)")
    ap.add_argument("--tolerance", type=float, help="level tolerance in points (default: half the window's median bar range, min 2)")
    ap.add_argument("--allow-ambiguous", action="store_true", help="write even if the window contains other candidates of the same rule")
    ap.add_argument("-o", "--output", help="output JSON (default: src/data/real-scenarios/<exercise-id>.json)")
    args = ap.parse_args(argv)

    data = load_clean(args.clean)
    cands = load_json(args.candidates)
    candles = data["candles"]
    by_id = {c["id"]: c for c in cands["candidates"]}
    cand = by_id.get(args.candidate)
    if cand is None:
        print(f"ERROR: candidate '{args.candidate}' not found in {args.candidates}.")
        return 1
    if cands["meta"].get("input_sha256") != data["meta"].get("input_sha256"):
        print("ERROR: candidates were detected from a different clean file (input_sha256 mismatch).")
        return 1

    meta = data["meta"]
    selection = meta.get("selection") or {}
    window_mode = args.window or ("session" if selection.get("session", "all") != "all" else "bars")
    if cand.get("context"):
        print(f"ERROR: {cand['id']} breaks inside the context bars, not the session - not a setup.")
        return 1
    if window_mode == "session":
        day = trading_date(candles[cand["anchor_index"]]["_dt"])
        idxs = [i for i, c in enumerate(candles) if trading_date(c["_dt"]) == day
                and (cand["rule"] in STRUCTURE_RULES or not c.get("context"))]
        start, end = idxs[0], idxs[-1]
    else:
        start, end = default_window(cand, args.before, args.after)
    index_of = {c["timestamp"]: i for i, c in enumerate(candles)}
    if args.start:
        if args.start not in index_of:
            print(f"ERROR: --start {args.start} is not a bar timestamp in the clean data.")
            return 1
        start = index_of[args.start]
    if args.end:
        if args.end not in index_of:
            print(f"ERROR: --end {args.end} is not a bar timestamp in the clean data.")
            return 1
        end = index_of[args.end]
    start, end = max(0, start), min(len(candles) - 1, end)
    involved = cand["involved_indices"]
    if min(involved) < start or max(involved) > end:
        print(f"ERROR: window [{start}, {end}] doesn't contain every candle that defines the candidate {involved}.")
        return 1
    window = candles[start:end + 1]

    # PRD Section 5 ambiguity rule: a scenario must have exactly one valid
    # answer. Other candidates of the same rule inside the window make the
    # answer key ambiguous.
    others = [
        c for c in cands["candidates"]
        if c["id"] != cand["id"] and c["rule"] == cand["rule"]
        and start <= min(c["involved_indices"]) and max(c["involved_indices"]) <= end
    ]
    problems: List[str] = []
    if cand["rule"] == "fvg":
        # Gaps under detection's minimum are still visible on the chart; a
        # beginner who marks one mustn't be marked wrong (CURRICULUM.md).
        med = session_median_range(candles, cands["meta"].get("detection_params", {}).get("range_window", 100))
        k0 = cand["involved_indices"][1]
        for k in range(start + 1, end):
            c1, c3 = candles[k - 1], candles[k + 1]
            gap = max(c3["low"] - c1["high"], c1["low"] - c3["high"])
            if k != k0 and gap > 0 and gap >= args.visible_gap_mult * med[k - 1]:
                problems.append(f"another visible gap of {gap:g} points around {candles[k]['timestamp']}")
    if cand["rule"] in ("equal_highs", "equal_lows"):
        # The pool must still be resting at the end of the chart.
        buy = cand["rule"] == "equal_highs"
        pool = max(cand["touch_prices"]) if buy else min(cand["touch_prices"])
        taken = [c for c in candles[cand["anchor_index"] + 1:end + 1] if (c["high"] > pool if buy else c["low"] < pool)]
        if taken:
            problems.append(f"the pool at {pool:g} is taken at {taken[0]['timestamp']} before the chart ends")
    if problems and not args.allow_ambiguous:
        print("ERROR: " + "; ".join(problems[:5]))
        return 1
    if others and not args.allow_ambiguous:
        print(f"ERROR: window also contains {len(others)} other '{cand['rule']}' candidate(s): "
              + ", ".join(c["id"] for c in others[:8]))
        print("Narrow the window (--before/--after/--start/--end) or pass --allow-ambiguous and resolve it in review.")
        return 1

    mapped = map_exercise(cand, start)
    if mapped["answer_type"] == "level":
        median_range = statistics.median(c["high"] - c["low"] for c in window)
        tol = args.tolerance if args.tolerance is not None else max(2.0, round(median_range / 2 * 4) / 4)
        mapped["answer"]["tolerance"] = round_price(tol)

    exercise = {
        "exercise_id": args.exercise_id,
        "concept": mapped["concept"],
        "answer_type": mapped["answer_type"],
        "answerLabel": mapped["answerLabel"],
        "prompt": mapped["prompt"],
        "noAnswerLabel": mapped["noAnswerLabel"],
        "instrument": f"{meta['symbol']} (real data)",
        "timeframe": timeframe_label(meta["timeframe_minutes"]),
        "difficulty": args.difficulty,
        "has_answer": True,
        "answer": mapped["answer"],
        "explanation": mapped["explanation"],
        "provenance": {
            "data_source": meta["source"],
            "symbol": meta["symbol"],
            "date_range": {"start": window[0]["timestamp"], "end": window[-1]["timestamp"]},
            "trading_date": trading_date(candles[cand["anchor_index"]]["_dt"]).isoformat(),
            "session": selection.get("session", "all"),
            "context_start": selection.get("context_start") if cand["rule"] in STRUCTURE_RULES else None,
            "timeframe": timeframe_label(meta["timeframe_minutes"]),
            "detection_rule": cand["rule"],
            "candidate_id": cand["id"],
            "detection_params": cands["meta"].get("detection_params", {}),
            "detection_notes": cand["notes"],
            "input_sha256": meta["input_sha256"],
            "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "human_reviewed": False,
            "reviewed_by": None,
            "reviewed_at": None,
            "review_notes": None,
        },
        "candles": [
            {
                "time": c["_dt"].strftime("%H:%M"),
                "timestamp": c["timestamp"],
                "open": c["open"],
                "high": c["high"],
                "low": c["low"],
                "close": c["close"],
            }
            for c in window
        ],
    }

    out_path = Path(args.output) if args.output else DEFAULT_OUTPUT_DIR / f"{args.exercise_id}.json"
    if out_path.exists():
        print(f"ERROR: {out_path} already exists - pick a new --exercise-id or delete it first.")
        return 1
    write_json(out_path, exercise)

    print(f"Built {args.exercise_id} ({mapped['concept']}, {mapped['answer_type']}) from candidate {cand['id']}.")
    print(f"Window: {window[0]['timestamp']} -> {window[-1]['timestamp']} ({len(window)} bars)")
    print(f"Answer key (derived): {mapped['answer']}")
    if len(window) > 120:
        print(f"WARNING: {len(window)} bars is a lot for one chart - consider a higher timeframe "
              "(e.g. ingest 1h bars for previous-day/weekly levels) or a tighter --start/--end.")
    if others:
        print(f"WARNING: {len(others)} other '{cand['rule']}' candidate(s) in the window - resolve during review.")
    print(f"Wrote {out_path} with provenance.human_reviewed = false (hidden from practice).")
    print("Next: review it against docs/SCENARIO-VALIDATION.md, rewrite the explanation, then register it in "
          "src/data/real-scenarios/index.ts.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
