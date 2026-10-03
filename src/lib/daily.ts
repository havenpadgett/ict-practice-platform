// The daily challenge: one chart per UTC day, the same for everyone, with
// its own shareable link. Pure and client-safe (ids and dates only).
//
// "Day" is the UTC date, so the whole world turns over at once (00:00 UTC,
// 8 pm ET in summer, 7 pm in winter). A completion counts toward the daily
// streak only when it happens on that day; answering an earlier day's link
// later is just a challenge. Completion and streak are derived from the
// attempts a learner already has (session_id "daily:<date>"), so they need
// no table and are separate from the practice streak (profiles.current_
// streak), which counts sessions. docs/OPERATIONS.md → Daily challenge.

import { DAILY_EPOCH, DAILY_SCHEDULE } from "@/data/daily-schedule";
import { DAILY_SESSION_PREFIX } from "@/lib/challenge";

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The UTC calendar date, "YYYY-MM-DD". */
export function utcDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** A real calendar date in "YYYY-MM-DD" form (no 2026-02-31). */
export function isDateKey(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = DATE_KEY.exec(s);
  if (!m) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(date: string, days: number): string {
  return utcDateKey(new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS));
}

/** Whole days from the first scheduled day (negative before it). */
export function dayIndex(date: string): number {
  return Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${DAILY_EPOCH}T00:00:00Z`).getTime()) / DAY_MS);
}

export const FIRST_DAILY = DAILY_EPOCH;

/** The exercise for a date, or null before the first daily. After the
 * scheduled year the schedule repeats from its start rather than running
 * dry (tests/daily.test.ts nags well before that). */
export function dailyExerciseId(date: string): string | null {
  const i = dayIndex(date);
  if (i < 0 || DAILY_SCHEDULE.length === 0) return null;
  return DAILY_SCHEDULE[i % DAILY_SCHEDULE.length];
}

export const dailyPath = (date: string) => `/daily/${date}`;
export const dailySessionId = (date: string) => `${DAILY_SESSION_PREFIX}${date}`;

/** The date in a daily session id, or null for any other session. */
export function dateFromSessionId(sessionId: string | null | undefined): string | null {
  if (!sessionId || !sessionId.startsWith(DAILY_SESSION_PREFIX)) return null;
  const date = sessionId.slice(DAILY_SESSION_PREFIX.length);
  return isDateKey(date) ? date : null;
}

/** The days a learner completed the daily on the day, from their attempts. */
export function completedDays(rows: { session_id: string | null }[]): Set<string> {
  const days = new Set<string>();
  for (const r of rows) {
    const d = dateFromSessionId(r.session_id);
    if (d) days.add(d);
  }
  return days;
}

/** Consecutive completed days up to today. Today not played yet doesn't
 * break it: the streak is alive until the day ends. */
export function currentStreak(done: ReadonlySet<string>, today: string): number {
  let day = done.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(done: ReadonlySet<string>): number {
  const days = [...done].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** The last `n` days ending today, oldest first, for the week of dots. */
export function recentDays(done: ReadonlySet<string>, today: string, n = 7): { date: string; done: boolean }[] {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - (n - 1));
    return { date, done: done.has(date) };
  });
}
