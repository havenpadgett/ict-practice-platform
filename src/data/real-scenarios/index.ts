// Registry of real-data scenarios. Each is a JSON file written by
// scripts/build_scenario.py — candles, a derived answer key, and a
// provenance block. Registering a file here does NOT by itself put it in
// practice: only scenarios whose provenance says human_reviewed: true (a
// person approved it) or auto_approved: true (the pipeline did) are offered
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
import realFt011 from "./real-ft-011.json";
import realFt012 from "./real-ft-012.json";
import realFt013 from "./real-ft-013.json";
import realFt014 from "./real-ft-014.json";
import realFt015 from "./real-ft-015.json";
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
import realFvg011 from "./real-fvg-011.json";
import realFvg012 from "./real-fvg-012.json";
import realFvg013 from "./real-fvg-013.json";
import realFvg014 from "./real-fvg-014.json";
import realFvg015 from "./real-fvg-015.json";
import realFvg016 from "./real-fvg-016.json";
import realFvg017 from "./real-fvg-017.json";
import realFvg018 from "./real-fvg-018.json";
import realFvg019 from "./real-fvg-019.json";
import realFvg020 from "./real-fvg-020.json";
import realFvg021 from "./real-fvg-021.json";
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
import realGuided011 from "./real-guided-011.json";
import realGuided012 from "./real-guided-012.json";
import realGuided013 from "./real-guided-013.json";
import realGuided014 from "./real-guided-014.json";
import realGuided015 from "./real-guided-015.json";
import realIfvg001 from "./real-ifvg-001.json";
import realIfvg002 from "./real-ifvg-002.json";
import realIfvg003 from "./real-ifvg-003.json";
import realIfvg004 from "./real-ifvg-004.json";
import realIfvg005 from "./real-ifvg-005.json";
import realIfvg006 from "./real-ifvg-006.json";
import realIfvg007 from "./real-ifvg-007.json";
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
import realLiq011 from "./real-liq-011.json";
import realLiq012 from "./real-liq-012.json";
import realLiq013 from "./real-liq-013.json";
import realLiq014 from "./real-liq-014.json";
import realLiq015 from "./real-liq-015.json";
import realLiq016 from "./real-liq-016.json";
import realLiq017 from "./real-liq-017.json";
import realLiq018 from "./real-liq-018.json";
import realLiq019 from "./real-liq-019.json";
import realLiq020 from "./real-liq-020.json";
import realLiq021 from "./real-liq-021.json";
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
import realMss011 from "./real-mss-011.json";
import realMss012 from "./real-mss-012.json";
import realMss013 from "./real-mss-013.json";
import realMss014 from "./real-mss-014.json";
import realMss015 from "./real-mss-015.json";
import realOb001 from "./real-ob-001.json";
import realOb002 from "./real-ob-002.json";
import realOb003 from "./real-ob-003.json";
import realOb004 from "./real-ob-004.json";
import realOb005 from "./real-ob-005.json";
import realOb006 from "./real-ob-006.json";
import realOb007 from "./real-ob-007.json";
import realOb008 from "./real-ob-008.json";
import realOb009 from "./real-ob-009.json";
import realOb010 from "./real-ob-010.json";
import realOb011 from "./real-ob-011.json";
import realOb012 from "./real-ob-012.json";
import realOb013 from "./real-ob-013.json";
import realPd001 from "./real-pd-001.json";
import realPd002 from "./real-pd-002.json";
import realPd003 from "./real-pd-003.json";
import realPd004 from "./real-pd-004.json";
import realPd005 from "./real-pd-005.json";
import realPd006 from "./real-pd-006.json";
import realPd007 from "./real-pd-007.json";
import realTliq001 from "./real-tliq-001.json";
import realTliq002 from "./real-tliq-002.json";
import realTliq003 from "./real-tliq-003.json";
import realTliq004 from "./real-tliq-004.json";
import realTliq005 from "./real-tliq-005.json";
import realTliq006 from "./real-tliq-006.json";

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
  realFt011,
  realFt012,
  realFt013,
  realFt014,
  realFt015,
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
  realFvg011,
  realFvg012,
  realFvg013,
  realFvg014,
  realFvg015,
  realFvg016,
  realFvg017,
  realFvg018,
  realFvg019,
  realFvg020,
  realFvg021,
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
  realGuided011,
  realGuided012,
  realGuided013,
  realGuided014,
  realGuided015,
  realIfvg001,
  realIfvg002,
  realIfvg003,
  realIfvg004,
  realIfvg005,
  realIfvg006,
  realIfvg007,
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
  realLiq011,
  realLiq012,
  realLiq013,
  realLiq014,
  realLiq015,
  realLiq016,
  realLiq017,
  realLiq018,
  realLiq019,
  realLiq020,
  realLiq021,
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
  realMss011,
  realMss012,
  realMss013,
  realMss014,
  realMss015,
  realOb001,
  realOb002,
  realOb003,
  realOb004,
  realOb005,
  realOb006,
  realOb007,
  realOb008,
  realOb009,
  realOb010,
  realOb011,
  realOb012,
  realOb013,
  realPd001,
  realPd002,
  realPd003,
  realPd004,
  realPd005,
  realPd006,
  realPd007,
  realTliq001,
  realTliq002,
  realTliq003,
  realTliq004,
  realTliq005,
  realTliq006,
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
/** reviewed_by on a pipeline approval; never a real reviewer's email. */
export const AUTO_REVIEWER = "auto";

function fail(id: unknown, message: string): never {
  throw new Error(`Real scenario ${String(id)}: ${message} (src/data/real-scenarios/)`);
}

/** Runtime check on a registered JSON file. JSON imports are untyped, so
 * this is what stands between a hand-edited file and a broken exercise —
 * and it enforces the review contract: an approved scenario (human or auto)
 * must name its approver and date, can't be both, and must no longer carry
 * the generated draft explanation. */
export function parseRealScenario(raw: unknown): RealScenario {
  if (typeof raw !== "object" || raw === null) fail("?", "not an object");
  const s = raw as Record<string, unknown>;
  const id = s.exercise_id;
  if (typeof id !== "string" || id.length === 0) fail(id, "missing exercise_id");
  if (!CONCEPT_LIST.includes(s.concept as (typeof CONCEPT_LIST)[number])) fail(id, `unknown concept ${String(s.concept)}`);
  if (!["zone", "level", "choice", "guided", "free"].includes(s.answer_type as string)) {
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
  if (s.answer_type === "choice") {
    const options = s.options as { value?: unknown }[] | undefined;
    if (!Array.isArray(options) || options.length < 2 || options.some((o) => typeof o.value !== "string")) {
      fail(id, "a choice scenario needs at least two options with string values");
    }
    const a = s.answer as Record<string, unknown>;
    if (typeof a.correct_choice !== "string" || !options.some((o) => o.value === a.correct_choice)) {
      fail(id, "answer.correct_choice must match one of the options");
    }
  }
  if (s.setup_span !== undefined) {
    const span = s.setup_span as unknown[];
    const n = (s.candles as unknown[]).length;
    if (
      !Array.isArray(span) || span.length !== 2 || !span.every(Number.isInteger) ||
      (span[0] as number) < 0 || (span[0] as number) > (span[1] as number) || (span[1] as number) >= n
    ) {
      fail(id, "setup_span must be [first, last] candle indices inside the window");
    }
  }

  const p = s.provenance as Record<string, unknown> | undefined;
  if (typeof p !== "object" || p === null) fail(id, "missing provenance");
  for (const k of ["data_source", "detection_rule", "candidate_id", "input_sha256", "trading_date", "session", "timeframe"]) {
    if (typeof p[k] !== "string" || (p[k] as string).length === 0) fail(id, `provenance.${k} is required`);
  }
  const range = p.date_range as Record<string, unknown> | undefined;
  if (typeof range?.start !== "string" || typeof range?.end !== "string") fail(id, "provenance.date_range is required");
  if (typeof p.human_reviewed !== "boolean") fail(id, "provenance.human_reviewed must be true or false");
  if (p.auto_approved !== undefined && typeof p.auto_approved !== "boolean") fail(id, "provenance.auto_approved must be true or false");
  if (p.human_reviewed && p.auto_approved) {
    fail(id, "human_reviewed and auto_approved are mutually exclusive: an approval is either a person's or the pipeline's");
  }
  if (p.human_reviewed) {
    if (typeof p.reviewed_by !== "string" || typeof p.reviewed_at !== "string") {
      fail(id, "a reviewed scenario must record reviewed_by and reviewed_at");
    }
    if (p.reviewed_by === AUTO_REVIEWER) fail(id, `reviewed_by "${AUTO_REVIEWER}" can't be recorded as a human review`);
  }
  if (p.auto_approved) {
    if (p.reviewed_by !== AUTO_REVIEWER || typeof p.reviewed_at !== "string") {
      fail(id, `an auto-approved scenario must record reviewed_by "${AUTO_REVIEWER}" and reviewed_at`);
    }
  }
  if ((p.human_reviewed || p.auto_approved) && reviewTexts(raw as RealScenario).some((t) => t.value.includes(DRAFT_MARKER))) {
    fail(id, "approved, but an explanation is still the generated draft");
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
