"use server";

// Server-side exercise loading and grading (docs/ANSWER-KEYS.md). The
// browser gets an exercise without its answer key (toPublicExercise), sends
// back what the user did, and gets the verdict, the explanation, the key
// to draw on the chart, and the attempt row to save. The key never reaches
// the browser before an answer is submitted.
//
// Server Functions are reachable by direct POST, so every one checks the
// session and validates its input; nothing here trusts a client-supplied
// user id (there isn't one).

import { getExercise, isPracticeReady, type Exercise, type FreeTradeAnswer, type ZoneAnswer } from "@/data/exercises";
import type { NewAttempt } from "@/lib/attempts";
import { buildAnswerAttempt, buildFreeTradeAttempt, buildGuidedAttempt } from "@/lib/attempt-rows";
import { gradeFreeTrade, type FreeTradeExit, type FreeTradeGradeResult, type FreeTradePosition } from "@/lib/free-trade-grading";
import { gradeAttempt, type GradeResult, type UserAnswer } from "@/lib/grading";
import { gradeGuidedAttempt, type GuidedGradeResult, type GuidedUserAnswer } from "@/lib/guided-grading";
import { toPublicExercise, type PublicExercise } from "@/lib/public-exercise";
import { createClient } from "@/lib/supabase/server";

type Failure = { ok: false; error: string };

export type AttemptContext = { sessionId: string; responseTimeMs: number };

export type RecognitionGrading = {
  ok: true;
  grade: GradeResult;
  /** Drawn on the chart after grading (null when there's nothing to draw). */
  reveal: { zone: ZoneAnswer | null; level: number | null };
  /** The attempt row to save; attempt_number is filled in by the caller. */
  row: NewAttempt;
};

export type GuidedGrading = {
  ok: true;
  grade: GuidedGradeResult;
  reveal: { entry: number | null; stop: number | null; target: number | null };
  row: NewAttempt;
};

export type FreeTradeGrading = {
  ok: true;
  grade: FreeTradeGradeResult;
  key: FreeTradeAnswer;
  row: NewAttempt;
};

const MAX_SESSION_IDS = 60;

async function signedIn(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user !== null;
}

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isNumOrNull(x: unknown): x is number | null {
  return x === null || isNum(x);
}

function practiceExercise(id: unknown): Exercise | null {
  if (typeof id !== "string") return null;
  const e = getExercise(id);
  return e && isPracticeReady(e) ? e : null;
}

/** Clamp what the browser reports about the attempt to storable values. */
function context(c: AttemptContext) {
  return {
    sessionId: typeof c?.sessionId === "string" ? c.sessionId.slice(0, 100) : "",
    responseTimeMs: isNum(c?.responseTimeMs) ? Math.max(0, Math.round(c.responseTimeMs)) : 0,
    attemptNumber: 0,
  };
}

const NOT_SIGNED_IN: Failure = { ok: false, error: "Your login has expired. Log in again to continue." };
const UNAVAILABLE: Failure = { ok: false, error: "This exercise isn't available any more." };
const BAD_ANSWER: Failure = { ok: false, error: "That answer couldn't be read. Try again." };

/** The public (answer-free) form of each practice-ready exercise in a
 * session; null for an id that's missing or no longer practice-ready. */
export async function loadSessionExercises(
  ids: string[],
): Promise<{ ok: true; exercises: Record<string, PublicExercise | null> } | Failure> {
  if (!(await signedIn())) return NOT_SIGNED_IN;
  if (!Array.isArray(ids) || ids.length > MAX_SESSION_IDS) return { ok: false, error: "Invalid session." };
  const exercises: Record<string, PublicExercise | null> = {};
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const e = practiceExercise(id);
    exercises[id] = e ? toPublicExercise(e) : null;
  }
  return { ok: true, exercises };
}

function isUserAnswer(a: unknown): a is UserAnswer {
  if (typeof a !== "object" || a === null) return false;
  const x = a as Record<string, unknown>;
  switch (x.type) {
    case "none":
      return true;
    case "level":
      return isNum(x.price);
    case "choice":
      return typeof x.choice === "string" && x.choice.length <= 100;
    case "region": {
      const r = x.region as Record<string, unknown> | null;
      return (
        typeof r === "object" && r !== null &&
        isNum(r.priceLow) && isNum(r.priceHigh) && isNum(r.candleIndexLow) && isNum(r.candleIndexHigh)
      );
    }
    default:
      return false;
  }
}

/** Recognition: zone, level and choice exercises. */
export async function gradeRecognition(
  exerciseId: string,
  answer: UserAnswer,
  ctx: AttemptContext,
): Promise<RecognitionGrading | Failure> {
  if (!(await signedIn())) return NOT_SIGNED_IN;
  const e = practiceExercise(exerciseId);
  if (!e || (e.answer_type !== "zone" && e.answer_type !== "level" && e.answer_type !== "choice")) return UNAVAILABLE;
  if (!isUserAnswer(answer)) return BAD_ANSWER;
  let grade: GradeResult;
  try {
    grade = gradeAttempt(e, answer);
  } catch (err) {
    return { ok: false, error: `This exercise couldn't be graded (${err instanceof Error ? err.message : "bad data"}).` };
  }
  return {
    ok: true,
    grade,
    reveal: {
      zone: grade.revealZone && e.answer_type === "zone" ? e.answer : null,
      level: grade.revealZone && e.answer_type === "level" ? e.answer?.price ?? null : null,
    },
    row: buildAnswerAttempt(e, answer, grade, context(ctx)),
  };
}

function isGuidedAnswer(a: unknown): a is GuidedUserAnswer {
  if (typeof a !== "object" || a === null) return false;
  const x = a as Record<string, unknown>;
  return (
    (x.bias === "bullish" || x.bias === "bearish" || x.bias === "unclear") &&
    isNumOrNull(x.entry) && isNumOrNull(x.stop) && isNumOrNull(x.target) &&
    typeof x.declaredTrade === "boolean"
  );
}

export async function gradeGuided(
  exerciseId: string,
  answer: GuidedUserAnswer,
  ctx: AttemptContext,
): Promise<GuidedGrading | Failure> {
  if (!(await signedIn())) return NOT_SIGNED_IN;
  const e = practiceExercise(exerciseId);
  if (!e || e.answer_type !== "guided") return UNAVAILABLE;
  if (!isGuidedAnswer(answer)) return BAD_ANSWER;
  const grade = gradeGuidedAttempt(e, answer);
  return {
    ok: true,
    grade,
    reveal: { entry: e.answer.entry?.price ?? null, stop: e.answer.stop?.price ?? null, target: e.answer.target?.price ?? null },
    row: buildGuidedAttempt(e, answer, grade, context(ctx)),
  };
}

function isPosition(p: unknown): p is FreeTradePosition | null {
  if (p === null) return true;
  if (typeof p !== "object") return false;
  const x = p as Record<string, unknown>;
  return (x.direction === "long" || x.direction === "short") && isNum(x.entryIndex) && isNum(x.entry) && isNum(x.stop) && isNum(x.target);
}

function isExit(p: unknown): p is FreeTradeExit | null {
  if (p === null) return true;
  if (typeof p !== "object") return false;
  const x = p as Record<string, unknown>;
  return isNum(x.index) && isNum(x.price) && (x.reason === "stop" || x.reason === "target" || x.reason === "session_end");
}

export async function gradeFreeTradeScenario(
  exerciseId: string,
  position: FreeTradePosition | null,
  exit: FreeTradeExit | null,
  ctx: AttemptContext,
): Promise<FreeTradeGrading | Failure> {
  if (!(await signedIn())) return NOT_SIGNED_IN;
  const e = practiceExercise(exerciseId);
  if (!e || e.answer_type !== "free") return UNAVAILABLE;
  if (!isPosition(position) || !isExit(exit)) return BAD_ANSWER;
  const grade = gradeFreeTrade(e, position, exit);
  return { ok: true, grade, key: e.answer, row: buildFreeTradeAttempt(e, position, exit, grade, context(ctx)) };
}
