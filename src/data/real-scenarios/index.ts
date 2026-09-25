// Registry of real-data scenarios. Each is a JSON file written by
// scripts/build_scenario.py — candles, a derived answer key, and a
// provenance block. Registering a file here does NOT put it in practice:
// only scenarios whose provenance says human_reviewed: true are offered
// (isPracticeReady in src/data/exercises.ts). Promotion steps are in
// docs/SCENARIO-VALIDATION.md.
//
// To register one: import its JSON file below and add it to `registered`.
// Review and approval happen at /review (src/app/review/), which edits the
// JSON file and the Review Log in docs/SCENARIO-VALIDATION.md.

import type { Exercise, ScenarioProvenance } from "@/data/exercises";
import { CONCEPT_LIST } from "@/lib/concepts";

import realFt001 from "./real-ft-001.json";
import realFt002 from "./real-ft-002.json";
import realFt003 from "./real-ft-003.json";
import realFt004 from "./real-ft-004.json";
import realFt005 from "./real-ft-005.json";
import realFt006 from "./real-ft-006.json";
import realFt007 from "./real-ft-007.json";
import realFt008 from "./real-ft-008.json";
import realFt009 from "./real-ft-009.json";
import realFt010 from "./real-ft-010.json";
import realFvg001 from "./real-fvg-001.json";
import realFvg002 from "./real-fvg-002.json";
import realFvg003 from "./real-fvg-003.json";
import realFvg004 from "./real-fvg-004.json";
import realFvg005 from "./real-fvg-005.json";
import realFvg006 from "./real-fvg-006.json";
import realFvg007 from "./real-fvg-007.json";
import realFvg008 from "./real-fvg-008.json";
import realFvg009 from "./real-fvg-009.json";
import realFvg010 from "./real-fvg-010.json";
import realGuided001 from "./real-guided-001.json";
import realGuided002 from "./real-guided-002.json";
import realGuided003 from "./real-guided-003.json";
import realGuided004 from "./real-guided-004.json";
import realGuided005 from "./real-guided-005.json";
import realGuided006 from "./real-guided-006.json";
import realGuided007 from "./real-guided-007.json";
import realGuided008 from "./real-guided-008.json";
import realGuided009 from "./real-guided-009.json";
import realGuided010 from "./real-guided-010.json";
import realLiq001 from "./real-liq-001.json";
import realLiq002 from "./real-liq-002.json";
import realLiq003 from "./real-liq-003.json";
import realLiq004 from "./real-liq-004.json";
import realLiq005 from "./real-liq-005.json";
import realLiq006 from "./real-liq-006.json";
import realLiq007 from "./real-liq-007.json";
import realLiq008 from "./real-liq-008.json";
import realLiq009 from "./real-liq-009.json";
import realLiq010 from "./real-liq-010.json";
import realMss001 from "./real-mss-001.json";
import realMss002 from "./real-mss-002.json";
import realMss003 from "./real-mss-003.json";
import realMss004 from "./real-mss-004.json";
import realMss005 from "./real-mss-005.json";
import realMss006 from "./real-mss-006.json";
import realMss007 from "./real-mss-007.json";
import realMss008 from "./real-mss-008.json";
import realMss009 from "./real-mss-009.json";
import realMss010 from "./real-mss-010.json";

const registered: unknown[] = [
  realFt001,
  realFt002,
  realFt003,
  realFt004,
  realFt005,
  realFt006,
  realFt007,
  realFt008,
  realFt009,
  realFt010,
  realFvg001,
  realFvg002,
  realFvg003,
  realFvg004,
  realFvg005,
  realFvg006,
  realFvg007,
  realFvg008,
  realFvg009,
  realFvg010,
  realGuided001,
  realGuided002,
  realGuided003,
  realGuided004,
  realGuided005,
  realGuided006,
  realGuided007,
  realGuided008,
  realGuided009,
  realGuided010,
  realLiq001,
  realLiq002,
  realLiq003,
  realLiq004,
  realLiq005,
  realLiq006,
  realLiq007,
  realLiq008,
  realLiq009,
  realLiq010,
  realMss001,
  realMss002,
  realMss003,
  realMss004,
  realMss005,
  realMss006,
  realMss007,
  realMss008,
  realMss009,
  realMss010,
];

export type RealScenario = Exercise & { provenance: ScenarioProvenance };

/** Every user-facing explanation a reviewer must rewrite before approval,
 * keyed by a dotted path into the scenario. */
export function reviewTexts(s: RealScenario): { key: string; label: string; value: string }[] {
  if (s.answer_type === "guided") {
    const a = s.answer;
    return [
      { key: "answer.step_explanations.bias", label: "Bias step", value: a.step_explanations.bias },
      { key: "answer.step_explanations.entry", label: "Entry step", value: a.step_explanations.entry },
      { key: "answer.step_explanations.stop", label: "Stop step", value: a.step_explanations.stop },
      { key: "answer.step_explanations.target", label: "Target step", value: a.step_explanations.target },
      { key: "answer.overall_explanation", label: "Overall verdict", value: a.overall_explanation },
    ];
  }
  return [{ key: "explanation", label: "Explanation", value: s.explanation }];
}

const DRAFT_MARKER = "[DRAFT";

function fail(id: unknown, message: string): never {
  throw new Error(`Real scenario ${String(id)}: ${message} (src/data/real-scenarios/)`);
}

/** Runtime check on a registered JSON file. JSON imports are untyped, so
 * this is what stands between a hand-edited file and a broken exercise —
 * and it enforces the review contract: a scenario marked reviewed must name
 * its reviewer and date, and must no longer carry the generated draft
 * explanation. */
export function parseRealScenario(raw: unknown): RealScenario {
  if (typeof raw !== "object" || raw === null) fail("?", "not an object");
  const s = raw as Record<string, unknown>;
  const id = s.exercise_id;
  if (typeof id !== "string" || id.length === 0) fail(id, "missing exercise_id");
  if (!CONCEPT_LIST.includes(s.concept as (typeof CONCEPT_LIST)[number])) fail(id, `unknown concept ${String(s.concept)}`);
  if (!["zone", "level", "guided", "free"].includes(s.answer_type as string)) {
    fail(id, `unsupported answer_type ${String(s.answer_type)}`);
  }
  if (!Array.isArray(s.candles) || s.candles.length === 0) fail(id, "no candles");
  if (s.answer_type === "free" && (!Array.isArray(s.hidden_candles) || s.hidden_candles.length === 0)) {
    fail(id, "a Free Trade scenario needs hidden_candles");
  }
  for (const c of [...(s.candles as Record<string, unknown>[]), ...((s.hidden_candles as Record<string, unknown>[]) ?? [])]) {
    if (typeof c.timestamp !== "string") fail(id, "every candle needs a timestamp");
    for (const k of ["open", "high", "low", "close"]) if (typeof c[k] !== "number") fail(id, `candle ${k} is not a number`);
  }
  if (typeof s.answer !== "object" || s.answer === null) fail(id, "missing answer");
  if (typeof s.explanation !== "string") fail(id, "missing explanation");
  if (s.answer_type === "guided") {
    const a = s.answer as Record<string, unknown>;
    const steps = a.step_explanations as Record<string, unknown> | undefined;
    if (typeof a.overall_explanation !== "string" || !steps || ["bias", "entry", "stop", "target"].some((k) => typeof steps[k] !== "string")) {
      fail(id, "a guided scenario needs overall_explanation and all four step_explanations");
    }
  }
  if (s.answer_type === "free" && typeof s.title !== "string") fail(id, "a Free Trade scenario needs a title");

  const p = s.provenance as Record<string, unknown> | undefined;
  if (typeof p !== "object" || p === null) fail(id, "missing provenance");
  for (const k of ["data_source", "detection_rule", "candidate_id", "input_sha256", "trading_date", "session", "timeframe"]) {
    if (typeof p[k] !== "string" || (p[k] as string).length === 0) fail(id, `provenance.${k} is required`);
  }
  const range = p.date_range as Record<string, unknown> | undefined;
  if (typeof range?.start !== "string" || typeof range?.end !== "string") fail(id, "provenance.date_range is required");
  if (typeof p.human_reviewed !== "boolean") fail(id, "provenance.human_reviewed must be true or false");
  if (p.human_reviewed) {
    if (typeof p.reviewed_by !== "string" || typeof p.reviewed_at !== "string") {
      fail(id, "a reviewed scenario must record reviewed_by and reviewed_at");
    }
    if (reviewTexts(raw as RealScenario).some((t) => t.value.includes(DRAFT_MARKER))) {
      fail(id, "reviewed, but an explanation is still the generated draft");
    }
  }
  return raw as RealScenario;
}

/** Registered files that failed validation. They're left out rather than
 * crashing every page that imports exercises, and listed on /review so a
 * broken file can't go unnoticed. */
export const invalidRealScenarios: { id: string; error: string }[] = [];

export const realScenarios: RealScenario[] = registered.flatMap((raw) => {
  try {
    return [parseRealScenario(raw)];
  } catch (err) {
    const id = (raw as { exercise_id?: unknown })?.exercise_id;
    const error = err instanceof Error ? err.message : String(err);
    invalidRealScenarios.push({ id: typeof id === "string" ? id : "(unknown)", error });
    console.error(error);
    return [];
  }
});
