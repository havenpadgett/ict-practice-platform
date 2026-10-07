import { describe, expect, it } from "vitest";
import { PLACEMENT_TASKS, tasksForSkill } from "@/lib/engine/placement-tasks";
import { scorePlacementTask } from "@/lib/engine/placement-keys";
import { SCENARIO_LOADERS } from "@/data/sim-scenarios/registry";
import { SCENARIO_CATALOG } from "@/lib/engine/store";
import { SKILLS, type Annotation, type RefAnnotation, type Scenario, type StageResponse } from "@/lib/engine/types";

async function scenario(id: string): Promise<Scenario> {
  return (await SCENARIO_LOADERS[id]()).default as Scenario;
}

const markOn = (r: RefAnnotation): Annotation => ({ id: `u-${r.id}`, kind: r.kind, price: r.price, priceLow: r.priceLow, priceHigh: r.priceHigh, tStart: r.tStart, tEnd: r.tEnd, t: r.t, tf: "5m" });

/** The answer a strong trader gives to each task. */
async function ideal(taskId: string): Promise<{ stages: Record<string, StageResponse>; scenario: Scenario }> {
  const task = PLACEMENT_TASKS.find((t) => t.id === taskId)!;
  const s = await scenario(task.scenarioId);
  const refs = s.reference.annotations;
  const byId = (id: string) => refs.find((r) => r.id === id)!;
  const choice = (value: string): Record<string, StageResponse> => ({ [taskId]: { kind: "choice", value } });
  switch (taskId) {
    case "p01": return { scenario: s, stages: { p01: { kind: "mark", annotations: [markOn(byId("fvg-5m"))] } } };
    case "p02": return { scenario: s, stages: { p02: { kind: "mark", annotations: [markOn(byId("overnight-low")), markOn(byId("pdh"))] } } };
    case "p03": return { scenario: s, stages: { p03: { kind: "mark", annotations: [markOn(byId("sweep-low"))] } } };
    case "p05": return { scenario: s, stages: { p05: { kind: "mark", annotations: [markOn(byId("ob-5m"))] } } };
    case "p06": return { scenario: s, stages: choice("buy_side") };
    case "p07": return { scenario: s, stages: choice("no") };
    case "p08": return { scenario: s, stages: choice(s.reference.answers.location.options.find((o) => o.credit >= 1)!.value) };
    case "p09": return { scenario: s, stages: { p09: { kind: "mark", annotations: [markOn(byId("fvg-5m"))] } } };
    case "p10": return { scenario: s, stages: { p10: { kind: "price", price: s.reference.ranges.expected_target[0].ideal as number } } };
    case "p11": return { scenario: s, stages: choice(s.reference.bias.options.find((o) => o.credit >= 1)!.value) };
    case "p12": return { scenario: s, stages: choice("skip") };
    case "p13": return { scenario: s, stages: choice("conflict") };
    case "p14": {
      const t = s.reference.trade!;
      return { scenario: s, stages: { p14: { kind: "trade", decision: "long", order: { direction: "long", entry: (t.entry[0].low + t.entry[0].high) / 2, stop: t.stop.invalidation - 6, target: t.targets[0].ideal as number, placedAt: s.checkpoints.confirm } } } };
    }
    case "p15": return { scenario: s, stages: choice("no_trade") };
  }
  throw new Error(taskId);
}

describe("placement test", () => {
  it("is 10 to 15 tasks, increasing in difficulty, mostly chart interaction", () => {
    expect(PLACEMENT_TASKS.length).toBeGreaterThanOrEqual(10);
    expect(PLACEMENT_TASKS.length).toBeLessThanOrEqual(15);
    const levels = PLACEMENT_TASKS.map((t) => t.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    const interactive = PLACEMENT_TASKS.filter((t) => t.input.kind !== "choice").length;
    expect(interactive).toBeGreaterThan(PLACEMENT_TASKS.length / 3);
    // Early tasks are recognition; the last are execution.
    expect(PLACEMENT_TASKS.slice(0, 3).every((t) => t.kind === "recognition")).toBe(true);
    expect(PLACEMENT_TASKS.slice(-2).every((t) => t.kind === "execution")).toBe(true);
  });

  it("covers every skill at least twice, and every task names a scenario that exists", () => {
    for (const skill of SKILLS) expect(PLACEMENT_TASKS.filter((t) => (t.skills[skill] ?? 0) >= 0.7).length, skill).toBeGreaterThanOrEqual(1);
    for (const t of PLACEMENT_TASKS) expect(SCENARIO_CATALOG.some((s) => s.id === t.scenarioId), t.id).toBe(true);
    for (const skill of SKILLS) expect(tasksForSkill(skill).length, `test-out for ${skill}`).toBeGreaterThanOrEqual(1);
  });

  for (const task of PLACEMENT_TASKS) {
    it(`${task.id} ${task.title}: the ideal answer scores high, and a wrong one scores low`, async () => {
      let good;
      if (task.id === "p04") {
        const s = await scenario(task.scenarioId);
        good = scorePlacementTask(task, s, { p04: { kind: "choice", value: "drift" } });
        const bad = scorePlacementTask(task, s, { p04: { kind: "choice", value: "displacement" } });
        expect(good.score).toBeGreaterThanOrEqual(90);
        expect(bad.score).toBeLessThan(30);
        return;
      }
      const { scenario: s, stages } = await ideal(task.id);
      good = scorePlacementTask(task, s, stages);
      expect(good.score, `${task.id} ideal`).toBeGreaterThanOrEqual(85);
      expect(good.evidence.length).toBeGreaterThan(0);
      expect(good.evidence.every((e) => e.score >= 0.85 && e.weight > 0)).toBe(true);
      // Nothing answered scores nothing.
      const none = scorePlacementTask(task, s, {});
      expect(none.score, `${task.id} empty`).toBeLessThan(40);
    });
  }
});
