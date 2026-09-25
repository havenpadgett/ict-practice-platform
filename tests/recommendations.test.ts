import { describe, expect, it } from "vitest";
import { buildAdaptiveSession, recommendSession, scoreConcepts } from "@/lib/recommendations";
import { getExercise } from "@/data/exercises";
import { attempt } from "./fixtures";

const many = (concept: string, results: boolean[]) => results.map((ok) => attempt(concept, ok));

describe("recommendation engine", () => {
  it("one wrong answer doesn't make a concept the weakest", () => {
    const history = [...many("FVG", Array(10).fill(true)), ...many("Liquidity", [true, true, false, true, true, true, true, false]), ...many("MSS", [false])];
    const scores = scoreConcepts(history).concepts;
    const mss = scores.find((c) => c.concept === "MSS")!;
    const liq = scores.find((c) => c.concept === "Liquidity")!;
    expect(mss.accuracy).toBe(0);
    expect(mss.score).toBeGreaterThan(0.6); // shrunk toward the ~84% overall, not 0%
    expect(recommendSession(history).concept).not.toBe("MSS");
    expect(liq.attempts).toBe(8);
  });

  it("a concept that is genuinely weak over many attempts is recommended, with the numbers in the reason", () => {
    const history = [...many("FVG", Array(20).fill(true)), ...many("MSS", Array.from({ length: 20 }, (_, i) => i % 2 === 0))];
    const rec = recommendSession(history);
    expect(rec.concept).toBe("MSS");
    expect(rec.reason).toMatch(/50% over your last 20 attempts, below your 75% overall/);
    expect(rec.href).toBe(`/practice?concept=MSS&difficulty=${rec.difficulty}&length=${rec.length}`);
  });

  it("recency weighting registers improvement", () => {
    const improving = [...Array(10).fill(false), ...Array(10).fill(true)];
    const declining = [...improving].reverse();
    const up = scoreConcepts([...many("FVG", Array(10).fill(true)), ...many("MSS", improving)]).concepts.find((c) => c.concept === "MSS")!;
    const down = scoreConcepts([...many("FVG", Array(10).fill(true)), ...many("MSS", declining)]).concepts.find((c) => c.concept === "MSS")!;
    expect(up.accuracy).toBe(down.accuracy);
    expect(up.score).toBeGreaterThan(down.score + 0.15);
  });

  it("adaptive sessions lean toward the weak concept but keep others", () => {
    const history = [...many("FVG", Array(20).fill(true)), ...many("MSS", Array.from({ length: 20 }, (_, i) => i % 3 === 0))];
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const concepts = buildAdaptiveSession(history, 10, random).map((id) => getExercise(id)!.concept);
    const mss = concepts.filter((c) => c === "MSS").length;
    expect(mss).toBeGreaterThanOrEqual(5);
    expect(concepts.length - mss).toBeGreaterThanOrEqual(3);
  });
});
