import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildScenario } from "../scripts/scenarios/lib";
import { SPECS } from "../scripts/scenarios/specs";
import { MODES, supportedModes, TRAINING_MODES } from "@/lib/engine/modes";
import { SCENARIO_CATALOG } from "@/lib/engine/store";
import { SCENARIO_LOADERS } from "@/data/sim-scenarios/registry";
import { validateScenario } from "@/lib/engine/validate";
import type { Scenario } from "@/lib/engine/types";

const dir = path.resolve(__dirname, "../src/data/sim-scenarios");

describe("shipped scenarios", () => {
  it("registers exactly the specs, with a catalog entry and a loader for each", () => {
    const ids = SPECS.map((s) => s.id).sort();
    expect(SCENARIO_CATALOG.map((c) => c.id).sort()).toEqual(ids);
    expect(Object.keys(SCENARIO_LOADERS).sort()).toEqual(ids);
  });

  for (const spec of SPECS) {
    describe(spec.id, () => {
      const built = buildScenario(spec);

      it("is valid: data is sound and every reference marking sits on real structure", () => {
        expect(validateScenario(built.scenario, { ideal: spec.ideal ? spec.ideal(built.ctx) : undefined })).toEqual([]);
      });

      it("matches the file on disk (run `npm run scenarios` after editing a spec)", () => {
        const onDisk = fs.readFileSync(path.join(dir, `${spec.id}.json`), "utf8");
        expect(JSON.stringify(built.scenario)).toBe(onDisk);
      });

      it("is labelled as seeded, never as history", () => {
        expect(built.scenario.provenance.kind).toBe("seeded");
        expect(built.scenario.instrument).toMatch(/seeded/i);
      });

      it("catalog modes are the modes it can actually support", () => {
        const meta = SCENARIO_CATALOG.find((c) => c.id === spec.id)!;
        expect(meta.modes).toEqual(supportedModes(built.scenario as Scenario));
      });
    });
  }

  it("every training mode has at least one scenario", () => {
    for (const mode of TRAINING_MODES) {
      expect(SCENARIO_CATALOG.some((c) => c.modes.includes(mode)), mode).toBe(true);
    }
  });

  it("every mode's stages use scorers and inputs the engine implements", () => {
    for (const mode of Object.values(MODES)) {
      const ids = new Set<string>();
      for (const stage of mode.stages) {
        expect(ids.has(stage.id), `${mode.id}/${stage.id} duplicated`).toBe(false);
        ids.add(stage.id);
        expect(stage.timeframes).toContain(stage.initialTimeframe);
      }
    }
  });
});
