// Scenario storage: the catalog is small, answer-free metadata the browser
// may import; the data itself is loaded on the server, one scenario at a
// time, from the generated registry (scripts/build-scenarios.ts).

import catalogJson from "@/data/sim-scenarios/catalog.json";
import type { SessionId } from "@/lib/engine/session";
import type { ModeId, ScenarioType, SkillId } from "@/lib/engine/types";

export type ScenarioMeta = {
  id: string;
  title: string;
  difficulty: 1 | 2 | 3;
  type: ScenarioType;
  instrument: string;
  seeded: boolean;
  skills: Partial<Record<SkillId, number>>;
  tags: string[];
  modes: ModeId[];
  noTrade: boolean;
  /** The session the decision moment falls in (ET clock). */
  session: SessionId;
};

export const SCENARIO_CATALOG = catalogJson as unknown as ScenarioMeta[];

const byId = new Map(SCENARIO_CATALOG.map((m) => [m.id, m]));

export function scenarioMeta(id: string): ScenarioMeta | null {
  return byId.get(id) ?? null;
}

export function scenariosForMode(mode: ModeId): ScenarioMeta[] {
  return SCENARIO_CATALOG.filter((m) => m.modes.includes(mode));
}
