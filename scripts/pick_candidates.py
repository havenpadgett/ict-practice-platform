#!/usr/bin/env python3
"""Pick candidates spread evenly across a dataset and build them into scenarios.

The date range is split into --count equal slices; each slice contributes
one candidate, tried in random order (seeded, so a run is reproducible)
until build_scenario.py accepts one (it refuses ambiguous windows). Target
difficulty cycles 1, 2, 3 across slices, and a candidate whose clarity
matches the target is preferred:

  fvg        gap size vs the trailing median bar range: >= 1x -> 1,
             0.5-1x -> 2, below 0.5x -> 3
  equal_*    spread of the touches vs the tolerance: <= 1/3 -> 1,
             <= 2/3 -> 2, wider -> 3 (and 3+ touches count one easier)
  mss        how far the breaking body closed beyond the level vs the
             median bar range: >= 1x -> 1, 0.4-1x -> 2, below -> 3

Example:
  python3 scripts/pick_candidates.py data/clean/nq_nyam_ctx.5m.clean.json \\
      data/clean/nq_nyam_ctx.5m.candidates.json --rules fvg --count 6 --prefix real-fvg --first 1
"""

from __future__ import annotations

import argparse
import contextlib
import io
import random
import statistics
import sys
from datetime import date
from typing import Any, Dict, List, Optional

import build_scenario
from common import load_clean, load_json
from detect import session_median_range


def difficulty(cand: Dict[str, Any], candles: List[Dict[str, Any]], med: List[float], tol_pct: float) -> int:
    rule = cand["rule"]
    if rule == "fvg":
        r = (cand["levels"]["price_high"] - cand["levels"]["price_low"]) / med[cand["involved_indices"][0]]
        return 1 if r >= 1 else 2 if r >= 0.5 else 3
    if rule in ("equal_highs", "equal_lows"):
        touches = cand["touch_prices"]
        tol = touches[0] * tol_pct / 100
        spread = (max(touches) - min(touches)) / tol if tol else 0
        d = 1 if spread <= 1 / 3 else 2 if spread <= 2 / 3 else 3
        return max(1, d - 1) if len(touches) >= 3 else d
    if rule == "mss":
        i = cand["break_index"]
        r = abs(candles[i]["close"] - cand["levels"]["price"]) / med[i]
        return 1 if r >= 1 else 2 if r >= 0.4 else 3
    return 2


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("clean")
    ap.add_argument("candidates")
    ap.add_argument("--rules", required=True, help="comma-separated rules to draw from, e.g. equal_highs,equal_lows")
    ap.add_argument("--count", type=int, required=True)
    ap.add_argument("--prefix", required=True, help="exercise id prefix, e.g. real-fvg")
    ap.add_argument("--first", type=int, default=1, help="number of the first exercise id (default 1)")
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args(argv)

    data = load_clean(args.clean)
    candles = data["candles"]
    cands = load_json(args.candidates)
    params = cands["meta"].get("detection_params", {})
    med = session_median_range(candles, params.get("range_window", 100))
    rules = set(args.rules.split(","))
    pool = [c for c in cands["candidates"] if c["rule"] in rules and not c.get("context")]
    if not pool:
        print("ERROR: no candidates for those rules.")
        return 1

    day = lambda c: date.fromisoformat(c["anchor_timestamp"][:10])  # noqa: E731
    first, last = day(pool[0]), day(pool[-1])
    span = (last - first).days + 1
    rnd = random.Random(args.seed)
    built = 0
    for slot in range(args.count):
        lo = first.toordinal() + span * slot // args.count
        hi = first.toordinal() + span * (slot + 1) // args.count
        slice_ = [c for c in pool if lo <= day(c).toordinal() < hi]
        rnd.shuffle(slice_)
        target = slot % 3 + 1
        slice_.sort(key=lambda c: difficulty(c, candles, med, params.get("equal_tolerance_pct", 0.05)) != target)
        exercise_id = f"{args.prefix}-{args.first + built:03d}"
        for cand in slice_:
            d = difficulty(cand, candles, med, params.get("equal_tolerance_pct", 0.05))
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                rc = build_scenario.main([args.clean, args.candidates, "--candidate", cand["id"],
                                          "--exercise-id", exercise_id, "--difficulty", str(d)])
            if rc == 0:
                print(f"{exercise_id}: {cand['id']} (difficulty {d})")
                built += 1
                break
        else:
            print(f"slot {slot + 1}: no buildable candidate between {date.fromordinal(lo)} and {date.fromordinal(hi - 1)}")
    print(f"Built {built}/{args.count}.")
    return 0 if built == args.count else 1


if __name__ == "__main__":
    sys.exit(main())
