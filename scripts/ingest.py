#!/usr/bin/env python3
"""Ingest a CSV of OHLC bars, validate it, and write clean ET-timestamped JSON.

Input columns: timestamp, open, high, low, close, volume.
Timestamps may be ISO 8601 (with or without an offset) or Unix epoch seconds
or milliseconds; timestamps without an offset are read in --source-tz.

Validation (any error aborts without writing output):
  - every row parses; prices are positive; volume is non-negative
  - bar integrity: low <= open/close <= high
  - strictly increasing order: no duplicate or out-of-order timestamps
  - no gaps: every missing bar between two rows must fall inside a scheduled
    CME closure (daily 17:00-18:00 ET halt, Friday 17:00 to Sunday 18:00 ET)
    or on a date passed with --allow-gap-on (e.g. an exchange holiday)
  - sane price ranges: a single bar's range, and the jump from one close to
    the next open, stay under a percentage of price (jumps across a scheduled
    closure are reported as warnings instead)

Example:
  python3 scripts/ingest.py data/nq_5m.csv --source "Vendor X, NQ front month" \\
      --source-tz UTC -o data/nq_5m.clean.json
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import statistics
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from common import ET, ZoneInfo, format_et, is_market_closed, round_price, write_json

REQUIRED_COLUMNS = ["timestamp", "open", "high", "low", "close", "volume"]


def parse_timestamp(raw: str, source_tz) -> datetime:
    raw = raw.strip()
    if raw.replace(".", "", 1).isdigit():
        value = float(raw)
        if value > 1e11:  # milliseconds
            value /= 1000
        return datetime.fromtimestamp(value, tz=timezone.utc)
    iso = raw.replace("Z", "+00:00").replace(" ", "T", 1)
    dt = datetime.fromisoformat(iso)
    return dt.replace(tzinfo=source_tz) if dt.tzinfo is None else dt


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", help="input CSV (timestamp, open, high, low, close, volume)")
    ap.add_argument("--source", required=True, help="where the data came from (vendor, dataset, license) - recorded as provenance")
    ap.add_argument("--symbol", default="NQ")
    ap.add_argument("--source-tz", default="UTC", help="IANA timezone for timestamps without an offset (default UTC)")
    ap.add_argument("--timeframe", type=int, help="bar size in minutes (default: inferred from the most common spacing)")
    ap.add_argument("-o", "--output", help="output JSON (default: <csv stem>.clean.json next to the input)")
    ap.add_argument("--allow-gap-on", action="append", default=[], metavar="YYYY-MM-DD",
                    help="ET date on which missing bars are accepted (e.g. an exchange holiday); repeatable")
    ap.add_argument("--max-bar-range-pct", type=float, default=3.0, help="max single-bar high-low range as %% of close (default 3)")
    ap.add_argument("--max-jump-pct", type=float, default=2.0, help="max close-to-next-open jump as %% of price (default 2)")
    args = ap.parse_args(argv)

    source_tz = ZoneInfo(args.source_tz)
    allowed_gap_dates = {date.fromisoformat(d) for d in args.allow_gap_on}
    in_path = Path(args.csv)
    raw_bytes = in_path.read_bytes()

    errors: List[str] = []
    warnings: List[str] = []
    rows = []

    reader = csv.DictReader(raw_bytes.decode("utf-8-sig").splitlines())
    header = [h.strip().lower() for h in (reader.fieldnames or [])]
    missing = [c for c in REQUIRED_COLUMNS if c not in header]
    if missing:
        print(f"ERROR: missing column(s): {', '.join(missing)}. Found: {', '.join(header) or '(none)'}")
        return 1

    for line_no, raw in enumerate(reader, start=2):
        row = {k.strip().lower(): (v or "").strip() for k, v in raw.items() if k}
        try:
            dt = parse_timestamp(row["timestamp"], source_tz)
            o, h, l, c = (float(row[k]) for k in ("open", "high", "low", "close"))
            vol = float(row["volume"]) if row["volume"] else 0.0
        except (ValueError, KeyError) as exc:
            errors.append(f"line {line_no}: unparseable row ({exc})")
            continue
        if min(o, h, l, c) <= 0:
            errors.append(f"line {line_no}: non-positive price")
        if vol < 0:
            errors.append(f"line {line_no}: negative volume")
        if not (l <= min(o, c) and max(o, c) <= h):
            errors.append(f"line {line_no}: bar integrity (need low <= open/close <= high): o={o} h={h} l={l} c={c}")
        if c > 0 and (h - l) / c * 100 > args.max_bar_range_pct:
            errors.append(f"line {line_no}: bar range {h - l:g} is over {args.max_bar_range_pct}% of price")
        rows.append({"line": line_no, "dt": dt.astimezone(ET), "open": o, "high": h, "low": l, "close": c, "volume": vol})

    if not rows:
        print("ERROR: no rows parsed.")
        for e in errors[:20]:
            print(f"  {e}")
        return 1

    # Ordering and duplicates.
    counts = Counter(r["dt"] for r in rows)
    for dt, n in counts.items():
        if n > 1:
            errors.append(f"duplicate timestamp {format_et(dt)} ({n} rows)")
    for prev, cur in zip(rows, rows[1:]):
        if cur["dt"] < prev["dt"]:
            errors.append(f"line {cur['line']}: out of order ({format_et(cur['dt'])} after {format_et(prev['dt'])})")

    # Timeframe.
    diffs = [int((b["dt"] - a["dt"]).total_seconds() // 60) for a, b in zip(rows, rows[1:]) if b["dt"] > a["dt"]]
    if args.timeframe:
        tf = args.timeframe
    elif diffs:
        tf = Counter(diffs).most_common(1)[0][0]
    else:
        errors.append("cannot infer timeframe from a single bar; pass --timeframe")
        tf = 0

    # Gaps and jumps (only meaningful once order is sound).
    if tf and not any("out of order" in e for e in errors):
        step = timedelta(minutes=tf)
        for prev, cur in zip(rows, rows[1:]):
            if cur["dt"] <= prev["dt"]:
                continue
            expected = prev["dt"] + step
            missing_bars = []
            t = expected
            while t < cur["dt"]:
                if not is_market_closed(t) and t.date() not in allowed_gap_dates:
                    missing_bars.append(t)
                t += step
            if missing_bars:
                errors.append(
                    f"gap: {len(missing_bars)} missing bar(s) between {format_et(prev['dt'])} and {format_et(cur['dt'])}"
                    f" (first missing {format_et(missing_bars[0])})"
                )
            jump_pct = abs(cur["open"] - prev["close"]) / prev["close"] * 100
            if jump_pct > args.max_jump_pct:
                msg = f"jump of {jump_pct:.2f}% from close {prev['close']:g} ({format_et(prev['dt'])}) to open {cur['open']:g} ({format_et(cur['dt'])})"
                if cur["dt"] > expected:
                    warnings.append(msg + " across a closure")
                else:
                    errors.append(msg)
        misaligned = [r for r in rows if tf <= 60 and 60 % tf == 0 and r["dt"].minute % tf != 0]
        for r in misaligned[:5]:
            warnings.append(f"line {r['line']}: {format_et(r['dt'])} is not aligned to the {tf}m grid")

    print(f"Read {len(rows)} rows from {in_path} (timeframe {tf}m, source tz {args.source_tz}).")
    if errors:
        print(f"\nFAILED validation with {len(errors)} error(s) - no output written:")
        for e in errors[:50]:
            print(f"  - {e}")
        if len(errors) > 50:
            print(f"  ... and {len(errors) - 50} more")
        return 1

    candles = [
        {
            "timestamp": format_et(r["dt"]),
            "open": round_price(r["open"]),
            "high": round_price(r["high"]),
            "low": round_price(r["low"]),
            "close": round_price(r["close"]),
            "volume": r["volume"],
        }
        for r in rows
    ]
    out_path = Path(args.output) if args.output else in_path.with_suffix(".clean.json")
    meta = {
        "source": args.source,
        "symbol": args.symbol,
        "timeframe_minutes": tf,
        "timezone": "America/New_York",
        "source_timezone": args.source_tz,
        "input_file": in_path.name,
        "input_sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "start": candles[0]["timestamp"],
        "end": candles[-1]["timestamp"],
        "bar_count": len(candles),
        "median_bar_range": round_price(statistics.median(r["high"] - r["low"] for r in rows)),
        "allowed_gap_dates": sorted(d.isoformat() for d in allowed_gap_dates),
        "warnings": warnings,
        "ingested_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    write_json(out_path, {"meta": meta, "candles": candles})

    print(f"Validated: no errors, no unexplained gaps, {len(warnings)} warning(s).")
    for w in warnings[:20]:
        print(f"  ! {w}")
    print(f"Range: {meta['start']} -> {meta['end']} ({len(candles)} bars, ET)")
    print(f"Wrote {out_path}")
    print(f"Next: python3 scripts/detect.py {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
