// Spaced repetition (src/lib/spaced-repetition.ts, docs/SPACED-REPETITION.md):
// "cleared" is one correct retry; "mastered" is four correct answers in four
// separated sessions, 1, 3 and 7 days apart; a miss starts the cycle over.

import { describe, expect, it } from "vitest";
import { mistakeCounts, mistakeSessionIds, summarizeMistakes } from "@/lib/mistakes";
import { reviewState, REVIEW_INTERVALS_DAYS, MASTERY_SUCCESSES, type ReviewAttempt } from "@/lib/spaced-repetition";

const T0 = Date.UTC(2026, 8, 1, 10, 0, 0);
const H = 3_600_000;
const D = 24 * H;
/** An attempt `ms` after the start, in session `s`. */
const a = (correct: boolean, ms: number, s: string | null = `s${ms}`): ReviewAttempt => ({
  is_correct: correct,
  created_at: new Date(T0 + ms).toISOString(),
  session_id: s,
});
const now = (ms: number) => new Date(T0 + ms);

describe("the schedule", () => {
  it("is 1, 3 and 7 days, and four correct answers to master", () => {
    expect([...REVIEW_INTERVALS_DAYS]).toEqual([1, 3, 7]);
    expect(MASTERY_SUCCESSES).toBe(4);
  });
});

describe("reviewState", () => {
  it("is null for a chart that was never missed", () => {
    expect(reviewState([a(true, 0), a(true, D)])).toBeNull();
    expect(reviewState([])).toBeNull();
  });

  it("is open while the latest answer is a miss", () => {
    const s = reviewState([a(false, 0)], now(H))!;
    expect(s).toMatchObject({ stage: "open", successes: 0, confirmations: 0, dueAt: null, due: false, clearedAt: null });
  });

  it("is cleared by one correct retry, and not yet mastered however fast it's repeated", () => {
    const s = reviewState([a(false, 0), a(true, H), a(true, 2 * H), a(true, 3 * H)], now(4 * H))!;
    expect(s.stage).toBe("cleared");
    expect(s.successes).toBe(1);
    expect(s.clearedAt).toBe(new Date(T0 + H).toISOString());
    // The first recheck is a day after the clearing retry.
    expect(s.dueAt).toBe(new Date(T0 + H + D).toISOString());
    expect(s.due).toBe(false);
  });

  it("falls due exactly a day after clearing", () => {
    const rows = [a(false, 0), a(true, H)];
    expect(reviewState(rows, now(H + D - 1))!.due).toBe(false);
    expect(reviewState(rows, now(H + D))!.due).toBe(true);
  });

  it("counts a recheck a day later, then asks for 3 more days", () => {
    const rows = [a(false, 0), a(true, H), a(true, H + D)];
    const s = reviewState(rows, now(H + D + H))!;
    expect(s).toMatchObject({ stage: "confirming", successes: 2, confirmations: 1 });
    expect(s.dueAt).toBe(new Date(T0 + H + D + 3 * D).toISOString());
  });

  it("doesn't count an answer that comes before its interval has passed", () => {
    const rows = [a(false, 0), a(true, H), a(true, H + D), a(true, H + D + 2 * D)]; // 2 days after, needs 3
    expect(reviewState(rows, now(10 * D))!.successes).toBe(2);
    // ...but the same answer a day later does.
    const later = [...rows, a(true, H + D + 3 * D)];
    expect(reviewState(later, now(10 * D))!.successes).toBe(3);
  });

  it("masters a chart after 1, 3 and 7 days of being right again", () => {
    const t1 = H;
    const t2 = t1 + D;
    const t3 = t2 + 3 * D;
    const t4 = t3 + 7 * D;
    const rows = [a(false, 0), a(true, t1), a(true, t2), a(true, t3), a(true, t4)];
    const s = reviewState(rows, now(t4 + H))!;
    expect(s).toMatchObject({ stage: "mastered", successes: 4, confirmations: 3, dueAt: null, due: false });
    expect(s.masteredAt).toBe(new Date(T0 + t4).toISOString());
    // Three steps short of that is not mastery.
    expect(reviewState(rows.slice(0, 4), now(t4))!.stage).toBe("confirming");
  });

  it("never counts two answers from the same session", () => {
    const rows = [a(false, 0, "s0"), a(true, H, "s1"), a(true, H + 2 * D, "s1")];
    expect(reviewState(rows, now(5 * D))!.successes).toBe(1);
  });

  it("starts over when a cleared or confirming chart is missed", () => {
    const rows = [a(false, 0), a(true, H), a(true, H + D), a(false, 5 * D)];
    const s = reviewState(rows, now(6 * D))!;
    expect(s).toMatchObject({ stage: "open", successes: 0, lapses: 1 });
    // The new cycle needs the full run again.
    const again = reviewState([...rows, a(true, 5 * D + H), a(true, 5 * D + H + D)], now(8 * D))!;
    expect(again).toMatchObject({ stage: "confirming", successes: 2 });
  });

  it("a miss after mastery reopens it", () => {
    const t = [H, H + D, H + 4 * D, H + 11 * D];
    const rows = [a(false, 0), ...t.map((x) => a(true, x)), a(false, 20 * D)];
    expect(reviewState(rows, now(21 * D))!.stage).toBe("open");
  });

  it("doesn't depend on the order rows arrive in", () => {
    const rows = [a(true, H + D), a(true, H), a(false, 0)];
    expect(reviewState(rows, now(H + D + H))!.stage).toBe("confirming");
  });

  it("treats a missing session id as unknown, not as the same session", () => {
    const rows = [a(false, 0, null), a(true, H, null), a(true, H + D, null)];
    expect(reviewState(rows, now(2 * D))!.successes).toBe(2);
  });
});

describe("mistakes with a schedule", () => {
  const row = (id: string, correct: boolean, ms: number) => ({ exercise_id: id, is_correct: correct, created_at: new Date(T0 + ms).toISOString(), session_id: `${id}-${ms}` });

  const rows = [
    row("open-one", false, 0),
    row("fresh", false, 0), row("fresh", true, 5 * D), // cleared yesterday: not due
    row("stale", false, 0), row("stale", true, H), // cleared long ago: due
    row("done", false, 0), row("done", true, H), row("done", true, H + D), row("done", true, H + 4 * D), row("done", true, H + 11 * D),
    row("never-missed", true, 0),
  ];
  const at = now(5 * D + H);

  it("orders open first, then due, then the rest", () => {
    const order = summarizeMistakes(rows, at).map((m) => [m.exercise_id, m.stage, m.due]);
    expect(order).toEqual([
      ["open-one", "open", false],
      ["stale", "cleared", true],
      ["fresh", "cleared", false],
      ["done", "mastered", false],
    ]);
  });

  it("counts open, cleared (mastered included), due and mastered", () => {
    expect(mistakeCounts(rows, at)).toEqual({ open: 1, cleared: 3, due: 1, mastered: 1 });
  });

  it("puts due rechecks in a review session after the open mistakes", () => {
    expect(mistakeSessionIds(rows, () => true, at)).toEqual(["open-one", "stale"]);
    expect(mistakeSessionIds(rows, (id) => id !== "stale", at)).toEqual(["open-one"]);
  });
});

describe("the words", () => {
  it("'mastered' appears only for the mastered stage", () => {
    // Everything user-facing is keyed on `stage`; a single correct retry is "cleared".
    const cleared = reviewState([a(false, 0), a(true, H)], now(2 * H))!;
    expect(cleared.stage).not.toBe("mastered");
    expect(cleared.masteredAt).toBeNull();
  });
});
