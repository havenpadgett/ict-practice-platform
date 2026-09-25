import { describe, expect, it } from "vitest";
import { gradeAttempt, type UserAnswer } from "@/lib/grading";
import { choice, level, zone } from "./fixtures";

const box = (priceLow: number, priceHigh: number, candleIndexLow = 8, candleIndexHigh = 12): UserAnswer => ({
  type: "region",
  region: { priceLow, priceHigh, candleIndexLow, candleIndexHigh },
});

describe("zone grading (PRD 6.1)", () => {
  it("passes a correct box", () => {
    const r = gradeAttempt(zone(), box(99, 121));
    expect(r.isCorrect).toBe(true);
    expect(r.failureReason).toBeNull();
  });

  it("fails a box covering the entire chart on precision", () => {
    const r = gradeAttempt(zone(), box(0, 1000, 0, 29));
    expect(r.isCorrect).toBe(false);
    expect(r.coverage).toBe(1);
    expect(r.failureReason).toBe("precision");
  });

  it("fails a correctly placed but too-small box as too_small, not 'wrong area'", () => {
    const r = gradeAttempt(zone(), box(108, 112));
    expect(r.isCorrect).toBe(false);
    expect(r.failureReason).toBe("too_small");
    expect(r.failureMessage).not.toMatch(/wrong area/i);
  });

  it("fails a box in the wrong place as coverage / wrong area", () => {
    const r = gradeAttempt(zone(), box(200, 220));
    expect(r.failureReason).toBe("coverage");
    expect(r.failureMessage).toMatch(/wrong area/i);
  });

  it("fails the right price range on the wrong candles as time", () => {
    const r = gradeAttempt(zone(), box(99, 121, 20, 25));
    expect(r.failureReason).toBe("time");
  });

  it("accepts coverage exactly at the 60% threshold and precision exactly at 2.5x", () => {
    expect(gradeAttempt(zone(), box(100, 112)).isCorrect).toBe(true); // 12/20 = 0.6
    expect(gradeAttempt(zone(), box(90, 140)).isCorrect).toBe(true); // 50/20 = 2.5
  });
});

describe("level grading (PRD 6.2)", () => {
  it("passes just inside the tolerance and exactly at it", () => {
    expect(gradeAttempt(level(), { type: "level", price: 21005.99 }).isCorrect).toBe(true);
    expect(gradeAttempt(level(), { type: "level", price: 20994 }).isCorrect).toBe(true);
  });

  it("fails just outside the tolerance, with signed distance and direction", () => {
    const high = gradeAttempt(level(), { type: "level", price: 21006.01 });
    expect(high.isCorrect).toBe(false);
    expect(high.failureReason).toBe("off_level");
    expect(high.distanceFromLevel).toBeCloseTo(6.01);
    expect(high.failureMessage).toMatch(/too high/);
    const low = gradeAttempt(level(), { type: "level", price: 20993.99 });
    expect(low.isCorrect).toBe(false);
    expect(low.failureMessage).toMatch(/too low/);
  });
});

describe.each([
  ["zone", zone, box(99, 121)],
  ["level", level, { type: "level", price: 21000 } as UserAnswer],
] as const)("no-answer grading matrix — %s", (_name, make, drawn) => {
  it("has answer + drew it → graded by the tests (correct here)", () => {
    expect(gradeAttempt(make(true), drawn).isCorrect).toBe(true);
  });
  it("has answer + said none → incorrect, answer revealed", () => {
    const r = gradeAttempt(make(true), { type: "none" });
    expect(r.isCorrect).toBe(false);
    expect(r.failureReason).toBe("missed_answer");
    expect(r.revealZone).toBe(true);
  });
  it("no answer + drew something → incorrect, distractor note, states none exists", () => {
    const r = gradeAttempt(make(false), drawn);
    expect(r.isCorrect).toBe(false);
    expect(r.failureReason).toBe("false_positive");
    expect(r.explanation).toMatch(/^The correct answer was: no /);
    expect(r.explanation).toContain("near miss");
  });
  it("no answer + said none → correct, with the distractor note as confirmation", () => {
    const r = gradeAttempt(make(false), { type: "none" });
    expect(r.isCorrect).toBe(true);
    expect(r.explanation).toContain("near miss");
  });
});

describe("choice grading", () => {
  it("passes the correct option and fails the other, always stating the answer", () => {
    expect(gradeAttempt(choice(), { type: "choice", choice: "discount" }).isCorrect).toBe(true);
    const wrong = gradeAttempt(choice(), { type: "choice", choice: "premium" });
    expect(wrong.isCorrect).toBe(false);
    expect(wrong.failureReason).toBe("wrong_choice");
    expect(wrong.explanation).toContain("The correct answer was: Discount.");
  });
});
