import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deriveNextObjective, OBJECTIVES } from "@/lib/engine/next-objective";
import { MODES, supportedModes } from "@/lib/engine/modes";
import { scoreAttempt } from "@/lib/engine/scoring";
import { SCENARIO_CATALOG } from "@/lib/engine/store";
import type { Scenario } from "@/lib/engine/types";

const load = (id: string) => JSON.parse(fs.readFileSync(path.resolve(__dirname, `../src/data/sim-scenarios/${id}.json`), "utf8")) as Scenario;
const scenarios = SCENARIO_CATALOG.map((m) => load(m.id));

describe("what happens next", () => {
  it("is derived from the candles, identical on every build, and stored with the scenario", () => {
    for (const s of scenarios) {
      const d = deriveNextObjective(s);
      expect(d, s.id).not.toBeNull();
      expect(s.reference.answers.next_objective).toEqual(d!.set);
    }
  });

  it("has exactly one full-credit answer, every objective listed, and cross credit for the matching pool", () => {
    for (const s of scenarios) {
      const set = s.reference.answers.next_objective;
      expect(set.options.map((o) => o.value)).toEqual([...OBJECTIVES]);
      expect(set.options.filter((o) => o.credit >= 1), s.id).toHaveLength(1);
      const credit = Object.fromEntries(set.options.map((o) => [o.value, o.credit]));
      if (credit.pdh >= 1) expect(credit.bsl, s.id).toBeGreaterThan(0);
      if (credit.pdl >= 1) expect(credit.ssl, s.id).toBeGreaterThan(0);
    }
  });

  it("is offered on every scenario, as a one-stage choice scored on the liquidity read", () => {
    expect(SCENARIO_CATALOG.every((m) => m.modes.includes("what_next"))).toBe(true);
    expect(supportedModes(scenarios[0])).toContain("what_next");
    const mode = MODES.what_next;
    expect(mode.stages).toHaveLength(1);
    expect(mode.stages[0].input.kind).toBe("choice");
  });

  it("scores the defensible answers by credit and a wrong one at zero", () => {
    const s = scenarios[0];
    const set = s.reference.answers.next_objective;
    const best = set.options.find((o) => o.credit >= 1)!.value;
    const wrong = set.options.find((o) => o.credit === 0)!.value;
    const grade = (value: string) => scoreAttempt(s, MODES.what_next, { scenarioId: s.id, modeId: "what_next", stages: { objective: { kind: "choice", value } }, confidence: null, responseTimeMs: 1 });
    expect(grade(best).score).toBe(100);
    expect(grade(wrong).score).toBe(0);
    const partial = set.options.find((o) => o.credit > 0 && o.credit < 1);
    if (partial) expect(grade(partial.value).score).toBeGreaterThan(0);
  });

  it("never reads the future when naming the pools in view", () => {
    // Chopping off everything after the chosen candle leaves nothing to answer from.
    const s = scenarios[0];
    expect(deriveNextObjective({ ...s, data: { ...s.data, stream: s.data.stream.slice(0, s.cursorStart + 5) } })).toBeNull();
  });
});
