// Server only: loads one scenario's data from the generated registry. The
// registry's dynamic imports are never evaluated in the browser because only
// Server Functions and server code import this file.

import { SCENARIO_LOADERS } from "@/data/sim-scenarios/registry";
import type { Scenario } from "@/lib/engine/types";

const cache = new Map<string, Scenario>();

export async function loadScenario(id: unknown): Promise<Scenario | null> {
  if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(SCENARIO_LOADERS, id)) return null;
  const hit = cache.get(id);
  if (hit) return hit;
  const mod = await SCENARIO_LOADERS[id]();
  const scenario = ((mod as { default?: unknown }).default ?? mod) as Scenario;
  cache.set(id, scenario);
  return scenario;
}
