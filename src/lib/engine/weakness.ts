// Train My Weaknesses, deterministic and without AI: find the weakest
// measured skills, find scenarios that exercise them, skip what was done
// recently, and aim at a difficulty that matches how the skill is going. The
// same inputs always give the same picks; rotation comes from the history
// (a scenario you just did drops out), never from chance.

import type { ScenarioMeta } from "@/lib/engine/store";
import { weakestSkills, type SkillVector } from "@/lib/engine/skills";
import { MODES } from "@/lib/engine/modes";
import { SKILL_LABEL, type ModeId, type SkillId } from "@/lib/engine/types";

export type WeaknessPick = { skill: SkillId; scenario: ScenarioMeta; mode: ModeId; reason: string };

type Seen = { scenario_id: string; created_at: string };

/** Modes best suited to train a skill, in order of preference. */
export const MODES_FOR_SKILL: Record<SkillId, ModeId[]> = {
  htf_bias: ["build_your_bias", "htf_to_ltf", "simulator"],
  liquidity: ["build_your_bias", "find_everything", "simulator"],
  concept_recognition: ["false_positive", "find_everything"],
  market_structure: ["find_everything", "false_positive", "simulator"],
  entry_models: ["htf_to_ltf", "simulator", "blind_chart"],
  confluence: ["confluence", "setup_or_trap", "false_positive"],
  execution: ["simulator", "htf_to_ltf", "setup_or_trap", "blind_chart"],
};

/** The difficulty a skill's score calls for. */
export function targetDifficulty(score: number): 1 | 2 | 3 {
  return score < 0.45 ? 1 : score < 0.7 ? 2 : 3;
}

/** The scenarios attempted most recently, newest first, distinct. */
export function recentScenarioIds(attempts: Seen[], window: number): string[] {
  const out: string[] = [];
  for (const a of [...attempts].sort((x, y) => y.created_at.localeCompare(x.created_at))) {
    if (!out.includes(a.scenario_id)) out.push(a.scenario_id);
    if (out.length >= window) break;
  }
  return out;
}

export function pickWeaknessScenarios(args: {
  vector: SkillVector;
  attempts: Seen[];
  catalog: ScenarioMeta[];
  /** How many scenarios to return. */
  count?: number;
  /** Restrict to one skill ("Train HTF Bias"). */
  skill?: SkillId;
  /** How many recent scenarios to avoid. */
  recentWindow?: number;
}): WeaknessPick[] {
  const { vector, attempts, catalog, count = 3, recentWindow = 6 } = args;
  const skills: SkillId[] = args.skill ? [args.skill] : weakestSkills(vector, 3).map((w) => w.skill);
  if (skills.length === 0) return [];
  const recent = new Set(recentScenarioIds(attempts, recentWindow));
  const lastSeen = new Map<string, string>();
  for (const a of attempts) if ((lastSeen.get(a.scenario_id) ?? "") < a.created_at) lastSeen.set(a.scenario_id, a.created_at);

  const picks: WeaknessPick[] = [];
  const used = new Set<string>();
  // Round robin across the weakest skills so one weakness doesn't take the whole session.
  for (let round = 0; picks.length < count && round < count; round++) {
    for (const skill of skills) {
      if (picks.length >= count) break;
      const score = vector[skill].score ?? 0.5;
      const target = targetDifficulty(score);
      const pool = catalog.filter((m) => (m.skills[skill] ?? 0) >= 0.4 && !used.has(m.id));
      const fresh = pool.filter((m) => !recent.has(m.id));
      const candidates = fresh.length > 0 ? fresh : pool;
      const ranked = [...candidates].sort(
        (a, b) =>
          Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target) ||
          (b.skills[skill] ?? 0) - (a.skills[skill] ?? 0) ||
          (lastSeen.get(a.id) ?? "").localeCompare(lastSeen.get(b.id) ?? "") ||
          a.id.localeCompare(b.id),
      );
      const scenario = ranked[0];
      if (!scenario) continue;
      const mode = MODES_FOR_SKILL[skill].find((m) => scenario.modes.includes(m) && MODES[m].trains.includes(skill)) ?? scenario.modes[0];
      used.add(scenario.id);
      const seen = lastSeen.has(scenario.id);
      picks.push({
        skill,
        scenario,
        mode,
        reason: `${SKILL_LABEL[skill]} is ${vector[skill].score === null ? "unmeasured" : `at ${Math.round((vector[skill].score as number) * 100)}%`}. ${MODES[mode].name} on ${scenario.title}${seen ? "" : ", new to you"}, ${scenario.difficulty === 3 ? "advanced" : scenario.difficulty === 2 ? "intermediate" : "foundation"} difficulty.`,
      });
    }
  }
  return picks;
}
