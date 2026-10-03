#!/usr/bin/env python3
"""Auto-approve real scenarios that are still waiting for a human.

For every src/data/real-scenarios/real-*.json that is not human-reviewed, not
flagged ambiguous and not already auto-approved: rewrite its explanations in
the house style (scripts/explanations.py) and mark it auto-approved
(reviewed_by "auto", human_reviewed false). Human-reviewed scenarios are never
touched.

A scenario built under an out-of-date curriculum definition (e.g. before the
MSS minimum-structure rule) is only approved if its answer key is re-derived
under today's detection code from the same source data and comes out the same;
it is then re-stamped with the current definition versions. If it doesn't
reproduce, its key no longer matches the rules: it is flagged ambiguous (never
live, kept on disk) and logged, as was done for the MSS scenarios that stopped
qualifying under v2.

Human-approved scenarios that went stale the same way get the same code
re-check and re-stamp. They stay human_reviewed with their reviewer; the
re-check is recorded in review_notes, because a person has not re-read them
under the new definition.

  python3 scripts/auto_approve.py [--dry-run]

Then regenerate the catalog: npm run catalog
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from datetime import date

from common import auto_approval, curriculum_versions, load_clean, load_json, trading_date, write_json
from build_scenario import DEFAULT_OUTPUT_DIR
from detect import MSS_MIN_SWING_MULT, group_indices, session_median_range
from explanations import apply_explanations, can_explain, trade_kind
from setups import find_setup

REVIEW_LOG = Path(__file__).resolve().parent.parent / "docs" / "review-log.json"
DATA = Path(__file__).resolve().parent.parent / "data" / "clean"
SOURCES = {("5m", "ny_am"): "nq_nyam_ctx.5m", ("15m", "rth"): "nq_rth_full.15m"}
_cache: Dict[str, Any] = {}


def _load(stem: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    if stem not in _cache:
        _cache[stem] = (load_clean(DATA / f"{stem}.clean.json"), load_json(DATA / f"{stem}.candidates.json"))
    return _cache[stem]


def _close(a: float, b: float) -> bool:
    return abs(a - b) <= 0.011


def reverify(ex: Dict[str, Any]) -> Tuple[bool, str]:
    """Re-derive the answer key from the source data with today's detection
    code. True only if the same key comes back."""
    p = ex["provenance"]
    stem = SOURCES.get((p["timeframe"], p["session"]))
    if stem is None or not (DATA / f"{stem}.clean.json").exists():
        return False, "source data for re-derivation is not on disk"
    clean, cands = _load(stem)
    if clean["meta"].get("input_sha256") != p["input_sha256"]:
        return False, "source data on disk is not the file this scenario was built from"
    rule, a = p["detection_rule"], ex["answer"]
    if rule in ("guided_setup", "free_trade_setup"):
        params = {**p["detection_params"], "mss_min_swing_mult": MSS_MIN_SWING_MULT}
        candles = clean["candles"]
        med = session_median_range(candles, params.get("range_window", 100))
        for idxs in group_indices(candles, trading_date).values():
            o = idxs[0]
            day = candles[o:idxs[-1] + 1]
            n_ctx = next((k for k, c in enumerate(day) if not c.get("context")), len(day))
            if n_ctx < len(day) and trading_date(day[n_ctx]["_dt"]).isoformat() == p["trading_date"]:
                s = find_setup(day, n_ctx, med[o:o + len(day)], params)
                break
        else:
            return False, "trading date not found in the source data"
        if s["kind"] != trade_kind(p["candidate_id"]):
            return False, f"now classified {s['kind']}, was {trade_kind(p['candidate_id'])}"
        if s["kind"] in ("valid", "low_rr"):
            if ex["answer_type"] == "guided":
                ok = _close(a["entry"]["anchor"], s["entry"]) and _close(a["target"]["anchor"], s["target"])
            else:
                ok = _close(a["entry_zone"]["price_low"], s["zone"]["low"]) and _close(a["target"]["anchor"], s["target"])
            if not ok:
                return False, "entry or target levels differ under the current rules"
        return True, f"setup re-classified {s['kind']}" + (" with the same levels" if s["kind"] in ("valid", "low_rr") else "")
    cp = cands["meta"].get("detection_params", {})
    for k, v in p["detection_params"].items():
        if k not in ("rules", "mss_min_swing_mult") and cp.get(k) != v:
            return False, f"detection parameter {k} differs from the current candidates run"
    if cp.get("mss_min_swing_mult") != MSS_MIN_SWING_MULT:
        return False, "candidates file was not produced under the current MSS rule"
    found = next((c for c in cands["candidates"] if c["id"] == p["candidate_id"]), None)
    if found is None:
        return False, "candidate no longer produced by the current rules"
    lv = found["levels"]
    if ex["answer_type"] == "level":
        ok = _close(a["price"], lv["price"]) and a.get("type") in (found["direction"], "ny_am_high", "ny_am_low", "buy_side", "sell_side")
    elif ex["answer_type"] == "zone":
        ok = _close(a["price_low"], lv["price_low"]) and _close(a["price_high"], lv["price_high"]) and a["type"] == found["direction"]
    else:
        ok = True
    return (True, "candidate re-detected with the same levels") if ok else (False, "levels differ under the current rules")


def flag_not_reproduced(path: Path, ex: Dict[str, Any], why: str, log: List[Dict[str, Any]], dry_run: bool) -> None:
    p = ex["provenance"]
    note = (f"Auto-flagged {date.today().isoformat()}: re-derived from source data under the current detection rules "
            f"(curriculum definitions changed since it was built) and the answer key no longer reproduces - {why}. "
            f"Kept on disk, never live.")
    p["review_status"] = "ambiguous"
    p["review_notes"] = note
    log.append({"date": date.today().isoformat(), "exercise_id": ex["exercise_id"], "candidate_id": p["candidate_id"],
                "rule": p["detection_rule"], "decision": "ambiguous", "reason": None,
                "reviewer": "system (re-verification)", "note": note})
    if not dry_run:
        write_json(path, ex)


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    done, skipped, restamped = [], [], []
    log = load_json(REVIEW_LOG)
    for path in sorted(DEFAULT_OUTPUT_DIR.glob("real-*.json")):
        ex = load_json(path)
        p = ex["provenance"]
        if p.get("review_status") == "ambiguous" or p.get("auto_approved"):
            continue
        rule = p["detection_rule"]
        if p.get("human_reviewed"):
            if p.get("curriculum_versions") != curriculum_versions(rule):
                ok, why = reverify(ex)
                if not ok:
                    skipped.append((ex["exercise_id"], f"human-approved but stale and did not re-verify: {why}"))
                    flag_not_reproduced(path, ex, why, log, args.dry_run)
                    continue
                old = p.get("curriculum_versions") or {}
                changed = ", ".join(f"{k} v{old.get(k, 0)}->v{v}" for k, v in curriculum_versions(rule).items() if old.get(k) != v)
                note = (f"Re-derived from source data under current detection rules ({changed}): {why}. "
                        f"Checked by code, not re-read by a person.")
                p["review_notes"] = f"{p['review_notes']} {note}" if p.get("review_notes") else note
                p["curriculum_versions"] = curriculum_versions(rule)
                if not args.dry_run:
                    write_json(path, ex)
                restamped.append(ex["exercise_id"])
            continue
        if not can_explain(rule):
            skipped.append((ex["exercise_id"], f"no explanation template for {rule}"))
            continue
        note = None
        if p.get("curriculum_versions") != curriculum_versions(rule):
            ok, why = reverify(ex)
            if not ok:
                skipped.append((ex["exercise_id"], f"built under an out-of-date definition and did not re-verify: {why}"))
                flag_not_reproduced(path, ex, why, log, args.dry_run)
                continue
            old = p.get("curriculum_versions") or {}
            changed = ", ".join(f"{k} v{old.get(k, 0)}->v{v}" for k, v in curriculum_versions(rule).items() if old.get(k) != v)
            note = f"Re-derived from source data under current detection rules ({changed}): {why}."
            p["curriculum_versions"] = curriculum_versions(rule)
        apply_explanations(ex)
        p.update(auto_approval())
        p["review_notes"] = note
        if not args.dry_run:
            write_json(path, ex)
        done.append(ex["exercise_id"])

    if not args.dry_run and skipped:
        write_json(REVIEW_LOG, log)
    print(f"{'Would auto-approve' if args.dry_run else 'Auto-approved'} {len(done)} scenario(s).")
    print(f"{'Would re-stamp' if args.dry_run else 'Re-stamped'} {len(restamped)} stale human-approved scenario(s).")
    for sid, why in skipped:
        print(f"Not approved {sid}: {why}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
