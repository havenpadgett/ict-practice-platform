// Scenario rotation, deterministic and explainable, no AI. Two steps:
//
//   1. Which skills need work. Each measured skill gets a "need": how far it
//      is from strong, plus nudges from what the history shows: a mistake that
//      keeps recurring and belongs to that skill, confidence that outruns
//      accuracy, a skill not practised lately.
//   2. Which scenario trains it. Each candidate is scored on how much it
//      exercises the skill, how close its difficulty is to what the learner is
//      ready for (rising one step at a time), whether it is new or was
//      answered badly last time, whether it fits the learner's tendency to
//      take trades that aren't there (or skip ones that are), and a
//      penalty for repeating what was just done.
//
// Every factor that moved a pick is named in the pick, so the "why" shown to
// the learner is the actual reason. The same inputs always give the same
// picks; variety comes from the history, never from chance.

import type { ScenarioMeta } from "@/lib/engine/store";
import { measuredSkills, type SkillVector } from "@/lib/engine/skills";
import { MODES } from "@/lib/engine/modes";
import { MISTAKE_LABEL } from "@/lib/engine/review";
import { SKILL_LABEL, type MistakeId, type ModeId, type SkillId } from "@/lib/engine/types";

export type WeaknessPick = { skill: SkillId; scenario: ScenarioMeta; mode: ModeId; reason: string; factors: string[] };

/** What the rotation reads from an attempt. Only scenario_id and created_at
 * are required; every other signal is used when present. */
export type Seen = {
  scenario_id: string;
  created_at: string;
  mode_id?: string;
  score?: number;
  difficulty?: number;
  decision?: string | null;
  no_trade_scenario?: boolean;
  correct_avoidance?: boolean | null;
  confidence?: number | null;
  mistakes?: MistakeId[];
  skill_evidence?: { skill: SkillId; score: number; weight: number }[];
};

/** Modes best suited to train a skill, in order of preference. */
export const MODES_FOR_SKILL: Record<SkillId, ModeId[]> = {
  htf_bias: ["build_your_bias", "htf_to_ltf", "simulator"],
  liquidity: ["build_your_bias", "what_next", "find_everything", "simulator"],
  concept_recognition: ["false_positive", "find_everything"],
  market_structure: ["find_everything", "what_next", "false_positive", "simulator"],
  entry_models: ["htf_to_ltf", "simulator", "blind_chart"],
  confluence: ["confluence", "setup_or_trap", "false_positive"],
  execution: ["simulator", "htf_to_ltf", "setup_or_trap", "blind_chart"],
};

/** The skill a recurring mistake points at. */
export const MISTAKE_SKILL: Record<MistakeId, SkillId> = {
  PREMATURE_ENTRY: "confluence",
  NO_CONFIRMATION: "confluence",
  FORCED_SETUP: "confluence",
  AGAINST_HTF_BIAS: "htf_bias",
  IGNORED_OPPOSING_HTF: "htf_bias",
  WRONG_DRAW: "liquidity",
  INTERNAL_EXTERNAL_CONFUSION: "liquidity",
  STOP_TOO_TIGHT: "execution",
  CHASED_DISPLACEMENT: "entry_models",
};

/** Tunable weights, in one place. */
export const ROTATION = {
  /** Attempts looked at for "recurring" mistakes and tendencies. */
  recentAttempts: 12,
  /** A mistake counts as recurring from this many occurrences in that window. */
  recurringFrom: 2,
  mistakeNeed: 0.12,
  overconfidentNeed: 0.1,
  staleNeed: 0.08,
  /** Days without evidence before a skill counts as stale. */
  staleDays: 7,
  skillFit: 2,
  difficultyMiss: 1.5,
  newToYou: 1.2,
  retryBad: 1.0,
  retryBelow: 60,
  repeatPenalty: 0.6,
  sameTypePenalty: 0.8,
  tendency: 0.9,
  /** Minimum tradeable/no-trade attempts before a tendency is acted on. */
  tendencyMin: 3,
};

/** The difficulty a skill's score calls for, before the progression cap. */
export function targetDifficulty(score: number): 1 | 2 | 3 {
  return score < 0.45 ? 1 : score < 0.7 ? 2 : 3;
}

/** The scenarios attempted most recently, newest first, distinct. */
export function recentScenarioIds(attempts: Pick<Seen, "scenario_id" | "created_at">[], window: number): string[] {
  const out: string[] = [];
  for (const a of [...attempts].sort((x, y) => y.created_at.localeCompare(x.created_at))) {
    if (!out.includes(a.scenario_id)) out.push(a.scenario_id);
    if (out.length >= window) break;
  }
  return out;
}

const practice = (attempts: Seen[]) => attempts.filter((a) => a.mode_id !== "placement");
const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

/** One step above the hardest difficulty the learner has handled (two
 * attempts averaging 65+); without practice history there is no cap. */
export function difficultyCeiling(attempts: Seen[]): 1 | 2 | 3 {
  const rows = practice(attempts).filter((a) => typeof a.difficulty === "number" && typeof a.score === "number");
  if (rows.length < 3) return 3;
  let handled = 0;
  for (const d of [1, 2, 3] as const) {
    const at = rows.filter((a) => a.difficulty === d);
    if (at.length >= 2 && (mean(at.map((a) => a.score as number)) as number) >= 65) handled = d;
  }
  if (handled === 0) return Math.min(...rows.map((a) => a.difficulty as number)) as 1 | 2 | 3;
  return Math.min(3, handled + 1) as 1 | 2 | 3;
}

export type SkillNeed = { skill: SkillId; need: number; why: string[] };

/** The skills ranked by need, strongest need first, with the reasons. */
export function skillNeeds(vector: SkillVector, attempts: Seen[], now?: string): SkillNeed[] {
  const recent = practice(attempts).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, ROTATION.recentAttempts);
  const mistakeCounts = new Map<SkillId, { n: number; id: MistakeId }>();
  const perMistake = new Map<MistakeId, number>();
  for (const a of recent) for (const m of a.mistakes ?? []) perMistake.set(m, (perMistake.get(m) ?? 0) + 1);
  for (const [id, n] of perMistake) {
    if (n < ROTATION.recurringFrom) continue;
    const skill = MISTAKE_SKILL[id];
    const cur = mistakeCounts.get(skill);
    if (!cur || n > cur.n) mistakeCounts.set(skill, { n, id });
  }
  const lastEvidence = new Map<SkillId, string>();
  for (const a of practice(attempts)) for (const e of a.skill_evidence ?? []) if ((lastEvidence.get(e.skill) ?? "") < a.created_at) lastEvidence.set(e.skill, a.created_at);
  const newest = now ?? practice(attempts).map((a) => a.created_at).sort().pop() ?? null;

  return measuredSkills(vector)
    .map((skill): SkillNeed => {
      const score = vector[skill].score as number;
      let need = 1 - score;
      const why: string[] = [`${SKILL_LABEL[skill]} is at ${Math.round(score * 100)}%`];
      const mk = mistakeCounts.get(skill);
      if (mk) {
        need += ROTATION.mistakeNeed;
        why.push(`${MISTAKE_LABEL[mk.id].toLowerCase()} came up ${mk.n} times recently`);
      }
      // Confidence outrunning the result on attempts that exercised the skill.
      const rated = recent.filter((a) => typeof a.confidence === "number" && typeof a.score === "number" && (a.skill_evidence ?? []).some((e) => e.skill === skill));
      const over = rated.filter((a) => (a.confidence as number) >= 4 && (a.score as number) < 55).length;
      if (over >= ROTATION.recurringFrom) {
        need += ROTATION.overconfidentNeed;
        why.push(`you were confident and wrong ${over} times`);
      }
      const last = lastEvidence.get(skill);
      if (last && newest && Date.parse(newest) - Date.parse(last) > ROTATION.staleDays * 86400000) {
        need += ROTATION.staleNeed;
        why.push("not practised in over a week");
      }
      return { skill, need, why };
    })
    .sort((a, b) => b.need - a.need || a.skill.localeCompare(b.skill));
}

export type Tendencies = { takesTooMany: boolean; skipsTooMany: boolean };

/** Whether the learner takes trades on charts with none, or skips real ones. */
export function tendencies(attempts: Seen[]): Tendencies {
  const rows = practice(attempts).filter((a) => a.mode_id !== "false_positive" && a.mode_id !== "find_everything");
  const noTrade = rows.filter((a) => a.no_trade_scenario);
  const traded = noTrade.filter((a) => a.decision === "long" || a.decision === "short").length;
  const valid = rows.filter((a) => a.no_trade_scenario === false && a.decision);
  const skipped = valid.filter((a) => a.decision === "no_trade" || a.decision === "wait").length;
  return {
    takesTooMany: noTrade.length >= ROTATION.tendencyMin && traded / noTrade.length >= 0.4,
    skipsTooMany: valid.length >= ROTATION.tendencyMin && skipped / valid.length >= 0.5,
  };
}

export function pickWeaknessScenarios(args: {
  vector: SkillVector;
  attempts: Seen[];
  catalog: ScenarioMeta[];
  /** How many scenarios to return. */
  count?: number;
  /** Restrict to one skill ("Train HTF Bias"). */
  skill?: SkillId;
  /** Restrict to a set of skills (a review slot). A skill not measured yet is
   * still eligible, since practising it is how it gets measured. */
  skills?: SkillId[];
  /** How many recent scenarios to avoid. */
  recentWindow?: number;
  /** Scenario ids that must not be picked (already in this session). */
  exclude?: string[];
  /** Narrows the pool (a preset, a setup, a no-trade-only drill). */
  filter?: (m: ScenarioMeta) => boolean;
  /** Restricts the modes a pick may use. */
  modes?: ModeId[];
}): WeaknessPick[] {
  const { vector, attempts, count = 3, recentWindow = 6 } = args;
  const catalog = args.filter ? args.catalog.filter(args.filter) : args.catalog;
  const needs = skillNeeds(vector, attempts);
  const unmeasured = (skill: SkillId): SkillNeed => ({ skill, need: 0.5, why: [`${SKILL_LABEL[skill]} isn't measured yet`] });
  const ranked: SkillNeed[] = args.skill
    ? [needs.find((n) => n.skill === args.skill) ?? { skill: args.skill, need: 0, why: [`${SKILL_LABEL[args.skill]} is the skill you chose`] }]
    : args.skills
      ? args.skills.map((s) => needs.find((n) => n.skill === s) ?? unmeasured(s)).sort((a, b) => b.need - a.need || a.skill.localeCompare(b.skill)).slice(0, 3)
      : needs.slice(0, 3);
  if (ranked.length === 0) return [];

  const done = practice(attempts);
  const recent = new Set(recentScenarioIds(done, recentWindow));
  const lastSeen = new Map<string, Seen>();
  const timesSeen = new Map<string, number>();
  for (const a of done) {
    timesSeen.set(a.scenario_id, (timesSeen.get(a.scenario_id) ?? 0) + 1);
    const prev = lastSeen.get(a.scenario_id);
    if (!prev || prev.created_at < a.created_at) lastSeen.set(a.scenario_id, a);
  }
  const ceiling = difficultyCeiling(attempts);
  const tend = tendencies(attempts);

  const picks: WeaknessPick[] = [];
  const used = new Set<string>(args.exclude ?? []);
  const usedTypes = new Set<string>();

  for (let round = 0; picks.length < count && round < count; round++) {
    for (const sk of ranked) {
      if (picks.length >= count) break;
      const skillScore = vector[sk.skill].score ?? 0.5;
      const target = Math.min(targetDifficulty(skillScore), ceiling);
      const modesFor = (m: ScenarioMeta) => m.modes.filter((x) => !args.modes || args.modes.includes(x));
      const pool = catalog.filter((m) => (m.skills[sk.skill] ?? 0) >= 0.4 && !used.has(m.id) && modesFor(m).length > 0);
      if (pool.length === 0) continue;

      const scored = pool.map((m) => {
        const factors: string[] = [];
        let score = (m.skills[sk.skill] ?? 0) * ROTATION.skillFit;
        const miss = Math.abs(m.difficulty - target);
        score -= miss * ROTATION.difficultyMiss;
        if (miss === 0) factors.push(m.difficulty === 3 ? "advanced difficulty, matching how you are doing" : m.difficulty === 2 ? "intermediate difficulty, matching how you are doing" : "foundation difficulty, matching how you are doing");
        const seen = lastSeen.get(m.id);
        if (!seen) {
          score += ROTATION.newToYou;
          factors.push("new to you");
        } else {
          if (typeof seen.score === "number" && seen.score < ROTATION.retryBelow) {
            score += ROTATION.retryBad;
            factors.push(`you scored ${Math.round(seen.score)} on it last time`);
          }
          score -= (timesSeen.get(m.id) ?? 0) * ROTATION.repeatPenalty;
        }
        if (recent.has(m.id)) score -= 5;
        if (usedTypes.has(m.type)) score -= ROTATION.sameTypePenalty;
        if (tend.takesTooMany && m.noTrade) {
          score += ROTATION.tendency;
          factors.push("a chart with no trade: you tend to take trades that aren't there");
        } else if (tend.skipsTooMany && !m.noTrade && (m.skills.execution ?? 0) >= 0.4) {
          score += ROTATION.tendency;
          factors.push("a valid setup: you tend to skip real ones");
        }
        return { m, score, factors };
      });
      scored.sort((a, b) => b.score - a.score || (lastSeen.get(a.m.id)?.created_at ?? "").localeCompare(lastSeen.get(b.m.id)?.created_at ?? "") || a.m.id.localeCompare(b.m.id));
      const best = scored[0];
      const scenario = best.m;
      const mode = MODES_FOR_SKILL[sk.skill].find((x) => scenario.modes.includes(x) && MODES[x].trains.includes(sk.skill) && (!args.modes || args.modes.includes(x))) ?? modesFor(scenario)[0];
      used.add(scenario.id);
      usedTypes.add(scenario.type);
      const factors = [...sk.why, ...best.factors];
      picks.push({
        skill: sk.skill,
        scenario,
        mode,
        factors,
        reason: `${factors[0]}${factors.length > 1 ? `; ${factors.slice(1).join("; ")}` : ""}.`,
      });
    }
  }
  return picks;
}
