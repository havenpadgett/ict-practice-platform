#!/usr/bin/env python3
"""Synthetic attempts with *known* effects, to check analyze.py finds what's
there and stays quiet when there's too little data. Not real users.

Planted effects (large fixture): accuracy rises with practice; MSS is
harder than FVG; real scenarios are ~15 points harder than constructed
within a concept; slower answers are slightly less often correct; one
exercise (liq-004) has a broken answer key (almost always failed).

  analysis/.venv/bin/python analysis/make_fixture.py --users 12 --out analysis/fixtures/synthetic_large.csv
  analysis/.venv/bin/python analysis/make_fixture.py --users 1 --attempts 40 --out analysis/fixtures/synthetic_small.csv
"""

import argparse
import csv
import json
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

CATALOG = Path(__file__).resolve().parent.parent / "src" / "data" / "exercise-catalog.json"
BASE = {"FVG": 0.75, "Liquidity": 0.7, "MSS": 0.55, "IFVG": 0.6, "OrderBlock": 0.62, "PremiumDiscount": 0.8, "TimeLiquidity": 0.72}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--users", type=int, default=12)
    ap.add_argument("--attempts", type=int, default=0, help="attempts per user (default: 40-160, varied)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--seed", type=int, default=3)
    a = ap.parse_args()
    rnd = random.Random(a.seed)
    cat = [e for e in json.load(open(CATALOG)) if e["concept"] in BASE]
    rows = []
    start = datetime(2026, 9, 1, tzinfo=timezone.utc)
    for u in range(a.users):
        uid = f"00000000-0000-0000-0000-{u:012d}"
        skill = rnd.gauss(0, 0.4)
        n = a.attempts or rnd.randint(40, 160)
        t = start + timedelta(hours=rnd.randint(0, 48))
        session = 0
        for i in range(n):
            if i % 10 == 0:
                session += 1
                t += timedelta(hours=rnd.uniform(8, 40))
            e = rnd.choice(cat)
            p = BASE[e["concept"]] - 0.06 * (e["difficulty"] - 2)
            p += 0.25 * (1 - math.exp(-i / 60)) - 0.1  # learning
            if e["real"]:
                p -= 0.15
            if e["exercise_id"] == "liq-004":
                p = 0.08  # broken answer key
            logit = math.log(max(min(p, 0.97), 0.03) / (1 - max(min(p, 0.97), 0.03))) + skill
            rt = math.exp(rnd.gauss(math.log(14), 0.5))
            logit -= 0.35 * (math.log(rt) - math.log(14))
            correct = rnd.random() < 1 / (1 + math.exp(-logit))
            t += timedelta(seconds=rt + 5)
            rows.append({
                "attempt_id": f"{uid}-{i}", "user_id": uid, "session_id": f"s-{u}-{session}",
                "attempted_at_utc": t.isoformat(), "exercise_id": e["exercise_id"], "concept": e["concept"],
                "mode": "recognition", "answer_type": e["answer_type"], "difficulty": e["difficulty"],
                "data_source": "real" if e["real"] else "constructed", "is_correct": int(correct),
                "response_time_ms": int(rt * 1000), "attempt_number": 1,
            })
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    with open(a.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} synthetic attempts ({a.users} users) to {a.out}")


if __name__ == "__main__":
    main()
