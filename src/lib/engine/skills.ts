// The skill vector: seven separate estimates, never one score. Built from the
// evidence every scenario attempt and placement task produces (each applicable
// process dimension is evidence for the skills it implies, src/lib/engine/
// config.ts), weighted toward recent attempts and shrunk toward a prior so a
// couple of answers can't make a skill look strong or weak. Pure, so the
// dashboard, the weakness trainer and the tests all read it the same way.

import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import {
  CLASSIFICATION_LABEL,
  ESTIMATE,
  SKILL_GROUPS,
  STRONG_FROM,
  THRESHOLDS,
  WEAK_BELOW,
  type Classification,
} from "@/lib/engine/skill-config";
import { SKILLS, SKILL_LABEL, type SkillId } from "@/lib/engine/types";

export type EvidenceItem = { skill: SkillId; score: number; weight: number; at: string; source: "practice" | "placement" };

export type SkillReading = {
  /** 0-1, or null when too little evidence to say. */
  score: number | null;
  /** Total evidence weight behind it. */
  effective: number;
  measured: boolean;
  /** Evidence items behind it. */
  items: number;
  /** Recent average minus the earlier one, or null with too few items. */
  trend: number | null;
};

export type SkillVector = Record<SkillId, SkillReading>;

const isPlacement = (a: StoredScenarioAttempt) => a.mode_id === "placement";
const skillTestOf = (sessionId: string | null): string | null => {
  const m = /^placement-skill:([a-z_]+):/.exec(sessionId ?? "");
  return m ? m[1] : null;
};

/** The placement attempts that still count: only the latest full placement
 * (retaking it replaces the old one), plus the latest test-out per skill. */
export function currentPlacement(attempts: StoredScenarioAttempt[]): StoredScenarioAttempt[] {
  const placements = attempts.filter(isPlacement);
  const full = placements.filter((a) => skillTestOf(a.session_id) === null);
  const latestFull = [...full].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.session_id ?? null;
  const keep = full.filter((a) => a.session_id === latestFull);
  const bySkill = new Map<string, StoredScenarioAttempt[]>();
  for (const a of placements) {
    const skill = skillTestOf(a.session_id);
    if (skill === null) continue;
    bySkill.set(skill, [...(bySkill.get(skill) ?? []), a]);
  }
  for (const list of bySkill.values()) {
    const latest = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].session_id;
    keep.push(...list.filter((a) => a.session_id === latest));
  }
  return keep;
}

/** Evidence from attempts: practice as it happened, placement as above. */
export function evidenceFromAttempts(attempts: StoredScenarioAttempt[]): EvidenceItem[] {
  const placementKeep = new Set(currentPlacement(attempts).map((a) => a.id));
  const out: EvidenceItem[] = [];
  for (const a of attempts) {
    if (isPlacement(a) && !placementKeep.has(a.id)) continue;
    for (const e of a.skill_evidence ?? []) {
      if (e && typeof e.score === "number" && typeof e.weight === "number" && e.weight > 0) {
        out.push({ skill: e.skill, score: e.score, weight: e.weight * (isPlacement(a) ? ESTIMATE.placementWeight : 1), at: a.created_at, source: isPlacement(a) ? "placement" : "practice" });
      }
    }
  }
  return out;
}

export function computeSkillVector(evidence: EvidenceItem[]): SkillVector {
  const vector = {} as SkillVector;
  for (const skill of SKILLS) {
    const items = evidence.filter((e) => e.skill === skill).sort((a, b) => b.at.localeCompare(a.at));
    let weightSum = 0;
    let total = 0;
    items.forEach((e, rank) => {
      const w = e.weight * Math.pow(0.5, rank / ESTIMATE.halfLife);
      weightSum += w;
      total += w * e.score;
    });
    const effective = weightSum;
    const score = (total + ESTIMATE.prior * ESTIMATE.priorWeight) / (weightSum + ESTIMATE.priorWeight);
    const measured = effective >= ESTIMATE.minEffective;
    let trend: number | null = null;
    if (items.length >= 8) {
      const half = Math.floor(items.length / 2);
      const avg = (xs: EvidenceItem[]) => xs.reduce((s, e) => s + e.score, 0) / xs.length;
      trend = avg(items.slice(0, half)) - avg(items.slice(half));
    }
    vector[skill] = { score: measured ? score : null, effective, measured, items: items.length, trend };
  }
  return vector;
}

export function measuredSkills(vector: SkillVector): SkillId[] {
  return SKILLS.filter((s) => vector[s].measured);
}

const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

export function groupScore(vector: SkillVector, group: keyof typeof SKILL_GROUPS): number | null {
  return mean(SKILL_GROUPS[group].map((s) => vector[s].score).filter((s): s is number => s !== null));
}

export type ClassificationResult = {
  /** Null until enough is measured. */
  level: Classification | null;
  label: string;
  /** What is holding the next level back, in plain words. */
  nextStep: string | null;
  groups: Record<"recognition" | "context" | "execution", number | null>;
};

function meets(vector: SkillVector, level: Exclude<Classification, "foundation">): { ok: boolean; blocker: string | null } {
  const t = THRESHOLDS[level];
  const groups = { recognition: groupScore(vector, "recognition"), context: groupScore(vector, "context"), execution: groupScore(vector, "execution") };
  for (const g of ["recognition", "context", "execution"] as const) {
    const need = t[g];
    if (need <= 0) continue;
    const have = groups[g];
    if (have === null) return { ok: false, blocker: `${g} isn't measured yet` };
    if (have < need) return { ok: false, blocker: `${g} (${Math.round(have * 100)}%, needs ${Math.round(need * 100)}%)` };
  }
  if (t.floor > 0) {
    const gated = level === "intermediate" ? [...SKILL_GROUPS.recognition, ...SKILL_GROUPS.context] : [...SKILL_GROUPS.recognition, ...SKILL_GROUPS.context, ...SKILL_GROUPS.execution];
    const weakest = gated.map((s) => ({ s, v: vector[s].score })).filter((x): x is { s: SkillId; v: number } => x.v !== null).sort((a, b) => a.v - b.v)[0];
    if (weakest && weakest.v < t.floor) return { ok: false, blocker: `${SKILL_LABEL[weakest.s]} (${Math.round(weakest.v * 100)}%, no skill below ${Math.round(t.floor * 100)}%)` };
  }
  return { ok: true, blocker: null };
}

/** The classification, gated step by step: terminology alone reaches
 * Developing; Intermediate needs context; Advanced needs context AND
 * execution, with no weak skill. Never permanent: it is recomputed from the
 * latest evidence every time. */
export function classify(vector: SkillVector): ClassificationResult {
  const groups = { recognition: groupScore(vector, "recognition"), context: groupScore(vector, "context"), execution: groupScore(vector, "execution") };
  if (measuredSkills(vector).length < ESTIMATE.minMeasuredSkills) return { level: null, label: "Not placed yet", nextStep: "Take the placement test, or practise a few scenarios.", groups };

  let level: Classification = "foundation";
  let nextStep: string | null = null;
  for (const next of ["developing", "intermediate", "advanced"] as const) {
    const r = meets(vector, next);
    if (!r.ok) {
      nextStep = `To reach ${CLASSIFICATION_LABEL[next]}: ${r.blocker}.`;
      break;
    }
    level = next;
  }
  return { level, label: CLASSIFICATION_LABEL[level], nextStep, groups };
}

export type Weakness = { skill: SkillId; score: number; label: string };

/** Measured skills from weakest up. */
export function weakestSkills(vector: SkillVector, count = 3): Weakness[] {
  return measuredSkills(vector)
    .map((s) => ({ skill: s, score: vector[s].score as number, label: SKILL_LABEL[s] }))
    .sort((a, b) => a.score - b.score || SKILLS.indexOf(a.skill) - SKILLS.indexOf(b.skill))
    .slice(0, count);
}

export function strongestSkills(vector: SkillVector, count = 3): Weakness[] {
  return measuredSkills(vector)
    .map((s) => ({ skill: s, score: vector[s].score as number, label: SKILL_LABEL[s] }))
    .sort((a, b) => b.score - a.score || SKILLS.indexOf(a.skill) - SKILLS.indexOf(b.skill))
    .slice(0, count);
}

export const isWeak = (score: number | null): boolean => score !== null && score < WEAK_BELOW;
export const isStrong = (score: number | null): boolean => score !== null && score >= STRONG_FROM;

/** The dashboard's lead sentence: names the specific weakness, in the
 * learner's own terms ("Your concepts are strong, but HTF Bias is your
 * weakest area"), never just the overall label. */
export function leadSentence(vector: SkillVector): { text: string; skill: SkillId | null } {
  const weak = weakestSkills(vector, 1)[0];
  if (!weak) return { text: "Not enough yet to name a weakness. A few scenarios will show where you stand.", skill: null };
  const recognition = groupScore(vector, "recognition");
  const conceptsStrong = recognition !== null && recognition >= STRONG_FROM;
  const label = SKILL_LABEL[weak.skill];
  if (weak.score >= STRONG_FROM) return { text: `Everything you've been measured on is strong. ${label} is the lowest, at ${Math.round(weak.score * 100)}%.`, skill: weak.skill };
  const group = (Object.keys(SKILL_GROUPS) as (keyof typeof SKILL_GROUPS)[]).find((g) => SKILL_GROUPS[g].includes(weak.skill));
  if (conceptsStrong && group !== "recognition") return { text: `Your concepts are strong, but ${label} is your weakest area.`, skill: weak.skill };
  return { text: `${label} is your weakest area right now, at ${Math.round(weak.score * 100)}%.`, skill: weak.skill };
}
