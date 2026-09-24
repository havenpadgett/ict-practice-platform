#!/usr/bin/env python3
"""Scan clean data (from ingest.py) and flag candidate setups.

Rules implement docs/CURRICULUM.md exactly - if this file and the curriculum
disagree, the curriculum is right and this is a bug:

  fvg                 Three-candle Fair Value Gap: candle 1's high below
                      candle 3's low (bullish) or candle 1's low above
                      candle 3's high (bearish). Zone = the unfilled range.
  equal_highs/lows    Two or more swing highs (lows) within --equal-tolerance
                      points of each other, with no price trading beyond the
                      pool between them. Level = their average.
  mss                 Market Structure Shift, confirmed by a candle BODY close
                      beyond the swing point: in an uptrend (last two swing
                      highs and last two swing lows both rising), the first
                      close below the most recent higher low (bearish);
                      mirrored for a downtrend (bullish). Level = the swing.
  previous_day_high/low   Prior trading day's high/low (trading day = 18:00 ET
                      to 17:00 ET), as a level for the following day.
  ny_am_high/low      High/low of the 9:30-11:00 ET session (complete sessions
                      only, timeframes of 30m or less).
  weekly_high/low     Prior trading week's high/low, as a level for the
                      following week.

Swing points are fractals: a high strictly above the --swing-lookback bars to
its left and at least as high as those to its right (mirrored for lows).

This only FINDS candidates. Whether one becomes an exercise is a human
decision - see docs/SCENARIO-VALIDATION.md.

Example:
  python3 scripts/detect.py data/nq_5m.clean.json -o data/nq_5m.candidates.json
"""

from __future__ import annotations

import argparse
import sys
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from common import Candle, in_ny_am, load_clean, round_price, trading_date, trading_week, write_json

ALL_RULES = ["fvg", "equal_highs", "equal_lows", "mss", "previous_day", "ny_am", "weekly"]


def ts(candles: List[Candle], i: int) -> str:
    return candles[i]["timestamp"]


def cid(rule: str, candles: List[Candle], i: int, suffix: str = "") -> str:
    stamp = candles[i]["_dt"].strftime("%Y%m%dT%H%M")
    return f"{rule}{'-' + suffix if suffix else ''}-{stamp}"


def candidate(rule: str, direction: str, cid_: str, candles: List[Candle], involved: List[int], anchor: int,
              levels: Dict[str, float], notes: str, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    c: Dict[str, Any] = OrderedDict()
    c["id"] = cid_
    c["rule"] = rule
    c["direction"] = direction
    c["levels"] = {k: round_price(v) for k, v in levels.items()}
    c["involved_indices"] = involved
    c["involved_timestamps"] = [ts(candles, i) for i in involved]
    c["anchor_index"] = anchor
    c["anchor_timestamp"] = ts(candles, anchor)
    c["notes"] = notes
    if extra:
        c.update(extra)
    return c


# ---- FVG -------------------------------------------------------------------

def detect_fvg(candles: List[Candle], min_size: float) -> List[Dict[str, Any]]:
    out = []
    for k in range(1, len(candles) - 1):
        c1, c3 = candles[k - 1], candles[k + 1]
        if c1["high"] < c3["low"] and c3["low"] - c1["high"] >= min_size:
            out.append(candidate("fvg", "bullish", cid("fvg", candles, k, "bullish"), candles, [k - 1, k, k + 1], k + 1,
                                 {"price_low": c1["high"], "price_high": c3["low"]},
                                 f"candle 1 high {c1['high']:g} < candle 3 low {c3['low']:g}"))
        if c1["low"] > c3["high"] and c1["low"] - c3["high"] >= min_size:
            out.append(candidate("fvg", "bearish", cid("fvg", candles, k, "bearish"), candles, [k - 1, k, k + 1], k + 1,
                                 {"price_low": c3["high"], "price_high": c1["low"]},
                                 f"candle 1 low {c1['low']:g} > candle 3 high {c3['high']:g}"))
    return out


# ---- Swings ----------------------------------------------------------------

def swing_highs(candles: List[Candle], n: int) -> List[int]:
    out = []
    for i in range(n, len(candles) - n):
        h = candles[i]["high"]
        if all(h > candles[j]["high"] for j in range(i - n, i)) and all(h >= candles[j]["high"] for j in range(i + 1, i + n + 1)):
            out.append(i)
    return out


def swing_lows(candles: List[Candle], n: int) -> List[int]:
    out = []
    for i in range(n, len(candles) - n):
        low = candles[i]["low"]
        if all(low < candles[j]["low"] for j in range(i - n, i)) and all(low <= candles[j]["low"] for j in range(i + 1, i + n + 1)):
            out.append(i)
    return out


# ---- Equal highs / lows ----------------------------------------------------

def detect_equal(candles: List[Candle], swings: List[int], side: str, tol: float) -> List[Dict[str, Any]]:
    key = "high" if side == "highs" else "low"
    out = []
    used = set()
    for a_pos, a in enumerate(swings):
        if a in used:
            continue
        cluster = [a]
        for b in swings[a_pos + 1:]:
            prices = [candles[i][key] for i in cluster] + [candles[b][key]]
            if max(prices) - min(prices) > tol:
                continue
            # The pool must still be resting: nothing between the touches may
            # trade beyond it (that would have taken the liquidity already).
            between = range(cluster[-1] + 1, b)
            if side == "highs" and any(candles[j]["high"] > max(prices) for j in between):
                break
            if side == "lows" and any(candles[j]["low"] < min(prices) for j in between):
                break
            cluster.append(b)
        if len(cluster) >= 2:
            used.update(cluster)
            prices = [candles[i][key] for i in cluster]
            level = sum(prices) / len(prices)
            rule = f"equal_{side}"
            out.append(candidate(rule, "buy_side" if side == "highs" else "sell_side", cid(rule, candles, cluster[-1]),
                                 candles, cluster, cluster[-1], {"price": level},
                                 f"{len(cluster)} touches within {max(prices) - min(prices):g} points (tolerance {tol:g})",
                                 {"touch_prices": [round_price(p) for p in prices]}))
    return out


# ---- MSS -------------------------------------------------------------------

def detect_mss(candles: List[Candle], highs: List[int], lows: List[int], n: int) -> List[Dict[str, Any]]:
    out = []
    used_swings = set()
    for i in range(len(candles)):
        # Only swings already confirmed (n bars to their right) by candle i.
        sh = [s for s in highs if s + n < i]
        sl = [s for s in lows if s + n < i]
        if len(sh) < 2 or len(sl) < 2:
            continue
        close, prev_close = candles[i]["close"], candles[i - 1]["close"]
        up = candles[sh[-1]]["high"] > candles[sh[-2]]["high"] and candles[sl[-1]]["low"] > candles[sl[-2]]["low"]
        down = candles[sh[-1]]["high"] < candles[sh[-2]]["high"] and candles[sl[-1]]["low"] < candles[sl[-2]]["low"]
        if up and sl[-1] not in used_swings:
            level = candles[sl[-1]]["low"]
            if close < level <= prev_close:
                used_swings.add(sl[-1])
                failed = max(c["high"] for c in candles[sl[-1]:i + 1]) <= candles[sh[-1]]["high"]
                out.append(candidate("mss", "bearish", cid("mss", candles, i, "bearish"), candles, [sh[-2], sh[-1], sl[-2], sl[-1], i], i,
                                     {"price": level},
                                     f"uptrend; body close {close:g} below higher low {level:g}"
                                     + ("" if failed else " (NOTE: a new high printed before the break - check it's structural)"),
                                     {"swing_index": sl[-1], "break_index": i, "failed_new_extreme": failed}))
        if down and sh[-1] not in used_swings:
            level = candles[sh[-1]]["high"]
            if close > level >= prev_close:
                used_swings.add(sh[-1])
                failed = min(c["low"] for c in candles[sh[-1]:i + 1]) >= candles[sl[-1]]["low"]
                out.append(candidate("mss", "bullish", cid("mss", candles, i, "bullish"), candles, [sl[-2], sl[-1], sh[-2], sh[-1], i], i,
                                     {"price": level},
                                     f"downtrend; body close {close:g} above lower high {level:g}"
                                     + ("" if failed else " (NOTE: a new low printed before the break - check it's structural)"),
                                     {"swing_index": sh[-1], "break_index": i, "failed_new_extreme": failed}))
    return out


# ---- Time-based levels -----------------------------------------------------

def group_indices(candles: List[Candle], key_fn) -> "OrderedDict[Any, List[int]]":
    groups: "OrderedDict[Any, List[int]]" = OrderedDict()
    for i, c in enumerate(candles):
        groups.setdefault(key_fn(c["_dt"]), []).append(i)
    return groups


def period_levels(candles: List[Candle], groups: "OrderedDict[Any, List[int]]", rule_prefix: str, label: str) -> List[Dict[str, Any]]:
    """For each period after the first, the previous period's high and low as
    levels for the current period - plus when (if ever) each was taken."""
    out = []
    keys = list(groups.keys())
    for prev_key, cur_key in zip(keys, keys[1:]):
        prev, cur = groups[prev_key], groups[cur_key]
        hi = max(prev, key=lambda i: candles[i]["high"])
        lo = min(prev, key=lambda i: candles[i]["low"])
        for side, idx, direction in (("high", hi, "buy_side"), ("low", lo, "sell_side")):
            price = candles[idx][side]
            taken = next((i for i in cur if (candles[i]["high"] > price if side == "high" else candles[i]["low"] < price)), None)
            rule = f"{rule_prefix}_{side}"
            out.append(candidate(rule, direction, f"{rule}-{cur_key.isoformat()}", candles, [idx], cur[0], {"price": price},
                                 f"{label} {prev_key.isoformat()} {side} {price:g}; "
                                 + (f"taken at {ts(candles, taken)}" if taken is not None else f"not taken during {cur_key.isoformat()}"),
                                 {"period": prev_key.isoformat(), "applies_to": cur_key.isoformat(),
                                  "period_indices": [prev[0], prev[-1]], "current_indices": [cur[0], cur[-1]],
                                  "taken_index": taken}))
    return out


def detect_ny_am(candles: List[Candle], tf: int) -> List[Dict[str, Any]]:
    if tf > 30:
        return []
    expected = 90 // tf
    out = []
    sessions = group_indices(candles, lambda dt: dt.date())
    for day, idxs in sessions.items():
        s = [i for i in idxs if in_ny_am(candles[i]["_dt"])]
        if len(s) != expected:
            continue  # incomplete session
        hi = max(s, key=lambda i: candles[i]["high"])
        lo = min(s, key=lambda i: candles[i]["low"])
        after = [i for i in idxs if i > s[-1]]
        for side, idx, direction in (("high", hi, "buy_side"), ("low", lo, "sell_side")):
            price = candles[idx][side]
            taken = next((i for i in after if (candles[i]["high"] > price if side == "high" else candles[i]["low"] < price)), None)
            rule = f"ny_am_{side}"
            out.append(candidate(rule, direction, f"{rule}-{day.isoformat()}", candles, [idx], s[-1], {"price": price},
                                 f"NY AM {day.isoformat()} {side} {price:g}; "
                                 + (f"taken at {ts(candles, taken)}" if taken is not None else "not taken later that day"),
                                 {"session_indices": [s[0], s[-1]], "taken_index": taken}))
    return out


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("clean", help="clean JSON from ingest.py")
    ap.add_argument("-o", "--output", help="output JSON (default: <clean stem>.candidates.json)")
    ap.add_argument("--rules", default=",".join(ALL_RULES), help=f"comma-separated subset of: {', '.join(ALL_RULES)}")
    ap.add_argument("--swing-lookback", type=int, default=2, help="bars each side that define a swing point (default 2)")
    ap.add_argument("--equal-tolerance", type=float, default=2.0, help="max spread in points for equal highs/lows (default 2)")
    ap.add_argument("--fvg-min-size", type=float, default=0.0, help="ignore gaps smaller than this many points (default 0)")
    args = ap.parse_args(argv)

    rules = [r.strip() for r in args.rules.split(",") if r.strip()]
    unknown = [r for r in rules if r not in ALL_RULES]
    if unknown:
        print(f"ERROR: unknown rule(s): {', '.join(unknown)}")
        return 1

    data = load_clean(args.clean)
    candles = data["candles"]
    tf = data["meta"]["timeframe_minutes"]
    n = args.swing_lookback
    highs, lows = swing_highs(candles, n), swing_lows(candles, n)

    found: List[Dict[str, Any]] = []
    if "fvg" in rules:
        found += detect_fvg(candles, args.fvg_min_size)
    if "equal_highs" in rules:
        found += detect_equal(candles, highs, "highs", args.equal_tolerance)
    if "equal_lows" in rules:
        found += detect_equal(candles, lows, "lows", args.equal_tolerance)
    if "mss" in rules:
        found += detect_mss(candles, highs, lows, n)
    if "previous_day" in rules:
        found += period_levels(candles, group_indices(candles, trading_date), "previous_day", "trading day")
    if "ny_am" in rules:
        found += detect_ny_am(candles, tf)
    if "weekly" in rules:
        found += period_levels(candles, group_indices(candles, trading_week), "weekly", "week of")
    found.sort(key=lambda c: (c["anchor_index"], c["rule"]))

    params = {"rules": rules, "swing_lookback": n, "equal_tolerance": args.equal_tolerance, "fvg_min_size": args.fvg_min_size}
    out_path = Path(args.output) if args.output else Path(args.clean).with_name(Path(args.clean).name.replace(".clean.json", "") + ".candidates.json")
    write_json(out_path, {
        "meta": {**data["meta"], "detection_params": params, "clean_file": Path(args.clean).name,
                 "detected_at": datetime.now(timezone.utc).isoformat(timespec="seconds")},
        "candidates": found,
    })

    counts: "OrderedDict[str, int]" = OrderedDict()
    for c in found:
        counts[c["rule"]] = counts.get(c["rule"], 0) + 1
    print(f"Scanned {len(candles)} bars ({data['meta']['start']} -> {data['meta']['end']}), "
          f"{len(highs)} swing highs, {len(lows)} swing lows (lookback {n}).")
    print(f"Found {len(found)} candidate(s):")
    for rule, count in sorted(counts.items()):
        print(f"  {rule:<20} {count}")
    if "ny_am" in rules and tf > 30:
        print(f"  (ny_am skipped: {tf}m bars are too coarse for a 9:30-11:00 session)")
    print(f"Wrote {out_path}")
    print("These are candidates only. Next: pick one and run scripts/build_scenario.py --candidate <id>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
