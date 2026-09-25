import { describe, expect, it } from "vitest";
import { checkExit, gradeFreeTrade, type FreeTradePosition } from "@/lib/free-trade-grading";
import { gradeGuidedAttempt } from "@/lib/guided-grading";
import { freeTrade, guided } from "./fixtures";

describe("Guided Entry grading", () => {
  it("grades each step independently", () => {
    const r = gradeGuidedAttempt(guided(), { bias: "bearish", entry: 110, stop: 130, target: 141, declaredTrade: true });
    const step = (s: string) => r.steps.find((x) => x.step === s)?.isCorrect;
    expect(step("bias")).toBe(false);
    expect(step("entry")).toBe(true);
    expect(step("stop")).toBe(false);
    expect(step("target")).toBe(true);
    expect(r.isCorrect).toBe(false);
  });

  it("passes a valid setup on process even though price then ran through the stop", () => {
    const ex = guided();
    // Sanity: the chart after the setup trades below the 100 stop — the trade would have lost.
    expect(ex.candles.slice(20).some((c) => c.low <= 100)).toBe(true);
    const r = gradeGuidedAttempt(ex, { bias: "bullish", entry: 110, stop: 100, target: 140, declaredTrade: true });
    expect(r.isCorrect).toBe(true);
    expect(r.achievedRR).toBeCloseTo(3);
  });

  it("fails a correct-looking setup the user built below the minimum R:R", () => {
    const r = gradeGuidedAttempt(guided(), { bias: "bullish", entry: 112, stop: 97, target: 138, declaredTrade: true });
    expect(r.achievedRR!).toBeLessThan(2);
    expect(r.isCorrect).toBe(false);
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
  });

  it("fails a winning trade with bad process (entry outside the zone, before the setup)", () => {
    const bad: FreeTradePosition = { direction: "long", entryIndex: 2, entry: 125, stop: 98, target: 190 };
    const exit = checkExit(bad, { time: "", open: 180, high: 191, low: 179, close: 190 }, 15);
    expect(exit?.reason).toBe("target");
    const r = gradeFreeTrade(freeTrade(), bad, exit);
    expect(r.outcome).toBe("win");
    expect(r.passed).toBe(false);
    expect(r.checks.find((c) => c.id === "entry")?.status).toBe("fail");
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
