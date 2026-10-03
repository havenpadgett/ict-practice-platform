import { describe, expect, it } from "vitest";
import { exercises, isPracticeReady } from "@/data/exercises";
import { AUTO_REVIEWER, parseRealScenario, realScenarios, reviewTexts, type RealScenario } from "@/data/real-scenarios";
import { describeFlag } from "@/lib/review/use-flags";
import { renderApprovalSummary, type ReviewLogEntry } from "@/lib/review/store";

const base = () => {
  const s = realScenarios.find((x) => x.provenance.human_reviewed && x.answer_type === "zone")!;
  return JSON.parse(JSON.stringify(s)) as RealScenario;
};
const asAuto = (s: RealScenario) => {
  Object.assign(s.provenance, { human_reviewed: false, auto_approved: true, reviewed_by: AUTO_REVIEWER });
  return s;
};

describe("auto approval contract", () => {
  it("accepts an auto approval that names the pipeline as reviewer", () => {
    expect(() => parseRealScenario(asAuto(base()))).not.toThrow();
  });

  it("rejects an auto approval that names a person", () => {
    const s = asAuto(base());
    s.provenance.reviewed_by = "someone@example.com";
    expect(() => parseRealScenario(s)).toThrow(/reviewed_by "auto"/);
  });

  it("rejects recording 'auto' as a human review, or both approvals at once", () => {
    const human = base();
    human.provenance.reviewed_by = AUTO_REVIEWER;
    expect(() => parseRealScenario(human)).toThrow(/can't be recorded as a human review/);
    const both = asAuto(base());
    both.provenance.human_reviewed = true;
    expect(() => parseRealScenario(both)).toThrow(/mutually exclusive/);
  });

  it("rejects an auto approval that still carries the draft explanation", () => {
    const s = asAuto(base());
    s.explanation = "[DRAFT - generated] x";
    expect(() => parseRealScenario(s)).toThrow(/still the generated draft/);
  });
});

describe("practice gate", () => {
  it("serves an auto-approved scenario, unless ambiguous or stale", () => {
    expect(isPracticeReady(asAuto(base()))).toBe(true);
    const amb = asAuto(base());
    amb.provenance.review_status = "ambiguous";
    expect(isPracticeReady(amb)).toBe(false);
    const stale = asAuto(base());
    stale.provenance.curriculum_versions = { fvg: 0 };
    expect(isPracticeReady(stale)).toBe(false);
  });

  it("still withholds a scenario with neither approval", () => {
    const s = base();
    s.provenance.human_reviewed = false;
    expect(isPracticeReady(s)).toBe(false);
  });
});

describe("the shipped scenarios", () => {
  const real = exercises.filter((e): e is RealScenario => e.provenance !== undefined);

  it("never mark an auto approval as human, nor a human review as auto", () => {
    for (const s of real) {
      const p = s.provenance;
      if (p.auto_approved) expect([s.exercise_id, p.human_reviewed, p.reviewed_by]).toEqual([s.exercise_id, false, AUTO_REVIEWER]);
      if (p.human_reviewed) expect(p.reviewed_by).not.toBe(AUTO_REVIEWER);
    }
  });

  it("have house-style explanations: no draft marker, no candle numbers (apart from an R:R)", () => {
    for (const s of real.filter((x) => x.provenance.auto_approved)) {
      for (const t of reviewTexts(s)) {
        expect(t.value, s.exercise_id).not.toContain("[DRAFT");
        expect(t.value.replace(/\d+(\.\d+)?:1|9:30|11:00/g, ""), `${s.exercise_id} ${t.key}`).not.toMatch(/\d/);
      }
    }
  });
});

describe("approval summary", () => {
  const p = (rule: string, extra: Record<string, unknown>) => ({ provenance: { detection_rule: rule, human_reviewed: false, ...extra } });
  const log = [{ rule: "fvg", decision: "approved", after_auto: true }, { rule: "fvg", decision: "rejected", after_auto: true }, { rule: "fvg", decision: "rejected" }] as ReviewLogEntry[];
  const md = renderApprovalSummary(
    [p("fvg", { human_reviewed: true }), p("fvg", { auto_approved: true }), p("fvg", { auto_approved: true }), p("fvg", { review_status: "ambiguous", auto_approved: true })],
    log,
  );

  it("counts each kind of approval and the spot-checks of auto ones", () => {
    expect(md).toContain("| fvg | 1 | 2 | 67% | 2 | 1 |");
    expect(md).toContain("| **All rules** | **1** | **2** | **67%** | | |");
  });
});

describe("use flags", () => {
  const row = { exercise_id: "x", attempts: 12, success_rate: 0.25, peer_success_rate: 0.75, open_reports: 1, flagged_failure_rate: false };

  it("needs more reports to flag a human-approved scenario than an auto one", () => {
    expect(describeFlag(row, 1)).toBe("1 open report");
    expect(describeFlag(row, 2)).toBeNull();
  });

  it("describes a failure-rate flag with both rates", () => {
    expect(describeFlag({ ...row, open_reports: 0, flagged_failure_rate: true }, 2)).toBe(
      "success 25% over 12 attempts vs 75% for the rest of its concept",
    );
  });
});
