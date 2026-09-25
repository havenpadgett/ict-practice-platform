"""Guided Entry / Free Trade setup finder (docs/CURRICULUM.md - Guided Entry).

Reads one session (a trading day's bars from a clean file, structure context
first) and decides whether it holds a valid trade setup, applying the four
steps as a chain:

  1. Bias      - the session's first MSS whose break is inside the session,
                 AND the swing that formed the setup took opposing liquidity
                 first (bullish: the setup low traded below the previous
                 confirmed swing low; bearish mirrored). An MSS without that
                 sweep, or no MSS at all, is "unclear".
  2. Entry     - an FVG (at or above the detection floor) left by the move
                 from the setup extreme to the break (its third candle at
                 most two bars after the break); failing that, the order
                 block whose displacement made the break. Entry price = the
                 zone's midpoint; tolerance = half the zone, at least half
                 the tick-rounded quarter median range.
  3. Stop      - beyond the setup extreme by 0.1x the median bar range.
  4. Target    - the nearest confirmed swing high (low, for a short) still
                 untaken when the entry level forms and beyond both the
                 entry and that bar's close: the next opposing liquidity.

Valid only if all four exist and R:R = reward / risk from the entry
midpoint is at least 2. Every level comes from detected structure; nothing
is typed in.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from detect import (Candle, detect_fvg, detect_mss, detect_order_blocks, swing_highs, swing_lows)

MIN_RR = 2.0
TICK = 0.25


def tick(x: float) -> float:
    return round(x / TICK) * TICK


def find_setup(day: List[Candle], n_ctx: int, med: List[float], params: Dict[str, Any], n: int = 2) -> Dict[str, Any]:
    """`day` is one session with its n_ctx leading context bars; `med` the
    trailing median bar range for each bar of `day`. Returns a dict with
    `kind` (valid | no_shift | no_sweep | no_entry | no_target | low_rr)
    and whatever levels were found along the way."""
    highs, lows = swing_highs(day, n), swing_lows(day, n)
    shifts = [m for m in detect_mss(day, highs, lows, n) if m["break_index"] >= n_ctx]
    if not shifts:
        return {"kind": "no_shift", "notes": "no Market Structure Shift breaks inside the session"}
    mss = shifts[0]
    bull = mss["direction"] == "bullish"
    b, sw = mss["break_index"], mss["swing_index"]
    rng = range(sw, b + 1)
    ext = min(rng, key=lambda k: day[k]["low"]) if bull else max(rng, key=lambda k: day[k]["high"])
    ext_price = day[ext]["low"] if bull else day[ext]["high"]
    out: Dict[str, Any] = {"mss": mss, "direction": mss["direction"], "break_index": b, "broken_level": mss["levels"]["price"],
                           "extreme_index": ext, "extreme_price": ext_price}

    prior = [s for s in (lows if bull else highs) if s < ext and s + n <= ext]
    if not prior:
        return {**out, "kind": "no_sweep", "notes": "no earlier swing for the setup to sweep"}
    swept = prior[-1]
    swept_price = day[swept]["low"] if bull else day[swept]["high"]
    out["swept_index"], out["swept_price"] = swept, swept_price
    if not (ext_price < swept_price if bull else ext_price > swept_price):
        return {**out, "kind": "no_sweep", "notes": f"the setup {'low' if bull else 'high'} {ext_price:g} did not take the "
                                                    f"previous swing {'low' if bull else 'high'} {swept_price:g}"}

    m = med[b]
    floor = [x * params.get("fvg_min_range_mult", 0.25) for x in med]
    fvgs = [f for f in detect_fvg(day, floor) if f["direction"] == mss["direction"]
            and f["involved_indices"][0] >= ext and f["involved_indices"][2] <= b + 2]
    zone: Optional[Dict[str, Any]] = None
    if fvgs:
        f = fvgs[0]
        zone = {"source": "fvg", "low": f["levels"]["price_low"], "high": f["levels"]["price_high"],
                "formed_index": f["involved_indices"][2], "indices": f["involved_indices"]}
    else:
        obs = [o for o in detect_order_blocks(day, highs, lows, n, med, n_ctx, params.get("ob_displacement_mult", 2.0))
               if o["break_index"] == b]
        if obs:
            o = obs[0]
            zone = {"source": "order_block", "low": o["levels"]["price_low"], "high": o["levels"]["price_high"],
                    "formed_index": b, "indices": [o["ob_index"]]}
    if zone is None:
        return {**out, "kind": "no_entry", "notes": "the shift left no FVG or order block to enter from"}
    entry = tick((zone["low"] + zone["high"]) / 2)
    out["zone"], out["entry"] = zone, entry
    out["entry_tolerance"] = max(tick((zone["high"] - zone["low"]) / 2), tick(m / 4), TICK)

    stop = tick(ext_price - 0.1 * m) if bull else tick(ext_price + 0.1 * m)
    out["stop"] = stop
    out["level_tolerance"] = max(tick(m / 2), 2.0)

    t = zone["formed_index"]
    close_t = day[t]["close"]
    targets = []
    for s in (highs if bull else lows):
        if s + n > t:
            continue
        p = day[s]["high"] if bull else day[s]["low"]
        later = day[s + 1:t + 1]
        untaken = all(c["high"] <= p for c in later) if bull else all(c["low"] >= p for c in later)
        beyond = p > max(entry, close_t) if bull else p < min(entry, close_t)
        if untaken and beyond:
            targets.append((abs(p - entry), s, p))
    if not targets:
        return {**out, "kind": "no_target", "notes": "no untaken opposing liquidity beyond the entry"}
    _, t_idx, target = min(targets)
    out["target_index"], out["target"] = t_idx, target
    risk, reward = abs(entry - stop), abs(target - entry)
    out["rr"] = round(reward / risk, 2) if risk > 0 else 0.0
    if out["rr"] < MIN_RR:
        return {**out, "kind": "low_rr", "notes": f"best R:R from the entry is {out['rr']:.2f}, below {MIN_RR:g}"}
    return {**out, "kind": "valid", "notes": f"valid {mss['direction']} setup, R:R {out['rr']:.2f}"}
