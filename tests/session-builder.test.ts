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
