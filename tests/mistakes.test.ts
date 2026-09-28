// Review Mistakes (src/lib/mistakes.ts, src/app/mistakes/). A mistake is an
// exercise with an incorrect attempt; it's cleared while the latest
// attempt is correct. Keys and explanations come back only for exercises
// the user has actually missed.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { exercises, isPracticeReady } from "@/data/exercises";
import { describeAnswer, describeCorrect, type MistakeAttemptRow } from "@/lib/mistake-text";
import { MISTAKES_SESSION_CAP, mistakeCounts, mistakeSessionIds, summarizeMistakes } from "@/lib/mistakes";

const at = (exercise_id: string, is_correct: boolean, minute: number) => ({
  exercise_id,
  is_correct,
  created_at: `2026-09-27T10:${String(minute).padStart(2, "0")}:00Z`,
});

describe("summarizeMistakes", () => {
  it("counts an exercise once, open until the latest attempt is correct", () => {
    const rows = [
      at("a", false, 1), // missed, never retried: open
      at("b", false, 2),
      at("b", true, 3), // missed then right: cleared
      at("c", true, 4), // never missed: not a mistake
      at("d", false, 5),
      at("d", true, 6),
      at("d", false, 7), // cleared then missed again: open
    ];
    const s = summarizeMistakes(rows);
    expect(s.map((m) => [m.exercise_id, m.status, m.missed])).toEqual([
      ["d", "open", 2],
      ["a", "open", 1],
      ["b", "cleared", 1],
    ]);
    expect(s.find((m) => m.exercise_id === "b")!.clearedAt).toBe(rows[2].created_at);
    expect(mistakeCounts(rows)).toEqual({ open: 2, cleared: 1 });
  });

  it("doesn't depend on the order rows arrive in", () => {
    const rows = [at("b", true, 3), at("b", false, 2)];
    expect(summarizeMistakes(rows)[0].status).toBe("cleared");
  });

  it("builds a mistakes session from open, available mistakes only, capped", () => {
    const rows = Array.from({ length: MISTAKES_SESSION_CAP + 5 }, (_, i) => at(`x${i}`, false, i));
    rows.push(at("gone", false, 59), at("fixed", false, 1), at("fixed", true, 2));
    const ids = mistakeSessionIds(rows, (id) => id !== "gone");
    expect(ids).toHaveLength(MISTAKES_SESSION_CAP);
    expect(ids).not.toContain("gone");
    expect(ids).not.toContain("fixed");
    expect(ids[0]).toBe(`x${MISTAKES_SESSION_CAP + 4}`);
  });
});

const blank: MistakeAttemptRow = {
  exercise_id: "",
  is_correct: false,
  created_at: "",
  user_answer_type: "none",
  user_price_low: null,
  user_price_high: null,
  user_price: null,
  user_choice: null,
  guided_bias_choice: null,
  guided_entry_price: null,
  guided_stop_price: null,
  guided_target_price: null,
  guided_declared_trade: null,
  free_direction: null,
  free_entry_price: null,
  free_stop_price: null,
  free_target_price: null,
  free_exit_price: null,
  free_exit_reason: null,
};

describe("mistake text", () => {
  it("describes every exercise's correct answer and explanation", () => {
    for (const e of exercises) {
      const d = describeCorrect(e);
      expect(d.correctAnswer.length, e.exercise_id).toBeGreaterThan(2);
      expect(d.correctAnswer, e.exercise_id).not.toContain("undefined");
      expect(d.explanation.length, e.exercise_id).toBeGreaterThan(10);
    }
  });

  it("states a no-answer exercise's answer and uses its near-miss note", () => {
    const e = exercises.find((x) => x.answer_type === "zone" && !x.has_answer)!;
    const d = describeCorrect(e);
    expect(d.correctAnswer).toMatch(/^No /);
    expect(d.explanation).toBe(e.distractor_note);
  });

  it("reads back what the user answered", () => {
    const zone = exercises.find((x) => x.answer_type === "zone")!;
    expect(describeAnswer(zone, { ...blank, user_answer_type: "region", user_price_low: 21100.25, user_price_high: 21130 })).toBe(
      "A box from 21,100 to 21,130",
    );
    expect(describeAnswer(zone, blank)).toBe("noAnswerLabel" in zone ? zone.noAnswerLabel : "");
    const choice = exercises.find((x) => x.answer_type === "choice")!;
    if (choice.answer_type !== "choice") throw new Error("fixture");
    expect(describeAnswer(choice, { ...blank, user_answer_type: "choice", user_choice: choice.options[0].value })).toBe(choice.options[0].label);
    const guided = exercises.find((x) => x.answer_type === "guided")!;
    expect(describeAnswer(guided, { ...blank, user_answer_type: "guided", guided_bias_choice: "unclear", guided_declared_trade: false })).toBe(
      "Unclear bias, then No Trade",
    );
    const free = exercises.find((x) => x.answer_type === "free")!;
    expect(
      describeAnswer(free, {
        ...blank, user_answer_type: "free", free_direction: "long",
        free_entry_price: 100, free_stop_price: 90, free_target_price: 130, free_exit_reason: "stop",
      }),
    ).toBe("Long at 100, stop 90, target 130; exited at the stop");
  });
});

let signedIn = true;
let rows: MistakeAttemptRow[] = [];
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: "u" } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }) }),
  }),
}));
const { loadMistakes } = await import("@/app/mistakes/actions");

describe("loadMistakes", () => {
  beforeEach(() => {
    signedIn = true;
  });

  it("refuses signed-out callers", async () => {
    signedIn = false;
    expect(await loadMistakes()).toMatchObject({ ok: false });
  });

  it("returns keys only for exercises the user missed", async () => {
    const [missed, right, retired] = exercises.filter((e) => e.answer_type === "zone" && isPracticeReady(e));
    const unready = exercises.find((e) => !isPracticeReady(e) && e.answer_type === "level")!;
    rows = [
      { ...blank, exercise_id: missed.exercise_id, created_at: "2026-09-27T10:00:00Z" },
      { ...blank, exercise_id: right.exercise_id, is_correct: true, created_at: "2026-09-27T10:01:00Z" },
      { ...blank, exercise_id: retired.exercise_id, created_at: "2026-09-27T10:02:00Z" },
      { ...blank, exercise_id: retired.exercise_id, is_correct: true, created_at: "2026-09-27T10:03:00Z" },
      { ...blank, exercise_id: unready.exercise_id, created_at: "2026-09-27T10:04:00Z" },
      { ...blank, exercise_id: "no-such-exercise", created_at: "2026-09-27T10:05:00Z" },
    ];
    const res = await loadMistakes();
    if (!res.ok) throw new Error(res.error);
    expect(res.items.map((i) => [i.exercise_id, i.status, i.retryable])).toEqual([
      [unready.exercise_id, "open", false],
      [missed.exercise_id, "open", true],
      [retired.exercise_id, "cleared", true],
    ]);
    expect(res.items.some((i) => i.exercise_id === right.exercise_id)).toBe(false);
    expect(JSON.stringify(res.items)).not.toContain(describeCorrect(right).correctAnswer);
  });
});
