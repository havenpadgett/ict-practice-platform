#!/usr/bin/env python3
"""Generate a SYNTHETIC NQ-like 5m CSV for exercising the pipeline end to end.

This is random-walk test data, not market data - it exists only so ingest,
detect, and build_scenario can be run and checked without a data license.
Never promote a scenario built from it.

  python3 scripts/sample/make_synthetic.py -o scripts/sample/synthetic_nq_5m.csv
"""

from __future__ import annotations

import argparse
import csv
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from common import ET, is_market_closed  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-o", "--output", default=str(Path(__file__).with_name("synthetic_nq_5m.csv")))
    ap.add_argument("--start", default="2026-03-01T18:00", help="ET start (default Sunday 2026-03-01 18:00)")
    ap.add_argument("--days", type=int, default=10, help="calendar days to cover")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    t = datetime.fromisoformat(args.start).replace(tzinfo=ET)
    end = t + timedelta(days=args.days)
    price = 21000.0
    drift = 0.0
    rows = 0
    with open(args.output, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "open", "high", "low", "close", "volume"])
        while t < end:
            if not is_market_closed(t):
                if rng.random() < 0.02:
                    drift = rng.uniform(-3, 3)
                o = price
                c = round((o + drift + rng.gauss(0, 8)) * 4) / 4
                h = round((max(o, c) + abs(rng.gauss(0, 4))) * 4) / 4
                low = round((min(o, c) - abs(rng.gauss(0, 4))) * 4) / 4
                w.writerow([t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), o, h, low, c, rng.randint(200, 3000)])
                price = c
                rows += 1
            t += timedelta(minutes=5)
    print(f"Wrote {rows} SYNTHETIC bars to {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
