"use server";

// "Try a sample" (src/app/try/page.tsx): three beginner charts anyone can
// answer without an account. Nothing is recorded on the server. Same
// answer-key rule as practice (docs/ANSWER-KEYS.md): the browser gets each
// chart without its key and the key comes back only with a verdict, and
// only these three exercises are reachable here.

import { getExercise, isPracticeReady, type ZoneAnswer } from "@/data/exercises";
import { gradeAttempt, type GradeResult, type UserAnswer } from "@/lib/grading";
import { toPublicExercise, type PublicLevelExercise, type PublicZoneExercise } from "@/lib/public-exercise";

/** A box, a line and a box: FVG, liquidity, order block, all difficulty 1. */
const SAMPLE_IDS = ["fvg-001", "liq-001", "ob-001"] as const;

type SampleExercise = PublicZoneExercise | PublicLevelExercise;

export async function loadSample(): Promise<SampleExercise[]> {
  return SAMPLE_IDS.map((id) => getExercise(id))
    .filter((e) => e !== undefined && isPracticeReady(e) && (e.answer_type === "zone" || e.answer_type === "level"))
    .map((e) => toPublicExercise(e!) as SampleExercise);
}

function isAnswer(a: unknown): a is UserAnswer {
  if (typeof a !== "object" || a === null) return false;
  const x = a as Record<string, unknown>;
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (x.type === "none") return true;
  if (x.type === "level") return num(x.price);
  if (x.type === "region") {
    const r = x.region as Record<string, unknown> | null;
    return !!r && [r.priceLow, r.priceHigh, r.candleIndexLow, r.candleIndexHigh].every(num);
  }
  return false;
}

export async function gradeSample(
  exerciseId: string,
  answer: UserAnswer,
): Promise<{ ok: true; grade: GradeResult; reveal: { zone: ZoneAnswer | null; level: number | null } } | { ok: false; error: string }> {
  if (!(SAMPLE_IDS as readonly string[]).includes(exerciseId)) return { ok: false, error: "That chart isn't part of the sample." };
  const e = getExercise(exerciseId);
  if (!e || !isPracticeReady(e) || (e.answer_type !== "zone" && e.answer_type !== "level")) {
    return { ok: false, error: "That chart isn't available right now." };
  }
  if (!isAnswer(answer)) return { ok: false, error: "That answer couldn't be read. Try again." };
  const grade = gradeAttempt(e, answer);
  return {
    ok: true,
    grade,
    reveal: {
      zone: grade.revealZone && e.answer_type === "zone" ? e.answer : null,
      level: grade.revealZone && e.answer_type === "level" ? (e.answer?.price ?? null) : null,
    },
  };
}
