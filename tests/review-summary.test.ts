import { describe, expect, it } from "vitest";
import { renderSummary, type ReviewLogEntry } from "@/lib/review/store";

const e = (rule: string, decision: ReviewLogEntry["decision"], reason: string | null = null): ReviewLogEntry => ({
  date: "2026-09-25",
  exercise_id: "real-x-001",
  candidate_id: "c",
  rule,
  decision,
  reason,
  note: null,
  reviewer: "r",
});

describe("rejection summary", () => {
  const log = [
    ...Array(3).fill(e("mss", "rejected", "not_definition")),
    e("mss", "rejected", "wrong_answer_key"),
    e("mss", "ambiguous"),
    e("mss", "approved"),
    e("fvg", "approved"),
    e("fvg", "rejected", "poor_chart"),
  ];
  const md = renderSummary(log, { mss: 4, fvg: 9 });

  it("counts decisions and the most common reason per rule", () => {
    expect(md).toContain("| mss | 4 | 6 | 1 | 4 | 1 | 83% | Doesn't match the definition (3) |");
    expect(md).toContain("| fvg | 9 | 2 | 1 | 1 | 0 | 50% | Poor quality chart (1) |");
  });

  it("counts rejections by reason with the rules behind them", () => {
    expect(md).toContain("| Doesn't match the definition | 3 | 60% | mss (3) |");
  });

  it("calls out a rule once 30%+ of at least 5 reviews fail, not before", () => {
    expect(md).toMatch(/\*\*mss\*\*: 83% of 6 reviewed/);
    expect(md).not.toMatch(/\*\*fvg\*\*/);
  });
});
