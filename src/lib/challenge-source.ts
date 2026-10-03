// Which exercise a public grading request is allowed to touch, and under
// what session id its attempt is recorded. A plain challenge link grades
// the exercise it names; (later) the daily challenge grades only that
// day's exercise.

import { getExercise, isPracticeReady, type Exercise } from "@/data/exercises";
import { CHALLENGE_SESSION_PREFIX, canShare } from "@/lib/challenge";

/** Server: the exercise behind a public link, or null. */
export function shareableExercise(id: unknown): Exercise | null {
  if (typeof id !== "string" || id.length > 100) return null;
  const e = getExercise(id);
  if (!e || !isPracticeReady(e)) return null;
  return canShare({ answer_type: e.answer_type, practice_ready: true, real: e.provenance !== undefined }) ? e : null;
}

export type ResolvedChallenge = { exercise: Exercise; sessionId: string };

export function resolveChallenge(exerciseId: unknown, source: unknown): ResolvedChallenge | null {
  if (source === "challenge") {
    const exercise = shareableExercise(exerciseId);
    return exercise ? { exercise, sessionId: `${CHALLENGE_SESSION_PREFIX}${exercise.exercise_id}` } : null;
  }
  return null;
}
