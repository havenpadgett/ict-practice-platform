import glob
import json
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from explanations import apply_explanations, can_explain, explain  # noqa: E402

SCENARIOS = Path(__file__).resolve().parent.parent.parent / "src" / "data" / "real-scenarios"


def load(prefix):
    for f in sorted(glob.glob(str(SCENARIOS / f"{prefix}*.json"))):
        yield json.load(open(f))


class ExplanationStyle(unittest.TestCase):
    def test_recognition_templates_open_like_the_human_reviewed_ones(self):
        # The opening verdict sentence of every human-reviewed FVG and MSS
        # scenario is exactly what the generator produces for it.
        for ex in list(load("real-fvg")) + list(load("real-mss")):
            p = ex["provenance"]
            if not p["human_reviewed"] or p.get("review_status"):
                continue
            first = lambda t: re.split(r"(?<=\.)\s", t)[0]  # noqa: E731
            self.assertEqual(first(explain(ex)["explanation"]), first(ex["explanation"]), ex["exercise_id"])

    def test_no_template_output_carries_numbers_or_draft_markers(self):
        for ex in load("real-"):
            p = ex["provenance"]
            if not can_explain(p["detection_rule"]) or p.get("review_status"):
                continue
            out = explain(ex)
            texts = [out["explanation"]] if "explanation" in out else [*out["step_explanations"].values(), out["overall_explanation"]]
            for t in texts:
                self.assertNotIn("[DRAFT", t)
                self.assertNotRegex(re.sub(r"\d+(\.\d+)?:1|9:30|11:00", "", t), r"\d", ex["exercise_id"])

    def test_apply_writes_every_guided_field(self):
        ex = next(e for e in load("real-guided") if e["provenance"]["candidate_id"].startswith("setup-valid"))
        ex["answer"]["step_explanations"] = {k: "[DRAFT] x" for k in ex["answer"]["step_explanations"]}
        apply_explanations(ex)
        self.assertNotIn("[DRAFT", json.dumps(ex))
        self.assertEqual(ex["explanation"], ex["answer"]["overall_explanation"])


if __name__ == "__main__":
    unittest.main()
