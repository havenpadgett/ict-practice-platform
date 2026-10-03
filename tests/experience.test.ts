import { describe, expect, it } from "vitest";
import { behavior, EXPERIENCE_LEVELS, isExperience, readExperience } from "@/lib/experience";

describe("experience mode", () => {
  it("knows its two levels and nothing else", () => {
    expect(isExperience("beginner")).toBe(true);
    expect(isExperience("experienced")).toBe(true);
    for (const x of ["expert", "", null, undefined, 1, "Beginner"]) expect(isExperience(x)).toBe(false);
    expect(EXPERIENCE_LEVELS.map((l) => l.value)).toEqual(["beginner", "experienced"]);
  });

  it("gives beginners the structure and experienced learners the speed", () => {
    expect(behavior("beginner")).toEqual({
      showConceptHint: true,
      fullFeedback: true,
      guidedHints: true,
      quickAdvance: false,
      underlineTerms: true,
    });
    expect(behavior("experienced")).toEqual({
      showConceptHint: false,
      fullFeedback: false,
      guidedHints: false,
      quickAdvance: true,
      underlineTerms: false,
    });
  });

  it("describes every behaviour it changes, in words, for both levels", () => {
    for (const l of EXPERIENCE_LEVELS) {
      expect(l.details.length).toBeGreaterThanOrEqual(3);
      expect(l.summary.length).toBeGreaterThan(10);
    }
  });

  it("reads nothing where there is no browser", () => {
    expect(readExperience()).toBeNull();
  });
});
