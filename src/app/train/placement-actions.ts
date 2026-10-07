"use server";

// Placement tasks: load a task's chart and grade an answer. Nothing is
// revealed per task: the test gives no feedback until it is over, so one
// answer can't inform the next. The server returns the row to save (process
// score and the skill evidence it adds) and nothing about the key.

import { buildScenarioAttemptRow, type ScenarioAttemptRow } from "@/lib/engine/attempt-row";
import { scorePlacementTask } from "@/lib/engine/placement-keys";
import { getPlacementTask } from "@/lib/engine/placement-tasks";
import { toPublicScenario } from "@/lib/engine/public";
import { cleanAttemptResponse } from "@/lib/engine/response-validation";
import { loadScenario } from "@/lib/engine/server-store";
import { scenarioMeta } from "@/lib/engine/store";
import type { PublicScenario } from "@/lib/engine/types";
import { createClient } from "@/lib/supabase/server";

type Failure = { ok: false; error: string };
const NOT_SIGNED_IN: Failure = { ok: false, error: "Your login has expired. Log in again to continue." };
const UNAVAILABLE: Failure = { ok: false, error: "This task isn't available any more." };
const BAD_ANSWER: Failure = { ok: false, error: "That answer couldn't be read. Try again." };

async function signedIn(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user !== null;
}

export async function startPlacementTask(taskId: string): Promise<{ ok: true; scenario: PublicScenario } | Failure> {
  if (!(await signedIn())) return NOT_SIGNED_IN;
  const task = getPlacementTask(taskId);
  const scenario = task ? await loadScenario(task.scenarioId) : null;
  if (!task || !scenario) return UNAVAILABLE;
  const upTo = task.checkpoint ? (scenario.checkpoints[task.checkpoint] ?? scenario.cursorStart) : scenario.cursorStart;
  return { ok: true, scenario: toPublicScenario(scenario, upTo) };
}

export async function gradePlacementTask(
  taskId: string,
  stages: unknown,
  ctx: { sessionId: string; responseTimeMs?: number },
): Promise<{ ok: true; row: ScenarioAttemptRow; score: number } | Failure> {
  if (!(await signedIn())) return NOT_SIGNED_IN;
  const task = getPlacementTask(taskId);
  const scenario = task ? await loadScenario(task.scenarioId) : null;
  if (!task || !scenario) return UNAVAILABLE;
  const sessionId = typeof ctx?.sessionId === "string" ? ctx.sessionId.slice(0, 100) : "";
  if (!/^placement(-skill:[a-z_]+)?:/.test(sessionId)) return BAD_ANSWER;

  // Validate against a one-stage mode shaped like the task.
  const probe = scorePlacementTask(task, scenario, {});
  const clean = cleanAttemptResponse({ scenarioId: scenario.id, modeId: "placement", stages, confidence: null, responseTimeMs: ctx.responseTimeMs ?? 0 }, probe.mode);
  if (!clean) return BAD_ANSWER;
  const scored = scorePlacementTask(task, scenario, clean.stages);
  const meta = scenarioMeta(scenario.id);
  const row = buildScenarioAttemptRow({ id: `${scenario.id}`, difficulty: meta?.difficulty ?? scenario.difficulty, type: scenario.type }, clean, scored.result, { sessionId });
  // Placement evidence is the task's own, not the engine's dimension mapping.
  row.skill_evidence = scored.evidence;
  row.mode_id = "placement";
  return { ok: true, row, score: scored.score };
}
