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

  it("grades a correctly placed but too-small box as too_small and COULD_IMPROVE, not 'wrong area'", () => {
    const r = gradeAttempt(zone(), box(108, 112));
    expect(r.verdict).toBe("could_improve");
    expect(r.isCorrect).toBe(true);
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

  it("grades just outside the tolerance as a near miss (COULD_IMPROVE), with signed distance and direction", () => {
    const high = gradeAttempt(level(), { type: "level", price: 21006.01 });
    expect(high.verdict).toBe("could_improve");
    expect(high.isCorrect).toBe(true);
    expect(high.failureReason).toBe("off_level");
    expect(high.distanceFromLevel).toBeCloseTo(6.01);
    expect(high.failureMessage).toMatch(/too high/);
    const low = gradeAttempt(level(), { type: "level", price: 20993.99 });
    expect(low.verdict).toBe("could_improve");
    expect(low.failureMessage).toMatch(/too low/);
  });

  it("fails well outside the tolerance as a genuinely wrong level", () => {
    const far = gradeAttempt(level(), { type: "level", price: 21100 });
    expect(far.verdict).toBe("incorrect");
    expect(far.isCorrect).toBe(false);
    expect(far.failureReason).toBe("off_level");
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

describe("feedback checklist (reports every test, never changes the verdict)", () => {
  it("reports all three zone tests with measured values when several fail", () => {
    const r = gradeAttempt(zone(), box(0, 1000, 20, 25));
    expect(r.isCorrect).toBe(false);
    const byId = Object.fromEntries((r.checks ?? []).map((c) => [c.id, c]));
    expect(byId.coverage.verdict).toBe("correct");
    expect(byId.size.verdict).toBe("incorrect");
    expect(byId.candles.verdict).toBe("incorrect");
    expect(byId.edges.verdict).toBeNull();
    expect(byId.size.detail).toMatch(/× the zone's height/);
  });

  it("all zone checks pass on a correct box", () => {
    const r = gradeAttempt(zone(), box(99, 121));
    expect(r.checks?.filter((c) => c.verdict === "incorrect")).toEqual([]);
  });

  it("says how far off a level is, and when it's close but outside tolerance", () => {
    const lv = level();
    const tol = lv.answer!.tolerance;
    const near = gradeAttempt(lv, { type: "level", price: lv.answer!.price + tol * 1.5 });
    expect(near.checks?.[0].verdict).toBe("could_improve");
    expect(near.checks?.[0].detail).toMatch(/Right area/);
    const far = gradeAttempt(lv, { type: "level", price: lv.answer!.price - tol * 5 });
    expect(far.checks?.[0].detail).toMatch(/too low/);
  });

  it("has no checklist for presence-only answers or choices", () => {
    expect(gradeAttempt(zone(), { type: "none" }).checks).toBeNull();
    expect(gradeAttempt(choice(), { type: "choice", choice: "respected" }).checks).toBeNull();
  });
});
