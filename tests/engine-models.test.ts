import { describe, expect, it } from "vitest";
import { buildModelSession, ENTRY_MODELS, modelStatus, MODEL_SLOTS } from "@/lib/engine/models";
import { parsePlan, encodePlan } from "@/lib/engine/run";
import { computeSkillVector } from "@/lib/engine/skills";
import { SCENARIO_CATALOG } from "@/lib/engine/store";

describe("entry models", () => {
  const statuses = ENTRY_MODELS.map((m) => modelStatus(m, SCENARIO_CATALOG));

  it("offers the sweep/displacement/FVG model and nothing the library can't back", () => {
    const available = statuses.filter((s) => s.available).map((s) => s.model.id);
    expect(available).toEqual(["sweep-mss-fvg"]);
    for (const s of statuses.filter((x) => !x.available)) expect(s.reason).toBeTruthy();
  });

  it("builds a session from the model's own pool, in the right modes, one scenario per step", () => {
    const s = statuses.find((x) => x.available)!;
    const steps = buildModelSession({ status: s, vector: computeSkillVector([]), attempts: [] });
    expect(steps.length).toBeGreaterThanOrEqual(3);
    const ids = new Set(s.pool.map((m) => m.id));
    expect(steps.every((x) => ids.has(x.scenarioId))).toBe(true);
    expect(new Set(steps.map((x) => x.scenarioId)).size).toBe(steps.length);
    for (const x of steps) {
      const def = MODEL_SLOTS[x.slot as number];
      expect(x.mode).toBe(def.mode);
      if (def.trade !== null) expect(SCENARIO_CATALOG.find((m) => m.id === x.scenarioId)?.noTrade).toBe(!def.trade);
    }
    expect(parsePlan(encodePlan(steps))).toHaveLength(steps.length);
  });
});
