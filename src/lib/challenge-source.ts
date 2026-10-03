// Which exercise a public grading request is allowed to touch, and under
// what session id its attempt is recorded. A plain challenge link grades
// the exercise it names; (later) the daily challenge grades only that
// day's exercise.

import { getExercise, isPracticeReady, type Exercise } from "@/data/exercises";
import { CHALLENGE_SESSION_PREFIX, canShare } from "@/lib/challenge";
import { dailyExerciseId, dailySessionId, isDateKey, utcDateKey } from "@/lib/daily";

/** Server: the exercise behind a public link, or null. */
export function shareableExercise(id: unknown): Exercise | null {
  if (typeof id !== "string" || id.length > 100) return null;
  const e = getExercise(id);
  if (!e || !isPracticeReady(e)) return null;
  return canShare({ answer_type: e.answer_type, practice_ready: true, real: e.provenance !== undefined }) ? e : null;
}

export type ResolvedChallenge = { exercise: Exercise; sessionId: string };

/** "challenge" grades the exercise a /c/<id> link names. "daily:<date>"
 * grades only that day's exercise (src/lib/daily.ts), and is recorded as a
 * daily completion only if the date is today (UTC); an earlier day's link
 * still grades, as an ordinary challenge. A future date grades nothing. */
export function resolveChallenge(exerciseId: unknown, source: unknown, now: Date = new Date()): ResolvedChallenge | null {
  if (source === "challenge") {
    const exercise = shareableExercise(exerciseId);
    return exercise ? { exercise, sessionId: `${CHALLENGE_SESSION_PREFIX}${exercise.exercise_id}` } : null;
  }
  if (typeof source === "string" && source.startsWith("daily:")) {
    const date = source.slice("daily:".length);
    const today = utcDateKey(now);
    if (!isDateKey(date) || date > today || dailyExerciseId(date) !== exerciseId) return null;
    const exercise = shareableExercise(exerciseId);
    if (!exercise) return null;
    return { exercise, sessionId: date === today ? dailySessionId(date) : `${CHALLENGE_SESSION_PREFIX}${exercise.exercise_id}` };
  }
  return null;
}
