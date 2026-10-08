import { describe, expect, it } from "vitest";
import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import { buildTenMinuteReview, encodePlan, parsePlan, REVIEW_SLOTS, runSessionId, summarizeRun } from "@/lib/engine/run";
import { computeSkillVector, evidenceFromAttempts } from "@/lib/engine/skills";
import { MODES } from "@/lib/engine/modes";
import { SCENARIO_CATALOG } from "@/lib/engine/store";
import { SKILLS } from "@/lib/engine/types";

let n = 0;
function attempt(over: Partial<StoredScenarioAttempt>): StoredScenarioAttempt {
  n++;
  return {
    id: `a${n}`, created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString(), source: "device", scenario_id: "sim-001", mode_id: "simulator", session_id: null, difficulty: 2,
    scenario_type: "valid_setup", score: 60, verdict: "could_improve", decision: "long", no_trade_scenario: false, correct_avoidance: null, confidence: null, outcome: "target",
    result_r: 1, mae_r: 0, mfe_r: 1, mistakes: [], dimensions: [], skill_evidence: SKILLS.map((skill) => ({ skill, score: 0.5, weight: 0.8 })),
    response: { scenarioId: "sim-001", modeId: "simulator", stages: {}, confidence: null, responseTimeMs: 0 }, response_time_ms: 0, attempt_number: 1, ...over,
  };
}

describe("10-minute review", () => {
  it("assembles two concept, two chart and one execution step from the catalog, all playable, none repeated", () => {
    const vector = computeSkillVector([]);
    const steps = buildTenMinuteReview({ vector, attempts: [], catalog: SCENARIO_CATALOG });
    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.role)).toEqual(["Weak concept", "Weak concept", "Chart analysis", "Chart analysis", "Execution"]);
    expect(new Set(steps.map((s) => s.scenarioId)).size).toBe(5);
    for (const [i, s] of steps.entries()) {
      expect(SCENARIO_CATALOG.find((m) => m.id === s.scenarioId)?.modes).toContain(s.mode);
      expect(REVIEW_SLOTS[s.slot as number].modes).toContain(s.mode);
      expect(MODES[s.mode].stages.length).toBeGreaterThan(0);
      expect(i).toBeGreaterThanOrEqual(0);
    }
  });

  it("is deterministic and avoids what was just played when alternatives exist", () => {
    const attempts = ["sim-001", "sim-002", "sim-004"].map((scenario_id) => attempt({ scenario_id }));
    const vector = computeSkillVector(evidenceFromAttempts(attempts.concat(Array.from({ length: 5 }, () => attempt({})))));
    const a = buildTenMinuteReview({ vector, attempts, catalog: SCENARIO_CATALOG });
    expect(a).toEqual(buildTenMinuteReview({ vector, attempts, catalog: SCENARIO_CATALOG }));
    expect(a.some((s) => ["sim-001", "sim-002", "sim-004"].includes(s.scenarioId))).toBe(false);
  });

  it("round-trips a plan through the URL and drops anything invalid", () => {
    const steps = buildTenMinuteReview({ vector: computeSkillVector([]), attempts: [], catalog: SCENARIO_CATALOG });
    expect(parsePlan(encodePlan(steps))).toEqual(steps.map((s) => ({ scenarioId: s.scenarioId, mode: s.mode, slot: s.slot })));
    expect(parsePlan("nope.simulator,sim-001.nope,sim-001.simulator")).toEqual([{ scenarioId: "sim-001", mode: "simulator", slot: undefined }]);
    expect(parsePlan(null)).toEqual([]);
  });
});

describe("run summary", () => {
  const run = "ten-abc";
  const steps = [
    { scenarioId: "sim-001", mode: "simulator" as const, role: "Execution" },
    { scenarioId: "sim-002", mode: "simulator" as const, role: "Execution" },
  ];
  it("reports improvement only against real earlier attempts, what was missed, and what to train", () => {
    const earlier = [attempt({ scenario_id: "sim-001", score: 40 }), ...Array.from({ length: 6 }, () => attempt({ scenario_id: "sim-003", score: 50 }))];
    const during = [
      attempt({ scenario_id: "sim-001", score: 70, session_id: runSessionId(run, 0), mistakes: ["PREMATURE_ENTRY"], dimensions: [{ dimension: "confirmation", applicable: true, score: 20 }] }),
    ];
    const s = summarizeRun({ run, steps, attempts: [...earlier, ...during] });
    expect(s.completed).toBe(1);
    expect(s.steps[0].previousScore).toBe(40);
    expect(s.steps[1].attempt).toBeNull();
    expect(s.improved.join(" ")).toContain("40 → 70");
    expect(s.missed.join(" ")).toMatch(/Premature/i);
    expect(s.missed.join(" ")).toContain("Confirmation");
    expect(s.next).not.toBeNull();
  });
  it("claims no improvement on a first-ever attempt", () => {
    const s = summarizeRun({ run, steps, attempts: [attempt({ scenario_id: "sim-001", score: 70, session_id: runSessionId(run, 0) })] });
    expect(s.improved).toEqual([]);
  });
});
