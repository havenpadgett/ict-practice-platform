import { describe, expect, it } from "vitest";
import { checkExit, gradeFreeTrade, type FreeTradePosition } from "@/lib/free-trade-grading";
import { gradeGuidedAttempt } from "@/lib/guided-grading";
import { freeTrade, guided } from "./fixtures";

describe("Guided Entry grading", () => {
  it("grades each step independently", () => {
    const r = gradeGuidedAttempt(guided(), { bias: "bearish", entry: 110, stop: 130, target: 141, declaredTrade: true });
    const step = (s: string) => r.steps.find((x) => x.step === s)?.verdict;
    expect(step("bias")).toBe("incorrect");
    expect(step("entry")).toBe("correct");
    // 130 is on the wrong side of the invalidation level (100 for a long) —
    // it wouldn't have protected the trade, regardless of distance.
    expect(step("stop")).toBe("incorrect");
    expect(step("target")).toBe("correct");
    expect(r.isCorrect).toBe(false);
  });

  it("passes a valid setup on process even though price then ran through the stop", () => {
    const ex = guided();
    // Sanity: the chart after the setup trades below the 100 stop — the trade would have lost.
    expect(ex.candles.slice(20).some((c) => c.low <= 100)).toBe(true);
    const r = gradeGuidedAttempt(ex, { bias: "bullish", entry: 110, stop: 100, target: 140, declaredTrade: true });
    expect(r.verdict).toBe("correct");
    expect(r.isCorrect).toBe(true);
    expect(r.achievedRR).toBeCloseTo(3);
  });

  it("an entry at the far edge of the valid zone is correct, not wrong", () => {
    // Entry zone is [107, 113] — 113 is the far edge, still fully valid.
    const r = gradeGuidedAttempt(guided(), { bias: "bullish", entry: 113, stop: 100, target: 140, declaredTrade: true });
    expect(r.steps.find((s) => s.step === "entry")?.verdict).toBe("correct");
  });

  it("a stop that protects the trade but sits wider than needed is COULD_IMPROVE, never a hard fail on width alone", () => {
    // Invalidation is 100 with a 3-point reasonable buffer; 90 still
    // protects a long (it's beyond 100), just wider than it needs to be.
    const r = gradeGuidedAttempt(guided(), { bias: "bullish", entry: 110, stop: 90, target: 140, declaredTrade: true });
    expect(r.steps.find((s) => s.step === "stop")?.verdict).toBe("could_improve");
    expect(r.verdict).toBe("could_improve");
    expect(r.isCorrect).toBe(true);
  });

  it("weak but not terrible R:R is a near miss (COULD_IMPROVE), not a hard fail", () => {
    // entry 113 (zone max) / stop 97 (correct band min) / target 137 (zone
    // min) -> risk 16, reward 24 -> exactly 1.5:1: below the 2:1 minimum
    // but at the 1.5:1 moderate floor. Every level itself is still valid.
    const r = gradeGuidedAttempt(guided(), { bias: "bullish", entry: 113, stop: 97, target: 137, declaredTrade: true });
    expect(r.achievedRR!).toBeCloseTo(1.5);
    expect(r.rrVerdict).toBe("could_improve");
    expect(r.verdict).toBe("could_improve");
    expect(r.isCorrect).toBe(true);
  });

  it("fails a correct-looking setup whose R:R is far below the minimum", () => {
    // entry 107 (zone min) / stop 70 (still protects, just wide) / target
    // 137 (zone min) -> risk 37, reward 30 -> 0.81:1, well under the 1.5:1
    // moderate floor.
    const r = gradeGuidedAttempt(guided(), { bias: "bullish", entry: 107, stop: 70, target: 137, declaredTrade: true });
    expect(r.achievedRR!).toBeLessThan(1);
    expect(r.rrVerdict).toBe("incorrect");
    expect(r.verdict).toBe("incorrect");
    expect(r.isCorrect).toBe(false);
  });

  it("trading a no-trade scenario fails regardless of how the placed levels read", () => {
    const r = gradeGuidedAttempt(guided(false), { bias: "bullish", entry: 110, stop: 100, target: 140, declaredTrade: true });
    expect(r.verdict).toBe("incorrect");
  });

  it("No Trade is correct exactly when there is no valid setup", () => {
    const bail = { bias: "unclear" as const, entry: null, stop: null, target: null, declaredTrade: false };
    expect(gradeGuidedAttempt(guided(false), bail).isCorrect).toBe(true);
    expect(gradeGuidedAttempt(guided(true), bail).isCorrect).toBe(false);
  });
});

describe("Free Trade grading — process, never outcome", () => {
  const good: FreeTradePosition = { direction: "long", entryIndex: 8, entry: 110, stop: 98, target: 140 };

  it("passes a losing trade with good process", () => {
    const exit = checkExit(good, { time: "", open: 100, high: 101, low: 97, close: 98 }, 12);
    expect(exit?.reason).toBe("stop");
    const r = gradeFreeTrade(freeTrade(), good, exit);
    expect(r.outcome).toBe("loss");
    expect(r.resultR).toBe(-1);
    expect(r.passed).toBe(true);
    expect(r.verdict).toBe("correct");
  });

  it("fails a winning trade with bad process (entry outside the zone, before the setup)", () => {
    const bad: FreeTradePosition = { direction: "long", entryIndex: 2, entry: 125, stop: 98, target: 190 };
    const exit = checkExit(bad, { time: "", open: 180, high: 191, low: 179, close: 190 }, 15);
    expect(exit?.reason).toBe("target");
    const r = gradeFreeTrade(freeTrade(), bad, exit);
    expect(r.outcome).toBe("win");
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.id === "entry")?.verdict).toBe("incorrect");
  });

  it("grades the target on its own, not only through R:R", () => {
    // Entry/stop otherwise clean, but the target is far past the ideal
    // zone [135, 140] — no longer aimed at the setup's actual liquidity,
    // even though the resulting R:R still clears the minimum.
    const overshoot: FreeTradePosition = { direction: "long", entry: 110, entryIndex: 8, stop: 98, target: 220 };
    const r = gradeFreeTrade(freeTrade(), overshoot, null);
    expect(r.checks.find((c) => c.id === "target")?.verdict).toBe("incorrect");
    expect(r.passed).toBe(false);
  });

  it("a stop that protects but is wider than needed is COULD_IMPROVE, never a hard fail on width alone", () => {
    // Invalidation is 100 with a 5-point buffer; 90 still protects (below
    // 100 for a long), just wider than needed.
    const wide: FreeTradePosition = { direction: "long", entry: 110, entryIndex: 8, stop: 90, target: 140 };
    const r = gradeFreeTrade(freeTrade(), wide, null);
    expect(r.checks.find((c) => c.id === "stop")?.verdict).toBe("could_improve");
    expect(r.passed).toBe(true);
  });

  it("fails any trade on a no-setup scenario and passes sitting it out", () => {
    expect(gradeFreeTrade(freeTrade(false), good, null).passed).toBe(false);
    expect(gradeFreeTrade(freeTrade(false), null, null).passed).toBe(true);
    expect(gradeFreeTrade(freeTrade(true), null, null).passed).toBe(false);
  });

  it("scores a candle touching both stop and target as the stop", () => {
    expect(checkExit(good, { time: "", open: 110, high: 141, low: 97, close: 120 }, 9)?.reason).toBe("stop");
  });
});
