// The row written for each finished scenario attempt. Built on the server
// from the graded result (like src/lib/attempt-rows.ts), so what is recorded
// can't be forged by the browser, and pure so it can be tested without a
// database. Process score and R are stored apart: the score never sees R.

import type { AttemptResponse, AttemptResult, Confidence5, Decision, DimensionResult, MistakeId, ModeId, ScenarioType, SkillEvidence, StageResponse } from "@/lib/engine/types";
import type { Verdict3 } from "@/lib/verdict";

export type ScenarioAttemptRow = {
  scenario_id: string;
  mode_id: ModeId;
  session_id: string | null;
  difficulty: 1 | 2 | 3;
  scenario_type: ScenarioType;
  /** Process score, 0-100. Never derived from the trade result. */
  score: number;
  verdict: Verdict3;
  decision: Decision | null;
  /** The scenario had no defensible trade. */
  no_trade_scenario: boolean;
  /** Null unless the scenario was a no-trade scenario. */
  correct_avoidance: boolean | null;
  /** 1-5, asked on advanced submissions; null when skipped. */
  confidence: Confidence5 | null;
  outcome: "no_order" | "unfilled" | "stop" | "target" | "scenario_end";
  /** Result in R when a trade closed; null otherwise. */
  result_r: number | null;
  mae_r: number | null;
  mfe_r: number | null;
  mistakes: MistakeId[];
  dimensions: Pick<DimensionResult, "dimension" | "applicable" | "score">[];
  skill_evidence: SkillEvidence[];
  /** The full response, so a journal entry reopens the completed review. */
  response: AttemptResponse;
  response_time_ms: number;
  attempt_number: number;
};

export type StoredScenarioAttempt = ScenarioAttemptRow & {
  id: string;
  created_at: string;
  /** "device" when it could only be kept on this device. */
  source: "account" | "device";
};

function decisionOf(stages: Record<string, StageResponse>): Decision | null {
  for (const r of Object.values(stages)) {
    if (r.kind === "trade" || r.kind === "replay") return r.decision;
    if (r.kind === "choice" && (r.value === "long" || r.value === "short" || r.value === "wait" || r.value === "no_trade")) return r.value;
    if (r.kind === "choice" && r.value === "take") return "long";
    if (r.kind === "choice" && r.value === "skip") return "no_trade";
  }
  return null;
}

export function buildScenarioAttemptRow(
  meta: { id: string; difficulty: 1 | 2 | 3; type: ScenarioType },
  response: AttemptResponse,
  result: AttemptResult,
  extra: { sessionId?: string | null; attemptNumber?: number } = {},
): ScenarioAttemptRow {
  const o = result.outcome;
  return {
    scenario_id: meta.id,
    mode_id: response.modeId,
    session_id: extra.sessionId ?? null,
    difficulty: meta.difficulty,
    scenario_type: meta.type,
    score: result.score,
    verdict: result.verdict,
    decision: decisionOf(response.stages),
    no_trade_scenario: result.noTradeScenario,
    correct_avoidance: result.correctAvoidance,
    confidence: response.confidence,
    outcome: o.status === "closed" ? o.exit : o.status === "unfilled" ? "unfilled" : "no_order",
    result_r: o.status === "closed" ? Math.round(o.resultR * 1000) / 1000 : null,
    mae_r: o.status === "closed" ? Math.round(o.maeR * 1000) / 1000 : null,
    mfe_r: o.status === "closed" ? Math.round(o.mfeR * 1000) / 1000 : null,
    mistakes: result.mistakes,
    dimensions: result.dimensions.map((d) => ({ dimension: d.dimension, applicable: d.applicable, score: d.score })),
    skill_evidence: result.skillEvidence,
    response,
    response_time_ms: response.responseTimeMs,
    attempt_number: Math.max(1, extra.attemptNumber ?? 1),
  };
}
