// Shared by the skill tree and the setup library: a mastery figure is a
// shrunk average of process scores, never shown as a percentage on too few
// attempts (the app-wide sample-size rule, MIN_ATTEMPTS_FOR_ACCURACY).

import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import type { ScenarioMeta } from "@/lib/engine/store";
import { MIN_ATTEMPTS_FOR_ACCURACY } from "@/lib/practice-modes";
import type { Dimension } from "@/lib/engine/types";

export const MASTERY_MIN = Math.min(3, MIN_ATTEMPTS_FOR_ACCURACY);
const PRIOR = 0.5;
const PRIOR_WEIGHT = 1;

export type Mastery = {
  /** 0-1, or null below MASTERY_MIN items. */
  score: number | null;
  items: number;
};

export function masteryFrom(scores: number[]): Mastery {
  const n = scores.length;
  if (n < MASTERY_MIN) return { score: null, items: n };
  return { score: (scores.reduce((a, b) => a + b, 0) + PRIOR * PRIOR_WEIGHT) / (n + PRIOR_WEIGHT), items: n };
}

/** Attempts (practice only, newest last) on scenarios matching `match`. */
export function attemptsOn(attempts: StoredScenarioAttempt[], catalog: ScenarioMeta[], match: (m: ScenarioMeta) => boolean): StoredScenarioAttempt[] {
  const ids = new Set(catalog.filter(match).map((m) => m.id));
  return attempts.filter((a) => a.mode_id !== "placement" && ids.has(a.scenario_id));
}

/** One score per attempt: the mean of the given dimensions where they apply,
 * or the whole process score when no dimension is named. Attempts the
 * dimension never applied to are skipped. */
export function scoresFor(attempts: StoredScenarioAttempt[], dimensions: Dimension[]): number[] {
  const out: number[] = [];
  for (const a of attempts) {
    if (dimensions.length === 0) {
      out.push(a.score / 100);
      continue;
    }
    const hit = (a.dimensions ?? []).filter((d) => d.applicable && dimensions.includes(d.dimension));
    if (hit.length > 0) out.push(hit.reduce((s, d) => s + d.score, 0) / hit.length / 100);
  }
  return out;
}

/** The scenario to practise next from a list: not attempted yet if any, else
 * the one attempted longest ago. Stable by id. */
export function pickLeastRecent(pool: ScenarioMeta[], attempts: StoredScenarioAttempt[]): ScenarioMeta | null {
  if (pool.length === 0) return null;
  const last = new Map<string, string>();
  for (const a of attempts) if ((last.get(a.scenario_id) ?? "") < a.created_at) last.set(a.scenario_id, a.created_at);
  return [...pool].sort((x, y) => (last.get(x.id) ?? "").localeCompare(last.get(y.id) ?? "") || x.id.localeCompare(y.id))[0];
}
