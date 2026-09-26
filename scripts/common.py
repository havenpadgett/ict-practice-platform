"""Shared helpers for the scenario pipeline (ingest -> detect -> build_scenario).

Session rules follow docs/CURRICULUM.md (Liquidity - Time-Based Levels) and
mirror src/lib/time-context.ts on the app side:

- A CME trading day runs 18:00 ET to 17:00 ET the next calendar day, so a
  candle opening at/after 18:00 ET belongs to the next trading date.
- The market is closed 17:00-18:00 ET every weekday, and from Friday 17:00 ET
  to Sunday 18:00 ET.
- A trading week runs Sunday 18:00 ET to Friday 17:00 ET, keyed by the
  Monday of its trading dates.
- The NY AM session is 9:30-11:00 ET.
- Regular trading hours (RTH) are 9:30-16:00 ET, the NYSE cash session.
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any, Dict, List

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python < 3.9
    sys.exit("Python 3.9+ is required (zoneinfo). See scripts/requirements.txt.")

ET = ZoneInfo("America/New_York")

TRADING_DAY_START = time(18, 0)
DAILY_HALT_START = time(17, 0)
NY_AM_START = time(9, 30)
NY_AM_END = time(11, 0)
RTH_START = time(9, 30)
RTH_END = time(16, 0)

Candle = Dict[str, Any]


def parse_et(timestamp: str) -> datetime:
    """Parse a clean-data timestamp (ISO 8601 with offset) into an ET datetime."""
    return datetime.fromisoformat(timestamp).astimezone(ET)


def trading_date(dt: datetime) -> date:
    dt = dt.astimezone(ET)
    return dt.date() + timedelta(days=1) if dt.time() >= TRADING_DAY_START else dt.date()


def trading_week(dt: datetime) -> date:
    d = trading_date(dt)
    return d - timedelta(days=d.weekday())


def is_market_closed(dt: datetime) -> bool:
    """Whether a bar starting at `dt` falls in a scheduled CME closure (daily
    halt or weekend). Exchange holidays are not modeled - they surface as gaps
    for a human to confirm (ingest.py --allow-gap-on)."""
    dt = dt.astimezone(ET)
    wd, t = dt.weekday(), dt.time()  # Monday = 0
    if wd == 5:
        return True
    if wd == 4 and t >= DAILY_HALT_START:
        return True
    if wd == 6 and t < TRADING_DAY_START:
        return True
    return DAILY_HALT_START <= t < TRADING_DAY_START


def in_ny_am(dt: datetime) -> bool:
    t = dt.astimezone(ET).time()
    return NY_AM_START <= t < NY_AM_END


def in_rth(dt: datetime) -> bool:
    t = dt.astimezone(ET).time()
    return RTH_START <= t < RTH_END


def format_et(dt: datetime) -> str:
    return dt.astimezone(ET).isoformat(timespec="seconds")


CURRICULUM_VERSIONS = Path(__file__).resolve().parent.parent / "src" / "data" / "curriculum-versions.json"


def curriculum_versions(rule: str) -> Dict[str, int]:
    """Current version of every curriculum definition a rule's answer keys
    depend on (src/data/curriculum-versions.json) — recorded in each
    scenario's provenance so a later definition change flags it for
    re-review."""
    data = load_json(CURRICULUM_VERSIONS)
    ids = data["rules"].get(rule)
    if ids is None and rule.startswith(("previous_day_", "ny_am_", "weekly_")):
        ids = data["rules"]["time_levels"]
    if not ids:
        raise SystemExit(f"No curriculum definitions mapped for rule '{rule}' in {CURRICULUM_VERSIONS}.")
    return {i: data["definitions"][i]["version"] for i in ids}


def load_json(path: str | Path) -> Any:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write_json(path: str | Path, data: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def load_clean(path: str | Path) -> Dict[str, Any]:
    data = load_json(path)
    if not isinstance(data, dict) or "meta" not in data or "candles" not in data:
        sys.exit(f"{path}: not a clean data file from ingest.py (missing meta/candles).")
    for c in data["candles"]:
        c["_dt"] = parse_et(c["timestamp"])
    return data


def strip_private(candles: List[Candle]) -> List[Candle]:
    return [{k: v for k, v in c.items() if not k.startswith("_")} for c in candles]


def round_price(x: float) -> float:
    return round(float(x), 4)
