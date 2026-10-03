import { describe, expect, it } from "vitest";
import { summarizeConfidence } from "@/lib/confidence";
import { attempt } from "./fixtures";

const rate = (concept: string, correct: boolean, confidence: 1 | 2 | 3 | null) => attempt(concept, correct, { confidence });

describe("confidence versus accuracy", () => {
  it("says nothing until there's something to say", () => {
    expect(summarizeConfidence([]).insight).toBeNull();
    expect(summarizeConfidence([rate("FVG", true, 3), rate("FVG", false, 3)]).insight).toBeNull();
  });

  it("leaves unrated attempts out and counts them", () => {
    const s = summarizeConfidence([rate("FVG", true, null), rate("FVG", true, 2), rate("FVG", false, null)]);
    expect(s).toMatchObject({ rated: 1, unrated: 2 });
    expect(s.levels.map((l) => l.attempts)).toEqual([0, 1, 0]);
  });

  it("withholds a level's accuracy below the sample floor", () => {
    const s = summarizeConfidence([rate("FVG", true, 3), rate("FVG", true, 3), rate("FVG", false, 3), rate("FVG", true, 1)]);
    expect(s.levels[2]).toMatchObject({ attempts: 3, correct: 2, accuracy: null });
  });

  it("finds the confidently wrong answers and where they came from", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => rate(i < 2 ? "MSS" : "FVG", i >= 3, 3)), // 3 wrong at certain: MSS x2, FVG x1
      rate("MSS", false, 2),
    ];
    const s = summarizeConfidence(rows);
    expect(s.confidentlyWrong).toEqual({ count: 3, ofCertain: 5, byConcept: [{ concept: "MSS", count: 2 }, { concept: "FVG", count: 1 }] });
    expect(s.levels[2].accuracy).toBeCloseTo(0.4);
    expect(s.insight).toContain("right 40% of the time");
    expect(s.insight).toContain("3 of your 4 rated misses");
  });

  it("flags certainty that is no better than a guess", () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => rate("FVG", i < 2, 3)), // 40%
      ...Array.from({ length: 5 }, (_, i) => rate("FVG", i < 4, 1)), // 80%
    ];
    expect(summarizeConfidence(rows).insight).toContain("no more accurate than your guesses");
  });
});
