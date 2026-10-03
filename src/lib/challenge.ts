// Shareable challenges: any practice-ready scenario with a standalone
// public URL, /c/<exercise id>. Client-safe: no exercise data is imported
// here (the server half is src/lib/challenge-source.ts). A visitor sees the chart and the prompt
// with no account; the answer key stays on the server until they commit to
// an answer (src/app/c/actions.ts), exactly as in practice
// (docs/ANSWER-KEYS.md).
//
// What can be shared: Recognition (zone, level, choice) and Guided Entry.
// Free Trade can't be, yet: its playback needs the not-yet-revealed
// candles in the browser, and a public page must not carry them
// (docs/CURRICULUM.md → Free Trade, "Known limit").

import type { ExerciseMeta } from "@/data/catalog";

/** Session ids for attempts made through a public link, so they're
 * recognizable in the history: challenge:<exercise id>, daily:<date>. */
export const CHALLENGE_SESSION_PREFIX = "challenge:";
export const DAILY_SESSION_PREFIX = "daily:";

/** Real-data charts are CME-derived (docs/APP_PERFECTION_PLAN.md → B1).
 * Public links serve them unless this is switched off, which a deployment
 * can do without a code change. NEXT_PUBLIC_ so the share button and the
 * server agree. */
export function publicRealScenariosEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SHARE_REAL_SCENARIOS !== "false";
}

type Shareable = Pick<ExerciseMeta, "answer_type" | "practice_ready" | "real">;

/** Client-safe: can this exercise (by its catalog entry) have a public link? */
export function canShare(meta: Shareable | undefined | null): boolean {
  if (!meta || !meta.practice_ready) return false;
  if (meta.answer_type === "free") return false;
  if (meta.real && !publicRealScenariosEnabled()) return false;
  return true;
}

/** The exercise embedded on the landing page: the product's signature
 * concept (the brand mark is a Fair Value Gap), an unmistakable gap after a
 * clean trend, one valid answer. A constructed chart, so it carries no
 * data-licence question, and tests/landing.test.ts holds it to that. */
export const LANDING_EXERCISE_ID = "fvg-001";

export function challengePath(exerciseId: string): string {
  return `/c/${encodeURIComponent(exerciseId)}`;
}

/** Where "practice more like this" goes. */
export function practiceMoreHref(concept: string): string {
  return `/practice?concept=${encodeURIComponent(concept)}`;
}

/** Sign-up that returns to `next` afterwards. */
export function signUpHref(next: string): string {
  return `/login?mode=signup&next=${encodeURIComponent(next)}`;
}
