// What a finished session offers for sharing: a challenge link to one of
// its charts, and a result card. Pure, so it's testable without a page.

import { getExerciseMeta } from "@/data/catalog";
import type { NewAttempt } from "@/lib/attempts";
import { canShare } from "@/lib/challenge";
import type { CardAnswer, CardRequest, SessionKind } from "@/lib/card/model";
import type { Concept } from "@/lib/concepts";
import type { SessionState } from "@/lib/storage";

type ShareableSession = Pick<SessionState, "session_id" | "concept" | "exercise_order" | "missed_exercise_ids" | "outcomes" | "correct_count">;

/** Which chart from a finished session to offer as a challenge link: a
 * missed one if there is one (the chart worth sending is the one that beat
 * you), otherwise the last one answered. Free Trade and withdrawn
 * exercises can't be shared (src/lib/challenge.ts). */
export function pickChallengeFromSession(session: Pick<ShareableSession, "exercise_order" | "missed_exercise_ids" | "outcomes">): string | null {
  const ok = (id: string) => canShare(getExerciseMeta(id));
  const missed = session.missed_exercise_ids.find(ok);
  if (missed) return missed;
  const answered = (session.outcomes ?? []).map((o) => o.exercise_id);
  for (let i = answered.length - 1; i >= 0; i--) if (ok(answered[i])) return answered[i];
  return session.exercise_order.find(ok) ?? null;
}

/** The learner's mark as the server recorded it, in the shape a share card
 * takes. Null for Free Trade (not shareable) and rows without a mark. */
export function markFromRow(row: NewAttempt): CardAnswer | null {
  switch (row.answer_type) {
    case "zone":
      if (row.user_answer_type === "none") return { mode: "recognition", answer: { type: "none" } };
      if (row.user_price_low === null || row.user_price_high === null || row.user_candle_start === null || row.user_candle_end === null) return null;
      return {
        mode: "recognition",
        answer: {
          type: "region",
          region: { priceLow: row.user_price_low, priceHigh: row.user_price_high, candleIndexLow: row.user_candle_start, candleIndexHigh: row.user_candle_end },
        },
      };
    case "level":
      if (row.user_answer_type === "none") return { mode: "recognition", answer: { type: "none" } };
      return row.user_price === null ? null : { mode: "recognition", answer: { type: "level", price: row.user_price } };
    case "choice":
      return row.user_choice === null ? null : { mode: "recognition", answer: { type: "choice", choice: row.user_choice } };
    case "guided":
      if (row.guided_bias_choice === null || row.guided_declared_trade === null) return null;
      return {
        mode: "guided",
        answer: {
          bias: row.guided_bias_choice,
          entry: row.guided_entry_price,
          stop: row.guided_stop_price,
          target: row.guided_target_price,
          declaredTrade: row.guided_declared_trade,
        },
      };
    default:
      return null;
  }
}

/** The chart for the session card: the latest correct answer that has
 * something drawn on it; failing that, the latest answer with a drawn mark. */
export function pickFeatured(session: Pick<ShareableSession, "outcomes">): { exerciseId: string; answer: CardAnswer } | null {
  const drawn = (session.outcomes ?? []).filter((o) => {
    if (!o.mark || !canShare(getExerciseMeta(o.exercise_id))) return false;
    return o.mark.mode === "guided" || o.mark.answer.type === "region" || o.mark.answer.type === "level";
  });
  const best = [...drawn].reverse().find((o) => o.correct) ?? drawn[drawn.length - 1];
  return best?.mark ? { exerciseId: best.exercise_id, answer: best.mark } : null;
}

/** The request for this session's result card, or null when there's nothing to say yet. */
export function sessionCardRequest(session: ShareableSession): CardRequest | null {
  const answered = session.correct_count + session.missed_exercise_ids.length;
  if (answered < 1 || answered > 200) return null;
  const byConcept = new Map<Concept, { correct: number; total: number }>();
  for (const o of session.outcomes ?? []) {
    const concept = getExerciseMeta(o.exercise_id)?.concept;
    if (!concept) continue;
    const entry = byConcept.get(concept) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (o.correct) entry.correct += 1;
    byConcept.set(concept, entry);
  }
  const featured = pickFeatured(session);
  return {
    kind: "session",
    session: session.concept as SessionKind,
    correct: session.correct_count,
    answered,
    concepts: [...byConcept.entries()].map(([concept, v]) => ({ concept, ...v })),
    ...(featured ? { featured: { exerciseId: featured.exerciseId, sessionId: session.session_id, answer: featured.answer } } : {}),
  };
}
