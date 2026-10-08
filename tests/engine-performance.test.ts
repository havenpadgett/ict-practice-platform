import { describe, expect, it } from "vitest";
import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import { applicationLayers, knowledgeGap } from "@/lib/engine/application";
import { buildPerformance, workingTimeframe } from "@/lib/engine/performance";
import { sessionOf } from "@/lib/engine/session";
import { SCENARIO_CATALOG } from "@/lib/engine/store";
import { computeSkillVector, type EvidenceItem } from "@/lib/engine/skills";
import type { Dimension } from "@/lib/engine/types";

let n = 0;
function attempt(over: Partial<StoredScenarioAttempt> & { dims?: Partial<Record<Dimension, number>> } = {}): StoredScenarioAttempt {
  const { dims, ...rest } = over;
  n++;
  return {
    id: `a${n}`,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString(),
    source: "device",
    scenario_id: "sim-001",
    mode_id: "simulator",
    session_id: null,
    difficulty: 2,
    scenario_type: "valid_setup",
    score: 70,
    verdict: "could_improve",
    decision: "long",
    no_trade_scenario: false,
    correct_avoidance: null,
    confidence: null,
    outcome: "target",
    result_r: 1,
    mae_r: 0,
    mfe_r: 1,
    mistakes: [],
    dimensions: Object.entries(dims ?? {}).map(([dimension, score]) => ({ dimension: dimension as Dimension, applicable: true, score: score as number })),
    skill_evidence: [],
    response: { scenarioId: "sim-001", modeId: "simulator", stages: {}, confidence: null, responseTimeMs: 0 },
    response_time_ms: 0,
    attempt_number: 1,
    ...rest,
  };
}

describe("performance report", () => {
  it("says nothing with no data, and never a rate on too few attempts", () => {
    const empty = buildPerformance([], SCENARIO_CATALOG);
    expect(empty.insights).toEqual([]);
    expect(empty.metrics.every((m) => m.n === 0 && m.correctRate === null)).toBe(true);
    const two = buildPerformance([attempt({ dims: { liquidity_read: 90 } }), attempt({ dims: { liquidity_read: 90 } })], SCENARIO_CATALOG);
    expect(two.metrics.find((m) => m.id === "liquidity")?.correctRate).toBeNull();
    expect(two.insights).toEqual([]);
  });

  it("states a liquidity rate with its sample size once there is enough", () => {
    const rows = [90, 90, 90, 90, 40].map((s) => attempt({ dims: { liquidity_read: s } }));
    const r = buildPerformance(rows, SCENARIO_CATALOG);
    expect(r.metrics.find((m) => m.id === "liquidity")?.correctRate).toBeCloseTo(0.8);
    expect(r.insights[0]).toContain("80%");
    expect(r.insights[0]).toContain("5 attempts");
  });

  it("flags confidence running ahead of accuracy on one part of the process", () => {
    const rows = [30, 40, 90, 30, 40].map((s) => attempt({ confidence: 5, dims: { htf_bias: s } }));
    const r = buildPerformance(rows, SCENARIO_CATALOG);
    expect(r.confidenceGap?.metric.id).toBe("htf_bias");
    expect(r.insights.join(" ")).toContain("HTF Bias");
  });

  it("leaves placement out, slices by session and difficulty, and counts false positives", () => {
    const rows = [
      attempt({ mode_id: "placement", score: 5 }),
      attempt({ scenario_id: "sim-024", difficulty: 3, no_trade_scenario: true, decision: "long" }),
      attempt({ scenario_id: "sim-001", decision: "long", no_trade_scenario: true }),
      attempt({ scenario_id: "sim-001", decision: "no_trade" }),
      attempt({ scenario_id: "sim-013", decision: "short" }),
    ];
    const r = buildPerformance(rows, SCENARIO_CATALOG);
    expect(r.total).toBe(4);
    expect(r.bySession.map((s) => s.key).sort()).toEqual(["london", "ny_am", "ny_pm"]);
    expect(r.byDifficulty.map((d) => d.key)).toEqual(["2", "3"]);
    expect(r.falsePositive).toMatchObject({ trades: 3, wrong: 2 });
  });

  it("reads the working timeframe from non-hindsight marks", () => {
    const mark = (tf: "5m" | "1H", hindsight = false) => ({ id: "m", kind: "liquidity" as const, price: 1, tf, hindsight });
    const a = attempt({
      response: {
        scenarioId: "sim-001",
        modeId: "simulator",
        stages: { replay: { kind: "replay", annotations: [mark("5m"), mark("5m"), mark("1H"), mark("1H", true), mark("1H", true), mark("1H", true)], bias: null, decision: "wait", order: null, waits: 0, decidedAtRevealed: 0 } },
        confidence: null,
        responseTimeMs: 0,
      },
    });
    expect(workingTimeframe(a)).toBe("5m");
    expect(workingTimeframe(attempt())).toBeNull();
  });
});

describe("sessions", () => {
  it("buckets the ET clock", () => {
    const at = (h: number, m = 0) => 31588430 - (31588430 % 1440) + h * 60 + m;
    expect([at(19), at(2, 59), at(3), at(8, 29), at(8, 30), at(11, 59), at(12), at(16)].map(sessionOf)).toEqual(["asia", "asia", "london", "london", "ny_am", "ny_am", "ny_pm", "ny_pm"]);
  });
  it("every catalog scenario has one", () => {
    expect(SCENARIO_CATALOG.every((m) => ["asia", "london", "ny_am", "ny_pm"].includes(m.session))).toBe(true);
  });
});

describe("knowledge versus application", () => {
  const ev = (skill: string, score: number): EvidenceItem[] => Array.from({ length: 8 }, (_, i) => ({ skill: skill as never, score, weight: 0.8, at: `2026-01-01T00:00:0${i}Z`, source: "practice" }));
  it("separates the vocabulary from execution", () => {
    const v = computeSkillVector([...ev("concept_recognition", 0.95), ...ev("entry_models", 0.3), ...ev("execution", 0.3)]);
    const layers = applicationLayers(v);
    expect(layers.find((l) => l.id === "concept_knowledge")?.score).toBeGreaterThan(0.8);
    expect(layers.find((l) => l.id === "execution")?.score).toBeLessThan(0.45);
    expect(layers.find((l) => l.id === "context_reading")?.score).toBeNull();
    expect(knowledgeGap(layers)).toContain("Execution");
  });
  it("gives no sentence when the applied layers are unmeasured", () => {
    expect(knowledgeGap(applicationLayers(computeSkillVector(ev("concept_recognition", 0.9))))).toBeNull();
  });
});
