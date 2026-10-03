// The daily challenge (src/lib/daily.ts, src/data/daily-schedule.ts): one
// chart per UTC day, stable once published, streak and completion derived
// from attempts and kept apart from the practice streak.

import { describe, expect, it } from "vitest";
import { DAILY_EPOCH, DAILY_SCHEDULE } from "@/data/daily-schedule";
import { exercises, getExercise, isPracticeReady } from "@/data/exercises";
import { resolveChallenge } from "@/lib/challenge-source";
import { LANDING_EXERCISE_ID } from "@/lib/challenge";
import {
  addDays, bestStreak, completedDays, currentStreak, dailyExerciseId, dailySessionId, dateFromSessionId, dayIndex, isDateKey, recentDays, utcDateKey,
} from "@/lib/daily";

describe("dates", () => {
  it("are UTC calendar days", () => {
    expect(utcDateKey(new Date("2026-10-03T23:59:59-04:00"))).toBe("2026-10-04");
    expect(utcDateKey(new Date("2026-10-03T00:00:00Z"))).toBe("2026-10-03");
  });

  it("accepts real dates only", () => {
    for (const ok of ["2026-10-03", "2028-02-29"]) expect(isDateKey(ok)).toBe(true);
    for (const bad of ["2026-02-30", "2026-13-01", "2026-1-1", "tomorrow", "", 20261003, null]) expect(isDateKey(bad)).toBe(false);
  });

  it("add days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("the schedule", () => {
  it("starts today-ish, covers a year, and only holds Recognition exercises that are live", () => {
    expect(DAILY_SCHEDULE.length).toBeGreaterThanOrEqual(365);
    for (const id of DAILY_SCHEDULE) {
      const e = getExercise(id);
      expect(e, id).toBeDefined();
      expect(isPracticeReady(e!), `${id} practice-ready`).toBe(true);
      expect(["zone", "level", "choice"]).toContain(e!.answer_type);
    }
    expect(DAILY_SCHEDULE).not.toContain(LANDING_EXERCISE_ID);
  });

  it("never repeats a chart within a week, and rotates concepts", () => {
    for (let i = 0; i + 7 <= DAILY_SCHEDULE.length; i++) {
      const week = DAILY_SCHEDULE.slice(i, i + 7);
      expect(new Set(week).size, `week from day ${i}`).toBe(7);
      expect(new Set(week.map((id) => getExercise(id)!.concept)).size, `concepts in week from day ${i}`).toBe(7);
    }
  });

  it("uses every concept's pool before repeating a chart", () => {
    const seen = new Map<string, number>();
    for (const id of DAILY_SCHEDULE.slice(0, 120)) seen.set(id, (seen.get(id) ?? 0) + 1);
    // A repeat inside the first 120 days is only allowed for a concept whose whole pool is already used up.
    const pool = (concept: string) =>
      exercises.filter((e) => e.concept === concept && isPracticeReady(e) && ["zone", "level", "choice"].includes(e.answer_type) && e.exercise_id !== LANDING_EXERCISE_ID).length;
    for (const [id, n] of seen) {
      if (n > 1) {
        const concept = getExercise(id)!.concept;
        const usedOfConcept = new Set(DAILY_SCHEDULE.slice(0, 120).filter((x) => getExercise(x)!.concept === concept)).size;
        expect(usedOfConcept, `${id} repeated before ${concept}'s pool was used`).toBe(pool(concept));
      }
    }
  });

  it("maps a date to its entry, and wraps rather than running dry", () => {
    expect(dailyExerciseId(DAILY_EPOCH)).toBe(DAILY_SCHEDULE[0]);
    expect(dailyExerciseId(addDays(DAILY_EPOCH, 5))).toBe(DAILY_SCHEDULE[5]);
    expect(dailyExerciseId(addDays(DAILY_EPOCH, DAILY_SCHEDULE.length + 2))).toBe(DAILY_SCHEDULE[2]);
    expect(dailyExerciseId(addDays(DAILY_EPOCH, -1))).toBeNull();
    expect(dayIndex(DAILY_EPOCH)).toBe(0);
  });

  it("has at least 60 days left (extend it with `npm run daily`)", () => {
    const lastDay = addDays(DAILY_EPOCH, DAILY_SCHEDULE.length - 1);
    expect(lastDay >= addDays(utcDateKey(), 60), `schedule ends ${lastDay}; run: npm run daily -- ${DAILY_SCHEDULE.length + 180}`).toBe(true);
  });

  it("does not change published days: today's entry is pinned", () => {
    // If this fails, the schedule was regenerated rather than extended, and
    // links people already shared would now show a different chart.
    expect(DAILY_SCHEDULE.slice(0, 7)).toEqual(["fvg-002", "liq-003", "mss-004", "ifvg-003", "ob-003", "pd-001", "tliq-002"]);
  });
});

describe("completion and streak", () => {
  const rows = (...dates: string[]) => dates.map((d) => ({ session_id: dailySessionId(d) }));

  it("reads daily completions from session ids and ignores everything else", () => {
    expect(dateFromSessionId("daily:2026-10-03")).toBe("2026-10-03");
    for (const other of ["challenge:fvg-001", "session_abc", "daily:soon", "daily:2026-02-31", "", null, undefined]) {
      expect(dateFromSessionId(other as string)).toBeNull();
    }
    const done = completedDays([...rows("2026-10-03", "2026-10-03"), { session_id: "session_x" }, { session_id: null }]);
    expect([...done]).toEqual(["2026-10-03"]);
  });

  it("counts consecutive days ending today", () => {
    expect(currentStreak(new Set(), "2026-10-10")).toBe(0);
    expect(currentStreak(new Set(["2026-10-10"]), "2026-10-10")).toBe(1);
    expect(currentStreak(new Set(["2026-10-08", "2026-10-09", "2026-10-10"]), "2026-10-10")).toBe(3);
  });

  it("keeps the streak alive until the day ends, then lets it go", () => {
    const done = new Set(["2026-10-08", "2026-10-09"]);
    expect(currentStreak(done, "2026-10-10")).toBe(2); // today not played yet
    expect(currentStreak(done, "2026-10-11")).toBe(0); // missed a whole day
  });

  it("a gap breaks it", () => {
    expect(currentStreak(new Set(["2026-10-05", "2026-10-07", "2026-10-08"]), "2026-10-08")).toBe(2);
  });

  it("tracks the best run separately", () => {
    expect(bestStreak(new Set(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-07", "2026-10-08"]))).toBe(3);
    expect(bestStreak(new Set())).toBe(0);
  });

  it("lays out the last seven days", () => {
    const week = recentDays(new Set(["2026-10-09", "2026-10-10"]), "2026-10-10");
    expect(week.map((d) => d.date)[0]).toBe("2026-10-04");
    expect(week.map((d) => d.done)).toEqual([false, false, false, false, false, true, true]);
  });
});

describe("grading a daily", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const today = "2026-10-07";
  const todays = dailyExerciseId(today)!;

  it("grades only that day's chart, and records it as a daily completion when it's today", () => {
    expect(resolveChallenge(todays, `daily:${today}`, now)?.sessionId).toBe(`daily:${today}`);
    const other = DAILY_SCHEDULE.find((id) => id !== todays)!;
    expect(resolveChallenge(other, `daily:${today}`, now)).toBeNull();
  });

  it("an earlier day grades as an ordinary challenge, which doesn't extend the streak", () => {
    const yesterday = "2026-10-06";
    const r = resolveChallenge(dailyExerciseId(yesterday)!, `daily:${yesterday}`, now);
    expect(r?.sessionId).toBe(`challenge:${dailyExerciseId(yesterday)}`);
  });

  it("refuses a future day, a malformed date and a day before the first", () => {
    const tomorrow = "2026-10-08";
    expect(resolveChallenge(dailyExerciseId(tomorrow)!, `daily:${tomorrow}`, now)).toBeNull();
    expect(resolveChallenge(todays, "daily:not-a-date", now)).toBeNull();
    expect(resolveChallenge(todays, `daily:${addDays(DAILY_EPOCH, -1)}`, now)).toBeNull();
    expect(resolveChallenge(todays, "daily:", now)).toBeNull();
  });
});
