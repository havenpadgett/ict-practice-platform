import { describe, expect, it } from "vitest";
import { buildPresetRun, MIN_PRESET_POOL, PRESETS, presetStatuses } from "@/lib/engine/presets";
import { computeSkillVector, type EvidenceItem } from "@/lib/engine/skills";
import { SCENARIO_CATALOG } from "@/lib/engine/store";
import { SKILLS } from "@/lib/engine/types";

const empty = computeSkillVector([]);
const measured = computeSkillVector(SKILLS.flatMap((skill) => Array.from({ length: 6 }, (_, i): EvidenceItem => ({ skill, score: skill === "htf_bias" ? 0.3 : 0.8, weight: 0.8, at: `2026-01-01T00:00:0${i}Z`, source: "practice" }))));

describe("replay presets", () => {
  it("shows only presets the library can fill, and the weakness preset only once a skill is measured", () => {
    const s = presetStatuses(SCENARIO_CATALOG, empty);
    for (const x of s.filter((p) => p.available)) expect(x.pool).toBeGreaterThanOrEqual(x.preset.id === "advanced-random" ? 3 : MIN_PRESET_POOL);
    expect(s.find((p) => p.preset.id === "weaknesses")?.available).toBe(false);
    expect(presetStatuses(SCENARIO_CATALOG, measured).find((p) => p.preset.id === "weaknesses")?.available).toBe(true);
    expect(presetStatuses(SCENARIO_CATALOG, measured).filter((p) => p.available).length).toBeGreaterThanOrEqual(5);
    expect(presetStatuses([], measured).every((p) => !p.available)).toBe(true);
  });

  it("every preset resolves to the ordinary Simulator on scenarios that match its filter", () => {
    for (const { preset, available } of presetStatuses(SCENARIO_CATALOG, measured)) {
      if (!available) continue;
      const steps = buildPresetRun({ preset, vector: measured, attempts: [], catalog: SCENARIO_CATALOG, rand: () => 0.5 });
      expect(steps.length, preset.id).toBeGreaterThan(0);
      expect(steps.length).toBeLessThanOrEqual(preset.count);
      expect(new Set(steps.map((s) => s.scenarioId)).size).toBe(steps.length);
      for (const st of steps) {
        expect(st.mode).toBe("simulator");
        const m = SCENARIO_CATALOG.find((c) => c.id === st.scenarioId)!;
        expect(preset.filter(m), `${preset.id}/${st.scenarioId}`).toBe(true);
      }
    }
  });

  it("the weakness preset starts from the weakest skill; random avoids what was just played", () => {
    const w = PRESETS.find((p) => p.id === "weaknesses")!;
    const steps = buildPresetRun({ preset: w, vector: measured, attempts: [], catalog: SCENARIO_CATALOG });
    expect(steps[0].reason).toMatch(/HTF Bias/);
    const r = PRESETS.find((p) => p.id === "advanced-random")!;
    const pool = SCENARIO_CATALOG.filter((m) => m.difficulty === 3).map((m) => m.id);
    const played = pool.slice(0, 6).map((scenario_id, i) => ({ scenario_id, created_at: `2026-02-0${i + 1}T00:00:00Z` }));
    for (const rand of [0, 0.5, 0.99]) {
      const [step] = buildPresetRun({ preset: r, vector: measured, attempts: played, catalog: SCENARIO_CATALOG, rand: () => rand });
      expect(played.some((p) => p.scenario_id === step.scenarioId)).toBe(false);
    }
  });
});
