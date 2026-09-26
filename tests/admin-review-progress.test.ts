import { describe, expect, it } from "vitest";
import type { RealScenario } from "@/data/real-scenarios";
import { reviewProgress } from "@/lib/admin/review-progress";
import type { ReviewLogEntry } from "@/lib/review/store";

const s = (id: string, rule: string, p: Record<string, unknown>) =>
  ({ exercise_id: id, provenance: { detection_rule: rule, human_reviewed: false, ...p } }) as unknown as RealScenario;
const log = (rule: string, decision: ReviewLogEntry["decision"]) => ({ rule, decision }) as ReviewLogEntry;

describe("reviewProgress", () => {
  it("splits scenarios into live, awaiting, stale and ambiguous, and counts rejections from the log", () => {
    const scenarios = [
      s("real-fvg-001", "fvg", { human_reviewed: true }),
      s("real-fvg-002", "fvg", { human_reviewed: true, stale: true }),
      s("real-fvg-003", "fvg", {}),
      s("real-fvg-004", "fvg", { review_status: "ambiguous" }),
      s("real-mss-001", "mss", {}),
    ];
    const rows = reviewProgress(scenarios, [log("fvg", "approved"), log("fvg", "rejected"), log("order_block", "rejected")], (x) =>
      Boolean((x.provenance as unknown as { stale?: boolean }).stale),
    );
    expect(rows).toEqual([
      { rule: "fvg", live: 1, awaiting: 1, stale: 1, ambiguous: 1, rejected: 1 },
      { rule: "mss", live: 0, awaiting: 1, stale: 0, ambiguous: 0, rejected: 0 },
      { rule: "order_block", live: 0, awaiting: 0, stale: 0, ambiguous: 0, rejected: 1 },
    ]);
  });
});
