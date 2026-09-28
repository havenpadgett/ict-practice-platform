import { describe, expect, it } from "vitest";
import { getExerciseMeta } from "@/data/catalog";
import { buildMixedSessionIds } from "@/lib/session-builder";
import { accuracyLabel } from "@/lib/practice-modes";

describe("mixed-concepts session", () => {
  it("draws distinct, practice-ready recognition exercises from several concepts", () => {
    for (let run = 0; run < 50; run++) {
      const ids = buildMixedSessionIds(10);
      expect(ids).toHaveLength(10);
      expect(new Set(ids).size).toBe(10);
      const metas = ids.map((id) => getExerciseMeta(id)!);
      expect(metas.every((m) => m.practice_ready)).toBe(true);
      expect(metas.some((m) => m.concept === "GuidedEntry" || m.concept === "FreeTrade")).toBe(false);
      expect(new Set(metas.map((m) => m.concept)).size).toBeGreaterThanOrEqual(3);
    }
  });

  it("stops when it runs out rather than repeating", () => {
    const ids = buildMixedSessionIds(1000);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("accuracy labels", () => {
  it("never shows a percentage below five attempts", () => {
    expect(accuracyLabel(undefined)).toBe("Not started");
    expect(accuracyLabel({ attempts: 1, accuracy: 1 })).toBe("1 attempt · not enough to score yet");
    expect(accuracyLabel({ attempts: 4, accuracy: 0 })).toBe("4 attempts · not enough to score yet");
    expect(accuracyLabel({ attempts: 22, accuracy: 0.727 })).toBe("73% · 22 attempts");
  });
});

import { sessionInsight } from "@/lib/session-insight";

describe("session insight", () => {
  const conceptOf = (id: string) => (id.startsWith("fvg") ? "FVG" : id.startsWith("liq") ? "Liquidity" : "GuidedEntry");
  it("names the clean concept and where the misses came from", () => {
    const text = sessionInsight(
      [
        { exercise_id: "liq-1", correct: true, failure_reason: null },
        { exercise_id: "liq-2", correct: true, failure_reason: null },
        { exercise_id: "fvg-1", correct: false, failure_reason: "precision" },
        { exercise_id: "fvg-2", correct: false, failure_reason: "precision" },
      ],
      conceptOf,
    );
    expect(text).toBe("You got every Liquidity chart right. Both misses were in FVG: box drawn too wide.");
  });
  it("lists mixed reasons within one concept, most common first", () => {
    const text = sessionInsight(
      [
        { exercise_id: "fvg-1", correct: false, failure_reason: "time" },
        { exercise_id: "fvg-2", correct: false, failure_reason: "precision" },
        { exercise_id: "fvg-3", correct: false, failure_reason: "precision" },
      ],
      conceptOf,
    );
    expect(text).toBe("All three misses: box drawn too wide (2) and box over the wrong candles (1).");
  });
  it("says so when everything was right, and says nothing without outcomes", () => {
    expect(sessionInsight([{ exercise_id: "fvg-1", correct: true, failure_reason: null }], conceptOf)).toBe("Every answer correct.");
    expect(sessionInsight([], conceptOf)).toBe("");
  });
});

import { analyticsInsight } from "@/lib/analytics-insight";
import { filterAttempts } from "@/lib/progress";
import type { DbAttempt } from "@/lib/attempts";

describe("analytics insight and filters", () => {
  const at = (concept: string, is_correct: boolean, daysAgo: number) =>
    ({ concept, is_correct, created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), exercise_id: "x" }) as DbAttempt;

  it("won't name a strongest or weakest concept from tiny samples", () => {
    const rows = [at("FVG", true, 1), at("Liquidity", false, 1), ...Array.from({ length: 6 }, () => at("MSS", true, 1))];
    expect(analyticsInsight(rows, "all time")).toMatch(/Practice at least two concepts/);
  });

  it("names strongest and weakest once two concepts have enough attempts", () => {
    const rows = [...Array.from({ length: 6 }, () => at("FVG", true, 1)), ...Array.from({ length: 6 }, (_, i) => at("MSS", i < 2, 1))];
    const text = analyticsInsight(rows, "all time");
    expect(text).toMatch(/Strongest: FVG \(100% of 6\)/);
    expect(text).toMatch(/most work: MSS \(33% of 6\)/);
  });

  it("filters by period, mode and concept", () => {
    const rows = [at("FVG", true, 2), at("FVG", true, 20), at("GuidedEntry", false, 2), at("FreeTrade", true, 40)];
    expect(filterAttempts(rows, { days: 7, mode: "all", concept: "all" })).toHaveLength(2);
    expect(filterAttempts(rows, { days: null, mode: "recognition", concept: "all" })).toHaveLength(2);
    expect(filterAttempts(rows, { days: 30, mode: "guided", concept: "all" })).toHaveLength(1);
    expect(filterAttempts(rows, { days: null, mode: "all", concept: "FreeTrade" })).toHaveLength(1);
  });
});
