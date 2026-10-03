"use server";

// Grading for public challenge links (src/lib/challenge.ts): no account
// needed. Same rule as practice (docs/ANSWER-KEYS.md): the page carries the
// chart without its key, and the key comes back only with a verdict. Only
// shareable exercises are reachable here, nothing is written to the
// database (the caller keeps the attempt row for the visitor), and input is
// validated like any other Server Function, since these are reachable by
// direct POST.

import type { ZoneAnswer } from "@/data/exercises";
import type { NewAttempt } from "@/lib/attempts";
import { buildAnswerAttempt, buildGuidedAttempt } from "@/lib/attempt-rows";
import { clampContext, isGuidedAnswer, isUserAnswer } from "@/lib/answer-validation";
import { resolveChallenge } from "@/lib/challenge-source";
import { gradeAttempt, type GradeResult, type UserAnswer } from "@/lib/grading";
import { gradeGuidedAttempt, type GuidedGradeResult, type GuidedUserAnswer } from "@/lib/guided-grading";

type Failure = { ok: false; error: string };

export type ChallengeContext = {
  /** "challenge" for /c/<id> links. */
  source: string;
  responseTimeMs: number;
  confidence?: number | null;
};

export type ChallengeRecognitionGrading = {
  ok: true;
  grade: GradeResult;
  reveal: { zone: ZoneAnswer | null; level: number | null };
  row: NewAttempt;
};

export type ChallengeGuidedGrading = {
  ok: true;
  grade: GuidedGradeResult;
  reveal: { entry: number | null; stop: number | null; target: number | null };
  row: NewAttempt;
};

const UNAVAILABLE: Failure = { ok: false, error: "This challenge isn't available any more." };
const BAD_ANSWER: Failure = { ok: false, error: "That answer couldn't be read. Try again." };

function attemptMeta(sessionId: string, ctx: ChallengeContext) {
  return clampContext({ sessionId, responseTimeMs: ctx?.responseTimeMs, confidence: ctx?.confidence });
}

export async function gradeChallengeRecognition(
  exerciseId: string,
  answer: UserAnswer,
  ctx: ChallengeContext,
): Promise<ChallengeRecognitionGrading | Failure> {
  const resolved = resolveChallenge(exerciseId, ctx?.source);
  if (!resolved) return UNAVAILABLE;
  const e = resolved.exercise;
  if (e.answer_type !== "zone" && e.answer_type !== "level" && e.answer_type !== "choice") return UNAVAILABLE;
  if (!isUserAnswer(answer)) return BAD_ANSWER;
  let grade: GradeResult;
  try {
    grade = gradeAttempt(e, answer);
  } catch {
    return { ok: false, error: "This challenge couldn't be graded." };
  }
  return {
    ok: true,
    grade,
    reveal: {
      zone: grade.revealZone && e.answer_type === "zone" ? e.answer : null,
      level: grade.revealZone && e.answer_type === "level" ? (e.answer?.price ?? null) : null,
    },
    row: buildAnswerAttempt(e, answer, grade, attemptMeta(resolved.sessionId, ctx)),
  };
}

export async function gradeChallengeGuided(
  exerciseId: string,
  answer: GuidedUserAnswer,
  ctx: ChallengeContext,
): Promise<ChallengeGuidedGrading | Failure> {
  const resolved = resolveChallenge(exerciseId, ctx?.source);
  if (!resolved) return UNAVAILABLE;
  const e = resolved.exercise;
  if (e.answer_type !== "guided") return UNAVAILABLE;
  if (!isGuidedAnswer(answer)) return BAD_ANSWER;
  const grade = gradeGuidedAttempt(e, answer);
  return {
    ok: true,
    grade,
    reveal: {
      entry: e.answer.entry?.anchor ?? null,
      stop: e.answer.stop?.invalidation_price ?? null,
      target: e.answer.target?.anchor ?? null,
    },
    row: buildGuidedAttempt(e, answer, grade, attemptMeta(resolved.sessionId, ctx)),
  };
}
