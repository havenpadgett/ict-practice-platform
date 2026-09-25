"""Detection rules against docs/CURRICULUM.md: for each rule, a fixture
where the setup exists and one where it nearly does but doesn't.

Run: python3 -m unittest discover -s scripts/tests
"""

import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import detect  # noqa: E402
from common import ET, parse_et, trading_date  # noqa: E402


def bars(ohlc, start="2026-03-03T09:30:00-05:00", minutes=5):
    t0 = parse_et(start)
    out = []
    for i, (o, h, l, c) in enumerate(ohlc):
        dt = t0 + timedelta(minutes=minutes * i)
        out.append({"timestamp": dt.isoformat(), "_dt": dt, "open": o, "high": h, "low": l, "close": c, "volume": 1})
    return out


def flat(n, price=100.0, size=1.0):
    """n quiet bars oscillating around `price` - no swings worth anything."""
    out = []
    for i in range(n):
        o = price + (0.2 if i % 2 else -0.2)
        c = price - (0.2 if i % 2 else -0.2)
        out.append((o, max(o, c) + size / 2, min(o, c) - size / 2, c))
    return out


class FVG(unittest.TestCase):
    def test_gap_between_candle_1_high_and_candle_3_low_is_detected(self):
        c = bars([(100, 101, 99, 100.5), (100.5, 110, 100.4, 109.5), (109.5, 112, 104, 111)])
        found = detect.detect_fvg(c, [0.0] * len(c))
        self.assertEqual([(f["direction"], f["levels"]["price_low"], f["levels"]["price_high"]) for f in found],
                         [("bullish", 101, 104)])

    def test_candle_3_wick_through_candle_1_high_is_not_a_gap(self):
        # Bodies never overlap (candle 3's body starts at 109.5), but its
        # wick trades down to 100.8, below candle 1's high: the range was
        # traded, so no FVG - the rule compares wicks, not bodies.
        c = bars([(100, 101, 99, 100.5), (100.5, 110, 100.4, 109.5), (109.5, 112, 100.8, 111)])
        self.assertEqual(detect.detect_fvg(c, [0.0] * len(c)), [])

    def test_gap_below_the_minimum_size_is_ignored(self):
        c = bars([(100, 101, 99, 100.5), (100.5, 110, 100.4, 109.5), (109.5, 112, 101.5, 111)])
        self.assertEqual(detect.detect_fvg(c, [1.0] * len(c)), [])


def uptrend_then(last):
    """Higher highs and higher lows (swing highs 104, 108; swing lows 101,
    105), followed by the `last` bars."""
    return bars([
        (100, 101, 99.5, 100.5), (100.5, 102, 100, 101.5), (101.5, 104, 101.2, 103.5),  # swing high 104 @2
        (103.5, 103.8, 102, 102.5), (102.5, 102.8, 101, 101.5),                          # swing low 101 @4
        (101.5, 103, 101.2, 102.8), (102.8, 106, 102.6, 105.5), (105.5, 108, 105.2, 107.5),  # swing high 108 @7
        (107.5, 107.8, 106, 106.5), (106.5, 106.8, 105, 105.8),                          # swing low 105 @9
        (105.8, 106.9, 105.5, 106.5), (106.5, 107.2, 106, 106.8),
    ] + last)


class MSS(unittest.TestCase):
    def run_mss(self, c):
        return detect.detect_mss(c, detect.swing_highs(c, 2), detect.swing_lows(c, 2), 2)

    def test_body_close_below_the_higher_low_in_an_uptrend_is_a_bearish_shift(self):
        c = uptrend_then([(106.8, 107, 103.5, 104)])  # closes below 105
        found = self.run_mss(c)
        self.assertEqual([(m["direction"], m["levels"]["price"]) for m in found], [("bearish", 105)])

    def test_wick_below_the_higher_low_without_a_body_close_is_not_a_shift(self):
        c = uptrend_then([(106.8, 107, 104, 106)])
        self.assertEqual(self.run_mss(c), [])

    def test_break_in_the_trend_direction_is_continuation_not_a_shift(self):
        c = uptrend_then([(106.8, 110, 106.6, 109.5)])  # closes above the 108 high
        self.assertEqual(self.run_mss(c), [])


class EqualHighs(unittest.TestCase):
    def two_highs(self, second):
        return bars([
            (100, 101, 99.5, 100.5), (100.5, 102, 100, 101.5), (101.5, 110, 101.2, 108),  # swing high 110 @2
            (108, 108.5, 104, 105), (105, 105.5, 102, 103), (103, 104, 102.5, 103.5),
            (103.5, 106, 103, 105.5), (105.5, second, 105, 107),                          # swing high @7
            (107, 107.5, 104, 104.5), (104.5, 105, 103, 103.5),
        ])

    def test_highs_within_tolerance_are_equal(self):
        c = self.two_highs(110.04)  # 0.04 apart; 0.05% of 110 = 0.055
        found = detect.detect_equal(c, detect.swing_highs(c, 2), "highs", 0.05)
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["involved_indices"], [2, 7])

    def test_highs_outside_tolerance_are_not_equal(self):
        c = self.two_highs(109.9)  # 0.1 apart
        self.assertEqual(detect.detect_equal(c, detect.swing_highs(c, 2), "highs", 0.05), [])


def downtrend_then(last):
    """A falling market with a lower high (swing high 105.5 @4), then `last`."""
    return bars([
        (108, 108.5, 106, 106.5), (106.5, 107, 104, 104.5), (104.5, 104.8, 102, 102.5),
        (102.5, 103.5, 102.3, 103), (103, 105.5, 102.8, 104.5),                           # swing high 105.5 @4
        (104.5, 104.8, 102.5, 103), (103, 103.2, 100.5, 101), (101, 101.2, 99, 99.5),
    ] + last)


class OrderBlocks(unittest.TestCase):
    def run_ob(self, c):
        med = [2.0] * len(c)  # a typical bar is 2 points, so displacement needs 4+
        return detect.detect_order_blocks(c, detect.swing_highs(c, 2), detect.swing_lows(c, 2), 2, med, 0, 2.0)

    def test_last_down_close_before_a_displacement_that_breaks_structure(self):
        c = downtrend_then([(99.5, 99.8, 98.5, 98.8),   # the last down-close candle (@8)
                            (98.8, 102.5, 98.7, 102.2), (102.2, 106.5, 102, 106.2)])  # +7.4 in two candles, closes above 105.5
        self.assertIn(4, detect.swing_highs(c, 2))
        found = self.run_ob(c)
        self.assertEqual([(o["direction"], o["ob_index"]) for o in found], [("bullish", 8)])
        self.assertEqual((found[0]["levels"]["price_low"], found[0]["levels"]["price_high"]), (98.5, 99.8))

    def test_ordinary_movement_that_breaks_structure_is_not_an_order_block(self):
        # The same structure break, but by a slow grind: each leg of up-closes
        # is small, so no 1-3 candle run covers 2x the median range.
        c = downtrend_then([(99.5, 99.8, 98.5, 98.8), (98.8, 100.2, 98.7, 100), (100, 100.4, 99.4, 99.6),
                            (99.6, 101, 99.5, 100.8), (100.8, 101.2, 100.2, 100.5), (100.5, 102, 100.4, 101.8),
                            (101.8, 102.2, 101.2, 101.5), (101.5, 103, 101.4, 102.8), (102.8, 103.1, 102.2, 102.5),
                            (102.5, 104.4, 102.4, 104.2), (104.2, 104.6, 103.8, 104), (104, 105.2, 103.9, 105),
                            (105, 105.3, 104.6, 104.8), (104.8, 105.9, 104.7, 105.7)])
        self.assertIn(4, detect.swing_highs(c, 2))
        self.assertGreater(c[-1]["close"], 105.5, "the grind must still break the swing high")
        self.assertEqual(self.run_ob(c), [])


class SessionBoundaries(unittest.TestCase):
    def test_no_candidate_spans_two_sessions(self):
        # Day 1 ends at 10:55 high at 101; day 2 opens at 9:30 far above.
        # Glued together they'd form an FVG and swings across the break.
        day1 = bars(flat(18, 100), "2026-03-03T09:30:00-05:00")
        day2 = bars([(110 + i * 0.1, 110.6 + i * 0.1, 109.9 + i * 0.1, 110.3 + i * 0.1) for i in range(18)],
                    "2026-03-04T09:30:00-05:00")
        candles = day1 + day2
        clean = {"meta": {"timeframe_minutes": 5, "selection": {"session": "ny_am"}, "source": "test",
                          "symbol": "NQ", "input_sha256": "x", "start": "", "end": ""},
                 "candles": [{k: v for k, v in c.items() if k != "_dt"} for c in candles]}
        with tempfile.TemporaryDirectory() as d:
            src, out = Path(d) / "t.clean.json", Path(d) / "t.candidates.json"
            src.write_text(json.dumps(clean))
            with open(Path(d) / "log", "w") as log:
                stdout, sys.stdout = sys.stdout, log
                try:
                    detect.main([str(src), "-o", str(out), "--fvg-min-range-mult", "0"])
                finally:
                    sys.stdout = stdout
            found = json.loads(out.read_text())["candidates"]
        by_ts = {c["timestamp"]: c for c in clean["candles"]}
        for cand in found:
            days = {trading_date(parse_et(t)) for t in cand["involved_timestamps"] if t in by_ts}
            self.assertEqual(len(days), 1, f"{cand['id']} spans {sorted(days)}")
        # And the junction really would have been a gap if glued together.
        glued = detect.detect_fvg(candles[16:20], [0.0] * 4)
        self.assertTrue(glued, "fixture should form a cross-session FVG when sessions are glued")


if __name__ == "__main__":
    unittest.main()
