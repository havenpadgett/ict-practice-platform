// Server only: how each placement task is scored. A task borrows a scenario's
// chart and, where the question isn't the scenario's own, brings its own
// acceptable answers. Scoring runs through the same engine as every mode
// (scoreAttempt), over a derived scenario holding just what the task asks.

import type { StageResponse } from "@/lib/engine/types";
import { PLACEMENT_TASK_WEIGHT } from "@/lib/engine/skill-config";
import { getPlacementTask, type PlacementTask } from "@/lib/engine/placement-tasks";
import { scoreAttempt } from "@/lib/engine/scoring";
import type {
  AcceptableSet,
  AttemptResponse,
  AttemptResult,
  Dimension,
  ModeConfig,
  RefAnnotation,
  RefRole,
  Scenario,
  ScorerId,
  SkillEvidence,
  StageConfig,
} from "@/lib/engine/types";

type Focus = { id: string; role: RefRole; ungroup?: boolean }[];

type Key =
  | { type: "marks"; focus: Focus; scorer: "marks_poi" | "marks_liquidity" }
  | { type: "set"; key: string; set: AcceptableSet; dimension: Dimension }
  | { type: "scenario"; scorer: "bias" | "decision" | "answer_set" | "price_range" | "trade" | "marks_poi"; answerKey?: string; dimension?: Dimension };

const KEYS: Record<string, Key> = {
  p01: { type: "marks", scorer: "marks_poi", focus: [{ id: "fvg-5m", role: "key", ungroup: true }] },
  p02: { type: "marks", scorer: "marks_liquidity", focus: [{ id: "overnight-low", role: "key" }, { id: "pdh", role: "key" }] },
  p03: { type: "marks", scorer: "marks_liquidity", focus: [{ id: "sweep-low", role: "key" }] },
  p04: { type: "set", key: "move", dimension: "annotation_filter", set: { options: [{ value: "drift", credit: 1 }, { value: "displacement", credit: 0 }, { value: "none", credit: 0.2 }], why: "The bounce wicked through the last high but no body closed above it, so it took out nothing: drift, not displacement." } },
  p05: { type: "marks", scorer: "marks_poi", focus: [{ id: "ob-5m", role: "key" }, { id: "fvg-5m", role: "valid" }] },
  p06: { type: "set", key: "swept", dimension: "liquidity_read", set: { options: [{ value: "buy_side", credit: 1 }, { value: "sell_side", credit: 0 }, { value: "nothing", credit: 0.1 }], why: "Price ran above the overnight high and reversed: buy-side liquidity was taken." } },
  p07: { type: "set", key: "shift", dimension: "confirmation", set: { options: [{ value: "no", credit: 1 }, { value: "unclear", credit: 0.35 }, { value: "yes", credit: 0 }], why: "Only a wick went through the last 5m high. A body close is the break; a wick is a probe." } },
  p08: { type: "scenario", scorer: "answer_set", answerKey: "location", dimension: "htf_bias" },
  p09: { type: "scenario", scorer: "marks_poi" },
  p10: { type: "scenario", scorer: "price_range", answerKey: "expected_target", dimension: "target_selection" },
  p11: { type: "scenario", scorer: "bias" },
  p12: { type: "scenario", scorer: "answer_set", answerKey: "take", dimension: "trade_selection" },
  p13: { type: "set", key: "alignment", dimension: "htf_bias", set: { options: [{ value: "conflict", credit: 1 }, { value: "neutral", credit: 0.2 }, { value: "aligned", credit: 0 }], why: "The Daily and 4H are in a downtrend with supply overhead; the 5m long runs against both." } },
  p14: { type: "scenario", scorer: "trade" },
  p15: { type: "scenario", scorer: "decision" },
};

function stageFor(task: PlacementTask, scorer: ScorerId, answerKey?: string, dimension?: Dimension): StageConfig {
  return {
    id: task.id,
    title: task.title,
    prompt: task.prompt,
    timeframes: task.timeframes,
    initialTimeframe: task.initialTimeframe,
    checkpoint: task.checkpoint,
    input: task.input,
    scorer,
    answerKey,
    dimension,
    guidance: "none",
  };
}

function derive(task: PlacementTask, scenario: Scenario): { scenario: Scenario; mode: ModeConfig } {
  const key = KEYS[task.id];
  const ref = scenario.reference;
  let derivedRef = ref;
  let scorer: ScorerId;
  let answerKey: string | undefined;
  let dimension: Dimension | undefined;

  if (!key) throw new Error(`no scoring key for placement task ${task.id}`);
  if (key.type === "marks") {
    const annotations: RefAnnotation[] = key.focus.map((f) => {
      const base = ref.annotations.find((a) => a.id === f.id);
      if (!base) throw new Error(`${task.id}: scenario ${scenario.id} has no reference mark ${f.id}`);
      const copy: RefAnnotation = { ...base, role: f.role, candidate: false };
      if (f.ungroup) delete copy.group;
      return copy;
    });
    derivedRef = { ...ref, annotations };
    scorer = key.scorer;
  } else if (key.type === "set") {
    derivedRef = { ...ref, answers: { ...ref.answers, [key.key]: key.set } };
    scorer = "answer_set";
    answerKey = key.key;
    dimension = key.dimension;
  } else {
    // The scenario's own reference, scored as it scores any such stage (p09:
    // the gap that matters is key and the others are traps or noise).
    scorer = key.scorer;
    answerKey = key.answerKey;
    dimension = key.dimension;
  }
  const stage = stageFor(task, scorer, answerKey, dimension);
  return { scenario: { ...scenario, reference: derivedRef }, mode: { id: "placement", name: "Placement", summary: "", stages: [stage], feedback: "end", asksConfidence: false, trains: [] } };
}

export type PlacementScore = { result: AttemptResult; score: number; evidence: SkillEvidence[]; mode: ModeConfig };

/** Scores one placement task: the process score the engine gives it, and the
 * evidence it adds for the skills the task is meant to measure. */
export function scorePlacementTask(task: PlacementTask, scenario: Scenario, stages: Record<string, StageResponse>): PlacementScore {
  const { scenario: derived, mode } = derive(task, scenario);
  const response: AttemptResponse = { scenarioId: scenario.id, modeId: "placement", stages, confidence: null, responseTimeMs: 0 };
  const result = scoreAttempt(derived, mode, response);
  const weight = PLACEMENT_TASK_WEIGHT[task.kind];
  const evidence: SkillEvidence[] = Object.entries(task.skills).map(([skill, w]) => ({ skill: skill as SkillEvidence["skill"], score: result.score / 100, weight: weight * (w as number) }));
  return { result, score: result.score, evidence, mode };
}

export { getPlacementTask };
