"""Learner-facing explanation text for real scenarios, in the house style.

The style is the one the human-reviewed scenarios share (docs/CURRICULUM.md,
"Explanation style guide"). Keep this file and that guide in step.

`explain(exercise, facts)` takes a scenario in the app's JSON shape and
returns the text fields to write into it:
  - zone / level / choice scenarios: {"explanation": str}
  - guided scenarios: {"step_explanations": {...}, "overall_explanation": str}
  - free-trade scenarios: {"explanation": str}
`facts` carries what the answer key doesn't (e.g. how many highs make up an
equal-highs pool); the build scripts pass it, and `facts_from_scenario()`
recovers it from a stored scenario.
"""

from __future__ import annotations

import re
import zlib
from typing import Any, Dict, Optional

SYNONYMS = {"fast": ["quickly", "sharply", "aggressively"]}
COUNT_WORDS = {2: "Two", 3: "Three", 4: "Four"}


def _pick(key: str, options: list) -> Any:
    return options[zlib.crc32(key.encode()) % len(options)]


def trade_kind(candidate_id: str) -> str:
    m = re.match(r"setup-([a-z_]+)-", candidate_id)
    if not m:
        raise ValueError(f"not a trade candidate id: {candidate_id}")
    return m.group(1)


def facts_from_scenario(ex: Dict[str, Any]) -> Dict[str, Any]:
    p = ex["provenance"]
    notes = p.get("detection_notes", "")
    facts: Dict[str, Any] = {"notes": notes}
    rule = p["detection_rule"]
    if rule in ("guided_setup", "free_trade_setup"):
        facts["kind"] = trade_kind(p["candidate_id"])
        a = ex["answer"]
        if rule == "guided_setup":
            bias = a.get("bias")
            direction = bias if bias in ("bullish", "bearish") else None
        else:
            direction = {"long": "bullish", "short": "bearish"}.get(a.get("intended_bias"))
        if direction is None:
            # no_sweep has no bias; the notes say which swing was left untaken
            # ("the setup high ... did not take the previous swing high").
            m = re.search(r"setup (high|low)", notes)
            if m:
                direction = "bearish" if m.group(1) == "high" else "bullish"
        facts["direction"] = direction
        m = re.search(r"R:R (?:from the entry is )?(\d+(?:\.\d+)?)", notes)
        if m:
            facts["rr"] = float(m.group(1))
    return facts


def _fvg(ex: Dict[str, Any], facts: Dict[str, Any]) -> Dict[str, str]:
    d = ex["answer"]["type"]
    move = "moved up" if d == "bullish" else "moved down"
    adverb = _pick(ex["exercise_id"], SYNONYMS["fast"])
    return {"explanation": f"This is a {d} Fair Value Gap. Price {move} {adverb} and left an imbalance in the highlighted area."}


def _ifvg(ex: Dict[str, Any], facts: Dict[str, Any]) -> Dict[str, str]:
    d = ex["answer"]["type"]
    side, role = ("above", "support") if d == "bearish" else ("below", "resistance")
    return {
        "explanation": (
            f"This is an Inverse Fair Value Gap. A {d} Fair Value Gap formed here, but a later candle closed {side} it "
            f"instead of respecting it. The gap has flipped and now acts as {role} in the highlighted area."
        )
    }


def _order_block(ex: Dict[str, Any], facts: Dict[str, Any]) -> Dict[str, str]:
    d = ex["answer"]["type"]
    bull = d == "bullish"
    text = (
        f"This is a {d} Order Block. It is the last {'down' if bull else 'up'}-close candle before price moved sharply "
        f"{'up' if bull else 'down'} and broke structure, marking where orders were placed in the highlighted area."
    )
    if "mitigated" in facts.get("notes", ""):
        text += " Price later returned to the block and reacted from it."
    return {"explanation": text}


def _liquidity(ex: Dict[str, Any], facts: Dict[str, Any]) -> Dict[str, str]:
    buy = ex["answer"]["type"] == "buy_side"
    n = facts.get("touches")
    count = COUNT_WORDS.get(n, "Multiple")
    return {
        "explanation": (
            f"This is {'Buy' if buy else 'Sell'}-Side Liquidity. {count} {'highs' if buy else 'lows'} formed around the same "
            f"level, creating a pool of liquidity resting {'above' if buy else 'below'} them at the highlighted level."
        )
    }


def _mss(ex: Dict[str, Any], facts: Dict[str, Any]) -> Dict[str, str]:
    d = ex["answer"]["type"]
    bear = d == "bearish"
    return {
        "explanation": (
            f"This is a {d} Market Structure Shift. Price was trending {'upward' if bear else 'downward'}, then broke and "
            f"closed {'below the previous higher low' if bear else 'above the previous lower high'}, confirming a shift to "
            f"{d} structure at the highlighted level."
        )
    }


def _dealing_range(ex: Dict[str, Any], facts: Dict[str, Any]) -> Dict[str, str]:
    c = ex["answer"]["correct_choice"]
    if c == "equilibrium":
        text = (
            "Price is at equilibrium. The last candle closed close to the midpoint of the dealing range, so neither "
            "premium nor discount has an edge from location alone."
        )
    else:
        prem = c == "premium"
        text = (
            f"Price is in {c}. The last candle closed {'above' if prem else 'below'} the midpoint of the dealing range, in "
            f"the {'upper' if prem else 'lower'} half, where {'selling' if prem else 'buying'} is favored."
        )
    return {"explanation": text}


def _time_liquidity(ex: Dict[str, Any], facts: Dict[str, Any]) -> Dict[str, str]:
    high = ex["answer"]["type"] == "ny_am_high"
    return {
        "explanation": (
            f"This is the New York AM session {'high' if high else 'low'}. It is the {'highest' if high else 'lowest'} "
            f"price reached between 9:30 and 11:00 ET, so stops tend to rest {'above' if high else 'below'} it as "
            f"{'buy' if high else 'sell'}-side liquidity."
        )
    }


def _rr_text(facts: Dict[str, Any]) -> str:
    rr = facts.get("rr")
    return f"about {rr:.1f}:1" if rr is not None else "too small"


def _free(ex: Dict[str, Any], facts: Dict[str, Any]) -> Dict[str, str]:
    kind, d = facts["kind"], facts.get("direction")
    bull = d == "bullish"
    swept, opp = ("sell-side", "buy-side") if bull else ("buy-side", "sell-side")
    swing = "low" if bull else "high"
    if kind == "valid":
        text = (
            f"This is a valid {d} trade setup. Price swept {swept} liquidity and then shifted {d}, creating a "
            f"{'long' if bull else 'short'} opportunity in the highlighted entry zone. The stop belongs "
            f"{'below' if bull else 'above'} the swept {swing}, with the target at the {opp} liquidity "
            f"{'above' if bull else 'below'}."
        )
    elif kind == "no_sweep":
        text = (
            f"There is no valid trade setup here. Price shifted {d}, but the move never swept the previous swing {swing}, "
            f"so the required {swept} liquidity sweep did not occur. Without that sweep, the setup is incomplete and the "
            f"correct decision is to stay out."
        )
    elif kind == "no_entry":
        text = (
            f"There is no valid trade setup here. Price shifted {d}, but the move did not leave a usable Fair Value Gap or "
            f"Order Block to enter from. Without a valid entry zone, the correct decision is to stay out and wait for a "
            f"cleaner setup."
        )
    elif kind == "no_shift":
        text = (
            "There is no valid trade setup here. No confirmed Market Structure Shift formed during the session, so there is "
            "not enough confirmation to justify an entry. The correct decision is to stay out and wait for a valid "
            "structure shift."
        )
    elif kind == "low_rr":
        min_rr = ex["answer"].get("min_rr", 2)
        text = (
            f"This is not a valid trade to take. The {d} setup and entry area are reasonable, but the available "
            f"risk-to-reward is only {_rr_text(facts)}, which is below the required {min_rr:g}:1 minimum. The correct "
            f"decision is to stay out and wait for a setup with better reward relative to the risk."
        )
    else:
        raise ValueError(f"unknown trade kind {kind}")
    return {"explanation": text}


def _guided(ex: Dict[str, Any], facts: Dict[str, Any]) -> Dict[str, Any]:
    kind, d = facts["kind"], facts.get("direction")
    bull = d == "bullish"
    cap = (d or "").capitalize()
    swept, opp = ("sell-side", "buy-side") if bull else ("buy-side", "sell-side")
    swing = "low" if bull else "high"
    none = {
        "entry": "No valid entry means no entry to take.",
        "stop": "No valid entry means no stop loss is needed.",
        "target": "No valid entry means no target is needed.",
    }
    if kind in ("valid", "low_rr"):
        bias = (
            f"{cap} bias. Price swept {swept} liquidity {'below the lows' if bull else 'above the highs'} and then reversed "
            f"{'upward' if bull else 'lower'}, showing {d} intent."
        )
        entry = (
            f"Enter {'long' if bull else 'short'} at the marked entry after the {d} reversal confirms and price returns to "
            f"the setup area."
        )
        stop = (
            f"Place the stop {'below' if bull else 'above'} the swept {swing}. A move back {'below' if bull else 'above'} "
            f"that {swing} would invalidate the {d} setup."
        )
        target = (
            f"Target the {opp} liquidity resting {'above the previous highs' if bull else 'below the previous lows'} at the "
            f"marked level."
        )
        if kind == "valid":
            overall = (
                f"Valid {d} trade. The liquidity sweep, {d} confirmation, entry, stop, and target align, with a favorable "
                f"risk-to-reward."
            )
        else:
            overall = (
                "No trade. The direction, entry, stop, and target are valid, but the potential reward is too small "
                "compared with the risk. Wait for a setup with better risk-to-reward."
            )
        return {"step_explanations": {"bias": bias, "entry": entry, "stop": stop, "target": target}, "overall_explanation": overall}
    if kind == "no_entry":
        bias = (
            f"{cap} bias. Price swept {swept} liquidity {'below the lows' if bull else 'near the highs'} and then displaced "
            f"{'upward' if bull else 'lower'}, signaling {d} intent."
        )
        return {
            "step_explanations": {
                "bias": bias,
                "entry": f"No valid entry formed after the {d} confirmation, so there is no trade to take.",
                "stop": none["stop"],
                "target": none["target"],
            },
            "overall_explanation": f"No trade. The {d} bias is clear, but the setup never provided a valid entry.",
        }
    if kind == "no_sweep":
        return {
            "step_explanations": {
                "bias": (
                    f"A {d} Market Structure Shift formed, but {swept} liquidity was never swept first. Without that "
                    f"liquidity sweep, there isn't enough confirmation to establish a clear directional bias."
                ),
                "entry": "With no clear bias, there is no valid entry to take.",
                "stop": none["stop"],
                "target": none["target"],
            },
            "overall_explanation": "No trade. The setup is missing the liquidity sweep needed to confirm a clear bias.",
        }
    if kind == "no_shift":
        return {
            "step_explanations": {
                "bias": (
                    "Bias is unclear. There was no confirmed Market Structure Shift during the session to validate a "
                    "directional setup."
                ),
                "entry": "Without a confirmed Market Structure Shift, there is no valid entry to take.",
                "stop": none["stop"],
                "target": none["target"],
            },
            "overall_explanation": (
                "No trade. Without a confirmed structure shift, the setup does not meet the requirements for an entry."
            ),
        }
    raise ValueError(f"unknown trade kind {kind}")


_BY_RULE = {
    "fvg": _fvg,
    "ifvg": _ifvg,
    "order_block": _order_block,
    "equal_highs": _liquidity,
    "equal_lows": _liquidity,
    "mss": _mss,
    "dealing_range": _dealing_range,
    "ny_am_high": _time_liquidity,
    "ny_am_low": _time_liquidity,
    "free_trade_setup": _free,
    "guided_setup": _guided,
}


def can_explain(rule: str) -> bool:
    return rule in _BY_RULE


def explain(ex: Dict[str, Any], facts: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    rule = ex["provenance"]["detection_rule"]
    if rule not in _BY_RULE:
        raise ValueError(f"no explanation template for rule '{rule}'")
    return _BY_RULE[rule](ex, {**facts_from_scenario(ex), **(facts or {})})


def apply_explanations(ex: Dict[str, Any], facts: Optional[Dict[str, Any]] = None) -> None:
    """Overwrite the scenario's learner-facing text in place."""
    out = explain(ex, facts)
    if ex["answer_type"] == "guided":
        ex["answer"]["step_explanations"] = out["step_explanations"]
        ex["answer"]["overall_explanation"] = out["overall_explanation"]
        ex["explanation"] = out["overall_explanation"]
    else:
        ex["explanation"] = out["explanation"]
