// Which chart from a finished session to offer as a challenge link: a
// missed one if there is one (the chart worth sending is the one that beat
// you), otherwise the last one answered. Free Trade and withdrawn
// exercises can't be shared (src/lib/challenge.ts).

import { getExerciseMeta } from "@/data/catalog";
import { canShare } from "@/lib/challenge";
import type { SessionState } from "@/lib/storage";

export function pickChallengeFromSession(session: Pick<SessionState, "exercise_order" | "missed_exercise_ids" | "outcomes">): string | null {
  const ok = (id: string) => canShare(getExerciseMeta(id));
  const missed = session.missed_exercise_ids.find(ok);
  if (missed) return missed;
  const answered = (session.outcomes ?? []).map((o) => o.exercise_id);
  for (let i = answered.length - 1; i >= 0; i--) if (ok(answered[i])) return answered[i];
  return session.exercise_order.find(ok) ?? null;
}
