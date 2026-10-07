"use server";

// Server-side scenario loading, candle reveal and grading for every training
// mode (docs/ENGINE.md). The browser gets a scenario without its reference
// analysis and without candles past the cursor; it asks for more as the
// replay advances, and gets the reference back only with a graded attempt.
// Like the practice actions, each one checks the session and every input.

import { loadScenario } from "@/lib/engine/server-store";
import { getMode, supportedModes } from "@/lib/engine/modes";
import { revealChunk, toPublicScenario } from "@/lib/engine/public";
import { cleanAttemptResponse } from "@/lib/engine/response-validation";
import { scoreAttempt } from "@/lib/engine/scoring";
import { buildScenarioAttemptRow, type ScenarioAttemptRow } from "@/lib/engine/attempt-row";
import type { AttemptResult, ModeConfig, PublicScenario, Scenario } from "@/lib/engine/types";
import { createClient } from "@/lib/supabase/server";

type Failure = { ok: false; error: string };

const NOT_SIGNED_IN: Failure = { ok: false, error: "Your login has expired. Log in again to continue." };
const UNAVAILABLE: Failure = { ok: false, error: "This scenario isn't available any more." };
const BAD_ANSWER: Failure = { ok: false, error: "That answer couldn't be read. Try again." };

async function signedIn(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user !== null;
}

async function scenarioFor(id: unknown, modeId: unknown): Promise<{ scenario: Scenario; mode: ModeConfig } | null> {
  const mode = typeof modeId === "string" ? getMode(modeId) : null;
  const scenario = await loadScenario(id);
  if (!scenario || !mode || mode.stages.length === 0) return null;
  return supportedModes(scenario).includes(mode.id) ? { scenario, mode } : null;
}

/** The scenario as the browser may see it at the start of a mode: data up to
 * the first checkpoint, no reference. */
export async function startScenario(scenarioId: string, modeId: string, upTo?: number): Promise<{ ok: true; scenario: PublicScenario } | Failure> {
  if (!(await signedIn())) return NOT_SIGNED_IN;
  const found = await scenarioFor(scenarioId, modeId);
  if (!found) return UNAVAILABLE;
  const revealed = typeof upTo === "number" && Number.isFinite(upTo) ? upTo : found.scenario.cursorStart;
  return { ok: true, scenario: toPublicScenario(found.scenario, revealed) };
}

/** Further candles of the stream, as the replay advances. */
export async function revealCandles(scenarioId: string, from: number, count: number): Promise<{ ok: true; rows: Scenario["data"]["stream"]; from: number; done: boolean } | Failure> {
  if (!(await signedIn())) return NOT_SIGNED_IN;
  if (typeof from !== "number" || typeof count !== "number" || !Number.isFinite(from) || !Number.isFinite(count)) return BAD_ANSWER;
  const scenario = await loadScenario(scenarioId);
  if (!scenario) return UNAVAILABLE;
  // Never from before the decision moment: what was already shown is not re-sent.
  const chunk = revealChunk(scenario, Math.max(from, scenario.cursorStart), count);
  return { ok: true, ...chunk };
}

export type GradedScenario = {
  ok: true;
  result: AttemptResult;
  /** The whole scenario, reference and every candle: revealed only now. */
  scenario: Scenario;
  row: ScenarioAttemptRow;
};

/** Grades a finished attempt. The result, the full scenario for the review
 * and the row to save all come back together; nothing is revealed earlier. */
export async function gradeScenarioAttempt(response: unknown, ctx?: { sessionId?: string }): Promise<GradedScenario | Failure> {
  if (!(await signedIn())) return NOT_SIGNED_IN;
  const modeId = typeof response === "object" && response !== null ? (response as { modeId?: unknown }).modeId : null;
  const scenarioId = typeof response === "object" && response !== null ? (response as { scenarioId?: unknown }).scenarioId : null;
  const found = await scenarioFor(scenarioId, modeId);
  if (!found) return UNAVAILABLE;
  const clean = cleanAttemptResponse(response, found.mode);
  if (!clean) return BAD_ANSWER;
  let result: AttemptResult;
  try {
    result = scoreAttempt(found.scenario, found.mode, clean);
  } catch (err) {
    return { ok: false, error: `This scenario couldn't be graded (${err instanceof Error ? err.message : "bad data"}).` };
  }
  const row = buildScenarioAttemptRow(found.scenario, clean, result, { sessionId: typeof ctx?.sessionId === "string" ? ctx.sessionId.slice(0, 100) : null });
  return { ok: true, result, scenario: found.scenario, row };
}

/** Re-grades a stored attempt for the review page (a journal entry reopening
 * its completed scenario). Deterministic: the same response gives the same result. */
export async function reviewScenarioAttempt(response: unknown): Promise<Omit<GradedScenario, "row"> | Failure> {
  const graded = await gradeScenarioAttempt(response);
  if (!graded.ok) return graded;
  return { ok: true, result: graded.result, scenario: graded.scenario };
}
