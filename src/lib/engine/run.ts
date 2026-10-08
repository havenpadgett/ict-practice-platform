// A guided run: a short, ordered list of scenarios played back to back
// (the 10-Minute Review, a replay preset, an entry-model session). It is
// not a new quiz engine. Each step is an ordinary scenario in an ordinary
// mode, played by the same runners and graded by the same scorer; a run only
// adds the order, which step is next, and a session id on the saved attempts
// so the summary can find them. The plan travels in the URL, so there is no
// state to lose and nothing for the server to store.

import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import { DIMENSION_LABEL, SKILL_LABEL, SKILLS, type ModeId, type SkillId } from "@/lib/engine/types";
import { isModeId } from "@/lib/engine/modes";
import { MISTAKE_LABEL } from "@/lib/engine/review";
import { scenarioMeta, type ScenarioMeta } from "@/lib/engine/store";
import { computeSkillVector, evidenceFromAttempts } from "@/lib/engine/skills";
import { pickWeaknessScenarios, skillNeeds, type Seen } from "@/lib/engine/weakness";
import type { SkillVector } from "@/lib/engine/skills";

export type RunStep = { scenarioId: string; mode: ModeId; /** What this step is for, shown before and after. */ role: string; reason?: string; /** Index into the run kind's slots, kept in the URL so the role survives. */ slot?: number };
type PlanStep = Pick<RunStep, "scenarioId" | "mode" | "slot">;

export type RunKind = "ten" | "preset" | "model";

const MAX_STEPS = 10;

export function newRunId(kind: RunKind, tag = ""): string {
  return `${kind}${tag ? `-${tag}` : ""}-${Date.now().toString(36)}`;
}

export function runKindOf(run: string): RunKind | null {
  const k = run.split("-")[0];
  return k === "ten" || k === "preset" || k === "model" ? k : null;
}

/** "sim-001.build_your_bias,sim-004.simulator" */
export function encodePlan(steps: PlanStep[]): string {
  return steps.map((s) => `${s.scenarioId}.${s.mode}${s.slot === undefined ? "" : `.${s.slot}`}`).join(",");
}

/** A plan from a URL, dropping anything that isn't a real scenario in a mode
 * it supports. Roles are not in the URL; they are re-derived by the page. */
export function parsePlan(raw: string | null): PlanStep[] {
  if (!raw) return [];
  const out: PlanStep[] = [];
  for (const part of raw.split(",").slice(0, MAX_STEPS)) {
    const [id, mode, slot] = part.split(".");
    const meta = scenarioMeta(id ?? "");
    if (meta && isModeId(mode) && meta.modes.includes(mode)) out.push({ scenarioId: meta.id, mode, slot: slot !== undefined && /^\d$/.test(slot) ? Number(slot) : undefined });
  }
  return out;
}

export const RUN_SESSION_SEP = ":";
export const runSessionId = (run: string, index: number) => `${run}${RUN_SESSION_SEP}${index}`;

export function playHref(step: PlanStep, run: string, plan: string, index: number): string {
  return `/train/play?mode=${step.mode}&scenario=${step.scenarioId}&run=${encodeURIComponent(run)}&plan=${encodeURIComponent(plan)}&i=${index}`;
}

export const doneHref = (run: string, plan: string) => `/train/run?run=${encodeURIComponent(run)}&plan=${encodeURIComponent(plan)}`;

export function stepsHref(steps: RunStep[], run: string): string | null {
  return steps.length === 0 ? null : playHref(steps[0], run, encodePlan(steps), 0);
}

// ---- 10-Minute Review ------------------------------------------------------

/** Slots of the review: what each trains, the skills it draws from, and the
 * modes that suit it. Configuration of the existing mode table, nothing more. */
export const REVIEW_SLOTS: { role: string; count: number; skills: SkillId[]; modes: ModeId[] }[] = [
  { role: "Weak concept", count: 2, skills: ["concept_recognition", "market_structure", "confluence"], modes: ["false_positive", "find_everything", "confluence"] },
  { role: "Chart analysis", count: 2, skills: ["htf_bias", "liquidity"], modes: ["build_your_bias", "htf_to_ltf"] },
  { role: "Execution", count: 1, skills: ["execution", "entry_models"], modes: ["htf_to_ltf", "simulator"] },
];

/** About ten minutes: two quick concept checks, two chart reads, one trade. */
export function buildTenMinuteReview(args: { vector: SkillVector; attempts: Seen[]; catalog: ScenarioMeta[] }): RunStep[] {
  const steps: RunStep[] = [];
  const used: string[] = [];
  for (const [slotIndex, slot] of REVIEW_SLOTS.entries()) {
    // Prefer the slot's modes; fall back to any mode for those skills; then to anything.
    for (const relax of [0, 1, 2]) {
      const need = slot.count - steps.filter((s) => s.role === slot.role).length;
      if (need <= 0) break;
      const picks = pickWeaknessScenarios({
        vector: args.vector,
        attempts: args.attempts,
        catalog: args.catalog,
        count: need,
        skills: relax < 2 ? slot.skills : undefined,
        modes: relax < 1 ? slot.modes : undefined,
        exclude: used,
      });
      for (const p of picks) {
        steps.push({ scenarioId: p.scenario.id, mode: p.mode, role: slot.role, reason: p.reason, slot: slotIndex });
        used.push(p.scenario.id);
      }
    }
  }
  return steps;
}

// ---- Run summary -----------------------------------------------------------

export type RunSummary = {
  steps: { step: RunStep; attempt: StoredScenarioAttempt | null; previousScore: number | null }[];
  completed: number;
  avgScore: number | null;
  /** What got better, only where there is something to compare against. */
  improved: string[];
  /** What was still missed, from this run's attempts. */
  missed: string[];
  next: { skill: SkillId; label: string; why: string } | null;
};

export function summarizeRun(args: { run: string; steps: RunStep[]; attempts: StoredScenarioAttempt[] }): RunSummary {
  const prefix = `${args.run}${RUN_SESSION_SEP}`;
  const inRun = args.attempts.filter((a) => a.session_id?.startsWith(prefix));
  const startedAt = inRun.map((a) => a.created_at).sort()[0] ?? null;
  const before = startedAt ? args.attempts.filter((a) => a.created_at < startedAt && !a.session_id?.startsWith(prefix)) : args.attempts;
  const after = args.attempts;

  const steps = args.steps.map((step, i) => {
    const attempt = inRun.filter((a) => a.session_id === `${prefix}${i}`).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
    const prior = before.filter((a) => a.scenario_id === step.scenarioId && a.mode_id !== "placement").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return { step, attempt, previousScore: prior ? prior.score : null };
  });
  const done = steps.filter((s) => s.attempt);

  const improved: string[] = [];
  for (const s of done) {
    if (s.previousScore !== null && (s.attempt as StoredScenarioAttempt).score - s.previousScore >= 5) {
      improved.push(`${scenarioMeta(s.step.scenarioId)?.title ?? s.step.scenarioId}: ${Math.round(s.previousScore)} → ${Math.round((s.attempt as StoredScenarioAttempt).score)} since you last played it.`);
    }
  }
  if (done.length > 0 && before.length > 0) {
    const vBefore = computeSkillVector(evidenceFromAttempts(before));
    const vAfter = computeSkillVector(evidenceFromAttempts(after));
    for (const sk of SKILLS) {
      const b = vBefore[sk].score;
      const a = vAfter[sk].score;
      if (b !== null && a !== null && a - b >= 0.03) improved.push(`${SKILL_LABEL[sk]} moved from ${Math.round(b * 100)}% to ${Math.round(a * 100)}%.`);
    }
  }

  const missed: string[] = [];
  const mistakeCounts = new Map<string, number>();
  for (const a of inRun) for (const m of a.mistakes) mistakeCounts.set(MISTAKE_LABEL[m], (mistakeCounts.get(MISTAKE_LABEL[m]) ?? 0) + 1);
  for (const [label, n] of [...mistakeCounts].sort((x, y) => y[1] - x[1])) missed.push(n > 1 ? `${label} (${n} times)` : label);
  const lowDims = new Map<string, number>();
  for (const a of inRun) for (const d of a.dimensions) if (d.applicable && d.score < 55) lowDims.set(DIMENSION_LABEL[d.dimension], (lowDims.get(DIMENSION_LABEL[d.dimension]) ?? 0) + 1);
  for (const [label, n] of [...lowDims].sort((x, y) => y[1] - x[1])) missed.push(`${label} scored under 55${n > 1 ? ` in ${n} scenarios` : ""}`);

  const afterVector = computeSkillVector(evidenceFromAttempts(after));
  const need = skillNeeds(afterVector, after)[0];
  return {
    steps,
    completed: done.length,
    avgScore: done.length === 0 ? null : done.reduce((s, d) => s + (d.attempt as StoredScenarioAttempt).score, 0) / done.length,
    improved: improved.slice(0, 4),
    missed: missed.slice(0, 5),
    next: need ? { skill: need.skill, label: SKILL_LABEL[need.skill], why: need.why.join("; ") } : null,
  };
}

/** The role shown for a step re-read from a URL. */
export function roleFor(step: PlanStep, kind: RunKind | null, index: number): string {
  if (kind === "ten" && step.slot !== undefined && REVIEW_SLOTS[step.slot]) return REVIEW_SLOTS[step.slot].role;
  return `Scenario ${index + 1}`;
}
