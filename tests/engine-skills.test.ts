import { describe, expect, it } from "vitest";
import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import { summarizeTraining } from "@/lib/engine/history";
import { THRESHOLDS } from "@/lib/engine/skill-config";
import { classify, computeSkillVector, currentPlacement, evidenceFromAttempts, leadSentence, weakestSkills, type EvidenceItem } from "@/lib/engine/skills";
import { explanationTier } from "@/lib/engine/tier";
import { difficultyCeiling, pickWeaknessScenarios, recentScenarioIds, skillNeeds, targetDifficulty, tendencies } from "@/lib/engine/weakness";
import type { ScenarioMeta } from "@/lib/engine/store";
import { SKILLS, type MistakeId, type SkillId } from "@/lib/engine/types";

let n = 0;
const at = () => new Date(Date.UTC(2026, 0, 1, 0, 0, n++)).toISOString();

function evidence(scores: Partial<Record<SkillId, number>>, repeat = 8): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  for (let i = 0; i < repeat; i++) for (const [skill, score] of Object.entries(scores)) out.push({ skill: skill as SkillId, score: score as number, weight: 0.8, at: at(), source: "practice" });
  return out;
}

const all = (v: number): Record<SkillId, number> => Object.fromEntries(SKILLS.map((s) => [s, v])) as Record<SkillId, number>;

function attempt(over: Partial<StoredScenarioAttempt>): StoredScenarioAttempt {
  return {
    id: `a${n}`,
    created_at: at(),
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
    result_r: 2,
    mae_r: 0.2,
    mfe_r: 2,
    mistakes: [],
    dimensions: [],
    skill_evidence: [],
    response: { scenarioId: "sim-001", modeId: "simulator", stages: {}, confidence: null, responseTimeMs: 0 },
    response_time_ms: 0,
    attempt_number: 1,
    ...over,
  };
}

describe("skill vector", () => {
  it("is seven separate estimates, shrunk toward a prior so a couple of answers can't swing it", () => {
    const one = computeSkillVector([{ skill: "htf_bias", score: 1, weight: 0.8, at: at(), source: "practice" }]);
    expect(one.htf_bias.measured).toBe(false);
    expect(one.htf_bias.score).toBeNull();
    const many = computeSkillVector(evidence({ htf_bias: 1 }, 10));
    expect(many.htf_bias.score).toBeGreaterThan(0.85);
    expect(many.htf_bias.score).toBeLessThan(1);
    expect(many.liquidity.measured).toBe(false);
  });

  it("weights recent evidence more", () => {
    const old = Array.from({ length: 10 }, (_, i) => ({ skill: "liquidity" as const, score: 0.2, weight: 0.8, at: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`, source: "practice" as const }));
    const fresh = Array.from({ length: 10 }, (_, i) => ({ skill: "liquidity" as const, score: 0.9, weight: 0.8, at: `2026-02-01T00:00:${String(i).padStart(2, "0")}Z`, source: "practice" as const }));
    const v = computeSkillVector([...old, ...fresh]);
    expect(v.liquidity.score).toBeGreaterThan(0.6);
    expect(v.liquidity.trend).toBeGreaterThan(0.3);
  });

  it("names the weakest measured skills and leads with the specific one", () => {
    const v = computeSkillVector(evidence({ ...all(0.85), htf_bias: 0.4 }));
    expect(weakestSkills(v, 1)[0].skill).toBe("htf_bias");
    const lead = leadSentence(v);
    expect(lead.text).toBe("Your concepts are strong, but HTF Bias is your weakest area.");
    expect(lead.skill).toBe("htf_bias");
  });
});

describe("classification", () => {
  it("is not given until enough is measured", () => {
    expect(classify(computeSkillVector([])).level).toBeNull();
    expect(classify(computeSkillVector(evidence({ concept_recognition: 0.9, market_structure: 0.9 }))).level).toBeNull();
  });

  it("does not call someone Advanced for terminology alone", () => {
    const v = computeSkillVector(evidence({ concept_recognition: 0.95, market_structure: 0.9, liquidity: 0.45, htf_bias: 0.4, confluence: 0.45, entry_models: 0.4, execution: 0.4 }, 10));
    const c = classify(v);
    expect(c.level).toBe("developing");
    expect(c.nextStep).toMatch(/Intermediate/);
  });

  it("reaches Intermediate on context but not Advanced without execution", () => {
    const v = computeSkillVector(evidence({ concept_recognition: 0.85, market_structure: 0.8, liquidity: 0.75, htf_bias: 0.75, confluence: 0.7, entry_models: 0.45, execution: 0.4 }, 12));
    const c = classify(v);
    expect(c.level).toBe("intermediate");
    expect(c.nextStep).toMatch(/Advanced/);
  });

  it("reaches Advanced only with strong context and execution and no weak skill", () => {
    const strong = computeSkillVector(evidence(all(0.92), 12));
    expect(classify(strong).level).toBe("advanced");
    const oneWeak = computeSkillVector(evidence({ ...all(0.92), execution: 0.5 }, 12));
    expect(classify(oneWeak).level).not.toBe("advanced");
  });

  it("is not permanent: the same learner reclassifies as the evidence changes", () => {
    const before = evidence(all(0.92), 12);
    const worse = Array.from({ length: 24 }, (_, i) => ({ skill: SKILLS[i % 7], score: 0.3, weight: 0.8, at: `2027-01-01T00:00:${String(i).padStart(2, "0")}Z`, source: "practice" as const }));
    expect(classify(computeSkillVector(before)).level).toBe("advanced");
    expect(classify(computeSkillVector([...before, ...worse])).level).not.toBe("advanced");
  });

  it("keeps every threshold in the one config object", () => {
    expect(Object.keys(THRESHOLDS)).toEqual(["developing", "intermediate", "advanced"]);
  });
});

describe("placement is retakeable", () => {
  const ev = (skill: SkillId, score: number) => [{ skill, score, weight: 1 }];
  it("counts only the latest full placement and the latest test-out per skill", () => {
    const old = attempt({ id: "old", mode_id: "placement", session_id: "placement:1", skill_evidence: ev("htf_bias", 0.2) });
    const next = attempt({ id: "new", mode_id: "placement", session_id: "placement:2", skill_evidence: ev("htf_bias", 0.9) });
    const test1 = attempt({ id: "t1", mode_id: "placement", session_id: "placement-skill:liquidity:1", skill_evidence: ev("liquidity", 0.3) });
    const test2 = attempt({ id: "t2", mode_id: "placement", session_id: "placement-skill:liquidity:2", skill_evidence: ev("liquidity", 0.9) });
    const kept = currentPlacement([old, next, test1, test2]).map((a) => a.id).sort();
    expect(kept).toEqual(["new", "t2"]);
    const items = evidenceFromAttempts([old, next]);
    expect(items).toHaveLength(1);
    expect(items[0].score).toBe(0.9);
  });

  it("lets practice move the estimate after a placement", () => {
    const placed = attempt({ mode_id: "placement", session_id: "placement:1", skill_evidence: Array.from({ length: 6 }, () => ({ skill: "htf_bias" as const, score: 0.3, weight: 1 })) });
    const practice = Array.from({ length: 14 }, () => attempt({ skill_evidence: [{ skill: "htf_bias", score: 0.95, weight: 1 }] }));
    const before = computeSkillVector(evidenceFromAttempts([placed])).htf_bias.score as number;
    const after = computeSkillVector(evidenceFromAttempts([placed, ...practice])).htf_bias.score as number;
    expect(after).toBeGreaterThan(before + 0.3);
  });
});

describe("explanation tier", () => {
  it("never gives an advanced reader definitions", () => {
    expect(explanationTier("advanced", "beginner")).toBe("decide");
    expect(explanationTier("foundation", "experienced")).toBe("define");
    expect(explanationTier(null, "beginner")).toBe("define");
    expect(explanationTier(null, "experienced")).toBe("relate");
    expect(explanationTier("intermediate", "beginner")).toBe("relate");
  });
});

describe("training history", () => {
  it("surfaces the most frequent structured mistake with its count", () => {
    const m = (...ids: MistakeId[]) => attempt({ mistakes: ids });
    const s = summarizeTraining([m("PREMATURE_ENTRY"), m("PREMATURE_ENTRY", "STOP_TOO_TIGHT"), m("PREMATURE_ENTRY"), m("WRONG_DRAW")]);
    expect(s.topMistake).toEqual({ id: "PREMATURE_ENTRY", count: 3 });
    expect(s.mistakes.map((x) => x.id)).toEqual(["PREMATURE_ENTRY", "WRONG_DRAW", "STOP_TOO_TIGHT"]); // ties: most recent first
  });

  it("tracks Correct Avoidance Rate, and only quotes it with enough samples", () => {
    const few = summarizeTraining([attempt({ no_trade_scenario: true, correct_avoidance: true, decision: "no_trade" })]);
    expect(few.avoidance.rate).toBeNull();
    const many = summarizeTraining([
      attempt({ no_trade_scenario: true, correct_avoidance: true, decision: "no_trade" }),
      attempt({ no_trade_scenario: true, correct_avoidance: true, decision: "wait" }),
      attempt({ no_trade_scenario: true, correct_avoidance: false, decision: "long" }),
    ]);
    expect(many.avoidance.rate).toBeCloseTo(2 / 3);
  });

  it("finds high confidence with a low score, and the reverse", () => {
    const rows = [
      ...Array.from({ length: 3 }, () => attempt({ confidence: 5, score: 40 })),
      ...Array.from({ length: 3 }, () => attempt({ confidence: 1, score: 90 })),
    ];
    const s = summarizeTraining(rows);
    expect(s.calibration.highConfidenceLowScore).toBe(3);
    expect(s.calibration.lowConfidenceHighScore).toBe(3);
    expect(s.calibration.insight).toMatch(/confident/);
  });

  it("separates process from outcome", () => {
    const s = summarizeTraining([attempt({ score: 90, result_r: -1 }), attempt({ score: 50, result_r: 3 }), attempt({ score: 90, result_r: 2 })]);
    expect(s.goodProcessLosses).toBe(1);
    expect(s.badProcessWins).toBe(1);
  });

  it("leaves placement out of practice figures", () => {
    const s = summarizeTraining([attempt({ mode_id: "placement", score: 10, mistakes: ["FORCED_SETUP"] }), attempt({ score: 80 })]);
    expect(s.total).toBe(1);
    expect(s.topMistake).toBeNull();
  });
});

describe("weakness selection", () => {
  const meta = (id: string, difficulty: 1 | 2 | 3, skills: Partial<Record<SkillId, number>>, modes: ScenarioMeta["modes"] = ["simulator", "build_your_bias"]): ScenarioMeta => ({
    id, title: id, difficulty, type: "valid_setup", instrument: "x", seeded: true, skills, tags: [], modes, noTrade: false, session: "ny_am",
  });
  const catalog = [
    meta("a", 1, { htf_bias: 0.9 }),
    meta("b", 2, { htf_bias: 0.9, liquidity: 0.6 }),
    meta("c", 3, { htf_bias: 0.7 }),
    meta("d", 2, { liquidity: 0.9 }),
    meta("e", 2, { execution: 0.9 }, ["simulator", "htf_to_ltf"]),
  ];
  const vector = computeSkillVector(evidence({ ...all(0.85), htf_bias: 0.4, liquidity: 0.6, execution: 0.7 }, 12));

  it("picks for the weakest skill first, at a difficulty that matches how it is going", () => {
    expect(targetDifficulty(0.3)).toBe(1);
    expect(targetDifficulty(0.55)).toBe(2);
    expect(targetDifficulty(0.8)).toBe(3);
    const picks = pickWeaknessScenarios({ vector, attempts: [], catalog, count: 1 });
    expect(picks[0].skill).toBe("htf_bias");
    expect(picks[0].scenario.id).toBe("a");
    expect(picks[0].mode).toBe("build_your_bias");
  });

  it("avoids what was done recently and is deterministic", () => {
    const attempts = [{ scenario_id: "a", created_at: "2026-02-01T00:00:00Z" }];
    const a = pickWeaknessScenarios({ vector, attempts, catalog, count: 3 });
    const b = pickWeaknessScenarios({ vector, attempts, catalog, count: 3 });
    expect(a).toEqual(b);
    expect(a.find((p) => p.skill === "htf_bias")?.scenario.id).not.toBe("a");
  });

  it("falls back to the oldest when everything has been done recently", () => {
    const attempts = [
      { scenario_id: "a", created_at: "2026-02-01T00:00:00Z" },
      { scenario_id: "b", created_at: "2026-02-02T00:00:00Z" },
      { scenario_id: "c", created_at: "2026-02-03T00:00:00Z" },
    ];
    const picks = pickWeaknessScenarios({ vector, attempts, catalog, count: 1, skill: "htf_bias" });
    expect(picks[0].scenario.id).toBe("a");
  });

  it("can be restricted to one skill and spreads across skills otherwise", () => {
    expect(pickWeaknessScenarios({ vector, attempts: [], catalog, count: 3, skill: "liquidity" }).every((p) => p.skill === "liquidity")).toBe(true);
    const spread = pickWeaknessScenarios({ vector, attempts: [], catalog, count: 3 });
    expect(new Set(spread.map((p) => p.skill)).size).toBeGreaterThan(1);
    expect(new Set(spread.map((p) => p.scenario.id)).size).toBe(spread.length);
  });

  it("lists the most recent distinct scenarios", () => {
    expect(recentScenarioIds([
      { scenario_id: "a", created_at: "1" }, { scenario_id: "b", created_at: "2" }, { scenario_id: "a", created_at: "3" },
    ], 5)).toEqual(["a", "b"]);
  });
});

describe("smarter rotation", () => {
  const meta = (id: string, difficulty: 1 | 2 | 3, skills: Partial<Record<SkillId, number>>, over: Partial<ScenarioMeta> = {}): ScenarioMeta => ({
    id, title: id, difficulty, type: "valid_setup", instrument: "x", seeded: true, skills, tags: [], modes: ["simulator", "htf_to_ltf", "confluence", "setup_or_trap"], noTrade: false, session: "ny_am", ...over,
  });
  const vector = computeSkillVector(evidence({ ...all(0.8), confluence: 0.4 }, 12));
  const row = (over: Partial<StoredScenarioAttempt>) => attempt(over);

  it("names a recurring mistake's skill as the one to train, and says why", () => {
    const attempts = [row({ mistakes: ["AGAINST_HTF_BIAS"] }), row({ mistakes: ["AGAINST_HTF_BIAS"] })];
    const needs = skillNeeds(computeSkillVector(evidence({ ...all(0.6) }, 12)), attempts);
    expect(needs[0].skill).toBe("htf_bias");
    expect(needs[0].why.join(" ")).toMatch(/recently/);
  });

  it("brings back a scenario answered badly once it is out of the recent window", () => {
    const catalog = [meta("bad", 2, { confluence: 0.9 }), meta("ok", 2, { confluence: 0.9 }), ...Array.from({ length: 6 }, (_, i) => meta(`fill${i}`, 2, { execution: 0.9 }))];
    const attempts = [
      row({ scenario_id: "bad", score: 30 }),
      row({ scenario_id: "ok", score: 90 }),
      ...Array.from({ length: 6 }, (_, i) => row({ scenario_id: `fill${i}`, score: 80 })),
    ];
    const picks = pickWeaknessScenarios({ vector, attempts, catalog, count: 1, skill: "confluence" });
    expect(picks[0].scenario.id).toBe("bad");
    expect(picks[0].reason).toMatch(/last time/);
  });

  it("leans to no-trade charts when the learner takes trades that aren't there", () => {
    const catalog = [meta("trade", 2, { confluence: 0.9 }), meta("flat", 2, { confluence: 0.9 }, { noTrade: true, type: "no_trade" })];
    const attempts = [1, 2, 3].map(() => row({ scenario_id: "x", no_trade_scenario: true, decision: "long" }));
    expect(tendencies(attempts).takesTooMany).toBe(true);
    const picks = pickWeaknessScenarios({ vector, attempts, catalog, count: 1, skill: "confluence" });
    expect(picks[0].scenario.id).toBe("flat");
  });

  it("does not jump past the next difficulty step", () => {
    const attempts = [row({ difficulty: 2, score: 80 }), row({ difficulty: 2, score: 80 }), row({ difficulty: 2, score: 80 })];
    expect(difficultyCeiling(attempts)).toBe(3);
    const weak = [row({ difficulty: 2, score: 40 }), row({ difficulty: 2, score: 40 }), row({ difficulty: 2, score: 40 })];
    expect(difficultyCeiling(weak)).toBe(2);
    expect(difficultyCeiling([])).toBe(3);
  });

  it("honors exclusions, filters and mode limits", () => {
    const catalog = [meta("a", 2, { confluence: 0.9 }), meta("b", 2, { confluence: 0.8 }), meta("c", 2, { confluence: 0.7 })];
    const picks = pickWeaknessScenarios({ vector, attempts: [], catalog, count: 3, skill: "confluence", exclude: ["a"], filter: (m) => m.id !== "c", modes: ["setup_or_trap"] });
    expect(picks.map((p) => p.scenario.id)).toEqual(["b"]);
    expect(picks[0].mode).toBe("setup_or_trap");
  });
});
