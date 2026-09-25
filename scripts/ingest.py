#!/usr/bin/env python3
"""Ingest a CSV of OHLC bars, validate it, and write clean ET-timestamped JSON.

Input columns: timestamp, open, high, low, close, volume. A column named
"timestamp ET" is accepted as the timestamp (and implies --source-tz
America/New_York); any other extra columns (e.g. VWAP) are ignored.
Timestamps may be ISO 8601 (with or without an offset), M/D/YYYY HH:MM[:SS],
or Unix epoch seconds or milliseconds; timestamps without an offset are read
in --source-tz. If the vendor stamps each bar with its CLOSE time (a 1m bar
covering 9:30-9:31 labelled 9:31), pass --timestamp-label close and every bar
is shifted back to its open time - the convention everything downstream uses.

Validation (any error aborts without writing output):
  - every row parses; prices are positive; volume is non-negative
  - bar integrity: low <= open/close <= high
  - strictly increasing order: no duplicate or out-of-order timestamps
  - no local times that don't exist or are ambiguous (DST changes)
  - no bars inside a scheduled CME closure (usually means the timestamp
    label convention is wrong - see --timestamp-label)
  - no gaps: every missing bar between two selected rows must fall inside a
    scheduled CME closure (daily 17:00-18:00 ET halt, Friday 17:00 to Sunday
    18:00 ET) or on a date passed with --allow-gap-on (e.g. an exchange holiday)
  - no truncation: a selection may not include a trading day the file starts
    or ends in the middle of (the file edge doesn't sit at a closure)
  - sane price ranges: a single bar's range, and the jump from one close to
    the next open, stay under a percentage of price (jumps across a scheduled
    closure are reported as warnings instead)

Integrity checks (parsing, prices, OHLC, order, duplicates, closures) cover
the whole file; gap, range and jump checks cover only the selection
(--start/--end/--session), so a clean slice can be taken from a file with
known problems elsewhere. --check-only validates without writing.
--calendar reads allow/exclude dates from a file (scripts/calendars/).

Aggregation (--resample 5,15): source bars are grouped into buckets anchored
at the start of their session (trading day 18:00 ET, or 9:30 ET with
--session ny_am or rth), so no bucket ever spans a session boundary. Each
timeframe is written next to the main output as <stem>.<N>m.clean.json.

Example:
  python3 scripts/ingest.py data/raw/Dataset_NQ_1min_2022_2025.csv \\
      --source "Vendor X, NQ continuous 1m" --timestamp-label close \\
      --start 2025-11-10 --end 2025-11-21 --session ny_am --resample 5,15 \\
      -o data/clean/nq_nyam_2025-11-10.clean.json
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import re
import statistics
import sys
from collections import Counter, OrderedDict
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional

from common import (DAILY_HALT_START, ET, NY_AM_END, NY_AM_START, RTH_END, RTH_START, TRADING_DAY_START, ZoneInfo,
                    format_et, in_ny_am, in_rth, is_market_closed, round_price, trading_date, write_json)

REQUIRED_COLUMNS = ["timestamp", "open", "high", "low", "close", "volume"]
COLUMN_ALIASES = {"timestamp et": "timestamp"}
EXCEL_MAX_DATA_ROWS = 1_048_575  # 1,048,576 sheet rows minus the header
SESSIONS = {"all": None, "ny_am": (NY_AM_START, NY_AM_END), "rth": (RTH_START, RTH_END)}
SESSION_FILTERS = {"ny_am": in_ny_am, "rth": in_rth}
US_DATE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$")


def parse_timestamp(raw: str, source_tz) -> datetime:
    raw = raw.strip()
    if raw.replace(".", "", 1).isdigit():
        value = float(raw)
        if value > 1e11:  # milliseconds
            value /= 1000
        return datetime.fromtimestamp(value, tz=timezone.utc)
    m = US_DATE.match(raw)
    if m:
        mo, d, y, hh, mm, ss = m.groups()
        dt = datetime(int(y), int(mo), int(d), int(hh), int(mm), int(ss or 0))
    else:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00").replace(" ", "T", 1))
    if dt.tzinfo is not None:
        return dt
    local = dt.replace(tzinfo=source_tz)
    if local.astimezone(timezone.utc).astimezone(source_tz).replace(tzinfo=None) != dt:
        raise ValueError(f"{raw} does not exist in {source_tz} (DST change)")
    if local.utcoffset() != local.replace(fold=1).utcoffset():
        raise ValueError(f"{raw} is ambiguous in {source_tz} (DST change)")
    return local


def session_bounds(d: date, session: str, context_start: Optional[time] = None) -> "tuple[datetime, datetime]":
    """[start, end) of a trading date's session, in UTC - starting at
    context_start instead when structure context bars are kept."""
    if SESSIONS[session]:
        start, end = (datetime.combine(d, t, tzinfo=ET) for t in SESSIONS[session])
        if context_start:
            start = datetime.combine(d, context_start, tzinfo=ET)
    else:
        start = datetime.combine(d - timedelta(days=1), TRADING_DAY_START, tzinfo=ET)
        end = datetime.combine(d, DAILY_HALT_START, tzinfo=ET)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def session_start(dt: datetime, session: str, context_start: Optional[time] = None) -> datetime:
    """Start of the session a bar belongs to, in UTC."""
    return session_bounds(trading_date(dt), session, context_start)[0]


def resample(rows: List[dict], src_tf: int, tf: int, session: str,
             context_start: Optional[time] = None) -> "tuple[List[dict], List[str]]":
    """Aggregate bars into tf-minute buckets anchored at each session's start
    (its context start, if any). Context and session bars never share a
    bucket as long as the session start sits on the tf grid."""
    step = timedelta(minutes=tf)
    buckets: "OrderedDict[datetime, List[dict]]" = OrderedDict()
    for r in rows:
        start = session_start(r["dt"], session, context_start)
        key = start + ((r["dt"] - start) // step) * step
        buckets.setdefault(key, []).append(r)
    out, partial = [], []
    for key, group in buckets.items():
        # One bucket per session, by construction; this guards the invariant.
        assert len({session_start(r["dt"], session, context_start) for r in group}) == 1, f"bucket {format_et(key)} spans sessions"
        assert len({r.get("context", False) for r in group}) == 1, f"bucket {format_et(key)} mixes context and session bars"
        if len(group) < tf // src_tf:
            partial.append(f"{format_et(key)} ({len(group)}/{tf // src_tf} source bars)")
        out.append({"dt": key, "open": group[0]["open"], "high": max(r["high"] for r in group),
                    "low": min(r["low"] for r in group), "close": group[-1]["close"],
                    "volume": sum(r["volume"] for r in group), "context": group[0].get("context", False)})
    return out, partial


def to_candles(rows: List[dict]) -> List[dict]:
    return [
        {
            "timestamp": format_et(r["dt"]),
            "open": round_price(r["open"]),
            "high": round_price(r["high"]),
            "low": round_price(r["low"]),
            "close": round_price(r["close"]),
            "volume": r["volume"],
            **({"context": True} if r.get("context") else {}),
        }
        for r in rows
    ]


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", help="input CSV (timestamp, open, high, low, close, volume)")
    ap.add_argument("--source", required=True, help="where the data came from (vendor, dataset, license) - recorded as provenance")
    ap.add_argument("--symbol", default="NQ")
    ap.add_argument("--source-tz", help="IANA timezone for timestamps without an offset (default UTC, or America/New_York for a 'timestamp ET' column)")
    ap.add_argument("--timestamp-label", choices=["open", "close"], default="open",
                    help="whether the vendor stamps each bar with its open or its close time (default open)")
    ap.add_argument("--timeframe", type=int, help="bar size in minutes (default: inferred from the most common spacing)")
    ap.add_argument("--start", metavar="YYYY-MM-DD", help="first trading date to keep (trading day = 18:00 ET to 17:00 ET)")
    ap.add_argument("--end", metavar="YYYY-MM-DD", help="last trading date to keep")
    ap.add_argument("--session", choices=list(SESSIONS), default="all",
                    help="keep only bars in this session: all, ny_am (9:30-11:00 ET) or rth (9:30-16:00 ET) (default all)")
    ap.add_argument("--context-start", metavar="HH:MM",
                    help="with --session ny_am/rth: also keep bars from this ET time up to the session start, "
                         "flagged context: true (structure context for MSS - see docs/CURRICULUM.md)")
    ap.add_argument("--resample", metavar="N[,N...]", help="also write N-minute aggregates, e.g. 5,15")
    ap.add_argument("--check-only", action="store_true", help="validate and report; write nothing")
    ap.add_argument("-o", "--output", help="output JSON (default: <csv stem>.clean.json next to the input)")
    ap.add_argument("--allow-gap-on", action="append", default=[], metavar="YYYY-MM-DD",
                    help="ET date on which missing bars are accepted (e.g. an exchange holiday); repeatable")
    ap.add_argument("--exclude-date", action="append", default=[], metavar="YYYY-MM-DD",
                    help="trading date to drop from the selection entirely (e.g. a known data hole); repeatable")
    ap.add_argument("--calendar", metavar="FILE",
                    help="file of 'YYYY-MM-DD allow|exclude  # reason' lines, same as --allow-gap-on / --exclude-date")
    ap.add_argument("--max-bar-range-pct", type=float, default=3.0, help="max single-bar high-low range as %% of close (default 3)")
    ap.add_argument("--max-jump-pct", type=float, default=2.0, help="max close-to-next-open jump as %% of price (default 2)")
    args = ap.parse_args(argv)

    allowed_gap_dates = {date.fromisoformat(d) for d in args.allow_gap_on}
    excluded_dates = {date.fromisoformat(d) for d in args.exclude_date}
    if args.calendar:
        for n, line in enumerate(Path(args.calendar).read_text().splitlines(), start=1):
            fields = line.split("#", 1)[0].split()
            if not fields:
                continue
            if len(fields) != 2 or fields[1] not in ("allow", "exclude"):
                print(f"ERROR: {args.calendar}:{n}: expected 'YYYY-MM-DD allow|exclude', got {line.strip()!r}")
                return 1
            (allowed_gap_dates if fields[1] == "allow" else excluded_dates).add(date.fromisoformat(fields[0]))
    start_date = date.fromisoformat(args.start) if args.start else None
    end_date = date.fromisoformat(args.end) if args.end else None
    context_start = time.fromisoformat(args.context_start) if args.context_start else None
    if context_start and (not SESSIONS[args.session] or context_start >= SESSIONS[args.session][0]):
        print("ERROR: --context-start needs --session ny_am or rth and a time before the session opens.")
        return 1
    resample_tfs = sorted({int(x) for x in args.resample.split(",")}) if args.resample else []
    in_path = Path(args.csv)
    raw_bytes = in_path.read_bytes()

    errors: List[str] = []
    warnings: List[str] = []
    rows = []

    reader = csv.DictReader(raw_bytes.decode("utf-8-sig").splitlines())
    raw_header = [h.strip().lower() for h in (reader.fieldnames or [])]
    header = [COLUMN_ALIASES.get(h, h) for h in raw_header]
    missing = [c for c in REQUIRED_COLUMNS if c not in header]
    if missing:
        print(f"ERROR: missing column(s): {', '.join(missing)}. Found: {', '.join(raw_header) or '(none)'}")
        return 1
    source_tz_name = args.source_tz or ("America/New_York" if "timestamp et" in raw_header else "UTC")
    source_tz = ZoneInfo(source_tz_name)

    for line_no, raw in enumerate(reader, start=2):
        row = {COLUMN_ALIASES.get(k.strip().lower(), k.strip().lower()): (v or "").strip() for k, v in raw.items() if k}
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
        # Compare and step in UTC: aware datetimes sharing a zone compare by wall time.
        rows.append({"line": line_no, "dt": dt.astimezone(timezone.utc), "open": o, "high": h, "low": l, "close": c, "volume": vol})

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
    for n in resample_tfs:
        if not tf or n <= tf or n % tf or 60 % n:
            errors.append(f"cannot resample {tf}m bars to {n}m (needs a multiple of {tf} that divides 60)")

    step = timedelta(minutes=tf)
    if tf and args.timestamp_label == "close":
        for r in rows:
            r["dt"] -= step

    # Bars inside a scheduled closure: the vendor's label convention is off,
    # or the data includes prints the exchange didn't have.
    closed = [r for r in rows if is_market_closed(r["dt"])]
    if closed:
        hours = Counter(r["dt"].astimezone(ET).strftime("%H:%M") for r in closed).most_common(3)
        hint = " - check --timestamp-label" if len(closed) > len(rows) // 5000 else ""
        errors.append(f"{len(closed)} bar(s) start inside a scheduled closure (most common ET times: "
                      f"{', '.join(f'{t} x{n}' for t, n in hours)}){hint}")
        for r in closed[:5]:
            errors.append(f"  line {r['line']}: bar at {format_et(r['dt'])}")

    # Truncation: a file edge that isn't at a closure cut a session short.
    incomplete_days = set()
    if tf:
        first, last = rows[0]["dt"], rows[-1]["dt"]
        if not is_market_closed(last + step):
            incomplete_days.add(trading_date(last))
            note = f" and has exactly {EXCEL_MAX_DATA_ROWS:,} data rows (Excel's sheet limit)" if len(rows) == EXCEL_MAX_DATA_ROWS else ""
            warnings.append(f"file ends mid-session at {format_et(last)}{note}: trading day "
                            f"{trading_date(last).isoformat()} is incomplete - likely truncated")
        if not is_market_closed(first - step):
            incomplete_days.add(trading_date(first))
            warnings.append(f"file starts mid-session at {format_et(first)}: trading day {trading_date(first).isoformat()} is incomplete")
        if len(rows) == EXCEL_MAX_DATA_ROWS and not incomplete_days:
            warnings.append(f"file has exactly {EXCEL_MAX_DATA_ROWS:,} data rows (Excel's sheet limit) - confirm it wasn't cut off")

    # Selection.
    def is_context(dt: datetime) -> bool:
        return bool(context_start) and dt.astimezone(ET).weekday() < 5 and \
            context_start <= dt.astimezone(ET).time() < SESSIONS[args.session][0]

    def selected(dt: datetime) -> bool:
        d = trading_date(dt)
        if (start_date and d < start_date) or (end_date and d > end_date) or d in excluded_dates:
            return False
        in_session = SESSION_FILTERS.get(args.session)
        return in_session is None or (dt.astimezone(ET).weekday() < 5 and in_session(dt)) or is_context(dt)

    total_rows = len(rows)
    rows = [r for r in rows if selected(r["dt"])]
    for r in rows:
        if is_context(r["dt"]):
            r["context"] = True
    if not rows:
        errors.append("selection (--start/--end/--session) matched no bars")
    for d in sorted(incomplete_days & {trading_date(r["dt"]) for r in rows}):
        errors.append(f"selection includes trading day {d.isoformat()}, which the file cuts off mid-session - move --start/--end")

    for r in rows:
        if r["close"] > 0 and (r["high"] - r["low"]) / r["close"] * 100 > args.max_bar_range_pct:
            errors.append(f"line {r['line']}: bar range {r['high'] - r['low']:g} is over {args.max_bar_range_pct}% of price")

    # Gaps and jumps within the selection (only meaningful once order is sound).
    gap_count = gap_bars = 0
    if tf and not any("out of order" in e for e in errors):
        # Sentinels at the selection's edges also catch sessions missing (or
        # cut short) at the start or end of the selection.
        edges = []
        if rows:
            first_day = start_date or trading_date(rows[0]["dt"])
            last_day = end_date or trading_date(rows[-1]["dt"])
            edges = [{"dt": session_bounds(first_day, args.session, context_start)[0] - step},
                     {"dt": session_bounds(last_day, args.session, context_start)[1]}]
        seq = edges[:1] + rows + edges[1:]
        for prev, cur in zip(seq, seq[1:]):
            if cur["dt"] <= prev["dt"]:
                continue
            expected = prev["dt"] + step
            missing_bars = []
            t = expected
            while t < cur["dt"]:
                if not is_market_closed(t) and selected(t) and t.astimezone(ET).date() not in allowed_gap_dates:
                    missing_bars.append(t)
                t += step
            if missing_bars:
                gap_count += 1
                gap_bars += len(missing_bars)
                errors.append(
                    f"gap: {len(missing_bars)} missing bar(s) between {format_et(prev['dt'])} and {format_et(cur['dt'])}"
                    f" (first missing {format_et(missing_bars[0])})"
                )
            if "close" not in prev or "open" not in cur:
                continue
            jump_pct = abs(cur["open"] - prev["close"]) / prev["close"] * 100
            if jump_pct > args.max_jump_pct:
                msg = f"jump of {jump_pct:.2f}% from close {prev['close']:g} ({format_et(prev['dt'])}) to open {cur['open']:g} ({format_et(cur['dt'])})"
                if cur["dt"] > expected:
                    warnings.append(msg + " across a closure")
                else:
                    errors.append(msg)
        misaligned = [r for r in rows if tf <= 60 and 60 % tf == 0 and r["dt"].astimezone(ET).minute % tf != 0]
        for r in misaligned[:5]:
            warnings.append(f"line {r['line']}: {format_et(r['dt'])} is not aligned to the {tf}m grid")

    selection = f"trading days {args.start or 'first'}..{args.end or 'last'}, session {args.session}"
    print(f"Read {total_rows} rows from {in_path} (timeframe {tf}m, source tz {source_tz_name}, "
          f"stamped at bar {args.timestamp_label}); {len(rows)} selected ({selection}).")
    if gap_count:
        print(f"Gaps: {gap_count} gap(s), {gap_bars} missing bar(s) in total.")
    if errors:
        print(f"\nFAILED validation with {len(errors)} error(s) - no output written:")
        for e in errors[:50]:
            print(f"  - {e}")
        if len(errors) > 50:
            print(f"  ... and {len(errors) - 50} more")
        for w in warnings[:20]:
            print(f"  ! {w}")
        return 1

    print(f"Validated: no errors, no unexplained gaps, {len(warnings)} warning(s).")
    for w in warnings[:20]:
        print(f"  ! {w}")
    if args.check_only:
        return 0

    out_path = Path(args.output) if args.output else in_path.with_suffix(".clean.json")
    meta_base = {
        "source": args.source,
        "symbol": args.symbol,
        "timezone": "America/New_York",
        "source_timezone": source_tz_name,
        "source_timestamp_label": args.timestamp_label,
        "input_file": in_path.name,
        "input_sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "selection": {"start": args.start, "end": args.end, "session": args.session, "context_start": args.context_start},
        "allowed_gap_dates": sorted(d.isoformat() for d in allowed_gap_dates),
        "excluded_dates": sorted(d.isoformat() for d in excluded_dates),
        "calendar_file": Path(args.calendar).name if args.calendar else None,
        "ingested_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    outputs = [(tf, out_path, rows, [])]
    for n in resample_tfs:
        agg, partial = resample(rows, tf, n, args.session, context_start)
        stem = out_path.name[: -len(".clean.json")] if out_path.name.endswith(".clean.json") else out_path.stem
        outputs.append((n, out_path.with_name(f"{stem}.{n}m.clean.json"), agg, partial))

    for n, path, bars, partial in outputs:
        candles = to_candles(bars)
        extra: Dict[str, object] = {"aggregated_from_minutes": tf} if n != tf else {}
        file_warnings = warnings + [f"partial bucket {p}" for p in partial]
        meta = {**meta_base, "timeframe_minutes": n, **extra,
                "start": candles[0]["timestamp"], "end": candles[-1]["timestamp"], "bar_count": len(candles),
                "median_bar_range": round_price(statistics.median(r["high"] - r["low"] for r in bars)),
                "warnings": file_warnings}
        write_json(path, {"meta": meta, "candles": candles})
        print(f"Wrote {path} ({n}m, {len(candles)} bars, {meta['start']} -> {meta['end']} ET"
              + (f", {len(partial)} partial bucket(s)" if partial else "") + ")")
    print(f"Next: python3 scripts/detect.py {outputs[-1][1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
