// Which exercises a practice session is built from. Runs in the browser, so
// it reads the candle-free, answer-free catalog (src/data/catalog.ts), never
// src/data/exercises.ts (docs/ANSWER-KEYS.md). The server re-checks each id
// is practice-ready against the full data before serving it
// (src/app/practice/actions.ts), so a stale catalog can't serve an
// unreviewed scenario.

import { getPracticeCatalog } from "@/data/catalog";
import type { Concept } from "@/lib/concepts";

/** Fixed session-length caps offered in the UI, in addition to "all". */
const SESSION_LENGTH_CAPS = [5, 10] as const;

export type SessionLength = number | "all";

export function hasPracticeExercises(concept: Concept): boolean {
  return getPracticeCatalog(concept).length > 0;
}

/** Which length choices make sense for a concept — a cap only appears if
 * the concept actually has more exercises than that cap (offering "10"
 * when there are only 5 exercises would just be a second way to ask for
 * "all"). "all" is always offered. */
export function getAvailableSessionLengths(concept: Concept): SessionLength[] {
  const total = getPracticeCatalog(concept).length;
  const caps = SESSION_LENGTH_CAPS.filter((cap) => cap < total);
  return [...caps, "all"];
}

/** Fisher-Yates — used so exercise order within a session isn't always the
 * same fixed sequence the exercises are authored in. */
function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Builds a randomly-ordered exercise list for a new session — `length`
 * caps how many exercises are included ("all" uses every exercise for the
 * concept, order still randomized). */
export function buildSessionExerciseIds(concept: Concept, length: SessionLength, difficulty?: 1 | 2 | 3): string[] {
  const pool = getPracticeCatalog(concept);
  if (difficulty === undefined) {
    const shuffled = shuffle(pool.map((e) => e.exercise_id));
    return length === "all" ? shuffled : shuffled.slice(0, Math.min(length, shuffled.length));
  }
  // Closest difficulty first, so a session asked for at one level still
  // fills up from the next nearest when that level runs short.
  const ordered = shuffle(pool).sort((a, b) => Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty));
  const ids = ordered.map((e) => e.exercise_id);
  return shuffle(length === "all" ? ids : ids.slice(0, Math.min(length, ids.length)));
}
