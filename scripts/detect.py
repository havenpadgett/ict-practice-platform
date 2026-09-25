#!/usr/bin/env python3
"""Scan clean data (from ingest.py) and flag candidate setups.

Rules implement docs/CURRICULUM.md exactly - if this file and the curriculum
disagree, the curriculum is right and this is a bug:

  fvg                 Three-candle Fair Value Gap: candle 1's high below
                      candle 3's low (bullish) or candle 1's low above
                      candle 3's high (bearish). Zone = the unfilled range.
                      Gaps smaller than --fvg-min-range-mult x the median bar
                      range over the trailing --range-window session bars
                      (ending at candle 1) are ignored.
  equal_highs/lows    Two or more swing highs (lows) within
                      --equal-tolerance-pct percent of price of each other,
                      with no price trading beyond the pool between them.
                      Level = their average.
  mss                 Market Structure Shift, confirmed by a candle BODY close
                      beyond the swing point: in an uptrend (last two swing
                      highs and last two swing lows both rising), the first
                      close below the most recent higher low (bearish);
                      mirrored for a downtrend (bullish). Level = the swing.
  dealing_range       Premium/discount at the end of each session: the most
                      recent confirmed swing high and swing low that price
                      has not traded beyond since. Equilibrium = midpoint;
                      the last close is premium above 55% of the range,
                      discount below 45%, equilibrium in between.
  previous_day_high/low   Prior trading day's high/low (trading day = 18:00 ET
                      to 17:00 ET), as a level for the following day.
  ny_am_high/low      High/low of the 9:30-11:00 ET session (complete sessions
                      only, timeframes of 30m or less).
  weekly_high/low     Prior trading week's high/low, as a level for the
                      following week.

FVG, equal highs/lows, MSS and the swings they use are found within one
session at a time (a trading day, 18:00 ET to 17:00 ET) - a setup never
spans a session break, even when the data skips from one day's bars straight
to the next (e.g. an NY AM-only slice). When the data carries structure
context bars (ingest.py --context-start, flagged context: true), MSS reads
swings from them too but only a break inside the session is a setup; every
other rule ignores the context bars.

Swing points are fractals: a high strictly above the --swing-lookback bars to
its left and at least as high as those to its right (mirrored for lows).

This only FINDS candidates. Whether one becomes an exercise is a human
decision - see docs/SCENARIO-VALIDATION.md.

Example:
  python3 scripts/detect.py data/nq_5m.clean.json -o data/nq_5m.candidates.json
"""

from __future__ import annotations

import argparse
import bisect
import sys
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from common import Candle, in_ny_am, load_clean, round_price, trading_date, trading_week, write_json

# Defaults - see docs/CURRICULUM.md (Detection Parameters).
FVG_MIN_RANGE_MULT = 0.25
RANGE_WINDOW = 100
EQUAL_TOLERANCE_PCT = 0.05

ALL_RULES = ["fvg", "equal_highs", "equal_lows", "mss", "dealing_range", "previous_day", "ny_am", "weekly"]


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

def trailing_median_range(candles: List[Candle], window: int) -> List[float]:
    """For each bar, the median high-low range of the `window` bars ending at it
    (fewer at the start of the series). Uses only past bars - no lookahead."""
    out, win = [], []
    for i, c in enumerate(candles):
        bisect.insort(win, c["high"] - c["low"])
        if i >= window:
            old = candles[i - window]
            del win[bisect.bisect_left(win, old["high"] - old["low"])]
        m = len(win)
        out.append(win[m // 2] if m % 2 else (win[m // 2 - 1] + win[m // 2]) / 2)
    return out


def session_median_range(candles: List[Candle], window: int) -> List[float]:
    """trailing_median_range over session bars only - quiet context bars
    (ingest.py --context-start) would otherwise drag it down. Context bars
    themselves get 0."""
    session_idx = [i for i, c in enumerate(candles) if not c.get("context")]
    out = [0.0] * len(candles)
    for i, m in zip(session_idx, trailing_median_range([candles[i] for i in session_idx], window)):
        out[i] = m
    return out


def detect_fvg(candles: List[Candle], min_sizes: List[float]) -> List[Dict[str, Any]]:
    """min_sizes[i] is the smallest gap accepted when candle 1 is bar i."""
    out = []
    for k in range(1, len(candles) - 1):
        c1, c3 = candles[k - 1], candles[k + 1]
        min_size = min_sizes[k - 1]
        extra = {"min_size": round_price(min_size)}
        if c1["high"] < c3["low"] and c3["low"] - c1["high"] >= min_size:
            out.append(candidate("fvg", "bullish", cid("fvg", candles, k, "bullish"), candles, [k - 1, k, k + 1], k + 1,
                                 {"price_low": c1["high"], "price_high": c3["low"]},
                                 f"candle 1 high {c1['high']:g} < candle 3 low {c3['low']:g}", extra))
        if c1["low"] > c3["high"] and c1["low"] - c3["high"] >= min_size:
            out.append(candidate("fvg", "bearish", cid("fvg", candles, k, "bearish"), candles, [k - 1, k, k + 1], k + 1,
                                 {"price_low": c3["high"], "price_high": c1["low"]},
                                 f"candle 1 low {c1['low']:g} > candle 3 high {c3['high']:g}", extra))
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

def detect_equal(candles: List[Candle], swings: List[int], side: str, tol_pct: float) -> List[Dict[str, Any]]:
    key = "high" if side == "highs" else "low"
    out = []
    used = set()
    for a_pos, a in enumerate(swings):
        if a in used:
            continue
        cluster = [a]
        tol = candles[a][key] * tol_pct / 100
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
                                 f"{len(cluster)} touches within {max(prices) - min(prices):g} points "
                                 f"(tolerance {tol_pct:g}% = {tol:.2f} points)",
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


def to_global(c: Dict[str, Any], offset: int) -> Dict[str, Any]:
    """Shift a candidate's session-relative indices to indices in the full series."""
    c["involved_indices"] = [i + offset for i in c["involved_indices"]]
    c["anchor_index"] += offset
    for key in ("swing_index", "break_index", "high_index", "low_index"):
        if key in c:
            c[key] += offset
    return c


# ---- Dealing range (premium / discount) --------------------------------------

EQUILIBRIUM_BAND = 0.05  # +/- this fraction of the range around the midpoint


def detect_dealing_range(candles: List[Candle], highs: List[int], lows: List[int], n: int) -> List[Dict[str, Any]]:
    """Where the session's last close sits in its current dealing range."""
    i = len(candles) - 1
    sh = [s for s in highs if s + n <= i]
    sl = [s for s in lows if s + n <= i]
    if not sh or not sl:
        return []
    h_i, l_i = sh[-1], sl[-1]
    high, low = candles[h_i]["high"], candles[l_i]["low"]
    first = min(h_i, l_i)
    if any(c["high"] > high or c["low"] < low for c in candles[first:i + 1]):
        return []  # price has already left the range - it no longer frames the market
    pos = (candles[i]["close"] - low) / (high - low)
    zone = "premium" if pos > 0.5 + EQUILIBRIUM_BAND else "discount" if pos < 0.5 - EQUILIBRIUM_BAND else "equilibrium"
    leg = "bullish" if l_i < h_i else "bearish"
    return [candidate("dealing_range", zone, cid("dealing_range", candles, i, zone), candles, [first, max(h_i, l_i), i], i,
                      {"high": high, "low": low, "equilibrium": (high + low) / 2},
                      f"{leg} leg {low:g}-{high:g}; last close {candles[i]['close']:g} at {pos:.0%} of the range -> {zone}",
                      {"high_index": h_i, "low_index": l_i, "position": round(pos, 4)})]


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
    ap.add_argument("--equal-tolerance-pct", type=float, default=EQUAL_TOLERANCE_PCT,
                    help=f"max spread for equal highs/lows, as %% of the first touch's price (default {EQUAL_TOLERANCE_PCT:g})")
    ap.add_argument("--fvg-min-range-mult", type=float, default=FVG_MIN_RANGE_MULT,
                    help=f"ignore gaps smaller than this multiple of the trailing median bar range (default {FVG_MIN_RANGE_MULT:g})")
    ap.add_argument("--range-window", type=int, default=RANGE_WINDOW,
                    help=f"bars in the trailing median bar range window (default {RANGE_WINDOW})")
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
    session = (data["meta"].get("selection") or {}).get("session", "all")
    partial_rules = [r for r in ("previous_day", "weekly") if r in rules and session != "all"]
    if partial_rules:
        # A day's or week's high/low needs every bar of it, overnight included.
        rules = [r for r in rules if r not in partial_rules]
        print(f"NOTE: skipped {', '.join(partial_rules)} - the data holds only the {session} session, not full days.")
    fvg_min_sizes = [m * args.fvg_min_range_mult for m in session_median_range(candles, args.range_window)]

    found: List[Dict[str, Any]] = []
    swing_high_count = swing_low_count = 0
    for idxs in group_indices(candles, trading_date).values():
        offset, day = idxs[0], candles[idxs[0]:idxs[-1] + 1]
        # Leading bars flagged context (ingest.py --context-start) are
        # structure context for MSS only; every other rule sees the session.
        n_ctx = next((k for k, c in enumerate(day) if not c.get("context")), len(day))
        core_offset, core = offset + n_ctx, day[n_ctx:]
        highs, lows = swing_highs(core, n), swing_lows(core, n)
        swing_high_count += len(highs)
        swing_low_count += len(lows)
        in_core: List[Dict[str, Any]] = []
        if "fvg" in rules:
            in_core += detect_fvg(core, fvg_min_sizes[core_offset:core_offset + len(core)])
        if "equal_highs" in rules:
            in_core += detect_equal(core, highs, "highs", args.equal_tolerance_pct)
        if "equal_lows" in rules:
            in_core += detect_equal(core, lows, "lows", args.equal_tolerance_pct)
        if "dealing_range" in rules and core:
            in_core += detect_dealing_range(core, highs, lows, n)
        found += [to_global(c, core_offset) for c in in_core]
        if "mss" in rules:
            for c in detect_mss(day, swing_highs(day, n), swing_lows(day, n), n):
                if n_ctx:
                    # A break inside the context bars isn't a session setup,
                    # but stays listed so build_scenario can see it on a chart.
                    c["context"] = c["break_index"] < n_ctx
                found.append(to_global(c, offset))
    if "previous_day" in rules:
        found += period_levels(candles, group_indices(candles, trading_date), "previous_day", "trading day")
    if "ny_am" in rules:
        found += detect_ny_am(candles, tf)
    if "weekly" in rules:
        found += period_levels(candles, group_indices(candles, trading_week), "weekly", "week of")
    found.sort(key=lambda c: (c["anchor_index"], c["rule"]))

    params = {"rules": rules, "swing_lookback": n, "equal_tolerance_pct": args.equal_tolerance_pct,
              "fvg_min_range_mult": args.fvg_min_range_mult, "range_window": args.range_window}
    out_path = Path(args.output) if args.output else Path(args.clean).with_name(Path(args.clean).name.replace(".clean.json", "") + ".candidates.json")
    write_json(out_path, {
        "meta": {**data["meta"], "detection_params": params, "clean_file": Path(args.clean).name,
                 "detected_at": datetime.now(timezone.utc).isoformat(timespec="seconds")},
        "candidates": found,
    })

    counts: "OrderedDict[str, int]" = OrderedDict()
    context_count = 0
    for c in found:
        if c.get("context"):
            context_count += 1
            continue
        counts[c["rule"]] = counts.get(c["rule"], 0) + 1
    print(f"Scanned {len(candles)} bars ({data['meta']['start']} -> {data['meta']['end']}), "
          f"{swing_high_count} swing highs, {swing_low_count} swing lows (lookback {n}).")
    print(f"Found {len(found) - context_count} candidate(s):")
    for rule, count in sorted(counts.items()):
        print(f"  {rule:<20} {count}")
    if context_count:
        print(f"  (+{context_count} MSS breaking inside the context bars - listed with context: true, not setups)")
    if "ny_am" in rules and tf > 30:
        print(f"  (ny_am skipped: {tf}m bars are too coarse for a 9:30-11:00 session)")
    print(f"Wrote {out_path}")
    print("These are candidates only. Next: pick one and run scripts/build_scenario.py --candidate <id>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
