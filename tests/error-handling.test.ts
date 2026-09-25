import { describe, expect, it } from "vitest";
import { exercises } from "@/data/exercises";
import { invalidRealScenarios, parseRealScenario, realScenarios } from "@/data/real-scenarios";
import { classifyError, describeError } from "@/lib/errors";

describe("friendly errors", () => {
  it.each([
    [new TypeError("Failed to fetch"), "network"],
    [{ message: "JWT expired", code: "PGRST301" }, "auth"],
    [{ message: 'new row violates row-level security policy for table "attempts"', code: "42501" }, "auth"],
    [{ message: "duplicate key value", code: "23505" }, "other"],
  ])("classifies %o as %s", (err, kind) => {
    expect(classifyError(err)).toBe(kind);
  });

  it("never shows raw auth jargon", () => {
    const e = describeError({ message: "JWT expired", status: 401 }, "save this attempt");
    expect(e.message).toMatch(/login has expired/);
    expect(e.message).not.toMatch(/JWT/);
  });
});

describe("malformed exercise data", () => {
  it("rejects a malformed real scenario with a clear message instead of a type error", () => {
    expect(() => parseRealScenario({ exercise_id: "real-x-001", concept: "FVG" })).toThrow(/real-x-001/);
    expect(() => parseRealScenario(null)).toThrow(/not an object/);
  });

  it("loads the registry without throwing, every registered file valid", () => {
    expect(invalidRealScenarios).toEqual([]);
    expect(realScenarios.length).toBeGreaterThan(0);
  });

  it("every exercise id is unique and every answer-bearing exercise has an answer", () => {
    const ids = exercises.map((e) => e.exercise_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of exercises) {
      if ((e.answer_type === "zone" || e.answer_type === "level") && e.has_answer) expect(e.answer).not.toBeNull();
      if ((e.answer_type === "zone" || e.answer_type === "level") && !e.has_answer) expect(e.distractor_note).toBeTruthy();
    }
  });
});
